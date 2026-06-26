"""公共 Socket 管理器 v2 (迁移自 coze_zhs_py/api/public_socket.py).

特性:
  - WebSocket /cozeZhsApi/public-socket/ws (user_uuid:model_id:chat_id 三元组键管理)
  - POST    /cozeZhsApi/public-socket/send-message/{user_uuid}/{model_id} (HTTP 推送)
  - Redis 缓存消息 (key: {REDIS_PREFIX}{user_uuid}:{model_id}:{chat_id}, TTL=WEBSOCKET_TIMEOUT)
  - 重连自动补发缓存消息
  - run/stop 状态机 + total_tokens 计费跟踪
  - 公共函数 send_message_to_user_model() 供其他模块调用

与 app/api/ws/public_socket.py 区别:
  - 后者仅是简单 ws 转发, 无 Redis 缓存 / HTTP 推送 / 状态机.
  - 本 v2 文件完整迁移历史项目功能, 不破坏现有 app/api/ws/public_socket.py.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.config import settings
from app.redis_client import get_redis_async

logger = logging.getLogger("public-socket-v2")

router = APIRouter(prefix="/cozeZhsApi/public-socket", tags=["公共Socket接口V2"])


class PublicSocketManager:
    """公共 Socket 管理器 - user_uuid+model_id(+chat_id) 三元组键管理."""

    def __init__(self) -> None:
        # key: "user_uuid:model_id[:chat_id]" -> WebSocket
        self.connections: Dict[str, WebSocket] = {}
        # WebSocket -> key
        self.websocket_to_user_model: Dict[WebSocket, str] = {}
        # key -> {"status": "run"|"stop", "total_tokens": int, "started_at": float}
        self.session_state: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    # -- key helpers -----------------------------------------------------

    @staticmethod
    def _generate_key(
        user_uuid: str,
        model_id: str,
        chat_id: Optional[str] = None,
    ) -> str:
        if chat_id:
            return f"{user_uuid}:{model_id}:{chat_id}"
        return f"{user_uuid}:{model_id}"

    @staticmethod
    def _parse_key(key: str) -> tuple:
        parts = key.split(":", 2)
        if len(parts) == 3:
            return parts[0], parts[1], parts[2]
        if len(parts) == 2:
            return parts[0], parts[1], None
        return None, None, None

    def _cache_key(self, key: str) -> str:
        return f"{settings.REDIS_PREFIX}{key}"

    # -- 连接管理 --------------------------------------------------------

    async def add_connection(
        self,
        websocket: WebSocket,
        user_uuid: str,
        model_id: str,
        chat_id: Optional[str] = None,
    ) -> bool:
        """建立连接 (踢掉旧连接), 发送 connected 事件, 补发缓存消息."""
        key = self._generate_key(user_uuid, model_id, chat_id)

        async with self._lock:
            # 断开旧连接
            old_ws = self.connections.get(key)
            if old_ws is not None:
                try:
                    await old_ws.close()
                    logger.info("🔄 断开旧连接: %s", key)
                except Exception as e:
                    logger.debug("断开旧连接失败: %s", e)

            self.connections[key] = websocket
            self.websocket_to_user_model[websocket] = key
            if key not in self.session_state:
                self.session_state[key] = {
                    "status": "run",
                    "total_tokens": 0,
                    "started_at": time.time(),
                }
            logger.info(
                "✅ 公共Socket连接建立: %s, 当前连接数: %d",
                key,
                len(self.connections),
            )

        connection_data: Dict[str, Any] = {
            "user_uuid": user_uuid,
            "model_id": model_id,
            "connection_time": time.time(),
        }
        if chat_id:
            connection_data["chat_id"] = chat_id
        await websocket.send_text(
            json.dumps(
                {"event": "connected", "code": 200, "msg": "success", "data": connection_data}
            )
        )

        # 补发缓存消息 (不持锁, 避免长 IO 阻塞其他连接)
        await self._check_and_send_cached_messages(user_uuid, model_id, chat_id)
        return True

    async def remove_connection(self, websocket: WebSocket) -> None:
        """移除连接 (从映射中删除)."""
        async with self._lock:
            key = self.websocket_to_user_model.pop(websocket, None)
            if key is None:
                return
            if self.connections.get(key) is websocket:
                self.connections.pop(key, None)
                # 保留 session_state 与 Redis 缓存, 后续重连可继续
            logger.info("🔌 公共Socket连接断开: %s, 剩余连接数: %d", key, len(self.connections))

    # -- Redis 缓存 ------------------------------------------------------

    async def _check_and_send_cached_messages(
        self,
        user_uuid: str,
        model_id: str,
        chat_id: Optional[str] = None,
    ) -> None:
        """检查并发送 Redis 中的缓存消息 (用于断线重连补发)."""
        key = self._generate_key(user_uuid, model_id, chat_id)
        cache_key = self._cache_key(key)
        try:
            redis_client = get_redis_async()
            cached_messages = await redis_client.lrange(cache_key, 0, -1)
            if not cached_messages:
                return
            logger.info("📦 发现 %d 条缓存消息, 开始补发: %s", len(cached_messages), key)
            websocket = self.connections.get(key)
            if websocket is None:
                return
            for cached_msg in cached_messages:
                try:
                    if not cached_msg or cached_msg.strip() in ('""', "''"):
                        logger.warning("⚠️ 发现空缓存消息, 跳过: %s", key)
                        continue
                    msg_data = json.loads(cached_msg)
                    event_name = msg_data.get("event_name", "message")
                    message = msg_data.get("message")
                    payload: Dict[str, Any] = {
                        "event": event_name,
                        "user_uuid": user_uuid,
                        "model_id": model_id,
                        "timestamp": time.time(),
                        "message": message,
                        "status": msg_data.get("status", "run"),
                    }
                    if chat_id:
                        payload["chat_id"] = chat_id
                    if "total_tokens" in msg_data:
                        payload["total_tokens"] = msg_data["total_tokens"]
                    await websocket.send_text(json.dumps(payload, ensure_ascii=False))
                except Exception as e:
                    logger.debug("发送缓存消息失败 %s: %s", key, e)
            logger.info("📋 已补发全部缓存消息, 保留历史记录: %s", key)
        except Exception as e:
            logger.debug("检查缓存消息失败 %s: %s", key, e)

    # -- 发送消息 --------------------------------------------------------

    async def send_message(
        self,
        user_uuid: str,
        model_id: str,
        message: Any,
        event_name: str = "message",
        chat_id: Optional[str] = None,
    ) -> bool:
        """向指定 user_uuid+model_id(+chat_id) 发送消息.

        - 所有消息缓存到 Redis (key: {REDIS_PREFIX}{key}, TTL=WEBSOCKET_TIMEOUT)
        - 若消息为 dict 且包含 status/total_tokens, 会记录到 session_state
        - WebSocket 不在线时仅缓存, 不报错
        """
        key = self._generate_key(user_uuid, model_id, chat_id)
        websocket = self.connections.get(key)

        content = message
        status = "run"
        total_tokens: Optional[int] = None
        if isinstance(message, dict) and "content" in message:
            content = message["content"]
            status = message.get("status", "run")
            total_tokens = message.get("total_tokens")

        logger.info(
            "🔁 发送消息: key=%s, content=%s, status=%s",
            self._cache_key(key),
            str(content)[:80],
            status,
        )

        # 缓存到 Redis
        cache_key = self._cache_key(key)
        cache_payload: Dict[str, Any] = {
            "event_name": event_name,
            "message": content,
            "status": status,
            "timestamp": time.time(),
        }
        if total_tokens is not None:
            cache_payload["total_tokens"] = total_tokens
        if chat_id:
            cache_payload["chat_id"] = chat_id
        try:
            redis_client = get_redis_async()
            await redis_client.rpush(cache_key, json.dumps(cache_payload, ensure_ascii=False))
            await redis_client.expire(cache_key, settings.WEBSOCKET_TIMEOUT)
        except Exception as e:
            logger.debug("缓存消息到 Redis 失败 %s: %s", cache_key, e)

        # 更新 session_state (run/stop 状态机 + total_tokens 累计)
        async with self._lock:
            state = self.session_state.setdefault(
                key, {"status": "run", "total_tokens": 0, "started_at": time.time()}
            )
            state["status"] = status
            if total_tokens is not None:
                state["total_tokens"] = state.get("total_tokens", 0) + int(total_tokens)
            # status=stop 时清理 Redis 缓存
            if status == "stop":
                try:
                    redis_client = get_redis_async()
                    await redis_client.delete(cache_key)
                    logger.info("🗑️ 会话结束, 已删除 Redis 缓存: %s", key)
                except Exception as e:
                    logger.debug("清理 Redis 缓存失败 %s: %s", key, e)

        # 推送到 WebSocket
        payload: Dict[str, Any] = {
            "event": event_name,
            "user_uuid": user_uuid,
            "model_id": model_id,
            "timestamp": time.time(),
            "message": content,
            "status": status,
        }
        if total_tokens is not None:
            payload["total_tokens"] = total_tokens
        if chat_id:
            payload["chat_id"] = chat_id

        if websocket is None:
            logger.warning("⚠️ WebSocket 连接不存在: %s, 消息已缓存到 Redis", key)
            return False
        try:
            await websocket.send_text(json.dumps(payload, ensure_ascii=False))
            logger.debug("📤 消息已发送: %s -> %s (status=%s)", key, str(content)[:80], status)
            return True
        except Exception as e:
            logger.debug("发送消息失败 %s: %s", key, e)
            return False

    # -- 工具 ------------------------------------------------------------

    def is_connected(
        self,
        user_uuid: str,
        model_id: str,
        chat_id: Optional[str] = None,
    ) -> bool:
        key = self._generate_key(user_uuid, model_id, chat_id)
        return key in self.connections

    def get_session_state(
        self,
        user_uuid: str,
        model_id: str,
        chat_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        key = self._generate_key(user_uuid, model_id, chat_id)
        return self.session_state.get(key, {})


# 全局管理器实例
public_socket_manager = PublicSocketManager()


# ---------------------------------------------------------------------------
# WebSocket /ws
# ---------------------------------------------------------------------------


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """WebSocket 连接端点.

    客户端发送 {"event": "register", "user_uuid": "...", "model_id": "...", "chat_id": "..."}
    完成注册, 之后服务端推送 {"event": ..., "message": ..., "status": "run"|"stop"}.
    """
    await websocket.accept()
    logger.info("🔌 客户端尝试连接: %s", websocket.client)

    user_uuid: Optional[str] = None
    model_id: Optional[str] = None
    chat_id: Optional[str] = None
    registered = False

    try:
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)

                if message.get("event") == "register":
                    user_uuid = message.get("user_uuid")
                    model_id = message.get("model_id")
                    chat_id = message.get("chat_id")
                    if not user_uuid or not model_id:
                        await websocket.send_text(
                            json.dumps(
                                {
                                    "event": "error",
                                    "code": "MISSING_PARAMS",
                                    "message": "缺少必要参数: user_uuid 和 model_id",
                                }
                            )
                        )
                        continue
                    await public_socket_manager.add_connection(
                        websocket=websocket,
                        user_uuid=user_uuid,
                        model_id=model_id,
                        chat_id=chat_id,
                    )
                    registered = True
                elif registered:
                    # 已注册后可处理 ping/pong 或其他自定义事件
                    pass

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {
                            "event": "error",
                            "code": "INVALID_JSON",
                            "message": "无效的JSON格式",
                        }
                    )
                )
            except Exception as e:
                logger.debug("处理 WebSocket 消息失败: %s", e)
                await websocket.send_text(
                    json.dumps(
                        {
                            "event": "error",
                            "code": "PROCESSING_ERROR",
                            "message": f"处理消息失败: {e}",
                        }
                    )
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug("WebSocket 连接失败: %s", e)
    finally:
        if registered:
            await public_socket_manager.remove_connection(websocket)
        logger.info("🔌 客户端断开连接: %s", websocket.client)


# ---------------------------------------------------------------------------
# POST /send-message/{user_uuid}/{model_id}
# ---------------------------------------------------------------------------


@router.post("/send-message/{user_uuid}/{model_id}")
async def send_message_to_connection(
    user_uuid: str,
    model_id: str,
    request: dict,
) -> dict:
    """向指定用户和模型推送消息.

    请求体:
      {
        "message": "...",         # 必填
        "event_name": "message",  # 可选
        "status": "run",          # 可选 run/stop
        "chat_id": "...",         # 可选
        "total_tokens": 123       # 可选, 计费用
      }
    """
    message = request.get("message")
    event_name = request.get("event_name", "message")
    status = request.get("status", "run")
    chat_id = request.get("chat_id")
    total_tokens = request.get("total_tokens")

    if not message:
        raise HTTPException(status_code=400, detail="消息内容不能为空")

    message_with_status: Dict[str, Any] = {"content": message, "status": status}
    if total_tokens is not None:
        message_with_status["total_tokens"] = total_tokens

    success = await public_socket_manager.send_message(
        user_uuid, model_id, message_with_status, event_name, chat_id
    )

    response_data: Dict[str, Any] = {
        "user_uuid": user_uuid,
        "model_id": model_id,
        "event_name": event_name,
        "status": status,
        "sent": success,
    }
    if chat_id:
        response_data["chat_id"] = chat_id
    if total_tokens is not None:
        response_data["total_tokens"] = total_tokens

    return {
        "code": 200 if success else 404,
        "msg": "success" if success else "未找到连接",
        "data": response_data,
    }


# ---------------------------------------------------------------------------
# 公共函数: 供其他模块调用
# ---------------------------------------------------------------------------


async def send_message_to_user_model(
    user_uuid: str,
    model_id: str,
    message: Any,
    chat_id: str,
    event_name: str = "message",
    status: str = "run",
    total_tokens: Optional[int] = None,
) -> bool:
    """向指定用户+模型+会话推送消息.

    Args:
        user_uuid: 用户UUID
        model_id: 模型ID
        message: 消息内容 (字符串或 dict)
        chat_id: 会话ID (必填)
        event_name: 事件名, 默认 "message"
        status: 状态机 run/stop, 默认 "run"
        total_tokens: 计费 token 数, 可选

    Returns:
        bool: 是否发送成功 (WebSocket 不在线时返回 False, 但消息已缓存到 Redis)
    """
    logger.info(
        "send_message_to_user_model 入参: user_uuid=%s, model_id=%s, message=%s, "
        "chat_id=%s, event_name=%s, status=%s, total_tokens=%s",
        user_uuid,
        model_id,
        str(message)[:80],
        chat_id,
        event_name,
        status,
        total_tokens,
    )

    message_with_status: Dict[str, Any] = {"content": message, "status": status}
    if total_tokens is not None:
        message_with_status["total_tokens"] = total_tokens

    return await public_socket_manager.send_message(
        user_uuid, model_id, message_with_status, event_name, chat_id
    )


__all__ = [
    "router",
    "public_socket_manager",
    "PublicSocketManager",
    "send_message_to_user_model",
]
