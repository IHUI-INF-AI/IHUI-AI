"""统一知识查询门面(PoC)。

将三个独立的知识检索子系统聚合为一个统一入口,供 subagent / agent_loop 在
tool loop 里"一站式"查询外部知识,避免 hallucination + 减少重复 token 消耗:

- codebase_indexer:  代码库语义检索(tree-sitter AST 切片 + embedding)
- rag_service:       RAG 检索增强生成(向量检索 + rerank,本门面只取 retrieve 阶段)
- long_term_memory:  跨会话历史摘要检索

设计原则:
1. 并发查询三源(asyncio.gather + return_exceptions=True),任一源失败不阻塞其他
2. IO 失败降级返回空 hits,错误记入 errors 字段,不抛异常
3. 按 source_priority 排序聚合,默认 [codebase, rag, long_term_memory]
4. user_id 为空时跳过 long_term_memory(该源需要 user_id 才能查)
5. 返回统一 KnowledgeHit 列表,content 已格式化为可注入 prompt 的字符串

PoC 边界(§3 最小化):
- 仅门面 + 单测 + README,不接入 agent_loop / spec_generator 等调用点
- RAG 源直接调 _retrieve 私有方法(跳过 generate 阶段),后续应在 RAGService
  暴露 retrieve_only() 公有方法替代

使用方式:
    from app.services.knowledge_lookup import knowledge_lookup
    result = await knowledge_lookup("用户认证逻辑", user_id="u1", repo_id="my-repo")
    for hit in result.hits:
        print(hit.source, hit.score, hit.content[:80])
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from .codebase_indexer import codebase_indexer
from .long_term_memory import long_term_memory
from .rag import rag_service

logger = logging.getLogger(__name__)

# 默认源优先级(代码库优先,其次 RAG,最后历史会话)
DEFAULT_PRIORITY: list[str] = ["codebase", "rag", "long_term_memory"]

# 支持的源名称(用于校验 source_priority 参数)
_SUPPORTED_SOURCES: set[str] = {"codebase", "rag", "long_term_memory"}


@dataclass
class KnowledgeHit:
    """统一知识查询结果条目。

    content 已格式化为可注入 prompt 的字符串(带源标签 + 元信息头)。
    raw 保留原始返回(供 debug / 上层自定义格式化)。
    """

    source: str  # "codebase" | "rag" | "long_term_memory"
    score: float
    content: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class KnowledgeLookupResult:
    """统一知识查询结果。

    hits 按 source_priority 顺序聚合,同源内按 score 降序。
    errors 记录各源失败原因(空列表 = 全部成功)。
    duration_ms 为总耗时(并发,近似等于最慢源耗时)。
    """

    query: str
    hits: list[KnowledgeHit] = field(default_factory=list)
    errors: list[dict[str, str]] = field(default_factory=list)
    duration_ms: float = 0.0


async def knowledge_lookup(
    query: str,
    *,
    user_id: Optional[str] = None,
    repo_id: Optional[str] = None,
    session_id: Optional[str] = None,
    top_k_per_source: int = 5,
    source_priority: Optional[list[str]] = None,
    api_token: Optional[str] = None,
) -> KnowledgeLookupResult:
    """统一知识查询门面:并发查三源,聚合为统一结果。

    Args:
        query: 自然语言查询(如"用户认证逻辑实现")。
        user_id: 用户 ID(仅 long_term_memory 需要;为空则跳过该源,不报错)。
        repo_id: 限定代码仓库(仅 codebase 用;为空则全局搜索)。
        session_id: 限定会话(仅 RAG 用;为空则跨会话)。
        top_k_per_source: 每个源返回 top-K,默认 5。
        source_priority: 源优先级排序,默认 ["codebase", "rag", "long_term_memory"]。
            仅控制 hits 聚合顺序,不影响并发查询本身。
        api_token: 调 codebase search API 的 JWT(可选,无 token 则匿名调用)。

    Returns:
        KnowledgeLookupResult 含 hits(按 priority 排序)+ errors + duration_ms。
        所有源 IO 失败均降级返回空 hits,不抛异常。

    Raises:
        ValueError: source_priority 含不支持的源名时(防御性校验)。
    """
    start = time.monotonic()
    priority = list(source_priority) if source_priority else list(DEFAULT_PRIORITY)

    # 防御性校验:source_priority 必须是支持的源子集
    invalid = [s for s in priority if s not in _SUPPORTED_SOURCES]
    if invalid:
        raise ValueError(
            f"source_priority 含不支持的源: {invalid};"
            f"支持的源: {sorted(_SUPPORTED_SOURCES)}"
        )

    # 构造并发任务(仅查询 priority 中包含的源;long_term_memory 还需 user_id)
    tasks: dict[str, asyncio.Task[list[KnowledgeHit]]] = {}
    if "codebase" in priority:
        tasks["codebase"] = asyncio.create_task(
            _query_codebase(
                query, repo_id=repo_id, top_k=top_k_per_source, api_token=api_token
            )
        )
    if "rag" in priority:
        tasks["rag"] = asyncio.create_task(
            _query_rag(query, session_id=session_id, top_k=top_k_per_source)
        )
    if "long_term_memory" in priority and user_id:
        tasks["long_term_memory"] = asyncio.create_task(
            _query_ltm(user_id, query, top_k=top_k_per_source)
        )
    elif "long_term_memory" in priority and not user_id:
        # user_id 为空时跳过 LTM,记 info(非错误)
        logger.info("[knowledge_lookup] user_id 为空,跳过 long_term_memory 源")

    # 并发等待所有任务完成(return_exceptions=True 保证任一失败不阻塞其他)
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    # 按 priority 顺序聚合 hits + 收集 errors
    hits: list[KnowledgeHit] = []
    errors: list[dict[str, str]] = []
    raw_by_source: dict[str, list[KnowledgeHit]] = {}

    for src, res in zip(tasks.keys(), results):
        if isinstance(res, Exception):
            err_msg = f"{type(res).__name__}: {res}"
            errors.append({"source": src, "error": err_msg})
            logger.warning(
                "[knowledge_lookup] 源 %s 查询失败(降级返回空): %s",
                src,
                err_msg,
            )
            continue
        raw_by_source[src] = res

    for src in priority:
        source_hits = raw_by_source.get(src, [])
        # 同源内按 score 降序排序(稳定排序,保持原顺序对相同 score)
        source_hits_sorted = sorted(
            source_hits, key=lambda h: h.score, reverse=True
        )
        hits.extend(source_hits_sorted)

    return KnowledgeLookupResult(
        query=query,
        hits=hits,
        errors=errors,
        duration_ms=round((time.monotonic() - start) * 1000, 2),
    )


# ==================================================================
# 私有 helper:适配各源返回结构 → 统一 KnowledgeHit
# ==================================================================


async def _query_codebase(
    query: str,
    *,
    repo_id: Optional[str],
    top_k: int,
    api_token: Optional[str],
) -> list[KnowledgeHit]:
    """查 codebase_indexer,返回 list[KnowledgeHit]。

    codebase_indexer.search() 已自带 try/except 降级返回 [],此处不再包裹。
    """
    chunks = await codebase_indexer.search(
        query, repo_id=repo_id, top_k=top_k, api_token=api_token
    )
    return [
        KnowledgeHit(
            source="codebase",
            score=float(c.get("score", 0.0)),
            content=_format_code_chunk(c),
            raw=c,
        )
        for c in chunks
    ]


async def _query_rag(
    query: str,
    *,
    session_id: Optional[str],
    top_k: int,
) -> list[KnowledgeHit]:
    """查 rag_service,返回 list[KnowledgeHit]。

    PoC 简化:直接调 _retrieve 私有方法跳过 generate 阶段(避免触发 LLM 调用,
    节省 token + 提速)。后续应在 RAGService 暴露 retrieve_only() 公有方法替代。
    """
    sources = await rag_service._retrieve(
        query, top_k=top_k, session_id=session_id
    )
    return [
        KnowledgeHit(
            source="rag",
            score=float(getattr(s, "score", 0.0)),
            content=_format_rag_source(s),
            raw={
                "session_id": getattr(s, "session_id", ""),
                "role": getattr(s, "role", ""),
                "content": getattr(s, "content", ""),
                "score": getattr(s, "score", 0.0),
                "timestamp": getattr(s, "timestamp", ""),
            },
        )
        for s in sources
    ]


async def _query_ltm(
    user_id: str,
    query: str,
    *,
    top_k: int,
) -> list[KnowledgeHit]:
    """查 long_term_memory,返回 list[KnowledgeHit]。

    long_term_memory.recall_cross_session() 已自带 try/except 降级返回 []。
    """
    items = await long_term_memory.recall_cross_session(
        user_id, query, top_k=top_k
    )
    return [
        KnowledgeHit(
            source="long_term_memory",
            score=float(item.get("score", 0.0)),
            content=_format_ltm_summary(item),
            raw=item,
        )
        for item in items
    ]


# ==================================================================
# 私有 helper:格式化原始数据为可注入 prompt 的字符串
# ==================================================================


def _format_code_chunk(c: dict[str, Any]) -> str:
    """格式化 codebase chunk 为带元信息头的字符串。"""
    sym = c.get("symbol_name") or "?"
    sym_type = c.get("symbol_type") or "symbol"
    fp = c.get("file_path", "?")
    ls = c.get("line_start", "?")
    le = c.get("line_end", "?")
    content = str(c.get("content", "")).strip()
    return f"[codebase:{sym_type} {sym}] {fp}:{ls}-{le}\n{content}"


def _format_rag_source(s: Any) -> str:
    """格式化 RAGSource 为带元信息头的字符串。"""
    role = getattr(s, "role", "?")
    ts = getattr(s, "timestamp", "")
    content = str(getattr(s, "content", "")).strip()
    header = f"[rag:{role}]"
    if ts:
        header += f" {ts}"
    return f"{header}\n{content}"


def _format_ltm_summary(item: dict[str, Any]) -> str:
    """格式化 long_term_memory 摘要为带元信息头的字符串。"""
    summary = str(item.get("summary", "")).strip()
    facts = item.get("key_facts") or []
    decisions = item.get("key_decisions") or []
    parts = [f"[long_term_memory] {summary}"]
    if facts:
        facts_text = "; ".join(str(f) for f in facts if f)
        if facts_text:
            parts.append(f"关键事实: {facts_text}")
    if decisions:
        decisions_text = "; ".join(str(d) for d in decisions if d)
        if decisions_text:
            parts.append(f"关键决策: {decisions_text}")
    return "\n".join(parts)
