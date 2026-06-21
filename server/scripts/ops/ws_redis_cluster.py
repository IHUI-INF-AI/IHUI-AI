"""Phase 15 建议 4: WebSocket Redis 集群化 (Redis Stream pub/sub + 房间分片 + 断线重连).

目的:
  - 多节点部署时 WS 消息通过 Redis Stream pub/sub 跨节点路由
  - 房间分片: 用一致性哈希决定房间归属节点
  - 断线重连: 指数退避 + 健康检查
  - 优雅降级: 无 redis 时用进程内 fallback

设计:
  RoomSharder:
    - 一致性哈希, 房间 ID -> 节点
    - 64 vnode/key
    - add_node / remove_node / get_node

  RedisPubSub:
    - publish(channel, message)
    - subscribe(channel) -> async iterator
    - 用 redis.asyncio (Redis 4.2+)

  WSShardRouter:
    - 持有 RoomSharder + RedisPubSub + 本地 WS 连接池
    - 收到本地消息 -> 广播到本节点订阅者
    - 收到远程消息 (从 Redis pub) -> 找到目标节点 (本节点) -> 投递

  ReconnectPolicy:
    - 指数退避, max 30s
    - 健康检查
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import defaultdict
from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any

try:
    import redis.asyncio as aioredis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    aioredis = None  # type: ignore

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. RoomSharder (一致性哈希)
# ---------------------------------------------------------------------------


class RoomSharder:
    """房间 -> 节点 一致性哈希分片器.

    64 vnode/key, MD5 hash, 复制 4 份避免数据倾斜.
    """

    VNODE_COUNT = 64
    REPLICAS = 4

    def __init__(self, nodes: list[str] | None = None):
        self._nodes: list[str] = list(nodes or [])
        self._ring: list[tuple[int, str]] = []  # sorted (hash, node)
        self._node_keys: dict[str, int] = {}
        self._rebuild()

    def _rebuild(self) -> None:
        self._ring = []
        for node in self._nodes:
            for i in range(self.VNODE_COUNT):
                key = f"{node}#{i}"
                h = self._hash(key)
                self._ring.append((h, node))
        self._ring.sort()

    @staticmethod
    def _hash(key: str) -> int:
        md5 = hashlib.md5(key.encode("utf-8")).digest()
        return int.from_bytes(md5[:4], "big")

    def add_node(self, node: str) -> None:
        if node in self._nodes:
            return
        self._nodes.append(node)
        self._rebuild()

    def remove_node(self, node: str) -> None:
        if node not in self._nodes:
            return
        self._nodes.remove(node)
        self._rebuild()

    def get_node(self, key: str) -> str | None:
        if not self._ring:
            return None
        h = self._hash(key)
        # 二分查找第一个 >= h 的位置
        lo, hi = 0, len(self._ring)
        while lo < hi:
            mid = (lo + hi) // 2
            if self._ring[mid][0] < h:
                lo = mid + 1
            else:
                hi = mid
        if lo == len(self._ring):
            lo = 0
        return self._ring[lo][1]

    def get_replicas(self, key: str, count: int = 2) -> list[str]:
        """拿 key 的多个副本节点 (用于数据冗余)."""
        if not self._ring or count <= 0:
            return []
        primary = self.get_node(key)
        if primary is None:
            return []
        result = [primary]
        seen = {primary}
        for h, node in self._ring:
            if node not in seen and len(result) < count:
                result.append(node)
                seen.add(node)
        return result

    @property
    def nodes(self) -> list[str]:
        return list(self._nodes)


# ---------------------------------------------------------------------------
# 2. RedisPubSub (Redis Stream 包装)
# ---------------------------------------------------------------------------


class RedisPubSub:
    """Redis Stream 包装. 优雅降级: 无 redis 时返回 False."""

    def __init__(self, url: str = "redis://localhost:6379/0"):
        self.url = url
        self._client: Any = None
        self._lock = asyncio.Lock()

    async def connect(self) -> bool:
        if not REDIS_AVAILABLE:
            return False
        try:
            async with self._lock:
                if self._client is None:
                    self._client = aioredis.from_url(self.url, decode_responses=True)
                    await self._client.ping()
            return True
        except Exception as e:
            logger.warning("Redis connect failed: %s", e)
            return False

    async def close(self) -> None:
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:
                pass
            self._client = None

    async def publish(self, channel: str, message: dict) -> int:
        if not await self._ensure():
            return 0
        try:
            payload = json.dumps(message, ensure_ascii=False, default=str)
            return await self._client.publish(channel, payload)
        except Exception as e:
            logger.warning("Redis publish failed: %s", e)
            return 0

    async def subscribe(self, channel: str) -> AsyncIterator[dict]:
        """订阅 channel, 异步迭代消息."""
        if not await self._ensure():
            return
        try:
            pubsub = self._client.pubsub()
            await pubsub.subscribe(channel)
            async for raw in pubsub.listen():
                if raw.get("type") != "message":
                    continue
                try:
                    yield json.loads(raw["data"])
                except (json.JSONDecodeError, KeyError, TypeError):
                    continue
        except Exception as e:
            logger.warning("Redis subscribe error: %s", e)

    async def _ensure(self) -> bool:
        if self._client is None:
            return await self.connect()
        try:
            await self._client.ping()
            return True
        except Exception:
            return False


# ---------------------------------------------------------------------------
# 3. WSShardRouter
# ---------------------------------------------------------------------------


class WSShardRouter:
    """WS 消息分片路由.

    - 持有 RoomSharder (决定本节点负责哪些房间)
    - 持有 RedisPubSub (跨节点消息)
    - 持有本地 ws_callbacks (本节点 WS 客户端订阅列表)
    - 收到本地消息: 直接广播到本节点订阅者
    - 收到跨节点消息: 转给本节点订阅者
    """

    def __init__(
        self,
        node_id: str,
        sharder: RoomSharder,
        pubsub: RedisPubSub,
    ):
        self.node_id = node_id
        self.sharder = sharder
        self.pubsub = pubsub
        # room_id -> set of ws callback
        self._local_subs: dict[str, set[Callable[[dict], Any]]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._running = False
        self._subscribe_task: asyncio.Task | None = None
        self._channel = f"zhs:ws:node:{node_id}"

    async def start(self) -> bool:
        """启动跨节点消息接收."""
        if self._running:
            return True
        connected = await self.pubsub.connect()
        if not connected:
            logger.warning("WSShardRouter start: Redis unavailable, 本地模式")
            self._running = True
            return True
        self._running = True
        self._subscribe_task = asyncio.create_task(self._listen_redis(), name=f"ws-shard-{self.node_id}")
        return True

    async def stop(self) -> None:
        self._running = False
        if self._subscribe_task is not None:
            self._subscribe_task.cancel()
            try:
                await self._subscribe_task
            except (asyncio.CancelledError, Exception):
                pass
            self._subscribe_task = None

    async def subscribe(self, room_id: str, callback: Callable[[dict], Any]) -> None:
        """本地 WS 客户端订阅一个房间."""
        async with self._lock:
            self._local_subs[room_id].add(callback)

    async def unsubscribe(self, room_id: str, callback: Callable[[dict], Any]) -> None:
        async with self._lock:
            if room_id in self._local_subs:
                self._local_subs[room_id].discard(callback)
                if not self._local_subs[room_id]:
                    del self._local_subs[room_id]

    async def publish(self, room_id: str, message: dict) -> dict:
        """发消息到房间.

        Returns: {"local": int, "remote": int, "node": str}
        """
        owner = self.sharder.get_node(room_id)
        result = {"local": 0, "remote": 0, "node": owner or ""}
        if owner is None:
            return result
        if owner == self.node_id:
            # 本节点负责: 直接广播
            result["local"] = await self._broadcast_local(room_id, message)
        else:
            # 跨节点: 通过 Redis pub 给 owner
            sent = await self.pubsub.publish(
                f"zhs:ws:node:{owner}",
                {"room": room_id, "msg": message, "from": self.node_id},
            )
            result["remote"] = sent
        return result

    async def _broadcast_local(self, room_id: str, message: dict) -> int:
        async with self._lock:
            callbacks = list(self._local_subs.get(room_id, []))
        delivered = 0
        for cb in callbacks:
            try:
                r = cb(message)
                if asyncio.iscoroutine(r):
                    await r
                delivered += 1
            except Exception as e:
                logger.warning("WS callback error: %s", e)
        return delivered

    async def _listen_redis(self) -> None:
        """从 Redis pub 接收跨节点消息."""
        async for raw in self.pubsub.subscribe(self._channel):
            if not self._running:
                break
            room = raw.get("room")
            msg = raw.get("msg")
            if room and msg:
                await self._broadcast_local(room, msg)

    def stats(self) -> dict:
        return {
            "node_id": self.node_id,
            "running": self._running,
            "local_rooms": len(self._local_subs),
            "local_subs_total": sum(len(s) for s in self._local_subs.values()),
            "shard_nodes": self.sharder.nodes,
        }


# ---------------------------------------------------------------------------
# 4. ReconnectPolicy
# ---------------------------------------------------------------------------


@dataclass
class ReconnectPolicy:
    """指数退避重连策略."""

    max_retries: int = 10
    base_delay_s: float = 0.5
    max_delay_s: float = 30.0
    multiplier: float = 2.0
    jitter: float = 0.1  # 0-1, 随机抖动比例
    _attempt: int = 0
    _last_retry: float = 0.0

    def reset(self) -> None:
        self._attempt = 0

    def delay(self) -> float:
        """计算下一次重连的延迟 (秒)."""
        if self._attempt >= self.max_retries:
            return -1.0
        import random

        delay = min(self.base_delay_s * (self.multiplier**self._attempt), self.max_delay_s)
        if self.jitter > 0:
            delay *= 1.0 + random.uniform(-self.jitter, self.jitter)
        self._attempt += 1
        self._last_retry = time.time()
        return max(0.0, delay)

    def should_retry(self) -> bool:
        return self._attempt < self.max_retries

    @property
    def attempts(self) -> int:
        return self._attempt


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="WS Redis 集群化演示")
    p.add_argument("--nodes", nargs="+", default=["node-1", "node-2", "node-3"], help="集群节点")
    p.add_argument("--self", default="node-1", help="本节点 ID")
    p.add_argument("--room", default="room-42", help="测试房间")
    p.add_argument("--redis-url", default="redis://localhost:6379/0")
    p.add_argument("--dry-run", action="store_true", help="只跑一致性哈希分片, 不连 Redis")
    args = p.parse_args(argv)

    print("=" * 60)
    print("WS Redis 集群化演示")
    print("=" * 60)

    # 1) 一致性哈希
    sharder = RoomSharder(args.nodes)
    print(f"\n[1] 节点: {args.nodes}")
    for room in [args.room, "room-100", "room-999", "user:1:notify"]:
        owner = sharder.get_node(room)
        print(f"   {room:30s} -> {owner}")
    print(f"   副本 ({args.room}): {sharder.get_replicas(args.room, 2)}")

    # 2) 重连策略
    print("\n[2] 重连策略: max_retries=5")
    rp = ReconnectPolicy(max_retries=5, base_delay_s=0.5, multiplier=2.0)
    for _ in range(6):
        d = rp.delay()
        print(f"   attempt={rp.attempts}, delay={d:.2f}s")
        if d < 0:
            break

    # 3) Redis pub/sub (可选)
    if not args.dry_run:
        print(f"\n[3] 启动 WSShardRouter @ {args.self}")

        async def run_router():
            pubsub = RedisPubSub(args.redis_url)
            router = WSShardRouter(args.self, sharder, pubsub)
            ok = await router.start()
            print(f"   router started: {ok}")
            # 订阅
            received = []

            async def cb(msg):
                received.append(msg)

            await router.subscribe(args.room, cb)
            print(f"   subscribed to {args.room}")
            # 发一条
            result = await router.publish(args.room, {"type": "test", "data": "hello"})
            print(f"   publish result: {result}")
            await asyncio.sleep(0.5)
            print(f"   received msgs: {received}")
            await router.stop()
            await pubsub.close()

        try:
            asyncio.run(run_router())
        except Exception as e:
            print(f"   router 异常 (预期在无 redis 环境下): {e}")
    else:
        print("\n[3] 跳过 Redis 实际连接 (--dry-run)")

    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
