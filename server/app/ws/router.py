"""WebSocket 路由统一注册."""

from fastapi import APIRouter

# 2026-06-29 联调: 移除 timbre_router 重复挂载
# - app/ws/router.py 原 include(prefix=/timbre) -> 路径 /timbre/list (无前端调用, 冗余)
# - app/api/v1/router.py:805 已挂载 prefix=/ws/timbre -> 路径 /api/v1/ws/timbre/list (统一入口)
# 保留 api/v1 路径作为唯一入口, 避免双重挂载引起 OpenAPI 文档重复 + 路由冲突
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
