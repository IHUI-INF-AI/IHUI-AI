# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-031 夹具:非管理员不得把 `long_running_command` / `test_suite` 交给 executor。

攻击路径(改前真通,且这是本文件"改前必红"的唯一依据):
  任意登录用户(user_role=0)在会话里调用工具 `call_tool("run_in_background",
  {"task": "long_running_command", "arguments": {"command": ["python", "-c", "..."]}})` →
  `_tool_run_in_background` 原样转发 → `background_tasks.run_in_background` →
  `task_executors._exec_long_running_command` 以服务账号 `create_subprocess_exec` 起任意 argv;
  仅过的 `dangerous_command_match` 只判 rm/格式化一类破坏性命令,`python -c` 判"安全"。
  `run_workflow` 是同一条分派出口的第二扇门(节点 `agent` 即 task_type),同样 role=0 可达。

本文件钉住的判据:
  A1 role=0 + run_in_background(task=long_running_command) ⇒ PERMISSION_DENIED,且**零分派**
     (submit_typed 一次都没被 await —— 拒绝点在分派之前,不是执行失败)。
  A2 role=0 + run_workflow(节点 agent=long_running_command) ⇒ PERMISSION_DENIED,
     run_workflow 一次都没被调(零节点执行)。
  A3 role=1 两扇门都放行(证明闸不是把能力整体砍掉)。
  A4 role=0 的非特权类型(sleep/echo)照常可用(对话链不因收口断链)。
  A5 拒绝必须可观测:结构化 warning 里同时带 AIS-031 与 task 名。
"""

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock

from app.services import background_tasks as bg
from app.services import workflow_runner
from app.services.mcp_server import mcp_server

# 改前实测能真正起进程的那份 argv(`python -c` 在旧判据里是"安全命令")。
ATTACK_ARGV = ["python", "-c", "print(1)"]


def _bg_submit_spy(monkeypatch) -> AsyncMock:
    """替身:记录后台提交。旧码会命中它(⇒ 变成真实分派),新码不该命中。"""
    spy = AsyncMock(return_value={"ok": True, "task_id": "t-ais031"})
    monkeypatch.setattr(bg.background_task_manager, "submit_typed", spy)
    return spy


def _workflow_spy(monkeypatch) -> AsyncMock:
    spy = AsyncMock(return_value={"ok": True, "status": "success", "node_results": {}})
    monkeypatch.setattr(workflow_runner, "run_workflow", spy)
    return spy


def _workflow_nodes() -> list[dict[str, Any]]:
    return [
        {
            "id": "n1",
            "agent": "long_running_command",
            "arguments": {"command": ATTACK_ARGV},
        }
    ]


async def test_plain_user_cannot_dispatch_long_running_command(monkeypatch):
    """A1:role=0 不得经 run_in_background 起任意 argv(拒绝发生在分派之前)。"""
    submit = _bg_submit_spy(monkeypatch)
    res = await mcp_server.call_tool(
        "run_in_background",
        {"task": "long_running_command", "arguments": {"command": ATTACK_ARGV}},
        user_role=0,
    )
    assert res.get("ok") is False, res
    assert res.get("errorCode") == "PERMISSION_DENIED", res
    assert res.get("executed") is False, res
    submit.assert_not_awaited()


async def test_plain_user_cannot_dispatch_long_running_command_via_workflow(monkeypatch):
    """A2:run_workflow 是同一分派出口的第二扇门,role=0 同样零节点执行。"""
    spy = _workflow_spy(monkeypatch)
    res = await mcp_server.call_tool(
        "run_workflow",
        {"nodes": _workflow_nodes()},
        user_role=0,
        user_id="u-1",
        session_id="s-1",
    )
    assert res.get("ok") is False, res
    assert res.get("errorCode") == "PERMISSION_DENIED", res
    spy.assert_not_awaited()


async def test_admin_can_dispatch_privileged_task_types(monkeypatch):
    """A3:role>=1 两扇门都放行(与 admin-only 的 run_command 同档,不是一刀切)。"""
    submit = _bg_submit_spy(monkeypatch)
    res = await mcp_server.call_tool(
        "run_in_background",
        {"task": "long_running_command", "arguments": {"command": ATTACK_ARGV}},
        user_role=1,
    )
    assert res.get("ok") is True, res
    submit.assert_awaited_once()

    spy = _workflow_spy(monkeypatch)
    res2 = await mcp_server.call_tool(
        "run_workflow",
        {"nodes": _workflow_nodes()},
        user_role=1,
        user_id="u-1",
        session_id="s-1",
    )
    assert res2.get("ok") is True, res2
    spy.assert_awaited_once()


async def test_plain_user_still_can_run_non_privileged_background_types(monkeypatch):
    """A4:sleep/echo 这类低危类型对 role=0 保持可用(收口不得误伤对话链)。"""
    submit = _bg_submit_spy(monkeypatch)
    res = await mcp_server.call_tool(
        "run_in_background",
        {"task": "sleep", "arguments": {"seconds": 0}},
        user_role=0,
    )
    assert res.get("ok") is True, res
    submit.assert_awaited_once()

    submit.reset_mock()
    res2 = await mcp_server.call_tool(
        "run_in_background",
        {"task": "echo", "arguments": {"message": "hi"}},
        user_role=0,
    )
    assert res2.get("ok") is True, res2
    submit.assert_awaited_once()


async def test_denial_is_observable(caplog, monkeypatch):
    """A5:拒绝必须留下可检索的结构化告警(不许静默 403/静默不执行)。"""
    _bg_submit_spy(monkeypatch)
    caplog.set_level(logging.WARNING, logger="app.services.mcp_server")
    await mcp_server.call_tool(
        "run_in_background",
        {"task": "long_running_command", "arguments": {"command": ATTACK_ARGV}},
        user_role=0,
    )
    messages = [r.getMessage() for r in caplog.records]
    assert any("AIS-031" in m and "long_running_command" in m for m in messages), messages
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
