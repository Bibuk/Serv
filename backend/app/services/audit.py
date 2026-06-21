import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog, AuditEntityType


def log_action(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    entity_type: AuditEntityType,
    entity_id: Optional[uuid.UUID] = None,
    meta: Optional[dict] = None,
) -> None:
    """Record an action in audit_log. Caller's transaction handles the commit."""
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            meta=meta,
        )
    )
