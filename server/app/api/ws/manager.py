"""WebSocket connection manager.

支持两种模式:
  1. 本地模式 (默认): 单进程内存广播
  2. 集群模式 (USE_REDIS_PUBSUB=true): 通过 Redis Pub/Sub 跨进程广播
"""

import asyncio
import contextlib
import json
import logging
import os

from fastapi import WebSocket

logger = logging.getLogger(__name__)

USE_REDIS_PUBSUB = os.getenv("USE_REDIS_PUBSUB", "false").lower() in ("true", "1", "yes")
REDIS_CHANNEL_PREFIX = os.getenv("REDIS_WS_CHANNEL_PREFIX", "zhs:ws:")


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, set[WebSocket]] = {}
        self._redis_task: asyncio.Task | None = None
        self._redis_client = None
        self._stop_event: asyncio.Event | None = None

    async def connect(self, websocket: WebSocket, room: str = "default"):
        await websocket.accept()
        if room not in self.active_connections:
            self.active_connections[room] = set()
        self.active_connections[room].add(websocket)
        logger.info(f"WS connected to room={room}, total={len(self.active_connections[room])}")
        # 启动 Redis 订阅监听 (仅启动一次)
        if USE_REDIS_PUBSUB and self._redis_task is None:
            await self._start_redis_subscriber()

    def disconnect(self, websocket: WebSocket, room: str = "default"):
        if room in self.active_connections:
            self.active_connections[room].discard(websocket)
            if not self.active_connections[room]:
                del self.active_connections[room]
        logger.info(f"WS disconnected from room={room}")

    async def send_personal(self, websocket: WebSocket, message: dict):
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.warning(f"WS send_personal failed: {e}")

    async def broadcast(self, room: str, message: dict):
        """广播消息 - 本地内存 + Redis Pub/Sub 跨进程"""
        # 本地广播
        if room in self.active_connections:
            dead = set()
            for ws in self.active_connections[room]:
                try:
                    await ws.send_json(message)
                except Exception:
                    dead.add(ws)
            for ws in dead:
                self.active_connections[room].discard(ws)
        # 跨进程广播
        if USE_REDIS_PUBSUB:
            await self._publish_to_redis(room, message)

    async def send_to_user(self, user_uuid: str, message: dict):
        room = f"user:{user_uuid}"
        await self.broadcast(room, message)

    def get_room_count(self, room: str) -> int:
        return len(self.active_connections.get(room, set()))

    def get_all_rooms(self) -> dict:
        return {room: len(conns) for room, conns in self.active_connections.items()}

    # ---------- Redis Pub/Sub 跨进程广播 ----------
    async def _start_redis_subscriber(self):
        """启动 Redis 订阅任务, 用于接收其他进程广播的消息"""
        if self._redis_task is not None:
            return
        self._stop_event = asyncio.Event()
        self._redis_task = asyncio.create_task(self._redis_subscriber_loop())
        logger.info("[WS Cluster] Redis subscriber started")

    async def _redis_subscriber_loop(self):
        """订阅所有房间, 收到消息后转发到本地连接"""
        try:
            from app.utils.redis_util import get_redis

            client = get_redis()
            pubsub = client.pubsub()
            await asyncio.to_thread(pubsub.psubscribe, f"{REDIS_CHANNEL_PREFIX}*")
            logger.info(f"[WS Cluster] Subscribed to {REDIS_CHANNEL_PREFIX}*")
            while not self._stop_event.is_set():
                msg = await asyncio.to_thread(pubsub.get_message, True, 1.0)
                if msg is None:
                    await asyncio.sleep(0.05)
                    continue
                channel = msg.get("channel", "")
                if isinstance(channel, bytes):
                    channel = channel.decode("utf-8")
                data = msg.get("data")
                if isinstance(data, bytes):
                    data = data.decode("utf-8")
                # 提取房间名
                room = channel.replace(REDIS_CHANNEL_PREFIX, "", 1)
                try:
                    payload = json.loads(data)
                except Exception:
                    payload = {"text": data}
                # 转发到本地
                if room in self.active_connections:
                    dead = set()
                    for ws in self.active_connections[room]:
                        try:
                            await ws.send_json(payload)
                        except Exception:
                            dead.add(ws)
                    for ws in dead:
                        self.active_connections[room].discard(ws)
        except Exception as e:
            logger.error(f"[WS Cluster] Subscriber error: {e}")
        finally:
            self._redis_task = None

    async def _publish_to_redis(self, room: str, message: dict):
        """发布消息到 Redis"""
        try:
            from app.utils.redis_util import get_redis

            client = get_redis()
            channel = f"{REDIS_CHANNEL_PREFIX}{room}"
            await asyncio.to_thread(client.publish, channel, json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.warning(f"[WS Cluster] Publish failed: {e}")

    async def shutdown(self):
        """关闭时清理"""
        if self._stop_event:
            self._stop_event.set()
        if self._redis_task:
            self._redis_task.cancel()
            with contextlib.suppress(Exception):
                await self._redis_task


manager = ConnectionManager()
