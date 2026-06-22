import uuid
import math
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.subtask import Subtask, SubtaskStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.team import Team
from app.models.audit_log import AuditLog, AuditEntityType
from app.models.notification import NotificationEntityType
from app.models.file_attachment import FileAttachment
from app.schemas.task import (
    TaskOut, TaskCreate, TaskUpdate, TaskListOut, TaskAssign, TaskReject,
    TaskDetailOut, DashboardStatsOut,
)
from app.schemas.subtask import SubtaskOut, FileAttachmentOut
from app.dependencies import get_current_user, require_manager, require_teamlead
from app.services.notification import create_notification
from app.services.file_storage import save_file, delete_file, get_file_path

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

_STATUS_ALIAS: dict[str, TaskStatus] = {
    "inprog":   TaskStatus.in_progress,
    "reject":   TaskStatus.rejected,
    "archive":  TaskStatus.archived,
    "draft":    TaskStatus.draft,
    "assigned": TaskStatus.assigned,
    "in_progress": TaskStatus.in_progress,
    "review":   TaskStatus.review,
    "done":     TaskStatus.done,
    "rejected": TaskStatus.rejected,
    "archived": TaskStatus.archived,
}

_STATUS_TO_FRONTEND: dict[str, str] = {
    "in_progress": "inprog",
    "rejected":    "reject",
    "archived":    "archive",
}

_ALLOWED_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.draft:       {TaskStatus.assigned, TaskStatus.archived},
    TaskStatus.assigned:    {TaskStatus.in_progress, TaskStatus.draft, TaskStatus.archived},
    TaskStatus.in_progress: {TaskStatus.review, TaskStatus.assigned, TaskStatus.archived},
    TaskStatus.review:      {TaskStatus.done, TaskStatus.rejected, TaskStatus.in_progress, TaskStatus.archived},
    TaskStatus.done:        {TaskStatus.review, TaskStatus.in_progress, TaskStatus.archived},
    TaskStatus.rejected:    {TaskStatus.assigned, TaskStatus.in_progress, TaskStatus.archived},
    TaskStatus.archived:    {TaskStatus.draft, TaskStatus.in_progress, TaskStatus.assigned},
}


async def _log_audit(db, user_id, action, entity_id, meta=None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=AuditEntityType.task,
        entity_id=entity_id,
        meta=meta,
    )
    db.add(log)


async def _close_linked_ticket(db: AsyncSession, task: Task) -> None:
    """When a task moves to done, close its linked ticket and notify the client."""
    if task.ticket_id:
        result = await db.execute(select(Ticket).where(Ticket.id == task.ticket_id))
        ticket = result.scalar_one_or_none()
        if ticket and ticket.status not in (TicketStatus.closed, TicketStatus.rejected):
            ticket.status = TicketStatus.closed
            ticket.updated_at = datetime.now(timezone.utc)
            await create_notification(
                db=db,
                user_id=ticket.client_id,
                title="Заявка закрыта",
                body=f"Ваша заявка «{ticket.title}» решена — задача выполнена.",
                entity_type=NotificationEntityType.ticket,
                entity_id=ticket.id,
            )


async def _notify_managers(db: AsyncSession, title: str, body: str, entity_id: uuid.UUID) -> None:
    """Notify all active managers."""
    managers = (
        await db.execute(
            select(User).where(
                and_(User.role == UserRole.manager, User.is_active == True)
            )
        )
    ).scalars().all()
    for manager in managers:
        await create_notification(
            db=db,
            user_id=manager.id,
            title=title,
            body=body,
            entity_type=NotificationEntityType.task,
            entity_id=entity_id,
        )


@router.get("/", response_model=TaskListOut)
async def list_tasks(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: Optional[str] = Query(None, description="Full-text search"),
    service_id: Optional[uuid.UUID] = None,
    team_id: Optional[uuid.UUID] = None,
    task_status: Optional[TaskStatus] = Query(None, alias="status"),
    priority: Optional[TaskPriority] = None,
    deadline_before: Optional[datetime] = None,
    deadline_after: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    filters = []

    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clients cannot view tasks")

    if service_id:
        filters.append(Task.service_id == service_id)
    if team_id:
        filters.append(Task.team_id == team_id)
    if task_status:
        filters.append(Task.status == task_status)
    if priority:
        filters.append(Task.priority == priority)
    if deadline_before:
        filters.append(Task.deadline <= deadline_before)
    if deadline_after:
        filters.append(Task.deadline >= deadline_after)

    base_q = select(Task)
    if filters:
        base_q = base_q.where(and_(*filters))

    if q:
        search_filter = text("tasks.search_vector @@ plainto_tsquery('russian', :q)").bindparams(q=q)
        base_q = base_q.where(search_filter)

    count_q = select(func.count()).select_from(base_q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    base_q = base_q.offset((page - 1) * size).limit(size).order_by(Task.created_at.desc())
    tasks = (await db.execute(base_q)).scalars().all()

    return TaskListOut(
        items=[TaskOut.model_validate(t) for t in tasks],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    task = Task(
        title=body.title,
        description=body.description,
        priority=body.priority,
        service_id=body.service_id,
        ticket_id=body.ticket_id,
        created_by=current_user.id,
        deadline=body.deadline,
        status=TaskStatus.draft,
    )
    db.add(task)
    await db.flush()
    await _log_audit(db, current_user.id, "task.created", task.id)
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/stats/dashboard", response_model=DashboardStatsOut)
async def dashboard_stats(
    current_user: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    non_terminal = [TaskStatus.draft, TaskStatus.assigned, TaskStatus.in_progress, TaskStatus.review]

    total = (
        await db.execute(
            select(func.count(Task.id)).where(Task.status != TaskStatus.archived)
        )
    ).scalar_one()
    in_progress = (
        await db.execute(
            select(func.count(Task.id)).where(Task.status == TaskStatus.in_progress)
        )
    ).scalar_one()
    overdue = (
        await db.execute(
            select(func.count(Task.id)).where(
                and_(Task.deadline < now, Task.status.in_(non_terminal))
            )
        )
    ).scalar_one()
    done_this_month = (
        await db.execute(
            select(func.count(Task.id)).where(
                and_(Task.status == TaskStatus.done, Task.updated_at >= month_start)
            )
        )
    ).scalar_one()

    return DashboardStatsOut(
        total=total,
        in_progress=in_progress,
        overdue=overdue,
        done_this_month=done_this_month,
    )


@router.get("/{task_id}", response_model=TaskDetailOut)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    subtasks = (
        await db.execute(
            select(Subtask)
            .where(Subtask.task_id == task_id)
            .order_by(Subtask.created_at.asc())
        )
    ).scalars().all()
    done = sum(1 for s in subtasks if s.status == SubtaskStatus.done)

    detail = TaskDetailOut.model_validate(task)
    detail.subtasks = [SubtaskOut.model_validate(s) for s in subtasks]
    detail.subtasks_total = len(subtasks)
    detail.subtasks_done = done
    return detail


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role not in (UserRole.manager, UserRole.admin, UserRole.teamlead):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    update_data = body.model_dump(exclude_unset=True)

    if "status" in update_data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Use the assign/accept/submit-review/approve/reject endpoints to change task status",
        )

    if task.status in (TaskStatus.done, TaskStatus.archived):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Завершённую задачу нельзя редактировать — сначала верните её в работу",
        )

    if current_user.role == UserRole.teamlead and task.team_id != current_user.team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit tasks assigned to your team",
        )

    for field, value in update_data.items():
        setattr(task, field, value)

    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await _log_audit(db, current_user.id, "task.updated", task.id)

    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_task(
    task_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.status = TaskStatus.archived
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await _log_audit(db, current_user.id, "task.archived", task.id)


@router.post("/{task_id}/assign", response_model=TaskOut)
async def assign_task(
    task_id: uuid.UUID,
    body: TaskAssign,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.status not in (TaskStatus.draft, TaskStatus.rejected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot assign task in status '{task.status.value}'",
        )

    team_result = await db.execute(select(Team).where(Team.id == body.team_id))
    team = team_result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    task.team_id = body.team_id
    task.status = TaskStatus.assigned
    task.reject_reason = None
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(db, current_user.id, "task.assigned", task.id, {"team_id": str(body.team_id)})

    if team.teamlead_id:
        await create_notification(
            db=db,
            user_id=team.teamlead_id,
            title="New task assigned to your team",
            body=f"Task '{task.title}' has been assigned to your team by {current_user.full_name}.",
            entity_type=NotificationEntityType.task,
            entity_id=task.id,
        )

    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/accept", response_model=TaskOut)
async def accept_task(
    task_id: uuid.UUID,
    current_user: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.status != TaskStatus.assigned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task must be in 'assigned' status to accept",
        )

    if current_user.role == UserRole.teamlead and task.team_id != current_user.team_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not the teamlead for this task's team")

    task.status = TaskStatus.in_progress
    task.reject_reason = None
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(db, current_user.id, "task.accepted", task.id)
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/submit-review", response_model=TaskOut)
async def submit_review(
    task_id: uuid.UUID,
    current_user: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.status != TaskStatus.in_progress:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task must be 'in_progress' to submit for review",
        )

    if current_user.role == UserRole.teamlead and task.team_id != current_user.team_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your team's task")

    subtasks = (
        await db.execute(select(Subtask).where(Subtask.task_id == task_id))
    ).scalars().all()
    if subtasks and any(s.status != SubtaskStatus.done for s in subtasks):
        done = sum(1 for s in subtasks if s.status == SubtaskStatus.done)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Нельзя отправить на проверку: выполнено {done} из {len(subtasks)} подзадач",
        )

    task.status = TaskStatus.review
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(db, current_user.id, "task.submitted_review", task.id)

    await _notify_managers(
        db=db,
        title="Task submitted for review",
        body=f"Task '{task.title}' has been submitted for review by {current_user.full_name}.",
        entity_id=task.id,
    )

    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/approve", response_model=TaskOut)
async def approve_task(
    task_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.status != TaskStatus.review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task must be in 'review' status to approve",
        )

    task.status = TaskStatus.done
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(db, current_user.id, "task.approved", task.id)
    await _close_linked_ticket(db, task)

    if task.team_id:
        team_result = await db.execute(select(Team).where(Team.id == task.team_id))
        team = team_result.scalar_one_or_none()
        if team and team.teamlead_id:
            await create_notification(
                db=db,
                user_id=team.teamlead_id,
                title="Task approved",
                body=f"Task '{task.title}' has been approved by {current_user.full_name}.",
                entity_type=NotificationEntityType.task,
                entity_id=task.id,
            )

    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.patch("/{task_id}/status", response_model=TaskOut)
async def update_task_status(
    task_id: uuid.UUID,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Direct status update endpoint for the frontend (accepts frontend alias values)."""
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if current_user.role == UserRole.teamlead and task.team_id != current_user.team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Можно менять статус только задач своей команды",
        )
    if current_user.role == UserRole.worker:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для изменения статуса задачи",
        )

    raw_status = body.get("status", "")
    new_status = _STATUS_ALIAS.get(str(raw_status))
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown status value: {raw_status!r}",
        )

    if new_status != task.status and new_status not in _ALLOWED_TRANSITIONS.get(task.status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Недопустимый переход: '{task.status.value}' → '{new_status.value}'",
        )

    is_manager = current_user.role in (UserRole.manager, UserRole.admin)
    reopening_done = task.status == TaskStatus.done and new_status != TaskStatus.archived
    restoring_archive = task.status == TaskStatus.archived
    if (reopening_done or restoring_archive) and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вернуть задачу в работу может только менеджер",
        )

    task.status = new_status
    if new_status != TaskStatus.rejected:
        task.reject_reason = None
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await _log_audit(db, current_user.id, f"task.status_changed.{new_status.value}", task.id)

    if new_status == TaskStatus.done:
        await _close_linked_ticket(db, task)

    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.post("/{task_id}/reject", response_model=TaskOut)
async def reject_task(
    task_id: uuid.UUID,
    body: TaskReject,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if task.status != TaskStatus.review:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Task must be in 'review' status to reject",
        )

    task.status = TaskStatus.rejected
    task.reject_reason = body.reason
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()

    await _log_audit(
        db, current_user.id, "task.rejected", task.id,
        {"reason": body.reason},
    )

    if task.team_id:
        team_result = await db.execute(select(Team).where(Team.id == task.team_id))
        team = team_result.scalar_one_or_none()
        if team and team.teamlead_id:
            await create_notification(
                db=db,
                user_id=team.teamlead_id,
                title="Task rejected",
                body=f"Task '{task.title}' was rejected. Reason: {body.reason}",
                entity_type=NotificationEntityType.task,
                entity_id=task.id,
            )

    await db.refresh(task)
    return TaskOut.model_validate(task)



async def _get_task_or_404(db: AsyncSession, task_id: uuid.UUID) -> Task:
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/{task_id}/files", response_model=FileAttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_task_file(
    task_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await _get_task_or_404(db, task_id)

    file_id, filename, content_type, size_bytes, path = await save_file(f"task/{task_id}", file)

    attachment = FileAttachment(
        id=file_id,
        task_id=task_id,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        path=path,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.flush()
    await _log_audit(db, current_user.id, "file.uploaded", task_id,
                     {"file_id": str(file_id), "filename": filename})
    return FileAttachmentOut.model_validate(attachment)


@router.get("/{task_id}/files", response_model=List[FileAttachmentOut])
async def list_task_files(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await _get_task_or_404(db, task_id)

    files_result = await db.execute(
        select(FileAttachment)
        .where(FileAttachment.task_id == task_id)
        .order_by(FileAttachment.created_at.desc())
    )
    return [FileAttachmentOut.model_validate(f) for f in files_result.scalars().all()]


@router.get("/{task_id}/files/{file_id}/download")
async def download_task_file(
    task_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(FileAttachment).where(
            and_(FileAttachment.id == file_id, FileAttachment.task_id == task_id)
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    path = get_file_path(attachment.path)
    return FileResponse(
        path=path,
        media_type=attachment.content_type,
        filename=attachment.filename,
    )


@router.delete("/{task_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_file(
    task_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(FileAttachment).where(
            and_(FileAttachment.id == file_id, FileAttachment.task_id == task_id)
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    await _log_audit(db, current_user.id, "file.deleted", task_id,
                     {"file_id": str(file_id), "filename": attachment.filename})
    await delete_file(attachment.path)
    await db.delete(attachment)
