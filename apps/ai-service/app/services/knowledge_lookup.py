# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""统一知识查询门面(PoC)。

将四个独立的知识检索子系统聚合为一个统一入口,供 subagent / agent_loop 在
tool loop 里"一站式"查询外部知识,避免 hallucination + 减少重复 token 消耗:

- codebase_indexer:  代码库语义检索(tree-sitter AST 切片 + embedding)
- rag_service:       RAG 检索增强生成(向量检索 + rerank,本门面只取 retrieve 阶段)
- graph:             知识图谱实体关系检索(NER 抽取 + 图谱匹配,语义关联补全)
- long_term_memory:  跨会话历史摘要检索

设计原则:
1. 并发查询四源(asyncio.gather + return_exceptions=True),任一源失败不阻塞其他
2. IO 失败降级返回空 hits,错误记入 errors 字段,不抛异常
3. 按 source_priority 排序聚合,默认 [codebase, rag, graph, long_term_memory]
4. user_id 为空时跳过 long_term_memory(该源需要 user_id 才能查),
   graph 源按 owner 过滤同样依赖 user_id,为空时返回空 hits
5. 返回统一 KnowledgeHit 列表,content 已格式化为可注入 prompt 的字符串

PoC 边界(§3 最小化):
- 仅门面 + 单测 + README,不接入 agent_loop / spec_generator 等调用点
- RAG 源走 retrieve_only() 公有方法(跳过 generate 阶段),
  G4 完整迁移后已替代 PoC 阶段的 _retrieve 私有调用

使用方式:
    from app.services.knowledge_lookup import knowledge_lookup
    result = await knowledge_lookup("用户认证逻辑", user_id="u1", repo_id="my-repo")
    for hit in result.hits:
        logger.debug("knowledge_lookup_hit", source=hit.source, score=hit.score, content_preview=hit.content[:80])
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Optional, cast

from .codebase_indexer import codebase_indexer
from .knowledge_graph import graph_store, knowledge_graph_service
from .long_term_memory import long_term_memory
from .rag import rag_service

logger = logging.getLogger(__name__)

# 默认源优先级(代码库优先 → RAG → 图谱 → 历史会话)
# graph 置于 rag 之后:知识图谱按实体匹配 + 关联补全,提供 RAG 向量检索
# 之外的实体关系语义视角,作为补充而非主力,故排在 rag 之后。
DEFAULT_PRIORITY: list[str] = ["codebase", "rag", "graph", "long_term_memory"]

# 支持的源名称(用于校验 source_priority 参数)
_SUPPORTED_SOURCES: set[str] = {"codebase", "rag", "graph", "long_term_memory"}


@dataclass
class KnowledgeHit:
    """统一知识查询结果条目。

    content 已格式化为可注入 prompt 的字符串(带源标签 + 元信息头)。
    raw 保留原始返回(供 debug / 上层自定义格式化)。
    """

    source: str  # "codebase" | "rag" | "graph" | "long_term_memory"
    score: float
    content: str
    raw: dict[str, Any] = field(default_factory=dict)
    # 引用溯源元数据:如文档名/实体名/关系描述,供前端引用溯源展示
    # (默认空列表,向后兼容:现有关键字构造不受影响)
    citations: list[str] = field(default_factory=list)


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
    """统一知识查询门面:并发查四源,聚合为统一结果。

    Args:
        query: 自然语言查询(如"用户认证逻辑实现")。
        user_id: 用户 ID(long_term_memory 与 graph 需要;为空则跳过/返回空,不报错)。
        repo_id: 限定代码仓库(仅 codebase 用;为空则全局搜索)。
        session_id: 限定会话(仅 RAG 用;为空则跨会话)。
        top_k_per_source: 每个源返回 top-K,默认 5。
        source_priority: 源优先级排序,默认 ["codebase", "rag", "graph", "long_term_memory"]。
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
    # graph 源默认参与并发查询(按 owner 过滤;owner_uuid 为空时返回空 hits)
    if "graph" in priority:
        tasks["graph"] = asyncio.create_task(
            _query_graph(query, owner_uuid=user_id, top_k=top_k_per_source)
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
        raw_by_source[src] = cast(list[KnowledgeHit], res)

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

    走 retrieve_only() 公有方法(跳过 generate 阶段,避免触发 LLM 调用,
    节省 token + 提速)。retrieve_only() 是 _retrieve() 的公有包装,
    G4 完整迁移后替代了直接调私有 _retrieve 的 PoC 路径。
    """
    sources = await rag_service.retrieve_only(
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


async def _query_graph(
    query: str,
    *,
    owner_uuid: Optional[str],
    top_k: int,
    graph_bfs_depth: int = 2,
) -> list[KnowledgeHit]:
    """查知识图谱,返回 list[KnowledgeHit]。

    知识图谱模块无独立关键词检索方法,组合两个异步公有方法完成实体关联检索:
    1. knowledge_graph_service.extract(query):NER 抽取查询串中的实体名
    2. graph_store.get_graph(owner_uuid):     拉取该 owner 的图谱节点 + 边
    (均为 async,内部 asyncpg / llm_gateway,直接 await,不阻塞事件循环)

    命中规则(直接命中优先):
    - 图谱实体名与查询实体名(或查询文本,兜底)做子串匹配 → 直接命中
      (score = 10 + frequency,最高)
    - 从全部命中实体出发做 BFS 多跳邻域遍历(深度 graph_bfs_depth,
      默认 2,合法范围 1-3,非法值自动回退 2):
      1 跳邻居 score = 1 + weight;2-3 跳扩展实体逐跳 ×0.5 递减
    - 同一实体去重(仅保留 BFS 首次到达的最短路径,即最高分),
      按 score 降序取 top_k
    - citations 溯源:直接命中记录"图谱实体",邻居/扩展记录关系链
    owner_uuid 为空时图谱无数据,返回空 hits(不视为错误,不阻塞其他源)。
    """
    if not owner_uuid:
        logger.info("[knowledge_lookup] owner_uuid 为空,跳过 knowledge graph 源")
        return []

    # 1. NER 抽取查询实体(stub 模式为启发式;失败降级用查询文本兜底匹配)
    try:
        extracted = await knowledge_graph_service.extract(query)
        query_names: list[str] = [
            str(e.get("name", "")).strip()
            for e in (extracted.get("entities") or [])
            if e.get("name")
        ]
    except Exception as e:
        logger.warning(
            "[knowledge_lookup] graph NER 抽取失败,改用查询文本匹配: %s", e
        )
        query_names = []

    # 2. 拉取该 owner 的图谱(节点 + 边)
    graph = await graph_store.get_graph(owner_uuid)
    entities = graph.get("entities") or []
    relations = graph.get("relations") or []
    if not entities:
        return []

    # 实体 id → name 映射(关系边引用 entity_id,需反查实体名)
    name_by_id: dict[Any, str] = {
        e.get("id"): str(e.get("name", ""))
        for e in entities
        if e.get("id") is not None
    }

    # 匹配关键词列表:优先查询实体名,为空则用查询文本本身兜底
    keywords: list[str] = query_names or [query]
    hits: list[KnowledgeHit] = []
    matched_entity_ids: set[Any] = set()

    # 3a. 直接命中:实体名与关键词双向子串匹配(大小写不敏感)
    for ent in entities:
        name = str(ent.get("name", "")).strip()
        if not name:
            continue
        matched = any(
            kw
            and (kw.lower() in name.lower() or name.lower() in kw.lower())
            for kw in keywords
            if kw
        )
        if not matched:
            continue
        eid = ent.get("id")
        if eid is not None:
            matched_entity_ids.add(eid)
        # 基础分 10.0 + 频次(同名实体被多次抽取越可信),高于关联补充分
        score = 10.0 + float(ent.get("frequency", 0) or 0)
        hits.append(
            KnowledgeHit(
                source="graph",
                score=score,
                content=_format_graph_entity(ent),
                raw=dict(ent),
                citations=[f"图谱实体: {name}"],
            )
        )

    if not matched_entity_ids:
        # 图谱中无匹配实体(或均无 id),无关联可补全
        return []

    # 3b. BFS 多跳邻域遍历:从直接命中实体出发,沿关系边逐层扩展未访问实体。
    # 深度参数防御:非整数或超出 [1,3] 一律回退默认 2(不影响调用方)。
    try:
        bfs_depth: int = int(graph_bfs_depth)
    except (TypeError, ValueError):
        bfs_depth = 2
    if bfs_depth < 1 or bfs_depth > 3:
        bfs_depth = 2

    # visited 初始为直接命中实体,保证 BFS 不折返、邻居不重复输出;
    # BFS 先入先出天然保证首次到达即最短路径(深度最小 = score 最高)。
    visited: set[Any] = set(matched_entity_ids)
    path_by_id: dict[Any, list[str]] = {
        eid: [name_by_id.get(eid, "?")] for eid in matched_entity_ids
    }
    rel_types_by_id: dict[Any, list[str]] = {eid: [] for eid in matched_entity_ids}
    queue: deque[tuple[Any, int]] = deque((eid, 0) for eid in matched_entity_ids)
    # 扩展实体暂存:实体 id → 深度 / 到达路径 / 关系类型链 / weight
    expansion: dict[Any, dict[str, Any]] = {}

    while queue:
        cur_id, depth = queue.popleft()
        if depth >= bfs_depth:
            continue
        for rel in relations:
            src_id = rel.get("source_entity_id")
            tgt_id = rel.get("target_entity_id")
            if src_id == cur_id:
                nxt_id: Any = tgt_id
            elif tgt_id == cur_id:
                nxt_id = src_id
            else:
                continue
            if nxt_id is None or nxt_id in visited:
                continue
            visited.add(nxt_id)
            # 构造到达路径(实体名链)与关系类型链(与路径边一一对应)
            nxt_name = name_by_id.get(nxt_id, "?")
            new_path: list[str] = path_by_id[cur_id] + [nxt_name]
            rel_type = str(rel.get("relation_type", "?"))
            new_rel_types: list[str] = rel_types_by_id[cur_id] + [rel_type]
            path_by_id[nxt_id] = new_path
            rel_types_by_id[nxt_id] = new_rel_types
            expansion[nxt_id] = {
                "depth": depth + 1,
                "path": new_path,
                "rel_types": new_rel_types,
                "weight": float(rel.get("weight", 0) or 0),
                "src_name": name_by_id.get(src_id, "?"),
                "tgt_name": name_by_id.get(tgt_id, "?"),
            }
            queue.append((nxt_id, depth + 1))

    # 3c. BFS 扩展实体生成 hit(visited 已保证去重,每条只取首次到达路径)
    for nxt_id, info in expansion.items():
        depth = int(info["depth"])
        weight = float(info["weight"])
        path = list(info["path"])
        rel_types = list(info["rel_types"])
        name = path[-1]
        # score:1 跳 1+weight;每多一跳 ×0.5 递减,始终低于直接命中 10+
        score = (1.0 + weight) * (0.5 ** (depth - 1))
        hits.append(
            KnowledgeHit(
                source="graph",
                score=score,
                content=_format_graph_expansion(name, depth, rel_types, path),
                raw={
                    "entity_id": nxt_id,
                    "depth": depth,
                    "path": path,
                    "rel_types": rel_types,
                    "weight": weight,
                },
                citations=[_format_graph_path_citation(path, rel_types)],
            )
        )

    # 按 score 降序取 top_k
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits[:top_k]


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


def _format_graph_entity(e: dict[str, Any]) -> str:
    """格式化图谱实体为带元信息头的字符串(与现有源同风格)。"""
    name = str(e.get("name", "?"))
    etype = str(e.get("type", "?"))
    freq = e.get("frequency", "?")
    desc = str(e.get("description", "")).strip()
    header = f"[graph:entity] {name}({etype}) 频次={freq}"
    if desc:
        return f"{header}\n{desc}"
    return header


def _format_graph_expansion(
    name: str,
    depth: int,
    rel_types: list[str],
    path: list[str],
) -> str:
    """格式化 BFS 扩展实体为带元信息头的字符串。

    1 跳邻居: [graph] 实体名(经关系: <type>)
    多跳扩展: [graph] 实体名(N 跳, 路径: A->B->C)
    """
    if depth <= 1:
        # 1 跳邻居:仅记录最后一段关系类型
        rtype = rel_types[-1] if rel_types else "?"
        return f"[graph] {name}(经关系: {rtype})"
    path_str = "->".join(path)
    return f"[graph] {name}({depth} 跳, 路径: {path_str})"


def _format_graph_path_citation(path: list[str], rel_types: list[str]) -> str:
    """格式化引用溯源:实体/关系链描述(供前端引用溯源展示)。

    单段关系: "图谱关系: A -[uses]-> B"
    多段路径: "图谱路径: A -[uses]-> B -[related_to]-> C"
    """
    if not path:
        return "图谱实体: ?"
    segs = [path[0]]
    for i in range(min(len(path) - 1, len(rel_types))):
        segs.append(f" -[{rel_types[i]}]-> {path[i + 1]}")
    chain = "".join(segs)
    if len(path) == 2:
        return f"图谱关系: {chain}"
    return f"图谱路径: {chain}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
