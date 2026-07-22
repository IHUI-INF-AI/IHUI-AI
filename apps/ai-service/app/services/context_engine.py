"""Context Engine 服务 — 智能上下文压缩 + RAG 检索 + context window 管理。

对标 Qoder / Claude Code 的 context engineering 能力:
1. compact: 旧消息摘要压缩(达 88% 阈值触发,summarize 早期对话 → 替换为 summary)
2. retrieve: RAG 检索(基于用户问题向量检索相关历史/知识,替换无谓的全量历史)
3. manage_window: context window 管理(token 计数 + 截断策略 + 模型容量适配)

使用方式:
    from app.services.context_engine import context_engine
    # 压缩(达阈值时自动触发)
    compacted = await context_engine.compact(messages, model="gpt-4o", context_limit=128000)
    # RAG 检索增强
    enriched = await context_engine.retrieve_and_enrich(messages, query="用户问题")
    # token 计数
    tokens = context_engine.count_tokens(messages, model="gpt-4o")
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# 压缩触发阈值(占比达 context_limit 的 88% 时触发,跨端统一)
COMPACTION_THRESHOLD = 0.88
# 保留最近消息数(不参与压缩的滑窗大小)
KEEP_RECENT_COUNT = 6
# 粗略 token 估算系数(中文 ~1.5 char/token,英文 ~4 char/token,取折中)
CHARS_PER_TOKEN_ESTIMATE = 3.5


@dataclass
class CompactionResult:
    """压缩结果。"""

    messages: list[dict[str, Any]]
    """压缩后的消息列表(summary + 保留的近期消息)"""
    tokens_before: int
    tokens_after: int
    removed_count: int
    usage_ratio: float
    triggered: bool
    summary: str = ""


@dataclass
class RetrievedContext:
    """RAG 检索结果。"""

    content: str
    score: float
    source: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class ContextEngine:
    """上下文引擎:压缩 + RAG + window 管理。

    设计原则:
    - 压缩只对"早期历史"生效,最近 KEEP_RECENT_COUNT 条原样保留(保证上下文连贯)
    - RAG 检索结果作为 system 补充注入,不替换用户最新问题
    - token 计数优先用模型自带 tokenizer,不可用时降级为字符数估算
    """

    def __init__(self) -> None:
        self._summary_cache: dict[str, str] = {}

    def count_tokens(
        self,
        messages: list[dict[str, Any]],
        model: str = "gpt-4o",
    ) -> int:
        """估算消息列表的 token 数。

        优先用 tiktoken(若安装),否则降级为字符数 / CHARS_PER_TOKEN_ESTIMATE。
        """
        try:
            import tiktoken  # type: ignore[import-untyped]

            try:
                enc = tiktoken.encoding_for_model(model)
            except Exception:
                enc = tiktoken.get_encoding("cl100k_base")
            total = 0
            for m in messages:
                content = str(m.get("content", ""))
                total += len(enc.encode(content))
                # 每条消息的 role + 元数据开销(OpenAI 约 4 token)
                total += 4
            return total
        except ImportError:
            # tiktoken 未安装:降级为字符数估算
            total = 0
            for m in messages:
                content = str(m.get("content", ""))
                total += max(1, int(len(content) / CHARS_PER_TOKEN_ESTIMATE))
                total += 4
            return total

    async def compact(
        self,
        messages: list[dict[str, Any]],
        model: str = "gpt-4o",
        context_limit: int = 128000,
    ) -> CompactionResult:
        """压缩上下文(达 88% 阈值时触发)。

        流程:
        1. 估算当前 token 数,计算 usage_ratio
        2. 未达阈值 → 原样返回(triggered=False)
        3. 达阈值 → 把早期消息(除最近 KEEP_RECENT_COUNT 条)摘要为一段 summary
        4. 返回 [system_summary, ...recent_messages]
        """
        tokens_before = self.count_tokens(messages, model)
        usage_ratio = tokens_before / context_limit if context_limit > 0 else 0.0

        if usage_ratio < COMPACTION_THRESHOLD:
            return CompactionResult(
                messages=messages,
                tokens_before=tokens_before,
                tokens_after=tokens_before,
                removed_count=0,
                usage_ratio=usage_ratio,
                triggered=False,
            )

        # 保留最近 KEEP_RECENT_COUNT 条(含最新用户问题)
        if len(messages) <= KEEP_RECENT_COUNT:
            return CompactionResult(
                messages=messages,
                tokens_before=tokens_before,
                tokens_after=tokens_before,
                removed_count=0,
                usage_ratio=usage_ratio,
                triggered=False,
            )

        old_messages = messages[:-KEEP_RECENT_COUNT]
        recent_messages = messages[-KEEP_RECENT_COUNT:]

        # 生成摘要(缓存避免重复压缩)
        cache_key = self._make_cache_key(old_messages)
        summary = self._summary_cache.get(cache_key)
        if not summary:
            summary = await self._summarize(old_messages)
            self._summary_cache[cache_key] = summary

        summary_msg: dict[str, Any] = {
            "role": "system",
            "content": f"[上下文摘要] 以下是此前 {len(old_messages)} 条对话的摘要:\n\n{summary}",
        }

        compacted = [summary_msg] + recent_messages
        tokens_after = self.count_tokens(compacted, model)

        logger.info(
            "context compacted: %d → %d tokens (removed %d messages, ratio %.2f → %.2f)",
            tokens_before,
            tokens_after,
            len(old_messages),
            usage_ratio,
            tokens_after / context_limit if context_limit > 0 else 0.0,
        )

        return CompactionResult(
            messages=compacted,
            tokens_before=tokens_before,
            tokens_after=tokens_after,
            removed_count=len(old_messages),
            usage_ratio=usage_ratio,
            triggered=True,
            summary=summary,
        )

    async def retrieve_and_enrich(
        self,
        messages: list[dict[str, Any]],
        query: str,
        top_k: int = 5,
    ) -> list[RetrievedContext]:
        """RAG 检索:基于 query 从历史消息检索相关上下文。

        用 embedding 相似度从历史消息中找 top_k 相关条目,
        作为补充上下文注入(不替换最新用户问题)。
        """
        if not query.strip() or len(messages) < 4:
            return []

        try:
            # 用 llm_gateway 生成 query embedding
            query_embedding = await self._get_embedding(query)
            if not query_embedding:
                return []

            # 检索历史消息(跳过最新用户问题,避免自匹配)
            candidates = messages[:-1]
            scored: list[tuple[float, dict[str, Any], str]] = []

            for msg in candidates:
                content = str(msg.get("content", ""))
                if not content or len(content) < 10:
                    continue
                msg_embedding = await self._get_embedding(content)
                if not msg_embedding:
                    continue
                score = self._cosine_similarity(query_embedding, msg_embedding)
                role = str(msg.get("role", "unknown"))
                scored.append((score, msg, role))

            scored.sort(key=lambda x: x[0], reverse=True)
            results: list[RetrievedContext] = []
            for score, msg, role in scored[:top_k]:
                results.append(
                    RetrievedContext(
                        content=str(msg.get("content", "")),
                        score=score,
                        source=f"history:{role}",
                        metadata={"role": role},
                    )
                )
            return results
        except Exception as e:
            logger.warning("retrieve_and_enrich failed: %s", e)
            return []

    def manage_window(
        self,
        messages: list[dict[str, Any]],
        model: str = "gpt-4o",
        context_limit: int = 128000,
        reserve_tokens: int = 4096,
    ) -> list[dict[str, Any]]:
        """context window 管理:超限时从头部截断(保留 system + 最新消息)。

        - reserve_tokens: 为模型输出预留的 token 数
        - 截断策略:保留首条 system + 末尾 N 条(直到不超限)
        """
        available = context_limit - reserve_tokens
        if available <= 0:
            available = context_limit // 2

        total = self.count_tokens(messages, model)
        if total <= available:
            return messages

        # 保留首条(通常是 system prompt)+ 从末尾保留尽量多
        if not messages:
            return []

        head = messages[0] if messages[0].get("role") == "system" else None
        rest = messages[1:] if head else messages[:]

        result: list[dict[str, Any]] = []
        if head:
            result.append(head)

        # 从末尾往前加,直到超限
        for msg in reversed(rest):
            candidate = result + [msg]
            if self.count_tokens(candidate, model) > available:
                break
            result.append(msg)

        # 重新排序:system 在前,其余按原顺序
        if head:
            tail = result[1:]
            tail.reverse()
            result = [head] + tail
        else:
            result.reverse()

        return result

    async def _summarize(self, messages: list[dict[str, Any]]) -> str:
        """用 LLM 生成对话摘要。"""
        conversation = "\n".join(
            f"[{m.get('role', 'unknown')}] {m.get('content', '')}" for m in messages
        )
        prompt = (
            "请把以下对话历史压缩为一段简洁摘要(≤500 字),保留关键信息、决策、代码引用:\n\n"
            f"{conversation[:8000]}"
        )
        try:
            resp = await llm_gateway.complete(
                messages=[{"role": "user", "content": prompt}],
                model="gpt-4o-mini",
                temperature=0.3,
                max_tokens=800,
            )
            # complete 返回 dict[str, Any],含 content/model/usage/stub 字段
            content = resp.get("content", "") if isinstance(resp, dict) else str(resp)
            return content or conversation[:1000]
        except Exception as e:
            logger.warning("summarize failed, fallback to truncation: %s", e)
            # 降级:取前 1000 字符作为摘要
            return conversation[:1000] + "\n...(摘要生成失败,已截断)"

    async def _get_embedding(self, text: str) -> Optional[list[float]]:
        """生成 embedding(委托 llm_gateway)。"""
        try:
            return await llm_gateway.embed(text)
        except Exception as e:
            logger.debug("embed failed: %s", e)
            return None

    @staticmethod
    def _cosine_similarity(a: list[float], b: list[float]) -> float:
        """余弦相似度。"""
        if not a or not b or len(a) != len(b):
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(y * y for y in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    @staticmethod
    def _make_cache_key(messages: list[dict[str, Any]]) -> str:
        """基于消息内容生成缓存 key(避免重复压缩)。"""
        import hashlib

        raw = "|".join(str(m.get("content", ""))[:100] for m in messages)
        return hashlib.md5(raw.encode("utf-8")).hexdigest()


# 模块级单例
context_engine = ContextEngine()
