import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.limiter import limiter
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, RegisterRequest, MeResponse, UserAuthResponse
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.services.redis_client import blacklist_jti, is_jti_blacklisted
from app.services.audit import log_action
from app.models.audit_log import AuditEntityType
from app.dependencies import get_current_user
from app.config import settings

# Deterministic color palette for user avatars
_AVATAR_COLORS = [
    "#2563EB", "#7C3AED", "#059669", "#D97706",
    "#DC2626", "#EC4899", "#0EA5E9", "#10B981",
    "#6366F1", "#F59E0B", "#8B5CF6", "#9CA3AF",
]


def _user_to_auth_response(user: User) -> UserAuthResponse:
    """Map the User ORM object to the frontend-compatible UserAuthResponse."""
    initials = "".join(w[0].upper() for w in user.full_name.split() if w)[:2] or "?"
    color_idx = int(user.id) % len(_AVATAR_COLORS) if isinstance(user.id, int) else \
        sum(user.id.bytes) % len(_AVATAR_COLORS)
    team_name = user.team.name if user.team else ""
    return UserAuthResponse(
        id=str(user.id),
        email=user.email,
        name=user.full_name,
        role=user.role.value,
        team=team_name,
        avatar=initials,
        color=_AVATAR_COLORS[color_idx],
    )

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_KWARGS = dict(
    httponly=True,
    samesite="lax",
    secure=settings.APP_ENV == "production",
)


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=UserRole.client,
    )
    db.add(user)
    await db.flush()
    log_action(db, user.id, "auth.registered", AuditEntityType.user, user.id)

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)

    response.set_cookie(key="access_token", value=access_token, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, **COOKIE_KWARGS)
    response.set_cookie(key="refresh_token", value=refresh_token, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, **COOKIE_KWARGS)

    return {"message": "Registered successfully", "user_id": str(user.id)}


@router.post("/login")
@limiter.limit("20/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.email == body.email).options(selectinload(User.team))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    # Portal isolation: the client portal only admits client accounts; the
    # internal portal only admits staff. This is the real boundary — clients
    # can never obtain a staff session (or vice versa) even if they reach the
    # other portal's login form.
    is_client = user.role == UserRole.client
    if body.portal == "client" and not is_client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Этот аккаунт не имеет доступа к клиентскому порталу",
        )
    if body.portal == "internal" and is_client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Клиентский аккаунт не имеет доступа к внутреннему порталу",
        )

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)

    response.set_cookie(key="access_token", value=access_token, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, **COOKIE_KWARGS)
    response.set_cookie(key="refresh_token", value=refresh_token, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, **COOKIE_KWARGS)

    log_action(db, user.id, "auth.login", AuditEntityType.user, user.id)

    return _user_to_auth_response(user)


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        payload = decode_token(refresh_token)
        if payload and payload.get("jti"):
            try:
                exp = payload.get("exp", 0)
                ttl = max(int(exp - datetime.now(timezone.utc).timestamp()), 1)
                await blacklist_jti(payload["jti"], ttl)
            except Exception:
                pass  # Redis unavailable — token expires naturally
        if payload and payload.get("sub"):
            try:
                uid = uuid.UUID(payload["sub"])
                log_action(db, uid, "auth.logout", AuditEntityType.user, uid)
            except ValueError:
                pass

    response.delete_cookie("access_token", **COOKIE_KWARGS)
    response.delete_cookie("refresh_token", **COOKIE_KWARGS)
    return {"message": "Logged out"}


@router.post("/refresh")
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    jti = payload.get("jti")
    if not jti or await is_jti_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Blacklist the old refresh token before issuing new ones
    exp = payload.get("exp", 0)
    ttl = max(int(exp - datetime.now(timezone.utc).timestamp()), 1)
    await blacklist_jti(jti, ttl)

    access_token = create_access_token(user.id, user.role.value)
    new_refresh_token = create_refresh_token(user.id)

    response.set_cookie(key="access_token", value=access_token, max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60, **COOKIE_KWARGS)
    response.set_cookie(key="refresh_token", value=new_refresh_token, max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400, **COOKIE_KWARGS)

    return {"message": "Tokens refreshed"}


@router.get("/me", response_model=UserAuthResponse)
async def me(current_user: User = Depends(get_current_user)):
    return _user_to_auth_response(current_user)
