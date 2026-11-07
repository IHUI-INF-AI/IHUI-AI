# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""行区间就近合并(Z12 第二格)—— 纯函数判据 + 下发路径装车证明。

`merge_line_spans` 是**可 diff 可测的纯函数**(区间列表进、合并后区间出);
消费点是 `codebase_indexer.search()` 出口 —— 只被测试调用不算交付(§0.9)。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import codebase_indexer as cbi
from app.services.codebase_indexer import CodebaseIndexer
from app.services.codebase_recall_expand import (
    GAP_SKIPPED_KEY,
    MERGED_COUNT_KEY,
    MERGED_RANGES_KEY,
    fold_adjacent_hits,
    merge_line_spans,
    truncate_chunk,
)


def _hit(path: str, start: int, end: int, content: str, score: float = 0.5, **extra: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "file_path": path,
        "line_start": start,
        "line_end": end,
        "content": content,
        "score": score,
    }
    row.update(extra)
    return row


# ---- 纯函数判据 ----


def test_merge_spans_overlap_touch_and_gap() -> None:
    assert merge_line_spans([(10, 20), (1, 5)]) == [(1, 5), (10, 20)]
    assert merge_line_spans([(1, 5), (5, 9)]) == [(1, 9)], "相接(重叠一行)必须并"
    assert merge_line_spans([(1, 5), (7, 9)]) == [(1, 5), (7, 9)], "隔 1 行且 gap=0 ⇒ 不并"
    assert merge_line_spans([(1, 5), (7, 9)], gap_lines=1) == [(1, 9)]
    assert merge_line_spans([(1, 5), (20, 30)], gap_lines=3) == [(1, 5), (20, 30)], "跨缝必须有界"
    assert merge_line_spans([(1, 5), (3, 4)]) == [(1, 5)], "被包含的区间不得把并集撑小"


def test_merge_spans_is_idempotent_and_order_independent() -> None:
    raw = [(30, 40), (1, 5), (6, 9), (35, 45)]
    once = merge_line_spans(raw, gap_lines=1)
    assert once == merge_line_spans(list(reversed(raw)), gap_lines=1)
    assert merge_line_spans(once, gap_lines=1) == once, "再喂一次必须逐字节相同"
    assert once == [(1, 9), (30, 45)]


def test_merge_spans_rejects_malformed_instead_of_skipping() -> None:
    with pytest.raises(ValueError):
        merge_line_spans([(5, 1)])
    with pytest.raises(ValueError):
        merge_line_spans([(0, 4)]), "行号 1-based,0 是畸形输入,不是『没命中』"
    with pytest.raises(ValueError):
        merge_line_spans([(1, 5)], gap_lines=-1)


def test_truncate_chunk_single_source_cap() -> None:
    assert truncate_chunk("abcdef", max_chars=3) == "abc"
    assert truncate_chunk("ab", max_chars=3) == "ab"
    with pytest.raises(ValueError):
        truncate_chunk("ab", max_chars=0)


# ---- 并片消费层 ----


def test_fold_merges_same_file_near_hits_and_keeps_account() -> None:
    hits = [
        _hit("a.py", 10, 20, "SECOND", score=0.4, fused_from="keyword"),
        _hit("a.py", 1, 5, "FIRST", score=0.9, fused_from="vector"),
        _hit("a.py", 23, 30, "THIRD", score=0.6),
    ]
    folded = fold_adjacent_hits(hits, gap_lines=4)
    assert len(folded) == 1
    row = folded[0]
    assert row["line_start"] == 1 and row["line_end"] == 30
    assert row[MERGED_COUNT_KEY] == 2
    assert row[MERGED_RANGES_KEY] == [[1, 5], [10, 20], [23, 30]]
    assert row[GAP_SKIPPED_KEY] == 6, "L6-L9 与 L21-L22 共 6 行被跳过必须计数"
    assert "folded-gap: 4" in row["content"], "跳过的行要在正文里留显式标记"
    assert row["score"] == 0.9, "并片不得把分片分证据丢掉"
    assert row["fused_from"] == "vector+keyword", "来源并集与 fused_from 同批写(按并集行序)"


def test_fold_never_crosses_files_and_preserves_far_apart_hits() -> None:
    hits = [_hit("a.py", 1, 5, "A1"), _hit("b.py", 1, 5, "B1"), _hit("a.py", 500, 510, "A2")]
    folded = fold_adjacent_hits(hits, gap_lines=5)
    assert [(r["file_path"], r["line_start"]) for r in folded] == [("a.py", 1), ("a.py", 500), ("b.py", 1)]
    assert MERGED_COUNT_KEY not in folded[1]


def test_fold_reports_ambiguous_symbol_and_caps_content() -> None:
    hits = [
        _hit("a.py", 1, 5, "def foo(): ...", symbol_name="foo", symbol_type="function"),
        _hit("a.py", 6, 9, "def bar(): ...", symbol_name="bar", symbol_type="function"),
    ]
    folded = fold_adjacent_hits(hits, gap_lines=1, max_chars=12)
    assert folded[0]["symbol_ambiguous"] is True
    assert len(folded[0]["content"]) == 12


def test_fold_is_input_pure() -> None:
    hits = [_hit("a.py", 1, 5, "X"), _hit("a.py", 6, 9, "Y")]
    before = [dict(h) for h in hits]
    fold_adjacent_hits(hits, gap_lines=2)
    assert hits == before, "并片只吃副本,不许改调用方传进来的切片"


# ---- 下发路径装车证明 ----


class FakeLeg:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.calls: list[dict[str, Any]] = []

    async def __call__(self, payload: dict[str, Any], headers: dict[str, str]) -> tuple[list, str | None]:
        self.calls.append(dict(payload))
        return list(self.rows), None


@pytest.fixture(autouse=True)
def _expansion_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(cbi.SYMBOL_EXPAND_ENV, "0")
    monkeypatch.delenv(cbi.MERGE_GAP_ENV, raising=False)


@pytest.mark.asyncio
async def test_search_folds_before_dispatch(monkeypatch: pytest.MonkeyPatch) -> None:
    """search() 出口必须真的并片(不是只被测试调):三条并成一条下发。"""
    rows = [_hit("a.py", 1, 10, "A"), _hit("a.py", 12, 20, "B"), _hit("a.py", 21, 25, "C")]
    leg = FakeLeg(rows)
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._api_base_url = "http://localhost:8801"
    monkeypatch.setattr(idx, "_query_chunks", leg, raising=False)

    out = await idx.search_with_recall("找认证", top_k=10, merge_gap_lines=2)
    assert out["recall"]["base"] == 3
    assert out["recall"]["merged"] == 2
    assert len(out["chunks"]) == 1
    assert out["chunks"][0][MERGED_COUNT_KEY] == 2
    assert out["recall"]["gap_lines"] == 2


@pytest.mark.asyncio
async def test_gap_env_is_honoured_and_illegal_value_speaks(monkeypatch: pytest.MonkeyPatch) -> None:
    """env 间隔生效;非法值出声回落默认(不把写错当成"没配")。"""
    monkeypatch.delenv(cbi.MERGE_GAP_ENV, raising=False)
    monkeypatch.delenv(cbi.SYMBOL_EXPAND_ENV, raising=False)
    assert cbi._recall_env_int(cbi.MERGE_GAP_ENV, cbi.DEFAULT_MERGE_GAP_LINES) == cbi.DEFAULT_MERGE_GAP_LINES
    monkeypatch.setenv(cbi.MERGE_GAP_ENV, "7")
    assert cbi._recall_env_int(cbi.MERGE_GAP_ENV, cbi.DEFAULT_MERGE_GAP_LINES) == 7
    monkeypatch.setenv(cbi.MERGE_GAP_ENV, "很多")
    assert cbi._recall_env_int(cbi.MERGE_GAP_ENV, cbi.DEFAULT_MERGE_GAP_LINES) == cbi.DEFAULT_MERGE_GAP_LINES
    assert cbi._recall_env_flag(cbi.SYMBOL_EXPAND_ENV, True) is True
    monkeypatch.setenv(cbi.SYMBOL_EXPAND_ENV, "off")
    assert cbi._recall_env_flag(cbi.SYMBOL_EXPAND_ENV, True) is False


@pytest.mark.asyncio
async def test_malformed_span_falls_back_without_losing_hits(monkeypatch: pytest.MonkeyPatch) -> None:
    """畸形行区间 ⇒ 并片这步不生效但**原样下发**并在 failures 点名(§0.3 不冒绿也不冒红)。"""
    rows = [_hit("a.py", 9, 3, "坏区间")]
    leg = FakeLeg(rows)
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._api_base_url = "http://localhost:8801"
    monkeypatch.setattr(idx, "_query_chunks", leg, raising=False)
    out = await idx.search_with_recall("q", top_k=10)
    assert len(out["chunks"]) == 1
    assert any("并片未判定" in f for f in out["recall"]["failures"])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
