import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator
import re


class ServiceCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#000000"
    category: Optional[str] = None
    responsible_team_id: Optional[uuid.UUID] = None
    default_priority: Optional[str] = None
    sla_reaction_hours: Optional[float] = 4
    sla_resolution_hours: Optional[float] = 24
    status: str = "active"

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: str) -> str:
        if not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError("Color must be a valid HEX color (e.g. #FF0000)")
        return v.upper()


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    category: Optional[str] = None
    responsible_team_id: Optional[uuid.UUID] = None
    default_priority: Optional[str] = None
    sla_reaction_hours: Optional[float] = None
    sla_resolution_hours: Optional[float] = None
    status: Optional[str] = None

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not re.match(r'^#[0-9A-Fa-f]{6}$', v):
            raise ValueError("Color must be a valid HEX color (e.g. #FF0000)")
        return v.upper() if v else v


class ServiceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str
    color: str
    category: Optional[str] = None
    responsible_team_id: Optional[uuid.UUID] = None
    default_priority: Optional[str] = None
    sla_reaction_hours: Optional[float] = None
    sla_resolution_hours: Optional[float] = None
    status: str = "active"
    created_at: datetime

    model_config = {"from_attributes": True}


class ServiceListOut(BaseModel):
    items: List[ServiceOut]
    total: int
    page: int = 1
    size: int = 20
    pages: int = 0
