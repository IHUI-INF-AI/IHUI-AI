"""会话记忆存储(Redis 优先,无 Redis 时降级为内存)。

按 session_id 维护消息列表,支持追加、读取、清除、列出会话。
配置 redis_url 后优先使用 Redis 持久化,连接失败或未安装 redis 包时降级为内存。
"""

import json
from datetime import datetime
from typing import Any

from ..core.config import settings

# redis 包未安装时降级为纯内存模式
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  # type: ignore[assignment]


class MemoryStore:
    """会话记忆存储。优先用 Redis,降级为内存。"""

    def __init__(self) -> None:
        self._store: dict[str, list[dict[str, Any]]] = {}
        self._redis: Any = None
        self._use_redis = bool(settings.redis_url) and aioredis is not None

    async def _get_redis(self) -> Any:
        """获取 Redis 客户端,连接失败时降级为内存模式。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
                await self._redis.ping()
            except Exception:
                self._use_redis = False
                self._redis = None
        return self._redis

    async def add(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """向指定会话追加一条消息。"""
        msg = {
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat(),
        }
        redis = await self._get_redis()
        if redis:
            key = f"memory:{session_id}"
            await redis.rpush(key, json.dumps(msg, ensure_ascii=False))
        else:
            if session_id not in self._store:
                self._store[session_id] = []
            self._store[session_id].append(msg)

    async def get(self, session_id: str, limit: int = 100) -> list[dict[str, Any]]:
        """获取指定会话的消息(返回最近 limit 条)。"""
        redis = await self._get_redis()
        if redis:
            key = f"memory:{session_id}"
            raw = await redis.lrange(key, -limit, -1)
            return [json.loads(r) for r in raw]
        msgs = self._store.get(session_id, [])
        return msgs[-limit:] if limit < len(msgs) else msgs

    async def clear(self, session_id: str) -> None:
        """清除指定会话的全部消息。"""
        redis = await self._get_redis()
        if redis:
            await redis.delete(f"memory:{session_id}")
        else:
            self._store.pop(session_id, None)

    async def list_sessions(self) -> list[str]:
        """列出所有会话 ID。"""
        redis = await self._get_redis()
        if redis:
            keys = await redis.keys("memory:*")
            return [k.replace("memory:", "") for k in keys]
        return list(self._store.keys())


memory_store = MemoryStore()
