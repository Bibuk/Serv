import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.application import Application
    from app.models.task import Task
    from app.models.file_attachment import FileAttachment


class TicketPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class TicketStatus(str, enum.Enum):
    new = "new"
    processing = "processing"
    accepted = "accepted"
    rejected = "rejected"
    closed = "closed"


class Ticket(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tickets"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[TicketPriority] = mapped_column(
        SAEnum(TicketPriority, name="ticketpriority", create_type=True),
        nullable=False,
        default=TicketPriority.medium,
    )
    status: Mapped[TicketStatus] = mapped_column(
        SAEnum(TicketStatus, name="ticketstatus", create_type=True),
        nullable=False,
        default=TicketStatus.new,
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="RESTRICT"),
        nullable=False,
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    client: Mapped["User"] = relationship(
        "User",
        foreign_keys=[client_id],
        back_populates="tickets",
        lazy="selectin",
    )
    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="tickets",
        lazy="selectin",
    )
    task: Mapped[Optional["Task"]] = relationship(
        "Task",
        foreign_keys=[task_id],
        lazy="noload",
    )
    files: Mapped[list["FileAttachment"]] = relationship(
        "FileAttachment",
        back_populates="ticket",
        lazy="noload",
        cascade="all, delete-orphan",
    )
