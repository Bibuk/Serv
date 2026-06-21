import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.application import Application, ApplicationStatus
from app.models.service import Service
from app.schemas.application import ApplicationOut, ApplicationCreate, ApplicationUpdate, ApplicationListOut
from app.dependencies import get_current_user, require_manager
from app.services.audit import log_action
from app.models.audit_log import AuditEntityType

router = APIRouter(prefix="/api/applications", tags=["applications"])


async def _fetch_services(db: AsyncSession, service_ids: list) -> list:
    """Resolve a list of service ids to Service rows (ignoring unknown ids)."""
    if not service_ids:
        return []
    rows = (await db.execute(select(Service).where(Service.id.in_(service_ids)))).scalars().all()
    return list(rows)


@router.get("/", response_model=ApplicationListOut)
async def list_applications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    app_status: Optional[ApplicationStatus] = Query(None, alias="status"),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Application)
    count_q = select(func.count(Application.id))
    if app_status:
        base = base.where(Application.status == app_status)
        count_q = count_q.where(Application.status == app_status)

    total = (await db.execute(count_q)).scalar_one()
    q = base.order_by(Application.name).offset((page - 1) * size).limit(size)
    apps = (await db.execute(q)).scalars().all()
    return ApplicationListOut(
        items=[ApplicationOut.model_validate(a) for a in apps],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=ApplicationOut, status_code=status.HTTP_201_CREATED)
async def create_application(
    body: ApplicationCreate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    app = Application(name=body.name, description=body.description, color=body.color)
    if body.service_ids:
        app.services = await _fetch_services(db, body.service_ids)
    db.add(app)
    await db.flush()
    log_action(db, current_user.id, "application.created", AuditEntityType.application, app.id,
               {"name": app.name})
    return ApplicationOut.model_validate(app)


@router.get("/{app_id}", response_model=ApplicationOut)
async def get_application(
    app_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return ApplicationOut.model_validate(app)


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update_application(
    app_id: uuid.UUID,
    body: ApplicationUpdate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    update_data = body.model_dump(exclude_unset=True)
    service_ids = update_data.pop("service_ids", None)
    for field, value in update_data.items():
        setattr(app, field, value)
    if service_ids is not None:
        app.services = await _fetch_services(db, service_ids)

    await db.flush()
    log_action(db, current_user.id, "application.updated", AuditEntityType.application, app.id,
               {"fields": sorted(body.model_dump(exclude_unset=True).keys())})
    return ApplicationOut.model_validate(app)


@router.patch("/{app_id}/archive", response_model=ApplicationOut)
async def archive_application(
    app_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    app.status = ApplicationStatus.archived
    await db.flush()
    log_action(db, current_user.id, "application.archived", AuditEntityType.application, app.id)
    return ApplicationOut.model_validate(app)
