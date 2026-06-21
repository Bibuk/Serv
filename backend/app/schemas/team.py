import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.user import UserOut


class TeamCreate(BaseModel):
    name: str
    teamlead_id: Optional[uuid.UUID] = None


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    teamlead_id: Optional[uuid.UUID] = None


class TeamOut(BaseModel):
    id: uuid.UUID
    name: str
    teamlead_id: Optional[uuid.UUID] = None
    teamlead: Optional[UserOut] = None
    members: List[UserOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamListOut(BaseModel):
    items: List[TeamOut]
    total: int
    page: int = 1
    size: int = 20
    pages: int = 0
