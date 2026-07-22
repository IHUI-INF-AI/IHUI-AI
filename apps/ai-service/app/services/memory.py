"""会话记忆存储(Redis 优先,无 Redis 时降级为内存)。

按 session_id 维护消息列表,支持追加、读取、清除、列出会话。
配置 redis_url 后优先使用 Redis 持久化,连接失败或未安装 redis 包时降级为内存。
"""

import json
import logging
import time
from datetime import datetime
from typing import Any

from ..core.config import settings

logger = logging.getLogger(__name__)

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


class UnifiedMemoryClient:
    """统一记忆客户端:对接 api /api/memory 路由,实现跨端记忆同步。

    Redis 优先(现有 memory_store 负责会话内消息),api 持久化兜底(跨端同步)。
    网络失败时降级(返回空/None,不抛错,不影响主流程)。
    """

    def __init__(self, api_base_url: str | None = None) -> None:
        self._api_base_url = api_base_url or settings.api_service_url

    async def get_entries(
        self,
        user_id: str,
        scope: str = "session",
        session_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """从 api 读取统一记忆条目。失败时返回空列表(降级,不抛错)。"""
        try:
            import httpx

            params: dict[str, str] = {"userId": user_id, "scope": scope}
            if session_id:
                params["sessionId"] = session_id
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self._api_base_url}/api/memory", params=params
                )
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, dict):
                    entries = data.get("data", [])
                    return entries if isinstance(entries, list) else []
            return []
        except Exception:
            return []

    async def add_entry(self, user_id: str, entry: dict[str, Any]) -> dict[str, Any] | None:
        """向 api 写入统一记忆条目。失败时返回 None(降级,不抛错)。"""
        try:
            import httpx

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self._api_base_url}/api/memory",
                    json={"userId": user_id, "entry": entry},
                )
                resp.raise_for_status()
                data = resp.json()
                if isinstance(data, dict):
                    return data.get("data")
                return data
        except Exception:
            return None


unified_memory_client = UnifiedMemoryClient()


# ============================================================================
# P3-1 深度层:MemorySystem — 整合 FTS5 全文 + 向量双引擎 + 自动提取 + 衰减遗忘 + 用户画像
# 对标 Hermes Agent 三大核心壁垒之一:记忆系统
# ============================================================================


class MemorySystem:
    """记忆系统深度层:整合三层架构。

    三层架构:
    - 存储层: MemoryStore(会话消息) + UnifiedMemoryClient(API 持久化) + VectorMemoryStore(向量)
    - 智能层: MemoryExtractor(自动提取) + MemoryDecayManager(衰减) + UserProfileBuilder(画像)
    - 检索层: fts5 关键词 + vector 向量 + hybrid 混合
    """

    def __init__(self) -> None:
        self._store = memory_store
        self._client = unified_memory_client
        # 深度层服务懒加载(避免循环导入)
        self._vector_store: Any = None
        self._extractor: Any = None
        self._decay_manager: Any = None
        self._profile_builder: Any = None

    def _ensure_services(self) -> None:
        """懒加载深度层服务(避免与 vector_memory/memory_extractor 等循环导入)。"""
        if self._vector_store is None:
            from .vector_memory import vector_memory
            self._vector_store = vector_memory
        if self._extractor is None:
            from .memory_extractor import MemoryExtractor
            self._extractor = MemoryExtractor()
        if self._decay_manager is None:
            from .memory_decay import MemoryDecayManager
            self._decay_manager = MemoryDecayManager()
        if self._profile_builder is None:
            from .user_profile import UserProfileBuilder
            self._profile_builder = UserProfileBuilder(memory_client=self._client)

    # ==================================================================
    # 写入 + 自动提取
    # ==================================================================

    async def add_with_extraction(
        self,
        user_id: str,
        messages: list[dict[str, str]],
        scope: str = "session",
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """写入消息 + 自动提取记忆 + 更新画像。

        流程:
        1. 写入会话消息到 MemoryStore
        2. 从对话中自动提取记忆(MemoryExtractor)
        3. 每条提取的记忆:生成 embedding → 写入 VectorMemoryStore + UnifiedMemoryClient
        4. 增量更新用户画像(UserProfileBuilder)

        Args:
            user_id:   用户 ID
            messages:  对话消息列表 [{role, content}]
            scope:     记忆作用域(session/project/user/global)
            session_id: 会话 ID(scope=session 时用)

        Returns:
            {extracted: [...], count: int, durationMs: int}
        """
        self._ensure_services()
        start = time.time()

        # 1. 写入会话消息
        sid = session_id or user_id
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                await self._store.add(sid, role, content)

        # 2. 获取已有记忆(用于去重)
        existing = await self._client.get_entries(user_id, scope="user")

        # 3. 自动提取记忆
        extraction_request = {
            "messages": messages,
            "userId": user_id,
            "sessionId": session_id,
            "existingEntries": existing,
        }
        extraction_result = await self._extractor.extract(extraction_request)
        extracted = extraction_result.get("extracted", [])

        # 4. 每条提取的记忆:生成 embedding + 写入向量存储 + API + 更新画像
        now = datetime.utcnow().isoformat()
        ts = int(time.time() * 1000)
        for idx, item in enumerate(extracted):
            entry_id = f"mem-{user_id}-{ts}-{idx}"
            entry = {
                "id": entry_id,
                "userId": user_id,
                "scope": scope,
                "type": item.get("type", "fact"),
                "category": item.get("category", "未分类"),
                "text": item.get("text", ""),
                "source": "ai-service",
                "createdAt": now,
                "updatedAt": now,
            }
            # 生成 embedding 并写入向量存储
            try:
                embedding = await self._vector_store.embed(item["text"])
                await self._vector_store.add_entry(entry_id, entry, embedding)
            except Exception:
                pass  # embedding 失败不阻塞,记忆仍写入 API
            # 写入 API(跨端同步)
            await self._client.add_entry(user_id, entry)
            # 增量更新画像
            try:
                await self._profile_builder.update_profile(user_id, entry)
            except Exception:
                pass

        duration_ms = int((time.time() - start) * 1000)
        return {
            "extracted": extracted,
            "count": len(extracted),
            "durationMs": duration_ms,
        }

    # ==================================================================
    # 混合检索
    # ==================================================================

    async def retrieve(self, request: dict[str, Any]) -> dict[str, Any]:
        """混合检索:fts5 + vector + hybrid。

        Args:
            request: MemoryRetrievalRequest 字典
                - userId:              用户 ID
                - query:               查询文本
                - engine:              检索引擎(fts5/vector/hybrid,默认 hybrid)
                - scope:               作用域过滤
                - topK:                返回条数(默认 10)
                - similarityThreshold: 相似度阈值(默认 0.7)
                - includeDecayed:      是否包含已衰减记忆(默认 false)

        Returns:
            MemoryRetrievalResponse 字典
                - items:      检索结果列表
                - total:      结果数
                - engine:     使用的引擎
                - durationMs: 检索耗时(ms)
        """
        self._ensure_services()
        start = time.time()

        engine = request.get("engine", "hybrid")
        query = request.get("query", "")
        user_id = request.get("userId", "")
        top_k = request.get("topK", 10)
        threshold = request.get("similarityThreshold", 0.7)
        include_decayed = request.get("includeDecayed", False)
        scope = request.get("scope", "user")

        # 从 API 获取用户记忆;api 不可用时降级从 VectorMemoryStore 拉取全部 entries
        entries = await self._client.get_entries(user_id, scope=scope)
        if not entries:
            # 纯本地模式:api 服务未启动 / 网络故障时,从向量存储拉取所有 entries
            # 过滤 userId + scope 匹配的条目(向量存储里 entry 含 userId/scope 字段)
            try:
                all_entries = self._vector_store.list_entries()
                entries = [
                    e for e in all_entries
                    if str(e.get("userId", "")) == user_id
                    and (scope == "user" or str(e.get("scope", "")) == scope)
                ]
                if entries:
                    logger.info(
                        "retrieve 降级纯本地模式:从 vector_store 拉取 %d 条 entries(user=%s)",
                        len(entries), user_id,
                    )
            except Exception as e:
                logger.warning("retrieve 降级拉取 vector_store 失败: %s", e)

        # 过滤已衰减记忆
        if not include_decayed:
            entries = [
                e for e in entries
                if not self._decay_manager.is_decayed(str(e.get("id", "")))
            ]

        items: list[dict[str, Any]] = []

        if engine == "fts5":
            items = self._fts5_search(query, entries, top_k)
        elif engine == "vector":
            items = await self._vector_search(query, top_k, threshold)
        else:  # hybrid
            items = await self._hybrid_search(query, entries, top_k, threshold)

        # 记录访问(用于衰减管理)
        for item in items:
            entry = item.get("entry", {})
            entry_id = str(entry.get("id", ""))
            if entry_id:
                self._decay_manager.record_access(entry_id)

        duration_ms = int((time.time() - start) * 1000)
        return {
            "items": items,
            "total": len(items),
            "engine": engine,
            "durationMs": duration_ms,
        }

    # ==================================================================
    # 用户画像
    # ==================================================================

    async def get_user_profile(self, user_id: str) -> dict[str, Any]:
        """获取用户画像(委托 UserProfileBuilder)。"""
        self._ensure_services()
        return await self._profile_builder.build_profile(user_id)

    # ==================================================================
    # 衰减管理
    # ==================================================================

    async def apply_decay(
        self,
        user_id: str,
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """应用记忆衰减(委托 MemoryDecayManager)。

        Returns:
            {"updated": N, "decayed": M}
        """
        self._ensure_services()
        decay_config = config or {
            "strategy": "combined",
            "halfLifeDays": 30,
            "minRetentionScore": 0.2,
            "accessBoost": 0.1,
        }
        return await self._decay_manager.apply_decay(
            user_id, decay_config, self._client,
        )

    # ==================================================================
    # 检索引擎(内部方法)
    # ==================================================================

    @staticmethod
    def _fts5_search(
        query: str,
        entries: list[dict[str, Any]],
        top_k: int,
    ) -> list[dict[str, Any]]:
        """FTS5 全文检索(降级:简单关键词匹配,无 SQLite FTS5 依赖)。

        用空格分词,计算命中关键词数 / 总词数作为 rank。
        """
        query_lower = query.lower()
        query_words = set(query_lower.split())
        if not query_words:
            return []

        scored: list[tuple[float, dict[str, Any]]] = []
        for entry in entries:
            text = str(entry.get("text", "")).lower()
            if not text:
                continue
            hits = sum(1 for w in query_words if w in text)
            if hits > 0:
                rank = hits / max(len(query_words), 1)
                scored.append((rank, entry))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {"entry": e, "ftsRank": round(r, 4), "matchedBy": "fts5"}
            for r, e in scored[:top_k]
        ]

    async def _vector_search(
        self,
        query: str,
        top_k: int,
        threshold: float,
    ) -> list[dict[str, Any]]:
        """向量检索:调 vector_store.search(query_embedding=...)。"""
        query_embedding = await self._vector_store.embed(query)
        results = await self._vector_store.search(
            query_embedding, top_k=top_k, threshold=threshold,
        )
        items: list[dict[str, Any]] = []
        # results 为 list[tuple[str, dict, float]](entry_id, entry, similarity)
        for entry_id, entry, score in results:
            items.append({
                "entry": entry,
                "similarity": round(float(score), 4),
                "matchedBy": "vector",
            })
        return items

    async def _hybrid_search(
        self,
        query: str,
        entries: list[dict[str, Any]],
        top_k: int,
        threshold: float,
    ) -> list[dict[str, Any]]:
        """混合检索:fts5 + vector 并行,合并结果按 combinedScore 排序。

        combinedScore = 0.5 * ftsRank + 0.5 * similarity
        以 entry id 去重(fts5 和 vector 可能命中同一条)。
        """
        # fts5 同步且快速,直接调用
        fts_results = self._fts5_search(query, entries, top_k)
        # vector 异步,await
        vec_results = await self._vector_search(query, top_k, threshold)

        # 合并(以 entry id 去重)
        merged: dict[str, dict[str, Any]] = {}

        for item in fts_results:
            entry = item.get("entry", {})
            eid = str(entry.get("id", ""))
            if eid:
                fts_rank = item.get("ftsRank", 0.0)
                merged[eid] = {
                    "entry": entry,
                    "ftsRank": fts_rank,
                    "similarity": 0.0,
                    "combinedScore": fts_rank * 0.5,
                    "matchedBy": "hybrid",
                }

        for item in vec_results:
            entry = item.get("entry", {})
            eid = str(entry.get("id", ""))
            if not eid:
                continue
            sim = item.get("similarity", 0.0)
            if eid in merged:
                # 已在 fts 结果中:合并分数
                merged[eid]["similarity"] = sim
                merged[eid]["combinedScore"] = (
                    merged[eid].get("ftsRank", 0.0) * 0.5 + sim * 0.5
                )
            else:
                merged[eid] = {
                    "entry": entry,
                    "ftsRank": 0.0,
                    "similarity": sim,
                    "combinedScore": sim * 0.5,
                    "matchedBy": "hybrid",
                }

        # 按 combinedScore 降序
        sorted_items = sorted(
            merged.values(),
            key=lambda x: x.get("combinedScore", 0.0),
            reverse=True,
        )
        return sorted_items[:top_k]


# 全局单例
memory_system = MemorySystem()
