"""四层记忆服务(对标 OpenClaw Mem 系统)。

四层架构:
1. working_memory    — 当前会话消息缓冲(内存 dict[session_id] -> OrderedDict,LRU 上限 50 条)
2. episodic_memory   — 历史会话片段(PostgreSQL agent_memory_episodic 表,支持遗忘曲线衰减)
3. semantic_memory   — 向量检索知识(PostgreSQL agent_memory_semantic + pgvector 1536 维)
4. procedural_memory — 技能/工具用法模式(PostgreSQL agent_memory_procedural,success/failure 计数)

特性:
- 重要性评分(0-1):user_explicit_feedback / tool_success_rate / access_frequency / recency 综合
- 向量语义检索:recall() 用 query embedding cosine similarity 检索 semantic_memory
- 遗忘曲线:decay_factor *= 0.95^(days_since_access)(由 DreamService.forget 触发)

DB 访问复用 asyncpg 连接池(与 llm_gateway._pool 独立,避免互相影响)。
LLM/embedding 调用复用 llm_gateway 单例。
"""

from __future__ import annotations

import asyncio
import json
import math
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

# 全局连接池(与 llm_gateway._pool 独立,避免互相影响)
_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


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


def _compute_importance(
    *,
    user_feedback: float = 0.5,
    tool_success_rate: float = 0.5,
    access_frequency: int = 0,
    recency_days: float = 0.0,
) -> float:
    """综合计算重要性评分(0-1)。

    权重:
    - user_explicit_feedback: 0.35(用户显式反馈最权威)
    - tool_success_rate: 0.25(工具调用成功率)
    - access_frequency: 0.20(访问频次,对数压缩避免长尾主导)
    - recency: 0.20(时间近度,越近越重要)
    """
    freq_score = min(1.0, math.log1p(max(0, access_frequency)) / 5.0)
    recency_score = math.exp(-recency_days / 30.0)  # 30 天半衰期
    score = (
        0.35 * max(0.0, min(1.0, user_feedback))
        + 0.25 * max(0.0, min(1.0, tool_success_rate))
        + 0.20 * freq_score
        + 0.20 * recency_score
    )
    return max(0.0, min(1.0, score))


def _parse_pgvector_text(text_val: str | None) -> list[float]:
    """把 pgvector 文本表示 '[0.1,0.2,...]' 解析回 list[float]。"""
    if not text_val:
        return []
    trimmed = text_val.strip().lstrip("[").rstrip("]")
    if not trimmed:
        return []
    try:
        return [float(x) for x in trimmed.split(",")]
    except (ValueError, TypeError):
        return []


def _parse_jsonb(raw: Any) -> dict[str, Any]:
    """解析 jsonb 字段(asyncpg 默认返回 str,需 json.loads)。"""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}
    return {}


class MemoryService:
    """四层记忆服务。

    working memory 在内存(dict[session_id] -> OrderedDict),其余三层在 PostgreSQL。
    """

    # working memory LRU 上限
    WORKING_LRU_LIMIT = 50

    def __init__(self, gateway: Any = None) -> None:
        self._gateway = gateway or llm_gateway
        # working memory: session_id -> OrderedDict(msg_id -> msg),LRU 顺序
        self._working: dict[str, OrderedDict[str, dict[str, Any]]] = {}
        self._working_lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # working memory(内存层)
    # ------------------------------------------------------------------

    async def add_working(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """向 working memory 追加一条消息(LRU 上限 50,超出丢弃最旧)。"""
        msg_id = f"{session_id}:{datetime.now(timezone.utc).timestamp()}"
        msg = {
            "id": msg_id,
            "layer": "working",
            "sessionId": session_id,
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        async with self._working_lock:
            bucket = self._working.setdefault(session_id, OrderedDict())
            bucket[msg_id] = msg
            while len(bucket) > self.WORKING_LRU_LIMIT:
                bucket.popitem(last=False)  # 弹出最旧
        return msg

    async def get_working(self, session_id: str, limit: int = 50) -> list[dict[str, Any]]:
        """读取 working memory 最近 limit 条消息。"""
        async with self._working_lock:
            bucket = self._working.get(session_id)
            if not bucket:
                return []
            items = list(bucket.values())
        return items[-limit:] if limit < len(items) else items

    async def clear_working(self, session_id: str) -> int:
        """清空指定 session 的 working memory,返回清除条数。"""
        async with self._working_lock:
            bucket = self._working.pop(session_id, None)
            return len(bucket) if bucket else 0

    # ------------------------------------------------------------------
    # episodic memory(历史会话片段,PostgreSQL)
    # ------------------------------------------------------------------

    async def add_episodic(
        self,
        user_id: str,
        session_id: str,
        content: str,
        summary: str | None = None,
        importance_score: float = 0.5,
        metadata: dict[str, Any] | None = None,
        expires_at: datetime | None = None,
    ) -> dict[str, Any]:
        """保存一条情景记忆。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO agent_memory_episodic
                   (session_id, user_id, content, summary, importance_score, metadata, expires_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)
                   RETURNING id, session_id, user_id, content, summary,
                             importance_score::text, decay_factor::text,
                             metadata::text, created_at, expires_at, last_accessed_at""",
                session_id,
                user_id,
                content,
                summary,
                importance_score,
                json.dumps(metadata or {}, ensure_ascii=False),
                expires_at,
            )
        return self._row_to_episodic(row)

    async def list_episodic(
        self,
        user_id: str,
        session_id: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """列出情景记忆(可按 session 过滤,按创建时间倒序)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            if session_id:
                rows = await conn.fetch(
                    """SELECT id, session_id, user_id, content, summary,
                              importance_score::text, decay_factor::text,
                              metadata::text, created_at, expires_at, last_accessed_at
                       FROM agent_memory_episodic
                       WHERE user_id = $1 AND session_id = $2
                       ORDER BY created_at DESC LIMIT $3""",
                    user_id,
                    session_id,
                    limit,
                )
            else:
                rows = await conn.fetch(
                    """SELECT id, session_id, user_id, content, summary,
                              importance_score::text, decay_factor::text,
                              metadata::text, created_at, expires_at, last_accessed_at
                       FROM agent_memory_episodic
                       WHERE user_id = $1
                       ORDER BY created_at DESC LIMIT $2""",
                    user_id,
                    limit,
                )
        return [self._row_to_episodic(r) for r in rows]

    async def update_episodic_decay(
        self,
        memory_id: str,
        decay_factor: float,
        importance_score: float | None = None,
    ) -> None:
        """更新情景记忆的衰减因子(由 DreamService.forget 调用)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            if importance_score is not None:
                await conn.execute(
                    """UPDATE agent_memory_episodic
                       SET decay_factor = $1, importance_score = $2,
                           last_accessed_at = NOW()
                       WHERE id = $3""",
                    decay_factor,
                    importance_score,
                    memory_id,
                )
            else:
                await conn.execute(
                    """UPDATE agent_memory_episodic
                       SET decay_factor = $1, last_accessed_at = NOW()
                       WHERE id = $2""",
                    decay_factor,
                    memory_id,
                )

    async def mark_episodic_consolidated(self, memory_id: str) -> None:
        """标记情景记忆已固化(metadata.consolidated = True)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE agent_memory_episodic
                   SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"consolidated": true}'::jsonb
                   WHERE id = $1""",
                memory_id,
            )

    async def delete_episodic(self, memory_id: str) -> None:
        """删除一条情景记忆(由 DreamService.forget 调用)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM agent_memory_episodic WHERE id = $1",
                memory_id,
            )

    # ------------------------------------------------------------------
    # semantic memory(向量检索知识,pgvector)
    # ------------------------------------------------------------------

    async def add_semantic(
        self,
        user_id: str,
        content: str,
        importance_score: float = 0.5,
        metadata: dict[str, Any] | None = None,
        embedding: list[float] | None = None,
    ) -> dict[str, Any]:
        """保存一条语义记忆(若未提供 embedding 则调用 gateway.embed 生成)。

        embedding 长度必须为 1536(与 pgvector vector(1536) 一致)。
        """
        if embedding is None:
            embedding = await self._gateway.embed(content)
        if len(embedding) != 1536:
            raise ValueError(
                f"embedding 维度必须为 1536,实际 {len(embedding)}"
                "(请用 text-embedding-ada-002 或同维度模型)"
            )
        # pgvector 接受 '[0.1,0.2,...]' 字符串
        embedding_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO agent_memory_semantic
                   (user_id, content, embedding, importance_score, metadata)
                   VALUES ($1, $2, $3::vector, $4, $5)
                   RETURNING id, user_id, content,
                             importance_score::text, metadata::text,
                             created_at, last_accessed_at""",
                user_id,
                content,
                embedding_str,
                importance_score,
                json.dumps(metadata or {}, ensure_ascii=False),
            )
        return self._row_to_semantic(row)

    async def recall(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """语义检索:用 query embedding 的 cosine similarity 检索 semantic_memory。

        优先用 pgvector 原生 `<=>` 距离运算符,SQL 失败(无 pgvector 扩展)时降级为内存计算。

        Returns:
            排序后的记忆列表,每条含 entry 字段(不含 embedding)+ score 字段(0-1,越接近 1 越相关)。
        """
        query_embedding = await self._gateway.embed(query)
        pool = await _get_pool()
        try:
            async with pool.acquire() as conn:
                query_str = "[" + ",".join(str(float(x)) for x in query_embedding) + "]"
                rows = await conn.fetch(
                    """SELECT id, user_id, content,
                              importance_score::text, metadata::text,
                              created_at, last_accessed_at,
                              1 - (embedding <=> $1::vector) AS score
                       FROM agent_memory_semantic
                       WHERE user_id = $2 AND embedding IS NOT NULL
                       ORDER BY embedding <=> $1::vector
                       LIMIT $3""",
                    query_str,
                    user_id,
                    top_k,
                )
            results: list[dict[str, Any]] = []
            for r in rows:
                entry = self._row_to_semantic(r)
                score = float(r["score"]) if r["score"] is not None else 0.0
                results.append({"entry": entry, "score": round(score, 4)})
            return results
        except Exception:
            # 降级:取出全部条目内存计算 cosine
            return await self._recall_fallback(user_id, query_embedding, top_k)

    async def _recall_fallback(
        self,
        user_id: str,
        query_embedding: list[float],
        top_k: int,
    ) -> list[dict[str, Any]]:
        """降级路径:无 pgvector 扩展或 SQL 失败时,内存计算 cosine similarity。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, user_id, content,
                          importance_score::text, metadata::text,
                          created_at, last_accessed_at,
                          embedding::text
                   FROM agent_memory_semantic
                   WHERE user_id = $1 AND embedding IS NOT NULL""",
                user_id,
            )
        scored: list[tuple[float, dict[str, Any]]] = []
        for r in rows:
            entry = self._row_to_semantic(r)
            emb = _parse_pgvector_text(r["embedding"])
            score = _cosine_similarity(query_embedding, emb)
            scored.append((score, entry))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [{"entry": e, "score": round(s, 4)} for s, e in scored[:top_k]]

    async def list_semantic(
        self,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """列出语义记忆(不含 embedding,按创建时间倒序)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, user_id, content,
                          importance_score::text, metadata::text,
                          created_at, last_accessed_at
                   FROM agent_memory_semantic
                   WHERE user_id = $1
                   ORDER BY created_at DESC LIMIT $2""",
                user_id,
                limit,
            )
        return [self._row_to_semantic(r) for r in rows]

    # ------------------------------------------------------------------
    # procedural memory(技能/工具用法模式)
    # ------------------------------------------------------------------

    async def add_procedural(
        self,
        user_id: str,
        pattern: str,
        tool_name: str | None = None,
        success: bool = True,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """记录一条工具用法模式(已存在则累加 success/failure 计数)。

        依赖 (user_id, pattern, tool_name) 唯一约束做 upsert。
        """
        pool = await _get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """INSERT INTO agent_memory_procedural
                       (user_id, pattern, tool_name, success_count, failure_count, metadata)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (user_id, pattern, tool_name)
                   DO UPDATE SET
                       success_count = agent_memory_procedural.success_count
                           + EXCLUDED.success_count,
                       failure_count = agent_memory_procedural.failure_count
                           + EXCLUDED.failure_count,
                       last_used_at = NOW(),
                       updated_at = NOW()
                   RETURNING id, user_id, pattern, tool_name,
                             success_count, failure_count,
                             importance_score::text, metadata::text,
                             last_used_at, created_at, updated_at""",
                user_id,
                pattern,
                tool_name or "",
                1 if success else 0,
                0 if success else 1,
                json.dumps(metadata or {}, ensure_ascii=False),
            )
        return self._row_to_procedural(row)

    async def list_procedural(
        self,
        user_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """列出程序记忆(按最近使用时间倒序)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """SELECT id, user_id, pattern, tool_name,
                          success_count, failure_count,
                          importance_score::text, metadata::text,
                          last_used_at, created_at, updated_at
                   FROM agent_memory_procedural
                   WHERE user_id = $1
                   ORDER BY COALESCE(last_used_at, created_at) DESC
                   LIMIT $2""",
                user_id,
                limit,
            )
        return [self._row_to_procedural(r) for r in rows]

    async def get_procedural_stats(
        self,
        user_id: str,
        tool_name: str | None = None,
    ) -> dict[str, Any]:
        """获取程序记忆统计(success/failure 总计 + 平均 importance)。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            if tool_name:
                row = await conn.fetchrow(
                    """SELECT
                           COALESCE(SUM(success_count), 0)::int AS success_total,
                           COALESCE(SUM(failure_count), 0)::int AS failure_total,
                           COALESCE(AVG(importance_score::float), 0)::float AS avg_importance,
                           COUNT(*)::int AS total
                       FROM agent_memory_procedural
                       WHERE user_id = $1 AND tool_name = $2""",
                    user_id,
                    tool_name,
                )
            else:
                row = await conn.fetchrow(
                    """SELECT
                           COALESCE(SUM(success_count), 0)::int AS success_total,
                           COALESCE(SUM(failure_count), 0)::int AS failure_total,
                           COALESCE(AVG(importance_score::float), 0)::float AS avg_importance,
                           COUNT(*)::int AS total
                       FROM agent_memory_procedural
                       WHERE user_id = $1""",
                    user_id,
                )
        success_total = row["success_total"]
        failure_total = row["failure_total"]
        return {
            "success_total": success_total,
            "failure_total": failure_total,
            "success_rate": (
                success_total / (success_total + failure_total)
                if (success_total + failure_total) > 0
                else 0.0
            ),
            "avg_importance": float(row["avg_importance"]),
            "total": row["total"],
        }

    # ------------------------------------------------------------------
    # 统一保存入口(按 layer 分发)
    # ------------------------------------------------------------------

    async def save(
        self,
        user_id: str,
        content: str,
        layer: str,
        *,
        session_id: str | None = None,
        summary: str | None = None,
        importance_score: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """统一保存入口,按 layer 分发到对应层。

        layer:
          - working: 写入 working_memory(需 session_id)
          - episodic: 写入 agent_memory_episodic(需 session_id)
          - semantic: 写入 agent_memory_semantic(自动生成 embedding)
          - procedural: 写入 agent_memory_procedural(需 metadata.pattern / metadata.tool_name)
        """
        score = importance_score if importance_score is not None else 0.5
        if layer == "working":
            if not session_id:
                raise ValueError("working 层需要 session_id")
            msg = await self.add_working(
                session_id, "user", content, metadata=metadata
            )
            msg["userId"] = user_id
            return msg
        if layer == "episodic":
            if not session_id:
                raise ValueError("episodic 层需要 session_id")
            return await self.add_episodic(
                user_id,
                session_id,
                content,
                summary=summary,
                importance_score=score,
                metadata=metadata,
            )
        if layer == "semantic":
            return await self.add_semantic(
                user_id,
                content,
                importance_score=score,
                metadata=metadata,
            )
        if layer == "procedural":
            pattern = (metadata or {}).get("pattern") or content
            tool_name = (metadata or {}).get("tool_name")
            success = bool((metadata or {}).get("success", True))
            return await self.add_procedural(
                user_id,
                pattern=pattern,
                tool_name=tool_name,
                success=success,
                metadata=metadata,
            )
        raise ValueError(f"未知 layer: {layer}(应为 working/episodic/semantic/procedural)")

    # ------------------------------------------------------------------
    # 行转换工具
    # ------------------------------------------------------------------

    @staticmethod
    def _row_to_episodic(row: asyncpg.Record) -> dict[str, Any]:
        """asyncpg Record → episodic memory dict。"""
        return {
            "id": str(row["id"]),
            "layer": "episodic",
            "sessionId": row["session_id"],
            "userId": str(row["user_id"]),
            "content": row["content"],
            "summary": row["summary"],
            "importanceScore": float(row["importance_score"]),
            "decayFactor": float(row["decay_factor"]),
            "metadata": _parse_jsonb(row["metadata"]),
            "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
            "expiresAt": row["expires_at"].isoformat() if row["expires_at"] else None,
            "lastAccessedAt": (
                row["last_accessed_at"].isoformat() if row["last_accessed_at"] else None
            ),
        }

    @staticmethod
    def _row_to_semantic(row: asyncpg.Record) -> dict[str, Any]:
        """asyncpg Record → semantic memory dict(不含 embedding)。"""
        return {
            "id": str(row["id"]),
            "layer": "semantic",
            "userId": str(row["user_id"]),
            "content": row["content"],
            "importanceScore": float(row["importance_score"]),
            "metadata": _parse_jsonb(row["metadata"]),
            "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
            "lastAccessedAt": (
                row["last_accessed_at"].isoformat() if row["last_accessed_at"] else None
            ),
        }

    @staticmethod
    def _row_to_procedural(row: asyncpg.Record) -> dict[str, Any]:
        """asyncpg Record → procedural memory dict。"""
        return {
            "id": str(row["id"]),
            "layer": "procedural",
            "userId": str(row["user_id"]),
            "pattern": row["pattern"],
            "toolName": row["tool_name"],
            "successCount": row["success_count"],
            "failureCount": row["failure_count"],
            "importanceScore": float(row["importance_score"]),
            "metadata": _parse_jsonb(row["metadata"]),
            "lastUsedAt": row["last_used_at"].isoformat() if row["last_used_at"] else None,
            "createdAt": row["created_at"].isoformat() if row["created_at"] else None,
            "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
        }


memory_service = MemoryService()
