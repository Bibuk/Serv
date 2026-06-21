"""Add service and application to auditentitytype enum

Revision ID: 002_audit_enum
Revises: 001_initial
Create Date: 2026-05-23 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = "002_audit_enum"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditentitytype ADD VALUE IF NOT EXISTS 'service'")
    op.execute("ALTER TYPE auditentitytype ADD VALUE IF NOT EXISTS 'application'")


def downgrade() -> None:
    # PostgreSQL cannot drop a value from an enum; leaving the values in place
    # is harmless. No-op downgrade.
    pass
