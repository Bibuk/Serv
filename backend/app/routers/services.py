import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.service import Service
from app.schemas.service import ServiceOut, ServiceCreate, ServiceUpdate, ServiceListOut
from app.dependencies import get_current_user, require_manager
from app.services.audit import log_action
from app.models.audit_log import AuditEntityType

router = APIRouter(prefix="/api/services", tags=["services"])


@router.get("/", response_model=ServiceListOut)
async def list_services(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(select(func.count(Service.id)))).scalar_one()
    services = (
        await db.execute(
            select(Service).order_by(Service.name).offset((page - 1) * size).limit(size)
        )
    ).scalars().all()
    return ServiceListOut(
        items=[ServiceOut.model_validate(s) for s in services],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    body: ServiceCreate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    svc = Service(**body.model_dump())
    db.add(svc)
    await db.flush()
    log_action(db, current_user.id, "service.created", AuditEntityType.service, svc.id,
               {"name": svc.name})
    return ServiceOut.model_validate(svc)


@router.get("/{service_id}", response_model=ServiceOut)
async def get_service(
    service_id: uuid.UUID,
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")
    return ServiceOut.model_validate(svc)


@router.patch("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: uuid.UUID,
    body: ServiceUpdate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(svc, field, value)

    await db.flush()
    log_action(db, current_user.id, "service.updated", AuditEntityType.service, svc.id,
               {"fields": sorted(update_data.keys())})
    return ServiceOut.model_validate(svc)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Service).where(Service.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    log_action(db, current_user.id, "service.deleted", AuditEntityType.service, svc.id,
               {"name": svc.name})
    await db.delete(svc)
    await db.flush()
