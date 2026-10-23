# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #52「RAG 真重排」测试:RRF 融合 + LLM 二段重排的降级链。

覆盖口径(承 PROJECT_PLAN 票面待办②):
- RRF 手算断言(论文口径 score = Σ 1/(k+rank),rank 从 1 计)
- 去重聚合(id/path/content 前 200 三级键;融合代表取名次最高路首次出现对象)
- 关键词单路降级(只有一路召回时名次保持、label 正确)
- LLM mock 失败降级(未启用/异常/超时/错误 dict/非法输出 一律回退原排序,绝不抛)
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.services import reranker
from app.services.reranker import (
    DEFAULT_LLM_RERANK_TOP_K,
    RERANK_LLM_ENABLED_ENV,
    RERANK_LLM_TOP_K_ENV,
    _default_key,
    _env_flag,
    llm_rerank_enabled,
    llm_rerank_scores,
    llm_rerank_top_k,
    rrf_fuse,
)


def _doc(i: int, content: str | None = None) -> SimpleNamespace:
    """鸭子类型候选:reranker 只依赖 .id/.path/.content 属性。"""
    return SimpleNamespace(id=f"doc-{i}", content=content if content is not None else f"content-{i}")


# =========================================================================
# RRF 融合:手算断言
# =========================================================================


def test_rrf_hand_computed_two_paths():
    """向量路 [A,B,C] × 关键词路 [B,C,A],k=60 手算三枚分数与名次。"""
    a, b, c = _doc(0), _doc(1), _doc(2)
    fused = rrf_fuse([[a, b, c], [b, c, a]], k=60, labels=["vector", "keyword"])

    assert [f.item.id for f in fused] == ["doc-1", "doc-0", "doc-2"]  # B > A > C
    scores = {f.item.id: f.score for f in fused}
    assert scores["doc-1"] == pytest.approx(1 / 62 + 1 / 61)  # B: 向量 rank2 + 关键词 rank1
    assert scores["doc-0"] == pytest.approx(1 / 61 + 1 / 63)  # A: 向量 rank1 + 关键词 rank3
    assert scores["doc-2"] == pytest.approx(1 / 63 + 1 / 62)  # C: 向量 rank3 + 关键词 rank2
    # 名次差被 k=60 平滑:双路 rank1+rank2 的 B 反超单路冠军 A,这正是 RRF 的聚合语义


def test_rrf_stable_tie_keeps_first_occurrence():
    """同分(各占一路 rank1)按首次出现顺序稳定排列。"""
    x, y = _doc(0), _doc(1)
    fused = rrf_fuse([[x], [y]], k=60)
    assert [f.item.id for f in fused] == ["doc-0", "doc-1"]
    assert fused[0].score == fused[1].score == pytest.approx(1 / 61)


def test_rrf_empty_inputs():
    assert rrf_fuse([]) == []
    assert rrf_fuse([[], []]) == []


def test_rrf_single_path_keyword_degradation():
    """只有关键词一路(向量路挂/空)时:名次保持、分数 1/(k+rank)、label 落上。"""
    d1, d2, d3 = _doc(0), _doc(1), _doc(2)
    fused = rrf_fuse([[d1, d2, d3]], k=60, labels=["keyword"])
    assert [f.item.id for f in fused] == ["doc-0", "doc-1", "doc-2"]
    for rank, f in enumerate(fused, start=1):
        assert f.score == pytest.approx(1 / (60 + rank))
        assert f.fused_from == ["keyword"]


def test_rrf_custom_k():
    """k=0 退化为 1/rank,分数可精确手算。"""
    d1, d2 = _doc(0), _doc(1)
    fused = rrf_fuse([[d1, d2]], k=0)
    assert fused[0].score == pytest.approx(1.0)
    assert fused[1].score == pytest.approx(0.5)


def test_rrf_labels_default_and_mismatch():
    """labels 缺省自动 r0/r1;labels 短于路数时缺位用默认标签兜底。"""
    fused = rrf_fuse([[_doc(0)], [_doc(1)]])
    assert [f.fused_from for f in fused] == [["r0"], ["r1"]]

    fused = rrf_fuse([[_doc(0)], [_doc(1)]], labels=["vector"])
    assert fused[0].fused_from == ["vector"]
    assert fused[1].fused_from == ["r1"]


# =========================================================================
# 去重聚合
# =========================================================================


def test_rrf_dedup_by_id_aggregates_and_keeps_top_rank_representative():
    """同 id 双路命中:聚合成一条、分数相加、fused_from 记两路;代表取首次出现对象。"""
    v = _doc(7, content="from-vector")
    k = _doc(7, content="from-keyword")  # 同 id 不同对象(两路各自实例)
    other = _doc(9)
    fused = rrf_fuse([[v, other], [k]], k=60, labels=["vector", "keyword"])

    assert len(fused) == 2
    top = fused[0]  # doc-7: 1/61 + 1/61 > doc-9: 1/62
    assert top.item is v  # 代表 = 名次最高路的首次出现对象
    assert top.item.content == "from-vector"
    assert top.score == pytest.approx(2 / 61)
    assert top.fused_from == ["vector", "keyword"]


def test_default_key_priority_id_path_content():
    assert _default_key({"id": "x"}) == "id:x"
    assert _default_key({"path": "p/q.md"}) == "path:p/q.md"
    assert _default_key(SimpleNamespace(id="x", path="ignored")) == "id:x"
    assert _default_key({"content": "  hello  "}) == "content:hello"


def test_default_key_content_prefix_200_dedup():
    """无 id/path 时按 content 前 200 字符归一:前缀相同、尾部不同的两条视为同源。"""
    head = "A" * 200
    a = {"content": head + "-tail-1"}
    b = {"content": head + "-tail-2"}
    assert _default_key(a) == _default_key(b)
    fused = rrf_fuse([[a], [b]], k=60)
    assert len(fused) == 1
    assert fused[0].item is a
    assert fused[0].score == pytest.approx(2 / 61)


# =========================================================================
# env 解析
# =========================================================================


@pytest.mark.parametrize("raw", ["1", "true", "TRUE", "yes", "On", " true "])
def test_env_flag_truthy(monkeypatch, raw):
    monkeypatch.setenv("IHUI_TEST_FLAG", raw)
    assert _env_flag("IHUI_TEST_FLAG", default=False) is True


@pytest.mark.parametrize("raw", ["0", "false", "no", "off", "garbage"])
def test_env_flag_falsy(monkeypatch, raw):
    monkeypatch.setenv("IHUI_TEST_FLAG", raw)
    assert _env_flag("IHUI_TEST_FLAG", default=True) is False


def test_env_flag_unset_or_empty_uses_default(monkeypatch):
    monkeypatch.delenv("IHUI_TEST_FLAG", raising=False)
    assert _env_flag("IHUI_TEST_FLAG", default=True) is True
    monkeypatch.setenv("IHUI_TEST_FLAG", "")
    assert _env_flag("IHUI_TEST_FLAG", default=True) is True


def test_llm_rerank_enabled_default_off(monkeypatch):
    monkeypatch.delenv(RERANK_LLM_ENABLED_ENV, raising=False)
    assert llm_rerank_enabled() is False


@pytest.mark.parametrize(
    "raw,expected",
    [
        (None, DEFAULT_LLM_RERANK_TOP_K),
        ("", DEFAULT_LLM_RERANK_TOP_K),
        ("5", 5),
        ("abc", DEFAULT_LLM_RERANK_TOP_K),
        ("0", DEFAULT_LLM_RERANK_TOP_K),
        ("-3", DEFAULT_LLM_RERANK_TOP_K),
    ],
)
def test_llm_rerank_top_k(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv(RERANK_LLM_TOP_K_ENV, raising=False)
    else:
        monkeypatch.setenv(RERANK_LLM_TOP_K_ENV, raw)
    assert llm_rerank_top_k() == expected


# =========================================================================
# llm_rerank_scores:mock 网关 + 降级链
# =========================================================================


def _mock_gateway(monkeypatch, result=None, side_effect=None, delay_s: float = 0.0):
    """替换 llm_gateway.structured_completion,返回调用记录列表。"""
    calls: list[dict] = []

    async def _sc(messages, schema, model=None, *, owner_uuid=None,
                  schema_name="structured_response", max_retries=1):
        calls.append({"messages": messages, "schema": schema, "model": model,
                      "schema_name": schema_name})
        if delay_s:
            await asyncio.sleep(delay_s)
        if side_effect is not None:
            raise side_effect
        return result

    monkeypatch.setattr(reranker.llm_gateway, "structured_completion", _sc)
    return calls


@pytest.fixture()
def llm_on(monkeypatch):
    monkeypatch.setenv(RERANK_LLM_ENABLED_ENV, "true")


def test_scores_disabled_returns_none(monkeypatch):
    monkeypatch.delenv(RERANK_LLM_ENABLED_ENV, raising=False)
    calls = _mock_gateway(monkeypatch, result={"scores": []})
    assert asyncio.run(llm_rerank_scores("q", [_doc(0)])) is None
    assert calls == []  # 未启用连网关都不碰


def test_scores_empty_items_returns_none(llm_on, monkeypatch):
    calls = _mock_gateway(monkeypatch, result={"scores": []})
    assert asyncio.run(llm_rerank_scores("q", [])) is None
    assert calls == []


def test_scores_gateway_exception_degrades(llm_on, monkeypatch):
    _mock_gateway(monkeypatch, side_effect=RuntimeError("boom"))
    assert asyncio.run(llm_rerank_scores("q", [_doc(0)])) is None


def test_scores_timeout_degrades(llm_on, monkeypatch):
    _mock_gateway(monkeypatch, result={"scores": [{"index": 0, "score": 9}]}, delay_s=0.05)
    monkeypatch.setattr(reranker, "LLM_RERANK_TIMEOUT_S", 0.01)
    assert asyncio.run(llm_rerank_scores("q", [_doc(0)])) is None


@pytest.mark.parametrize(
    "bad_result",
    [
        {"error": True, "error_message": "provider down"},
        "not-a-dict",
        {"scores": "nope"},
        {},
    ],
)
def test_scores_invalid_shape_degrades(llm_on, monkeypatch, bad_result):
    _mock_gateway(monkeypatch, result=bad_result)
    assert asyncio.run(llm_rerank_scores("q", [_doc(0), _doc(1)])) is None


def test_scores_valid_maps_and_keeps_reason(llm_on, monkeypatch):
    _mock_gateway(monkeypatch, result={
        "scores": [
            {"index": 0, "score": 8.5, "reason": "直接回答"},
            {"index": 2, "score": 3},
        ]
    })
    out = asyncio.run(llm_rerank_scores("q", [_doc(0), _doc(1), _doc(2)]))
    assert out == [(0, 8.5, "直接回答"), (2, 3.0, "")]


def test_scores_drops_bad_entries_and_clamps(llm_on, monkeypatch):
    _mock_gateway(monkeypatch, result={
        "scores": [
            {"index": 99, "score": 5},      # 越界 → 丢
            {"index": -1, "score": 5},      # 负界 → 丢
            {"score": 5},                    # 缺 index → 跳
            {"index": 0, "score": "abc"},    # 分数非法 → 跳
            {"index": 1, "score": 15},       # 上截断到 10
            {"index": 2, "score": -5},       # 下截断到 0
            "not-a-dict",                    # 非 dict → 跳
        ]
    })
    out = asyncio.run(llm_rerank_scores("q", [_doc(0), _doc(1), _doc(2)]))
    assert out == [(1, 10.0, ""), (2, 0.0, "")]


def test_scores_all_entries_invalid_returns_none(llm_on, monkeypatch):
    _mock_gateway(monkeypatch, result={"scores": [{"score": 1}, {"index": 50, "score": 2}]})
    assert asyncio.run(llm_rerank_scores("q", [_doc(0)])) is None


def test_scores_prompt_shape(llm_on, monkeypatch):
    calls = _mock_gateway(monkeypatch, result={"scores": [{"index": 0, "score": 5}]})
    long_content = "X" * 300 + "TAIL-MARKER-OVERFLOW"
    asyncio.run(llm_rerank_scores("RRF 是什么", [_doc(0, content=long_content)]))
    assert len(calls) == 1
    call = calls[0]
    assert call["schema_name"] == "rag_rerank_scores"
    assert call["schema"] is reranker._RERANK_SCHEMA
    user_msg = call["messages"][1]["content"]
    assert "RRF 是什么" in user_msg
    assert "[0] " + "X" * 300 in user_msg          # 候选截断到 300 字符
    assert "TAIL-MARKER-OVERFLOW" not in user_msg  # 300 之后的内容不外泄


# =========================================================================
# rerank_with_fallback:总入口降级与重排语义
# =========================================================================


def test_fallback_disabled_returns_copy_original_order(monkeypatch):
    monkeypatch.delenv(RERANK_LLM_ENABLED_ENV, raising=False)
    items = [_doc(0), _doc(1)]
    out, used = asyncio.run(reranker.rerank_with_fallback("q", items))
    assert used is False
    assert out == items
    assert out is not items  # 返回副本,不暴露原列表


def test_fallback_empty_items(monkeypatch):
    monkeypatch.setenv(RERANK_LLM_ENABLED_ENV, "true")
    out, used = asyncio.run(reranker.rerank_with_fallback("q", []))
    assert (out, used) == ([], False)


def test_fallback_llm_failure_keeps_original_order(llm_on, monkeypatch):
    items = [_doc(i) for i in range(3)]
    _mock_gateway(monkeypatch, side_effect=RuntimeError("gateway down"))
    out, used = asyncio.run(reranker.rerank_with_fallback("q", items))
    assert used is False
    assert [f.id for f in out] == ["doc-0", "doc-1", "doc-2"]


def test_fallback_success_reorders_head_and_appends_tail(llm_on, monkeypatch):
    a, b, c, d = _doc(0), _doc(1), _doc(2), _doc(3)
    _mock_gateway(monkeypatch, result={
        "scores": [{"index": 2, "score": 9.0}, {"index": 0, "score": 5.0}]
    })
    # b(index 1)未获分 → 按原顺序垫在已打分候选之后;tail 不参与重排
    out, used = asyncio.run(reranker.rerank_with_fallback("q", [a, b, c, d], top_k=3))
    assert used is True
    assert [f.id for f in out] == ["doc-2", "doc-0", "doc-1", "doc-3"]


def test_fallback_tie_scores_ordered_by_index(llm_on, monkeypatch):
    a, b = _doc(0), _doc(1)
    _mock_gateway(monkeypatch, result={
        "scores": [{"index": 1, "score": 7.0}, {"index": 0, "score": 7.0}]
    })
    # 输入序 [b, a]:同分按候选下标升序 ⇒ 下标 0(b=doc-1)排在前
    out, used = asyncio.run(reranker.rerank_with_fallback("q", [b, a]))
    assert used is True
    assert [f.id for f in out] == ["doc-1", "doc-0"]


def test_fallback_default_top_k_from_env(llm_on, monkeypatch):
    monkeypatch.setenv(RERANK_LLM_TOP_K_ENV, "2")
    calls = _mock_gateway(monkeypatch, result={"scores": [{"index": 0, "score": 1}]})
    items = [_doc(i) for i in range(5)]
    out, used = asyncio.run(reranker.rerank_with_fallback("q", items))
    assert used is True
    # 网关只收到前 2 条候选(env top_k 生效),后 3 条原序垫尾
    prompt = calls[0]["messages"][1]["content"]
    assert "[0] content-0" in prompt and "[1] content-1" in prompt
    assert "[2] " not in prompt
    assert [f.id for f in out] == ["doc-0", "doc-1", "doc-2", "doc-3", "doc-4"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
