# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""符号扩召回(Z12 第一格)—— 装车证明 + 开关正向对照。

判据单源 = `app.services.codebase_recall_expand`(本文件零复算,§22c);
网络层用 `_query_chunks` 替身,不连 api、不连库(§5 测试隔离铁律)。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import codebase_indexer as cbi
from app.services.codebase_indexer import CodebaseIndexer


def _hit(
    path: str,
    start: int,
    end: int,
    *,
    score: float = 0.5,
    symbol: str | None = None,
    stype: str | None = None,
    content: str = "x",
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "file_path": path,
        "line_start": start,
        "line_end": end,
        "content": content,
        "score": score,
    }
    if symbol is not None:
        row["symbol_name"] = symbol
    if stype is not None:
        row["symbol_type"] = stype
    return row


class FakeLeg:
    """替身检索腿:记录每次查询的 payload,按 query 精确给档。"""

    def __init__(self, by_query: dict[str, tuple[list[dict[str, Any]], str | None]]) -> None:
        self.by_query = by_query
        self.calls: list[dict[str, Any]] = []

    async def __call__(self, payload: dict[str, Any], headers: dict[str, str]) -> tuple[list, str | None]:
        self.calls.append(dict(payload))
        return self.by_query.get(str(payload["query"]), ([], None))


def _indexer(monkeypatch: pytest.MonkeyPatch, leg: FakeLeg) -> CodebaseIndexer:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._api_base_url = "http://localhost:8801"
    monkeypatch.setattr(idx, "_query_chunks", leg, raising=False)
    return idx


BASE_QUERY = "用户认证逻辑"


@pytest.fixture(autouse=True)
def _default_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(cbi.SYMBOL_EXPAND_ENV, "1")
    monkeypatch.delenv(cbi.MERGE_GAP_ENV, raising=False)


@pytest.mark.asyncio
async def test_symbol_seed_fires_one_extra_leg_per_seed(monkeypatch: pytest.MonkeyPatch) -> None:
    """命中片带真符号 ⇒ 每枚种子补一跳,且那一跳走词法腿(不是第二套语义召回)。"""
    leg = FakeLeg(
        {
            BASE_QUERY: ([_hit("a.py", 1, 10, score=0.9, symbol="authenticate_user", stype="function")], None),
            "authenticate_user": ([_hit("b.py", 20, 40, score=0.7, symbol="authenticate_user", stype="function")], None),
        }
    )
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(BASE_QUERY, top_k=10)

    assert len(leg.calls) == 2, "种子一跳必须真的发出去(造好没装车=没有)"
    seed_call = leg.calls[1]
    assert seed_call["query"] == "authenticate_user"
    assert seed_call["mode"] == "keyword"
    assert seed_call["topK"] == 5
    assert out["recall"]["seeds"] == ["authenticate_user"]
    assert out["recall"]["symbol_added"] == 1
    expanded = [c for c in out["chunks"] if c.get("symbol_expanded")]
    assert [c["file_path"] for c in expanded] == ["b.py"]
    assert expanded[0]["expanded_from"] == "authenticate_user"


@pytest.mark.asyncio
async def test_on_off_positive_control(monkeypatch: pytest.MonkeyPatch) -> None:
    """同一查询开/关符号维:命中集差异**逐条可解释**(差集恰是补一跳带回来的候选)。"""
    base = [
        _hit("a.py", 1, 10, score=0.9, symbol="authenticate_user", stype="function"),
        _hit("d.py", 11, 20, score=0.8, symbol="hash_password", stype="function"),
    ]
    extra = _hit("c.py", 5, 15, score=0.6, symbol="authenticate_user", stype="function")
    leg = FakeLeg({BASE_QUERY: (base, None), "authenticate_user": ([extra], None), "hash_password": ([], None)})
    idx = _indexer(monkeypatch, leg)

    off = await idx.search(BASE_QUERY, top_k=10, symbol_expand=False)
    on = await idx.search(BASE_QUERY, top_k=10, symbol_expand=True)

    keys = lambda rows: {(r["file_path"], r["line_start"], r["line_end"]) for r in rows}  # noqa: E731
    assert len(off) == 2 and keys(off) <= keys(on)
    assert keys(on) - keys(off) == {("c.py", 5, 15)}, "差集只能是符号维带回来的那枚"
    assert all(not r.get("symbol_expanded") for r in off)


@pytest.mark.asyncio
async def test_expansion_never_duplicates_a_hit(monkeypatch: pytest.MonkeyPatch) -> None:
    """补一跳捞回已命中的同一片 ⇒ 身份键去重,不得把命中片复制成两份。"""
    hit = _hit("a.py", 1, 10, score=0.9, symbol="authenticate_user", stype="function")
    leg = FakeLeg({BASE_QUERY: ([hit], None), "authenticate_user": ([dict(hit)], None)})
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(BASE_QUERY, top_k=10)
    assert out["recall"]["symbol_added"] == 0
    assert len(out["chunks"]) == 1


@pytest.mark.asyncio
async def test_summary_chunks_are_not_used_as_seeds(monkeypatch: pytest.MonkeyPatch) -> None:
    """合成摘要片的 symbol_name 是目录名/文件名 ⇒ 不得当种子(排除集由索引侧给)。"""
    base = [
        _hit("services", 1, 40, score=0.99, symbol="services", stype="architecture_summary"),
        _hit("mod.ts", 1, 20, score=0.95, symbol="mod.ts", stype="module_summary"),
    ]
    leg = FakeLeg({BASE_QUERY: (base, None)})
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(BASE_QUERY, top_k=10)
    assert out["recall"]["seeds"] == []
    assert len(leg.calls) == 1, "没有真符号种子就一跳都不发"


@pytest.mark.asyncio
async def test_seed_leg_unjudged_is_named_not_silent(monkeypatch: pytest.MonkeyPatch) -> None:
    """种子腿取不到(未判定)⇒ 原样交首跳结果 + failures 点名,不记绿也不吞查询。"""
    leg = FakeLeg(
        {
            BASE_QUERY: ([_hit("a.py", 1, 10, score=0.9, symbol="authenticate_user", stype="function")], None),
            "authenticate_user": ([], "HTTP 500"),
        }
    )
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(BASE_QUERY, top_k=10)
    assert out["recall"]["symbol_added"] == 0
    assert any("authenticate_user" in f and "未判定" in f for f in out["recall"]["failures"])
    assert len(out["chunks"]) == 1


@pytest.mark.asyncio
async def test_env_off_means_zero_extra_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    """env 关档 = 结构上零额外查询(应急出口必须真的少花钱)。"""
    monkeypatch.setenv(cbi.SYMBOL_EXPAND_ENV, "0")
    hit = _hit("a.py", 1, 10, score=0.9, symbol="authenticate_user", stype="function")
    leg = FakeLeg({BASE_QUERY: ([hit], None)})
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(BASE_QUERY, top_k=10)
    assert out["recall"]["symbol_expand"] is False
    assert len(leg.calls) == 1


@pytest.mark.asyncio
async def test_seed_count_is_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    """种子上限:命中 6 枚带符号片也只补 DEFAULT_SYMBOL_EXPAND_SEEDS 跳(成本必须有界)。"""
    base = [
        _hit(f"f{i}.py", 1, 10, score=1.0 - i / 10, symbol=f"sym{i}", stype="function") for i in range(6)
    ]
    leg = FakeLeg({BASE_QUERY: (base, None)})
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(BASE_QUERY, top_k=10)
    assert len(out["recall"]["seeds"]) == cbi.DEFAULT_SYMBOL_EXPAND_SEEDS
    assert len(leg.calls) == 1 + cbi.DEFAULT_SYMBOL_EXPAND_SEEDS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
