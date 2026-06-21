import uuid
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.notification import ws_manager
from app.services.auth import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: uuid.UUID,
    token: Optional[str] = Query(None, description="JWT access token (optional; cookie is used by default)"),
):
    """
    Authenticated WebSocket connection.
    Auth uses the httpOnly access_token cookie (sent on the handshake); a
    ?token=<access_token> query param is accepted as a fallback.
    Messages are JSON with type='notification'.
    """
    tok = token or websocket.cookies.get("access_token")
    if not tok:
        await websocket.close(code=4001, reason="Not authenticated")
        return

    payload = decode_token(tok)
    if not payload or payload.get("type") != "access":
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    token_user_id = payload.get("sub")
    if not token_user_id or str(user_id) != token_user_id:
        await websocket.close(code=4003, reason="Token user mismatch")
        return

    await websocket.accept()
    user_id_str = str(user_id)
    await ws_manager.connect(user_id_str, websocket)

    await websocket.send_json({
        "type": "connected",
        "user_id": user_id_str,
        "message": "Connected to notification stream",
    })

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected: user {user_id_str}")
    except Exception as e:
        logger.warning(f"WebSocket error for user {user_id_str}: {e}")
    finally:
        await ws_manager.disconnect(user_id_str, websocket)
