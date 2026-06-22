"""Add file attachments support for tickets

Revision ID: 006_ticket_attachments
Revises: 005_task_attachments
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "006_ticket_attachments"
down_revision: Union[str, None] = "005_task_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "file_attachments",
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_file_attachments_ticket_id", "file_attachments", ["ticket_id"])
    op.create_foreign_key(
        "fk_file_attachments_ticket_id",
        "file_attachments",
        "tickets",
        ["ticket_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("ck_file_attachment_owner", "file_attachments", type_="check")
    op.create_check_constraint(
        "ck_file_attachment_owner",
        "file_attachments",
        "(subtask_id IS NOT NULL) OR (task_id IS NOT NULL) OR (ticket_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_file_attachment_owner", "file_attachments", type_="check")
    op.create_check_constraint(
        "ck_file_attachment_owner",
        "file_attachments",
        "(subtask_id IS NOT NULL) OR (task_id IS NOT NULL)",
    )
    op.drop_constraint("fk_file_attachments_ticket_id", "file_attachments", type_="foreignkey")
    op.drop_index("ix_file_attachments_ticket_id", table_name="file_attachments")
    op.drop_column("file_attachments", "ticket_id")
