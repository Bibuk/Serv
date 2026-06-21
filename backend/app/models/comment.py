import uuid
import enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Enum as SAEnum
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class CommentEntityType(str, enum.Enum):
    task = "task"
    subtask = "subtask"
    ticket = "ticket"


class Comment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "comments"

    body: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    entity_type: Mapped[CommentEntityType] = mapped_column(
        SAEnum(CommentEntityType, name="commententitytype", create_type=True),
        nullable=False,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    is_visible_to_client: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    author: Mapped["User"] = relationship(
        "User",
        back_populates="comments",
        lazy="selectin",
    )
