"""主动遗忘器(L9,2026-07-25 立,对标人类元认知的主动遗忘策略)。

与 memory_decay 的被动衰减对比:
- memory_decay:每次访问后被动衰减 decay_factor *= 0.95^days(只降分数,不删除)
- active_forgetter:主动扫描过期 / 冗余 / 孤儿记忆,DELETE / DEMOTE / MERGE

L9 元认知闭环:
1. scan_stale_memories:扫描过期候选(last_accessed_at 超期 + importance_score 过低)
2. forget_memory:DELETE 主动遗忘(硬删除)
3. demote_memory:降级(软遗忘,只降 importance_score 到 0.1)
4. merge_duplicates:合并重复记忆(exact content match → 保留首条 + 删除其余)
5. cleanup_orphans:清理孤儿记忆(user_id 不在 users 表)

数据流:
  Metacognition.reflect_on_memories
    ↓ active_forgetter.scan_stale_memories
  过期候选列表
    ↓ LLM 评估每条记忆
  actions(forget / demote / merge / keep)
    ↓ active_forgetter.forget_memory / demote_memory
  DB 更新(DELETE / UPDATE)
    ↓ Metacognition 持久化反思日志
  agent_metacognition_log 表

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 返回空 / False / 0 + log warning
  - 无效 layer → raise ValueError(由调用方捕获)

表名映射:
  episodic  -> agent_memory_episodic (列:content / last_accessed_at)
  semantic  -> agent_memory_semantic (列:content / last_accessed_at)
  procedural-> agent_memory_procedural(列:pattern  / last_used_at)
"""

from __future__ import annotations

import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings

logger = logging.getLogger(__name__)

# 层 -> 表名映射(working 层不持久化到 DB,只在内存)
_LAYER_TABLE_MAP: dict[str, str] = {
    "episodic": "agent_memory_episodic",
    "semantic": "agent_memory_semantic",
    "procedural": "agent_memory_procedural",
}

# 层 -> 内容列名(procedural 用 pattern,其他用 content)
_LAYER_CONTENT_COL: dict[str, str] = {
    "episodic": "content",
    "semantic": "content",
    "procedural": "pattern",
}

# 层 -> 最后访问时间列名(procedural 用 last_used_at,其他用 last_accessed_at)
_LAYER_ACCESS_COL: dict[str, str] = {
    "episodic": "last_accessed_at",
    "semantic": "last_accessed_at",
    "procedural": "last_used_at",
}

# 全局连接池(独立于 meta_learner / memory_service,避免互相影响)
_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化,与其他服务独立避免循环导入)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


class ActiveForgetter:
    """主动遗忘器:扫描过期 / 冗余 / 孤儿记忆,DELETE / DEMOTE / MERGE。

    L9:对比 memory_decay 被动衰减,本服务主动清理低价值记忆。
    """

    # ==================================================================
    # scan_stale_memories:扫描过期候选
    # ==================================================================

    async def scan_stale_memories(
        self,
        user_id: str | None = None,
        *,
        days_threshold: int = 30,
        min_importance: float = 0.3,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """扫描过期记忆候选(从 episodic / semantic / procedural 三表 SELECT)。

        条件:last_accessed_at < now() - interval 'days_threshold days'
              AND importance_score < min_importance
        user_id=None 时全表扫描(系统级反思)。

        Args:
            user_id: 用户 ID(可空,空表示全表扫描)
            days_threshold: 过期天数阈值(默认 30 天)
            min_importance: 重要性上限(只扫低于此值的,默认 0.3)
            limit: 返回候选上限(默认 100)

        Returns:
            候选列表 [{"id","layer","user_id","content_preview",
                     "last_accessed_at","importance_score","days_stale"}, ...]
            失败返回 []。
        """
        candidates: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc)

        for layer, table in _LAYER_TABLE_MAP.items():
            content_col = _LAYER_CONTENT_COL[layer]
            access_col = _LAYER_ACCESS_COL[layer]
            try:
                pool = await _get_pool()
                async with pool.acquire() as conn:
                    if user_id is not None:
                        rows = await conn.fetch(
                            f"""SELECT id::text AS id, user_id::text AS uid,
                                       {content_col} AS content,
                                       {access_col} AS last_accessed,
                                       importance_score::float AS score
                                FROM {table}
                                WHERE {access_col} IS NOT NULL
                                  AND {access_col} < NOW() - ($1::int || ' days')::interval
                                  AND importance_score < $2
                                  AND user_id::text = $3
                                ORDER BY {access_col} ASC
                                LIMIT $4""",
                            days_threshold,
                            min_importance,
                            user_id,
                            limit,
                        )
                    else:
                        rows = await conn.fetch(
                            f"""SELECT id::text AS id, user_id::text AS uid,
                                       {content_col} AS content,
                                       {access_col} AS last_accessed,
                                       importance_score::float AS score
                                FROM {table}
                                WHERE {access_col} IS NOT NULL
                                  AND {access_col} < NOW() - ($1::int || ' days')::interval
                                  AND importance_score < $2
                                ORDER BY {access_col} ASC
                                LIMIT $3""",
                            days_threshold,
                            min_importance,
                            limit,
                        )
            except Exception as e:
                logger.warning(
                    "[active_forgetter] scan_stale_memories layer=%s 失败(返回空): %s: %s",
                    layer, type(e).__name__, e,
                )
                continue

            for row in rows:
                last_acc = row["last_accessed"]
                days_stale = self._compute_days_stale(last_acc, now)
                content_preview = self._preview(str(row["content"] or ""))
                candidates.append({
                    "id": row["id"],
                    "layer": layer,
                    "user_id": row["uid"],
                    "content_preview": content_preview,
                    "last_accessed_at": last_acc.isoformat() if last_acc else None,
                    "importance_score": float(row["score"] or 0.0),
                    "days_stale": days_stale,
                })
            if len(candidates) >= limit:
                return candidates[:limit]

        return candidates[:limit]

    # ==================================================================
    # forget_memory:主动遗忘(DELETE)
    # ==================================================================

    async def forget_memory(
        self,
        layer: str,
        memory_id: str,
        *,
        reason: str = "stale",
    ) -> bool:
        """主动遗忘:DELETE FROM 对应表 WHERE id=memory_id。

        Args:
            layer: 记忆层(episodic / semantic / procedural)
            memory_id: 记忆 ID(UUID 字符串)
            reason: 遗忘原因(仅 log,不入库,默认 "stale")

        Returns:
            True 表示删除成功(至少 1 行受影响),False 表示未删除或失败。

        Raises:
            ValueError: layer 不是 episodic / semantic / procedural 之一。
        """
        if layer not in _LAYER_TABLE_MAP:
            raise ValueError(
                f"无效 layer: {layer},允许: {list(_LAYER_TABLE_MAP.keys())}"
            )
        table = _LAYER_TABLE_MAP[layer]
        try:
            uid = _uuid.UUID(memory_id)
        except (TypeError, ValueError):
            logger.warning(
                "[active_forgetter] forget_memory 无效 memory_id=%s layer=%s reason=%s",
                memory_id, layer, reason,
            )
            return False
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    f"DELETE FROM {table} WHERE id = $1", uid
                )
            deleted = self._parse_rowcount(result)
            if deleted:
                logger.info(
                    "[active_forgetter] forget_memory layer=%s id=%s reason=%s 删除 %d 行",
                    layer, memory_id, reason, deleted,
                )
            return deleted > 0
        except Exception as e:
            logger.warning(
                "[active_forgetter] forget_memory layer=%s id=%s 失败: %s: %s",
                layer, memory_id, type(e).__name__, e,
            )
            return False

    # ==================================================================
    # demote_memory:降级(软遗忘)
    # ==================================================================

    async def demote_memory(
        self,
        layer: str,
        memory_id: str,
        *,
        new_score: float = 0.1,
    ) -> bool:
        """降级记忆(不删除,只降低 importance_score,默认 0.1)。

        用于"软遗忘":比 forget_memory 保守,可逆。

        Args:
            layer: 记忆层(episodic / semantic / procedural)
            memory_id: 记忆 ID(UUID 字符串)
            new_score: 新的重要性分数(默认 0.1)

        Returns:
            True 表示更新成功,False 表示未更新或失败。

        Raises:
            ValueError: layer 不是 episodic / semantic / procedural 之一。
        """
        if layer not in _LAYER_TABLE_MAP:
            raise ValueError(
                f"无效 layer: {layer},允许: {list(_LAYER_TABLE_MAP.keys())}"
            )
        table = _LAYER_TABLE_MAP[layer]
        try:
            uid = _uuid.UUID(memory_id)
        except (TypeError, ValueError):
            logger.warning(
                "[active_forgetter] demote_memory 无效 memory_id=%s layer=%s",
                memory_id, layer,
            )
            return False
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    f"""UPDATE {table}
                        SET importance_score = $1
                        WHERE id = $2""",
                    new_score,
                    uid,
                )
            updated = self._parse_rowcount(result)
            if updated:
                logger.info(
                    "[active_forgetter] demote_memory layer=%s id=%s new_score=%.3f 更新 %d 行",
                    layer, memory_id, new_score, updated,
                )
            return updated > 0
        except Exception as e:
            logger.warning(
                "[active_forgetter] demote_memory layer=%s id=%s 失败: %s: %s",
                layer, memory_id, type(e).__name__, e,
            )
            return False

    # ==================================================================
    # merge_duplicates:合并重复记忆
    # ==================================================================

    async def merge_duplicates(
        self,
        user_id: str | None = None,
        *,
        similarity_threshold: float = 0.92,
        limit: int = 50,
    ) -> int:
        """扫描重复记忆(exact content match),合并到一条 + 删除其他。

        本实现采用精确内容匹配(content 完全相等视为重复),因三表无 content_hash 列。
        similarity_threshold 当前仅作日志参考,实际用精确匹配(>= 1.0 等价)。

        Args:
            user_id: 用户 ID(可空,空表示全表)
            similarity_threshold: 相似度阈值(保留参数,本实现仅日志)
            limit: 单表最多处理的重复组数

        Returns:
            合并删除的总数量(跨三表),失败返回 0。
        """
        total_deleted = 0
        for layer, table in _LAYER_TABLE_MAP.items():
            content_col = _LAYER_CONTENT_COL[layer]
            try:
                pool = await _get_pool()
                async with pool.acquire() as conn:
                    # 找出重复内容组(content 相同 count > 1)
                    if user_id is not None:
                        rows = await conn.fetch(
                            f"""SELECT {content_col} AS content,
                                       array_agg(id::text) AS ids
                                FROM {table}
                                WHERE user_id::text = $1
                                  AND {content_col} IS NOT NULL
                                GROUP BY {content_col}
                                HAVING COUNT(*) > 1
                                LIMIT $2""",
                            user_id,
                            limit,
                        )
                    else:
                        rows = await conn.fetch(
                            f"""SELECT {content_col} AS content,
                                       array_agg(id::text) AS ids
                                FROM {table}
                                WHERE {content_col} IS NOT NULL
                                GROUP BY {content_col}
                                HAVING COUNT(*) > 1
                                LIMIT $1""",
                            limit,
                        )
                    # 保留首条,删除其余
                    for row in rows:
                        ids = list(row["ids"] or [])
                        if len(ids) < 2:
                            continue
                        # 保留第一个,删剩余
                        for mid in ids[1:]:
                            try:
                                uid = _uuid.UUID(mid)
                                r = await conn.execute(
                                    f"DELETE FROM {table} WHERE id = $1", uid
                                )
                                if self._parse_rowcount(r) > 0:
                                    total_deleted += 1
                            except Exception as inner_e:
                                logger.warning(
                                    "[active_forgetter] merge_duplicates layer=%s "
                                    "id=%s 删除失败(跳过): %s: %s",
                                    layer, mid, type(inner_e).__name__, inner_e,
                                )
                                continue
            except Exception as e:
                logger.warning(
                    "[active_forgetter] merge_duplicates layer=%s 失败(跳过该层): %s: %s",
                    layer, type(e).__name__, e,
                )
                continue
        logger.info(
            "[active_forgetter] merge_duplicates user_id=%s threshold=%.2f 删除总数=%d",
            user_id, similarity_threshold, total_deleted,
        )
        return total_deleted

    # ==================================================================
    # cleanup_orphans:清理孤儿记忆
    # ==================================================================

    async def cleanup_orphans(self, user_id: str | None = None) -> int:
        """清理孤儿记忆(user_id 不在 users 表 / 引用断链)。

        Args:
            user_id: 用户 ID(可空,空表示全表扫描所有孤儿)

        Returns:
            清理数量,失败返回 0。
        """
        total = 0
        for layer, table in _LAYER_TABLE_MAP.items():
            try:
                pool = await _get_pool()
                async with pool.acquire() as conn:
                    if user_id is not None:
                        # 指定 user_id 时检查该用户是否存在;不存在则清理该 user_id 的记忆
                        user_exists = await conn.fetchval(
                            "SELECT 1 FROM users WHERE id::text = $1", user_id
                        )
                        if user_exists:
                            # 用户存在,无孤儿可清
                            continue
                        result = await conn.execute(
                            f"DELETE FROM {table} WHERE user_id::text = $1",
                            user_id,
                        )
                        total += self._parse_rowcount(result)
                    else:
                        # 全表扫描:删除 user_id 不在 users 表的记忆
                        result = await conn.execute(
                            f"""DELETE FROM {table}
                                WHERE user_id IS NOT NULL
                                  AND user_id NOT IN (SELECT id FROM users)"""
                        )
                        total += self._parse_rowcount(result)
            except Exception as e:
                logger.warning(
                    "[active_forgetter] cleanup_orphans layer=%s 失败(跳过该层): %s: %s",
                    layer, type(e).__name__, e,
                )
                continue
        logger.info(
            "[active_forgetter] cleanup_orphans user_id=%s 清理总数=%d",
            user_id, total,
        )
        return total

    # ==================================================================
    # 内部工具
    # ==================================================================

    @staticmethod
    def _parse_rowcount(result: str) -> int:
        """解析 asyncpg execute 返回的 "DELETE N" / "UPDATE N" 字符串。"""
        if not result:
            return 0
        try:
            # 格式 "DELETE 5" / "UPDATE 3" / "INSERT 0 1"
            parts = result.split()
            if len(parts) >= 2 and parts[0] in ("DELETE", "UPDATE"):
                return int(parts[1])
            if len(parts) >= 3 and parts[0] == "INSERT":
                return int(parts[2])
        except (ValueError, IndexError):
            return 0
        return 0

    @staticmethod
    def _compute_days_stale(
        last_accessed: datetime | None, now: datetime
    ) -> int:
        """计算距今天数(last_accessed 为空返回 0)。"""
        if not last_accessed:
            return 0
        try:
            ts = last_accessed
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            delta = now - ts
            return max(0, int(delta.total_seconds() // 86400))
        except Exception:
            return 0

    @staticmethod
    def _preview(content: str, max_len: int = 80) -> str:
        """截取内容预览(默认 80 字符,超出加省略号)。"""
        if not content:
            return ""
        if len(content) <= max_len:
            return content
        return content[: max_len - 3] + "..."


# 全局单例(与 active_forgetter / meta_learner 风格一致)
active_forgetter = ActiveForgetter()
