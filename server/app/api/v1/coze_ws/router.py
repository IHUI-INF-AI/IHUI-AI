"""Coze 原生 WebSocket chat 路由 (迁移自 coze_zhs_py/api/websocket.py).

7 个端点 (前缀 /cozeZhsApi/ws):
  - WebSocket /chat/{client_id}            流式聊天 (指定 client_id)
  - WebSocket /chat                        流式聊天 (自动生成 client_id)
  - GET    /stats                          连接统计
  - GET    /connections                    详细连接信息
  - GET    /queue                          排队状态
  - POST   /websocket/emergency-cleanup    紧急清理所有连接
  - GET    /websocket/system-status        系统状态 (内存/CPU/连接数)
  - GET    /websocket/auto-recovery-status 自动恢复监控状态 (出箱队列/任务跟踪/恢复历史)

通过 httpx SSE 调用 Coze v3/chat (stream=true), 将 conversation.message.delta
等事件实时转发给前端 WebSocket. 不依赖 cozepy SDK.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from app.config import settings

logger = logging.getLogger("coze-ws")

router = APIRouter(prefix="/cozeZhsApi/ws", tags=["Coze原生WebSocket"])

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 连接超时 (秒) - 与 settings.WEBSOCKET_TIMEOUT 对齐, 默认 900
_CONNECTION_TIMEOUT = int(getattr(settings, "WEBSOCKET_TIMEOUT", 900) or 900)
# 单条消息接收超时 (秒) - 超时后发心跳
_MESSAGE_TIMEOUT = 120
# 最大并发连接数
_MAX_CONNECTIONS = 2000
# 最大并发请求 (信号量)
_MAX_CONCURRENT_REQUESTS = 100


class WSMessageType(str, Enum):
    """WebSocket 消息类型 (前端 -> 后端)."""

    CHAT_START = "chat.start"
    CHAT_MESSAGE = "chat.message"
    CHAT_STOP = "chat.stop"
    CHAT_CLEAR = "chat.clear"


# ---------------------------------------------------------------------------
# CozeWSManager - 连接管理器 (简化版, 替代原 3270 行 ConnectionManager)
# ---------------------------------------------------------------------------


class CozeWSManager:
    """Coze WebSocket 连接管理器.

    管理 client_id -> WebSocket 映射, 支持连接统计 / 排队 / 紧急清理.
    所有公共方法均通过 asyncio.Lock 保护, 避免并发冲突.
    """

    def __init__(self) -> None:
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_info: Dict[str, Dict[str, Any]] = {}
        self.chat_sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(_MAX_CONCURRENT_REQUESTS)
        # 正在运行的 chat 任务 (client_id -> asyncio.Task), 用于 chat.stop
        self._running_tasks: Dict[str, asyncio.Task] = {}

    # -- 连接管理 --------------------------------------------------------

    async def connect(
        self,
        websocket: WebSocket,
        client_id: str,
        connection_info: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """接受 WebSocket 连接并注册到 active_connections.

        Returns:
            True 表示连接成功, False 表示被拒绝 (连接数已满).
        """
        async with self._lock:
            if len(self.active_connections) >= _MAX_CONNECTIONS:
                logger.warning("连接数已满 (%d/%d), 拒绝连接: %s",
                               len(self.active_connections), _MAX_CONNECTIONS, client_id)
                try:
                    await websocket.close(code=1013, reason="连接数已满")
                except Exception as e:
                    logger.debug("关闭被拒绝的 WebSocket 失败: %s", e)
                return False

            await websocket.accept()
            self.active_connections[client_id] = websocket
            self.connection_info[client_id] = {
                "client_id": client_id,
                "connected_at": time.time(),
                "last_activity": time.time(),
                "message_count": 0,
                "is_secure": (connection_info or {}).get("is_secure", False),
                "user_agent": (connection_info or {}).get("user_agent", ""),
                "origin": (connection_info or {}).get("origin", ""),
            }
            logger.info("WebSocket 连接成功: %s, 当前连接数: %d/%d",
                        client_id, len(self.active_connections), _MAX_CONNECTIONS)

        # 发送连接成功通知 (锁外发送, 避免长时间持锁)
        await self._send_connection_success(websocket, client_id)
        return True

    async def _send_connection_success(self, websocket: WebSocket, client_id: str) -> None:
        """发送连接成功事件给客户端."""
        try:
            await websocket.send_text(json.dumps({
                "code": 200,
                "msg": "连接成功",
                "event": "connection.established",
                "data": {
                    "client_id": client_id,
                    "timestamp": int(time.time()),
                    "server_time": datetime.now(timezone.utc).isoformat(),
                },
            }, ensure_ascii=False))
        except Exception as e:
            logger.debug("发送连接成功通知失败 %s: %s", client_id, e)

    async def disconnect(self, client_id: str) -> None:
        """从所有映射中移除 client_id (不主动关闭 WebSocket)."""
        async with self._lock:
            self.active_connections.pop(client_id, None)
            self.connection_info.pop(client_id, None)
            self.chat_sessions.pop(client_id, None)
            task = self._running_tasks.pop(client_id, None)

        if task is not None and not task.done():
            task.cancel()
            try:
                await task
            except Exception as e:
                logger.debug("取消运行中的 chat 任务失败 %s: %s", client_id, e)

    async def force_disconnect_all(self) -> int:
        """强制断开所有连接, 返回断开的连接数."""
        async with self._lock:
            items = list(self.active_connections.items())
            self.active_connections.clear()
            self.connection_info.clear()
            self.chat_sessions.clear()
            tasks = list(self._running_tasks.values())
            self._running_tasks.clear()

        # 取消所有运行中的任务
        for task in tasks:
            if not task.done():
                task.cancel()

        # 关闭所有 WebSocket (锁外执行, 避免长时间持锁)
        closed = 0
        for _client_id, ws in items:
            try:
                if ws.client_state in (WebSocketState.CONNECTING, WebSocketState.CONNECTED):
                    await ws.close(code=1001, reason="服务器强制清理")
                closed += 1
            except Exception as e:
                logger.debug("强制关闭 WebSocket 失败 %s: %s", _client_id, e)

        logger.warning("强制断开 %d 个 WebSocket 连接", closed)
        return closed

    # -- 消息发送 --------------------------------------------------------

    async def send_message(self, client_id: str, message: Dict[str, Any]) -> bool:
        """发送 JSON 消息给指定客户端.

        Returns:
            True 发送成功, False 发送失败 (连接已断开).
        """
        ws = self.active_connections.get(client_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(message, ensure_ascii=False))
            return True
        except Exception as e:
            logger.debug("发送消息失败 %s: %s", client_id, e)
            return False

    async def send_error(
        self, client_id: str, message: str, error_code: str = "INTERNAL_ERROR"
    ) -> None:
        """发送错误消息给客户端."""
        await self.send_message(client_id, {
            "code": 500,
            "msg": message,
            "event": "error",
            "error_code": error_code,
            "timestamp": int(time.time()),
        })

    def is_connection_active(self, client_id: str) -> bool:
        """检查连接是否仍然活跃."""
        ws = self.active_connections.get(client_id)
        if ws is None:
            return False
        try:
            return ws.client_state == WebSocketState.CONNECTED
        except Exception as e:
            logger.debug("检查连接状态失败 %s: %s", client_id, e)
            return False

    # -- 统计 ------------------------------------------------------------

    def get_connection_stats(self) -> Dict[str, Any]:
        """返回连接统计摘要."""
        now = time.time()
        active_count = 0
        for _cid, info in self.connection_info.items():
            try:
                if now - info.get("last_activity", 0) < 300:
                    active_count += 1
            except Exception as e:
                logger.debug("统计活跃连接失败: %s", e)

        return {
            "total_connections": len(self.active_connections),
            "active_connections": active_count,
            "max_connections": _MAX_CONNECTIONS,
            "total_chat_sessions": len(self.chat_sessions),
            "running_tasks": len(self._running_tasks),
            "max_concurrent_requests": _MAX_CONCURRENT_REQUESTS,
            "timestamp": now,
        }

    async def get_detailed_connection_info(self) -> list[Dict[str, Any]]:
        """返回所有连接的详细信息列表."""
        result: list[Dict[str, Any]] = []
        now = time.time()
        async with self._lock:
            for client_id, info in self.connection_info.items():
                session = self.chat_sessions.get(client_id, {})
                result.append({
                    "client_id": client_id,
                    "connected_at": info.get("connected_at"),
                    "last_activity": info.get("last_activity"),
                    "idle_seconds": round(now - info.get("last_activity", now), 1),
                    "message_count": info.get("message_count", 0),
                    "is_secure": info.get("is_secure", False),
                    "has_chat_session": bool(session),
                    "bot_id": session.get("bot_id", ""),
                    "conversation_id": session.get("conversation_id", ""),
                    "user_id": session.get("user_id", ""),
                    "is_alive": self.is_connection_active(client_id),
                })
        return result

    def get_queue_status(self) -> Dict[str, Any]:
        """返回信号量排队状态."""
        return {
            "max_concurrent_requests": _MAX_CONCURRENT_REQUESTS,
            "running_tasks": len(self._running_tasks),
            "available_slots": max(0, _MAX_CONCURRENT_REQUESTS - len(self._running_tasks)),
            "semaphore_locked": self._semaphore.locked() if hasattr(self._semaphore, "locked") else False,
            "timestamp": time.time(),
        }

    async def _handle_client_disconnect(self, client_id: str, reason: str = "") -> None:
        """客户端断开时的清理逻辑."""
        logger.info("客户端断开清理: %s (原因: %s)", client_id, reason)
        await self.disconnect(client_id)

    # -- 会话管理 --------------------------------------------------------

    async def set_chat_session(
        self, client_id: str, bot_id: str, user_id: str, conversation_id: str = ""
    ) -> None:
        """设置聊天会话信息."""
        async with self._lock:
            self.chat_sessions[client_id] = {
                "bot_id": bot_id,
                "user_id": user_id,
                "conversation_id": conversation_id,
                "created_at": time.time(),
            }

    def get_chat_session(self, client_id: str) -> Dict[str, Any]:
        """获取聊天会话信息."""
        return self.chat_sessions.get(client_id, {})

    async def update_conversation_id(self, client_id: str, conversation_id: str) -> None:
        """更新会话的 conversation_id."""
        async with self._lock:
            if client_id in self.chat_sessions:
                self.chat_sessions[client_id]["conversation_id"] = conversation_id

    async def clear_chat_session(self, client_id: str) -> None:
        """清除聊天会话."""
        async with self._lock:
            self.chat_sessions.pop(client_id, None)

    async def update_activity(self, client_id: str) -> None:
        """更新连接的最后活动时间."""
        async with self._lock:
            if client_id in self.connection_info:
                self.connection_info[client_id]["last_activity"] = time.time()
                self.connection_info[client_id]["message_count"] += 1

    async def register_running_task(self, client_id: str, task: asyncio.Task) -> None:
        """注册运行中的 chat 任务 (用于 chat.stop 取消)."""
        async with self._lock:
            old = self._running_tasks.pop(client_id, None)
            if old is not None and not old.done():
                old.cancel()
            self._running_tasks[client_id] = task


# 全局单例
manager = CozeWSManager()


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def create_timeout_message(
    client_id: str = "",
    conversation_id: str = "",
    bot_id: str = "",
) -> Dict[str, Any]:
    """构造连接超时消息."""
    return {
        "code": 408,
        "msg": "连接超时, 已主动断开",
        "event": "connection.timeout",
        "data": {
            "client_id": client_id,
            "conversation_id": conversation_id,
            "bot_id": bot_id,
            "timeout_seconds": _CONNECTION_TIMEOUT,
        },
        "timestamp": int(time.time()),
    }


def create_heartbeat_message() -> Dict[str, Any]:
    """构造心跳消息."""
    return {
        "code": 200,
        "msg": "heartbeat",
        "event": "connection.heartbeat",
        "timestamp": int(time.time()),
    }


def validate_websocket_connection(websocket: WebSocket) -> Dict[str, Any]:
    """验证 WebSocket 连接安全性, 返回连接信息."""
    headers = {}
    try:
        for k, v in websocket.headers.items():
            headers[k.lower()] = v
    except Exception as e:
        logger.debug("读取 WebSocket headers 失败: %s", e)

    is_secure = False
    try:
        scheme = getattr(websocket, "url", None)
        if scheme is not None and str(scheme).startswith("wss"):
            is_secure = True
    except Exception as e:
        logger.debug("判断 WebSocket 是否加密失败: %s", e)

    return {
        "is_secure": is_secure,
        "user_agent": headers.get("user-agent", ""),
        "origin": headers.get("origin", ""),
    }


# ---------------------------------------------------------------------------
# Coze v3/chat SSE 流式调用
# ---------------------------------------------------------------------------


def _coze_headers() -> Dict[str, str]:
    """构造 Coze API 请求头."""
    return {
        "Authorization": "Bearer " + settings.COZE_PRIVATE_KEY,
        "Content-Type": "application/json",
    }


async def call_coze_chat_stream(
    client_id: str,
    bot_id: str,
    user_id: str,
    message: str,
    conversation_id: str = "",
    additional_messages: Optional[list] = None,
) -> None:
    """调用 Coze v3/chat (stream=true), 将 SSE 事件实时转发给 WebSocket 客户端.

    该函数会在单独的 asyncio.Task 中运行, 支持 chat.stop 取消.
    """
    url = settings.COZE_API_BASE + "/v3/chat"
    payload: Dict[str, Any] = {
        "bot_id": bot_id,
        "user_id": user_id,
        "stream": True,
        "auto_save_history": True,
        "additional_messages": additional_messages or [
            {
                "role": "user",
                "content": message,
                "content_type": "text",
            }
        ],
    }
    if conversation_id:
        payload["conversation_id"] = conversation_id

    logger.info("调用 Coze v3/chat: client_id=%s bot_id=%s user_id=%s conv=%s",
                client_id, bot_id, user_id, conversation_id or "(new)")

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            async with http_client.stream(
                "POST", url, headers=_coze_headers(), json=payload
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    err_text = body.decode("utf-8", errors="replace")
                    logger.error("Coze API 返回非 200: %d, body=%s", response.status_code, err_text[:500])
                    await manager.send_message(client_id, {
                        "code": response.status_code,
                        "msg": "Coze API 调用失败",
                        "event": "error",
                        "data": {"status_code": response.status_code, "detail": err_text[:500]},
                        "timestamp": int(time.time()),
                    })
                    return

                # 解析 SSE 流: event: xxx \n data: {...} \n\n
                current_event = ""
                async for line in response.aiter_lines():
                    if not line:
                        # 空行 = 事件结束
                        current_event = ""
                        continue
                    if line.startswith("event:"):
                        current_event = line[6:].strip()
                    elif line.startswith("data:"):
                        data_str = line[5:].strip()
                        if not data_str:
                            continue
                        try:
                            data = json.loads(data_str)
                        except json.JSONDecodeError as e:
                            logger.debug("解析 Coze SSE data 失败: %s, raw=%s", e, data_str[:200])
                            continue

                        # 提取 conversation_id (首次出现时更新会话)
                        conv_id = data.get("conversation_id", "")
                        if conv_id:
                            await manager.update_conversation_id(client_id, conv_id)

                        # 转发给前端
                        await manager.send_message(client_id, {
                            "code": 200,
                            "msg": "success",
                            "event": current_event or "conversation.message",
                            "data": data,
                            "timestamp": int(time.time()),
                        })

                        # chat completed -> 发送结束标识
                        if current_event in (
                            "conversation.chat.completed",
                            "conversation.chat.failed",
                            "conversation.chat.in_progress",
                        ):
                            if current_event == "conversation.chat.completed":
                                await manager.send_message(client_id, {
                                    "type": "completed",
                                    "msg": "流式响应完成",
                                    "event": "chat.completed",
                                    "timestamp": int(time.time()),
                                })
                                break

    except asyncio.CancelledError:
        logger.info("Coze chat 任务被取消: %s", client_id)
        await manager.send_message(client_id, {
            "code": 200,
            "msg": "聊天已停止",
            "event": "chat.stopped",
            "timestamp": int(time.time()),
        })
        raise
    except httpx.TimeoutException as e:
        logger.error("Coze API 请求超时: %s", e)
        await manager.send_message(client_id, {
            "code": 504,
            "msg": "Coze API 请求超时",
            "event": "error",
            "error_code": "COZE_TIMEOUT",
            "timestamp": int(time.time()),
        })
    except Exception as e:
        logger.error("Coze chat 流式调用失败 %s: %s", client_id, e)
        await manager.send_message(client_id, {
            "code": 500,
            "msg": f"Coze 调用失败: {str(e)}",
            "event": "error",
            "error_code": "COZE_ERROR",
            "timestamp": int(time.time()),
        })


# ---------------------------------------------------------------------------
# 消息处理
# ---------------------------------------------------------------------------


async def handle_chat_start(client_id: str, data: Dict[str, Any]) -> None:
    """处理 chat.start 事件 - 初始化聊天会话."""
    bot_id = str(data.get("bot_id", "")).strip()
    user_id = str(data.get("user_id", "")).strip()
    conversation_id = str(data.get("conversation_id", "")).strip()

    if not bot_id:
        await manager.send_error(client_id, "bot_id 不能为空", "INVALID_PARAMS")
        return
    if not user_id:
        await manager.send_error(client_id, "user_id 不能为空", "INVALID_PARAMS")
        return

    await manager.set_chat_session(client_id, bot_id, user_id, conversation_id)
    await manager.send_message(client_id, {
        "code": 200,
        "msg": "聊天会话已初始化",
        "event": "chat.started",
        "data": {
            "client_id": client_id,
            "bot_id": bot_id,
            "user_id": user_id,
            "conversation_id": conversation_id,
        },
        "timestamp": int(time.time()),
    })
    logger.info("聊天会话初始化: client_id=%s bot_id=%s user_id=%s", client_id, bot_id, user_id)


async def handle_chat_message(client_id: str, data: Dict[str, Any]) -> None:
    """处理 chat.message 事件 - 调用 Coze 并流式返回."""
    session = manager.get_chat_session(client_id)
    if not session:
        await manager.send_error(client_id, "请先发送 chat.start 初始化会话", "NO_SESSION")
        return

    bot_id = session.get("bot_id", "")
    user_id = session.get("user_id", "")
    conversation_id = session.get("conversation_id", "")

    message = str(data.get("message", "")).strip()
    if not message:
        await manager.send_error(client_id, "message 不能为空", "INVALID_PARAMS")
        return

    # 兼容前端传入的 additional_messages / agentVariables
    additional_messages = data.get("additional_messages")
    if not additional_messages:
        additional_messages = [
            {"role": "user", "content": message, "content_type": "text"}
        ]

    # 如果已有运行中的任务, 先取消
    await manager.register_running_task(client_id, asyncio.current_task())

    # 发送开始事件
    await manager.send_message(client_id, {
        "code": 200,
        "msg": "开始处理消息",
        "event": "chat.message.start",
        "data": {"client_id": client_id, "message": message},
        "timestamp": int(time.time()),
    })

    # 调用 Coze (流式)
    await call_coze_chat_stream(
        client_id=client_id,
        bot_id=bot_id,
        user_id=user_id,
        message=message,
        conversation_id=conversation_id,
        additional_messages=additional_messages,
    )


async def handle_chat_stop(client_id: str) -> None:
    """处理 chat.stop 事件 - 停止当前聊天."""
    async with manager._lock:
        task = manager._running_tasks.pop(client_id, None)

    if task is not None and not task.done():
        task.cancel()
        try:
            await task
        except Exception as e:
            logger.debug("停止 chat 任务失败 %s: %s", client_id, e)

    await manager.send_message(client_id, {
        "code": 200,
        "msg": "聊天已停止",
        "event": "chat.stopped",
        "timestamp": int(time.time()),
    })


async def handle_chat_clear(client_id: str) -> None:
    """处理 chat.clear 事件 - 清除会话历史."""
    await manager.clear_chat_session(client_id)
    await manager.send_message(client_id, {
        "code": 200,
        "msg": "会话已清除",
        "event": "chat.cleared",
        "timestamp": int(time.time()),
    })


async def process_websocket_message(client_id: str, message_data: Dict[str, Any]) -> None:
    """分发 WebSocket 消息到对应处理器."""
    msg_type = message_data.get("type", "")
    data = message_data.get("data", {}) or {}

    try:
        if msg_type == WSMessageType.CHAT_START.value:
            await handle_chat_start(client_id, data)
        elif msg_type == WSMessageType.CHAT_MESSAGE.value:
            # chat.message 在独立任务中运行, 支持 chat.stop 取消
            task = asyncio.create_task(handle_chat_message(client_id, data))
            await manager.register_running_task(client_id, task)
        elif msg_type == WSMessageType.CHAT_STOP.value:
            await handle_chat_stop(client_id)
        elif msg_type == WSMessageType.CHAT_CLEAR.value:
            await handle_chat_clear(client_id)
        else:
            await manager.send_error(
                client_id, f"未知的消息类型: {msg_type}", "UNKNOWN_MESSAGE_TYPE"
            )
    except Exception as e:
        logger.error("处理消息失败 %s (type=%s): %s", client_id, msg_type, e)
        await manager.send_error(client_id, f"处理消息失败: {str(e)}", "MESSAGE_PROCESSING_ERROR")


# ---------------------------------------------------------------------------
# WebSocket 端点
# ---------------------------------------------------------------------------


@router.websocket("/chat/{client_id}")
async def websocket_chat_stream_with_id(websocket: WebSocket, client_id: str):
    """WebSocket 流式聊天服务 - 指定 client_id.

    支持消息类型: chat.start / chat.message / chat.stop / chat.clear
    """
    await websocket_chat_handler(websocket, client_id)


@router.websocket("/chat")
async def websocket_chat_stream(websocket: WebSocket):
    """WebSocket 流式聊天服务 - 自动生成 client_id."""
    client_id = f"auto_{uuid.uuid4().hex[:12]}"
    await websocket_chat_handler(websocket, client_id)


async def websocket_chat_handler(websocket: WebSocket, client_id: str):
    """WebSocket 流式聊天处理器.

    消息格式:
        {"type": "chat.start|chat.message|chat.stop|chat.clear", "data": {...}}

    连接超时后自动断开; 消息接收超时发送心跳.
    """
    connection_info = validate_websocket_connection(websocket)

    connected = await manager.connect(websocket, client_id, connection_info)
    if not connected:
        return

    connection_start = time.time()

    try:
        while True:
            # 检查连接总时长
            if time.time() - connection_start > _CONNECTION_TIMEOUT:
                logger.warning("WebSocket 连接超时 (%d秒), 主动断开: %s",
                               _CONNECTION_TIMEOUT, client_id)
                session = manager.get_chat_session(client_id)
                timeout_msg = create_timeout_message(
                    client_id=client_id,
                    conversation_id=session.get("conversation_id", ""),
                    bot_id=session.get("bot_id", ""),
                )
                await manager.send_message(client_id, timeout_msg)
                await manager.send_message(client_id, {
                    "type": "completed",
                    "msg": "流式响应完成",
                })
                try:
                    await websocket.close(code=1000, reason="Connection timeout")
                except Exception as e:
                    logger.debug("关闭超时 WebSocket 失败: %s", e)
                break

            # 接收消息 (带超时)
            try:
                raw = await asyncio.wait_for(
                    websocket.receive_text(), timeout=_MESSAGE_TIMEOUT
                )
            except asyncio.TimeoutError:
                # 发送心跳
                try:
                    await manager.send_message(client_id, create_heartbeat_message())
                    continue
                except Exception as e:
                    logger.debug("心跳发送失败, 连接可能已断开 %s: %s", client_id, e)
                    break

            # 解析 JSON
            try:
                message_data = json.loads(raw)
            except json.JSONDecodeError as e:
                logger.warning("客户端 %s 发送了无效 JSON: %s", client_id, e)
                if manager.is_connection_active(client_id):
                    await manager.send_error(client_id, "无效的 JSON 格式", "INVALID_JSON")
                continue

            # 信号量控制并发 + 更新活动时间
            async with manager._semaphore:
                await manager.update_activity(client_id)
                await process_websocket_message(client_id, message_data)

    except WebSocketDisconnect:
        logger.info("WebSocket 客户端 %s 正常断开", client_id)
        try:
            await manager.send_message(client_id, {
                "type": "completed",
                "msg": "流式响应完成",
            })
        except Exception as e:
            logger.debug("推送结束标识失败 %s: %s", client_id, e)

    except Exception as e:
        error_msg = str(e).lower()
        if any(kw in error_msg for kw in ("websocket", "connection", "closed", "socket")):
            logger.info("WebSocket 连接相关错误 %s: %s", client_id, e)
        else:
            logger.error("WebSocket 处理出错 %s: %s", client_id, e)
            if manager.is_connection_active(client_id):
                try:
                    await manager.send_error(client_id, f"连接处理出错: {str(e)}", "CONNECTION_ERROR")
                except Exception as send_err:
                    logger.debug("发送错误消息失败 %s: %s", client_id, send_err)

    finally:
        await manager._handle_client_disconnect(client_id, "连接结束")
        logger.info("WebSocket 客户端 %s 连接已清理", client_id)


# ---------------------------------------------------------------------------
# HTTP 监控端点
# ---------------------------------------------------------------------------


@router.get("/stats")
async def get_websocket_stats():
    """获取 WebSocket 连接统计信息."""
    try:
        stats = manager.get_connection_stats()
        return {
            "success": True,
            "data": stats,
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error("获取 WebSocket 统计失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }


@router.get("/connections")
async def get_websocket_connections():
    """获取详细的 WebSocket 连接信息."""
    try:
        connections = await manager.get_detailed_connection_info()
        return {
            "success": True,
            "data": {
                "connections": connections,
                "summary": manager.get_connection_stats(),
            },
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error("获取 WebSocket 连接信息失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }


@router.get("/queue")
async def get_websocket_queue_status():
    """获取 WebSocket 排队状态."""
    try:
        queue_status = manager.get_queue_status()
        return {
            "success": True,
            "data": queue_status,
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error("获取 WebSocket 排队状态失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }


@router.post("/websocket/emergency-cleanup")
async def emergency_websocket_cleanup():
    """紧急清理所有 WebSocket 连接 - 系统崩溃时使用."""
    try:
        logger.warning("执行紧急 WebSocket 连接清理")
        before_stats = manager.get_connection_stats()
        cleaned = await manager.force_disconnect_all()
        after_stats = manager.get_connection_stats()

        return {
            "code": 200,
            "msg": "紧急清理完成",
            "data": {
                "message": "所有 WebSocket 连接已强制断开",
                "before_cleanup": before_stats,
                "after_cleanup": after_stats,
                "cleaned_connections": cleaned,
            },
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error("紧急清理 WebSocket 连接失败: %s", e)
        return {
            "code": 500,
            "msg": f"紧急清理失败: {str(e)}",
            "data": {},
            "timestamp": time.time(),
        }


@router.get("/websocket/system-status")
async def get_system_status():
    """获取系统状态 - 检查是否有资源泄漏."""
    try:
        import gc

        import psutil

        process = psutil.Process(os.getpid())
        ws_stats = manager.get_connection_stats()
        memory_info = process.memory_info()

        # 文件描述符数量 (Windows 可能不支持 num_fds)
        try:
            fd_count = process.num_fds() if hasattr(process, "num_fds") else len(process.open_files())
        except Exception as e:
            logger.debug("获取文件描述符数量失败: %s", e)
            fd_count = -1

        thread_count = process.num_threads()

        gc.collect()
        gc_stats = gc.get_stats()

        # Python 3.11+: gc.get_stats() 返回 list[dict], key = collections/collected/uncollectable
        # 旧版本 (<3.11) 返回 list[namedtuple], 属性名同样是 collections/collected/uncollectable
        # 兼容两种格式
        gc_stats_normalized = []
        for s in gc_stats:
            if isinstance(s, dict):
                gc_stats_normalized.append({
                    "collections": s.get("collections", 0),
                    "collected": s.get("collected", 0),
                    "uncollectable": s.get("uncollectable", 0),
                })
            else:
                gc_stats_normalized.append({
                    "collections": getattr(s, "collections", 0),
                    "collected": getattr(s, "collected", 0),
                    "uncollectable": getattr(s, "uncollectable", 0),
                })

        return {
            "success": True,
            "data": {
                "process": {
                    "pid": os.getpid(),
                    "memory_rss_mb": round(memory_info.rss / 1024 / 1024, 2),
                    "memory_vms_mb": round(memory_info.vms / 1024 / 1024, 2),
                    "thread_count": thread_count,
                    "fd_count": fd_count,
                },
                "websocket": ws_stats,
                "gc_stats": gc_stats_normalized,
            },
            "timestamp": time.time(),
        }

    except ImportError:
        # psutil 不可用时退化
        ws_stats = manager.get_connection_stats()
        return {
            "success": True,
            "data": {
                "process": {
                    "pid": os.getpid(),
                    "note": "psutil not installed, process metrics unavailable",
                },
                "websocket": ws_stats,
            },
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error("获取系统状态失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }


@router.get("/websocket/auto-recovery-status")
async def get_auto_recovery_status():
    """获取 WebSocket 自动恢复监控状态 (出箱队列/任务跟踪/恢复历史).

    2026-06-26 P1 完善补充: auto_recovery 模块暴露了 get_recovery_status() 但缺
    API 端点, 这里补上, 方便运维/前端仪表盘拉取.
    """
    try:
        from app.ws.auto_recovery import get_recovery_status

        status = get_recovery_status()
        return {
            "success": True,
            "data": status,
            "timestamp": time.time(),
        }
    except Exception as e:
        logger.error("获取自动恢复状态失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "timestamp": time.time(),
        }


__all__ = [
    "router",
    "manager",
    "CozeWSManager",
]
