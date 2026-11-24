# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·多跳检索主循环（本仓自有实现）。

取证自对照程序 ``retrieval.rs::retrieve_inner`` 的**行为与设计**：
查询时关联（query-time hyperedge）——索引里只存「词元 → 出现这些词的段落」，
不预建「段落 A 与段落 B 是邻居」的图；一次查询里 A 被判为有用证据，
A 里的某个词又召回 B，B 才结合当前问题被判断为答案链的一环。

主循环：初轮 BM25 粗筛 → 证据判断 → 从高分段落抽扩展词 → 再检索 → 再判断，
最多两轮扩展（3 次评分），终排做 DPP 多样性正交化。

超越轴（补齐对照缺失边界）：
- 每一轮都写 ``paths`` 留痕（跳过/出错/截断三种世界不再都表现为空列表）；
- 证据判断 provider 未真跑 ⇒ ``judge_executed=False`` + 明确 reason；
- 索引未就绪 / 版本变化 / 取消 / 预算用尽 / 陈旧文件均返回**显式状态**，
  绝不静默切换算法。
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .bridge import TermBridge
from .diversity import diversify
from .index import LexicalIndex, ScoredChunk
from .judge import (
    JUDGE_EXECUTED_REASON,
    MODE_LEXICAL_ONLY,
    MODE_MODEL,
    NO_MODEL_REASON,
    EvidenceJudge,
)
from .text import cached_tokens, match_query, name_phrases, sentence_spans

MAX_HOPS = 2
PROTECTED_INITIAL = 5
HOP2_EVIDENCE = 10
HOP2_INCOMING = 20

STATUS_OK = "ok"
STATUS_EMPTY_INDEX = "empty-index"
STATUS_EMPTY_QUERY = "empty-query"
STATUS_NO_CANDIDATES = "no-candidates"
STATUS_CANCELLED = "cancelled"
STATUS_INDEX_CHANGED = "index-changed"
STATUS_BUDGET = "budget-exhausted"


@dataclass(frozen=True)
class ExpansionTerm:
    """一条扩展词及其打分（``word`` / ``name_phrase``）。"""

    term: str
    score: float
    kind: str = "word"

    def to_dict(self) -> dict[str, Any]:
        return {
            "term": self.term,
            "score": round(self.score, 6),
            "kind": self.kind,
        }


@dataclass
class Sag2Options:
    """检索参数（对照默认：candidate_k=100、最多两轮扩展、答案 10 条）。"""

    candidate_k: int = 100
    seed_k: int = 10
    expansion_term_limit: int = 8
    max_hops: int = MAX_HOPS
    top_k: int = 10
    file_limit: int | None = None
    judge_pool_budget: int = 200
    #: 跨语言桥：开启后为查询词生成另一种写法的候选（词典 + 语料括号对照）。
    cross_lingual: bool = True
    #: 桥接候选占用的召回配额（只在原查询候选不足时补位，不抢原排序名次）。
    bridge_limit: int = 20

    def __post_init__(self) -> None:
        self.max_hops = min(max(self.max_hops, 0), MAX_HOPS)
        self.bridge_limit = max(0, int(self.bridge_limit))


@dataclass
class Sag2Result:
    """检索结果 + 自证字段（与 ``rag.RAGResult`` 同构的诚实留痕风格）。"""

    query: str
    results: list[ScoredChunk] = field(default_factory=list)
    citations: list[dict[str, Any]] = field(default_factory=list)
    trace: list[dict[str, Any]] = field(default_factory=list)
    paths: dict[str, dict[str, Any]] = field(default_factory=dict)
    judge_mode: str = MODE_LEXICAL_ONLY
    judge_executed: bool = False
    judge_reason: str = NO_MODEL_REASON
    status: str = STATUS_OK
    degraded: bool = False
    version: int = 0
    duration_ms: float = 0.0
    #: 本轮实际用上的跨语言桥接词（空列表 = 没建桥或没命中，两者都不伪装成"跨语言已生效"）。
    bridge: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "status": self.status,
            "degraded": self.degraded,
            "version": self.version,
            "duration_ms": round(self.duration_ms, 3),
            "results": [
                {
                    "key": r.key,
                    "path": r.path,
                    "content": r.content[:500],
                    "score": round(r.score, 6),
                    "bm25": round(r.bm25, 6),
                    "hop": r.hop,
                }
                for r in self.results
            ],
            "source_count": len(self.results),
            "citations": self.citations,
            "trace": self.trace,
            "judge": {
                "mode": self.judge_mode,
                "executed": self.judge_executed,
                "reason": self.judge_reason,
            },
            "paths": self.paths,
            "bridge": self.bridge,
        }


# ---------------------------------------------------------------------------
# 纯函数：扩展词、轮询合并、排序
# ---------------------------------------------------------------------------


def _term_stats(index: LexicalIndex, term: str) -> tuple[float, float]:
    """返回 (df, idf)；多词短语按组成词里最稀有的那个估计。

    对照的 ``store.frequencies`` 支持短语级统计；本层倒排只存单词元，
    因此用「最稀有组成词」近似短语稀有度，保证 ``name_phrase`` 不被
    一律当成 df=0 丢掉。
    """
    tokens = cached_tokens(term)
    if not tokens:
        return 0.0, 0.0
    if len(tokens) == 1:
        return float(index.frequency(tokens[0])), index.bm25_idf(tokens[0])
    dfs = [index.frequency(token) for token in tokens]
    df = float(min(dfs))
    n = index.chunk_count()
    idf = (
        float("inf")
        if n == 0
        else math.log(1.0 + (n - df + 0.5) / (df + 0.5))
    )
    return df, idf


def expansion_terms(
    index: LexicalIndex,
    query: str,
    seeds: list[ScoredChunk],
    limit: int,
) -> list[ExpansionTerm]:
    """从已判定高分段落里挑下一轮的扩展词。

    打分公式复现对照设计：
    ``(1+ln tf) * IDF(term) * (1 + 句内查询词上下文) * seed_weight``
    其中 ``seed_weight = 0.5 + 0.5 * seed.score / max_score``。
    句子边界隔离上下文，中文标点切句后不会跨句传播。
    """
    if not seeds or limit <= 0:
        return []
    query_terms = set(match_query(query))
    max_score = max(0.0, *(max(0.0, s.score) for s in seeds))
    ranked: dict[str, ExpansionTerm] = {}

    for seed in seeds:
        weight = 0.5 + 0.5 * (max(0.0, seed.score) / max_score) if max_score > 0 else 0.5
        counts: dict[str, int] = {}
        contexts: dict[str, float] = {}
        name_terms: set[str] = set()

        for _start, _end, sentence in sentence_spans(seed.content):
            names = name_phrases(sentence)
            ungrouped = list(sentence)
            for ns, ne, _phrase in names:
                for pos in range(ns, ne):
                    ungrouped[pos] = " "
            # 挖掉人名后的整句、以及原句，都是「同一段文本」的重复切词场景：
            # 走缓存版（tuple）后按需拷贝一次，避免对每个候选段落重扫字符。
            words = list(cached_tokens("".join(ungrouped)))
            for _ns, _ne, phrase in names:
                words.append(phrase)
                name_terms.add(phrase)

            seen: set[str] = set()
            context = 0.0
            for word in cached_tokens(sentence):
                if word in seen or word not in query_terms:
                    continue
                seen.add(word)
                context += index.bm25_idf(word)
            for word in words:
                counts[word] = counts.get(word, 0) + 1
                contexts[word] = max(contexts.get(word, 0.0), context)

        for term, tf in counts.items():
            if all(word in query_terms for word in cached_tokens(term)):
                continue
            df, idf = _term_stats(index, term)
            if df <= 0 or idf <= 0:
                continue
            score = (
                (1.0 + math.log(tf))
                * idf
                * (1.0 + contexts.get(term, 0.0))
                * weight
            )
            kind = "name_phrase" if term in name_terms else "word"
            existing = ranked.get(term)
            if existing is None or score > existing.score:
                ranked[term] = ExpansionTerm(term=term, score=score, kind=kind)

    terms = sorted(ranked.values(), key=lambda t: (-t.score, t.term))
    return terms[:limit]


def resolve_terms(
    index: LexicalIndex,
    terms: list[ExpansionTerm],
    excluded_keys: set[str],
    limit: int,
) -> list[ExpansionTerm]:
    """只保留「排除已见候选后仍能召回新段落」的扩展词。

    对照 ``corpus.resolve_terms(store, terms, scope, references, excluded)``
    用 ``has_candidate_match`` 检查词项是否还有命中；但没有把这一步用在
    **预算分配**上——它先按 IDF×context 截断，再修复无命中的词。小语料上
    高频词会吃满预算，桥接词（真正通向下一跳的那个词）反而被挤掉。

    本仓把顺序倒过来：先生成较宽的候选词，再按「能带来新候选」过滤，
    最后才截断。这是可验证的超越：扩展预算只花在真能扩展的词上。
    """
    resolved: list[ExpansionTerm] = []
    for term in terms:
        tokens = cached_tokens(term.term)
        if not tokens:
            continue
        # 只问「还能不能带来新段落」，不问名次：旧写法 candidate_query(tokens, 1, …)
        # 会把整张 posting 打完分再全量排序，只为取第 1 名（20k 篇实测占多跳 75% 耗时）。
        if not index.has_new_candidate(tokens, excluded_keys):
            continue
        resolved.append(term)
        if len(resolved) >= limit:
            break
    return resolved


def interleave(lists: list[list[ScoredChunk]], limit: int) -> list[ScoredChunk]:
    """按 rank 轮询合并多组候选并去重，避免单一高频词独占候选池。"""
    seen: set[str] = set()
    out: list[ScoredChunk] = []
    for rank in range(limit):
        for group in lists:
            if rank >= len(group):
                continue
            source = group[rank]
            if source.key in seen:
                continue
            seen.add(source.key)
            out.append(
                ScoredChunk(
                    chunk=source.chunk,
                    bm25=source.bm25,
                    order=len(out),
                )
            )
            if len(out) >= limit:
                return out
    return out


def rank(candidates: list[ScoredChunk]) -> list[ScoredChunk]:
    """score 降序 → order 升序 → key 升序（确定性排序，便于测试钉死）。"""
    return sorted(candidates, key=lambda c: (-c.score, c.order, c.key))


# ---------------------------------------------------------------------------
# 主循环
# ---------------------------------------------------------------------------


def _path(paths: dict[str, dict[str, Any]], label: str, **entry: Any) -> None:
    paths[label] = {"status": "ok", "raw_count": 0, "count": 0, "dropped": 0, "reason": "", **entry}


async def retrieve(
    index: LexicalIndex,
    query: str,
    judge: EvidenceJudge,
    options: Sag2Options | None = None,
    *,
    cancel: Callable[[], bool] | None = None,
    bridge: TermBridge | None = None,
) -> Sag2Result:
    """SAG2 查询时多跳检索。全程不写索引，索引版本变化即返回显式状态。"""
    options = options or Sag2Options()
    started = time.perf_counter()
    paths: dict[str, dict[str, Any]] = {}
    result = Sag2Result(query=query, paths=paths, version=index.version)

    def finish(status: str, degraded: bool = False) -> Sag2Result:
        result.status = status
        result.degraded = degraded or status != STATUS_OK
        result.duration_ms = (time.perf_counter() - started) * 1000.0
        return result

    if index.chunk_count() == 0:
        _path(paths, "index", status="empty", reason="索引为空,未进入召回")
        return finish(STATUS_EMPTY_INDEX, degraded=True)

    query_terms = match_query(query)
    if not query_terms:
        _path(paths, "query", status="empty", reason="问题无可用词元")
        return finish(STATUS_EMPTY_QUERY, degraded=True)

    start_version = index.version
    retained: list[ScoredChunk] = []
    frontier: list[ScoredChunk] = []
    expanded: set[str] = set()
    seen: set[str] = set()
    carried: dict[str, ScoredChunk] = {}
    protected: dict[str, ScoredChunk] = {}
    latest: dict[str, ScoredChunk] = {}
    judge_executed_any = False
    judge_degraded_hops = 0
    judge_reason = NO_MODEL_REASON

    for hop in range(options.max_hops + 1):
        if cancel is not None and cancel():
            _path(paths, f"hop{hop}", status="cancelled", reason="调用方取消")
            return finish(STATUS_CANCELLED, degraded=True)
        if index.version != start_version:
            _path(paths, f"hop{hop}", status="index-changed", reason="索引版本在检索中变化")
            return finish(STATUS_INDEX_CHANGED, degraded=True)
        if hop > 0 and not frontier:
            _path(paths, f"hop{hop}", status="skipped", reason="上一轮无可用 frontier")
            break

        if hop == 0:
            terms: list[ExpansionTerm] = []
            candidates = index.candidate_query(query_terms, options.candidate_k, seen)
            if bridge is not None and options.cross_lingual and options.bridge_limit > 0:
                # 跨语言桥：**只补位，不抢名次**。原查询候选按自身顺序全量在前，
                # 桥接候选只填充到 candidate_k 的上限里；这样中文查询在英文文档上
                # 有救（原本零召回），而中英都命中时原排序一字不动。
                bridges = bridge.expand(query, index)
                if bridges:
                    reserved = min(options.bridge_limit, options.candidate_k)
                    keep = max(0, options.candidate_k - reserved)
                    primary = candidates[:keep] if keep else []
                    taken = seen | {c.key for c in candidates}
                    # 桥接词是「带空格的归一化短语」，而倒排的 posting 键是单个
                    # token（"vector retrieval" 只存在于两个 posting 里）。直接
                    # 拿短语查 posting 必然零命中，必须先按索引同一套规则拆词；
                    # 用 match_query 而非 casefold_tokens：中文侧只保留 bigram，
                    # 避免单字把全库召回。
                    groups = [
                        index.candidate_query(match_query(b.term), reserved, taken)
                        for b in bridges
                    ]
                    extra = interleave(groups, reserved)
                    candidates = primary + extra
                    result.bridge = [b.to_dict() for b in bridges]
                    _path(
                        paths,
                        "bridge",
                        raw_count=len(bridges),
                        count=len(extra),
                        dropped=max(0, len(bridges) - len(extra)),
                        reason="" if extra else "桥接词在索引里同样无命中",
                        terms=[b.term for b in bridges],
                    )
                else:
                    _path(
                        paths,
                        "bridge",
                        status="skipped",
                        reason="查询词无可用的跨语言对照(词典与语料均无)",
                    )
            for candidate in candidates[:PROTECTED_INITIAL]:
                protected[candidate.key] = candidate
        else:
            # 先生成较宽的词表，再按「能否召回新候选」过滤后截断预算：
            # 避免高频词吃满预算把桥接词挤掉（小语料上对照会退化成单轮）。
            wide_terms = expansion_terms(
                index,
                query,
                frontier,
                max(options.expansion_term_limit * 8, options.expansion_term_limit),
            )
            terms = resolve_terms(
                index, wide_terms, seen, options.expansion_term_limit
            )
            if not terms:
                _path(
                    paths,
                    f"hop{hop}",
                    status="skipped",
                    raw_count=len(wide_terms),
                    reason="扩展词排除已见候选后无新命中,预算未浪费",
                )
                break
            lists = index.candidate_queries(
                [term.term for term in terms], options.candidate_k, seen
            )
            candidates = interleave(lists, options.candidate_k)

        if not candidates:
            _path(paths, f"hop{hop}", status="empty", reason="本轮召回 0 候选")
            break

        for candidate in frontier:
            carried[candidate.key] = candidate
        pool: dict[str, ScoredChunk] = {}
        if hop > 0:
            pool.update(protected)
            pool.update(carried)
        for candidate in candidates:
            pool[candidate.key] = candidate

        evidence: list[ScoredChunk] = []
        if hop > 0:
            evidence_map = dict(carried)
            for candidate in candidates[: options.seed_k]:
                evidence_map[candidate.key] = candidate
            evidence = list(evidence_map.values())

        if hop == MAX_HOPS:
            # 第三轮：保留历史高分供重评分，新进候选最多 20，
            # evidence 固定为上一轮 top10 并带上 previous_score 快照。
            history = {k: v for k, v in pool.items() if k in latest}
            incoming = [c for c in pool.values() if c.key not in latest][:HOP2_INCOMING]
            previous = sorted(
                latest.values(), key=lambda c: (-c.score, c.key)
            )
            for candidate in previous:
                history.setdefault(candidate.key, candidate)
            keep = max(0, len(pool) - len(incoming))
            merged = list(history.values())[:keep] + incoming
            pool = {c.key: c for c in merged}
            evidence = []
            for candidate in retained[:HOP2_EVIDENCE]:
                candidate.previous_score = candidate.score
                evidence.append(candidate)

        if len(pool) > options.judge_pool_budget:
            _path(
                paths,
                f"budget:hop{hop}",
                status="budget",
                raw_count=len(pool),
                count=options.judge_pool_budget,
                dropped=len(pool) - options.judge_pool_budget,
                reason="候选池超出单轮判定预算,按分数截断",
            )
            pool = dict(
                sorted(pool.items(), key=lambda kv: -kv[1].bm25)[
                    : options.judge_pool_budget
                ]
            )

        verdict = await judge.score(query, list(pool.values()), evidence)
        result.judge_mode = verdict.mode
        if verdict.executed:
            # 模型真跑过的轮次不得再把「未配置模型」留作最终结果理由。
            # ModelJudge 成功路径 reason 为空（见 judge.py:196），故补中立说明。
            judge_executed_any = True
            judge_reason = verdict.reason or JUDGE_EXECUTED_REASON
        else:
            judge_degraded_hops += 1
            # 尚未有真跑过的轮次时，保留最近一次具体降级原因
            # （gateway 缺失 / provider 异常 / 空打分各不相同，不能压成一句）。
            if verdict.reason and not judge_executed_any:
                judge_reason = verdict.reason

        for key, candidate in pool.items():
            raw = verdict.scores.get(key)
            # 没有判定分就明写 0.0，绝不用 BM25 伪装成「模型已判定」。
            candidate.score = float(raw) if raw is not None else 0.0
            candidate.hop = hop
        retained = rank(list(pool.values()))
        for candidate in retained:
            latest[candidate.key] = candidate
            seen.add(candidate.key)
        frontier = [
            candidate
            for candidate in retained
            if candidate.key not in expanded
        ][: options.seed_k]
        for candidate in frontier:
            expanded.add(candidate.key)

        _path(
            paths,
            f"hop{hop}",
            raw_count=len(pool),
            count=len(retained),
            dropped=max(0, len(pool) - len(retained)),
            reason="" if verdict.executed else verdict.reason,
        )
        result.trace.append(
            {
                "hop": hop,
                "candidates": [c.key for c in candidates],
                "terms": [term.to_dict() for term in terms],
                "evidence": [c.key for c in evidence],
                "pool_size": len(pool),
                "judge_mode": verdict.mode,
                "judge_executed": verdict.executed,
                "judge_reason": verdict.reason,
            }
        )

    result.judge_executed = judge_executed_any
    # 形状锁：跨 hop 混合（部分轮次真跑、部分轮次降级）时，结果层三字段必须自洽。
    # executed=True 却仍显示 lexical-only / NO_MODEL_REASON 会让调用方误判为「从未判定」。
    if judge_executed_any:
        result.judge_mode = MODE_MODEL
        if judge_degraded_hops:
            judge_reason = (
                f"{JUDGE_EXECUTED_REASON};另有 {judge_degraded_hops} 轮诚实降级"
            )
        elif judge_reason == NO_MODEL_REASON:
            judge_reason = JUDGE_EXECUTED_REASON
    result.judge_reason = judge_reason

    if not retained:
        return finish(STATUS_NO_CANDIDATES, degraded=True)

    before_dpp = [c.key for c in retained]
    retained = diversify(retained, index.corpus_idf)
    _path(
        paths,
        "diversity",
        algorithm="dpp-greedy-orthogonalization",
        reordered=sum(
            1
            for a, b in zip(before_dpp, [c.key for c in retained], strict=False)
            if a != b
        ),
        reason="tf-idf 余弦核 × score 外积,贪心正交化",
    )

    hydrated = [c for c in retained if index.hydrate(c)]
    stale = len(retained) - len(hydrated)
    _path(
        paths,
        "hydration",
        raw_count=len(retained),
        count=len(hydrated),
        dropped=stale,
        reason="文件 hash/区间不匹配,跳过该候选而非整次查询失败" if stale else "",
    )
    retained = hydrated

    if options.file_limit is not None:
        seen_paths: set[str] = set()
        kept: list[ScoredChunk] = []
        for candidate in retained:
            if candidate.path in seen_paths or len(seen_paths) < options.file_limit:
                seen_paths.add(candidate.path)
                kept.append(candidate)
        retained = kept
    else:
        retained = retained[: min(options.top_k, options.candidate_k)]

    result.results = retained
    result.citations = [index.citation(c) for c in retained]
    result.version = index.version
    return finish(STATUS_OK)
