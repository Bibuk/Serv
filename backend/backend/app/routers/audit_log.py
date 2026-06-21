import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog, AuditEntityType
from app.dependencies import require_admin

router = APIRouter(prefix="/api/audit-log", tags=["audit-log"])


class AuditLogOut:
    pass


from pydantic import BaseModel
from datetime import datetime


class AuditLogItemOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    action: str
    entity_type: AuditEntityType
    entity_id: Optional[uuid.UUID] = None
    meta: Optional[dict] = None
    created_at: datetime
    user_full_name: Optional[str] = None
    user_email: Optional[str] = None

    model_config = {"from_attributes": True}


class AuditLogListOut(BaseModel):
    items: list[AuditLogItemOut]
    total: int
    page: int
    size: int
    pages: int


@router.get("/", response_model=AuditLogListOut)
async def list_audit_log(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    entity_type: Optional[AuditEntityType] = None,
    user_id: Optional[uuid.UUID] = None,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    filters = []
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if user_id:
        filters.append(AuditLog.user_id == user_id)

    count_q = select(func.count(AuditLog.id))
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar_one()

    q = select(AuditLog)
    if filters:
        q = q.where(and_(*filters))
    q = q.offset((page - 1) * size).limit(size).order_by(AuditLog.created_at.desc())
    logs = (await db.execute(q)).scalars().all()

    items = []
    for log in logs:
        items.append(
            AuditLogItemOut(
                id=log.id,
                user_id=log.user_id,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                meta=log.meta,
                created_at=log.created_at,
                user_full_name=log.user.full_name if log.user else None,
                user_email=log.user.email if log.user else None,
            )
        )

    return AuditLogListOut(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )
