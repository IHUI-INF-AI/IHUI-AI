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
import os
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

# Redis key 前缀(2026-07-22 深化立)
_REDIS_KEY_BEHAVIOR = "context:behavior"
_REDIS_KEY_COMPRESSION = "context:compression"
_REDIS_KEY_SUMMARY = "context:summary"
_REDIS_KEY_VIZ = "context:viz"

# 历史/可视化记录上限
COMPRESSION_HISTORY_LIMIT = 100
VIZ_HISTORY_LIMIT = 100

# 用户行为 boost 分段(2026-07-22 深化立)
# (count_low, count_high, boost_low, boost_high)
_BEHAVIOR_BOOST_BANDS: list[tuple[int, int, float, float]] = [
    (0, 0, 0.0, 0.0),
    (1, 5, 0.1, 0.3),
    (6, 20, 0.3, 0.6),
    (21, 100000, 0.6, 1.0),
]


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
        # 用户行为记录(内存降级):{file:symbol: count}
        self._user_behavior: dict[str, int] = {}
        # 压缩事件历史(内存降级)
        self._compression_events: list[dict[str, Any]] = []
        # Redis 客户端(惰性创建)
        self._redis_client: Any = None

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
        user_id: str = "",
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
        task_type: str = "default",
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
            task_type: 任务类型(code/chat/data/default,预留用于未来动态调整比例)。

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
        user_id: str = "",
    ) -> dict[str, Any]:
        """两层集成入口:合并 @ 提及 + RAG 检索结果(2026-07-22 立,2026-07-22 深化)。

        流程:
        1. 将 @ 提及结果转为统一上下文条目(type=mention, relevance=1.0 用户显式选择)
        2. symbol 提及增强(2026-07-22 深化立):调用 _extract_symbol_signature
           注入完整签名(函数/类/方法)+ docstring 到上下文
        3. 用户行为记录(2026-07-22 深化立):@ 提及触发 _record_user_behavior,
           持久化到 Redis hash "context:behavior:{userId}"
        4. 若有 query,调用 retrieve_and_enrich 检索 history + codebase 上下文
        5. 多源融合 _merge_context:去重 + 按 relevance DESC 排序 + token 截断
           + behavior_boost(用户行为学习)
        6. 拼接为 enrichedContext 文本 + 返回 sources 明细

        Args:
            mentions: @ 提及结果列表,每条含 {type, label, detail, insertText, meta}
            conversation_id: 会话 ID(summary 持久化 key)。
            query: 用户当前问题(用于 RAG 检索,为空时跳过 RAG)。
            messages: 当前会话消息历史(为空时仅检索 codebase)。
            total_budget: 总 token 预算。
            user_id: 用户 ID(2026-07-22 深化立,行为学习 + 偏好持久化 key)。

        Returns:
            {
                "enrichedContext": str,  # 拼接后的上下文文本(供 LLM 注入)
                "tokenCount": int,        # enrichedContext 的 token 数
                "sources": [              # 各源条目明细(供前端展示)
                    {"type", "content", "relevance", "source", "metadata"},
                    ...
                ],
                "conversationId": str,
                "taskType": str,          # 检测到的任务类型(2026-07-22 深化立)
            }
        """
        # 任务类型检测(2026-07-22 深化立)
        task_type = self._detect_task_type(query) if query else "default"

        # 1. @ 提及条目转为统一上下文(relevance=1.0,用户显式选择)
        unified: list[dict[str, Any]] = []
        for m in mentions:
            content = self._mention_to_content(m)
            if not content:
                continue
            mtype = str(m.get("type", "unknown"))
            meta = m.get("meta", {}) or {}

            # symbol 提及增强:注入完整签名 + docstring(2026-07-22 深化立)
            signature_block = ""
            if mtype == "symbol":
                sym_name = str(meta.get("symbolName", "")) or str(m.get("label", ""))
                file_path = str(meta.get("filePath", ""))
                if sym_name and file_path:
                    try:
                        sig = self._extract_symbol_signature(file_path, sym_name)
                        if sig:
                            signature_block = self._format_signature(sig)
                            # 把签名元数据合并进 metadata(供 _merge_context behavior_boost 用)
                            meta = {**meta, "signature": sig}
                    except Exception as e:
                        logger.debug("符号签名提取失败 %s:%s: %s", file_path, sym_name, e)

            # 用户行为记录(2026-07-22 深化立,@ 提及触发)
            if user_id:
                file_path = str(meta.get("path") or meta.get("filePath") or "")
                sym_name = str(meta.get("symbolName", ""))
                if file_path:
                    try:
                        await self._record_user_behavior(
                            file_path, sym_name or None, user_id
                        )
                    except Exception as e:
                        logger.debug("用户行为记录失败: %s", e)

            full_content = content
            if signature_block:
                full_content = f"{content}\n\n签名:\n{signature_block}".rstrip()

            unified.append({
                "type": "mention",
                "content": full_content,
                "relevance": 1.0,
                "source": f"mention:{mtype}",
                "metadata": {
                    "mention_type": mtype,
                    "label": m.get("label"),
                    "insert_text": m.get("insertText"),
                    "file_path": str(meta.get("path") or meta.get("filePath") or ""),
                    "symbol_name": str(meta.get("symbolName", "")),
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

        # 3. 多源融合(去重 + 排序 + 截断 + behavior_boost)
        merged = self._merge_context(
            unified, total_budget=total_budget, user_id=user_id
        )

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
            "taskType": task_type,
        }

    def manage_window(
        self,
        messages: list[dict[str, Any]],
        model: str = "gpt-4o",
        context_limit: int = 128000,
        reserve_tokens: int = 4096,
        active_sources: list[str] | None = None,
        user_message: str = "",
    ) -> list[dict[str, Any]]:
        """context window 管理:超限时从头部截断(保留 system + 最新消息)。

        - reserve_tokens: 为模型输出预留的 token 数
        - 截断策略:保留首条 system + 末尾 N 条(直到不超限)
        - active_sources: 实际参与的上下文源类型列表(如 ["history","codebase","mention"]),
                         用于 _allocate_budget 按源比例分配 history 预算(2026-07-22 立)。
                         为 None 时退化为原逻辑(available 全部给 history)。
        - user_message: 用户当前消息(2026-07-22 深化立),用于 _detect_task_type
                       动态选择预算比例(code/chat/data/default)。
                       为空字符串时使用 default 比例。
        """
        available = context_limit - reserve_tokens
        if available <= 0:
            available = context_limit // 2

        # 按源预算分配:若提供 active_sources,history 只占其分配份额
        if active_sources:
            task_type = self._detect_task_type(user_message) if user_message else "default"
            budgets = self._allocate_budget(
                active_sources, total=available, task_type=task_type
            )
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

    # ------------------------------------------------------------------
    # 任务类型检测 + Redis 客户端(2026-07-23 补齐)
    # ------------------------------------------------------------------

    def _detect_task_type(self, message: str) -> str:
        """检测用户消息的任务类型(code/chat/data/default)。"""
        if not message or not message.strip():
            return "default"
        lower = message.lower()
        code_keywords = [
            "代码", "函数", "实现", "bug", "修复", "refactor", "code",
            "function", "implement", "fix", "class", "方法", "接口",
        ]
        if any(kw in lower for kw in code_keywords):
            return "code"
        data_keywords = [
            "数据", "查询", "统计", "报表", "data", "query", "stats",
            "report", "sql", "数据库",
        ]
        if any(kw in lower for kw in data_keywords):
            return "data"
        chat_keywords = [
            "聊天", "对话", "聊聊", "chat", "talk", "你好", "hello",
        ]
        if any(kw in lower for kw in chat_keywords):
            return "chat"
        return "default"

    async def _get_redis(self) -> Any:
        """获取 Redis 客户端(惰性从 settings 创建,降级 None)。"""
        if self._redis_client is not None:
            return self._redis_client
        try:
            from ..core.config import settings
            if not getattr(settings, "redis_url", ""):
                return None
            try:
                import redis.asyncio as aioredis  # type: ignore[import-not-found]
            except ImportError:
                return None
            self._redis_client = aioredis.from_url(
                settings.redis_url, decode_responses=True
            )
            await self._redis_client.ping()
            return self._redis_client
        except Exception as e:
            logger.debug("Redis 不可用,降级内存: %s", e)
            self._redis_client = None
            return None

    # ------------------------------------------------------------------
    # AST 符号签名提取(2026-07-22 深化立)
    # ------------------------------------------------------------------

    def _extract_symbol_signature(
        self,
        file_path: str,
        symbol_name: str,
    ) -> dict[str, Any]:
        """提取符号完整签名(复用 codebase_indexer 的 tree-sitter parser)。

        支持提取:
        - 函数签名:函数名 + 参数列表(参数名 + 类型)+ 返回类型 + 泛型
        - 类签名:类名 + 父类 + 实现的接口 + 泛型
        - 方法签名:所属类 + 方法名 + 参数 + 返回类型
        - docstring/comment:如函数有 docstring/comment,一并提取

        降级:tree-sitter 不可用 / 文件不存在 / 符号未找到 → 返回空 dict。

        Args:
            file_path: 符号所在文件绝对/相对路径。
            symbol_name: 符号名(函数名 / 类名 / 方法名)。

        Returns:
            {
                "name": str,
                "type": str,           # function/class/method/interface/type/enum
                "signature": str,      # 完整签名文本(单行,不含 body)
                "params": [{"name", "type", "default"}],
                "return_type": str,
                "generics": str,       # 泛型参数文本(如 "<T>")
                "parent_class": str,   # 方法所属类(仅 method,其他为空)
                "superclass": str,     # 类父类(仅 class)
                "interfaces": [str],   # 类实现的接口(仅 class)
                "docstring": str,
                "file_path": str,
                "line_start": int,
                "line_end": int,
                "language": str,
            }
            未找到符号 / 解析失败 → 空 dict。
        """
        ext = os.path.splitext(file_path)[1].lower()
        try:
            from .codebase_indexer import _EXT_TO_LANG, codebase_indexer
        except Exception as e:
            logger.debug("codebase_indexer 不可用: %s", e)
            return {}

        language = _EXT_TO_LANG.get(ext)
        if not language:
            return {}

        # 读文件
        try:
            with open(file_path, "rb") as f:
                content_bytes = f.read()
        except Exception as e:
            logger.debug("读取文件失败 %s: %s", file_path, e)
            return {}
        content = content_bytes.decode("utf-8", errors="replace")

        # 用 tree-sitter 解析(复用 codebase_indexer 的 parser)
        parser = codebase_indexer._get_parser(language)
        if not parser:
            return self._extract_signature_regex(
                content, file_path, symbol_name, language
            )

        try:
            tree = parser.parse(content_bytes)
        except Exception as e:
            logger.debug("AST 解析失败 %s: %s", file_path, e)
            return self._extract_signature_regex(
                content, file_path, symbol_name, language
            )

        # 遍历 AST 找符号
        found = self._find_symbol_node(tree.root_node, symbol_name, language)
        if not found:
            return self._extract_signature_regex(
                content, file_path, symbol_name, language
            )

        node, parent_class = found
        return self._build_signature_dict(
            node, parent_class, content, language, file_path
        )

    def _find_symbol_node(
        self,
        root: Any,
        symbol_name: str,
        language: str,
        parent_class: str = "",
    ) -> Optional[tuple[Any, str]]:
        """递归遍历 AST,找到名称匹配的符号节点。

        Returns:
            (node, parent_class) 元组(parent_class 仅 method 非空);未找到返回 None。
        """
        # 复用 codebase_indexer 的符号节点类型映射
        try:
            from .codebase_indexer import codebase_indexer

            symbol_node_types = codebase_indexer._SYMBOL_NODE_TYPES
        except Exception:
            symbol_node_types = {}

        for node in self._walk_ast(root):
            node_type = node.type
            if node_type in symbol_node_types:
                sym_type, name_field = symbol_node_types[node_type]
                name = self._node_text(node.child_by_field_name(name_field))
                if name == symbol_name:
                    return node, parent_class
                # 递归进入 class 体找方法(parent_class = 当前类名)
                if sym_type == "class":
                    inner = self._find_symbol_node(
                        node, symbol_name, language, parent_class=name
                    )
                    if inner:
                        return inner
            # TS method_definition / class body 内的方法
            elif node_type in ("method_definition", "function_signature", "method_signature"):
                name = self._node_text(node.child_by_field_name("name"))
                if name == symbol_name:
                    return node, parent_class
        return None

    @staticmethod
    def _walk_ast(root: Any):
        """先序遍历 AST 节点生成器。"""
        stack = [root]
        while stack:
            node = stack.pop()
            yield node
            # 反向入栈保证 children 顺序遍历
            for child in reversed(getattr(node, "children", []) or []):
                stack.append(child)

    @staticmethod
    def _node_text(node: Any) -> str:
        """安全读取 AST 节点 text。"""
        if node is None or not getattr(node, "text", None):
            return ""
        try:
            return node.text.decode("utf-8", errors="replace")
        except Exception:
            return ""

    def _build_signature_dict(
        self,
        node: Any,
        parent_class: str,
        content: str,
        language: str,
        file_path: str,
    ) -> dict[str, Any]:
        """从 AST 节点构建签名字典(按节点类型分派)。"""
        node_type = node.type
        line_start = node.start_point[0] + 1
        line_end = node.end_point[0] + 1

        result: dict[str, Any] = {
            "name": "",
            "type": "function",
            "signature": "",
            "params": [],
            "return_type": "",
            "generics": "",
            "parent_class": parent_class,
            "superclass": "",
            "interfaces": [],
            "docstring": "",
            "file_path": file_path,
            "line_start": line_start,
            "line_end": line_end,
            "language": language,
        }

        # 提取各字段(不同语言节点字段名略有差异,统一用 child_by_field_name)
        name_node = node.child_by_field_name("name")
        result["name"] = self._node_text(name_node)

        # 泛型(Python type_params / TS type_parameters)
        generics = ""
        for field in ("type_parameters", "type_params"):
            tn = node.child_by_field_name(field)
            if tn:
                generics = self._node_text(tn)
                break
        result["generics"] = generics

        # 参数列表
        params_node = node.child_by_field_name("parameters")
        params = self._extract_params(params_node, language)
        result["params"] = params

        # 返回类型
        ret_node = node.child_by_field_name("return_type")
        result["return_type"] = self._node_text(ret_node).lstrip(":-> ").strip()

        # 类继承(Python superclasses / TS heritage)
        if node_type in ("class_declaration", "class_definition", "struct_item"):
            result["type"] = "class"
            superclass, interfaces = self._extract_classheritage(node, language)
            result["superclass"] = superclass
            result["interfaces"] = interfaces
        elif node_type in ("interface_declaration", "trait_item"):
            result["type"] = "interface"
        elif node_type in ("method_definition", "method_declaration", "method_signature"):
            result["type"] = "method"
        elif node_type in ("function_definition", "function_declaration", "function_item", "function_signature"):
            result["type"] = "function"
        elif node_type == "type_alias_declaration":
            result["type"] = "type"
        elif node_type == "enum_declaration":
            result["type"] = "enum"

        # 构建签名文本(从声明起始到 body 起始之前)
        body_node = node.child_by_field_name("body")
        if body_node:
            sig_end = body_node.start_byte
            sig_text = content[node.start_byte:sig_end].strip().rstrip(":").rstrip("{").strip()
        else:
            # 无 body(如 function_signature):直接用节点文本首行
            sig_text = self._node_text(node).split("\n", 1)[0].strip()
        result["signature"] = sig_text

        # docstring / 注释
        result["docstring"] = self._extract_docstring(node, content, language)

        return result

    def _extract_params(self, params_node: Any, language: str) -> list[dict[str, str]]:
        """从参数列表 AST 节点提取参数 [{name, type, default}]。"""
        if not params_node:
            return []
        params: list[dict[str, str]] = []
        for child in getattr(params_node, "children", []) or []:
            # 跳过括号 / 逗号 / 注解
            if child.type in ("(", ")", ",", "(", ")", "comment"):
                continue
            # 不同语言的参数节点类型:parameter / formal_parameter / identifier / typed_parameter
            name = ""
            type_str = ""
            default = ""
            # 优先用字段名(Python typed_parameter 等)
            name_child = child.child_by_field_name("name")
            type_child = child.child_by_field_name("type")
            default_child = child.child_by_field_name("default_value") or child.child_by_field_name("default")
            if name_child:
                name = self._node_text(name_child)
            elif child.type in ("identifier", "property_identifier"):
                name = self._node_text(child)
            if type_child:
                type_str = self._node_text(type_child).strip(": ").strip()
            if default_child:
                default = self._node_text(default_child).lstrip("=").strip()
            # 兜底:直接取 child 文本(去掉前后括号/逗号)
            if not name and not type_str:
                raw = self._node_text(child).strip().strip(",").strip()
                if raw and raw not in ("(", ")", ",", "self", "cls"):
                    name = raw
            if name or type_str:
                params.append({"name": name, "type": type_str, "default": default})
        return params

    def _extract_classheritage(
        self, node: Any, language: str
    ) -> tuple[str, list[str]]:
        """从类节点提取父类 + 实现的接口(返回 (superclass, [interfaces]))。"""
        superclass = ""
        interfaces: list[str] = []

        if language == "python":
            # Python: argument_list 中的基类
            args_node = node.child_by_field_name("superclasses")
            if args_node:
                for child in getattr(args_node, "children", []) or []:
                    if child.type == "argument_list":
                        continue
                    text = self._node_text(child).strip()
                    if text and text not in ("(", ")", ","):
                        if not superclass:
                            superclass = text
                        else:
                            interfaces.append(text)
        else:
            # TS/JS: heritage_clause 子节点
            for child in getattr(node, "children", []) or []:
                if child.type != "heritage_clause":
                    continue
                for hc in getattr(child, "children", []) or []:
                    text = self._node_text(hc).strip()
                    if not text or text in ("extends", "implements", ","):
                        continue
                    # 取类型名(去掉泛型参数)
                    name = text.split("<", 1)[0].strip()
                    # 区分 extends / implements
                    heritage_type = self._node_text(child.child_by_field_name("type"))
                    if heritage_type == "extends":
                        superclass = name
                    else:
                        interfaces.append(name)

        return superclass, interfaces

    def _extract_docstring(
        self, node: Any, content: str, language: str
    ) -> str:
        """提取符号的 docstring / 注释(Python docstring 或 TS/JS JSDoc)。"""
        # Python:body 首条 expression_statement 是 string(docstring)
        body_node = node.child_by_field_name("body")
        if body_node and language == "python":
            for child in getattr(body_node, "children", []) or []:
                if child.type == "expression_statement":
                    for sub in getattr(child, "children", []) or []:
                        if sub.type == "string":
                            raw = self._node_text(sub)
                            return raw.strip("\"'").strip()
                break  # 只看首条

        # TS/JS:查找前一个兄弟节点(comment 块,通常是 JSDoc /** ... */)
        parent = getattr(node, "parent", None)
        if parent:
            prev = None
            for child in getattr(parent, "children", []) or []:
                if child is node:
                    break
                prev = child
            if prev and prev.type == "comment":
                return self._node_text(prev).strip()

        return ""

    def _extract_signature_regex(
        self,
        content: str,
        file_path: str,
        symbol_name: str,
        language: str,
    ) -> dict[str, Any]:
        """正则降级:从内容中匹配符号声明行作为签名(无 AST 时的兜底)。"""
        import re

        patterns_by_lang = {
            "python": [
                (r"^\s*(?:async\s+)?def\s+" + re.escape(symbol_name) + r"\s*\(([^)]*)\)(?:\s*->\s*([^\n:]+))?", "function"),
                (r"^\s*class\s+" + re.escape(symbol_name) + r"\s*(?:\(([^)]*)\))?", "class"),
            ],
            "typescript": [
                (r"^\s*(?:export\s+)?(?:async\s+)?function\s+" + re.escape(symbol_name) + r"\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^\n{]+))?", "function"),
                (r"^\s*(?:export\s+)?(?:abstract\s+)?class\s+" + re.escape(symbol_name) + r"\s*(?:<[^>]*>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?", "class"),
            ],
            "javascript": [
                (r"^\s*(?:export\s+)?(?:async\s+)?function\s+" + re.escape(symbol_name) + r"\s*\(([^)]*)\)", "function"),
                (r"^\s*(?:export\s+)?class\s+" + re.escape(symbol_name) + r"\s*(?:\s+extends\s+(\w+))?", "class"),
            ],
        }
        patterns = patterns_by_lang.get(language, [])
        for pattern, sym_type in patterns:
            for m in re.finditer(pattern, content, re.MULTILINE):
                line_idx = content.count("\n", 0, m.start()) + 1
                return {
                    "name": symbol_name,
                    "type": sym_type,
                    "signature": m.group(0).strip(),
                    "params": [],
                    "return_type": (m.group(2) if m.lastindex and m.lastindex >= 2 else "").strip(),
                    "generics": "",
                    "parent_class": "",
                    "superclass": (m.group(1) if sym_type == "class" and m.lastindex and m.lastindex >= 1 else "").strip(),
                    "interfaces": [],
                    "docstring": "",
                    "file_path": file_path,
                    "line_start": line_idx,
                    "line_end": line_idx,
                    "language": language,
                }
        return {}

    @staticmethod
    def _format_signature(sig: dict[str, Any]) -> str:
        """格式化签名字典为可读文本块(注入上下文用)。"""
        if not sig:
            return ""
        lines: list[str] = []
        sym_type = str(sig.get("type", "function"))
        name = str(sig.get("name", ""))
        lines.append(f"[{sym_type}] {name}{sig.get('generics', '')}")

        sig_text = str(sig.get("signature", ""))
        if sig_text:
            lines.append(f"声明: {sig_text}")

        params = sig.get("params", []) or []
        if params:
            param_strs = []
            for p in params:
                p_name = str(p.get("name", ""))
                p_type = str(p.get("type", ""))
                p_default = str(p.get("default", ""))
                if p_type and p_default:
                    param_strs.append(f"{p_name}: {p_type} = {p_default}")
                elif p_type:
                    param_strs.append(f"{p_name}: {p_type}")
                elif p_name:
                    param_strs.append(p_name)
            lines.append("参数: " + ", ".join(param_strs))

        ret = str(sig.get("return_type", ""))
        if ret:
            lines.append(f"返回: {ret}")

        parent = str(sig.get("parent_class", ""))
        if parent:
            lines.append(f"所属类: {parent}")

        supercls = str(sig.get("superclass", ""))
        if supercls:
            lines.append(f"继承: {supercls}")

        ifaces = sig.get("interfaces", []) or []
        if ifaces:
            lines.append(f"实现接口: {', '.join(ifaces)}")

        location = f"{sig.get('file_path', '')}:{sig.get('line_start', '')}"
        if sig.get('line_end') and sig.get('line_end') != sig.get('line_start'):
            location += f"-{sig.get('line_end')}"
        if location.strip(":"):
            lines.append(f"位置: {location}")

        doc = str(sig.get("docstring", ""))
        if doc:
            lines.append(f"文档: {doc}")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # 用户行为学习(2026-07-22 深化立)
    # ------------------------------------------------------------------

    async def _record_user_behavior(
        self,
        file_path: str,
        symbol: Optional[str],
        user_id: str,
    ) -> None:
        """记录用户访问文件/符号的行为(从 @ 提及触发)。

        持久化:Redis hash "context:behavior:{userId}"(field=file:symbol,value=count)。
        降级:Redis 不可用时用内存 dict。
        """
        if not file_path or not user_id:
            return
        key = f"{file_path}:{symbol}" if symbol else file_path
        redis = await self._get_redis()
        if redis:
            try:
                await redis.hincrby(f"{_REDIS_KEY_BEHAVIOR}:{user_id}", key, 1)
                return
            except Exception as e:
                logger.debug("Redis hincrby 行为失败,降级内存: %s", e)
        # 内存降级
        self._user_behavior[key] = self._user_behavior.get(key, 0) + 1

    async def _get_behavior_boost(
        self,
        file_path: str,
        symbol: Optional[str],
        user_id: str,
    ) -> float:
        """返回 0-1 的行为 boost 因子(基于访问次数分段)。

        分段(_BEHAVIOR_BOOST_BANDS):
        - 访问次数 0:boost=0
        - 访问次数 1-5:boost=0.1-0.3
        - 访问次数 6-20:boost=0.3-0.6
        - 访问次数 >20:boost=0.6-1.0

        Args:
            file_path: 文件路径。
            symbol: 符号名(可选)。
            user_id: 用户 ID。

        Returns:
            0-1 之间的 boost 因子。
        """
        if not file_path or not user_id:
            return 0.0
        key = f"{file_path}:{symbol}" if symbol else file_path
        count = 0
        redis = await self._get_redis()
        if redis:
            try:
                raw = await redis.hget(f"{_REDIS_KEY_BEHAVIOR}:{user_id}", key)
                count = int(raw) if raw else 0
            except Exception as e:
                logger.debug("Redis hget 行为失败,降级内存: %s", e)
                count = self._user_behavior.get(key, 0)
        else:
            count = self._user_behavior.get(key, 0)

        if count <= 0:
            return 0.0
        # 按分段线性插值
        for low, high, b_low, b_high in _BEHAVIOR_BOOST_BANDS:
            if low <= count <= high:
                if high == low:
                    return b_low
                # 线性插值
                ratio = (count - low) / (high - low)
                return round(b_low + (b_high - b_low) * ratio, 3)
        return 0.0

    async def _get_user_preferences(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        """获取用户长期偏好(常访问的文件/符号,按访问次数倒序)。

        Returns:
            [{"key", "count"}] 列表,最多 limit 条。
        """
        if not user_id:
            return []
        redis = await self._get_redis()
        if redis:
            try:
                raw = await redis.hgetall(f"{_REDIS_KEY_BEHAVIOR}:{user_id}")
                items = [
                    {"key": k, "count": int(v)}
                    for k, v in raw.items()
                    if v and int(v) > 0
                ]
                items.sort(key=lambda x: x["count"], reverse=True)
                return items[:limit]
            except Exception as e:
                logger.debug("Redis hgetall 偏好失败: %s", e)
        # 内存降级
        items = [
            {"key": k, "count": v}
            for k, v in self._user_behavior.items()
            if v > 0
        ]
        items.sort(key=lambda x: x["count"], reverse=True)
        return items[:limit]

    # ------------------------------------------------------------------
    # 压缩质量评估(2026-07-22 深化立)
    # ------------------------------------------------------------------

    async def _evaluate_compression_quality(
        self,
        old_messages: list[dict[str, Any]],
        summary: str,
    ) -> float:
        """评估压缩质量:用 summary 回答"最后 5 条消息讨论了什么",LLM 评分 0-1。

        降级:LLM 评估失败时返回 0.0(仅记录压缩比,跳过质量分)。

        Args:
            old_messages: 被压缩的早期消息列表。
            summary: 压缩后的摘要文本。

        Returns:
            0-1 质量分(0 表示未评估 / 评估失败)。
        """
        if not old_messages or not summary:
            return 0.0
        # 取最后 5 条消息作为评估基准
        last_5 = old_messages[-5:]
        if not last_5:
            return 0.0

        original_text = "\n".join(
            f"[{m.get('role', 'unknown')}] {str(m.get('content', ''))[:500]}"
            for m in last_5
        )[:3000]

        prompt = (
            "请评估以下摘要是否准确覆盖了原文最后 5 条消息的要点。\n\n"
            f"【原文最后 5 条】\n{original_text}\n\n"
            f"【摘要】\n{summary[:2000]}\n\n"
            "请只输出 0-1 之间的数字评分(1 表示完全覆盖,0 表示完全未覆盖),"
            "保留 2 位小数,不要输出其他内容。"
        )
        try:
            resp = await llm_gateway.complete(
                messages=[{"role": "user", "content": prompt}],
                model="gpt-4o-mini",
                temperature=0.0,
                max_tokens=20,
            )
            content = resp.get("content", "") if isinstance(resp, dict) else str(resp)
            # 提取数字
            import re

            m = re.search(r"([01](?:\.\d+)?)", content.strip())
            if m:
                score = float(m.group(1))
                return max(0.0, min(1.0, score))
            return 0.0
        except Exception as e:
            logger.debug("压缩质量评估失败(降级跳过): %s", e)
            return 0.0

    async def _record_compression_event(
        self,
        user_id: str,
        conversation_id: str,
        tokens_before: int,
        tokens_after: int,
        compression_ratio: float,
        quality_score: float,
        removed_count: int,
    ) -> None:
        """记录压缩事件到 Redis list(降级内存)。"""
        import json

        event = {
            "timestamp": time.time(),
            "conversation_id": conversation_id,
            "tokens_before": tokens_before,
            "tokens_after": tokens_after,
            "compression_ratio": round(compression_ratio, 4),
            "quality_score": round(quality_score, 4),
            "removed_count": removed_count,
        }
        # 用 user_id 作为 key(为空时用 "_global")
        key_user = user_id or "_global"
        redis = await self._get_redis()
        if redis:
            try:
                list_key = f"{_REDIS_KEY_COMPRESSION}:{key_user}"
                await redis.lpush(list_key, json.dumps(event, ensure_ascii=False))
                await redis.ltrim(list_key, 0, COMPRESSION_HISTORY_LIMIT - 1)
                return
            except Exception as e:
                logger.debug("Redis 压缩事件记录失败,降级内存: %s", e)
        # 内存降级
        self._compression_events.append(event)
        # 仅保留最近 N 条
        if len(self._compression_events) > COMPRESSION_HISTORY_LIMIT:
            self._compression_events = self._compression_events[-COMPRESSION_HISTORY_LIMIT:]

    async def _get_compression_stats(self, user_id: str) -> dict[str, Any]:
        """获取压缩统计:平均压缩比、平均质量分、最近 10 次压缩详情。"""
        import json

        key_user = user_id or "_global"
        events: list[dict[str, Any]] = []
        redis = await self._get_redis()
        if redis:
            try:
                raw = await redis.lrange(
                    f"{_REDIS_KEY_COMPRESSION}:{key_user}", 0, 9
                )
                events = [json.loads(r) for r in raw if r]
            except Exception as e:
                logger.debug("Redis 压缩统计读取失败: %s", e)
                events = list(self._compression_events[-10:])
        else:
            events = list(self._compression_events[-10:])

        if not events:
            return {
                "totalEvents": 0,
                "avgCompressionRatio": 0.0,
                "avgQualityScore": 0.0,
                "recentEvents": [],
            }

        ratios = [float(e.get("compression_ratio", 0)) for e in events]
        scores = [float(e.get("quality_score", 0)) for e in events]
        return {
            "totalEvents": len(events),
            "avgCompressionRatio": round(sum(ratios) / len(ratios), 4) if ratios else 0.0,
            "avgQualityScore": round(sum(scores) / len(scores), 4) if scores else 0.0,
            "recentEvents": events[:10],
        }

    # ------------------------------------------------------------------
    # 上下文持久化(跨会话记忆,2026-07-22 深化立)
    # ------------------------------------------------------------------

    async def _persist_summary(self, conversation_id: str, summary: str) -> None:
        """持久化会话 summary 到 Redis hash "context:summary:{conversationId}"。"""
        if not conversation_id or not summary:
            return
        redis = await self._get_redis()
        if redis:
            try:
                # 单 field "latest" 存最新 summary(可扩展为多版本)
                await redis.hset(
                    f"{_REDIS_KEY_SUMMARY}:{conversation_id}",
                    "latest",
                    summary,
                )
                # 同时记录时间戳
                await redis.hset(
                    f"{_REDIS_KEY_SUMMARY}:{conversation_id}",
                    "updated_at",
                    str(time.time()),
                )
            except Exception as e:
                logger.debug("Redis summary 持久化失败: %s", e)

    async def load_session_summary(self, conversation_id: str) -> str:
        """加载会话历史 summary(新会话开始时作为初始上下文)。

        Args:
            conversation_id: 会话 ID。

        Returns:
            上次压缩的 summary 文本,无则空字符串。
        """
        if not conversation_id:
            return ""
        redis = await self._get_redis()
        if redis:
            try:
                return str(
                    await redis.hget(
                        f"{_REDIS_KEY_SUMMARY}:{conversation_id}", "latest"
                    ) or ""
                )
            except Exception as e:
                logger.debug("Redis summary 加载失败: %s", e)
        return ""

    async def _get_session_memory(
        self, conversation_id: str, user_id: str
    ) -> dict[str, Any]:
        """获取会话记忆(summary + 用户偏好)。"""
        summary = ""
        if conversation_id:
            summary = await self.load_session_summary(conversation_id)
        preferences: list[dict[str, Any]] = []
        if user_id:
            preferences = await self._get_user_preferences(user_id, limit=20)
        return {
            "conversationId": conversation_id,
            "summary": summary,
            "preferences": preferences,
        }

    async def _clear_session_memory(self, conversation_id: str) -> bool:
        """清除会话记忆(summary)。"""
        if not conversation_id:
            return False
        redis = await self._get_redis()
        if redis:
            try:
                await redis.delete(f"{_REDIS_KEY_SUMMARY}:{conversation_id}")
                return True
            except Exception as e:
                logger.debug("Redis summary 清除失败: %s", e)
                return False
        return True

    # ------------------------------------------------------------------
    # token 可视化(2026-07-22 深化立)
    # ------------------------------------------------------------------

    async def record_visualization(
        self,
        conversation_id: str,
        token_data: dict[str, Any],
    ) -> None:
        """记录当前会话 token 分布(前端定期调用)。

        存 Redis list "context:viz:{conversationId}"(LPUSH + LTRIM 100 条)。
        """
        import json

        if not conversation_id or not token_data:
            return
        entry = {
            "timestamp": time.time(),
            "total_tokens": int(token_data.get("totalTokens", 0)),
            "history_tokens": int(token_data.get("historyTokens", 0)),
            "codebase_tokens": int(token_data.get("codebaseTokens", 0)),
            "mention_tokens": int(token_data.get("mentionTokens", 0)),
            "web_tokens": int(token_data.get("webTokens", 0)),
            "database_tokens": int(token_data.get("databaseTokens", 0)),
        }
        redis = await self._get_redis()
        if redis:
            try:
                list_key = f"{_REDIS_KEY_VIZ}:{conversation_id}"
                await redis.lpush(list_key, json.dumps(entry, ensure_ascii=False))
                await redis.ltrim(list_key, 0, VIZ_HISTORY_LIMIT - 1)
                return
            except Exception as e:
                logger.debug("Redis 可视化记录失败: %s", e)

    async def get_visualization(
        self, conversation_id: str, user_id: str = ""
    ) -> dict[str, Any]:
        """获取可视化数据:饼图 + 历史趋势 + 压缩事件。

        Returns:
            {
                "pie": [{"source", "tokens"}],      # 最新一条的源分布
                "trend": [{"timestamp", "total_tokens", "history_tokens", ...}],
                "compressions": [...],              # 最近 10 次压缩事件
            }
        """
        import json

        pie: list[dict[str, Any]] = []
        trend: list[dict[str, Any]] = []

        if conversation_id:
            redis = await self._get_redis()
            if redis:
                try:
                    raw_list = await redis.lrange(
                        f"{_REDIS_KEY_VIZ}:{conversation_id}", 0, VIZ_HISTORY_LIMIT - 1
                    )
                    items = [json.loads(r) for r in raw_list if r]
                    # 倒序(最新在前)→ 反转为时间正序
                    items.reverse()
                    if items:
                        latest = items[-1]
                        pie = [
                            {"source": "history", "tokens": latest.get("history_tokens", 0)},
                            {"source": "codebase", "tokens": latest.get("codebase_tokens", 0)},
                            {"source": "mention", "tokens": latest.get("mention_tokens", 0)},
                            {"source": "web", "tokens": latest.get("web_tokens", 0)},
                            {"source": "database", "tokens": latest.get("database_tokens", 0)},
                        ]
                        trend = items
                except Exception as e:
                    logger.debug("Redis 可视化读取失败: %s", e)

        # 压缩事件
        stats = await self._get_compression_stats(user_id)
        compressions = stats.get("recentEvents", [])

        return {
            "pie": pie,
            "trend": trend,
            "compressions": compressions,
        }


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
    userId: str = Field("", description="用户 ID(2026-07-22 深化立,行为学习 + 偏好持久化 key)")


router = APIRouter()


@router.post("/enrich")
async def enrich_endpoint(req: EnrichRequest) -> dict[str, Any]:
    """POST /api/context/enrich — @ 提及结果 + RAG 检索两层集成。

    输入:@ 提及结果 mentions + conversationId + query + messages(可选)+ totalBudget + userId
    输出:{ code, message, data: { enrichedContext, tokenCount, sources, conversationId, taskType } }

    流程:
    1. mentions 转为统一上下文条目(type=mention, relevance=1.0)
       - symbol 提及注入完整签名 + docstring(2026-07-22 深化立)
       - @ 提及触发 _record_user_behavior(行为学习,2026-07-22 深化立)
    2. 若有 query,调用 retrieve_and_enrich 检索 history + codebase 上下文
    3. _merge_context 多源融合(去重 + 排序 + 截断 + behavior_boost)
    """
    try:
        result = await context_engine.enrich_context(
            mentions=req.mentions,
            conversation_id=req.conversationId,
            query=req.query,
            messages=req.messages or [],
            total_budget=req.totalBudget,
            user_id=req.userId,
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


# ---------------------------------------------------------------------------
# 2026-07-22 深化立:可视化 / 压缩统计 / 会话记忆端点
# ---------------------------------------------------------------------------


class TrackVisualizationRequest(BaseModel):
    """POST /api/context/visualization/track 请求体。"""

    conversationId: str = Field(..., description="会话 ID")
    totalTokens: int = Field(0, ge=0, description="总 token 数")
    historyTokens: int = Field(0, ge=0, description="历史对话 token 数")
    codebaseTokens: int = Field(0, ge=0, description="代码库 token 数")
    mentionTokens: int = Field(0, ge=0, description="@ 提及 token 数")
    webTokens: int = Field(0, ge=0, description="Web 搜索 token 数")
    databaseTokens: int = Field(0, ge=0, description="DB schema token 数")


@router.post("/visualization/track")
async def track_visualization_endpoint(
    req: TrackVisualizationRequest,
) -> dict[str, Any]:
    """POST /api/context/visualization/track — 记录当前会话 token 分布(前端定期调用)。

    存 Redis list "context:viz:{conversationId}"(LPUSH + LTRIM 100 条)。
    """
    try:
        await context_engine.record_visualization(
            conversation_id=req.conversationId,
            token_data={
                "totalTokens": req.totalTokens,
                "historyTokens": req.historyTokens,
                "codebaseTokens": req.codebaseTokens,
                "mentionTokens": req.mentionTokens,
                "webTokens": req.webTokens,
                "databaseTokens": req.databaseTokens,
            },
        )
        return {"code": 0, "message": "ok", "data": {"recorded": True}}
    except Exception as e:
        logger.exception("track_visualization_endpoint failed: %s", e)
        return {"code": 500, "message": f"可视化记录失败: {e}", "data": None}


@router.get("/visualization")
async def visualization_endpoint(
    conversationId: str = "",
    userId: str = "",
) -> dict[str, Any]:
    """GET /api/context/visualization — 返回可视化数据(饼图 + 历史趋势 + 压缩事件)。

    Query:
        conversationId: 会话 ID(用于读取 token 分布历史)
        userId: 用户 ID(用于读取压缩事件,可空)

    输出:{ code, message, data: { pie: [...], trend: [...], compressions: [...] } }
    """
    try:
        data = await context_engine.get_visualization(conversationId, userId)
        return {"code": 0, "message": "ok", "data": data}
    except Exception as e:
        logger.exception("visualization_endpoint failed: %s", e)
        return {"code": 500, "message": f"可视化查询失败: {e}", "data": None}


@router.get("/compression-stats")
async def compression_stats_endpoint(userId: str = "") -> dict[str, Any]:
    """GET /api/context/compression-stats — 返回压缩统计(2026-07-22 深化立)。

    Query:
        userId: 用户 ID(为空时使用全局统计)

    输出:{ code, message, data: { totalEvents, avgCompressionRatio, avgQualityScore, recentEvents } }
    """
    try:
        data = await context_engine._get_compression_stats(userId)
        return {"code": 0, "message": "ok", "data": data}
    except Exception as e:
        logger.exception("compression_stats_endpoint failed: %s", e)
        return {"code": 500, "message": f"压缩统计查询失败: {e}", "data": None}


@router.get("/memory")
async def memory_endpoint(
    conversationId: str = "",
    userId: str = "",
) -> dict[str, Any]:
    """GET /api/context/memory — 返回会话记忆(summary + 用户偏好,2026-07-22 深化立)。

    Query:
        conversationId: 会话 ID(读取 summary)
        userId: 用户 ID(读取偏好,可空)

    输出:{ code, message, data: { conversationId, summary, preferences: [...] } }
    """
    try:
        data = await context_engine._get_session_memory(conversationId, userId)
        return {"code": 0, "message": "ok", "data": data}
    except Exception as e:
        logger.exception("memory_endpoint failed: %s", e)
        return {"code": 500, "message": f"会话记忆查询失败: {e}", "data": None}


@router.delete("/memory")
async def clear_memory_endpoint(conversationId: str = "") -> dict[str, Any]:
    """DELETE /api/context/memory — 清除会话记忆(2026-07-22 深化立)。

    Query:
        conversationId: 会话 ID(指定要清除 summary 的会话)

    输出:{ code, message, data: { cleared: bool } }
    """
    try:
        ok = await context_engine._clear_session_memory(conversationId)
        return {"code": 0, "message": "ok", "data": {"cleared": ok}}
    except Exception as e:
        logger.exception("clear_memory_endpoint failed: %s", e)
        return {"code": 500, "message": f"会话记忆清除失败: {e}", "data": None}
