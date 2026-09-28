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
    """只实现装配链会碰到的那四个出口 —— 刻意**不**实现 `client_status` / `list_registered`
    等端点侧方法:测试打到 AttributeError 就说明装配链越过了它该用的收窄出口。
    """

    def __init__(self, external: list[Any]) -> None:
        self.external = external
        self.client = FakeClient()
        #: 装配链每次枚举/兜底调用时收到的主体 —— 断言"主体真的传到了"用,不是摆设。
        # 刻意做成实例属性:类属性会让多个测试用例共用一份账,断言就变成跨用例串账。
        self.seen_callers: list[str] = []

    def is_visible(self, name: str, caller_user_id: str) -> bool:
        """夹具内的可见性:以 `own-` 开头的算"别人那台"(对任何 caller 都不可见)。

        刻意**不**按 `caller_user_id` 放宽:那会让"漏传主体(空串)"与"传了主体"两种调用
        得到同一个答案,本文件的 `seen_callers` 断言就退化成只查"参数有没有写"。真实判据
        (自己注册 + 部署级)由 `tests/test_mcp_client.py` 那侧覆盖。
        """
        return not name.startswith("own-")

    async def list_available_tools_async(self, caller_user_id: str) -> list[Any]:
        """G-371 格①之后,装配链走的就是这一支(带主体),所以这里记账而不是抛错。"""
        self.seen_callers.append(caller_user_id)
        return self.external

    def get_client(self, name: str) -> FakeClient | None:
        return self.client if name.startswith("srv-") else None

    async def call_external_tool(
        self, server_name: str, tool_name: str, args: dict[str, Any], *, caller_user_id: str
    ) -> dict[str, Any]:
        self.seen_callers.append(caller_user_id)
        return {"ok": True, "via": "manager", "tool": tool_name, "caller": caller_user_id}


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
    pool = await _build_supertool_pool(None, "user-a")
    assert pool is None  # 无外部 server → 走现有路径

    enabled = agents_router._is_supertool_enabled()
    monkeypatch.setattr(agents_router, "_is_supertool_enabled", lambda: False)
    baseline = await _build_loop_v2_tools(None, user_id="user-a")
    monkeypatch.setattr(agents_router, "_is_supertool_enabled", lambda: enabled)
    without = await _build_loop_v2_tools(None, user_id="user-a")
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
    pool = await _build_supertool_pool(None, "user-a")
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
    pool = await _build_supertool_pool(None, "user-a")
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
    tools = await _build_loop_v2_tools(None, user_id="user-a")
    by_name = {t.name: t for t in tools}
    assert "ext_only" in by_name
    assert "read_file" in by_name  # 内置工具仍在统一清单内

    # 外部工具执行 → 路由到外部 client
    out = await by_name["ext_only"].executor({"x": 1})
    assert out == {"ok": True, "tool": "ext_only"}
    assert manager.client.calls == [("ext_only", {"x": 1})]

    # 内置工具执行 → 路由回 mcp_server.call_tool
    # V3 #47 第二格(2026-09-26)改此夹具:执行器现在必须把角色透传给 call_tool
    # (`call_tool(name, args, user_role=…)`)。旧夹具的签名 `(name, args)` 钉的正是
    # "engine 路径不传角色、恒落 call_tool 形参默认 0"这一被本票判为缺陷的旧行为 ——
    # 按"新行为才是正确"的方向改夹具,而不是把透传去掉让它变绿。
    # 这里断言的是 fail-closed 那一半:调用方没给角色 ⇒ 落到 0(普通用户),不是"没限制"。
    seen_roles: list[int] = []

    async def fake_call_tool(
        name: str, args: dict[str, Any], *, user_role: int = 0
    ) -> dict[str, Any]:
        seen_roles.append(user_role)
        return {"ok": True, "builtin": name}

    from app.services import mcp_server

    monkeypatch.setattr(mcp_server.mcp_server, "call_tool", fake_call_tool)
    out2 = await by_name["read_file"].executor({"path": "a.py"})
    assert out2 == {"ok": True, "builtin": "read_file"}
    assert seen_roles == [0]


@pytest.mark.asyncio
async def test_supertool_invoke_manager_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """get_client 返回 None 时走 manager 的兜底出口 —— 它同样要求主体(G-371 格①)。"""
    _install_manager(monkeypatch, [])

    # server 名不带 "srv-" 前缀 → get_client 返回 None → 走 manager 兜底
    out = await _supertool_invoke("legacy", "t", {}, 0, "user-a")
    assert out == {"ok": True, "via": "manager", "tool": "t", "caller": "user-a"}


@pytest.mark.asyncio
async def test_supertool_invoke_refuses_foreign_server(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """外部源那一支的属主闸:不可见的 server **调不到**,且回包与"没这台"同模板。

    这条防的是"枚举收窄了但调用还开着"—— 那才是真正能把别人的机器上的凭据借走的那一步。
    与 `未知 MCP Server` 同形是刻意的:差异本身会变成存在性预言机。
    """
    manager = _install_manager(monkeypatch, [])
    out = await _supertool_invoke("own-bob", "t", {}, 0, "user-a")
    assert out == {"ok": False, "error": "未知 MCP Server: own-bob"}
    assert manager.seen_callers == [], "不可见的 server 不该走到 manager 兜底调用"


@pytest.mark.asyncio
async def test_assembly_chain_threads_the_principal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """格①的落点判据:装配链把**会话主体**传到枚举与兜底调用,而不是留空串。

    空串不是"没限制",是"只看得到部署级"—— 所以漏传会让用户自己注册的外部 server 静默
    从会话里消失,而账面(typecheck / 其余门)一切正常。这条断言防的就是"改了签名但调用点忘了传"。
    """
    manager = _install_manager(monkeypatch, [FakeExternalTool(name="ext_only", description="d")])
    await _build_supertool_pool(None, "user-z")
    assert manager.seen_callers == ["user-z"], manager.seen_callers

    await _build_loop_v2_tools(None, user_id="user-y")
    assert manager.seen_callers[-1] == "user-y", manager.seen_callers

    await _supertool_invoke("legacy", "t", {}, 0, "user-x")
    assert manager.seen_callers[-1] == "user-x", manager.seen_callers


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
    tools = await _build_loop_v2_tools(["ext_keep"], user_id="user-a")
    names = [t.name for t in tools]
    assert "ext_keep" in names
    assert "ext_drop" not in names
