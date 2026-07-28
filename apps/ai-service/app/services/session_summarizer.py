"""会话摘要器(L8 长程一致性,2026-07-25 立,对标 Claude 长上下文管理)。

L8 长程一致性闭环:
1. 会话摘要:SessionSummarizer.summarize_session 把一次会话的 messages 摘要成
   200-500 字 + key_facts + key_decisions,持久化到 agent_session_summary 表
2. 工作记忆压缩:compress_working_memory 把超长 messages 压缩成摘要 system 消息 +
   最近 N 条,审计日志写 agent_working_memory_compression 表
3. 跨会话 RAG:search_relevant_summaries 用 query embedding 与历史 summary
   embedding 做 cosine 检索,返回 top_k 相关历史摘要
4. 上下文注入:LongTermMemory.build_context_for_new_session 把历史摘要格式化
   成 prompt 片段,注入新会话 system prompt(本模块提供数据,注入由主 agent 做)

数据流:
  AgentLoop 会话结束 / 触发压缩
    ↓ summarize_session
  agent_session_summary(summary + key_facts + key_decisions + embedding)
    ↓ search_relevant_summaries(query, top_k)
  历史摘要列表 → LongTermMemory.build_context_for_new_session
    ↓ 注入新会话 system prompt
  AgentLoop 拿到历史上下文继续推理

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 仅返回内存 dict,warning
  - LLM 失败 → 降级 raw_response[:500] 作为 summary
  - JSON 解析失败 → 降级 summary=raw_response[:500]
  - embed 失败 → summary 仍持久化,embedding 字段为 None
  - 检索失败 → 降级返回 list_user_summaries
"""

from __future__ import annotations

import json
import logging
import math
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# prompt 字符上限(超长截断,保留首尾)
_PROMPT_LIMIT = 4000

# 会话摘要触发最小消息数(< 5 跳过)
_MIN_MESSAGES_FOR_SUMMARY = 5

# 全局连接池(与 meta_learner._pool 独立,避免互相影响)
_pool: Optional[asyncpg.Pool] = None

# P0 修复:每用户内存缓存记录上限,防止 _cache 无界增长导致 OOM(防御性:目前 _cache 未被写入)
_MAX_CACHE_ENTRIES = 500


async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(懒初始化,与 meta_learner 独立避免互相影响)。"""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
    return _pool


async def close_pool() -> None:
    """P0 修复:关闭全局 asyncpg 连接池(main.py shutdown 调用,防止重启时连接残留)。"""
    global _pool
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:
            pass
        _pool = None


# =============================================================================
# 工具函数(纯函数,便于单测)
# =============================================================================


def _format_dialog(messages: list[dict[str, Any]]) -> str:
    """把 messages 拼接成对话文本(供 LLM prompt 用)。

    格式:
      user: <content>
      assistant: <content>
      system: <content>
    """
    lines: list[str] = []
    for m in messages:
        if not isinstance(m, dict):
            continue
        role = str(m.get("role", "user"))
        content = str(m.get("content", ""))
        if not content:
            continue
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _truncate_prompt(text: str, limit: int = _PROMPT_LIMIT) -> str:
    """超长文本截断(保留首尾,中间用占位符连接,总长度 ≤ limit)。"""
    if len(text) <= limit:
        return text
    # 留 50 字符给中间占位符,首尾各保留 (limit-50)//2 字符
    marker = "\n...(已截断)...\n"
    keep = max(10, (limit - len(marker)) // 2)
    return text[:keep] + marker + text[-keep:]


def _parse_json_response(content: str) -> dict[str, Any] | None:
    """解析 LLM 返回的 JSON(支持 markdown 代码块 / 纯 JSON / 含噪声文本)。

    Returns:
        解析后的 dict,失败返回 None。
    """
    if not content:
        return None
    text = content.strip()
    # 去除 markdown 代码块包裹
    if text.startswith("```"):
        lines = text.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    # 直接尝试解析
    try:
        result = json.loads(text)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass
    # 兜底:提取第一个 { 到最后一个 } 之间的子串
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            result = json.loads(text[start : end + 1])
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            return None
    return None


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """计算两个向量的余弦相似度(纯 Python)。

    任一向量长度为 0 或长度不匹配 → 返回 0.0。
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


# =============================================================================
# SessionSummarizer
# =============================================================================


class SessionSummarizer:
    """会话摘要器:把会话 messages 摘要 + 跨会话 RAG 检索 + 工作记忆压缩。

    L8:持久化到 agent_session_summary / agent_working_memory_compression 表,
    进程重启不丢失。所有 IO 失败均降级返回空/默认值,不抛异常。
    """

    def __init__(self) -> None:
        # 内存缓存:user_id -> 历史摘要列表(供快速检索,可选)
        self._cache: dict[str, list[dict[str, Any]]] = {}

    # ==================================================================
    # 会话摘要
    # ==================================================================

    async def summarize_session(
        self,
        user_id: str,
        session_id: str,
        messages: list[dict[str, Any]],
        *,
        strategy: str = "summary",
    ) -> dict[str, Any]:
        """对一次会话的 messages 生成结构化摘要并持久化。

        Args:
            user_id: 用户 ID
            session_id: 会话 ID
            messages: [{"role": "user/assistant/system", "content": "..."}, ...]
            strategy: 摘要策略(预留,目前仅 "summary")

        Returns:
            {
                "summary_id": str,         # 持久化行 ID(失败为 "")
                "summary": str,            # 摘要文本
                "key_facts": list[str],    # 关键事实
                "key_decisions": list[str],# 关键决策
                "skipped": bool,           # 是否因消息不足跳过
            }
        """
        # 1. 消息数 < 5 跳过
        if not messages or len(messages) < _MIN_MESSAGES_FOR_SUMMARY:
            logger.info(
                "[session_summarizer] summarize_session 跳过(messages=%d < %d, "
                "user=%s session=%s)",
                len(messages) if messages else 0,
                _MIN_MESSAGES_FOR_SUMMARY,
                user_id,
                session_id,
            )
            return {
                "summary_id": "",
                "summary": "",
                "key_facts": [],
                "key_decisions": [],
                "skipped": True,
            }

        # 2. 构造 prompt
        dialog = _format_dialog(messages)
        prompt = (
            "请分析以下对话并生成结构化摘要。输出严格 JSON 格式"
            "(不要 markdown 代码块包裹):\n\n"
            '{"summary": "200-500字对话摘要,涵盖主要话题、用户意图、关键交互",'
            ' "key_facts": ["关键事实1", "关键事实2"],'
            ' "key_decisions": ["关键决策1", "关键决策2"]}\n\n'
            f"对话内容:\n{dialog}\n\n"
            "只输出 JSON,不要其他文字。"
        )
        prompt = _truncate_prompt(prompt, _PROMPT_LIMIT)

        # 3. 调 LLM
        summary = ""
        key_facts: list[str] = []
        key_decisions: list[str] = []
        raw_response = ""
        try:
            result = await llm_gateway.complete(
                messages=[{"role": "user", "content": prompt}]
            )
            if isinstance(result, dict):
                raw_response = str(result.get("content", "") or "")
            # 检查 LLM 错误标记
            if isinstance(result, dict) and result.get("error"):
                logger.warning(
                    "[session_summarizer] LLM 返回 error,user=%s session=%s: %s",
                    user_id,
                    session_id,
                    result.get("error_message", ""),
                )
                # 降级:用 raw_response 或占位
                summary = raw_response[:500] if raw_response else "LLM 调用失败,无摘要"
            else:
                # 4. 解析 JSON
                parsed = _parse_json_response(raw_response)
                if parsed is not None:
                    summary = str(parsed.get("summary", "")) or raw_response[:500]
                    facts = parsed.get("key_facts")
                    if isinstance(facts, list):
                        key_facts = [str(f) for f in facts if f]
                    decisions = parsed.get("key_decisions")
                    if isinstance(decisions, list):
                        key_decisions = [str(d) for d in decisions if d]
                else:
                    # JSON 解析失败 → 降级
                    logger.warning(
                        "[session_summarizer] JSON 解析失败,降级 raw_response[:500]"
                        "(user=%s session=%s)",
                        user_id,
                        session_id,
                    )
                    summary = raw_response[:500] if raw_response else "摘要解析失败"
        except Exception as e:
            logger.warning(
                "[session_summarizer] LLM 调用异常(user=%s session=%s): %s: %s",
                user_id,
                session_id,
                type(e).__name__,
                e,
            )
            summary = "LLM 调用异常,无摘要"

        # 5. 持久化到 DB
        summary_id = ""
        try:
            summary_id = await self._persist_summary(
                user_id=user_id,
                session_id=session_id,
                summary=summary,
                key_facts=key_facts,
                key_decisions=key_decisions,
                message_count=len(messages),
                token_count=self._estimate_tokens(messages),
                start_time=self._extract_start_time(messages),
            )
        except Exception as e:
            logger.warning(
                "[session_summarizer] 持久化摘要失败(降级仅返回内存,user=%s session=%s)"
                ": %s: %s",
                user_id,
                session_id,
                type(e).__name__,
                e,
            )

        # 6. 生成 embedding 并 UPSERT(失败仅 warning,不影响已写入字段)
        if summary and summary_id:
            try:
                embedding = await llm_gateway.embed(summary)
                if embedding:
                    await self._update_embedding(summary_id, embedding)
            except Exception as e:
                logger.warning(
                    "[session_summarizer] 生成/更新 embedding 失败(summary_id=%s,"
                    "summary 字段已写入): %s: %s",
                    summary_id,
                    type(e).__name__,
                    e,
                )

        return {
            "summary_id": summary_id,
            "summary": summary,
            "key_facts": key_facts,
            "key_decisions": key_decisions,
            "skipped": False,
        }

    # ==================================================================
    # 工作记忆压缩
    # ==================================================================

    async def compress_working_memory(
        self,
        user_id: str,
        session_id: str,
        messages: list[dict[str, Any]],
        *,
        max_messages: int = 20,
        strategy: str = "hybrid",
    ) -> dict[str, Any]:
        """压缩工作记忆:超长 messages 压缩成摘要 system 消息 + 最近 N 条。

        Args:
            user_id: 用户 ID
            session_id: 会话 ID
            messages: 原始消息列表
            max_messages: 保留的最大消息数
            strategy: 压缩策略
                - "summary": 前 N-max 摘要成 1 system + 最后 max 条
                - "sliding_window": 直接丢弃前 N-max,保留最后 max 条
                - "hybrid": 前 N-(max/2) 摘要成 1 system + 最后 max/2 条

        Returns:
            {
                "compressed_messages": list[dict],  # 压缩后消息列表
                "original_count": int,             # 原始消息数
                "compressed_to": int,              # 压缩后消息数
                "strategy": str,                   # 实际使用的策略
            }
        """
        original_count = len(messages)
        # 不需要压缩
        if original_count <= max_messages or original_count == 0:
            return {
                "compressed_messages": list(messages),
                "original_count": original_count,
                "compressed_to": original_count,
                "strategy": strategy,
            }

        compressed: list[dict[str, Any]] = []
        if strategy == "sliding_window":
            # 直接丢弃前 N-max,保留最后 max 条
            compressed = list(messages[-max_messages:])
        elif strategy == "summary":
            # 前 N-max 摘要成 1 system + 最后 max 条
            to_summarize = messages[:-max_messages]
            recent = messages[-max_messages:]
            summary_msg = await self._compress_with_llm(to_summarize)
            compressed = [summary_msg] + recent
        else:
            # hybrid(默认):前 N-(max/2) 摘要成 1 system + 最后 max/2 条
            keep = max(1, max_messages // 2)
            if original_count <= keep:
                compressed = list(messages)
            else:
                to_summarize = messages[:-keep]
                recent = messages[-keep:]
                summary_msg = await self._compress_with_llm(to_summarize)
                compressed = [summary_msg] + recent
                strategy = "hybrid"

        compressed_to = len(compressed)

        # 持久化压缩日志(失败仅 warning)
        try:
            await self._persist_compression_log(
                user_id=user_id,
                session_id=session_id,
                original_messages=original_count,
                compressed_to=compressed_to,
                strategy=strategy,
            )
        except Exception as e:
            logger.warning(
                "[session_summarizer] 持久化压缩日志失败(忽略,user=%s session=%s)"
                ": %s: %s",
                user_id,
                session_id,
                type(e).__name__,
                e,
            )

        return {
            "compressed_messages": compressed,
            "original_count": original_count,
            "compressed_to": compressed_to,
            "strategy": strategy,
        }

    # ==================================================================
    # 跨会话检索
    # ==================================================================

    async def list_user_summaries(
        self,
        user_id: str,
        *,
        top_k: int = 20,
    ) -> list[dict[str, Any]]:
        """按 end_time DESC 检索用户历史会话摘要。

        Args:
            user_id: 用户 ID
            top_k: 最大返回条数

        Returns:
            摘要列表(失败返回 [])
        """
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
                       ORDER BY end_time DESC
                       LIMIT $2""",
                    user_id,
                    top_k,
                )
        except Exception as e:
            logger.warning(
                "[session_summarizer] list_user_summaries 失败(返回 [] user=%s): %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return []
        return [self._row_to_summary_dict(row) for row in rows]

    async def search_relevant_summaries(
        self,
        user_id: str,
        query: str,
        *,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """跨会话 RAG 检索:用 query embedding 与历史 summary embedding 做 cosine 排序。

        Args:
            user_id: 用户 ID
            query: 当前查询文本
            top_k: 返回条数

        Returns:
            按 cosine 相似度降序的 top_k 摘要列表
            (失败降级为 list_user_summaries(top_k))
        """
        # 1. embed query
        try:
            query_embedding = await llm_gateway.embed(query)
        except Exception as e:
            logger.warning(
                "[session_summarizer] search_relevant_summaries embed query 失败"
                "(降级 list_user_summaries user=%s): %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return await self.list_user_summaries(user_id, top_k=top_k)

        if not query_embedding:
            return await self.list_user_summaries(user_id, top_k=top_k)

        # 2. 加载该 user 全部 summary 的 embedding
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
                       WHERE user_id = $1 AND embedding IS NOT NULL""",
                    user_id,
                )
        except Exception as e:
            logger.warning(
                "[session_summarizer] search_relevant_summaries 加载 summaries 失败"
                "(降级 list_user_summaries user=%s): %s: %s",
                user_id,
                type(e).__name__,
                e,
            )
            return await self.list_user_summaries(user_id, top_k=top_k)

        # 3. cosine 排序(纯 Python)
        scored: list[tuple[float, dict[str, Any]]] = []
        for row in rows:
            embedding = row.get("embedding")
            if not embedding:
                continue
            # asyncpg 返回 jsonb 自动反序列化为 list / dict
            emb_list = (
                embedding if isinstance(embedding, list)
                else list(embedding) if isinstance(embedding, (tuple, set))
                else None
            )
            if not emb_list:
                continue
            score = _cosine_similarity(query_embedding, emb_list)
            scored.append((score, self._row_to_summary_dict(row)))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:top_k]]

    # ==================================================================
    # 持久化辅助
    # ==================================================================

    async def _persist_summary(
        self,
        *,
        user_id: str,
        session_id: str,
        summary: str,
        key_facts: list[str],
        key_decisions: list[str],
        message_count: int,
        token_count: int,
        start_time: Optional[datetime],
    ) -> str:
        """持久化单条会话摘要到 DB,返回 summary_id。

        UPSERT 策略:按 (user_id, session_id) 查找
          - 存在 → UPDATE summary + key_facts + key_decisions + 时间 + 计数
          - 不存在 → INSERT 新行
        """
        summary_id = str(_uuid.uuid4())
        pool = await _get_pool()
        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                """SELECT id::text AS sid FROM agent_session_summary
                   WHERE user_id = $1 AND session_id = $2""",
                user_id,
                session_id,
            )
            if existing:
                summary_id = str(existing["sid"])
                await conn.execute(
                    """UPDATE agent_session_summary SET
                           summary = $1,
                           key_facts = $2::jsonb,
                           key_decisions = $3::jsonb,
                           message_count = $4,
                           token_count = $5,
                           start_time = $6,
                           end_time = NOW()
                       WHERE id = $7""",
                    summary,
                    json.dumps(key_facts),
                    json.dumps(key_decisions),
                    message_count,
                    token_count,
                    start_time,
                    _uuid.UUID(summary_id),
                )
            else:
                await conn.execute(
                    """INSERT INTO agent_session_summary
                           (id, user_id, session_id, summary, key_facts, key_decisions,
                            message_count, token_count, start_time, end_time,
                            importance_score)
                       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, NOW(), 0.5)""",
                    _uuid.UUID(summary_id),
                    user_id,
                    session_id,
                    summary,
                    json.dumps(key_facts),
                    json.dumps(key_decisions),
                    message_count,
                    token_count,
                    start_time,
                )
        return summary_id

    async def _update_embedding(
        self, summary_id: str, embedding: list[float]
    ) -> None:
        """UPSERT 摘要的 embedding 字段。"""
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """UPDATE agent_session_summary SET embedding = $1::jsonb
                   WHERE id = $2""",
                json.dumps(embedding),
                _uuid.UUID(summary_id),
            )

    async def _persist_compression_log(
        self,
        *,
        user_id: str,
        session_id: str,
        original_messages: int,
        compressed_to: int,
        strategy: str,
    ) -> None:
        """持久化工作记忆压缩日志(审计用)。"""
        ratio = (
            compressed_to / original_messages
            if original_messages > 0
            else 0.0
        )
        pool = await _get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO agent_working_memory_compression
                       (id, user_id, session_id, original_messages, compressed_to,
                        compression_ratio, strategy)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                _uuid.uuid4(),
                user_id,
                session_id,
                original_messages,
                compressed_to,
                ratio,
                strategy,
            )

    async def _compress_with_llm(
        self, messages: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """调 LLM 把 messages 摘要成单条 system 消息(压缩用,非会话级摘要)。"""
        dialog = _format_dialog(messages)
        prompt = (
            "请将以下对话片段压缩成简洁摘要(300字以内),保留关键信息和上下文,"
            "便于后续对话延续:\n\n"
            f"{dialog}\n\n"
            "直接输出摘要文本,不要其他说明。"
        )
        prompt = _truncate_prompt(prompt, _PROMPT_LIMIT)
        summary_text = ""
        try:
            result = await llm_gateway.complete(
                messages=[{"role": "user", "content": prompt}]
            )
            if isinstance(result, dict):
                summary_text = str(result.get("content", "") or "")
                if result.get("error"):
                    summary_text = summary_text or "[前文摘要因 LLM 错误省略]"
        except Exception as e:
            logger.warning(
                "[session_summarizer] _compress_with_llm 失败(降级占位): %s: %s",
                type(e).__name__,
                e,
            )
            summary_text = "[前文摘要因 LLM 异常省略]"
        if not summary_text:
            summary_text = "[前文摘要为空]"
        return {
            "role": "system",
            "content": f"[前文摘要] {summary_text}",
        }

    # ==================================================================
    # 工具方法
    # ==================================================================

    @staticmethod
    def _estimate_tokens(messages: list[dict[str, Any]]) -> int:
        """粗略估算 messages 的 token 数(中文按 1.5 字/token,英文按 4 字符/token)。"""
        total = 0
        for m in messages:
            content = str(m.get("content", "")) if isinstance(m, dict) else ""
            total += len(content)
        # 粗略:1 token ≈ 3 字符(混合中英文经验值)
        return max(1, total // 3)

    @staticmethod
    def _extract_start_time(messages: list[dict[str, Any]]) -> Optional[datetime]:
        """从 messages 中提取开始时间(若有 timestamp 字段),否则用当前时间。"""
        for m in messages:
            if not isinstance(m, dict):
                continue
            ts = m.get("timestamp") or m.get("created_at")
            if ts:
                try:
                    if isinstance(ts, datetime):
                        return ts
                    text = str(ts).replace("Z", "+00:00")
                    return datetime.fromisoformat(text)
                except (ValueError, TypeError):
                    continue
        return datetime.now(timezone.utc)

    @staticmethod
    def _row_to_summary_dict(row: Any) -> dict[str, Any]:
        """把 asyncpg 行转成 summary dict(供 list/search 返回)。"""
        end_time = row.get("end_time")
        start_time = row.get("start_time")
        created_at = row.get("created_at")
        return {
            "summary_id": str(row.get("summary_id", "")),
            "session_id": str(row.get("session_id", "")),
            "summary": str(row.get("summary", "")),
            "key_facts": list(row.get("key_facts") or []),
            "key_decisions": list(row.get("key_decisions") or []),
            "message_count": int(row.get("message_count") or 0),
            "token_count": int(row.get("token_count") or 0),
            "start_time": start_time.isoformat() if start_time else None,
            "end_time": end_time.isoformat() if end_time else None,
            "importance_score": float(row.get("importance_score") or 0.5),
            "embedding": list(row.get("embedding") or []) or None,
            "created_at": created_at.isoformat() if created_at else None,
        }


# 单例(与 meta_learner / ab_test_scheduler 风格一致)
session_summarizer = SessionSummarizer()
