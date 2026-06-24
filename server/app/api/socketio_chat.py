#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Socket.IO 高并发聊天服务
- 迁移自 H:\ljd-交接文件\coze_zhs_py\api\socketio_chat.py
- 不影响原有 WebSocket 接口，提供高并发、排队机制的 Socket.IO 实现
- 支持：连接管理、消息广播、点对点推送、连接状态查询
"""

import asyncio
import logging
import time
import uuid
from collections import deque
from datetime import datetime
from typing import Any, Dict, List

import socketio
from fastapi import APIRouter

logger = logging.getLogger("socketio-chat")

# 1) Socket.IO 异步服务器
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode="asgi",
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1_000_000,
    logger=False,
    engineio_logger=False,
)

# 2) FastAPI 业务路由
router = APIRouter(prefix="/cozeZhsApi/socketio", tags=["Socket.IO 聊天"])


class SocketIOConnectionManager:
    """Socket.IO 连接管理器（支持高并发 + 排队）"""

    def __init__(self) -> None:
        self.active_connections: Dict[str, str] = {}      # client_id -> session_id
        self.session_to_client: Dict[str, str] = {}        # session_id -> client_id
        self.connection_info: Dict[str, Dict[str, Any]] = {}
        self.chat_sessions: Dict[str, Dict[str, Any]] = {}

        self.max_active_connections = 3000
        self.max_queue_size = 2000
        self.queue_timeout = 90

        self.connection_queue: deque = deque()
        self.queue_processing = False

        self.total_connections = 0
        self.total_messages = 0
        self.peak_connections = 0
        self._tasks_started = False

    def _start_background_tasks(self) -> None:
        if self._tasks_started:
            return
        try:
            asyncio.create_task(self._process_queue())
            asyncio.create_task(self._cleanup_inactive_connections())
            asyncio.create_task(self._update_statistics())
            self._tasks_started = True
            logger.info("✅ Socket.IO 后台任务已启动")
        except RuntimeError:
            pass

    async def add_connection(self, session_id: str, client_id: str, info: Dict[str, Any]) -> bool:
        self._start_background_tasks()
        if len(self.active_connections) >= self.max_active_connections:
            if len(self.connection_queue) >= self.max_queue_size:
                await sio.emit("error", {"code": "QUEUE_FULL", "message": "服务器繁忙"}, room=session_id)
                await sio.disconnect(session_id)
                return False
            self.connection_queue.append({
                "session_id": session_id,
                "client_id": client_id,
                "connection_info": info,
                "queued_at": time.time(),
            })
            position = len(self.connection_queue)
            await sio.emit("queued", {
                "position": position,
                "estimated_wait": position * 2,
                "message": f"当前排队第{position}位",
            }, room=session_id)
            return True
        return await self._direct_connect(session_id, client_id, info)

    async def _direct_connect(self, session_id: str, client_id: str, info: Dict[str, Any]) -> bool:
        try:
            self.active_connections[client_id] = session_id
            self.session_to_client[session_id] = client_id
            self.connection_info[client_id] = {
                "session_id": session_id,
                "connected_at": time.time(),
                "last_activity": time.time(),
                "message_count": 0,
                **info,
            }
            self.total_connections += 1
            current_count = len(self.active_connections)
            self.peak_connections = max(self.peak_connections, current_count)
            await sio.emit("connected", {
                "code": 200,
                "msg": "success",
                "data": {
                    "id": client_id,
                    "role": "system",
                    "type": "connected",
                    "content": "Socket.IO 连接已建立",
                    "connection_count": current_count,
                },
            }, room=session_id)
            return True
        except Exception as e:
            logger.error("❌ 建立连接失败 %s: %s", client_id, e)
            return False

    async def remove_connection(self, session_id: str) -> None:
        client_id = self.session_to_client.pop(session_id, None)
        if not client_id:
            return
        self.active_connections.pop(client_id, None)
        self.connection_info.pop(client_id, None)
        self.chat_sessions.pop(client_id, None)

    async def _process_queue(self) -> None:
        while True:
            try:
                if self.connection_queue and len(self.active_connections) < self.max_active_connections:
                    item = self.connection_queue.popleft()
                    if time.time() - item["queued_at"] > self.queue_timeout:
                        await sio.emit("timeout", {"message": "排队超时"}, room=item["session_id"])
                        await sio.disconnect(item["session_id"])
                        continue
                    await self._direct_connect(item["session_id"], item["client_id"], item["connection_info"])
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.error("❌ 排队处理异常: %s", e)
                await asyncio.sleep(1)

    async def _cleanup_inactive_connections(self) -> None:
        while True:
            try:
                now = time.time()
                inactive = [
                    cid for cid, info in self.connection_info.items()
                    if now - info.get("last_activity", now) > 600
                ]
                for cid in inactive:
                    sid = self.active_connections.get(cid)
                    if sid:
                        try:
                            await sio.disconnect(sid)
                        except Exception:
                            pass
                        await self.remove_connection(sid)
                await asyncio.sleep(300)
            except Exception as e:
                logger.error("❌ 清理异常: %s", e)
                await asyncio.sleep(300)

    async def _update_statistics(self) -> None:
        while True:
            await asyncio.sleep(60)
            logger.info(
                "📊 活跃=%d 排队=%d 峰值=%d 累计=%d",
                len(self.active_connections), len(self.connection_queue),
                self.peak_connections, self.total_connections,
            )

    def get_statistics(self) -> Dict[str, Any]:
        return {
            "active_connections": len(self.active_connections),
            "queue_size": len(self.connection_queue),
            "total_connections": self.total_connections,
            "peak_connections": self.peak_connections,
            "total_messages": self.total_messages,
            "max_active_connections": self.max_active_connections,
            "max_queue_size": self.max_queue_size,
        }


# 全局单例
connection_manager = SocketIOConnectionManager()


# ----- Socket.IO 事件 -----
@sio.event
async def connect(sid, environ, auth):
    try:
        client_id = f"sio_{uuid.uuid4().hex[:12]}"
        qs = environ.get("QUERY_STRING", "")
        if "client_id=" in qs:
            for p in qs.split("&"):
                if p.startswith("client_id="):
                    client_id = p.split("=", 1)[1] or client_id
                    break
        info = {
            "user_agent": environ.get("HTTP_USER_AGENT", ""),
            "origin": environ.get("HTTP_ORIGIN", ""),
            "protocol": "socketio",
        }
        return await connection_manager.add_connection(sid, client_id, info)
    except Exception as e:
        logger.error("❌ Socket.IO connect 失败: %s", e)
        try:
            await sio.disconnect(sid)
        except Exception:
            pass
        return False


@sio.event
async def disconnect(sid):
    try:
        await connection_manager.remove_connection(sid)
    except Exception as e:
        logger.error("❌ disconnect 失败: %s", e)


@sio.event
async def message(sid, data):
    try:
        client_id = connection_manager.session_to_client.get(sid)
        if not client_id:
            await sio.emit("error", {"code": 404, "msg": "客户端未找到"}, room=sid)
            return
        info = connection_manager.connection_info.get(client_id)
        if info:
            info["last_activity"] = time.time()
            info["message_count"] = info.get("message_count", 0) + 1
        connection_manager.total_messages += 1
        # 此处可集成原有聊天处理逻辑
        await sio.emit("message", {
            "code": 200, "msg": "success",
            "data": {
                "id": client_id, "role": "assistant", "type": "answer",
                "content": f"[Socket.IO] 收到您的消息: {data}", "content_type": "text",
                "timestamp": datetime.now().isoformat(),
            },
            "event": "message.response",
        }, room=sid)
    except Exception as e:
        logger.error("❌ 消息处理失败: %s", e)
        await sio.emit("error", {"code": 500, "msg": f"消息处理失败: {e}"}, room=sid)


# ----- HTTP 业务端点 -----
@router.post("/broadcast")
async def broadcast_message(message: dict):
    await sio.emit("broadcast", message)
    return {"code": 200, "msg": "ok", "data": {"recipients": len(connection_manager.active_connections)}}


@router.post("/send/{client_id}")
async def send_to_client(client_id: str, message: dict):
    sid = connection_manager.active_connections.get(client_id)
    if not sid:
        return {"code": 404, "msg": "客户端未找到"}
    await sio.emit("message", message, room=sid)
    return {"code": 200, "msg": "ok", "data": {"client_id": client_id, "session_id": sid}}


@router.get("/connections")
async def get_connections():
    return {
        "code": 200, "msg": "ok",
        "data": {
            **connection_manager.get_statistics(),
            "connections": [
                {
                    "client_id": cid,
                    "session_id": info["session_id"],
                    "connected_at": info["connected_at"],
                    "last_activity": info["last_activity"],
                    "message_count": info.get("message_count", 0),
                    "protocol": info.get("protocol", "socketio"),
                }
                for cid, info in connection_manager.connection_info.items()
            ],
        },
    }


@router.get("/queue/status")
async def get_queue_status():
    items = [
        {"position": i + 1, "client_id": it["client_id"], "queued_at": it["queued_at"],
         "wait_time": time.time() - it["queued_at"]}
        for i, it in enumerate(connection_manager.connection_queue)
    ]
    return {"code": 200, "msg": "ok", "data": {
        "queue_size": len(connection_manager.connection_queue),
        "max_queue_size": connection_manager.max_queue_size,
        "queue_items": items,
    }}


@router.get("/health")
async def health():
    return {"code": 200, "msg": "healthy", "data": {
        "service": "Socket.IO Chat Service", "status": "running",
        "timestamp": datetime.now().isoformat(),
        **connection_manager.get_statistics(),
    }}


# 暴露 socketio_app（ASGI 挂载用）
socketio_app = socketio.ASGIApp(sio)
