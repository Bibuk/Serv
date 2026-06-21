"""Service-catalogue metadata + application↔service links

Moves the per-service metadata that used to live in the frontend's localStorage
(category, responsible support group, default priority, SLA, archive status)
into the database, and adds the application↔service many-to-many link table.

Revision ID: 003_service_meta
Revises: 002_audit_enum
Create Date: 2026-06-20 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "003_service_meta"
down_revision: Union[str, None] = "002_audit_enum"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("services", sa.Column("category", sa.String(50), nullable=True))
    op.add_column(
        "services",
        sa.Column("responsible_team_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_services_responsible_team",
        "services", "teams",
        ["responsible_team_id"], ["id"],
        ondelete="SET NULL",
    )
    op.add_column("services", sa.Column("default_priority", sa.String(20), nullable=True))
    op.add_column(
        "services",
        sa.Column("sla_reaction_hours", sa.Float(), nullable=True, server_default="4"),
    )
    op.add_column(
        "services",
        sa.Column("sla_resolution_hours", sa.Float(), nullable=True, server_default="24"),
    )
    op.add_column(
        "services",
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )

    op.create_table(
        "application_services",
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("application_id", "service_id"),
    )


def downgrade() -> None:
    op.drop_table("application_services")
    op.drop_constraint("fk_services_responsible_team", "services", type_="foreignkey")
    op.drop_column("services", "status")
    op.drop_column("services", "sla_resolution_hours")
    op.drop_column("services", "sla_reaction_hours")
    op.drop_column("services", "default_priority")
    op.drop_column("services", "responsible_team_id")
    op.drop_column("services", "category")
