import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TSVECTOR
from sqlalchemy import Enum as SAEnum, Computed
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.team import Team
    from app.models.service import Service
    from app.models.ticket import Ticket
    from app.models.subtask import Subtask


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TaskStatus(str, enum.Enum):
    draft = "draft"
    assigned = "assigned"
    in_progress = "in_progress"
    review = "review"
    done = "done"
    rejected = "rejected"
    archived = "archived"


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="taskpriority", create_type=True),
        nullable=False,
        default=TaskPriority.medium,
    )
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="taskstatus", create_type=True),
        nullable=False,
        default=TaskStatus.draft,
    )
    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="RESTRICT"),
        nullable=False,
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Reason captured when a manager returns a task from review. Cleared once the
    # task leaves the rejected state so it never shows stale context.
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    search_vector: Mapped[Optional[str]] = mapped_column(
        TSVECTOR,
        Computed(
            "to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ),
        nullable=True,
    )

    # Relationships
    service: Mapped["Service"] = relationship(
        "Service",
        back_populates="tasks",
        lazy="selectin",
    )
    team: Mapped[Optional["Team"]] = relationship(
        "Team",
        lazy="selectin",
    )
    ticket: Mapped[Optional["Ticket"]] = relationship(
        "Ticket",
        foreign_keys=[ticket_id],
        lazy="noload",
    )
    creator: Mapped["User"] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="created_tasks",
        lazy="selectin",
    )
    subtasks: Mapped[List["Subtask"]] = relationship(
        "Subtask",
        back_populates="task",
        lazy="noload",
        cascade="all, delete-orphan",
    )
    files: Mapped[List["FileAttachment"]] = relationship(
        "FileAttachment",
        back_populates="task",
        lazy="noload",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_tasks_search_vector", "search_vector", postgresql_using="gin"),
        Index("ix_tasks_status", "status"),
        Index("ix_tasks_team_id", "team_id"),
        Index("ix_tasks_service_id", "service_id"),
    )
