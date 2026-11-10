# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""2026-11-08 P0(AIS-031 / AIS-052)回归钉:任意 argv 的两条入口必须按 admin 档收口。

AIS-031:`run_in_background` 的 `long_running_command` 任务类型与 `run_command` 同能力
(可起任意 argv),但该工具不在 admin 档,任何 role=0 用户可直达。
AIS-052:`run_workflow` 的 `agent` 字段是调用方可填的 task_type,role=0 可借节点执行任意 argv。

判据(夹具必红 → 修复后必绿):
1. role=0 经 MCP 工具面提交 long_running_command ⇒ PERMISSION_DENIED,且 **零进程派生**;
2. role=0 经 run_workflow 声明 long_running_command 节点 ⇒ 拒绝(PERMISSION_DENIED,
   AIS-031 分派闸;直调 workflow_runner 仍是 WORKFLOW_FORBIDDEN),且 **零节点执行**;
3. 承载层未注入 __user_role 时一律按 0(fail-closed),不放行;
4. role>=1 两条通道仍可用(不误伤管理员);role=0 的安全任务类型不被误挡。
"""

from __future__ import annotations

import asyncio
import uuid
from typing import Any

from app.services import mcp_server
from app.services import task_executors as te
from app.services.background_tasks import background_task_manager
from app.services.workflow_runner import ERR_FORBIDDEN, run_workflow


def _fake_run_factory(calls: list[list[str]]):
    async def _fake_run(argv: list[str], **_kwargs: Any) -> te.CommandRun:
        calls.append([str(a) for a in argv])
        return te.CommandRun(
            exit_code=0,
            stdout="",
            stderr="",
            stdout_bytes=0,
            stderr_bytes=0,
            stdout_truncated=False,
            stderr_truncated=False,
            duration_ms=0.0,
            timed_out=False,
            cancelled=False,
        )

    return _fake_run


def _long_running_arguments() -> dict[str, Any]:
    return {
        "task": "long_running_command",
        "arguments": {"command": ["python", "-c", "print('p0-escape')"]},
        "notify_on_done": False,
        "idempotency_key": f"p0-escape-{uuid.uuid4()}",
    }


def _workflow_with_command_node() -> list[dict[str, Any]]:
    return [
        {
            "id": "cmd",
            "agent": "long_running_command",
            "arguments": {"command": ["python", "-c", "print('p0-escape')"]},
        }
    ]


async def _wait_until(predicate, *, timeout: float = 3.0) -> bool:
    deadline = asyncio.get_running_loop().time() + timeout
    while asyncio.get_running_loop().time() < deadline:
        if predicate():
            return True
        await asyncio.sleep(0.05)
    return predicate()


async def test_role0_run_in_background_long_running_command_denied_zero_spawn(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))
    server = mcp_server.MCPServer()

    result = await server.call_tool(
        "run_in_background",
        _long_running_arguments(),
        user_role=0,
        user_id="p0-user",
        session_id="p0-session",
    )

    assert result["ok"] is False, result
    assert result["errorCode"] == "PERMISSION_DENIED", result
    assert result.get("executed") is False, result
    # 关键:不是"提交后失败",而是根本没有进入执行器 ⇒ 零进程派生。
    assert calls == []


async def test_missing_user_role_is_fail_closed_on_run_in_background(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))
    args = _long_running_arguments()
    args.pop("__user_role", None)

    result = await mcp_server._tool_run_in_background(args)

    assert result["ok"] is False, result
    assert result["errorCode"] == "PERMISSION_DENIED", result
    assert calls == []


async def test_admin_run_in_background_long_running_command_still_works(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))
    server = mcp_server.MCPServer()

    result = await server.call_tool(
        "run_in_background",
        _long_running_arguments(),
        user_role=1,
        user_id="p0-admin",
        session_id="p0-session",
    )

    assert result["ok"] is True, result
    assert await _wait_until(lambda: calls), "admin 通道必须仍能进入 long_running_command"


async def test_role0_run_workflow_command_node_denied_zero_nodes_executed(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))

    result = await run_workflow(
        _workflow_with_command_node(),
        principal="p0-user",
        user_role=0,
        store=te.CheckpointStore(),
    )

    assert result["ok"] is False, result
    assert result["errorCode"] == ERR_FORBIDDEN, result
    assert result["executed"] == [], result
    assert calls == []


async def test_role0_run_workflow_via_mcp_denied_zero_nodes_executed(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))
    server = mcp_server.MCPServer()

    result = await server.call_tool(
        "run_workflow",
        {"nodes": _workflow_with_command_node()},
        user_role=0,
        user_id="p0-user",
        session_id="p0-session",
    )

    assert result["ok"] is False, result
    # AIS-031(2026-11-08)已把这道门前移到 MCP 分派层,与 run_in_background 共用
    # `_dispatch_permission_denial` ⇒ 错误码统一 PERMISSION_DENIED;WORKFLOW_FORBIDDEN
    # 仍是 workflow_runner 直调路径的码(见下方 test_missing_user_role_* 用例)。
    assert result["errorCode"] == "PERMISSION_DENIED", result
    assert result["executed"] == [], result
    assert calls == []


async def test_missing_user_role_is_fail_closed_on_run_workflow(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))

    result = await run_workflow(
        _workflow_with_command_node(),
        principal="p0-user",
        store=te.CheckpointStore(),
    )

    assert result["ok"] is False, result
    assert result["errorCode"] == ERR_FORBIDDEN, result
    assert result["executed"] == [], result
    assert calls == []


async def test_admin_run_workflow_command_node_still_works(monkeypatch):
    calls: list[list[str]] = []
    monkeypatch.setattr(te, "run_command", _fake_run_factory(calls))

    result = await run_workflow(
        _workflow_with_command_node(),
        principal="p0-admin",
        user_role=1,
        store=te.CheckpointStore(),
    )

    assert result["ok"] is True, result
    assert result["executed"] == ["cmd"], result
    assert calls and calls[0] == ["python", "-c", "print('p0-escape')"], calls


async def test_role0_safe_background_task_not_overblocked(monkeypatch):
    monkeypatch.setattr(te, "run_command", _fake_run_factory([]))
    server = mcp_server.MCPServer()

    result = await server.call_tool(
        "run_in_background",
        {
            "task": "sleep",
            "arguments": {"seconds": 0.1},
            "notify_on_done": False,
            "idempotency_key": f"p0-safe-{uuid.uuid4()}",
        },
        user_role=0,
        user_id="p0-user",
        session_id="p0-session",
    )

    assert result["ok"] is True, result
    await asyncio.sleep(0.3)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
