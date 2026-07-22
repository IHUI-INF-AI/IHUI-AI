"""Context Engine 服务 — 智能上下文压缩 + RAG 检索 + context window 管理。

对标 Qoder / Claude Code 的 context engineering 能力:
1. compact: 旧消息摘要压缩(达 88% 阈值触发,summarize 早期对话 → 替换为 summary)
2. retrieve: RAG 检索(基于用户问题向量检索相关历史/知识,替换无谓的全量历史)
3. manage_window: context window 管理(token 计数 + 截断策略 + 模型容量适配)
4. enrich: 两层集成(@ 提及 + RAG 多源融合,2026-07-22 立)
5. 跨会话 RAG:retrieve_and_enrich 同时检索 codebase_indexer(2026-07-22 立)
6. 多源融合 + token 预算分配(history 40% / codebase 30% / mention 20% / web 5% / database 5%)

使用方式:
    from app.services.context_engine import context_engine
    # 压缩(达阈值时自动触发)
    compacted = await context_engine.compact(messages, model="gpt-4o", context_limit=128000)
    # RAG 检索增强(含跨会话 codebase 检索)
    enriched = await context_engine.retrieve_and_enrich(messages, query="用户问题")
    # @ 提及 + RAG 两层集成
    result = await context_engine.enrich_context(mentions, query="用户问题")
    # token 计数
    tokens = context_engine.count_tokens(messages, model="gpt-4o")
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# 压缩触发阈值(占比达 context_limit 的 88% 时触发,跨端统一)
COMPACTION_THRESHOLD = 0.88
# 保留最近消息数(不参与压缩的滑窗大小)
KEEP_RECENT_COUNT = 6
# 粗略 token 估算系数(中文 ~1.5 char/token,英文 ~4 char/token,取折中)
CHARS_PER_TOKEN_ESTIMATE = 3.5
# 上下文增强默认 token 预算(2026-07-22 立)
DEFAULT_CONTEXT_BUDGET = 8000
# 各源类型预算分配比例(history 40% / codebase 30% / mention 20% / web 5% / database 5%)
SOURCE_BUDGET_RATIOS: dict[str, float] = {
    "history": 0.40,
    "codebase": 0.30,
    "mention": 0.20,
    "web": 0.05,
    "database": 0.05,
}


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
        include_codebase: bool = True,
    ) -> list[RetrievedContext]:
        """RAG 检索:基于 query 从历史消息 + 代码库检索相关上下文。

        跨会话 RAG(2026-07-22 立):
        - history:从本会话历史消息按 embedding 相似度检索 top_k(跳过最新用户问题避免自匹配)
        - codebase:从 codebase_indexer 检索 top-3 代码 chunk(跨会话语义搜索)

        降级:codebase_indexer 不可用时仅检索消息历史(现有逻辑)。

        Args:
            messages: 当前会话消息列表(最后一条为最新用户问题,会被跳过)。
            query: 检索查询(通常为用户最新问题)。
            top_k: 历史消息检索 top-K(codebase 固定 top-3)。
            include_codebase: 是否启用 codebase 跨会话检索(默认 True)。
        """
        if not query.strip():
            return []

        # 即使无足够历史消息,也尝试 codebase 检索(跨会话 RAG 关键路径)
        history_results: list[RetrievedContext] = []
        if len(messages) >= 4:
            try:
                # 用 llm_gateway 生成 query embedding
                query_embedding = await self._get_embedding(query)
                if query_embedding:
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
                    for score, msg, role in scored[:top_k]:
                        history_results.append(
                            RetrievedContext(
                                content=str(msg.get("content", "")),
                                score=score,
                                source=f"history:{role}",
                                metadata={"role": role},
                            )
                        )
            except Exception as e:
                logger.warning("retrieve_and_enrich history search failed: %s", e)

        # 跨会话 RAG:检索代码库 chunk
        if include_codebase:
            try:
                codebase_results = await self._search_codebase(query, top_k=3)
                history_results.extend(codebase_results)
            except Exception as e:
                logger.warning("retrieve_and_enrich codebase search failed (degrade): %s", e)

        return history_results

    async def _search_codebase(self, query: str, top_k: int = 3) -> list[RetrievedContext]:
        """跨会话 RAG:从 codebase_indexer 检索代码 chunk。

        降级:codebase_indexer 不可用 / API 调用失败 → 返回空列表(不影响主流程)。

        Args:
            query: 自然语言查询。
            top_k: 返回 top-K 代码 chunk。
        """
        try:
            # 延迟导入避免循环依赖
            from .codebase_indexer import codebase_indexer

            chunks = await codebase_indexer.search(query, top_k=top_k)
            results: list[RetrievedContext] = []
            for chunk in chunks:
                content = str(chunk.get("content", ""))
                if not content:
                    continue
                score = float(chunk.get("score", 0.0))
                results.append(
                    RetrievedContext(
                        content=content,
                        score=score,
                        source="codebase",
                        metadata={
                            "file_path": str(chunk.get("file_path", "")),
                            "line_start": chunk.get("line_start"),
                            "line_end": chunk.get("line_end"),
                            "symbol_name": chunk.get("symbol_name"),
                            "symbol_type": chunk.get("symbol_type"),
                            "language": chunk.get("language"),
                        },
                    )
                )
            return results
        except Exception as e:
            logger.warning("codebase search degrade: %s", e)
            return []

    def _merge_context(
        self,
        sources: list[dict[str, Any]],
        total_budget: int = DEFAULT_CONTEXT_BUDGET,
    ) -> list[dict[str, Any]]:
        """多源上下文融合:按相关性排序 + 去重 + token 截断(2026-07-22 立)。

        Args:
            sources: 多源上下文列表,每条结构为
                {type, content, relevance, source, metadata?}
                - type: 上下文类型(history / codebase / mention / web / database)
                - content: 文本内容
                - relevance: 相关性评分 [0, 1]
                - source: 来源标签(如 "history:user" / "codebase" / "mention:file")
            total_budget: 总 token 预算(默认 8000)。

        Returns:
            融合后的上下文列表,按 relevance DESC 排序,总 token 不超过 budget。
        """
        if not sources:
            return []

        # 1. 按 content 去重(相同内容只保留 relevance 最高的)
        seen: dict[str, dict[str, Any]] = {}
        for s in sources:
            content = str(s.get("content", ""))
            if not content:
                continue
            existing = seen.get(content)
            new_rel = float(s.get("relevance", 0.0) or 0.0)
            if existing is None or new_rel > float(existing.get("relevance", 0.0) or 0.0):
                seen[content] = s
        deduped = list(seen.values())

        # 2. 按 relevance DESC 排序
        deduped.sort(key=lambda x: float(x.get("relevance", 0.0) or 0.0), reverse=True)

        # 3. token 截断(按预算逐条累加)
        result: list[dict[str, Any]] = []
        used = 0
        for item in deduped:
            content = str(item.get("content", ""))
            tokens = self.count_text_tokens(content)
            if used + tokens > total_budget:
                # 预算不足以容纳完整条目 → 截断当前条目填满剩余预算
                remaining = total_budget - used
                if remaining <= 100:
                    break
                # 粗略按 token 比例截断文本
                ratio = remaining / max(1, tokens)
                cut_len = max(1, int(len(content) * ratio))
                item = {**item, "content": content[:cut_len] + "...(truncated)"}
            result.append(item)
            used += self.count_text_tokens(str(item.get("content", "")))
            if used >= total_budget:
                break
        return result

    def _allocate_budget(
        self,
        sources: list[str],
        total: int = DEFAULT_CONTEXT_BUDGET,
    ) -> dict[str, int]:
        """按源类型分配 token 预算(2026-07-22 立)。

        分配比例(SOURCE_BUDGET_RATIOS):
        - history: 40%(历史对话最重要)
        - codebase: 30%(代码上下文)
        - mention: 20%(@ 提及内容)
        - web: 5%(web 搜索)
        - database: 5%(DB schema)

        若实际参与的源类型子集不完整,缺失源份额按比例重新分配给参与者(归一化)。

        Args:
            sources: 实际参与的源类型列表(如 ["history", "codebase", "mention"])。
            total: 总 token 预算。

        Returns:
            {source_type: budget_tokens} 映射(仅含实际参与的源)。
        """
        if not sources:
            return {}
        # 仅对已知源类型分配,过滤未知
        active = [s for s in sources if s in SOURCE_BUDGET_RATIOS]
        if not active:
            return {}
        active_ratio_sum = sum(SOURCE_BUDGET_RATIOS[s] for s in active)
        if active_ratio_sum <= 0:
            return {}
        # 归一化:各 active 源按其原始占比瓜分 total
        return {s: int(total * SOURCE_BUDGET_RATIOS[s] / active_ratio_sum) for s in active}

    def count_text_tokens(self, text: str, model: str = "gpt-4o") -> int:
        """估算单段文本的 token 数(去掉单条消息 4 token 元数据开销)。

        复用 count_tokens 逻辑,封装为对纯文本的便捷调用。
        """
        if not text:
            return 0
        return max(0, self.count_tokens([{"role": "user", "content": text}], model) - 4)

    def _mention_to_content(self, mention: dict[str, Any]) -> str:
        """将 @ 提及条目转为可注入的上下文文本。

        支持 5 类提及:file / folder / database / symbol / web。
        """
        mtype = str(mention.get("type", ""))
        label = str(mention.get("label", ""))
        detail = str(mention.get("detail", ""))
        meta = mention.get("meta", {}) or {}
        if mtype == "file":
            path = str(meta.get("path", "")) or detail
            return f"文件: {label}\n路径: {path}".rstrip()
        if mtype == "folder":
            path = str(meta.get("path", "")) or detail
            return f"目录: {label}\n路径: {path}".rstrip()
        if mtype == "database":
            table = str(meta.get("tableName", "")) or label
            schema = str(meta.get("schema", ""))
            tail = f"\nSchema: {schema}" if schema else (f"\n{detail}" if detail else "")
            return f"数据表: {table}{tail}".rstrip()
        if mtype == "symbol":
            sym_name = str(meta.get("symbolName", "")) or label
            sym_type = str(meta.get("symbolType", ""))
            file_path = str(meta.get("filePath", ""))
            line = meta.get("lineStart", "")
            return f"符号: {sym_name}({sym_type})\n文件: {file_path}:{line}".rstrip()
        if mtype == "web":
            url = str(meta.get("url", ""))
            return f"Web: {label}\nURL: {url}".rstrip()
        return f"{mtype}: {label}".rstrip()

    async def enrich_context(
        self,
        mentions: list[dict[str, Any]],
        conversation_id: str = "",
        query: str = "",
        messages: list[dict[str, Any]] | None = None,
        total_budget: int = DEFAULT_CONTEXT_BUDGET,
    ) -> dict[str, Any]:
        """两层集成入口:合并 @ 提及 + RAG 检索结果(2026-07-22 立)。

        流程:
        1. 将 @ 提及结果转为统一上下文条目(type=mention, relevance=1.0 用户显式选择)
        2. 若有 query,调用 retrieve_and_enrich 检索 history + codebase 上下文
        3. 多源融合 _merge_context:去重 + 按 relevance DESC 排序 + token 截断
        4. 拼接为 enrichedContext 文本 + 返回 sources 明细

        Args:
            mentions: @ 提及结果列表,每条含 {type, label, detail, insertText, meta}
            conversation_id: 会话 ID(目前仅元数据,跨会话 RAG 由 codebase_indexer 实现)。
            query: 用户当前问题(用于 RAG 检索,为空时跳过 RAG)。
            messages: 当前会话消息历史(为空时仅检索 codebase)。
            total_budget: 总 token 预算。

        Returns:
            {
                "enrichedContext": str,  # 拼接后的上下文文本(供 LLM 注入)
                "tokenCount": int,        # enrichedContext 的 token 数
                "sources": [              # 各源条目明细(供前端展示)
                    {"type", "content", "relevance", "source", "metadata"},
                    ...
                ],
                "conversationId": str,
            }
        """
        # 1. @ 提及条目转为统一上下文(relevance=1.0,用户显式选择)
        unified: list[dict[str, Any]] = []
        for m in mentions:
            content = self._mention_to_content(m)
            if not content:
                continue
            mtype = str(m.get("type", "unknown"))
            unified.append({
                "type": "mention",
                "content": content,
                "relevance": 1.0,
                "source": f"mention:{mtype}",
                "metadata": {
                    "mention_type": mtype,
                    "label": m.get("label"),
                    "insert_text": m.get("insertText"),
                },
            })

        # 2. RAG 检索(history + codebase)
        if query.strip():
            try:
                rag_results = await self.retrieve_and_enrich(
                    messages or [],
                    query,
                    top_k=5,
                    include_codebase=True,
                )
                for r in rag_results:
                    source_str = r.source or "unknown"
                    source_type = source_str.split(":")[0] if ":" in source_str else source_str
                    # 相关性归一化到 [0, 1]
                    relevance = max(0.0, min(1.0, r.score))
                    unified.append({
                        "type": source_type,
                        "content": r.content,
                        "relevance": relevance,
                        "source": source_str,
                        "metadata": r.metadata,
                    })
            except Exception as e:
                logger.warning("enrich_context RAG failed (degrade to mentions only): %s", e)

        # 3. 多源融合(去重 + 排序 + 截断)
        merged = self._merge_context(unified, total_budget=total_budget)

        # 4. 拼接为 enrichedContext 文本
        parts: list[str] = []
        for item in merged:
            source_tag = str(item.get("source", "unknown"))
            parts.append(f"[{source_tag}]\n{item.get('content', '')}")
        enriched_text = "\n\n".join(parts)
        token_count = self.count_text_tokens(enriched_text)

        return {
            "enrichedContext": enriched_text,
            "tokenCount": token_count,
            "sources": merged,
            "conversationId": conversation_id,
        }

    def manage_window(
        self,
        messages: list[dict[str, Any]],
        model: str = "gpt-4o",
        context_limit: int = 128000,
        reserve_tokens: int = 4096,
        active_sources: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """context window 管理:超限时从头部截断(保留 system + 最新消息)。

        - reserve_tokens: 为模型输出预留的 token 数
        - 截断策略:保留首条 system + 末尾 N 条(直到不超限)
        - active_sources: 实际参与的上下文源类型列表(如 ["history","codebase","mention"]),
                         用于 _allocate_budget 按源比例分配 history 预算(2026-07-22 立)。
                         为 None 时退化为原逻辑(available 全部给 history)。
        """
        available = context_limit - reserve_tokens
        if available <= 0:
            available = context_limit // 2

        # 按源预算分配:若提供 active_sources,history 只占其分配份额
        if active_sources:
            budgets = self._allocate_budget(active_sources, total=available)
            history_budget = budgets.get("history", available)
        else:
            history_budget = available

        total = self.count_tokens(messages, model)
        if total <= history_budget:
            return messages

        # 保留首条(通常是 system prompt)+ 从末尾保留尽量多
        if not messages:
            return []

        head = messages[0] if messages[0].get("role") == "system" else None
        rest = messages[1:] if head else messages[:]

        result: list[dict[str, Any]] = []
        if head:
            result.append(head)

        # 从末尾往前加,直到超限(history_budget)
        for msg in reversed(rest):
            candidate = result + [msg]
            if self.count_tokens(candidate, model) > history_budget:
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


# ---------------------------------------------------------------------------
# HTTP 端点(模块级 APIRouter,供 main.py 挂载到 /api/context 前缀,2026-07-22 立)
# 两层集成入口:POST /api/context/enrich + GET /api/context/sources
# ---------------------------------------------------------------------------


class EnrichRequest(BaseModel):
    """POST /api/context/enrich 请求体。"""

    mentions: list[dict[str, Any]] = Field(
        default_factory=list, description="@ 提及结果列表(每条含 type/label/detail/insertText/meta)"
    )
    conversationId: str = Field("", description="会话 ID")
    query: str = Field("", description="用户当前问题(为空时跳过 RAG 检索)")
    messages: list[dict[str, Any]] | None = Field(
        None, description="当前会话消息历史(为空时仅检索 codebase)"
    )
    totalBudget: int = Field(
        DEFAULT_CONTEXT_BUDGET, ge=500, le=32000, description="总 token 预算"
    )


router = APIRouter()


@router.post("/enrich")
async def enrich_endpoint(req: EnrichRequest) -> dict[str, Any]:
    """POST /api/context/enrich — @ 提及结果 + RAG 检索两层集成。

    输入:@ 提及结果 mentions + conversationId + query + messages(可选)+ totalBudget
    输出:{ code, message, data: { enrichedContext, tokenCount, sources, conversationId } }

    流程:
    1. mentions 转为统一上下文条目(type=mention, relevance=1.0)
    2. 若有 query,调用 retrieve_and_enrich 检索 history + codebase 上下文
    3. _merge_context 多源融合(去重 + 排序 + 截断)
    """
    try:
        result = await context_engine.enrich_context(
            mentions=req.mentions,
            conversation_id=req.conversationId,
            query=req.query,
            messages=req.messages or [],
            total_budget=req.totalBudget,
        )
        return {"code": 0, "message": "ok", "data": result}
    except Exception as e:
        logger.exception("enrich_endpoint failed: %s", e)
        return {"code": 500, "message": f"上下文增强失败: {e}", "data": None}


@router.get("/sources")
async def sources_endpoint() -> dict[str, Any]:
    """GET /api/context/sources — 返回可用上下文源类型 + 预算分配规则。

    输出:{ code, message, data: { sources: [...], defaultBudget: 8000 } }
    """
    source_defs = [
        {
            "type": "history",
            "label": "历史对话",
            "budgetRatio": SOURCE_BUDGET_RATIOS["history"],
            "description": "本会话 + 跨会话历史消息 RAG(embedding 相似度检索)",
        },
        {
            "type": "codebase",
            "label": "代码库",
            "budgetRatio": SOURCE_BUDGET_RATIOS["codebase"],
            "description": "codebase_indexer 语义检索代码 chunk(跨会话 RAG)",
        },
        {
            "type": "mention",
            "label": "@ 提及",
            "budgetRatio": SOURCE_BUDGET_RATIOS["mention"],
            "description": "用户显式 @ 提及的 file/database/symbol/folder/web",
        },
        {
            "type": "web",
            "label": "Web 搜索",
            "budgetRatio": SOURCE_BUDGET_RATIOS["web"],
            "description": "外部 Web 搜索结果(可选项)",
        },
        {
            "type": "database",
            "label": "DB Schema",
            "budgetRatio": SOURCE_BUDGET_RATIOS["database"],
            "description": "数据库表结构定义(information_schema)",
        },
    ]
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "sources": source_defs,
            "defaultBudget": DEFAULT_CONTEXT_BUDGET,
        },
    }
