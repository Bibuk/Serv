"""Allow file attachments on tasks (not only subtasks)

Makes `file_attachments.subtask_id` nullable, adds a nullable `task_id` FK to
`tasks`, and a check constraint requiring at least one owner. This lets files
be attached directly to a task while keeping existing subtask attachments
intact.

Revision ID: 005_task_attachments
Revises: 004_reject_reason
Create Date: 2026-06-21 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "005_task_attachments"
down_revision: Union[str, None] = "004_reject_reason"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("file_attachments", "subtask_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    op.add_column(
        "file_attachments",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_file_attachments_task_id", "file_attachments", ["task_id"])
    op.create_foreign_key(
        "fk_file_attachments_task_id",
        "file_attachments",
        "tasks",
        ["task_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_check_constraint(
        "ck_file_attachment_owner",
        "file_attachments",
        "(subtask_id IS NOT NULL) OR (task_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_file_attachment_owner", "file_attachments", type_="check")
    op.drop_constraint("fk_file_attachments_task_id", "file_attachments", type_="foreignkey")
    op.drop_index("ix_file_attachments_task_id", table_name="file_attachments")
    op.drop_column("file_attachments", "task_id")
    op.alter_column("file_attachments", "subtask_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
