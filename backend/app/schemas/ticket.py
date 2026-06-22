import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.ticket import TicketPriority, TicketStatus
from app.schemas.user import UserOut
from app.schemas.application import ApplicationOut


class TicketCreate(BaseModel):
    title: str
    description: str = ""
    priority: TicketPriority = TicketPriority.medium
    application_id: uuid.UUID


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    task_id: Optional[uuid.UUID] = None


class TicketReject(BaseModel):
    reason: str


class TicketLinkTask(BaseModel):
    task_id: uuid.UUID


class TicketOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str
    priority: TicketPriority
    status: TicketStatus
    client_id: uuid.UUID
    client: Optional[UserOut] = None
    application_id: uuid.UUID
    application: Optional[ApplicationOut] = None
    task_id: Optional[uuid.UUID] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TicketListOut(BaseModel):
    items: List[TicketOut]
    total: int
    page: int
    size: int
    pages: int
