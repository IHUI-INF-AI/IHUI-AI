# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""BM25 粗筛的**等价性**证明（性能优化不许改变召回结果）。

本轮把 ``candidate_query`` 的打分内联、把全量排序换成定长堆，并把
``resolve_terms`` 的「探测第 1 名」换成不打分的布尔探测。三者都必须与
优化前的实现**逐条一致**，否则就不是优化而是换语义。

这里把旧实现作为参考实现固定下来：以后谁再动 ``candidate_query``，
这组测试会立刻指出「结果变了」。
"""

from __future__ import annotations

import math
import random

import pytest

from app.services.sag2_lexical import index as index_mod
from app.services.sag2_lexical.index import (
    BM25_B,
    BM25_K1,
    Chunk,
    LexicalIndex,
)
from app.services.sag2_lexical.text import casefold_tokens

TOPICS = ["预算审批", "报销流程", "向量检索", "合同评审", "数据合规", "权限模型"]
WORDS = ["流程", "规范", "边界", "指标", "口径", "责任"]


def _build(seed: int = 7, docs: int = 120) -> LexicalIndex:
    rng = random.Random(seed)
    index = LexicalIndex()
    for i in range(docs):
        topic = TOPICS[i % len(TOPICS)]
        body = " ".join(
            f"{topic}{rng.choice(WORDS)}第{j}节编号{i:04d}{j}"
            for j in range(rng.randint(3, 9))
        )
        index.add_document(f"doc/{i:04d}.md", body)
    return index


def _reference_candidate_query(
    index: LexicalIndex,
    terms: list[str],
    limit: int,
    excluded: set[str],
) -> list[str]:
    """优化前的实现（全量打分 + 全量 sorted + 顺序截断），逐行照抄。"""
    scores: dict[int, float] = {}
    for term in terms:
        for cid in index._postings.get(term, {}):  # noqa: SLF001 - 对照实现必须读同样的内部状态
            scores[cid] = scores.get(cid, 0.0) + _reference_bm25_term(index, term, cid)
    ranked = sorted(
        (cid for cid, value in scores.items() if value > 0),
        key=lambda cid: (-scores[cid], cid),
    )
    out: list[str] = []
    for cid in ranked:
        chunk = index._chunks.get(cid)  # noqa: SLF001
        if chunk is None:
            continue
        key = f"{chunk.path}#{chunk.chunk_id}:{chunk.start}-{chunk.end}"
        if key in excluded:
            continue
        out.append(key)
        if len(out) >= limit:
            break
    return out


def _reference_bm25_term(index: LexicalIndex, term: str, cid: int) -> float:
    tf = index._postings.get(term, {}).get(cid, 0)  # noqa: SLF001
    if tf <= 0:
        return 0.0
    dl = index._lengths.get(cid, 1) or 1  # noqa: SLF001
    avgdl = index._avgdl or 1.0  # noqa: SLF001
    denominator = tf + BM25_K1 * (1.0 - BM25_B + BM25_B * dl / avgdl)
    if denominator <= 0:
        return 0.0
    return index.bm25_idf(term) * (tf * (BM25_K1 + 1.0)) / denominator


def _keys(candidates: list) -> list[str]:
    return [c.key for c in candidates]


def test_candidate_query_matches_reference_exactly() -> None:
    index = _build()
    queries = ["预算审批", "报销流程", "向量检索 规范", "合同评审责任", "数据合规口径"]
    for query in queries:
        terms = casefold_tokens(query)
        for limit in (1, 3, 10, 100):
            got = _keys(index.candidate_query(terms, limit))
            want = _reference_candidate_query(index, terms, limit, set())
            assert got == want, f"query={query} limit={limit} 候选集不一致"


def test_candidate_query_matches_reference_with_excluded() -> None:
    """excluded 必须在截断**之前**过滤（否则 limit=1 探测会误判无新命中）。"""
    index = _build(seed=11)
    terms = casefold_tokens("预算审批流程")
    full = _reference_candidate_query(index, terms, 50, set())
    excluded = set(full[:7])
    assert _keys(index.candidate_query(terms, 5, excluded)) == _reference_candidate_query(
        index, terms, 5, excluded
    )
    # limit=1 且第一名被排除时，必须给出第 8 名而不是空
    single = _keys(index.candidate_query(terms, 1, excluded))
    assert single == _reference_candidate_query(index, terms, 1, excluded)
    assert single


def test_heap_path_equals_full_sort_path(monkeypatch: pytest.MonkeyPatch) -> None:
    """定长堆分支与全量排序分支必须给出同一串候选。

    用 monkeypatch 把 ``heapq.nsmallest`` 换成「全排序取前 k」，
    再与不打扰时的输出逐条比较。
    """
    index = _build(seed=23, docs=200)
    terms = casefold_tokens("向量检索规范")
    baseline = _keys(index.candidate_query(terms, 5))
    assert baseline, "语料应能命中，否则本对照组无意义"

    real_nsmallest = index_mod.heapq.nsmallest

    def _as_full_sort(n: int, iterable, key=None):  # noqa: ANN001, ANN202
        return sorted(iterable, key=key)[:n]

    try:
        monkeypatch.setattr(index_mod.heapq, "nsmallest", _as_full_sort)
        heap_off = _keys(index.candidate_query(terms, 5))
    finally:
        monkeypatch.setattr(index_mod.heapq, "nsmallest", real_nsmallest)

    # 不打扰时应走堆分支（候选数远大于 4×(limit+excluded)）
    assert _keys(index.candidate_query(terms, 5)) == baseline
    assert heap_off == baseline, "堆分支与全排序分支结果不一致"


def test_has_new_candidate_matches_candidate_query() -> None:
    """布尔探测必须与「真跑一次 limit=1」同解，随机 excluded 上验证。"""
    index = _build(seed=31)
    rng = random.Random(99)
    all_keys = [
        f"{c.path}#{c.chunk_id}:{c.start}-{c.end}"
        for c in index._chunks.values()  # noqa: SLF001
    ]
    for term in ["预算", "审批", "流程", "向量检索", "规范", "口径", "不存在的词"]:
        tokens = casefold_tokens(term)
        for _ in range(12):
            excluded = set(rng.sample(all_keys, rng.randint(0, min(20, len(all_keys)))))
            assert index.has_new_candidate(tokens, excluded) == bool(
                index.candidate_query(tokens, 1, excluded)
            ), f"term={term} excluded={len(excluded)} 两者不同解"


def test_has_new_candidate_true_when_posting_untouched() -> None:
    index = _build(seed=5, docs=10)
    assert index.has_new_candidate(casefold_tokens("预算"), set()) is True
    assert index.has_new_candidate(casefold_tokens("压根没有这词"), set()) is False


def test_idf_positive_for_saturated_term() -> None:
    """全部块都含该词时 df==N，idf 仍为正 ⇒ has_new_candidate 的等价前提成立。

    中文按 bigram 切词，所以这里直接探测 ``公共``（每篇都出现的词元），
    而不是整词 ``公共词``——后者在倒排里根本不存在，测不到饱和态。
    """
    index = LexicalIndex()
    for i in range(5):
        index.add_document(f"d/{i}.md", "公共词 独有%d" % i)
    term = "公共"
    assert term in casefold_tokens("公共词 独有0")
    df = index.frequency(term)
    n = index.chunk_count()
    assert df == n == 5
    assert math.log(1.0 + (n - df + 0.5) / (df + 0.5)) > 0
    assert index.has_new_candidate([term], set()) is True
    # 全部块都被排除 ⇒ 没有「新」候选
    all_keys = {
        f"{c.path}#{c.chunk_id}:{c.start}-{c.end}"
        for c in index._chunks.values()  # noqa: SLF001
    }
    assert index.has_new_candidate([term], all_keys) is False


def test_chunk_key_shape_matches_scored_chunk() -> None:
    """has_new_candidate 手拼的 key 必须与 ScoredChunk.key 同形。"""
    index = _build(seed=3, docs=3)
    chunk: Chunk = next(iter(index._chunks.values()))  # noqa: SLF001
    hand = f"{chunk.path}#{chunk.chunk_id}:{chunk.start}-{chunk.end}"
    candidates = index.candidate_query(casefold_tokens(chunk.content[:4]), 50)
    keys = {c.key for c in candidates}
    assert hand in keys
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
