# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法多跳通道回归测试（固定夹具钉死行为，不依赖模型服务）。

取证来源 SAG Wiki（MIT）；被测代码为本仓自有实现。测试覆盖：
中文分词、BM25、hash 增量、citation 锚定、扩展词、interleave、
DPP 终排、三跳链路、诚实降级自证、显式状态、快速搜索、RRF 融合、API。
"""

from __future__ import annotations

import asyncio

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.services.sag2_lexical import (
    LexicalIndex,
    LexicalOnlyJudge,
    Sag2LexicalService,
    Sag2Options,
    ScoredChunk,
    casefold_tokens,
    diversify,
    expansion_terms,
    interleave,
    retrieve,
    sentence_spans,
)
from app.services.sag2_lexical.index import Chunk, sha256_text
from app.services.sag2_lexical.judge import MODE_LEXICAL_ONLY
from app.services.sag2_lexical.retrieval import (
    STATUS_CANCELLED,
    STATUS_EMPTY_INDEX,
    STATUS_OK,
)

# 文章里的三跳例子：doc3 不含「收购 / B公司 / CTO」任一原查询词，
# 只能靠查询时关联（doc1 → A公司 → doc2 → 张三 → doc3）抵达。
MULTIHOP_DOCS = [
    ("kb/acquisition.txt", "A公司全资收购了B公司。A公司总部设在深圳。"),
    ("kb/cto.txt", "A公司任命张三为CTO。张三负责A公司的技术战略。"),
    # 刻意不含「收购 / B公司 / CTO / 项目 / 加入」任一原查询词，
    # 也不含查询里的任何 bigram：只能靠 doc1→A公司→doc2→张三 抵达。
    ("kb/project.txt", "张三离职后转战盘古大模型。该模型由张三牵头研发。"),
    ("kb/noise1.txt", "本周食堂菜单包含米饭与青菜。"),
    ("kb/noise2.txt", "海边城市的天气预报显示晴朗。"),
    ("kb/noise3.txt", "音乐会门票在售票窗口领取。"),
    ("kb/noise4.txt", "图书馆借阅规则已经更新。"),
    ("kb/noise5.txt", "列车时刻表按季节调整。"),
    ("kb/noise6.txt", "博物馆展出了青铜器皿。"),
]


def make_index() -> LexicalIndex:
    index = LexicalIndex()
    for path, content in MULTIHOP_DOCS:
        index.add_document(path, content)
    return index


def make_candidate(
    cid: int,
    content: str,
    *,
    score: float = 0.0,
    path: str = "fixture.txt",
) -> ScoredChunk:
    chunk = Chunk(
        chunk_id=cid,
        path=path,
        title=path,
        heading="",
        content=content,
        start=0,
        end=len(content),
        start_line=1,
        end_line=1,
        doc_hash=sha256_text(content),
    )
    return ScoredChunk(chunk=chunk, score=score)


# ---------------------------------------------------------------------------
# 文本层
# ---------------------------------------------------------------------------


def test_cjk_tokenization_emits_single_chars_and_bigrams():
    tokens = casefold_tokens("A公司收购了B公司")
    assert "a" in tokens and "b" in tokens  # 拉丁串整词保留
    assert "公" in tokens and "司" in tokens  # CJK 单字
    assert "公司" in tokens and "收购" in tokens  # CJK 相邻 bigram


def test_sentence_spans_isolate_chinese_context():
    spans = sentence_spans("台风登陆。救援开始！人员安全吗？仍在核查")
    assert [span[2] for span in spans] == ["台风登陆", "救援开始", "人员安全吗", "仍在核查"]
    assert all(span[0] < span[1] for span in spans)


def test_match_query_dedups_and_drops_generic_cjk_singletons():
    from app.services.sag2_lexical import match_query

    terms = match_query("收购 收购 收购")
    assert len(terms) == len(set(terms))  # 去重且保序
    assert "收购" in terms  # bigram 保留
    assert "收" not in terms and "购" not in terms  # 泛化单字不进查询
    assert "cto" in match_query("CTO 是谁")  # 拉丁词保留


# ---------------------------------------------------------------------------
# 索引层
# ---------------------------------------------------------------------------


def test_bm25_prefers_chunk_with_query_terms():
    index = LexicalIndex()
    index.add_document("a.txt", "量子计算的最新进展")
    index.add_document("b.txt", "公司食堂本周菜谱")
    hits = index.candidate_query(casefold_tokens("量子计算"), 10)
    assert hits and hits[0].path == "a.txt"
    assert hits[0].bm25 > 0


def test_incremental_same_hash_skips_rebuild():
    index = LexicalIndex()
    first = index.add_document("a.txt", "原始内容")
    assert first.changed
    version = index.version
    second = index.add_document("a.txt", "原始内容")
    assert not second.changed
    assert "unchanged" in second.reason
    assert index.version == version  # 缓存不失效
    third = index.add_document("a.txt", "内容已修改")
    assert third.changed
    assert index.version == version + 1


def test_hydrate_detects_externally_changed_source():
    index = LexicalIndex()
    index.add_document("a.txt", "原始段落内容")
    candidate = index.candidate_query(casefold_tokens("原始"), 10)[0]
    assert index.hydrate(candidate) is True
    index._doc_sources["a.txt"] = "被外部程序改掉的内容"
    assert index.hydrate(candidate) is False  # 只跳过该候选，不抛异常


def test_citation_is_anchored_to_hash_range_and_passage():
    index = LexicalIndex()
    outcome = index.add_document("a.txt", "可回溯的原文段落。")
    candidate = index.candidate_query(casefold_tokens("回溯"), 10)[0]
    citation = index.citation(candidate)
    assert citation["doc_hash"] == outcome.doc_hash
    assert citation["byte_range"][1] > citation["byte_range"][0]
    assert citation["passage"] == candidate.content
    assert citation["start_line"] >= 1


def test_index_status_exposes_ready_flag():
    assert LexicalIndex().status()["ready"] is False
    assert make_index().status()["ready"] is True


# ---------------------------------------------------------------------------
# 纯函数：扩展词 / 轮询合并 / DPP
# ---------------------------------------------------------------------------


def test_expansion_terms_bridge_out_of_query_vocabulary():
    index = make_index()
    seed = make_candidate(1, "A公司全资收购了B公司。A公司总部设在深圳。", score=0.9)
    terms = expansion_terms(index, "收购了B公司", [seed], 8)
    assert terms, "应从证据段落里抽出可用扩展词"
    query_terms = set(casefold_tokens("收购了B公司"))
    assert any(term.term not in query_terms for term in terms)
    assert all(term.score > 0 for term in terms)


def test_candidate_query_excludes_before_limiting():
    """回归：先排除已见候选再截断；否则 limit=1 探测会把桥接词误判为无新命中。"""
    index = make_index()
    seen = {c.key for c in index.candidate_query(casefold_tokens("公司"), 10) if c.path == "kb/cto.txt"}
    probe = index.candidate_query(casefold_tokens("张三"), 1, seen)
    assert probe, "张三应能在排除 doc2 后仍召回未见的 doc3"
    assert probe[0].path == "kb/project.txt"


def test_resolve_terms_keeps_only_bridge_terms():
    """回归：扩展预算只花在能召回新候选的桥接词上，高频旧词不得占满。"""
    from app.services.sag2_lexical.retrieval import resolve_terms

    index = make_index()
    query = "收购了B公司的企业，其CTO后来加入了哪个项目"
    # 与主循环同一口径：查询只用 bigram + 拉丁词，不能用含泛化单字的
    # casefold_tokens，否则噪声文档会被误召回并 seen，测试前提就不成立。
    from app.services.sag2_lexical import match_query

    seeds = index.candidate_query(match_query(query), 10)
    for seed in seeds:
        seed.score = 0.9
    wide = expansion_terms(index, query, seeds, 64)
    seen = {seed.key for seed in seeds}
    kept = resolve_terms(index, wide, seen, 8)
    assert kept, "应保留至少一个能带来新候选的扩展词"
    for term in kept:
        assert index.candidate_query(casefold_tokens(term.term), 1, seen), (
            f"保留的扩展词 {term.term} 必须真能召回新候选"
        )
    assert "张三" in {term.term for term in kept}, "桥接词张三不得被高频旧词挤出预算"


def test_interleave_is_rank_round_robin_and_deduplicates():
    group_a = [make_candidate(i, f"内容{i}") for i in (1, 3, 4)]
    group_b = [make_candidate(i, f"内容{i}") for i in (2, 3, 5)]
    merged = interleave([group_a, group_b], 5)
    assert [c.chunk.chunk_id for c in merged] == [1, 2, 3, 4, 5]
    assert [c.order for c in merged] == [0, 1, 2, 3, 4]


def test_diversify_is_deterministic_and_does_not_mutate_input():
    candidates = [
        make_candidate(1, "同一段重复内容", score=0.9),
        make_candidate(2, "同一段重复内容", score=0.85),
        make_candidate(3, "完全不同的独特主题", score=0.8),
    ]
    original = list(candidates)
    first = diversify(candidates, lambda _term: 1.0)
    second = diversify(candidates, lambda _term: 1.0)
    assert [c.chunk.chunk_id for c in first] == [c.chunk.chunk_id for c in second]
    assert candidates == original  # 纯函数，不就地改
    assert len(first) == 3


# ---------------------------------------------------------------------------
# 主循环：多跳 / 诚实降级 / 显式状态
# ---------------------------------------------------------------------------


def test_multihop_reaches_document_without_any_query_term():
    index = make_index()
    result = asyncio.run(
        retrieve(
            index,
            "收购了B公司的企业，其CTO后来加入了哪个项目",
            LexicalOnlyJudge(),
            Sag2Options(max_hops=2, top_k=10),
        )
    )
    assert result.status == STATUS_OK
    assert len(result.trace) >= 2, "应至少发生一轮关键词扩展"
    assert any(hop["terms"] for hop in result.trace[1:]), "扩展轮必须带出扩展词"
    later = {key for hop in result.trace[1:] for key in hop["candidates"]}
    assert any("project.txt" in key for key in later), (
        "第三跳文档不含任何原查询词，必须靠查询时关联（段落→词条→段落）抵达"
    )


def test_judge_not_executed_is_explicit_and_never_disguised():
    result = asyncio.run(
        retrieve(make_index(), "收购B公司", LexicalOnlyJudge(), Sag2Options(max_hops=1))
    )
    assert result.judge_mode == MODE_LEXICAL_ONLY
    assert result.judge_executed is False
    assert result.judge_reason, "必须写明未跑模型的原因"
    assert all(hop["judge_executed"] is False for hop in result.trace)
    payload = result.to_dict()
    assert payload["judge"]["executed"] is False
    assert "paths" in payload and "citations" in payload


def test_empty_index_returns_explicit_state():
    result = asyncio.run(retrieve(LexicalIndex(), "任意问题", LexicalOnlyJudge()))
    assert result.status == STATUS_EMPTY_INDEX
    assert result.degraded is True
    assert result.paths["index"]["status"] == "empty"


def test_cancellation_returns_explicit_state():
    result = asyncio.run(
        retrieve(
            make_index(),
            "收购B公司",
            LexicalOnlyJudge(),
            cancel=lambda: True,
        )
    )
    assert result.status == STATUS_CANCELLED
    assert result.degraded is True


def test_index_version_change_mid_query_is_detected():
    from app.services.sag2_lexical.judge import JudgeVerdict

    class MutatingJudge:
        def __init__(self, index: LexicalIndex) -> None:
            self.index = index
            self.calls = 0

        async def score(self, question, candidates, evidence) -> JudgeVerdict:
            self.calls += 1
            self.index.add_document("new.txt", "新文档进入索引")
            return JudgeVerdict(scores={c.key: 0.5 for c in candidates})

    index = make_index()
    result = asyncio.run(
        retrieve(index, "收购B公司", MutatingJudge(index), Sag2Options(max_hops=2))
    )
    assert result.status == "index-changed"


# ---------------------------------------------------------------------------
# 门面 / 融合 / API
# ---------------------------------------------------------------------------


def test_search_is_zero_model_and_paginates_by_file():
    service = Sag2LexicalService(index=make_index())
    payload = service.search("张三", page=1, per_page=2)
    assert payload["mode"] == "lexical-bm25"
    assert payload["model_calls"] == 0
    assert payload["per_page"] == 2
    assert payload["total_files"] >= 1
    assert all(item["citation"]["doc_hash"] for item in payload["items"])


def test_add_document_reports_zero_model_calls():
    service = Sag2LexicalService()
    payload = service.add_document("a.txt", "零模型建库的内容")
    assert payload["model_calls"] == 0
    assert payload["changed"] is True


def test_fuse_with_rag_marks_three_channel_provenance():
    fused = Sag2LexicalService.fuse_with_rag(
        [{"key": "k1", "content": "词法通道结果"}],
        [{"content": "向量通道结果", "fused_from": "vector+keyword"}],
        k=60,
    )
    assert len(fused) == 2
    assert all(row["rrf_score"] > 0 for row in fused)
    assert all("sag2-lexical-multihop" in row["fused_from"] or
               "rag-vector-keyword" in row["fused_from"] for row in fused)


def test_api_endpoints_status_documents_search_retrieve_fuse():
    from app.api.v1 import sag2_lexical as api_module

    isolated = Sag2LexicalService()
    original = api_module.sag2_lexical_service
    api_module.sag2_lexical_service = isolated

    async def scenario() -> dict:
        app = FastAPI()
        app.include_router(api_module.router, prefix="/api/v1/ai/sag2")
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            added = await client.post(
                "/api/v1/ai/sag2/documents",
                json={"path": "api/a.txt", "content": "A公司收购了B公司。"},
            )
            status = await client.get("/api/v1/ai/sag2/status")
            found = await client.post(
                "/api/v1/ai/sag2/search", json={"query": "收购", "per_page": 5}
            )
            deep = await client.post(
                "/api/v1/ai/sag2/retrieve",
                json={"query": "收购B公司的是谁", "max_hops": 1},
            )
            fused = await client.post(
                "/api/v1/ai/sag2/fuse",
                json={
                    "sag2_results": [{"key": "k1", "content": "x"}],
                    "rag_sources": [{"content": "y"}],
                },
            )
            return {
                "added": added.json(),
                "status": status.json(),
                "found": found.json(),
                "deep": deep.json(),
                "fused": fused.json(),
            }

    try:
        out = asyncio.run(scenario())
    finally:
        api_module.sag2_lexical_service = original

    assert out["added"]["data"]["model_calls"] == 0
    assert out["status"]["data"]["documents"] == 1
    assert out["found"]["data"]["model_calls"] == 0
    assert out["deep"]["data"]["judge"]["executed"] is False
    assert out["deep"]["data"]["status"] == STATUS_OK
    assert len(out["fused"]["data"]["results"]) == 2
