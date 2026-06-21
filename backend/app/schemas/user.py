import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    team_id: Optional[uuid.UUID] = None
    is_active: bool = True
    notify_email: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    team_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    notify_email: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    team_id: Optional[uuid.UUID] = None
    team_name: Optional[str] = None
    is_active: bool
    notify_email: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    items: List[UserOut]
    total: int
    page: int
    size: int
    pages: int
