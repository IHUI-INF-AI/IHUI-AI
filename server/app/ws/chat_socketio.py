"""Chat Socket.IO 兼容的 WS 端点 - 支持加入/离开房间和单聊."""

import json
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.ws.auth_decorator import ws_require_auth
from app.ws.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/chat")
@ws_require_auth
async def chat_socket(ws: WebSocket, user_uuid: str = Query(""), room_id: str = Query("default")):
    """Chat 通用 WS 端点.

    客户端发送 JSON 消息体:
      {"action": "msg",  "text": "hello"}
      {"action": "join", "room": "room_2"}
      {"action": "leave","room": "room_2"}
      {"action": "ping"}
    """
    conn_id = f"{user_uuid}_{uuid.uuid4().hex[:8]}"
    await connection_manager.connect(conn_id, ws, user_uuid=user_uuid, room_id=room_id)
    try:
        await connection_manager.broadcast_room(
            room_id,
            {"type": "system", "event": "join", "user": user_uuid},
        )
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({"type": "error", "msg": "非 JSON"}))
                continue
            action = msg.get("action")
            if action == "msg":
                await connection_manager.broadcast_room(
                    room_id,
                    {
                        "type": "chat",
                        "from": user_uuid,
                        "text": msg.get("text", ""),
                        "ts": msg.get("ts"),
                    },
                )
            elif action == "join":
                new_room = msg.get("room", room_id)
                connection_manager.subscribe(conn_id, new_room)
                await connection_manager.send_to(conn_id, {"type": "system", "event": "joined", "room": new_room})
            elif action == "leave":
                old_room = msg.get("room", room_id)
                connection_manager.unsubscribe(conn_id, old_room)
                await connection_manager.send_to(conn_id, {"type": "system", "event": "left", "room": old_room})
            elif action == "ping":
                await connection_manager.send_to(conn_id, {"type": "pong", "ts": msg.get("ts")})
    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.broadcast_room(
            room_id,
            {"type": "system", "event": "leave", "user": user_uuid},
        )
        await connection_manager.disconnect(conn_id)
