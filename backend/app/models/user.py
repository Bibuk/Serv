import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
import enum
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.team import Team
    from app.models.ticket import Ticket
    from app.models.task import Task
    from app.models.subtask import Subtask
    from app.models.comment import Comment
    from app.models.notification import Notification
    from app.models.audit_log import AuditLog


class UserRole(str, enum.Enum):
    client = "client"
    manager = "manager"
    teamlead = "teamlead"
    worker = "worker"
    admin = "admin"


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole", create_type=True),
        nullable=False,
        default=UserRole.client,
    )
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    team: Mapped[Optional["Team"]] = relationship(
        "Team",
        foreign_keys=[team_id],
        back_populates="members",
        lazy="selectin",
    )
    led_team: Mapped[Optional["Team"]] = relationship(
        "Team",
        foreign_keys="Team.teamlead_id",
        back_populates="teamlead",
        lazy="selectin",
    )
    tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        foreign_keys="Ticket.client_id",
        back_populates="client",
        lazy="noload",
    )
    created_tasks: Mapped[List["Task"]] = relationship(
        "Task",
        foreign_keys="Task.created_by",
        back_populates="creator",
        lazy="noload",
    )
    assigned_subtasks: Mapped[List["Subtask"]] = relationship(
        "Subtask",
        foreign_keys="Subtask.assignee_id",
        back_populates="assignee",
        lazy="noload",
    )
    comments: Mapped[List["Comment"]] = relationship(
        "Comment",
        back_populates="author",
        lazy="noload",
    )
    notifications: Mapped[List["Notification"]] = relationship(
        "Notification",
        back_populates="user",
        lazy="noload",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        lazy="noload",
    )

    @property
    def team_name(self) -> Optional[str]:
        return self.team.name if self.team else None
