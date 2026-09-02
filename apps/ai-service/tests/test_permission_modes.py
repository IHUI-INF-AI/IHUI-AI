# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AgentLoopV2 权限三模式(default / plan / auto)单元测试(2026-09-02 立)。

对标 Claude Code permission modes:
- default:与现状完全一致(高危工具仍走 _request_approval 审批流,回归红线)
- plan:循环层强制只读,白名单外工具被拦截(error 回填,不执行、不进审批)
- auto:只读白名单工具免审批直接执行,其余维持现有审批流

全部用 stub/mock,不启动真实进程;不依赖外部 LLM/网络。

覆盖(按任务要求):
① default 模式回归:高危工具仍走审批(mock 决策 approve→执行,timeout→error)
② plan 模式:写工具(write_file/run_command)被拒且不进审批,只读工具正常执行
③ auto 模式:只读工具免审批直接执行(断言 _request_approval 未被调用),写工具仍走审批
④ 非法 mode 抛 ValueError
⑤ env AGENT_PERMISSION_MODE 默认值生效(且构造参数优先于 env)
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition


# =============================================================================
# 辅助:工具定义
# =============================================================================


def _readonly_tool(executor=None) -> ToolDefinition:
    """只读工具 read_file(在 plan_mode.READONLY_TOOLS 白名单内)。"""

    async def _default(args):
        return {"content": "file-body"}

    return ToolDefinition(
        name="read_file",
        description="读取文件",
        parameters={
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
        executor=executor or _default,
    )


def _write_tool(name: str, executor=None) -> ToolDefinition:
    """写/执行类工具(name 不在只读白名单,且 run_command 属默认高危集合)。"""
    async def _default(args):
        return {"ok": True, "name": name}

    return ToolDefinition(
        name=name,
        description=f"{name} 工具",
        parameters={
            "type": "object",
            "properties": {"x": {"type": "string"}},
            "required": ["x"],
        },
        executor=executor or _default,
    )


def _default_messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "请处理"},
    ]


def _ok_llm(messages, tools):
    """无工具的直接回复 LLM(用于 env 默认值等不需工具调用的场景)。"""
    return {"content": "完成", "tool_calls": None}


# =============================================================================
# ① default 模式回归:高危工具仍走审批
# =============================================================================


async def test_default_high_risk_approval_approve_executes():
    """default 模式:高危工具 run_command 走 _request_approval,决策 approve → 执行。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "执行命令",
                "tool_calls": [{"id": "c1", "name": "run_command", "args": {"x": "ls"}}],
            }
        return {"content": "执行完毕", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_write_tool("run_command")], max_iterations=5)
    # mock 决策:approve(返回 None)
    loop._request_approval = AsyncMock(return_value=None)

    result = await loop.run(_default_messages())

    assert result.success is True
    assert loop._permission_mode == "default"
    # 审批被触发
    loop._request_approval.assert_awaited_once()
    # 工具被实际执行
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "run_command"
    assert tr.error is None
    assert tr.result == {"ok": True, "name": "run_command"}


async def test_default_high_risk_approval_timeout_errors():
    """default 模式:高危工具 run_command 走 _request_approval,决策 timeout → error 回填。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "执行命令",
                "tool_calls": [{"id": "c1", "name": "run_command", "args": {"x": "ls"}}],
            }
        return {"content": "放弃", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_write_tool("run_command")], max_iterations=5)
    # mock 决策:timeout
    loop._request_approval = AsyncMock(return_value="approval_timeout")

    result = await loop.run(_default_messages())

    assert result.success is True  # 错误回填 LLM,循环继续完成
    loop._request_approval.assert_awaited_once()
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "run_command"
    assert tr.error == "Approval timeout"
    assert tr.result == {"approved": False, "reason": "approval_timeout"}


# =============================================================================
# ② plan 模式:写工具被拒且不进审批,只读工具正常执行
# =============================================================================


async def test_plan_mode_blocks_write_tools_and_runs_readonly():
    """plan 模式:write_file/run_command 被拒(不进审批),read_file 正常执行。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "计划阶段操作",
                "tool_calls": [
                    {"id": "w1", "name": "write_file", "args": {"x": "a.py"}},
                    {"id": "r1", "name": "read_file", "args": {"path": "/x"}},
                ],
            }
        return {"content": "计划完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_write_tool("write_file"), _write_tool("run_command"), _readonly_tool()],
        max_iterations=5,
        permission_mode="plan",
    )
    # 替换审批门为 spy,验证 plan 模式下写工具不进审批流
    loop._request_approval = AsyncMock(return_value=None)

    result = await loop.run(_default_messages())

    assert result.success is True
    assert loop._permission_mode == "plan"
    # 审批流未被触发(写工具在入口即被拦截,只读工具本就非高危)
    loop._request_approval.assert_not_awaited()

    results_by_name = {tr.name: tr for tr in result.iterations[0].tool_results}
    # 写工具被拦截
    assert "write_file" in results_by_name
    wf = results_by_name["write_file"]
    assert wf.error is not None
    assert "permission_mode=plan" in wf.error
    assert "不在只读白名单" in wf.error
    # 只读工具正常执行
    assert "read_file" in results_by_name
    rf = results_by_name["read_file"]
    assert rf.error is None
    assert rf.result == {"content": "file-body"}


# =============================================================================
# ③ auto 模式:只读工具免审批直接执行,写工具仍走审批
# =============================================================================


async def test_auto_readonly_skips_approval_write_still_approves():
    """auto 模式:只读工具 read_file 免审批;高危 run_command 仍走审批(仅 1 次)。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "混合操作",
                "tool_calls": [
                    {"id": "r1", "name": "read_file", "args": {"path": "/x"}},
                    {"id": "c1", "name": "run_command", "args": {"x": "ls"}},
                ],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(
        mock_llm,
        [_readonly_tool(), _write_tool("run_command")],
        max_iterations=5,
        permission_mode="auto",
    )
    loop._request_approval = AsyncMock(return_value=None)  # 决策 approve

    result = await loop.run(_default_messages())

    assert result.success is True
    assert loop._permission_mode == "auto"
    # 只读工具免审批,仅 run_command(高危)走审批 → 恰好 1 次
    loop._request_approval.assert_awaited_once()
    called_tc: ToolCall = loop._request_approval.await_args.args[0]
    assert called_tc.name == "run_command"
    # 两者均执行成功
    results_by_name = {tr.name: tr for tr in result.iterations[0].tool_results}
    assert results_by_name["read_file"].error is None
    assert results_by_name["run_command"].error is None


async def test_auto_skips_approval_for_forced_high_risk_readonly():
    """auto 模式:即便某只读工具被强制判定为高危,仍免审批直接执行(跳过 _request_approval)。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "只读操作",
                "tool_calls": [{"id": "r1", "name": "read_file", "args": {"path": "/x"}}],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_readonly_tool()], max_iterations=5, permission_mode="auto")
    # 强制把只读工具 read_file 判定为高危(验证 auto 分支确实跳过审批)
    loop._is_high_risk_tool_instance = lambda name: name == "read_file"
    loop._request_approval = AsyncMock(return_value=None)

    result = await loop.run(_default_messages())

    assert result.success is True
    # auto 模式:免审批 → 审批门未被触发
    loop._request_approval.assert_not_awaited()
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "read_file"
    assert tr.error is None


async def test_default_still_approves_forced_high_risk_readonly():
    """对照:相同"只读工具被强制判定为高危",default 模式仍走审批(证明 auto 分支是新增行为)。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "只读操作",
                "tool_calls": [{"id": "r1", "name": "read_file", "args": {"path": "/x"}}],
            }
        return {"content": "完成", "tool_calls": None}

    loop = AgentLoopV2(mock_llm, [_readonly_tool()], max_iterations=5, permission_mode="default")
    loop._is_high_risk_tool_instance = lambda name: name == "read_file"
    loop._request_approval = AsyncMock(return_value=None)

    result = await loop.run(_default_messages())

    assert result.success is True
    # default 模式:尽管工具只读,被强制判定高危后依然走审批
    loop._request_approval.assert_awaited_once()
    tr = result.iterations[0].tool_results[0]
    assert tr.name == "read_file"
    assert tr.error is None  # approve → 执行


# =============================================================================
# ④ 非法 mode 抛 ValueError
# =============================================================================


def test_invalid_permission_mode_raises_valueerror():
    """非法 permission_mode 取值(构造参数)直接 raise ValueError。"""
    with pytest.raises(ValueError):
        AgentLoopV2(_ok_llm, [], permission_mode="bogus")
    with pytest.raises(ValueError):
        AgentLoopV2(_ok_llm, [], permission_mode="PLAN")


# =============================================================================
# ⑤ env AGENT_PERMISSION_MODE 默认值生效(构造参数优先)
# =============================================================================


def test_env_default_applies_when_arg_missing(monkeypatch):
    """env AGENT_PERMISSION_MODE 在构造参数缺省时作为默认值来源。"""
    monkeypatch.setenv("AGENT_PERMISSION_MODE", "auto")
    loop = AgentLoopV2(_ok_llm, [])
    assert loop._permission_mode == "auto"


def test_constructor_arg_overrides_env(monkeypatch):
    """构造参数优先于 env。"""
    monkeypatch.setenv("AGENT_PERMISSION_MODE", "auto")
    loop = AgentLoopV2(_ok_llm, [], permission_mode="plan")
    assert loop._permission_mode == "plan"


def test_no_env_and_no_arg_defaults_to_default(monkeypatch):
    """无 env、无构造参数 → "default"。"""
    monkeypatch.delenv("AGENT_PERMISSION_MODE", raising=False)
    loop = AgentLoopV2(_ok_llm, [])
    assert loop._permission_mode == "default"


def test_invalid_env_value_raises(monkeypatch):
    """env 取值非法时(构造参数缺省)也 raise ValueError。"""
    monkeypatch.setenv("AGENT_PERMISSION_MODE", "nonsense")
    with pytest.raises(ValueError):
        AgentLoopV2(_ok_llm, [])


# =============================================================================
# ⑤(补充)模式生效事件:permission.mode 事件经 hook_engine 广播
# =============================================================================


async def test_permission_mode_event_emitted_on_auto_skip():
    """auto 模式只读工具免审批时,应经 hook_engine 广播 permission.mode 事件(payload 含 mode/tool/decision)。"""
    from app.services.hook_engine import hook_engine

    q = hook_engine.subscribe("permission.mode")
    try:
        call_count = 0

        async def mock_llm(messages, tools):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    "content": "只读操作",
                    "tool_calls": [{"id": "r1", "name": "read_file", "args": {"path": "/x"}}],
                }
            return {"content": "完成", "tool_calls": None}

        loop = AgentLoopV2(mock_llm, [_readonly_tool()], max_iterations=5, permission_mode="auto")
        # 强制把只读工具判定为高危,确保一定经过 auto 免审批分支
        loop._is_high_risk_tool_instance = lambda name: name == "read_file"
        loop._request_approval = AsyncMock(return_value=None)

        result = await loop.run(_default_messages())
        assert result.success is True

        payload = await asyncio.wait_for(q.get(), timeout=2)
        assert payload["mode"] == "auto"
        assert payload["tool"] == "read_file"
        assert payload["decision"] == "auto_skip_approval"
        assert "session_id" in payload
    finally:
        hook_engine.unsubscribe("permission.mode", q)


async def test_permission_mode_event_emitted_on_plan_block():
    """plan 模式拦截白名单外工具时,应广播 permission.mode 事件(decision=plan_blocked)。"""
    from app.services.hook_engine import hook_engine

    q = hook_engine.subscribe("permission.mode")
    try:
        call_count = 0

        async def mock_llm(messages, tools):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    "content": "写操作",
                    "tool_calls": [{"id": "w1", "name": "write_file", "args": {"x": "a.py"}}],
                }
            return {"content": "计划完成", "tool_calls": None}

        loop = AgentLoopV2(
            mock_llm,
            [_write_tool("write_file"), _readonly_tool()],
            max_iterations=5,
            permission_mode="plan",
        )
        loop._request_approval = AsyncMock(return_value=None)

        result = await loop.run(_default_messages())
        assert result.success is True

        payload = await asyncio.wait_for(q.get(), timeout=2)
        assert payload["mode"] == "plan"
        assert payload["tool"] == "write_file"
        assert payload["decision"] == "plan_blocked"
    finally:
        hook_engine.unsubscribe("permission.mode", q)
