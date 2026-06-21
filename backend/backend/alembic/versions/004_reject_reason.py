"""Persist task rejection reason

Adds a nullable `reject_reason` column to `tasks` so the reason a manager gives
when returning a task from review survives a page refresh (previously it lived
only in the audit log meta and the notification body).

Revision ID: 004_reject_reason
Revises: 003_service_meta
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004_reject_reason"
down_revision: Union[str, None] = "003_service_meta"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("reject_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "reject_reason")
