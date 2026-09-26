# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #47 第二格取证:三套执行内核的工具集归一(唯一注册表 + 唯一解析出口)。

这张表把票面的四句话各钉成一个可跑断言,不写"应当如此":

1. **唯一注册表** —— 内置名单只有一处(`BUILTIN_ENGINE_TOOLS`),构造按命名约定单向
   推导;能力归口只有一张表(`ENGINE_TOOL_BRIDGE`);"某名字是否已注册"一律现读
   `mcp_server._TOOL_HANDLERS`,不抄第二份(见 `test_resolution_reads_the_live_registry`)。
2. **引擎内置工具在 A/B 主链路真能调到** —— A 与 B 的执行都经 `mcp_server.call_tool`,
   而 call_tool 现在只认 `resolve_engine_tool` 这一个解析入口。于是
   `unified_exec` / `run_code` / `view_image` / `spawn_subagent` / `web_search` 这些
   原先"只在 C 里存在"的名字,到主链路会落到注册表的同一能力上,不再是「未知工具」。
   解析发生在角色矩阵**之前**(见 `test_builtin_resolves_before_role_matrix`):
   归口不得变成绕过 admin 判定的通道。
3. **JSON-RPC 面只留协议适配** —— 引擎 catalog 的 `mapsTo` / `executionMode` 由同一张
   桥表现读,不再自己判断"这个名字是什么能力";`port` 档(web_search)的执行体就是
   注册表那一份,由 `test_port_disposition_is_not_a_lie` 现场证明(不是读注释)。
4. **parity 断言** —— 名单 ⊆ 桥表、桥表无腐烂、mode 与等价物双射,在这里跑一遍;
   提交链上由 `scripts/check-tool-registry-integrity.mjs`(J8-J10 + J12-J14)同判。

测试隔离(§5):全程不触 DB / Redis —— 唯一可能落库的 `persist_media_task` 被换成
no-op,`run_command` 的 handler 换成桩,故本文件对生产 PostgreSQL(8810)/Redis(8811)
零读写。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services import agent_engine as engine_mod
from app.services import mcp_server
from app.services.engine_tool_bridge import (
    BRIDGE_MODES,
    ENGINE_TOOL_BRIDGE,
    capability_equivalent,
    dangling,
    execution_mode,
    resolve_engine_tool,
    uncovered,
)

BUILTINS: tuple[str, ...] = engine_mod.BUILTIN_ENGINE_TOOLS


# ---------------------------------------------------------------------------
# 判据 1:唯一注册表 / 唯一名单
# ---------------------------------------------------------------------------


def test_builtin_list_is_the_only_name_source_and_fully_covered() -> None:
    """内置名与能力桥互咬:名单里每个都有处置结论,桥表也不得多留旧条目。"""
    assert uncovered(BUILTINS) == []
    assert dangling(BUILTINS) == []
    for name in BUILTINS:
        assert execution_mode(name) in BRIDGE_MODES, f"{name} 缺处置结论"


def test_resolution_never_invents_a_tool() -> None:
    """解析出口只可能返回"真注册在案"的名字,或 None —— 不允许返回空气。"""
    for name in (*BUILTINS, "not_a_real_tool", "run_command"):
        target = resolve_engine_tool(name)
        assert target is None or target in mcp_server._TOOL_HANDLERS, (
            f"{name} 解析到未注册的 {target}"
        )


def test_resolution_reads_the_live_registry() -> None:
    """"是否已注册"必须现读注册表,而不是桥模块里抄的一份名单。

    做法:临时把一个内置名本身注册进 `_TOOL_HANDLERS`(带桩 handler),解析结果就必须
    是它自己(注册表优先于桥表回查)。若解析逻辑抄了一份名字清单,这里不会变。
    """

    async def _stub(_args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True}

    with monkeypatched_handler("unified_exec", _stub):
        assert resolve_engine_tool("unified_exec") == "unified_exec"
    # 撤掉之后回落到桥表声明的等价物 —— 两个方向都只能由同一份注册表现读决定
    assert resolve_engine_tool("unified_exec") == "run_command"


class monkeypatched_handler:
    """临时把某个工具名注册进 `_TOOL_HANDLERS`(上下文管理器,退出即还原)。"""

    def __init__(self, name: str, handler: Any) -> None:
        self._name = name
        self._handler = handler

    def __enter__(self) -> None:
        self._existed = self._name in mcp_server._TOOL_HANDLERS
        self._previous = mcp_server._TOOL_HANDLERS.get(self._name)
        mcp_server._TOOL_HANDLERS[self._name] = self._handler

    def __exit__(self, *_exc: Any) -> None:
        if self._existed:
            mcp_server._TOOL_HANDLERS[self._name] = self._previous
        else:
            mcp_server._TOOL_HANDLERS.pop(self._name, None)


# ---------------------------------------------------------------------------
# 判据 2:引擎内置名在 A/B 主链路真能调到(且不得绕过角色矩阵)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "engine_name,expected",
    [
        ("unified_exec", "run_command"),
        ("run_code", "run_command"),
        ("view_image", "vision_analyze"),
        ("spawn_subagent", "dispatch_subagent"),
        ("web_search", "web_search"),
    ],
)
def test_mapped_builtins_resolve_to_registry_capability(
    engine_name: str, expected: str
) -> None:
    """票面「C 的内置工具在 A/B 里一个都调不到」的那五格:现在解析得到注册表条目。"""
    assert capability_equivalent(engine_name) == expected
    assert resolve_engine_tool(engine_name) == expected


@pytest.mark.parametrize(
    "engine_name",
    [
        "update_plan",
        "request_permissions",
        "request_user_input",
        "request_user_input_async",
        "send_message_to_user_async",
        "new_context",
        "clock_sleep",
        "clock_curr_time",
    ],
)
def test_engine_local_builtins_declare_no_registry_target(engine_name: str) -> None:
    """登记为「注册表确实没有」的名字必须解析不到 —— 否则 local 只是漏登记的遮羞布。"""
    assert resolve_engine_tool(engine_name) is None
    assert execution_mode(engine_name) == "local"


def test_builtin_resolves_before_role_matrix() -> None:
    """归口不得成为绕过 admin 判定的通道:`unified_exec` 经解析后按 run_command 判角色。

    这条同时是「真能调到」的行为证明:普通用户拿到的是权限回执(不是「未知工具」),
    说明名字已经落到注册表条目上。
    """
    result = asyncio.run(
        mcp_server.mcp_server.call_tool("unified_exec", {"command": "echo hi"}, user_role=0)
    )
    assert result.get("ok") is False
    assert result.get("errorCode") == "PERMISSION_DENIED"
    assert "run_command" in str(result.get("error"))


def test_admin_chain_executes_registry_handler_for_builtin_name() -> None:
    """admin 链路上,内置名真的把执行交给注册表那一份实现(不是报未知工具)。"""

    seen: dict[str, Any] = {}

    async def _stub(args: dict[str, Any]) -> dict[str, Any]:
        seen.update(args)
        return {"ok": True, "stdout": "stubbed"}

    async def _no_persist(*_a: Any, **_k: Any) -> None:
        """媒体任务落库是 DB 写副作用 —— 本票零容忍,换成 no-op(见模块 docstring)。"""

    import app.services.media_tasks as media_tasks

    with monkeypatched_handler("run_command", _stub):
        # handler 查表走的是模块级 dict,已被换成桩;角色矩阵仍读真名单
        orig_persist = media_tasks.persist_media_task
        media_tasks.persist_media_task = _no_persist  # type: ignore[assignment]
        try:
            result = asyncio.run(
                mcp_server.mcp_server.call_tool(
                    "unified_exec", {"command": "echo hi"}, user_role=1
                )
            )
        finally:
            media_tasks.persist_media_task = orig_persist  # type: ignore[assignment]
    assert result.get("ok") is True, result
    assert seen.get("command") == "echo hi"


# ---------------------------------------------------------------------------
# 判据 3:JSON-RPC 面只剩协议适配
# ---------------------------------------------------------------------------


def test_port_disposition_is_not_a_lie() -> None:
    """`port` 的含义是"执行体就是注册表那一份"—— 现场证明,不读注释。"""
    called: dict[str, Any] = {}

    async def _registry_web_search(args: dict[str, Any]) -> dict[str, Any]:
        called.update(args)
        return {"results": [{"url": "https://example.com", "title": "t"}], "message": ""}

    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    thread.emit = None
    thread.model = None

    original = mcp_server._tool_web_search
    mcp_server._tool_web_search = _registry_web_search  # type: ignore[assignment]
    try:
        assert execution_mode("web_search") == "port"
        tool = eng._web_search_tool(thread)
        out = asyncio.run(tool.executor({"query": "ihui"}))
    finally:
        mcp_server._tool_web_search = original  # type: ignore[assignment]
    assert called.get("query") == "ihui", "port 档却没有调注册表实现"
    assert out["total"] == 1


def test_rpc_catalog_maps_builtins_through_the_same_table() -> None:
    """协议面的工具目录不再自带判断:`mapsTo` / `executionMode` 逐条等于桥表结论。"""
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    eng._tool_lister = None
    catalog = asyncio.run(eng._tool_catalog(None))
    builtin_entries = [c for c in catalog if c.get("source") == "builtin"]
    assert len(builtin_entries) == len(BUILTINS)
    for entry in builtin_entries:
        name = str(entry["name"])
        assert entry["mapsTo"] == capability_equivalent(name), name
        assert entry["executionMode"] == execution_mode(name), name


def test_mapped_builtins_are_registered_before_being_annotated() -> None:
    """每张 map/port 都必须有真等价物 —— 否则 `mapsTo` 只是在协议面挂一个空指针。"""
    for name, (equivalent, _reason, mode) in ENGINE_TOOL_BRIDGE.items():
        if mode in ("port", "map"):
            assert equivalent in mcp_server._TOOL_HANDLERS, f"{name} → {equivalent} 未注册"
        else:
            assert equivalent is None, f"{name} 处置为 local 却登记了等价物"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
