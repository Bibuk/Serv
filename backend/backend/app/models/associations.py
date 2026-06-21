"""Association tables for many-to-many relationships."""
from sqlalchemy import Table, Column, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

# Which services an application implements (app → service links).
application_services = Table(
    "application_services",
    Base.metadata,
    Column(
        "application_id",
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "service_id",
        UUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
