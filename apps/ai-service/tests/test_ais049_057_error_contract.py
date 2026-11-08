# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-049 / AIS-057 夹具(同一批)。

- AIS-049:`self_media._fetch_history` 把 DB 故障一律吞成 `[]`(HTTP 200 当"无历史")。
  现在只对 `UndefinedTableError`(表尚未建)精确降级,其余异常(查询失败/连接失败)
  向上抛,日志补 category/limit。
- AIS-057:`call_tool` 兜底回执缺 `errorCode`,且把 `str(e)` 原文回灌模型/前端。
  现在分别给 TIMEOUT / TOOL_FAILED,原始异常只进日志,回执脱敏。
"""

from __future__ import annotations

import asyncio
import json
import types
from typing import Any

import asyncpg
import pytest

from app.routers import self_media as sm
from app.services import mcp_server


# ---------------------------------------------------------------------------
# AIS-049:DB 故障不能再伪装成"没有历史"
# ---------------------------------------------------------------------------


class _FakeConn:
    def __init__(self, exc: Exception | None) -> None:
        self._exc = exc

    async def fetch(self, *args: Any, **kwargs: Any) -> Any:
        assert self._exc is not None
        raise self._exc

    async def close(self) -> None:
        return None


def _install_dsn(monkeypatch: pytest.MonkeyPatch, dsn: str | None) -> None:
    monkeypatch.setattr(sm, "settings", types.SimpleNamespace(database_url=dsn))


async def test_missing_table_degrades_to_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """表还没建(首次部署)是唯一允许降级的场景。"""
    _install_dsn(monkeypatch, "postgresql://x/y")
    exc = asyncpg.exceptions.UndefinedTableError("self_media_published 不存在")

    async def _conn() -> _FakeConn:
        return _FakeConn(exc)

    monkeypatch.setattr(sm, "get_db_conn", _conn)
    assert await sm._fetch_history("wechat", limit=3) == []


async def test_query_failure_is_not_swallowed(monkeypatch: pytest.MonkeyPatch) -> None:
    """改前必红:旧码 query 失败 return [],调用方拿到 200 空列表。"""
    _install_dsn(monkeypatch, "postgresql://x/y")

    async def _conn() -> _FakeConn:
        return _FakeConn(RuntimeError("column not found"))

    monkeypatch.setattr(sm, "get_db_conn", _conn)
    with pytest.raises(RuntimeError):
        await sm._fetch_history("wechat", limit=3)


async def test_pool_acquire_failure_is_not_swallowed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """改前必红:旧码连接池拿不到连接也 return [],DB 宕机被当成"无历史"。"""
    _install_dsn(monkeypatch, "postgresql://x/y")

    async def _conn() -> _FakeConn:
        raise ConnectionError("db down")

    monkeypatch.setattr(sm, "get_db_conn", _conn)
    with pytest.raises(ConnectionError):
        await sm._fetch_history("koubo", limit=3)


async def test_empty_dsn_still_degrades(monkeypatch: pytest.MonkeyPatch) -> None:
    """正向控制:未配置 DB 时保持原行为(直接空列表)。"""
    _install_dsn(monkeypatch, None)
    assert await sm._fetch_history("wechat") == []


# ---------------------------------------------------------------------------
# AIS-057:兜底回执要有 errorCode,且不回吐异常原文
# ---------------------------------------------------------------------------


_SECRET = "/opt/ihui/internal/config.yaml: permission denied"


async def test_tool_exception_returns_tool_failed_without_raw_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """改前必红:旧码只有 ok/error,且 error 里带 str(e) 原文。"""

    async def _boom(arguments: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError(_SECRET)

    monkeypatch.setitem(mcp_server._TOOL_HANDLERS, "fake_tool", _boom)
    out = await mcp_server.mcp_server.call_tool(
        "fake_tool", {}, user_role=1, user_id="u1"
    )
    assert out["ok"] is False, out
    assert out["errorCode"] == "TOOL_FAILED", out
    assert _SECRET not in json.dumps(out, ensure_ascii=False), out


async def test_tool_timeout_returns_timeout_code_without_raw_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """改前必红:超时兜底同样没有 errorCode。"""

    async def _slow(arguments: dict[str, Any]) -> dict[str, Any]:
        raise TimeoutError(_SECRET)

    monkeypatch.setitem(mcp_server._TOOL_HANDLERS, "fake_slow", _slow)
    monkeypatch.setattr(mcp_server, "MCP_GLOBAL_TIMEOUT", 0.05)
    out = await mcp_server.mcp_server.call_tool(
        "fake_slow", {}, user_role=1, user_id="u1"
    )
    assert out["ok"] is False, out
    assert out["errorCode"] == "TIMEOUT", out
    assert _SECRET not in json.dumps(out, ensure_ascii=False), out
    await asyncio.sleep(0)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
