import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.notification import NotificationEntityType


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    body: str
    entity_type: NotificationEntityType
    entity_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListOut(BaseModel):
    items: List[NotificationOut]
    total: int
    unread_count: int
    page: int = 1
    size: int = 20
    pages: int = 0
