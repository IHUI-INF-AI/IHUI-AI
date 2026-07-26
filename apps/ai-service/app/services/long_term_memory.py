"""长程记忆(L8 长程一致性,2026-07-25 立,对标 Claude 长上下文管理)。

L8 长程记忆对外门面:封装 SessionSummarizer 的跨会话检索能力,提供:
1. recall_cross_session:跨会话 RAG 检索历史摘要
2. build_context_for_new_session:把历史摘要格式化成 prompt 片段,注入新会话
3. extract_key_facts:聚合用户所有历史 key_facts,去重 + 排序
4. update_importance:更新某 summary 的重要性评分
5. load_recent_summaries:启动时 hydrate 最近 N 天的 summaries 到内存缓存

数据流:
  新会话开始
    ↓ build_context_for_new_session(user_id, current_query)
  LongTermMemory → session_summarizer.search_relevant_summaries
    ↓ cosine RAG 检索
  top max_summaries 相关历史摘要
    ↓ 格式化
  "## 历史会话参考\n\n### 会话 1 (2025-07-25)\n摘要: ...\n关键事实: ..."
    ↓ 注入 system prompt
  AgentLoop 拿到历史上下文继续推理(由主 agent 集成)

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 返回空字符串 / 空列表 / False / 0 + warning
  - 检索失败 → 降级 list_user_summaries
  - 上下文超长 → 截断到 2000 字符
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Optional

import asyncpg

from ..core.config import settings
from .session_summarizer import session_summarizer

logger = logging.getLogger(__name__)

# 上下文 prompt 片段字符上限(超长截断)
_CONTEXT_LIMIT = 2000

# extract_key_facts 返回条数上限
_MAX_KEY_FACTS = 20

# 全局连接池(与 session_summarizer._pool 独立,避免互相影响)
_pool: Optional[asyncpg.Pool] = None


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化,与 session_summarizer 独立)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


# =============================================================================
# LongTermMemory
# =============================================================================


class LongTermMemory:
    """长程记忆门面:跨会话 RAG + 上下文构造 + 关键事实聚合。

    L8:封装 SessionSummarizer,提供新会话上下文注入所需的高层 API。
    所有 IO 失败均降级返回空/False/0,不抛异常。
    """

    def __init__(self) -> None:
        # 内存缓存:user_id -> summaries 列表(供快速访问,可选)
        self._cache: dict[str, list[dict[str, Any]]] = {}

    # ==================================================================
    # 跨会话检索
    # ==================================================================

    async def recall_cross_session(
        self,
        user_id: str,
        query: str,
        *,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """跨会话检索:调 session_summarizer.search_relevant_summaries。

        Args:
            user_id: 用户 ID
            query: 当前查询文本
            top_k: 返回条数

        Returns:
            top_k 条历史摘要列表(失败返回 [])
        """
        try:
            return await session_summarizer.search_relevant_summaries(
                user_id, query, top_k=top_k
            )
        except Exception as e:
            logger.warning(
                "[long_term_memory] recall_cross_session 失败(返回 [] user=%s)"
                ": %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return []

    # ==================================================================
    # 上下文构造
    # ==================================================================

    async def build_context_for_new_session(
        self,
        user_id: str,
        current_query: str,
        *,
        max_summaries: int = 3,
    ) -> str:
        """构造新会话的上下文 prompt 片段。

        Args:
            user_id: 用户 ID
            current_query: 当前会话的查询文本(用于 RAG 检索)
            max_summaries: 最多注入的历史摘要条数

        Returns:
            格式化的 prompt 片段(空 → 返回空字符串):
            "## 历史会话参考\n\n### 会话 1 (2025-07-25)\n摘要: ...\n关键事实: ...\n\n..."
            总长度限制 2000 字符内(超长截断)
        """
        try:
            summaries = await session_summarizer.search_relevant_summaries(
                user_id, current_query, top_k=max_summaries
            )
        except Exception as e:
            logger.warning(
                "[long_term_memory] build_context_for_new_session 检索失败"
                "(返回空 user=%s): %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return ""

        if not summaries:
            return ""

        # 格式化每条摘要
        blocks: list[str] = []
        for idx, summary in enumerate(summaries, start=1):
            date_str = self._extract_date_str(summary.get("end_time"))
            block_lines = [f"### 会话 {idx} ({date_str})"]
            summary_text = str(summary.get("summary", "")).strip()
            if summary_text:
                block_lines.append(f"摘要: {summary_text}")
            key_facts = summary.get("key_facts") or []
            if key_facts:
                facts_text = "; ".join(str(f) for f in key_facts if f)
                block_lines.append(f"关键事实: {facts_text}")
            key_decisions = summary.get("key_decisions") or []
            if key_decisions:
                decisions_text = "; ".join(str(d) for d in key_decisions if d)
                block_lines.append(f"关键决策: {decisions_text}")
            blocks.append("\n".join(block_lines))

        full = "## 历史会话参考\n\n" + "\n\n".join(blocks)
        # 超长截断
        if len(full) > _CONTEXT_LIMIT:
            full = full[: _CONTEXT_LIMIT - 3] + "..."
        return full

    # ==================================================================
    # 关键事实聚合
    # ==================================================================

    async def extract_key_facts(self, user_id: str) -> list[str]:
        """从该用户所有历史 summary 中聚合 key_facts(去重 + 按出现次数排序)。

        Args:
            user_id: 用户 ID

        Returns:
            前 20 条 key_facts(失败返回 [])
        """
        try:
            summaries = await session_summarizer.list_user_summaries(
                user_id, top_k=100
            )
        except Exception as e:
            logger.warning(
                "[long_term_memory] extract_key_facts 加载 summaries 失败"
                "(返回 [] user=%s): %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return []

        if not summaries:
            return []

        # 聚合 key_facts 计数
        counter: Counter[str] = Counter()
        for summary in summaries:
            facts = summary.get("key_facts") or []
            if not isinstance(facts, list):
                continue
            for fact in facts:
                if fact:
                    fact_str = str(fact).strip()
                    if fact_str:
                        counter[fact_str] += 1

        # 按出现次数降序,次数相同按字典序
        sorted_facts = sorted(
            counter.items(), key=lambda x: (-x[1], x[0])
        )
        return [fact for fact, _ in sorted_facts[:_MAX_KEY_FACTS]]

    # ==================================================================
    # 重要性更新
    # ==================================================================

    async def update_importance(
        self,
        user_id: str,
        summary_id: str,
        score: float,
    ) -> bool:
        """更新某 summary 的重要性评分。

        Args:
            user_id: 用户 ID(用于日志,不参与 SQL 过滤)
            summary_id: 摘要 ID(UUID)
            score: 重要性评分(0-1)

        Returns:
            True 表示更新成功,失败返回 False
        """
        if not summary_id:
            return False
        # score 钳制到 [0, 1]
        score = max(0.0, min(1.0, float(score)))
        try:
            import uuid as _uuid

            pool = await _get_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """UPDATE agent_session_summary
                       SET importance_score = $1
                       WHERE id = $2""",
                    score,
                    _uuid.UUID(summary_id),
                )
            # asyncpg execute 返回 "UPDATE N" 字符串,N=0 表示无行被更新
            return self._parse_rows_affected(result) > 0
        except Exception as e:
            logger.warning(
                "[long_term_memory] update_importance 失败(user=%s summary=%s)"
                ": %s: %s",
                user_id,
                summary_id,
                type(e).__name__,
                e,
            )
            return False

    # ==================================================================
    # 启动时 hydrate
    # ==================================================================

    async def load_recent_summaries(
        self, user_id: str, *, days: int = 7
    ) -> int:
        """启动时 hydrate 最近 N 天的 summaries 到内存缓存。

        Args:
            user_id: 用户 ID(传空字符串则跳过)
            days: 时间窗口(天)

        Returns:
            加载到内存的条数(失败返回 0)
        """
        if not user_id:
            return 0
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT
                           id::text AS summary_id,
                           session_id,
                           summary,
                           key_facts,
                           key_decisions,
                           message_count::int AS message_count,
                           token_count::int AS token_count,
                           start_time,
                           end_time,
                           importance_score::float AS importance_score,
                           embedding,
                           created_at
                       FROM agent_session_summary
                       WHERE user_id = $1
                         AND end_time >= NOW() - ($2 || ' days')::interval
                       ORDER BY end_time DESC""",
                    user_id,
                    str(int(days)),
                )
        except Exception as e:
            logger.warning(
                "[long_term_memory] load_recent_summaries 失败(返回 0 user=%s)"
                ": %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return 0

        # 复用 session_summarizer 的行转换器保持字段一致
        from .session_summarizer import SessionSummarizer

        summaries = [
            SessionSummarizer._row_to_summary_dict(row) for row in rows
        ]
        self._cache[user_id] = summaries
        return len(summaries)

    # ==================================================================
    # 工具方法
    # ==================================================================

    @staticmethod
    def _extract_date_str(end_time: Any) -> str:
        """从 end_time 提取 YYYY-MM-DD 字符串(失败返回 "未知日期")。"""
        if not end_time:
            return "未知日期"
        try:
            if isinstance(end_time, str):
                # ISO 字符串
                text = end_time.replace("Z", "+00:00")
                dt = __import__("datetime").datetime.fromisoformat(text)
            else:
                dt = end_time
            return str(dt.strftime("%Y-%m-%d"))
        except (ValueError, TypeError):
            return "未知日期"

    @staticmethod
    def _parse_rows_affected(status: str) -> int:
        """解析 asyncpg execute 返回的状态字符串(如 "UPDATE 3")。

        Returns:
            影响的行数(解析失败返回 0)
        """
        if not status:
            return 0
        parts = str(status).split()
        if len(parts) >= 2 and parts[-1].isdigit():
            return int(parts[-1])
        return 0


# 单例(与 session_summarizer / meta_learner 风格一致)
long_term_memory = LongTermMemory()
