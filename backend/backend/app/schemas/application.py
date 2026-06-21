import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator
from app.models.application import ApplicationStatus
import re


class ApplicationCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#000000"
    service_ids: List[uuid.UUID] = []

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError("Color must be a valid HEX color (e.g. #FF0000)")
        return v.upper()


class ApplicationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    status: Optional[ApplicationStatus] = None
    service_ids: Optional[List[uuid.UUID]] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError("Color must be a valid HEX color (e.g. #FF0000)")
        return v.upper() if v else v


class ApplicationOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    color: str
    status: ApplicationStatus
    service_ids: List[uuid.UUID] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationListOut(BaseModel):
    items: List[ApplicationOut]
    total: int
    page: int = 1
    size: int = 20
    pages: int = 0
