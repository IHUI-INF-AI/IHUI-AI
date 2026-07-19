"""RAG(Retrieval-Augmented Generation)service。

完整 RAG 流程:
1. retrieve: 向量检索(从 vector_memory + memory_store 找 top-k 相关文档)
2. rerank:   可选 rerank(基于 score 阈值过滤 + 去重)
3. context:  拼接 context(模板化 system prompt 注入)
4. generate: LLM 生成(基于 context + 用户问题)
5. cite:     返回 sources(供前端展示引用)

复用现有的 vector_memory(MemoryStore + cosine similarity)
支持:
- cross-session 检索 / 限定 session 检索
- top_k + score_threshold 过滤
- context 长度限制(避免超出 LLM 窗口)
- stub 降级(无 embedding 时使用关键词 fallback)
- trace(每个阶段的耗时 + 命中数)
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from ..core.llm_gateway import llm_gateway
from .memory import memory_store
from .vector_memory import vector_memory


@dataclass
class RAGSource:
    """RAG 检索来源。"""

    session_id: str
    role: str
    content: str
    score: float
    timestamp: str = ""


@dataclass
class RAGResult:
    """RAG 完整结果。"""

    query: str
    answer: str
    sources: list[RAGSource]
    model: str
    context_tokens: int
    duration_ms: float
    stub: bool
    trace: list[dict[str, Any]] = field(default_factory=list)


class RAGService:
    """RAG 检索增强生成服务。"""

    # 默认 system prompt 模板
    DEFAULT_SYSTEM_TEMPLATE = (
        "你是基于检索增强的问答助手。请严格根据提供的上下文回答用户问题。\n"
        "规则:\n"
        "1. 仅使用 [CONTEXT] 标签内的信息回答,不引入外部知识\n"
        "2. 若上下文无相关信息,明确说明「未找到相关信息」\n"
        "3. 回答末尾用 [来源 N] 标注引用(若适用)\n"
        "\n[CONTEXT]\n{context}\n[/CONTEXT]"
    )

    def __init__(self) -> None:
        self._system_template = self.DEFAULT_SYSTEM_TEMPLATE

    def set_system_template(self, template: str) -> None:
        """设置自定义 system prompt 模板(需含 {context} 占位符)。"""
        self._system_template = template

    async def query(
        self,
        question: str,
        top_k: int = 5,
        session_id: str | None = None,
        score_threshold: float = 0.0,
        max_context_chars: int = 6000,
        model: str | None = None,
    ) -> RAGResult:
        """完整 RAG 流程:retrieve → rerank → context → generate。

        Args:
            question: 用户问题。
            top_k: 检索 top-k 条。
            session_id: 限定 session(空则跨会话)。
            score_threshold: score 阈值,低于此分数的源被过滤(0=不过滤)。
            max_context_chars: context 最大字符数(防止超 LLM 窗口)。
            model: 模型名称(空用默认)。

        Returns:
            RAGResult 含 answer + sources + trace。
        """
        start = time.monotonic()
        trace: list[dict[str, Any]] = []

        # 1. 检索
        t0 = time.monotonic()
        raw_sources = await self._retrieve(
            question, top_k=top_k, session_id=session_id
        )
        trace.append({
            "node": "retrieve",
            "duration_ms": round((time.monotonic() - t0) * 1000, 2),
            "raw_count": len(raw_sources),
        })

        # 2. 重排/过滤
        t0 = time.monotonic()
        filtered = self._rerank(raw_sources, score_threshold=score_threshold)
        trace.append({
            "node": "rerank",
            "duration_ms": round((time.monotonic() - t0) * 1000, 2),
            "filtered_count": len(filtered),
            "score_threshold": score_threshold,
        })

        # 3. 拼接 context
        t0 = time.monotonic()
        context, context_tokens = self._build_context(
            filtered, max_chars=max_context_chars
        )
        trace.append({
            "node": "context",
            "duration_ms": round((time.monotonic() - t0) * 1000, 2),
            "context_chars": len(context),
            "context_tokens": context_tokens,
        })

        # 4. 生成
        t0 = time.monotonic()
        answer, model_used, stub = await self._generate(
            question, context, model=model
        )
        trace.append({
            "node": "generate",
            "duration_ms": round((time.monotonic() - t0) * 1000, 2),
            "model": model_used,
            "stub": stub,
        })

        return RAGResult(
            query=question,
            answer=answer,
            sources=filtered,
            model=model_used,
            context_tokens=context_tokens,
            duration_ms=round((time.monotonic() - start) * 1000, 2),
            stub=stub,
            trace=trace,
        )

    async def add_document(
        self,
        session_id: str,
        content: str,
        role: str = "system",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """向 RAG 知识库添加文档(写入 vector_memory + memory)。"""
        await vector_memory.add(session_id, role, content, metadata)
        await memory_store.add(session_id, role, content, metadata)

    # =========================================================================
    # 私有:检索
    # =========================================================================

    async def _retrieve(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
    ) -> list[RAGSource]:
        """向量检索,失败 fallback 关键词检索。"""
        try:
            results = await vector_memory.search(
                query=query, top_k=top_k, session_id=session_id
            )
        except Exception:
            results = []
        if results:
            return [
                RAGSource(
                    session_id=str(r.get("session_id", "")),
                    role=str(r.get("role", "")),
                    content=str(r.get("content", "")),
                    score=float(r.get("score", 0.0)),
                    timestamp=str(r.get("timestamp", "")),
                )
                for r in results
            ]
        # Fallback: 关键词检索 memory_store
        return await self._keyword_fallback(query, top_k=top_k, session_id=session_id)

    async def _keyword_fallback(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
    ) -> list[RAGSource]:
        """无向量时的关键词检索(从 memory_store 拉消息,关键词打分)。"""
        try:
            sessions = (
                [session_id] if session_id else await memory_store.list_sessions()
            )
        except Exception:
            return []
        query_l = query.lower()
        scored: list[RAGSource] = []
        for sid in sessions:
            try:
                msgs = await memory_store.get(sid, limit=200)
            except Exception:
                continue
            for m in msgs:
                content = str(m.get("content", ""))
                if not content:
                    continue
                score = self._keyword_score(query_l, content.lower())
                if score <= 0:
                    continue
                scored.append(RAGSource(
                    session_id=sid,
                    role=str(m.get("role", "")),
                    content=content,
                    score=score,
                    timestamp=str(m.get("timestamp", "")),
                ))
        scored.sort(key=lambda x: x.score, reverse=True)
        return scored[:top_k]

    @staticmethod
    def _keyword_score(query_l: str, content_l: str) -> float:
        """简单关键词打分(命中关键词数 / 内容长度,粗略相关度)。"""
        if not query_l or not content_l:
            return 0.0
        keywords = [w for w in query_l.split() if len(w) >= 2]
        if not keywords:
            return 0.0
        hits = sum(1 for kw in keywords if kw in content_l)
        if hits == 0:
            # 单字符 / 中文:整串查询作为关键词
            if query_l in content_l:
                return 0.3
            return 0.0
        # 归一化:命中数 / sqrt(长度)
        import math
        return hits / math.sqrt(max(len(content_l), 1))

    # =========================================================================
    # 私有:重排
    # =========================================================================

    @staticmethod
    def _rerank(
        sources: list[RAGSource],
        score_threshold: float = 0.0,
    ) -> list[RAGSource]:
        """重排 + 阈值过滤 + 去重(基于内容)。"""
        if not sources:
            return []
        # 按 score 排序(降序)
        sorted_sources = sorted(sources, key=lambda x: x.score, reverse=True)
        # 阈值过滤
        if score_threshold > 0:
            sorted_sources = [s for s in sorted_sources if s.score >= score_threshold]
        # 内容去重(保留首个)
        seen: set[str] = set()
        deduped: list[RAGSource] = []
        for s in sorted_sources:
            key = s.content.strip()[:200]
            if key in seen:
                continue
            seen.add(key)
            deduped.append(s)
        return deduped

    # =========================================================================
    # 私有:context 拼接
    # =========================================================================

    @staticmethod
    def _build_context(
        sources: list[RAGSource],
        max_chars: int = 6000,
    ) -> tuple[str, int]:
        """拼接 context,带来源编号 + 长度限制。

        Returns:
            (context_text, estimated_tokens)
        """
        if not sources:
            return "", 0
        parts: list[str] = []
        used = 0
        for i, s in enumerate(sources, 1):
            snippet = s.content.strip()[:1000]
            block = f"[来源 {i}] (role={s.role}, session={s.session_id}, score={s.score:.3f})\n{snippet}"
            if used + len(block) > max_chars:
                # 截断
                remain = max_chars - used
                if remain > 100:
                    parts.append(block[:remain] + "\n...(已截断)")
                    used += remain
                break
            parts.append(block)
            used += len(block) + 2  # +2 for \n\n
        context = "\n\n".join(parts)
        # 估算 token(中英文混合,1 token ≈ 1.5 字符)
        estimated_tokens = len(context) // 2
        return context, estimated_tokens

    # =========================================================================
    # 私有:生成
    # =========================================================================

    async def _generate(
        self,
        question: str,
        context: str,
        model: str | None = None,
    ) -> tuple[str, str, bool]:
        """LLM 生成回答。"""
        if not context:
            return (
                "未找到与问题相关的上下文信息,无法回答。请尝试提供更具体的问题,或先向系统添加相关文档。",
                model or "default",
                True,
            )
        system_prompt = self._system_template.format(context=context)
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": question},
        ]
        try:
            result = await llm_gateway.complete(messages, model=model)
            content = str(result.get("content", "") or "")
            used_model = str(result.get("model", model or "default"))
            stub = bool(result.get("stub", False))
            return content, used_model, stub
        except Exception as e:
            return f"LLM 生成失败: {e}", model or "default", True

    # =========================================================================
    # 序列化
    # =========================================================================

    @staticmethod
    def result_to_dict(result: RAGResult) -> dict[str, Any]:
        """将 RAGResult 序列化为可 JSON 化的 dict。"""
        return {
            "query": result.query,
            "answer": result.answer,
            "sources": [
                {
                    "session_id": s.session_id,
                    "role": s.role,
                    "content": s.content[:500],
                    "score": s.score,
                    "timestamp": s.timestamp,
                }
                for s in result.sources
            ],
            "source_count": len(result.sources),
            "model": result.model,
            "context_tokens": result.context_tokens,
            "duration_ms": result.duration_ms,
            "stub": result.stub,
            "trace": result.trace,
        }


rag_service = RAGService()
