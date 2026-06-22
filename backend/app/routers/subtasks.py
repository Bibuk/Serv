import uuid
import math
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.database import get_db
from app.models.user import User, UserRole
from app.models.subtask import Subtask, SubtaskStatus
from app.models.file_attachment import FileAttachment
from app.models.audit_log import AuditLog, AuditEntityType
from app.models.notification import NotificationEntityType
from app.schemas.subtask import SubtaskOut, SubtaskCreate, SubtaskUpdate, SubtaskListOut, FileAttachmentOut
from app.dependencies import get_current_user, require_teamlead
from app.services.notification import create_notification
from app.services.file_storage import save_file, delete_file, get_file_path

router = APIRouter(prefix="/api/subtasks", tags=["subtasks"])


async def _log_audit(db, user_id, action, entity_id, meta=None):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=AuditEntityType.subtask,
        entity_id=entity_id,
        meta=meta,
    )
    db.add(log)


@router.get("/", response_model=SubtaskListOut)
async def list_subtasks(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    task_id: Optional[uuid.UUID] = None,
    subtask_status: Optional[SubtaskStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    filters = []
    if task_id:
        filters.append(Subtask.task_id == task_id)
    if subtask_status:
        filters.append(Subtask.status == subtask_status)

    if current_user.role == UserRole.worker:
        filters.append(Subtask.assignee_id == current_user.id)

    count_q = select(func.count(Subtask.id))
    q = select(Subtask)
    if filters:
        count_q = count_q.where(and_(*filters))
        q = q.where(and_(*filters))

    total = (await db.execute(count_q)).scalar_one()
    q = q.order_by(Subtask.created_at.desc()).offset((page - 1) * size).limit(size)
    subtasks = (await db.execute(q)).scalars().all()

    return SubtaskListOut(
        items=[SubtaskOut.model_validate(s) for s in subtasks],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total else 0,
    )


@router.post("/", response_model=SubtaskOut, status_code=status.HTTP_201_CREATED)
async def create_subtask(
    body: SubtaskCreate,
    current_user: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    subtask = Subtask(
        title=body.title,
        description=body.description,
        task_id=body.task_id,
        assignee_id=body.assignee_id,
        deadline=body.deadline,
    )
    db.add(subtask)
    await db.flush()
    await _log_audit(db, current_user.id, "subtask.created", subtask.id)

    if body.assignee_id:
        await create_notification(
            db=db,
            user_id=body.assignee_id,
            title="New subtask assigned to you",
            body=f"Subtask '{body.title}' has been assigned to you.",
            entity_type=NotificationEntityType.subtask,
            entity_id=subtask.id,
        )

    await db.refresh(subtask)
    return SubtaskOut.model_validate(subtask)


@router.get("/{subtask_id}", response_model=SubtaskOut)
async def get_subtask(
    subtask_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Subtask).where(Subtask.id == subtask_id))
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    if current_user.role == UserRole.worker and subtask.assignee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return SubtaskOut.model_validate(subtask)


@router.patch("/{subtask_id}", response_model=SubtaskOut)
async def update_subtask(
    subtask_id: uuid.UUID,
    body: SubtaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Subtask).where(Subtask.id == subtask_id))
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    if current_user.role == UserRole.worker:
        if subtask.assignee_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your subtask")
        # A worker drives their subtask through todo / in_progress / blocked,
        # but confirming completion ("done") is reserved for the teamlead.
        if subtask.status == SubtaskStatus.done:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Подзадача уже завершена. Переоткрыть её может только тимлид.",
            )
        update_data = {}
        if body.status is not None:
            if body.status == SubtaskStatus.done:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Отметить подзадачу выполненной может только тимлид.",
                )
            update_data["status"] = body.status
    else:
        update_data = body.model_dump(exclude_unset=True)

    old_status = subtask.status
    old_assignee_id = subtask.assignee_id
    for field, value in update_data.items():
        setattr(subtask, field, value)

    subtask.updated_at = datetime.now(timezone.utc)
    await db.flush()

    if "status" in update_data and update_data["status"] != old_status:
        await _log_audit(
            db, current_user.id, "subtask.status_changed", subtask.id,
            {"old": old_status.value, "new": subtask.status.value},
        )

    if "assignee_id" in update_data and update_data["assignee_id"] and update_data["assignee_id"] != old_assignee_id:
        await create_notification(
            db=db,
            user_id=update_data["assignee_id"],
            title="Subtask assigned to you",
            body=f"Subtask '{subtask.title}' has been assigned to you.",
            entity_type=NotificationEntityType.subtask,
            entity_id=subtask.id,
        )

    await db.refresh(subtask)
    return SubtaskOut.model_validate(subtask)


@router.delete("/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subtask(
    subtask_id: uuid.UUID,
    current_user: User = Depends(require_teamlead),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subtask).where(Subtask.id == subtask_id))
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    files_result = await db.execute(
        select(FileAttachment).where(FileAttachment.subtask_id == subtask_id)
    )
    files = files_result.scalars().all()
    for f in files:
        await delete_file(f.path)

    await db.delete(subtask)
    await db.flush()


@router.post("/{subtask_id}/files", response_model=FileAttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    subtask_id: uuid.UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Subtask).where(Subtask.id == subtask_id))
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    if current_user.role == UserRole.worker and subtask.assignee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your subtask")

    file_id, filename, content_type, size_bytes, path = await save_file(str(subtask_id), file)

    attachment = FileAttachment(
        id=file_id,
        subtask_id=subtask_id,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
        path=path,
        uploaded_by=current_user.id,
    )
    db.add(attachment)
    await db.flush()
    await _log_audit(db, current_user.id, "file.uploaded", subtask_id,
                     {"file_id": str(file_id), "filename": filename})
    return FileAttachmentOut.model_validate(attachment)


@router.get("/{subtask_id}/files", response_model=List[FileAttachmentOut])
async def list_files(
    subtask_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(select(Subtask).where(Subtask.id == subtask_id))
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    if current_user.role == UserRole.worker and subtask.assignee_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your subtask")

    files_result = await db.execute(
        select(FileAttachment)
        .where(FileAttachment.subtask_id == subtask_id)
        .order_by(FileAttachment.created_at.desc())
    )
    files = files_result.scalars().all()
    return [FileAttachmentOut.model_validate(f) for f in files]


@router.get("/{subtask_id}/files/{file_id}/download")
async def download_file(
    subtask_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(FileAttachment).where(
            and_(FileAttachment.id == file_id, FileAttachment.subtask_id == subtask_id)
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if current_user.role == UserRole.worker:
        subtask = (
            await db.execute(select(Subtask).where(Subtask.id == subtask_id))
        ).scalar_one_or_none()
        if not subtask or subtask.assignee_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your subtask")

    path = get_file_path(attachment.path)
    return FileResponse(
        path,
        media_type=attachment.content_type,
        filename=attachment.filename,
    )


@router.delete("/{subtask_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file_attachment(
    subtask_id: uuid.UUID,
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == UserRole.client:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await db.execute(
        select(FileAttachment).where(
            and_(FileAttachment.id == file_id, FileAttachment.subtask_id == subtask_id)
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    if current_user.role == UserRole.worker and attachment.uploaded_by != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await _log_audit(db, current_user.id, "file.deleted", subtask_id,
                     {"file_id": str(file_id), "filename": attachment.filename})
    await delete_file(attachment.path)
    await db.delete(attachment)
    await db.flush()
