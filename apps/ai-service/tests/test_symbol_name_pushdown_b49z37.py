# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Z37 装车证明:`symbol_name` 从 MCP 装配层的客户端过滤**下推到检索腿**。

钉的是行为,不是文案:
① 缺省档(不传 / 传空白)出参与今天逐字节相同 —— 连发给 api 的 payload 都不多一个键,
   连 `codebase_indexer.search` 的调用形状都不多一个关键字(在册替身签名收紧成
   query/top_k/internal_user_id 的那些,结构上不可能被本票碰坏);
② 符号档等值条件进 payload(`symbolName`),并由 api 侧单源 `rowBudget()` 决定行预算 ——
   本侧不再补 topK 那一刀:同一夹具、同 `max_results`,符号档取回条数 > 缺省档,
   差值可解释为「先截后滤被解除」,不是「多召回了别的符号」;
③ api 不可达 / 401 / 响应形态不合 ⇒ 具名 `unjudged`(腿层抛 `SymbolFilterUndetermined`,
   装配层落 `stats.symbol_filter="unjudged:…"` 与 mode=unjudged),不静默退回客户端过滤
   冒充成功(§0.3);同一故障在缺省档仍按在册行为返回 `[]` 且不抛(零破坏的反向对照);
④ 装配层的逐字过滤**保留**(关键词腿是本地文件系统扫描,不经 HTTP,下推覆盖不到它),
   对已下推的语义腿它是幂等的;两侧不一致的次数读进 `stats.symbol_pushdown_disagree`,
   是量出来的读数,不是硬断言,也不是第二份判据。

隔离口径(AGENTS §5):不碰 PG 8810 / Redis 8811、不起 httpx —— 腿层用 `_query_chunks`
替身,装配层用 `codebase_indexer.search` 替身。判据零复算:行预算只认 api 那一份。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import codebase_indexer as cbi
from app.services.codebase_indexer import CodebaseIndexer, SymbolFilterUndetermined
from app.services.mcp_server import _tool_search_codebase

_ALPHA = "z37_target_symbol"
_BETA = "z37_other_symbol"
_BASE_QUERY = "z37 base query"


def _api_row(symbol: str, line: int, path: str = "app/demo.py") -> dict[str, Any]:
    """api `/codebase/search` 回来的切片形状(camelCase,装配层按这一形状消费)。"""
    return {
        "filePath": path,
        "lineStart": line,
        "lineEnd": line + 3,
        "symbolName": symbol,
        "symbolType": "function",
        "content": f"def {symbol}():\n    return {line}",
        "score": 0.5,
    }


def _seed_row(symbol: str, start: int, end: int) -> dict[str, Any]:
    """腿层切片形状(snake_case,`codebase_recall_expand` 的在册消费形状)。"""
    return {
        "file_path": f"{symbol}.py",
        "line_start": start,
        "line_end": end,
        "content": "x",
        "score": 0.6,
        "symbol_name": symbol,
        "symbol_type": "function",
    }


class FakeLeg:
    """`_query_chunks` 替身:逐次记录 payload,按 query 给档(含「未判定」那一档)。"""

    def __init__(self, by_query: dict[str, tuple[list[dict[str, Any]], str | None]]) -> None:
        self.by_query = by_query
        self.calls: list[dict[str, Any]] = []

    async def __call__(
        self, payload: dict[str, Any], headers: dict[str, str]
    ) -> tuple[list[dict[str, Any]], str | None]:
        self.calls.append(dict(payload))
        assert headers is not None, "归属头必须照旧带上(本票不动身份面)"
        return self.by_query.get(str(payload["query"]), ([], None))


def _indexer(monkeypatch: pytest.MonkeyPatch, leg: FakeLeg) -> CodebaseIndexer:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._api_base_url = "http://localhost:8801"
    monkeypatch.setattr(idx, "_query_chunks", leg, raising=False)
    return idx


@pytest.fixture(autouse=True)
def _recall_off(monkeypatch: pytest.MonkeyPatch) -> None:
    """扩召回默认关掉:除 ⑥ 那一例外,其余用例只比首跳,免得种子跳污染读数。"""
    monkeypatch.setenv(cbi.SYMBOL_EXPAND_ENV, "0")
    monkeypatch.delenv(cbi.MERGE_GAP_ENV, raising=False)


@pytest.fixture
def empty_root(tmp_path):
    """空目录:关键词腿判空,融合名次只剩语义腿 ⇒ 下推的效果不被本地扫描稀释。"""
    root = tmp_path / "empty"
    root.mkdir(parents=True, exist_ok=True)
    return root


@pytest.fixture
def corpus_dir(tmp_path):
    """本地文件夹具(关键词腿真扫):一枚 ALPHA 定义行 + 一枚纯引用行。"""
    src = tmp_path / "app" / "demo.py"
    src.parent.mkdir(parents=True, exist_ok=True)
    src.write_text(
        f"def {_ALPHA}():\n    return 1\n\n{_ALPHA}(2)\n",
        encoding="utf-8",
    )
    return tmp_path


class FakeSearch:
    """`codebase_indexer.search` 替身:记录调用形状(缺省档不得多一个关键字)。

    `honor_filter=True` 模拟「下推真的生效」的 api(回来的只有同符号片);
    `False` 模拟替身不按符号位收窄(测装配层那一次幂等过滤与不一致读数)。
    """

    def __init__(
        self, rows: list[dict[str, Any]] | Exception, *, honor_filter: bool = True
    ) -> None:
        self.rows = rows
        self.honor_filter = honor_filter
        self.calls: list[tuple[tuple[Any, ...], dict[str, Any]]] = []

    async def __call__(self, *args: Any, **kwargs: Any) -> list[dict[str, Any]]:
        self.calls.append((args, dict(kwargs)))
        if isinstance(self.rows, Exception):
            raise self.rows
        scoped = str(kwargs.get("symbol_name") or "")
        if scoped and self.honor_filter:
            return [r for r in self.rows if r.get("symbolName") == scoped]
        return list(self.rows)


def _without_timings(resp: dict[str, Any]) -> dict[str, Any]:
    """只比形状与结论,不比真实耗时(Z28 同一条口径:耗时是量出来的,两次跑必然不同)。"""
    clone = dict(resp)
    clone["stages"] = [{**s, "duration_ms": None} for s in resp["stages"]]
    return clone


async def _run(root: Any, **arguments: Any) -> dict[str, Any]:
    out = await _tool_search_codebase({"query": _ALPHA, "path": str(root), **arguments})
    assert isinstance(out, dict)
    return out


# ---- ① 缺省档逐字等价 ----


@pytest.mark.asyncio
async def test_default_hops_send_no_symbol_key(monkeypatch: pytest.MonkeyPatch) -> None:
    leg = FakeLeg({_BASE_QUERY: ([_seed_row(_ALPHA, 1, 4)], None)})
    idx = _indexer(monkeypatch, leg)
    await idx.search(_BASE_QUERY, top_k=5)
    await idx.search(_BASE_QUERY, top_k=5, symbol_name="   ")
    assert [sorted(c) for c in leg.calls] == [["mode", "query", "topK"]] * 2, (
        "缺省/空白档的 payload 必须与今天同源:不得出现 symbolName 键"
    )
    assert "symbol_name" not in leg.calls[0]


# ---- ② 下推真的进 payload + 召回账 ----


@pytest.mark.asyncio
async def test_symbol_name_is_pushed_into_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    leg = FakeLeg({_BASE_QUERY: ([_seed_row(_ALPHA, 1, 4)], None)})
    idx = _indexer(monkeypatch, leg)
    out = await idx.search_with_recall(_BASE_QUERY, top_k=5, symbol_name=_ALPHA)
    assert leg.calls[0]["symbolName"] == _ALPHA, "过滤必须进请求体,不是回来再挑(否则仍是客户端过滤)"
    assert out["recall"]["symbol_name"] == _ALPHA
    assert out["recall"]["symbol_pushdown"] == "pushed"


@pytest.mark.asyncio
async def test_seed_legs_inherit_pushed_symbol_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """补一跳(符号扩召回)必须继承同一枚过滤位 —— 透传纪律与 Z36 hybridSearch 同一条。"""
    monkeypatch.setenv(cbi.SYMBOL_EXPAND_ENV, "1")
    leg = FakeLeg(
        {
            _BASE_QUERY: ([_seed_row(_ALPHA, 1, 4)], None),
            _ALPHA: ([_seed_row(_ALPHA, 10, 14)], None),
        }
    )
    idx = _indexer(monkeypatch, leg)
    await idx.search_with_recall(_BASE_QUERY, top_k=5, symbol_name=_ALPHA)
    assert len(leg.calls) == 2, "种子一跳没发出去 = 这例空跑"
    assert all(c.get("symbolName") == _ALPHA for c in leg.calls), leg.calls


# ---- ③ 未判定必须具名,缺省档零破坏 ----


@pytest.mark.asyncio
async def test_unreachable_api_raises_only_in_symbol_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    leg = FakeLeg({_BASE_QUERY: ([], "HTTP 503")})
    idx = _indexer(monkeypatch, leg)
    default_rows = await idx.search(_BASE_QUERY, top_k=5)
    assert default_rows == [], "缺省档的在册行为一字不动:未判定仍返回空列表、不抛"
    with pytest.raises(SymbolFilterUndetermined) as caught:
        await idx.search(_BASE_QUERY, top_k=5, symbol_name=_ALPHA)
    assert _ALPHA in str(caught.value) and "HTTP 503" in str(caught.value), (
        "异常必须同时点名过滤值与未判定原委,否则消费方无法归因"
    )


@pytest.mark.asyncio
async def test_forbidden_response_is_named_unjudged_not_client_filter(
    empty_root, monkeypatch: pytest.MonkeyPatch
) -> None:
    """api 侧 401(无权限):装配层必须读成 unjudged,不许把本地过滤跑一遍冒充成功。"""
    fake = FakeSearch(SymbolFilterUndetermined("symbol_name=z37_target_symbol 已下推,但检索腿未判定:HTTP 401"))
    monkeypatch.setattr(cbi.codebase_indexer, "search", fake)
    out = await _run(empty_root, symbol_name=_ALPHA, max_results=10)
    assert out["matches"] == []
    assert out["mode"] == "unjudged", "一腿没答上 + 另一腿判空 ⇒ 只能记未判定(§0.3)"
    assert out["degraded"] is True
    assert str(out["stats"]["symbol_filter"]).startswith("unjudged:")
    assert "HTTP 401" in str(out["reasons"])


# ---- ② 的正面:符号档不受 topK 先截影响(同夹具的正向对照) ----


@pytest.mark.asyncio
async def test_symbol_mode_returns_more_than_topk_truncation(
    empty_root, monkeypatch: pytest.MonkeyPatch
) -> None:
    """同夹具、同 max_results=3:缺省档 3 条(先截),符号档 6 条(下推后取回全部)。"""
    six = [_api_row(_ALPHA, ln) for ln in range(1, 7)]
    six += [_api_row(_BETA, ln) for ln in range(20, 24)]

    fake_default = FakeSearch(six)
    monkeypatch.setattr(cbi.codebase_indexer, "search", fake_default)
    before = await _run(empty_root, max_results=3)
    assert len(before["matches"]) == 3, before["matches"]
    assert "symbol_name" not in fake_default.calls[0][1], "缺省档连调用形状都不得多一个关键字"

    fake_scoped = FakeSearch(six)
    monkeypatch.setattr(cbi.codebase_indexer, "search", fake_scoped)
    after = await _run(empty_root, max_results=3, symbol_name=_ALPHA)
    assert fake_scoped.calls[0][1]["symbol_name"] == _ALPHA, "下推没走到真调用点 = 没做"
    got = [m["symbol_name"] for m in after["matches"]]
    assert got == [_ALPHA] * 6, f"符号档应取回全部同符号切片,不受 topK 先截:{got}"
    assert len(after["matches"]) > len(before["matches"]), "差值必须可解释为先截被解除"
    assert after["stats"]["symbol_filter"] == "pushed"
    assert after["stats"]["symbol_pushdown_disagree"] == 0, "两侧一致 = 装配层那一次过滤是幂等的"


@pytest.mark.asyncio
async def test_default_mode_output_shape_is_untouched(empty_root, monkeypatch: pytest.MonkeyPatch) -> None:
    rows = [_api_row(_ALPHA, 1), _api_row(_BETA, 9)]
    monkeypatch.setattr(cbi.codebase_indexer, "search", FakeSearch(rows))
    baseline = await _run(empty_root, max_results=20)
    blank = await _run(empty_root, max_results=20, symbol_name="  ")
    assert _without_timings(baseline) == _without_timings(blank), "空白过滤值必须等价于不过滤(除耗时外整份返回体逐键相同)"
    assert set(baseline) == set(blank)
    assert "symbol_name" not in baseline
    assert "symbol_filter" not in baseline["stats"], "缺省档不得新增 stats 读数键"


# ---- ④ 保留装配层过滤的理由:关键词腿不经 HTTP + 两侧不一致要读得出来 ----


@pytest.mark.asyncio
async def test_keyword_leg_still_needs_local_filter(corpus_dir, monkeypatch: pytest.MonkeyPatch) -> None:
    """本地关键词腿的下推覆盖不到 ⇒ 二次过滤仍是唯一 narrowing 位,且不一致计数点名。"""
    fake = FakeSearch([_api_row(_ALPHA, 1), _api_row(_BETA, 9)], honor_filter=False)
    monkeypatch.setattr(cbi.codebase_indexer, "search", fake)
    unfiltered = await _run(corpus_dir, max_results=20)
    filtered = await _run(corpus_dir, max_results=20, symbol_name=_ALPHA)
    assert all(m["symbol_name"] == _ALPHA for m in filtered["matches"] if m.get("symbol_name"))
    assert len(filtered["matches"]) < len(unfiltered["matches"])
    assert filtered["stats"]["symbol_pushdown_disagree"] == 1, (
        "BETA 来自已下推的语义腿却被本地判据摘掉 ⇒ 两侧不一致,必须读得出"
    )


@pytest.mark.asyncio
async def test_semantic_disabled_marks_pushdown_not_attempted(
    corpus_dir, monkeypatch: pytest.MonkeyPatch
) -> None:
    """use_semantic=False 时不存在「下推」这件事:读数必须是 not-attempted,不是 pushed。"""
    out = await _run(corpus_dir, max_results=20, use_semantic=False, symbol_name=_ALPHA)
    assert str(out["stats"]["symbol_filter"]).startswith("not-attempted:")
    assert out["mode"] == "single-source:keyword"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
