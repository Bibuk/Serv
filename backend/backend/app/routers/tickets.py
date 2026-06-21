import uuid
import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus, TicketPriority
from app.models.task import Task
from app.models.audit_log import AuditLog, AuditEntityType
from app.schemas.ticket import TicketOut, TicketCreate, TicketUpdate, TicketListOut, TicketReject, TicketLinkTask
from app.dependencies import get_current_user
from app.services.notification import create_notification
from app.models.notification import NotificationEntityType

router = APIRouter(prefix="/api/tickets", tags=["tickets"])

# §4.1 ticket lifecycle: new → processing → accepted → closed (↘ rejected)
_TICKET_TRANSITIONS = {
    TicketStatus.new: {TicketStatus.processing, TicketStatus.rejected},
    TicketStatus.processing: {TicketStatus.accepted, TicketStatus.rejected},
    TicketStatus.accepted: {TicketStatus.closed, TicketStatus.rejected},
    TicketStatus.rejected: set(),
    TicketStatus.closed: set(),
}
# Statuses the client is notified about (§6.2)
_CLIENT_NOTIFY_STATUSES = {TicketStatus.accepted, TicketStatus.rejected, TicketStatus.closed}


async def _log_audit(db, user_id, action, entity_id, meta=None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=AuditEntityType.ticket,
        entity_id=entity_id,
        meta=meta,
    )
    db.add(log)


@router.get("/", response_model=TicketListOut)
async def list_tickets(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    ticket_status: Optional[TicketStatus] = Query(None, alias="status"),
    application_id: Optional[uuid.UUID] = None,
    priority: Optional[TicketPriority] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = []

    # Clients only see their own tickets
    if current_user.role == UserRole.client:
        filters.append(Ticket.client_id == current_user.id)

    if ticket_status:
        filters.append(Ticket.status == ticket_status)
    if application_id:
        filters.append(Ticket.application_id == application_id)
    if priority:
        filters.append(Ticket.priority == priority)

    count_q = select(func.count(Ticket.id))
    if filters:
        count_q = count_q.where(and_(*filters))
    total = (await db.execute(count_q)).scalar_one()

    q = select(Ticket)
    if filters:
        q = q.where(and_(*filters))
    q = q.offset((page - 1) * size).limit(size).order_by(Ticket.created_at.desc())
    tickets = (await db.execute(q)).scalars().all()

    return TicketListOut(
        items=[TicketOut.model_validate(t) for t in tickets],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.client:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only clients can create tickets",
        )

    ticket = Ticket(
        title=body.title,
        description=body.description,
        priority=body.priority,
        client_id=current_user.id,
        application_id=body.application_id,
    )
    db.add(ticket)
    await db.flush()
    await _log_audit(db, current_user.id, "ticket.created", ticket.id)
    await db.refresh(ticket)
    return TicketOut.model_validate(ticket)


@router.get("/stats")
async def ticket_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ticket counts scoped to the caller (client → own; staff → all)."""
    open_statuses = [TicketStatus.new, TicketStatus.processing, TicketStatus.accepted]
    closed_statuses = [TicketStatus.closed, TicketStatus.rejected]

    base = select(func.count(Ticket.id))
    if current_user.role == UserRole.client:
        base = base.where(Ticket.client_id == current_user.id)

    total = (await db.execute(base)).scalar_one()
    open_count = (await db.execute(base.where(Ticket.status.in_(open_statuses)))).scalar_one()
    closed_count = (await db.execute(base.where(Ticket.status.in_(closed_statuses)))).scalar_one()

    return {"total": total, "open": open_count, "closed": closed_count}


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if current_user.role == UserRole.client and ticket.client_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # §4.1: auto-transition new → processing when a manager opens the ticket
    if current_user.role in (UserRole.manager, UserRole.admin) and ticket.status == TicketStatus.new:
        ticket.status = TicketStatus.processing
        ticket.updated_at = datetime.now(timezone.utc)
        await db.flush()
        await _log_audit(db, current_user.id, "ticket.viewed", ticket.id,
                         {"old": "new", "new": "processing"})

    return TicketOut.model_validate(ticket)


@router.patch("/{ticket_id}", response_model=TicketOut)
async def update_ticket(
    ticket_id: uuid.UUID,
    body: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clients cannot update ticket status")

    old_status = ticket.status
    update_data = body.model_dump(exclude_unset=True)

    new_status = update_data.get("status")
    status_changed = new_status is not None and new_status != old_status
    if status_changed and new_status not in _TICKET_TRANSITIONS[old_status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Invalid ticket transition: {old_status.value} → {new_status.value}",
        )

    for field, value in update_data.items():
        setattr(ticket, field, value)

    ticket.updated_at = datetime.now(timezone.utc)
    await db.flush()

    if status_changed:
        await _log_audit(
            db, current_user.id, "ticket.status_changed", ticket.id,
            {"old": old_status.value, "new": new_status.value},
        )
        # Notify client only on client-facing statuses (§6.2)
        if new_status in _CLIENT_NOTIFY_STATUSES:
            await create_notification(
                db=db,
                user_id=ticket.client_id,
                title="Обновление по заявке",
                body=f"Статус вашей заявки «{ticket.title}» изменён на «{ticket.status.value}».",
                entity_type=NotificationEntityType.ticket,
                entity_id=ticket.id,
            )

    await db.refresh(ticket)
    return TicketOut.model_validate(ticket)


@router.post("/{ticket_id}/reject", response_model=TicketOut)
async def reject_ticket(
    ticket_id: uuid.UUID,
    body: TicketReject,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.manager, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status == TicketStatus.closed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot reject a closed ticket")

    old_status = ticket.status
    ticket.status = TicketStatus.rejected
    ticket.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(
        db, current_user.id, "ticket.rejected", ticket.id,
        {"reason": body.reason, "old_status": old_status.value},
    )

    await create_notification(
        db=db,
        user_id=ticket.client_id,
        title="Ticket rejected",
        body=f"Your ticket '{ticket.title}' has been rejected. Reason: {body.reason}",
        entity_type=NotificationEntityType.ticket,
        entity_id=ticket.id,
    )

    await db.refresh(ticket)
    return TicketOut.model_validate(ticket)


@router.post("/{ticket_id}/link-task", response_model=TicketOut)
async def link_task(
    ticket_id: uuid.UUID,
    body: TicketLinkTask,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Link a task to a ticket — moves the ticket to 'accepted' (§4.1)."""
    if current_user.role not in (UserRole.manager, UserRole.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    if ticket.status in (TicketStatus.closed, TicketStatus.rejected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot link a task to a '{ticket.status.value}' ticket",
        )

    task = (await db.execute(select(Task).where(Task.id == body.task_id))).scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    ticket.task_id = task.id
    task.ticket_id = ticket.id
    ticket.status = TicketStatus.accepted
    ticket.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(
        db, current_user.id, "ticket.accepted", ticket.id, {"task_id": str(task.id)}
    )

    await create_notification(
        db=db,
        user_id=ticket.client_id,
        title="Заявка принята",
        body=f"Ваша заявка «{ticket.title}» принята в работу.",
        entity_type=NotificationEntityType.ticket,
        entity_id=ticket.id,
    )

    await db.refresh(ticket)
    return TicketOut.model_validate(ticket)
