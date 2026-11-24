# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""Z28 格 1 装车证明:search_codebase 的可选 `symbol_name` **精确**过滤。

钉的是行为,不是文案:
① 入参缺省 / 空串 ⇒ 出参逐字节相同,且不带 `symbol_name` 键(默认行为零破坏);
② 过滤生效 ⇒ 命中集是不加过滤的**真子集**,并且差集可解释:每一枚被摘掉的片,都能由
   夹具文本独立算出"它既不是该符号的定义行、symbol_name 列也不等于过滤值";
③ 过滤位在 topK 截断**之前**生效(先截再滤是召回损失,不是过滤);
④ 关键词腿的命中没有 symbol_name 列 ⇒ 用在册的符号模式从代码行抽"被定义的符号名"再逐字比,
   纯引用行抽不出 ⇒ 不命中(不猜);
⑤ schema 面:symbol_name 是 optional、不在 required ⇒ 老调用方不受影响;
⑥ 段账:过滤启用时 assemble 段的 detail 点名过滤值与剩片数,未启用时 detail 恒 None
   (Z19 的段账形状一字不动)。

隔离口径(AGENTS §5):不碰 PG 8810 / Redis 8811 —— 语义腿与懒索引全用替身。
"""

from __future__ import annotations

import re
from typing import Any

import pytest

from app.services import codebase_indexer as indexer_module
from app.services import mcp_server
from app.services.mcp_server import _tool_search_codebase

_ALPHA = "alpha_target_symbol"
_BETA = "beta_other_symbol"
_DEF_ALPHA = re.compile(rf"^\s*def\s+{_ALPHA}\b")


@pytest.fixture(autouse=True)
def _tmp_path_is_workspace_root(monkeypatch, tmp_path):
    """AIS-080:search 入口现在过工作区白名单;本模块用 tmp_path 造树,登记为根。"""
    real = mcp_server._get_workspace_roots
    monkeypatch.setattr(
        mcp_server,
        "_get_workspace_roots",
        lambda: [str(tmp_path.resolve()), *real()],
    )


def _chunk(symbol: str, line: int, path: str = "app/demo.py") -> dict[str, Any]:
    return {
        "filePath": path,
        "lineStart": line,
        "lineEnd": line + 3,
        "symbolName": symbol,
        "symbolType": "function",
        "content": f"def {symbol}():\n    return {line}",
        "score": 0.5,
    }


@pytest.fixture
def corpus(tmp_path):
    """关键词腿的真实文件夹具:一枚目标符号的定义行 + 一枚引用行 + 另一枚符号。"""
    src = tmp_path / "app" / "demo.py"
    src.parent.mkdir(parents=True, exist_ok=True)
    src.write_text(
        f"def {_ALPHA}():\n    return 1\n\n\n{_ALPHA}(2)\n\n\ndef {_BETA}():\n    return 3\n",
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture
def empty_root(tmp_path):
    """空目录夹具:关键词腿判空(status=ok, matches=[]),融合名次只剩语义腿。"""
    root = tmp_path / "empty"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _stub_semantic(monkeypatch, chunks: list[dict[str, Any]]) -> None:
    async def fake_search(*_a: Any, **_k: Any) -> list[dict[str, Any]]:
        return list(chunks)

    monkeypatch.setattr(indexer_module.codebase_indexer, "search", fake_search)


async def _run(root: Any, **arguments: Any) -> dict[str, Any]:
    out = await _tool_search_codebase({"query": _ALPHA, "path": str(root), "max_results": 20, **arguments})
    assert isinstance(out, dict)
    return out


def _keys(resp: dict[str, Any]) -> set[tuple[str, int]]:
    return {(str(m.get("path")), int(m.get("line", 0))) for m in resp["matches"]}


def _assemble(resp: dict[str, Any]) -> dict[str, Any]:
    return next(s for s in resp["stages"] if s["stage"] == "assemble")


def _without_timings(resp: dict[str, Any]) -> dict[str, Any]:
    """只比形状与结论,不比真实耗时(耗时是量出来的,两次跑必然不同)。"""
    clone = dict(resp)
    clone["stages"] = [{**s, "duration_ms": None} for s in resp["stages"]]
    return clone


async def test_default_path_unchanged_and_empty_string_is_no_filter(corpus, monkeypatch) -> None:
    _stub_semantic(monkeypatch, [_chunk(_ALPHA, 1), _chunk(_BETA, 9)])
    baseline = await _run(corpus)
    blank = await _run(corpus, symbol_name="   ")
    assert "symbol_name" not in baseline, "未启用过滤时不得新增出参键"
    assert _without_timings(baseline) == _without_timings(blank), "空串必须等价于不过滤(默认行为逐字不变)"
    assert set(baseline) == set(blank)
    assert _assemble(baseline)["detail"] is None, "未启用过滤时段账 detail 不得变化"
    assert len(baseline["matches"]) >= 2


async def test_filter_keeps_order_and_does_not_widen(empty_root, monkeypatch) -> None:
    """过滤只摘不排:相对次序沿用融合名次,命中集是未过滤集的子集,不放大、不补位。

    已知边界(如实写进断言):每条腿自己就先 `[:max_results]` 截过一刀(在册行为,本票
    禁改 codebase_*),所以"按符号名取回库内**全部**切片"仍要 api 侧 searchSchema 的
    symbolName 过滤位 —— 装配层的过滤位保证的是候选窗口内的精确性与次序,不是全量召回。
    """
    _stub_semantic(monkeypatch, [_chunk(_ALPHA, 1), _chunk(_BETA, 5), _chunk(_ALPHA, 9)])
    control = await _run(empty_root, max_results=3)
    assert [m["symbol_name"] for m in control["matches"]] == [_ALPHA, _BETA, _ALPHA], control["matches"]
    filtered = await _run(empty_root, max_results=3, symbol_name=_ALPHA)
    assert [m["symbol_name"] for m in filtered["matches"]] == [_ALPHA, _ALPHA]
    assert [m["line"] for m in filtered["matches"]] == [m["line"] for m in control["matches"] if m["symbol_name"] == _ALPHA]
    assert _keys(filtered) < _keys(control)
    assert _assemble(filtered)["count"] == 2 and _assemble(control)["count"] == 3


async def test_exact_filter_narrows_with_explainable_difference(corpus, monkeypatch) -> None:
    chunks = [_chunk(_ALPHA, 1), _chunk(_BETA, 9)]
    _stub_semantic(monkeypatch, chunks)
    unfiltered = await _run(corpus)
    filtered = await _run(corpus, symbol_name=_ALPHA)
    kept_all, kept_filtered, dropped = _keys(unfiltered), _keys(filtered), _keys(unfiltered) - _keys(filtered)
    assert kept_filtered < kept_all, f"过滤后必须是真子集:{sorted(kept_filtered)} vs {sorted(kept_all)}"
    assert dropped, "夹具里必须至少有一枚可被摘掉,否则这例是空跑"
    assert filtered["symbol_name"] == _ALPHA

    # 差集可解释:被摘掉的每一枚,都能只靠夹具文本独立算出"它不是目标符号的定义、
    # 也不是索引列里的目标符号"(测试不复用生产判据,§22c)。
    lines = (corpus / "app" / "demo.py").read_text(encoding="utf-8").splitlines()
    semantic_by_key = {(c["filePath"], c["lineStart"]): c["symbolName"] for c in chunks}
    for path, line_no in dropped:
        if semantic_by_key.get((path, line_no)) == _ALPHA:
            raise AssertionError(f"{path}:{line_no} 的 symbol_name 列逐字等于过滤值却被摘掉")
        text = lines[line_no - 1] if 0 < line_no <= len(lines) else ""
        assert not _DEF_ALPHA.match(text), f"{path}:{line_no} 是 {_ALPHA} 的定义行却被摘掉:{text!r}"
    for match in filtered["matches"]:
        sym = match.get("symbol_name")
        if isinstance(sym, str) and sym:
            assert sym == _ALPHA
        else:
            assert _DEF_ALPHA.match(str(match.get("code") or "")), match


async def test_keyword_only_leg_keeps_definitions_and_drops_references(corpus, monkeypatch) -> None:
    """关键词腿没有 symbol_name 列 ⇒ 从代码行抽被定义符号名;纯引用行不命中。"""
    _stub_semantic(monkeypatch, [])
    unfiltered = await _run(corpus, use_semantic=False)
    filtered = await _run(corpus, use_semantic=False, symbol_name=_ALPHA)
    def_keys = {
        (str(m.get("path")), int(m.get("line", 0)))
        for m in unfiltered["matches"]
        if _DEF_ALPHA.match(str(m.get("code") or ""))
    }
    ref_keys = _keys(unfiltered) - def_keys
    assert def_keys and ref_keys, "夹具必须同时含定义行与引用行,否则这例是空跑"
    assert _keys(filtered) == def_keys, f"过滤后应只剩定义行:{sorted(filtered['matches'])}"


async def test_unknown_symbol_is_empty_not_unjudged(corpus, monkeypatch) -> None:
    _stub_semantic(monkeypatch, [_chunk(_BETA, 9)])
    out = await _run(corpus, symbol_name="no_such_symbol_anywhere")
    assert out["matches"] == [] and out["total"] == 0
    assemble = _assemble(out)
    assert assemble["result"] == "empty", "查过了没有 ⇒ empty,不许滑成 unjudged"
    assert "no_such_symbol_anywhere" in str(assemble["detail"])


def test_schema_registers_optional_symbol_name() -> None:
    tool = next(t for t in _TOOLS() if t.name == "search_codebase")
    schema = tool.input_schema
    assert "symbol_name" in schema["properties"]
    assert "symbol_name" not in schema.get("required", [])
    assert isinstance(schema["properties"]["symbol_name"]["description"], str)


def _TOOLS() -> Any:
    from app.services import mcp_server as module

    return module._TOOLS


async def test_pure_reference_line_is_never_a_symbol_hit(corpus, monkeypatch) -> None:
    """引用行(无 def/class 前缀)即使文本含符号名也不得通过精确过滤(不猜)。"""
    _stub_semantic(monkeypatch, [])
    ref_only = await _run(corpus, use_semantic=False, symbol_name=f"{_ALPHA}(2)")
    assert ref_only["matches"] == [], ref_only["matches"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
