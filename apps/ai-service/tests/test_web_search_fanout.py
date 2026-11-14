# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​‍‍​‌​​‌‌‌‍⁠

"""web 多查询扇出契约(2026-11-14 立,对标 DSH dsh-tool-web/src/search.ts)。

① queries 1..10、非空白、去重保序;超过上限/空表/非字符串 → 结构化失败;
② 单查询保持既有返回形状(query/max_results/results);
③ 多查询并发后按名次轮转合并、URL 去重、截断到 max_results 并置 truncated;
④ 任一查询失败即整次调用失败(不把部分成功伪装成整体成功);
⑤ web_search 转发 queries 时同样走合并口径。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services import mcp_server as mcp


def _page(*urls: str) -> list[dict[str, str]]:
    return [{"url": url, "title": url.rsplit("/", 1)[-1]} for url in urls]


def _fake_once(pages: dict[str, list[dict[str, str]]], calls: list[str] | None = None):
    async def _inner(client, query: str, max_results: int):
        if calls is not None:
            calls.append(query)
        return list(pages.get(query, []))[:max_results]

    return _inner


def test_normalize_queries_dedup_and_bounds() -> None:
    queries, error = mcp._normalize_web_queries({"queries": ["b", "a", "b", " a "]})
    assert error is None
    # query 未给时顺序保持首次出现;strip 后 " a " 与 "a" 同值去重
    assert queries == ["b", "a"]

    merged, error = mcp._normalize_web_queries({"query": "a", "queries": ["b", "a"]})
    assert error is None
    assert merged == ["a", "b"]

    _, too_many = mcp._normalize_web_queries({"queries": [f"q{i}" for i in range(11)]})
    assert too_many is not None and too_many["errorCode"] == "search_invalid_queries"

    _, empty = mcp._normalize_web_queries({"queries": []})
    assert empty is not None and empty["errorCode"] == "search_invalid_queries"

    _, blank = mcp._normalize_web_queries({"queries": ["ok", "  "]})
    assert blank is not None and "非空字符串" in blank["error"]


@pytest.mark.asyncio
async def test_multi_query_round_robin_dedup_and_truncate(monkeypatch: pytest.MonkeyPatch) -> None:
    pages = {
        "a": _page("https://x/1", "https://x/2"),
        "b": _page("https://x/2", "https://x/3"),
    }
    monkeypatch.setattr(mcp, "_search_ddg_lite_once", _fake_once(pages))

    full = await mcp._tool_search_web({"queries": ["a", "b"], "max_results": 3})
    assert full["ok"] is True
    assert full["queries"] == ["a", "b"]
    assert [item["url"] for item in full["results"]] == [
        "https://x/1",
        "https://x/2",
        "https://x/3",
    ]
    assert full["truncated"] is False

    capped = await mcp._tool_search_web({"queries": ["a", "b"], "max_results": 2})
    assert [item["url"] for item in capped["results"]] == ["https://x/1", "https://x/2"]
    assert capped["truncated"] is True


@pytest.mark.asyncio
async def test_single_query_keeps_legacy_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(mcp, "_search_ddg_lite_once", _fake_once({"solo": _page("https://s/1")}))
    result = await mcp._tool_search_web({"query": "solo", "max_results": 5})
    assert result["ok"] is True
    assert result["query"] == "solo"
    assert result["queries"] == ["solo"]
    assert len(result["results"]) == 1
    assert result["truncated"] is False


@pytest.mark.asyncio
async def test_fanout_failure_is_atomic(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _boom(client, query: str, max_results: int):
        if query == "bad":
            raise RuntimeError("ddg down")
        await asyncio.sleep(0.01)
        return _page("https://ok/1")

    monkeypatch.setattr(mcp, "_search_ddg_lite_once", _boom)
    result = await mcp._tool_search_web({"queries": ["good", "bad", "good2"]})
    assert result["ok"] is False
    assert result["results"] == []
    assert "ddg down" in result["error"]


@pytest.mark.asyncio
async def test_web_search_forwards_queries(monkeypatch: pytest.MonkeyPatch) -> None:
    pages = {"a": _page("https://x/1"), "b": _page("https://x/2")}
    monkeypatch.setattr(mcp, "_search_ddg_lite_once", _fake_once(pages))
    result = await mcp._tool_web_search({"queries": ["a", "b"], "max_results": 5})
    assert result["tool"] == "web_search"
    assert result["ok"] is True
    assert result["queries"] == ["a", "b"]
    assert [item["url"] for item in result["results"]] == ["https://x/1", "https://x/2"]
