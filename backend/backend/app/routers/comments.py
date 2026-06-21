import uuid
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task
from app.models.subtask import Subtask
from app.models.ticket import Ticket
from app.models.comment import Comment, CommentEntityType
from app.models.notification import NotificationEntityType
from app.models.audit_log import AuditEntityType
from app.services.audit import log_action
from app.schemas.comment import CommentOut, CommentCreate, CommentListOut
from app.dependencies import get_current_user
from app.services.notification import create_notification

router = APIRouter(prefix="/api/comments", tags=["comments"])


async def _notify_on_comment(
    db: AsyncSession,
    comment: Comment,
    author: User,
) -> None:
    """Notify relevant parties when a comment is created (§6.1/6.2 matrix)."""
    entity_type = comment.entity_type
    entity_id = comment.entity_id
    author_name = author.full_name

    recipients: set[uuid.UUID] = set()

    if entity_type == CommentEntityType.task:
        result = await db.execute(select(Task).where(Task.id == entity_id))
        task = result.scalar_one_or_none()
        if task:
            # Notify task creator (manager) and teamlead
            if task.created_by != author.id:
                recipients.add(task.created_by)
            if task.team_id:
                from app.models.team import Team
                team_res = await db.execute(select(Team).where(Team.id == task.team_id))
                team = team_res.scalar_one_or_none()
                if team and team.teamlead_id and team.teamlead_id != author.id:
                    recipients.add(team.teamlead_id)
            # A client-visible comment on a ticket-linked task reaches the client.
            if comment.is_visible_to_client and task.ticket_id:
                tk = (await db.execute(select(Ticket).where(Ticket.id == task.ticket_id))).scalar_one_or_none()
                if tk and tk.client_id != author.id:
                    recipients.add(tk.client_id)
            title = f"Новый комментарий к задаче «{task.title}»"
            body = f"{author_name} оставил(а) комментарий к задаче «{task.title}»"
            notif_entity_type = NotificationEntityType.task

    elif entity_type == CommentEntityType.subtask:
        result = await db.execute(select(Subtask).where(Subtask.id == entity_id))
        subtask = result.scalar_one_or_none()
        if subtask:
            if subtask.assignee_id and subtask.assignee_id != author.id:
                recipients.add(subtask.assignee_id)
            # Also notify parent task creator
            task_res = await db.execute(select(Task).where(Task.id == subtask.task_id))
            parent = task_res.scalar_one_or_none()
            if parent and parent.created_by != author.id:
                recipients.add(parent.created_by)
            title = f"Новый комментарий к подзадаче «{subtask.title}»"
            body = f"{author_name} оставил(а) комментарий к подзадаче «{subtask.title}»"
            notif_entity_type = NotificationEntityType.subtask

    elif entity_type == CommentEntityType.ticket:
        result = await db.execute(select(Ticket).where(Ticket.id == entity_id))
        ticket = result.scalar_one_or_none()
        if ticket:
            # Notify client if manager commented (and comment is visible to client)
            if comment.is_visible_to_client and ticket.client_id != author.id:
                recipients.add(ticket.client_id)
            # Notify managers if client commented
            if author.role == UserRole.client:
                managers_res = await db.execute(
                    select(User).where(and_(User.role == UserRole.manager, User.is_active == True))
                )
                for m in managers_res.scalars().all():
                    if m.id != author.id:
                        recipients.add(m.id)
                # Also notify the team working the linked task, so staff in the
                # task drawer see the client's message in real time.
                if ticket.task_id:
                    linked = (await db.execute(select(Task).where(Task.id == ticket.task_id))).scalar_one_or_none()
                    if linked:
                        if linked.created_by != author.id:
                            recipients.add(linked.created_by)
                        if linked.team_id:
                            from app.models.team import Team
                            tres = await db.execute(select(Team).where(Team.id == linked.team_id))
                            tm = tres.scalar_one_or_none()
                            if tm and tm.teamlead_id and tm.teamlead_id != author.id:
                                recipients.add(tm.teamlead_id)
            title = f"Новый комментарий к заявке «{ticket.title}»"
            body = f"{author_name} оставил(а) комментарий к заявке «{ticket.title}»"
            notif_entity_type = NotificationEntityType.ticket
    else:
        return

    for user_id in recipients:
        await create_notification(
            db=db,
            user_id=user_id,
            title=title,
            body=body,
            entity_type=notif_entity_type,
            entity_id=entity_id,
        )


@router.get("/", response_model=CommentListOut)
async def list_comments(
    entity_type: CommentEntityType = Query(...),
    entity_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # A task and its linked ticket form one conversation. Staff comment on the
    # task; the client reads the ticket. Bridge the two so client-facing comments
    # are shared across the link instead of being siloed in separate threads.
    pairs: list[tuple[CommentEntityType, uuid.UUID]] = [(entity_type, entity_id)]
    if entity_type == CommentEntityType.ticket:
        ticket = (await db.execute(select(Ticket).where(Ticket.id == entity_id))).scalar_one_or_none()
        if ticket and ticket.task_id:
            pairs.append((CommentEntityType.task, ticket.task_id))
    elif entity_type == CommentEntityType.task:
        task = (await db.execute(select(Task).where(Task.id == entity_id))).scalar_one_or_none()
        if task and task.ticket_id:
            pairs.append((CommentEntityType.ticket, task.ticket_id))

    pair_filter = or_(*[
        and_(Comment.entity_type == et, Comment.entity_id == eid) for (et, eid) in pairs
    ])
    filters = [pair_filter]

    # Clients only see comments marked visible_to_client (on the ticket or its task)
    if current_user.role == UserRole.client:
        if entity_type != CommentEntityType.ticket:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clients can only view ticket comments",
            )
        filters.append(Comment.is_visible_to_client == True)

    q = (
        select(Comment)
        .where(and_(*filters))
        .order_by(Comment.created_at.asc())
        .offset((page - 1) * size)
        .limit(size)
    )
    total_q = select(func.count(Comment.id)).where(and_(*filters))

    total = (await db.execute(total_q)).scalar_one()
    comments = (await db.execute(q)).scalars().all()

    return CommentListOut(
        items=[CommentOut.model_validate(c) for c in comments],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Clients can only comment on tickets. A client's own comment is inherently
    # client-facing, so it must be flagged visible — otherwise the visibility
    # filter would hide the client's own messages from them after a reload.
    if current_user.role == UserRole.client:
        if body.entity_type != CommentEntityType.ticket:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Clients can only comment on tickets",
            )
        is_visible = True
    else:
        is_visible = body.is_visible_to_client

    comment = Comment(
        body=body.body,
        author_id=current_user.id,
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        is_visible_to_client=is_visible,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)

    log_action(
        db, current_user.id, "comment.created",
        AuditEntityType(comment.entity_type.value), comment.entity_id,
        {"comment_id": str(comment.id)},
    )

    # Notify relevant parties (§6.1/6.2)
    await _notify_on_comment(db, comment, current_user)

    return CommentOut.model_validate(comment)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Comment).where(Comment.id == comment_id))
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete another user's comment",
        )

    log_action(
        db, current_user.id, "comment.deleted",
        AuditEntityType(comment.entity_type.value), comment.entity_id,
        {"comment_id": str(comment.id)},
    )
    await db.delete(comment)
    await db.flush()
