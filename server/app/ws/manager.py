"""WebSocket 高并发连接管理器(单例).

支持:
- 房间订阅 (subscribe / unsubscribe)
- 用户绑定 (user_id 维度的连接)
- Redis pub/sub 跨进程广播(集群)
- 心跳检测
- 跨实例消息分发
- JWT 鉴权 (authenticate_token)
- T1: Token TTL 跟踪 + 过期前主动通知客户端 refresh
"""

import asyncio
import contextlib
import json
import time
from collections import defaultdict
from typing import Any

from fastapi import WebSocket
from loguru import logger


def _get_redis():
    """惰性获取 redis 客户端(避免导入期失败)."""
    try:
        from app.utils.redis_util import get_redis

        return get_redis()
    except Exception as e:
        logger.warning(f"Redis unavailable for WS broadcast: {e}")
        return None


# ---------------------------------------------------------------------------
# JWT 鉴权辅助
# ---------------------------------------------------------------------------


def authenticate_token(token: str | None) -> str | None:
    """校验 JWT 并返回 user_uuid (sub). 无效返回 None.

    供 WebSocket endpoint 在 accept 前调用, 失败直接 close.
    优先从 query 拿 ?token=, 兼容 Sec-WebSocket-Protocol header.
    """
    if not token:
        return None
    try:
        from app.security import decode_access_token

        payload = decode_access_token(token)
        if not payload:
            return None
        # 拒绝 refresh token 用作 WS 鉴权
        if payload.get("type") == "refresh":
            return None
        return payload.get("sub")
    except Exception as e:
        logger.warning(f"WS auth token decode error: {e}")
        return None


async def ws_authenticate(ws: WebSocket, token: str | None) -> str | None:
    """在 accept() 之前对 WebSocket 进行 JWT 鉴权. 失败 close 1008.

    Args:
        ws: WebSocket 连接
        token: 客户端通过 query 传入的 token (e.g. ?token=xxx)

    Returns:
        user_uuid (sub) 字符串, 或 None (鉴权失败)
    """
    user_uuid = authenticate_token(token)
    if not user_uuid:
        await ws.close(code=1008, reason="Authentication required")
        logger.warning(f"WS auth failed from {ws.client}")
        return None
    return user_uuid


class ConnectionManager:
    """单例 WebSocket 连接管理器 + Redis pub/sub 集群支持."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._connections: dict[str, WebSocket] = {}
        self._user_map: dict[str, set[str]] = defaultdict(set)
        self._room_map: dict[str, set[str]] = defaultdict(set)
        self._heartbeat: dict[str, float] = {}
        self._instance_id = f"ws-{id(self)}-{int(time.time())}"
        self._pubsub = None
        self._pubsub_task: asyncio.Task | None = None
        self._closed = False
        self._loop: asyncio.AbstractEventLoop | None = None
        # 连接信息 (连接时间、消息计数等)
        self._connection_info: dict[str, dict[str, Any]] = {}
        # 全局消息计数
        self._total_messages_sent: int = 0
        self._total_connections: int = 0
        self._peak_connections: int = 0
        # T1: Token TTL 跟踪 (conn_id -> jwt exp timestamp)
        self._token_exp: dict[str, float] = {}
        # T1: 后台 TTL 检查任务
        self._ttl_task: asyncio.Task | None = None
        # T1: 通知计数器 (供监控)
        # Bug-15: 心跳超时清理配置
        self._heartbeat_timeout: float = 60.0
        self._heartbeat_check_interval: float = 5.0
        self._refresh_notified_count: int = 0

    # -----------------------------------------------------------------
    # Redis pub/sub 启动 / 停止
    # -----------------------------------------------------------------

    def attach_loop(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def is_pubsub_running(self) -> bool:
        """当前 pubsub 后台任务是否在运行."""
        return self._pubsub_task is not None and not self._pubsub_task.done()

    def pubsub_status(self) -> dict:
        """返回 pubsub 状态摘要 (Bug-33 幂等)."""
        return {
            "running": self.is_pubsub_running(),
            "closed": self._closed,
            "reconnect_count": getattr(self, "_reconnect_count", 0),
            "start_count": getattr(self, "_start_count", 0),
            "instance_id": self._instance_id,
        }

    async def start_redis_subscriber(self):
        """启动后台任务监听 Redis 频道(跨实例广播)."""
        r = _get_redis()
        if r is None:
            logger.info("WS pub/sub disabled (no redis)")
            return
        try:
            self._pubsub = r.pubsub()
            self._pubsub.psubscribe("ws:broadcast:*")
            self._pubsub_task = asyncio.create_task(self._listen_redis())
            logger.info(f"WS pub/sub started: instance={self._instance_id}")
        except Exception as e:
            logger.warning(f"Start WS pub/sub failed: {e}")
            self._pubsub = None

    async def stop_redis_subscriber(self):
        self._closed = True
        if self._pubsub_task and not self._pubsub_task.done():
            self._pubsub_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self._pubsub_task
        if self._pubsub:
            with contextlib.suppress(Exception):
                self._pubsub.close()
        logger.info("WS pub/sub stopped")

    async def _reconnect_pubsub(self):
        """Bug-13: pub/sub 断开后重连. Redis 不可用时静默保留 _pubsub=None."""
        r = _get_redis()
        if r is None:
            self._pubsub = None
            return
        try:
            self._pubsub = r.pubsub()
            self._pubsub.psubscribe("ws:broadcast:*")
            # 启动监听任务 (如未在跑)
            if self._pubsub_task is None or self._pubsub_task.done():
                self._pubsub_task = asyncio.create_task(self._listen_redis())
            self._reconnect_count = getattr(self, "_reconnect_count", 0) + 1
        except Exception as e:
            logger.warning(f"WS pub/sub reconnect failed: {e}")
            self._pubsub = None

    async def _heartbeat_reaper(self):
        """Bug-15: 后台任务, 周期性清理心跳超时的连接."""
        while not self._closed:
            try:
                now = time.time()
                stale = [
                    cid for cid, last in self._heartbeat.items()
                    if now - last > self._heartbeat_timeout
                ]
                for cid in stale:
                    await self.disconnect(cid)
            except Exception as e:
                logger.warning(f"heartbeat reaper error: {e}")
            await asyncio.sleep(self._heartbeat_check_interval)

    async def _listen_redis(self):
        """Redis pub/sub 消息循环.

        get_message(timeout=...) 在 fakeredis / redis-py 是阻塞同步调用,
        直接 await 会卡住事件循环. 用 asyncio.to_thread 跑在 worker 线程.
        """
        while not self._closed:
            try:
                msg = await asyncio.to_thread(self._pubsub.get_message, timeout=0.5)
                if msg and msg.get("type") == "pmessage":
                    await self._on_pubsub_message(msg)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"WS pub/sub listen error: {e}")
                await asyncio.sleep(1)

    async def _on_pubsub_message(self, msg: dict):
        """处理一条 pub/sub 消息(避免回声给发送实例)."""
        try:
            data = json.loads(msg["data"])
        except Exception:
            return
        if data.get("_from") == self._instance_id:
            return
        target = data.get("target")
        payload = data.get("payload", {})
        if target == "room":
            await self.broadcast_room_local(data["room_id"], payload, exclude=data.get("from_conn"))
        elif target == "user":
            await self.send_to_user_local(data["user_uuid"], payload)
        elif target == "all":
            await self.broadcast_all_local(payload)

    async def _publish(self, channel_suffix: str, body: dict):
        """发布到 Redis(其他实例订阅后会触发本地广播)."""
        r = _get_redis()
        if r is None:
            return
        try:
            body["_from"] = self._instance_id
            r.publish(f"ws:broadcast:{channel_suffix}", json.dumps(body, ensure_ascii=False))
        except Exception as e:
            logger.warning(f"WS publish failed: {e}")

    # -----------------------------------------------------------------
    # 连接管理
    # -----------------------------------------------------------------

    async def connect(self, conn_id: str, ws: WebSocket, user_uuid: str = "", room_id: str = "", token_exp: float = 0) -> None:
        await ws.accept()
        self._connections[conn_id] = ws
        # 连接统计
        self._total_connections += 1
        current_count = len(self._connections)
        if current_count > self._peak_connections:
            self._peak_connections = current_count
        # 连接信息
        now = time.time()
        self._connection_info[conn_id] = {
            "connected_at": now,
            "last_activity": now,
            "message_count": 0,
            "user_uuid": user_uuid,
            "rooms": [room_id] if room_id else [],
        }
        if user_uuid:
            self._user_map[user_uuid].add(conn_id)
        if room_id:
            self._room_map[room_id].add(conn_id)
            self._heartbeat[conn_id] = now
        # T1: 记录 token 过期时间 (Unix timestamp)
        if token_exp > 0:
            self._token_exp[conn_id] = token_exp
        # T1: 首次连接启动 TTL 检查后台任务
        if self._ttl_task is None or self._ttl_task.done():
            with contextlib.suppress(RuntimeError):
                self._ttl_task = asyncio.create_task(self._ttl_watchdog_loop())
        logger.debug(f"WS connected: conn_id={conn_id} user={user_uuid} room={room_id} exp={token_exp}")

    async def disconnect(self, conn_id: str) -> None:
        ws = self._connections.pop(conn_id, None)
        self._heartbeat.pop(conn_id, None)
        self._connection_info.pop(conn_id, None)
        # T1: 清理 token 过期跟踪
        self._token_exp.pop(conn_id, None)
        for user_set in self._user_map.values():
            user_set.discard(conn_id)
        for room_set in self._room_map.values():
            room_set.discard(conn_id)
        if ws:
            with contextlib.suppress(Exception):
                await ws.close()
        logger.debug(f"WS disconnected: conn_id={conn_id}")

    # -----------------------------------------------------------------
    # T1: Token 过期跟踪 + 主动通知客户端 refresh
    # -----------------------------------------------------------------

    # 提前 60 秒通知客户端刷新
    WS_REFRESH_NOTICE_LEAD_SEC = 60
    # 过期后 5 秒强制关闭
    WS_EXPIRY_GRACE_SEC = 5
    # 后台检查周期 (秒)
    WS_TTL_CHECK_INTERVAL_SEC = 15

    async def _ttl_watchdog_loop(self):
        """T1 后台任务: 定期检查所有 WS 连接的 token 过期状态.

        - 即将过期 (剩余 < 60s): 推送 {type: 'token_refresh_notice', expires_at: ...}
        - 已过期 + 超过宽限 (5s): 主动关闭连接 (4401 + reason)
        """
        while not self._closed:
            try:
                now = time.time()
                expired = []
                notice = []
                for conn_id, exp in list(self._token_exp.items()):
                    remaining = exp - now
                    if remaining <= -self.WS_EXPIRY_GRACE_SEC:
                        expired.append(conn_id)
                    elif remaining <= self.WS_REFRESH_NOTICE_LEAD_SEC:
                        notice.append((conn_id, exp))
                # 1) 推通知
                for conn_id, exp in notice:
                    try:
                        await self.send_to(
                            conn_id,
                            {
                                "type": "token_refresh_notice",
                                "expires_at": exp,
                                "remaining_sec": max(0, exp - now),
                                "hint": "Use refresh_token to get new access_token and reconnect.",
                            },
                        )
                        self._refresh_notified_count += 1
                    except Exception as e:
                        logger.debug(f"WS refresh notice failed {conn_id}: {e}")
                # 2) 强制关闭过期连接
                for conn_id in expired:
                    logger.info(f"WS force close (token expired): conn_id={conn_id}")
                    try:
                        ws = self._connections.get(conn_id)
                        if ws:
                            await ws.close(
                                code=4401,
                                reason="Token expired, please refresh and reconnect",
                            )
                    except Exception:
                        pass
                    await self.disconnect(conn_id)
                await asyncio.sleep(self.WS_TTL_CHECK_INTERVAL_SEC)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"WS TTL watchdog error: {e}")
                await asyncio.sleep(self.WS_TTL_CHECK_INTERVAL_SEC)

    def heartbeat(self, conn_id: str) -> None:
        self._heartbeat[conn_id] = time.time()

    def alive_connections(self, timeout: int = 60) -> int:
        """超时未心跳的连接数(监控)."""
        now = time.time()
        return sum(1 for ts in self._heartbeat.values() if now - ts > timeout)

    # -----------------------------------------------------------------
    # 发送
    # -----------------------------------------------------------------

    async def send_to(self, conn_id: str, data: dict) -> bool:
        ws = self._connections.get(conn_id)
        if not ws:
            return False
        try:
            await ws.send_text(json.dumps(data, ensure_ascii=False))
            self._total_messages_sent += 1
            # 更新连接信息
            info = self._connection_info.get(conn_id)
            if info:
                info["last_activity"] = time.time()
                info["message_count"] += 1
            return True
        except Exception as e:
            logger.error(f"WS send error {conn_id}: {e}")
            await self.disconnect(conn_id)
            return False

    async def send_to_user(self, user_uuid: str, data: dict) -> int:
        """本地发送 + 跨实例 publish."""
        count = await self.send_to_user_local(user_uuid, data)
        await self._publish(
            f"user:{user_uuid}",
            {
                "target": "user",
                "user_uuid": user_uuid,
                "payload": data,
            },
        )
        return count

    async def send_to_user_local(self, user_uuid: str, data: dict) -> int:
        count = 0
        for conn_id in list(self._user_map.get(user_uuid, set())):
            if await self.send_to(conn_id, data):
                count += 1
        return count

    async def broadcast_room(self, room_id: str, data: dict, exclude: str = "") -> int:
        """本地广播 + 跨实例 publish."""
        count = await self.broadcast_room_local(room_id, data, exclude=exclude)
        await self._publish(
            f"room:{room_id}",
            {
                "target": "room",
                "room_id": room_id,
                "payload": data,
                "from_conn": exclude,
            },
        )
        return count

    async def broadcast_room_local(self, room_id: str, data: dict, exclude: str = "") -> int:
        count = 0
        for conn_id in list(self._room_map.get(room_id, set())):
            if conn_id == exclude:
                continue
            if await self.send_to(conn_id, data):
                count += 1
        return count

    async def broadcast_all(self, data: dict) -> int:
        count = await self.broadcast_all_local(data)
        await self._publish("all", {"target": "all", "payload": data})
        return count

    async def broadcast_all_local(self, data: dict) -> int:
        count = 0
        for conn_id in list(self._connections.keys()):
            if await self.send_to(conn_id, data):
                count += 1
        return count

    # -----------------------------------------------------------------
    # 订阅
    # -----------------------------------------------------------------

    def subscribe(self, conn_id: str, room_id: str) -> None:
        self._room_map[room_id].add(conn_id)
        self._heartbeat[conn_id] = time.time()

    def unsubscribe(self, conn_id: str, room_id: str) -> None:
        self._room_map[room_id].discard(conn_id)

    # -----------------------------------------------------------------
    # 状态
    # -----------------------------------------------------------------

    def stats(self) -> dict:
        # T1: 统计即将过期 / 已过期的连接数
        now = time.time()
        expiring = 0
        expired = 0
        for exp in self._token_exp.values():
            remaining = exp - now
            if remaining <= -self.WS_EXPIRY_GRACE_SEC:
                expired += 1
            elif remaining <= self.WS_REFRESH_NOTICE_LEAD_SEC:
                expiring += 1
        return {
            "total_connections": len(self._connections),
            "total_users": len(self._user_map),
            "total_rooms": len(self._room_map),
            "stale_heartbeats": self.alive_connections(),
            "instance_id": self._instance_id,
            "redis_pubsub_enabled": self._pubsub is not None,
            "total_connections_ever": self._total_connections,
            "peak_connections": self._peak_connections,
            "total_messages_sent": self._total_messages_sent,
            # T1: token TTL 监控
            "tokens_expiring_soon": expiring,
            "tokens_expired": expired,
            "refresh_notices_sent": self._refresh_notified_count,
        }


connection_manager = ConnectionManager()
