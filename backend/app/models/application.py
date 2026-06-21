import enum
import uuid
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SAEnum
from app.database import Base
from app.models.base import UUIDMixin, TimestampMixin
from app.models.associations import application_services

if TYPE_CHECKING:
    from app.models.ticket import Ticket
    from app.models.service import Service


class ApplicationStatus(str, enum.Enum):
    active = "active"
    archived = "archived"


class Application(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "applications"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#000000")
    status: Mapped[ApplicationStatus] = mapped_column(
        SAEnum(ApplicationStatus, name="applicationstatus", create_type=True),
        nullable=False,
        default=ApplicationStatus.active,
    )

    # Relationships
    tickets: Mapped[List["Ticket"]] = relationship(
        "Ticket",
        back_populates="application",
        lazy="noload",
    )
    # Services this application implements (eager-loaded so list/detail
    # responses can expose `service_ids` without a manual join).
    services: Mapped[List["Service"]] = relationship(
        "Service",
        secondary=application_services,
        lazy="selectin",
    )

    @property
    def service_ids(self) -> List[uuid.UUID]:
        return [s.id for s in self.services]
