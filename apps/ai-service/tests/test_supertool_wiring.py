# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 超级工具聚合接线测试(GAP-PLAN P1-5 装配)。

覆盖:无外部 server 降级等价 / 外部 server 时统一 manifest / 同名冲突
POLICY_FIRST 内置优先 / call_forward 路由(内置 vs 外部)/ 聚合异常降级。
全程 fake manager/client,不发起真实网络连接。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest

import app.routers.agents as agents_router
from app.routers.agents import (
    _SUPERTOOL_INTERNAL_SOURCE,
    _build_loop_v2_tools,
    _build_supertool_pool,
    _supertool_invoke,
)


@dataclass
class FakeExternalTool:
    """MCPClientTool 形状。"""

    name: str
    description: str
    input_schema: dict[str, Any] = field(default_factory=dict)
    server_name: str = "srv-a"


@dataclass
class FakeExternalToolDict:
    """dict 形状(协议 tools/list 原始返回)。"""

    payload: dict[str, Any]

    @property
    def name(self) -> str:
        return str(self.payload.get("name", ""))

    @property
    def description(self) -> str:
        return str(self.payload.get("description", "") or "")

    @property
    def server_name(self) -> str:
        return str(self.payload.get("server_name", "srv-b"))


class FakeClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def call_tool(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        self.calls.append((name, args))
        return {"ok": True, "tool": name}


class FakeManager:
    def __init__(self, external: list[Any]) -> None:
        self.external = external
        self.client = FakeClient()

    async def list_available_tools_async(self) -> list[Any]:
        return self.external

    def get_client(self, name: str) -> FakeClient | None:
        return self.client if name.startswith("srv-") else None

    async def call_external_tool(
        self, server_name: str, tool_name: str, args: dict[str, Any]
    ) -> dict[str, Any]:
        return {"ok": True, "via": "manager", "tool": tool_name}


def _install_manager(monkeypatch: pytest.MonkeyPatch, external: list[Any]) -> FakeManager:
    manager = FakeManager(external)

    def fake_get() -> FakeManager:
        return manager

    monkeypatch.setattr(
        "app.services.mcp_client.get_mcp_client_manager", fake_get
    )
    return manager


# ---------------------------------------------------------------------------
# 降级等价:无外部 server / 开关关闭 / 聚合异常
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_no_external_server_degrades(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_manager(monkeypatch, [])
    pool = await _build_supertool_pool(None)
    assert pool is None  # 无外部 server → 走现有路径

    enabled = agents_router._is_supertool_enabled()
    monkeypatch.setattr(agents_router, "_is_supertool_enabled", lambda: False)
    baseline = await _build_loop_v2_tools(None)
    monkeypatch.setattr(agents_router, "_is_supertool_enabled", lambda: enabled)
    without = await _build_loop_v2_tools(None)
    assert [t.name for t in baseline] == [t.name for t in without]


@pytest.mark.asyncio
async def test_aggregator_failure_degrades(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_manager(monkeypatch, [FakeExternalTool(name="ext_tool", description="d")])

    class BoomAgg:
        def build(self, *a: Any, **k: Any) -> Any:
            raise RuntimeError("boom")

    monkeypatch.setattr(
        "app.services.mcp_tool_aggregator.MCPSuperToolAggregator", BoomAgg
    )
    pool = await _build_supertool_pool(None)
    assert pool is None  # 聚合异常 → 降级不阻断


# ---------------------------------------------------------------------------
# 聚合 manifest:统一暴露内置 + 外部
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pool_unifies_builtin_and_external(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_manager(
        monkeypatch,
        [
            FakeExternalTool(name="ext_only", description="外部独有工具"),
            FakeExternalTool(
                name="read_file", description="与内置同名(应被内置覆盖)"
            ),
        ],
    )
    pool = await _build_supertool_pool(None)
    assert pool is not None
    names = [pt.key for pt in pool.tools]
    assert "ext_only" in names
    # 内置 priority=100:同名冲突裸名永远归内置(不受描述长度影响)
    read_file = pool._by_key["read_file"]
    assert _SUPERTOOL_INTERNAL_SOURCE in read_file.sources
    assert "srv-a" not in read_file.sources
    # 外部同名工具以 namespaced 键保留(不隐藏,可显式寻址)
    assert "read_file__srv-a" in names
    assert "read_file____builtin__" not in names


@pytest.mark.asyncio
async def test_loop_tools_include_external_and_route(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manager = _install_manager(
        monkeypatch, [FakeExternalTool(name="ext_only", description="外部独有工具")]
    )
    tools = await _build_loop_v2_tools(None)
    by_name = {t.name: t for t in tools}
    assert "ext_only" in by_name
    assert "read_file" in by_name  # 内置工具仍在统一清单内

    # 外部工具执行 → 路由到外部 client
    out = await by_name["ext_only"].executor({"x": 1})
    assert out == {"ok": True, "tool": "ext_only"}
    assert manager.client.calls == [("ext_only", {"x": 1})]

    # 内置工具执行 → 路由回 mcp_server.call_tool
    async def fake_call_tool(name: str, args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True, "builtin": name}

    from app.services import mcp_server

    monkeypatch.setattr(mcp_server.mcp_server, "call_tool", fake_call_tool)
    out2 = await by_name["read_file"].executor({"path": "a.py"})
    assert out2 == {"ok": True, "builtin": "read_file"}


@pytest.mark.asyncio
async def test_supertool_invoke_manager_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """get_client 返回 None 时走 manager.call_external_tool 兜底。"""
    manager = _install_manager(monkeypatch, [])

    async def via_manager(server: str, tool: str, args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True, "via": "manager", "tool": tool}

    monkeypatch.setattr(manager, "call_external_tool", via_manager)
    # server 名不带 "srv-" 前缀 → get_client 返回 None → 走 manager 兜底
    out = await _supertool_invoke("legacy", "t", {})
    assert out == {"ok": True, "via": "manager", "tool": "t"}


@pytest.mark.asyncio
async def test_tool_names_filter_applies(monkeypatch: pytest.MonkeyPatch) -> None:
    """白名单过滤在聚合路径同样生效(get_tool_schema 强制保留由既有逻辑负责)。"""
    _install_manager(
        monkeypatch,
        [
            FakeExternalTool(name="ext_keep", description="k"),
            FakeExternalTool(name="ext_drop", description="d", server_name="srv-a"),
        ],
    )
    tools = await _build_loop_v2_tools(["ext_keep"])
    names = [t.name for t in tools]
    assert "ext_keep" in names
    assert "ext_drop" not in names
