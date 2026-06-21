import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserCreate, UserUpdate, UserListOut
from app.dependencies import get_current_user, require_admin
from app.services.auth import hash_password
from app.services.audit import log_action
from app.models.audit_log import AuditEntityType

router = APIRouter(prefix="/api/users", tags=["users"])


class MeUpdate(UserUpdate):
    """Fields a user can update on their own profile."""
    pass


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """Return the currently authenticated user."""
    return UserOut.model_validate(current_user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: MeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the currently authenticated user's own profile (full_name, notify_email)."""
    update_data = body.model_dump(exclude_unset=True)
    for field in ("role", "team_id", "is_active", "password"):
        update_data.pop(field, None)

    if "password" in update_data:
        current_user.password_hash = hash_password(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.flush()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.get("/", response_model=UserListOut)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    role: Optional[UserRole] = None,
    team_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if role:
        filters.append(User.role == role)
    if team_id:
        filters.append(User.team_id == team_id)
    if is_active is not None:
        filters.append(User.is_active == is_active)

    count_q = select(func.count(User.id))
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar_one()

    q = select(User)
    if filters:
        q = q.where(and_(*filters))
    q = q.offset((page - 1) * size).limit(size).order_by(User.created_at.desc())
    users = (await db.execute(q)).scalars().all()

    return UserListOut(
        items=[UserOut.model_validate(u) for u in users],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        team_id=body.team_id,
        is_active=body.is_active,
        notify_email=body.notify_email,
    )
    db.add(user)
    await db.flush()
    log_action(db, current_user.id, "user.created", AuditEntityType.user, user.id,
               {"email": user.email, "role": user.role.value})
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.admin and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.admin and current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)

    if current_user.role != UserRole.admin:
        update_data.pop("role", None)
        update_data.pop("team_id", None)
        update_data.pop("is_active", None)

    password_changed = "password" in update_data
    if password_changed:
        user.password_hash = hash_password(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    changed = sorted(list(update_data.keys()) + (["password"] if password_changed else []))
    log_action(db, current_user.id, "user.updated", AuditEntityType.user, user.id,
               {"fields": changed})
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.is_active = False
    await db.flush()
    log_action(db, current_user.id, "user.archived", AuditEntityType.user, user.id)
