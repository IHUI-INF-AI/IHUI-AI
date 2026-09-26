# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""RAG(Retrieval-Augmented Generation)service。

完整 RAG 流程:
1. retrieve: 双路召回 + RRF 融合(V3 #52:向量路 + 关键词路**始终并行**召回,
   Reciprocal Rank Fusion 合并;_keyword_fallback 不再是"向量空了才用"的兜底,
   而是常驻融合源。向量路真不可用时才降级关键词单路,并如实记 mode)
2. rerank:   可选二段(cross-encoder / LLM)—— 本部署唯一可用引擎是 LLM
   (env AGENT_RERANK_LLM_ENABLED,默认关)。二段没真跑成时**诚实降级为一阶段
   RRF 融合结果**,并在返回体里以 rerank_depth / rerank_executed / rerank_reason
   标注走了哪条路(V3 #50 的 analysis_depth/executed/stub 同一形态),不得把
   降级伪装成"已重排"。降级后**保持融合名次**,不再按原始 score 重排
   (按 score 重排等于把 RRF 的结果整块丢掉 = 假重排)
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
- recall(每一路召回的状态/命中数/降级原因 + 融合参数 k + 被 top_k 截掉多少;
  §5e「失败必须响」:任何一路被跳过/出错都留计数与原因,禁止静默变短)
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid as _uuid
from dataclasses import dataclass, field
from typing import Any

from ..core.llm_gateway import llm_gateway
from . import reranker
from .memory import memory_store
from .vector_memory import vector_memory

logger = logging.getLogger(__name__)

# RRF 常数 k(论文默认 60):env RAG_RRF_K 可配,非法值回退默认。
# 判据:k 越大越平滑(名次差异被压扁),k=60 是 Cormack et al. 2009 的经验值。
RRF_K_ENV = "RAG_RRF_K"
DEFAULT_RRF_K = 60

# 二段重排引擎在册情况(如实登记,不是待办清单):
# 本仓 llm_gateway 只提供 complete / structured_completion / embed,
# **没有任何 rerank / cross-encoder 端点**,也没装 sentence-transformers
# 之类的交叉编码器依赖。所以 cross-encoder 这一路是"未接线",不是"试过失败"。
# 把它写进返回体是为了让读报告的人不把"没跑二段"误读成"cross-encoder 也试过"。
CROSS_ENCODER_STATUS = (
    "not-wired:本部署未内置 cross-encoder 后端"
    "(llm_gateway 无 rerank 端点,无交叉编码器依赖,零新依赖是本票设计约束)"
)

# rerank_depth 取值(封闭集,新增须同步测试)
DEPTH_NONE = "none"  # 无候选,谈不上排序
DEPTH_RRF = "rrf-fusion"  # 一阶段融合结果(未跑成二段 / 二段降级)
DEPTH_LLM = "llm-rerank"  # LLM 二段真跑了并改变了名次
DEPTH_SINGLE = "single-source"  # 只有一路召回,谈不上融合


def resolve_rrf_k() -> int:
    """RRF 常数 k(env RAG_RRF_K,默认 60;非法/非正数回退默认)。

    k 是融合的唯一可调旋钮:k 越大,各路头名与末名的分差越被压平。
    """
    raw = os.environ.get(RRF_K_ENV)
    if raw is None or raw == "":
        return DEFAULT_RRF_K
    try:
        value = int(raw)
    except ValueError:
        logger.warning("rag: %s=%r 非整数,回退 k=%d", RRF_K_ENV, raw, DEFAULT_RRF_K)
        return DEFAULT_RRF_K
    if value <= 0:
        logger.warning("rag: %s=%d 非正数,回退 k=%d", RRF_K_ENV, value, DEFAULT_RRF_K)
        return DEFAULT_RRF_K
    return value


def _record_recall_path(
    stats: dict[str, Any] | None,
    label: str,
    *,
    status: str,
    raw_count: int = 0,
    count: int = 0,
    dropped: int = 0,
    reason: str = "",
    extra: dict[str, Any] | None = None,
) -> None:
    """把一路召回的结果写进体检表(stats 为 None 时静默跳过,不改任何行为)。

    存在理由:"这路没返回东西" 与 "这路报错了" 与 "这路被截了" 三种世界在旧实现里
    都表现为同一个空列表 —— 而返回体读起来一切正常。§5e「失败必须响」禁止这种形态。
    """
    if stats is None:
        return
    paths_raw = stats.get("paths")
    paths: dict[str, Any] = paths_raw if isinstance(paths_raw, dict) else {}
    entry: dict[str, Any] = {
        "status": status,
        "raw_count": raw_count,
        "count": count,
        "dropped": dropped,
        "reason": reason,
    }
    if extra:
        entry.update(extra)
    paths[label] = entry
    stats["paths"] = paths


@dataclass
class RAGSource:
    """RAG 检索来源。

    score 保留原始语义分(cosine / 关键词分),供阈值过滤与前端展示;
    融合链路新增字段(均带默认值,旧构造点不受影响):
    - fused_from: 来源路标签(如 "vector" / "vector+keyword"),单路时为该路名
    - rrf_score:  RRF 融合分(单路降级时为 0.0),仅供 debug / trace
    """

    session_id: str
    role: str
    content: str
    score: float
    timestamp: str = ""
    fused_from: str = ""
    rrf_score: float = 0.0


@dataclass
class RAGResult:
    """RAG 完整结果。

    二段重排的自证字段(V3 #52,与 V3 #50 的 analysis_depth/executed/stub 同形态):
    - rerank_depth:    实际走到哪一层(DEPTH_* 封闭集)
    - rerank_executed: 二段模型**真的**跑了并改变了名次才为 True;降级一律 False
    - rerank_reason:   没跑二段的诚实原因(含 cross-encoder 未接线这一事实)
    - recall:          每一路召回的状态/命中数/原因 + 融合参数,任何一路被跳过都留痕
    """

    query: str
    answer: str
    sources: list[RAGSource]
    model: str
    context_tokens: int
    duration_ms: float
    stub: bool
    trace: list[dict[str, Any]] = field(default_factory=list)
    rerank_depth: str = DEPTH_NONE
    rerank_executed: bool = False
    rerank_reason: str = ""
    rerank_engines: dict[str, str] = field(default_factory=dict)
    recall: dict[str, Any] = field(default_factory=dict)


@dataclass
class RerankOutcome:
    """二段重排的结果 + 自证(取代旧的裸 bool,避免「降级」与「没跑」同形)。"""

    sources: list[RAGSource]
    depth: str
    executed: bool
    reason: str
    engines: dict[str, str] = field(default_factory=dict)


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
            RAGResult 含 answer + sources + trace + 重排自证(rerank_depth /
            rerank_executed / rerank_reason)+ 召回体检(recall)。
        """
        start = time.monotonic()
        trace: list[dict[str, Any]] = []

        # 1. 检索(双路并行 + RRF 融合);recall 是"每一路到底发生了什么"的出口
        t0 = time.monotonic()
        recall_stats: dict[str, Any] = {}
        raw_sources = await self._retrieve(
            question, top_k=top_k, session_id=session_id, stats=recall_stats
        )
        trace.append({
            "node": "retrieve",
            "duration_ms": round((time.monotonic() - t0) * 1000, 2),
            "raw_count": len(raw_sources),
            "recall_mode": recall_stats.get("mode", ""),
        })

        # 2. 重排/过滤(可选二段;降级时保持一阶段融合名次,不静默、不假重排)
        t0 = time.monotonic()
        outcome = await self._rerank_with_llm(
            question,
            raw_sources,
            score_threshold=score_threshold,
            recall_stats=recall_stats,
        )
        filtered = outcome.sources
        trace.append({
            "node": "rerank",
            "duration_ms": round((time.monotonic() - t0) * 1000, 2),
            "filtered_count": len(filtered),
            "score_threshold": score_threshold,
            # 旧键保留(llm_rerank == 二段真跑了),新增自证三件套
            "llm_rerank": outcome.executed,
            "rerank_depth": outcome.depth,
            "rerank_executed": outcome.executed,
            "rerank_reason": outcome.reason,
            "rerank_engines": outcome.engines,
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
            rerank_depth=outcome.depth,
            rerank_executed=outcome.executed,
            rerank_reason=outcome.reason,
            rerank_engines=outcome.engines,
            recall=recall_stats,
        )

    async def add_document(
        self,
        session_id: str,
        content: str,
        role: str = "system",
        metadata: dict[str, Any] | None = None,
        user_id: str | None = None,
    ) -> None:
        """向 RAG 知识库添加文档(写入 vector_memory + memory)。

        O19:user_id 为可证明的上传方属主(路由层从请求解析);None 时条目属主未知,
        按用户裁剪的检索不可见(fail-closed),内部全量检索路径仍可见。
        """
        entry_id = _uuid.uuid4().hex
        entry: dict[str, Any] = {
            "session_id": session_id,
            "role": role,
            "content": content,
            **(metadata or {}),
        }
        embedding = await vector_memory.embed(content)
        await vector_memory.add_entry(entry_id, entry, embedding, user_id=user_id)
        await memory_store.add(session_id, role, content, metadata)

    async def retrieve_only(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
    ) -> list[RAGSource]:
        """仅检索(不生成),返回 RAGSource 列表。公有 API,替代直接调 _retrieve。

        内部委托给 _retrieve(),失败 fallback 关键词检索(同 _retrieve 行为)。
        供 knowledge_lookup 等外部门面使用,避免它们调私有方法。

        Args:
            query: 自然语言查询。
            top_k: 返回 top-K,默认 5。
            session_id: 限定会话(为空则跨会话)。

        Returns:
            list[RAGSource],失败返回 []。
        """
        return await self._retrieve(query, top_k=top_k, session_id=session_id)

    # =========================================================================
    # 私有:检索
    # =========================================================================

    async def _retrieve(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
        stats: dict[str, Any] | None = None,
    ) -> list[RAGSource]:
        """双路召回 + RRF 融合(V3 #52「RAG 真重排」)。

        行为(与旧版 fallback 关系的差异):
        - 向量可用(embed 成功且有结果)→ 向量路 + 关键词路**并行**召回,
          Reciprocal Rank Fusion 合并。RRF 只看名次不看原始分,因为两路
          分数量纲不可比(cosine ∈ [0,1] vs 关键词命中数/sqrt(长度)),
          线性加权会失真。
        - 向量不可用(embed 异常或零结果)→ 关键词单路降级,与旧行为一致;
          这条降级**必须**在 stats 里留原因,不得只在日志里喊(§5e 失败必须响)。

        Args:
            stats: 可选的召回体检出口(调用方传入空 dict,本方法就地填充)。
                刻意用出参而不是改返回类型:retrieve_only() 的公有契约是
                list[RAGSource],不能为遥测把签名换掉。
        """
        rrf_k = resolve_rrf_k()
        recall_k = max(top_k * 2, 10)
        # 双路并行启动:向量成功则两路融合,失败则关键词路独扛(任务已并行,零等待浪费)
        vec_task = asyncio.create_task(
            self._vector_retrieve(
                query, top_k=recall_k, session_id=session_id, stats=stats
            )
        )
        kw_task = asyncio.create_task(
            self._keyword_fallback(
                query, top_k=recall_k, session_id=session_id, stats=stats
            )
        )
        vec_sources = await vec_task
        kw_sources = await kw_task
        if stats is not None:
            stats["recall_k"] = recall_k
            stats["rrf_k"] = rrf_k

        if not vec_sources:
            # 向量单路降级:关键词路结果截到 top_k,行为与旧 fallback 一致
            for s in kw_sources[:top_k]:
                # 来源路标注在融合分支才写,这一支必须自己补上 —— 否则
                # result_to_dict 的 fused_from 是空串,调用方读不出"这轮只有关键词路"
                # (向量单路那支走 rrf_fuse 拿得到 label,只有这里会漏)。
                s.fused_from = "keyword"
            if stats is not None:
                stats["mode"] = "single-source:keyword" if kw_sources else "empty"
                stats["fused_total"] = len(kw_sources)
                stats["returned"] = min(len(kw_sources), top_k)
                stats["dropped_by_top_k"] = max(0, len(kw_sources) - top_k)
            return kw_sources[:top_k]

        rankings: list[list[RAGSource]] = [vec_sources]
        labels: list[str] = ["vector"]
        if kw_sources:
            rankings.append(kw_sources)
            labels.append("keyword")
        fused = reranker.rrf_fuse(rankings, k=rrf_k, labels=labels)

        out: list[RAGSource] = []
        for f in fused:
            s = f.item
            # 标注来源路与 RRF 分(score 保留原始语义分,供阈值过滤/前端展示)
            s.fused_from = "+".join(f.fused_from)
            s.rrf_score = round(f.score, 6)
            out.append(s)
            if len(out) >= top_k:
                break
        if stats is not None:
            stats["mode"] = "rrf-fusion" if len(rankings) > 1 else "single-source:vector"
            stats["fused_total"] = len(fused)
            stats["returned"] = len(out)
            stats["dropped_by_top_k"] = max(0, len(fused) - len(out))
        return out

    async def _vector_retrieve(
        self,
        query: str,
        top_k: int = 10,
        session_id: str | None = None,
        stats: dict[str, Any] | None = None,
    ) -> list[RAGSource]:
        """向量路召回(embed/检索失败降级返回 [],不抛,由 _retrieve 决定融合策略)。"""
        try:
            query_embedding = await vector_memory.embed(query)
            results = await vector_memory.search(
                query_embedding=query_embedding,
                top_k=top_k,
                threshold=0.0,
            )
        except Exception as e:
            logger.warning("rag._vector_retrieve 向量检索失败: %s", e, exc_info=True)
            _record_recall_path(
                stats, "vector", status="error", reason=f"{type(e).__name__}: {e}"
            )
            return []
        sources: list[RAGSource] = []
        for _entry_id, entry, score in results:
            if session_id is not None and entry.get("session_id") != session_id:
                continue
            sources.append(
                RAGSource(
                    session_id=str(entry.get("session_id", "")),
                    role=str(entry.get("role", "")),
                    content=str(entry.get("content", "")),
                    score=float(score),
                    timestamp=str(entry.get("timestamp", "")),
                )
            )
            if len(sources) >= top_k:
                break
        _record_recall_path(
            stats,
            "vector",
            status="ok" if sources else "empty",
            raw_count=len(results),
            count=len(sources),
            reason="" if sources else "向量检索零命中(embed 降级或库为空)",
        )
        return sources

    async def _keyword_fallback(
        self,
        query: str,
        top_k: int = 5,
        session_id: str | None = None,
        stats: dict[str, Any] | None = None,
    ) -> list[RAGSource]:
        """关键词召回路(V3 #52:从"向量空了才用"的兜底升为**常驻融合源**)。

        名字保留 `_keyword_fallback` 是历史包袱:它在每次 _retrieve 里都与向量路
        **并行**起跑,只有向量路整体不可用时才独自承担结果。改名会波及 knowledge_lookup
        之外的调用面,属另一票(见交付报告未闭环项)。
        """
        try:
            sessions = (
                [session_id] if session_id else await memory_store.list_sessions()
            )
        except Exception as e:
            logger.warning("rag._keyword_fallback 加载会话列表失败: %s", e, exc_info=True)
            _record_recall_path(
                stats, "keyword", status="error", reason=f"列会话失败: {e}"
            )
            return []
        query_l = query.lower()
        scored: list[RAGSource] = []
        failed_sessions = 0
        first_failure = ""
        for sid in sessions:
            try:
                msgs = await memory_store.get(sid, limit=200)
            except Exception as e:
                logger.warning("rag._keyword_fallback 加载会话消息失败(sid=%s): %s", sid, e, exc_info=True)
                failed_sessions += 1
                first_failure = first_failure or f"sid={sid}: {e}"
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
        # 被 top_k 截掉多少要留数:静默变短 = 把"没看见"写成"没有"(守门 77 同一条禁令)
        out = scored[:top_k]
        _record_recall_path(
            stats,
            "keyword",
            status="ok" if out else ("empty" if failed_sessions == 0 else "partial"),
            raw_count=len(scored),
            count=len(out),
            dropped=len(scored) - len(out),
            extra={
                "sessions_scanned": len(sessions),
                "sessions_failed": failed_sessions,
                "reason": (
                    "" if out else "关键词零命中(查询与库内文本无共同词/子串)"
                )
                + (f";{failed_sessions} 个会话读取失败:{first_failure}" if failed_sessions else ""),
            },
        )
        return out

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

    @classmethod
    def _rerank(
        cls,
        sources: list[RAGSource],
        score_threshold: float = 0.0,
        *,
        preserve_order: bool = False,
    ) -> list[RAGSource]:
        """阈值过滤 + 内容去重;是否按 score 重排由 preserve_order 决定。

        V3 #52 后排序职责上移:多路名次由 retrieve 阶段 RRF 融合决定,可选 LLM
        二段由 _rerank_with_llm 处理。两条路各自保留:
        - preserve_order=False(旧语义,逐零差异):按 score 降序后过滤去重,
          给"手上只有裸分数、没有上游名次"的调用方用。
        - preserve_order=True(主链路降级路径用):**保持传入名次**只过滤去重。
          此刻传入顺序就是融合(或二段)结果,再按 score 排一遍等于把融合整块
          丢掉 —— 那正是本票要治的「假重排」。
        """
        if not sources:
            return []
        ordered = (
            list(sources)
            if preserve_order
            else sorted(sources, key=lambda x: x.score, reverse=True)
        )
        return cls._filter_dedup(ordered, score_threshold=score_threshold)

    async def _rerank_with_llm(
        self,
        query: str,
        sources: list[RAGSource],
        score_threshold: float = 0.0,
        recall_stats: dict[str, Any] | None = None,
    ) -> RerankOutcome:
        """V3 #52 重排入口:可选二段(cross-encoder / LLM)→ 阈值过滤 + 去重。

        三条路各自诚实标注(不得把降级伪装成「已重排」):
        - LLM 二段(env AGENT_RERANK_LLM_ENABLED,默认关)启用且真拿到打分:
          按 LLM 相关性分定名次,后续只做过滤去重(**不**再按 score 排序,否则
          破坏二段名次;score 仅剩阈值过滤语义)→ depth="llm-rerank"、executed=True。
        - 二段没跑成(未启用 / cross-encoder 本部署未接线 / 开了却没产出可用分):
          **保持一阶段 RRF 融合名次**,depth 按召回实际形态记 "rrf-fusion"(两路
          以上真融合了)或 "single-source"(只有一路有结果),executed=False,
          reason 点名为什么没跑。
        - 无候选:depth="none"。

        Returns:
            RerankOutcome(过滤去重后的 sources + depth/executed/reason/engines)。
        """
        engines = self.stage2_engine_status()
        if not sources:
            return RerankOutcome(
                sources=[],
                depth=DEPTH_NONE,
                executed=False,
                reason="无候选,未进入二段",
                engines=engines,
            )

        ordered, used_llm = await reranker.rerank_with_fallback(query, sources)
        if used_llm:
            return RerankOutcome(
                sources=self._filter_dedup(ordered, score_threshold=score_threshold),
                depth=DEPTH_LLM,
                executed=True,
                reason=f"LLM 二段对 {len(sources)} 个候选打分重排成功",
                engines=engines,
            )

        fused_mode = bool(recall_stats and recall_stats.get("mode") == "rrf-fusion")
        return RerankOutcome(
            # 关键:preserve_order=True —— 保持上游融合名次,不再按 score 重排
            sources=self._rerank(
                ordered, score_threshold=score_threshold, preserve_order=True
            ),
            depth=DEPTH_RRF if fused_mode else DEPTH_SINGLE,
            executed=False,
            reason=self._stage2_degrade_reason(engines),
            engines=engines,
        )

    @staticmethod
    def stage2_engine_status() -> dict[str, str]:
        """二段引擎在册状态(llm 一格现读 env,不把「没开」写成「开了但失败」)。"""
        return {
            "cross-encoder": CROSS_ENCODER_STATUS,
            "llm": (
                "enabled"
                if reranker.llm_rerank_enabled()
                else f"disabled(env {reranker.RERANK_LLM_ENABLED_ENV} 未开)"
            ),
        }

    @staticmethod
    def _stage2_degrade_reason(engines: dict[str, str]) -> str:
        """降级原因:能区分「二段没开」与「开了但没产出可用打分」。"""
        cross = engines.get("cross-encoder", CROSS_ENCODER_STATUS)
        if engines.get("llm", "").startswith("disabled"):
            return f"一阶段结果:LLM 二段未启用;{cross}"
        return (
            "一阶段结果:LLM 二段已启用但未产出可用打分"
            "(网关失败/超时/输出非法,详见 reranker 日志 warning),"
            f"已按融合名次降级;{cross}"
        )

    @staticmethod
    def _filter_dedup(
        sources: list[RAGSource],
        score_threshold: float = 0.0,
    ) -> list[RAGSource]:
        """阈值过滤 + 内容去重,**保持传入顺序**(LLM/RRF 名次不被打乱)。"""
        if not sources:
            return []
        # 阈值过滤(score 保留原始语义分,阈值语义不变)
        out = list(sources)
        if score_threshold > 0:
            out = [s for s in out if s.score >= score_threshold]
        # 内容去重(保留首个,即名次最高者;前 200 字符口径与旧版一致)
        seen: set[str] = set()
        deduped: list[RAGSource] = []
        for s in out:
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
        """将 RAGResult 序列化为可 JSON 化的 dict。

        返回体必须自带"这轮排序是怎么来的":rerank(走到哪一层 / 二段是否真跑 /
        降级原因 / 引擎在册状态)+ recall(每一路的状态与命中数)。少了这两块,
        调用方就只能看到一串排好序的来源,分不清真重排与降级。
        """
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
                    # V3 #52:来源路标注("vector"/"keyword"/"vector+keyword")
                    # 与 RRF 融合分(证明名次来自融合,不是原始 score)
                    "fused_from": s.fused_from,
                    "rrf_score": s.rrf_score,
                }
                for s in result.sources
            ],
            "source_count": len(result.sources),
            "model": result.model,
            "context_tokens": result.context_tokens,
            "duration_ms": result.duration_ms,
            "stub": result.stub,
            "trace": result.trace,
            "rerank": {
                "depth": result.rerank_depth,
                "executed": result.rerank_executed,
                "reason": result.rerank_reason,
                "engines": result.rerank_engines,
            },
            "recall": result.recall,
        }


rag_service = RAGService()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
