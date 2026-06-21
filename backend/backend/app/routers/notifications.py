import uuid
import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from app.database import get_db
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import NotificationOut, NotificationListOut
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListOut)
async def list_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = [Notification.user_id == current_user.id]
    if is_read is not None:
        filters.append(Notification.is_read == is_read)

    q = (
        select(Notification)
        .where(and_(*filters))
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    total_q = select(func.count(Notification.id)).where(and_(*filters))
    unread_q = select(func.count(Notification.id)).where(
        and_(Notification.user_id == current_user.id, Notification.is_read == False)
    )

    total = (await db.execute(total_q)).scalar_one()
    unread_count = (await db.execute(unread_q)).scalar_one()
    notifications = (await db.execute(q)).scalars().all()

    return NotificationListOut(
        items=[NotificationOut.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.get("/unread-count")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = (
        await db.execute(
            select(func.count(Notification.id)).where(
                and_(Notification.user_id == current_user.id, Notification.is_read == False)
            )
        )
    ).scalar_one()
    return {"count": count}


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            and_(Notification.id == notification_id, Notification.user_id == current_user.id)
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    notification.is_read = True
    await db.flush()
    return NotificationOut.model_validate(notification)


@router.patch("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(and_(Notification.user_id == current_user.id, Notification.is_read == False))
        .values(is_read=True)
    )
    await db.flush()
