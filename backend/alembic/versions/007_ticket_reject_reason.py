"""Add reject_reason column to tickets

Revision ID: 007_ticket_reject_reason
Revises: 006_ticket_attachments
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "007_ticket_reject_reason"
down_revision: Union[str, None] = "006_ticket_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tickets", sa.Column("reject_reason", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("tickets", "reject_reason")
