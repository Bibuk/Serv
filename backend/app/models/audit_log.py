import uuid
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy import Enum as SAEnum
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class AuditEntityType(str, enum.Enum):
    task = "task"
    subtask = "subtask"
    ticket = "ticket"
    user = "user"
    team = "team"
    service = "service"
    application = "application"


class AuditLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_log"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[AuditEntityType] = mapped_column(
        SAEnum(AuditEntityType, name="auditentitytype", create_type=True),
        nullable=False,
    )
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship(
        "User",
        back_populates="audit_logs",
        lazy="selectin",
    )
