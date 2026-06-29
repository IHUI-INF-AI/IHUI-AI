"""多人聊天室 WS 端点 - 房间维度 + 成员列表."""

import json
import time
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.ws.auth_decorator import ws_require_auth
from app.ws.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/room/{room_id}")
@ws_require_auth
async def chat_room(ws: WebSocket, room_id: str, user_uuid: str = Query(""), nickname: str = Query(""), token_exp: float = 0):
    """进入指定房间,支持实时成员列表、消息广播、踢人通知."""
    conn_id = f"{room_id}_{user_uuid}_{uuid.uuid4().hex[:6]}"
    # T1: 传 token_exp 给 connect 以启动 TTL 跟踪
    await connection_manager.connect(conn_id, ws, user_uuid=user_uuid, room_id=room_id, token_exp=token_exp)
    nick = nickname or user_uuid[:8]
    try:
        await connection_manager.broadcast_room(
            room_id,
            {"type": "room", "event": "member_join", "user": user_uuid, "nickname": nick, "ts": time.time()},
            exclude=conn_id,
        )
        await connection_manager.send_to(
            conn_id,
            {"type": "room", "event": "joined", "room": room_id, "you": user_uuid},
        )
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            mtype = msg.get("type", "text")
            if mtype == "text":
                await connection_manager.broadcast_room(
                    room_id,
                    {
                        "type": "text",
                        "from": user_uuid,
                        "nickname": nick,
                        "text": msg.get("text", ""),
                        "ts": time.time(),
                    },
                )
            elif mtype == "typing":
                await connection_manager.broadcast_room(
                    room_id,
                    {"type": "typing", "user": user_uuid, "nickname": nick},
                    exclude=conn_id,
                )
    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.broadcast_room(
            room_id,
            {"type": "room", "event": "member_leave", "user": user_uuid, "nickname": nick},
        )
        await connection_manager.disconnect(conn_id)
