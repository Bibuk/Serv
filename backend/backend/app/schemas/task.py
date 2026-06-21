import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.task import TaskPriority, TaskStatus
from app.schemas.service import ServiceOut
from app.schemas.user import UserOut
from app.schemas.subtask import SubtaskOut


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: TaskPriority = TaskPriority.medium
    service_id: uuid.UUID
    ticket_id: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    service_id: Optional[uuid.UUID] = None
    deadline: Optional[datetime] = None
    status: Optional[TaskStatus] = None


class TaskAssign(BaseModel):
    team_id: uuid.UUID


class TaskReject(BaseModel):
    reason: str


class TeamBrief(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    priority: TaskPriority
    status: TaskStatus
    service_id: uuid.UUID
    service: Optional[ServiceOut] = None
    team_id: Optional[uuid.UUID] = None
    team: Optional[TeamBrief] = None
    ticket_id: Optional[uuid.UUID] = None
    created_by: uuid.UUID
    creator: Optional[UserOut] = None
    deadline: Optional[datetime] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskDetailOut(TaskOut):
    subtasks: List[SubtaskOut] = []
    subtasks_total: int = 0
    subtasks_done: int = 0


class TaskListOut(BaseModel):
    items: List[TaskOut]
    total: int
    page: int
    size: int
    pages: int


class DashboardStatsOut(BaseModel):
    total: int
    in_progress: int
    overdue: int
    done_this_month: int
