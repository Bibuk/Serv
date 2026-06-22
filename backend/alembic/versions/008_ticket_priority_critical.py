"""Add 'critical' value to ticketpriority enum

Revision ID: 008_ticket_priority_critical
Revises: 007_ticket_reject_reason
Create Date: 2026-06-22 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = "008_ticket_priority_critical"
down_revision: Union[str, None] = "007_ticket_reject_reason"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ticketpriority ADD VALUE IF NOT EXISTS 'critical'")


def downgrade() -> None:
    # PostgreSQL has no DROP VALUE for enums; leaving the value in place is safe.
    pass
