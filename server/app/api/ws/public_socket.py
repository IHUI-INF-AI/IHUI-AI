"""Public WebSocket routes."""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.ws.manager import manager
from app.ws.auth_decorator import ws_require_auth

router = APIRouter()


@router.websocket("/ws/chat/{room}")
@ws_require_auth
async def ws_chat(websocket: WebSocket, room: str):
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data) if data.startswith("{") else {"text": data}
            msg["room"] = room
            await manager.broadcast(room, msg)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
    except Exception:
        manager.disconnect(websocket, room)


@router.websocket("/ws/user/{user_uuid}")
@ws_require_auth
async def ws_user(websocket: WebSocket, user_uuid: str):
    room = f"user:{user_uuid}"
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "pong", "data": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
    except Exception:
        manager.disconnect(websocket, room)
