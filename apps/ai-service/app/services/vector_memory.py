"""向量记忆存储(Redis 优先,无 Redis 时降级为内存)。

在 MemoryStore 基础上增加向量嵌入支持,实现跨会话语义搜索:
- add 时生成嵌入向量并存储
- search 时用余弦相似度检索最相关的 N 条记忆
- 持久化模式: Redis 优先(进程重启不丢),无 Redis 时降级为内存

启动流程:
  1. 构造 VectorMemoryStore()(全局单例)
  2. lifespan 启动时调 await vector_memory.hydrate(): 从 Redis 加载历史 entries
  3. 后续 add 同时写内存 + flush Redis;search / get_all 走内存(Redis 仅做持久化)

降级契约:
  - redis 包未安装 → 纯内存模式(同旧行为)
  - REDIS_URL 未配置 → 纯内存模式
  - 启动时 _get_redis 连接失败 → 标记 _use_redis = False,后续按内存模式运行
  - flush 失败静默 → 内存已写入,只是 Redis 没同步,下次启动可能少几条(可接受)

用法:
    store = VectorMemoryStore()
    await store.hydrate()
    await store.add("session-1", "user", "如何配置 Redis?")
    results = await store.search("Redis 配置方法", top_k=5)
"""

import json
import math
from datetime import datetime
from typing import Any

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

# redis 包未安装时降级为纯内存模式
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  # type: ignore[assignment]

# Redis key 前缀(避免与其他模块冲突)
_REDIS_KEY_IDS = "vec:memory:ids"
_REDIS_KEY_ENTRY_PREFIX = "vec:memory:entry:"


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度。"""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class VectorMemoryStore:
    """向量记忆存储,支持语义检索 + Redis 持久化。"""

    # sentinel:区分"调用方未传 redis_url"和"显式传 None(强制纯内存)"
    _REDIS_URL_UNSET: Any = object()

    def __init__(
        self,
        gateway: Any = None,
        redis_url: Any = _REDIS_URL_UNSET,
    ) -> None:
        self._gateway = gateway or llm_gateway
        self._store: list[dict[str, Any]] = []
        self._redis: Any = None
        # 三态:
        # - 不传(默认 UNSET)  → 用 settings.redis_url(正常持久化模式)
        # - 显式传 None       → 强制纯内存(测试 / 临时禁用)
        # - 传字符串          → 用该 URL
        if redis_url is self._REDIS_URL_UNSET:
            self._redis_url: str | None = settings.redis_url
        elif redis_url is None:
            self._redis_url = None
        else:
            self._redis_url = str(redis_url)
        self._use_redis = bool(self._redis_url) and aioredis is not None
        # 自增 id(Redis 重启后从 max(id)+1 续上,避免与历史 entry 冲突)
        self._next_id: int = 1

    async def _get_redis(self) -> Any:
        """获取 Redis 客户端,连接失败时降级为内存模式(仅切换一次,避免反复连接)。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
                await self._redis.ping()
            except Exception:
                self._use_redis = False
                self._redis = None
        return self._redis

    @staticmethod
    def _serialize_entry(entry: dict[str, Any]) -> str:
        """把内存 entry 序列化为 JSON(embedding list → JSON array)。"""
        return json.dumps(entry, ensure_ascii=False, default=str)

    @staticmethod
    def _deserialize_entry(raw: str) -> dict[str, Any] | None:
        """从 JSON 反序列化 entry,字段缺失或类型错误时返回 None。"""
        try:
            obj = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        if not isinstance(obj, dict) or "id" not in obj or "embedding" not in obj:
            return None
        if not isinstance(obj["embedding"], list):
            return None
        return obj

    async def hydrate(self) -> int:
        """启动时从 Redis 加载全部历史 entry 到内存缓存。

        Returns:
            成功加载的 entry 数(失败/无 Redis 时返回 0,降级为纯内存模式)。
        """
        redis = await self._get_redis()
        if redis is None:
            return 0
        try:
            ids = await redis.smembers(_REDIS_KEY_IDS)
            if not ids:
                return 0
            # 批量取 entry(避免 n 次 round-trip)
            keys = [_REDIS_KEY_ENTRY_PREFIX + str(i) for i in ids]
            raws = await redis.mget(keys)
            loaded: list[dict[str, Any]] = []
            max_id = 0
            for raw in raws:
                entry = self._deserialize_entry(raw) if raw else None
                if entry is None:
                    continue
                loaded.append(entry)
                if entry["id"] > max_id:
                    max_id = entry["id"]
            # 按 id 升序,保证 search 顺序稳定
            loaded.sort(key=lambda e: e["id"])
            self._store = loaded
            self._next_id = max_id + 1
            return len(loaded)
        except Exception:
            # 加载失败不阻塞启动,降级为纯内存
            self._use_redis = False
            self._redis = None
            return 0

    async def _flush_entry(self, entry: dict[str, Any]) -> None:
        """把单条 entry 同步写入 Redis(失败静默降级,内存已写入,Redis 可能少)。"""
        redis = await self._get_redis()
        if redis is None:
            return
        try:
            eid = str(entry["id"])
            pipe = redis.pipeline()
            pipe.sadd(_REDIS_KEY_IDS, eid)
            pipe.set(_REDIS_KEY_ENTRY_PREFIX + eid, self._serialize_entry(entry))
            await pipe.execute()
        except Exception:
            pass

    async def _flush_delete(self, entry_id: int) -> None:
        """从 Redis 删单条 entry(失败静默降级)。"""
        redis = await self._get_redis()
        if redis is None:
            return
        try:
            eid = str(entry_id)
            pipe = redis.pipeline()
            pipe.srem(_REDIS_KEY_IDS, eid)
            pipe.delete(_REDIS_KEY_ENTRY_PREFIX + eid)
            await pipe.execute()
        except Exception:
            pass

    async def _flush_clear_all(self) -> None:
        """清空 Redis 全部 vec:memory:* key(失败静默降级)。"""
        redis = await self._get_redis()
        if redis is None:
            return
        try:
            ids = await redis.smembers(_REDIS_KEY_IDS)
            if not ids:
                return
            keys = [_REDIS_KEY_ENTRY_PREFIX + str(i) for i in ids] + [_REDIS_KEY_IDS]
            await redis.delete(*keys)
        except Exception:
            pass

    async def add(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """追加消息并生成嵌入向量,同步 flush 到 Redis(若可用)。"""
        embedding = await self._gateway.embed(content)
        entry: dict[str, Any] = {
            "id": self._next_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "embedding": embedding,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._next_id += 1
        self._store.append(entry)
        # 同步落盘(失败静默降级,内存写入不受影响)
        await self._flush_entry(entry)

    async def search(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """语义搜索相关记忆(走内存,Redis 仅做持久化层)。

        Args:
            query: 查询文本。
            top_k: 返回最相关的 N 条。
            session_id: 限定在指定会话内搜索,None 则跨所有会话。

        Returns:
            排序后的记忆列表(不含 embedding),每条含 id / score 字段。
        """
        if not self._store:
            return []

        query_embedding = await self._gateway.embed(query)

        scored: list[tuple[float, dict[str, Any]]] = []
        for entry in self._store:
            if session_id and entry["session_id"] != session_id:
                continue
            score = _cosine_similarity(query_embedding, entry["embedding"])
            scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)

        results: list[dict[str, Any]] = []
        for score, entry in scored[:top_k]:
            results.append({
                "id": entry["id"],
                "session_id": entry["session_id"],
                "role": entry["role"],
                "content": entry["content"],
                "metadata": entry["metadata"],
                "timestamp": entry["timestamp"],
                "score": round(score, 4),
            })
        return results

    def get_all(self, session_id: str | None = None) -> list[dict[str, Any]]:
        """获取所有记忆(不含 embedding)。"""
        result = []
        for entry in self._store:
            if session_id and entry["session_id"] != session_id:
                continue
            result.append({
                "id": entry["id"],
                "session_id": entry["session_id"],
                "role": entry["role"],
                "content": entry["content"],
                "metadata": entry["metadata"],
                "timestamp": entry["timestamp"],
            })
        return result

    def clear(self, session_id: str | None = None) -> None:
        """清除记忆(同步 API,内部 fire-and-forget 同步刷 Redis,失败静默降级)。

        设计选择:保持同步 API 与旧版本一致,避免破坏既有测试;
        Redis 刷新用 asyncio.create_task 后台跑,不阻塞调用方。
        """
        import asyncio

        if session_id is None:
            self._store.clear()
            self._next_id = 1
            asyncio.create_task(self._flush_clear_all())
        else:
            removed_ids = [e["id"] for e in self._store if e["session_id"] == session_id]
            self._store = [e for e in self._store if e["session_id"] != session_id]
            for eid in removed_ids:
                asyncio.create_task(self._flush_delete(eid))

    def count(self, session_id: str | None = None) -> int:
        """返回记忆条数。"""
        if session_id is None:
            return len(self._store)
        return sum(1 for e in self._store if e["session_id"] == session_id)


# 全局单例
vector_memory = VectorMemoryStore()
