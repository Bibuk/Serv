import uuid
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.subtask import Subtask
    from app.models.task import Task
    from app.models.user import User


class FileAttachment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "file_attachments"

    # An attachment belongs to either a subtask or a task (exactly one is set).
    subtask_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subtasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # Relationships
    subtask: Mapped[Optional["Subtask"]] = relationship(
        "Subtask",
        back_populates="files",
        lazy="noload",
    )
    task: Mapped[Optional["Task"]] = relationship(
        "Task",
        back_populates="files",
        lazy="noload",
    )
    uploader: Mapped["User"] = relationship(
        "User",
        foreign_keys=[uploaded_by],
        lazy="selectin",
    )

    __table_args__ = (
        CheckConstraint(
            "(subtask_id IS NOT NULL) OR (task_id IS NOT NULL)",
            name="ck_file_attachment_owner",
        ),
    )
