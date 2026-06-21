"""WebSocket 路由统一注册."""

from fastapi import APIRouter

from app.api.v1.ws.timbre import router as timbre_router
from app.ws.agent_stream import router as agent_stream_router
from app.ws.chat_room import router as chat_room_router
from app.ws.chat_socketio import router as chat_socketio_router
from app.ws.notice import router as notice_router
from app.ws.payment_status import router as payment_status_router
from app.ws.tts import router as tts_router

ws_router = APIRouter()
ws_router.include_router(chat_socketio_router)
ws_router.include_router(chat_room_router)
ws_router.include_router(agent_stream_router)
ws_router.include_router(tts_router)
# notice_router 同时包含 WS 端点 + HTTP push 端点, 一次性 include
ws_router.include_router(notice_router)
ws_router.include_router(payment_status_router)
ws_router.include_router(timbre_router, prefix="/timbre", tags=["WS: Timbre"])
