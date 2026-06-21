import uuid
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.team import Team


class Service(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "services"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#000000")

    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    responsible_team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_priority: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sla_reaction_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=4)
    sla_resolution_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True, default=24)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="service",
        lazy="noload",
    )
    responsible_team: Mapped[Optional["Team"]] = relationship(
        "Team",
        foreign_keys=[responsible_team_id],
        lazy="noload",
    )
