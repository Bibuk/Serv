import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.notification import Notification, NotificationEntityType
from app.models.user import User

logger = logging.getLogger(__name__)

# WebSocket manager: user_id -> list of WebSocket connections
class WebSocketManager:
    def __init__(self):
        self._connections: dict[str, list] = {}

    async def connect(self, user_id: str, websocket) -> None:
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user {user_id}, total connections: {len(self._connections[user_id])}")

    async def disconnect(self, user_id: str, websocket) -> None:
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_to_user(self, user_id: str, data: dict) -> None:
        connections = self._connections.get(user_id, [])
        disconnected = []
        message = json.dumps(data, default=str)
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send WebSocket message to user {user_id}: {e}")
                disconnected.append(ws)
        # Clean up dead connections
        for ws in disconnected:
            try:
                self._connections[user_id].remove(ws)
            except ValueError:
                pass

    def is_connected(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))


ws_manager = WebSocketManager()


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    body: str,
    entity_type: NotificationEntityType,
    entity_id: Optional[uuid.UUID] = None,
) -> Notification:
    """
    Saves notification to DB, pushes via WebSocket, queues email if notify_email=True.
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        body=body,
        entity_type=entity_type,
        entity_id=entity_id,
        is_read=False,
    )
    db.add(notification)
    await db.flush()  # Get the ID without full commit

    # Push via WebSocket
    await ws_manager.send_to_user(
        str(user_id),
        {
            "type": "notification",
            "id": str(notification.id),
            "title": title,
            "body": body,
            "entity_type": entity_type.value,
            "entity_id": str(entity_id) if entity_id else None,
            "is_read": False,
            "created_at": notification.created_at.isoformat() if notification.created_at else datetime.now(timezone.utc).isoformat(),
        },
    )

    # Queue email if user has notify_email enabled
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user and user.notify_email:
        try:
            from app.tasks.email_tasks import send_email_notification
            send_email_notification.delay(str(user_id), title, body)
        except Exception as e:
            logger.warning(f"Failed to queue email notification for user {user_id}: {e}")

    return notification
