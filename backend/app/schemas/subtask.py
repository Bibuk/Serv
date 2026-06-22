import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.subtask import SubtaskStatus
from app.schemas.user import UserOut


class SubtaskCreate(BaseModel):
    title: str
    description: str = ""
    task_id: uuid.UUID
    assignee_id: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[SubtaskStatus] = None
    assignee_id: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None


class FileAttachmentOut(BaseModel):
    id: uuid.UUID
    subtask_id: Optional[uuid.UUID] = None
    task_id: Optional[uuid.UUID] = None
    ticket_id: Optional[uuid.UUID] = None
    filename: str
    content_type: str
    size_bytes: int
    uploaded_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class SubtaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    status: SubtaskStatus
    task_id: uuid.UUID
    assignee_id: Optional[uuid.UUID] = None
    assignee: Optional[UserOut] = None
    deadline: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SubtaskListOut(BaseModel):
    items: List[SubtaskOut]
    total: int
    page: int = 1
    size: int = 20
    pages: int = 0
