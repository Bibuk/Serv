import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.models.comment import CommentEntityType
from app.schemas.user import UserOut


class CommentCreate(BaseModel):
    body: str
    entity_type: CommentEntityType
    entity_id: uuid.UUID
    is_visible_to_client: bool = False


class CommentOut(BaseModel):
    id: uuid.UUID
    body: str
    author_id: uuid.UUID
    author: Optional[UserOut] = None
    entity_type: CommentEntityType
    entity_id: uuid.UUID
    is_visible_to_client: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentListOut(BaseModel):
    items: List[CommentOut]
    total: int
    page: int = 1
    size: int = 20
    pages: int = 0
