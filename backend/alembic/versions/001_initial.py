"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-05-15 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


userrole_enum = postgresql.ENUM(
    "client", "manager", "teamlead", "worker", "admin",
    name="userrole", create_type=False,
)
applicationstatus_enum = postgresql.ENUM(
    "active", "archived",
    name="applicationstatus", create_type=False,
)
ticketpriority_enum = postgresql.ENUM(
    "low", "medium", "high",
    name="ticketpriority", create_type=False,
)
ticketstatus_enum = postgresql.ENUM(
    "new", "processing", "accepted", "rejected", "closed",
    name="ticketstatus", create_type=False,
)
taskpriority_enum = postgresql.ENUM(
    "low", "medium", "high", "critical",
    name="taskpriority", create_type=False,
)
taskstatus_enum = postgresql.ENUM(
    "draft", "assigned", "in_progress", "review", "done", "rejected", "archived",
    name="taskstatus", create_type=False,
)
subtaskstatus_enum = postgresql.ENUM(
    "todo", "in_progress", "blocked", "done",
    name="subtaskstatus", create_type=False,
)
commententitytype_enum = postgresql.ENUM(
    "task", "subtask", "ticket",
    name="commententitytype", create_type=False,
)
notificationentitytype_enum = postgresql.ENUM(
    "task", "subtask", "ticket",
    name="notificationentitytype", create_type=False,
)
auditentitytype_enum = postgresql.ENUM(
    "task", "subtask", "ticket", "user", "team",
    name="auditentitytype", create_type=False,
)

_ALL_ENUMS = [
    userrole_enum, applicationstatus_enum, ticketpriority_enum, ticketstatus_enum,
    taskpriority_enum, taskstatus_enum, subtaskstatus_enum,
    commententitytype_enum, notificationentitytype_enum, auditentitytype_enum,
]


def upgrade() -> None:
    bind = op.get_bind()
    for e in _ALL_ENUMS:
        e.create(bind, checkfirst=True)

    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("teamlead_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", userrole_enum, nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("notify_email", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_foreign_key(
        "fk_teams_teamlead_id",
        "teams", "users",
        ["teamlead_id"], ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("color", sa.String(7), nullable=False, server_default="#000000"),
        sa.Column("status", applicationstatus_enum, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("color", sa.String(7), nullable=False, server_default="#000000"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("priority", taskpriority_enum, nullable=False),
        sa.Column("status", taskstatus_enum, nullable=False, server_default="draft"),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ticket_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("search_vector", postgresql.TSVECTOR(), sa.Computed(
            "to_tsvector('russian', coalesce(title, '') || ' ' || coalesce(description, ''))",
            persisted=True,
        ), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_tasks_search_vector", "tasks", ["search_vector"], postgresql_using="gin")
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_team_id", "tasks", ["team_id"])
    op.create_index("ix_tasks_service_id", "tasks", ["service_id"])

    op.create_table(
        "tickets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("priority", ticketpriority_enum, nullable=False, server_default="medium"),
        sa.Column("status", ticketstatus_enum, nullable=False, server_default="new"),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="SET NULL"),
    )

    op.create_foreign_key(
        "fk_tasks_ticket_id",
        "tasks", "tickets",
        ["ticket_id"], ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "subtasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", subtaskstatus_enum, nullable=False, server_default="todo"),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["assignee_id"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("entity_type", commententitytype_enum, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("is_visible_to_client", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="RESTRICT"),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("entity_type", notificationentitytype_enum, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("entity_type", auditentitytype_enum, nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])

    op.create_table(
        "file_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("subtask_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["subtask_id"], ["subtasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_file_attachments_subtask_id", "file_attachments", ["subtask_id"])


def downgrade() -> None:
    op.drop_table("file_attachments")
    op.drop_table("audit_log")
    op.drop_table("notifications")
    op.drop_table("comments")
    op.drop_table("subtasks")

    op.drop_constraint("fk_tasks_ticket_id", "tasks", type_="foreignkey")
    op.drop_table("tickets")
    op.drop_table("tasks")
    op.drop_table("services")
    op.drop_table("applications")
    op.drop_table("users")

    op.drop_constraint("fk_teams_teamlead_id", "teams", type_="foreignkey")
    op.drop_table("teams")

    bind = op.get_bind()
    for e in reversed(_ALL_ENUMS):
        e.drop(bind, checkfirst=True)
