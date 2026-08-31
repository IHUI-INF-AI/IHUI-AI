# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""agent_loop_v2.py 工具调用审批流(Tool Approval)单元测试(2026-08-30 立)。

覆盖:
- _is_high_risk_tool 高危判定(写文件/命令/电脑控制/浏览器交互为 True,搜索/知识查询为 False)
- 审批批准后工具正常执行
- 审批拒绝后 ToolResult.error="User rejected tool call",error_type="user_rejected"
- 审批超时返回 ToolResult.error="Approval timeout",error_type="approval_timeout"
- 审批注册表防内存泄漏(超时/完成后清理)
- 审批关闭(approval_enabled=False)时不等待,直接执行
- hook_engine.emit 失败降级(不抛,继续等待 → 超时兜底)

mock 策略:hook_engine 单例在测试中替换为 fake(记录 emit context,不真广播)。
"""

from __future__ import annotations

import asyncio
import types

import pytest

import app.services.agent_loop_v2 as agent_loop_v2
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
    resolve_approval_response,
)


# =============================================================================
# fixture:替换 hook_engine,记录审批事件 emit
# =============================================================================


@pytest.fixture(autouse=True)
def _mock_hook_engine(monkeypatch):
    """把 agent_loop_v2 模块的 hook_engine 替换为 fake(不真广播/执行 hook)。"""
    emitted: list[dict] = []
    emitted_lock = asyncio.Lock()

    class FakeHookEngine:
        async def emit(self, event, context):
            async with emitted_lock:
                emitted.append({"event": event, **context})
            return []

    fake = FakeHookEngine()
    monkeypatch.setattr(agent_loop_v2, "hook_engine", fake)
    # 返回记录列表,测试内可读
    monkeypatch.setattr(agent_loop_v2, "_approval_registry", {})
    yield {"emitted": emitted}


def _last_approval(emitted: list[dict]) -> dict:
    """返回最后一次 tool.approval 事件 context。"""
    for item in reversed(emitted):
        if item["event"] == "tool.approval":
            return item
    raise AssertionError("未找到 tool.approval 事件")


# =============================================================================
# 1. _is_high_risk_tool 高危判定
# =============================================================================


def test_is_high_risk_tool_true():
    """写文件/命令/电脑控制/浏览器交互/删除写库 → True。"""
    for name in (
        "write_file",
        "file_edit",
        "file_batch_edit",
        "edit_file",
        "create_file",
        "delete_file",
        "run_command",
        "computer_mouse_click",
        "computer_key_type",
        "computer_screenshot",
        "browser_click_element",
        "browser_type_text",
        "git_operations",
        "db_query",
    ):
        assert AgentLoopV2._is_high_risk_tool(name) is True, name


def test_is_high_risk_tool_false():
    """搜索/知识查询/读取等 → False(默认放行)。"""
    for name in (
        "read_file",
        "web_search",
        "search_codebase",
        "file_search",
        "knowledge_lookup",
        "rag_search",
        "get_weather",
    ):
        assert AgentLoopV2._is_high_risk_tool(name) is False, name


def test_is_high_risk_tool_computer_prefix():
    """computer_* 前缀系列整体高危。"""
    assert AgentLoopV2._is_high_risk_tool("computer_move_mouse") is True


# =============================================================================
# 2. 审批批准 → 工具正常执行
# =============================================================================


async def test_approval_approved_executes(_mock_hook_engine):
    """用户批准后,高危工具正常执行并返回真实结果。"""
    emitted = _mock_hook_engine["emitted"]

    async def _exec(args):
        return {"ok": True, "path": args["path"]}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="write_file", description="写文件", parameters={}, executor=_exec)],
        approval_enabled=True,
        approval_timeout=5,
    )
    tc = ToolCall(id="c1", name="write_file", args={"path": "/tmp/x.txt"})
    task = asyncio.create_task(loop._execute_single(tc))
    await asyncio.sleep(0)  # 让 _execute_single 跑到审批等待

    ctx = _last_approval(emitted)
    assert ctx["tool_name"] == "write_file"
    assert ctx["tool_call_id"] == "c1"
    assert ctx["danger_level"] == "high"
    assert "approval_id" in ctx
    assert ctx["approval_id"].startswith("appr_")
    assert "/tmp/x.txt" in ctx["args_preview"]

    ok = resolve_approval_response(ctx["approval_id"], "approve")
    assert ok is True
    tr = await task

    assert tr.error is None
    assert tr.result == {"ok": True, "path": "/tmp/x.txt"}
    # 审批完成 → 注册表条目已清理(防内存泄漏)
    assert ctx["approval_id"] not in agent_loop_v2._approval_registry


# =============================================================================
# 3. 审批拒绝 → 工具不执行,结果回填
# =============================================================================


async def test_approval_rejected_tool_result(_mock_hook_engine):
    """用户拒绝后,工具不执行,返回 error="User rejected tool call"。"""
    emitted = _mock_hook_engine["emitted"]
    executed = False

    async def _exec(args):
        nonlocal executed
        executed = True
        return {"ok": True}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="run_command", description="执行命令", parameters={}, executor=_exec)],
        approval_enabled=True,
        approval_timeout=5,
    )
    tc = ToolCall(id="c1", name="run_command", args={"command": "rm -rf /tmp/x"})
    task = asyncio.create_task(loop._execute_single(tc))
    await asyncio.sleep(0)

    ctx = _last_approval(emitted)
    resolve_approval_response(ctx["approval_id"], "reject")
    tr = await task

    assert executed is False  # 工具确实未执行
    assert tr.error == "User rejected tool call"
    assert tr.error_type == "user_rejected"
    assert tr.result == {"approved": False, "reason": "user_rejected"}
    assert ctx["approval_id"] not in agent_loop_v2._approval_registry


async def test_approval_rejected_unknown_tool_still_gate(_mock_hook_engine):
    """审批优先于工具存在性校验:未知高危工具被拒绝也返回 user_rejected。"""
    emitted = _mock_hook_engine["emitted"]
    loop = AgentLoopV2(None, [], approval_enabled=True, approval_timeout=5)
    tc = ToolCall(id="c1", name="write_file", args={})
    task = asyncio.create_task(loop._execute_single(tc))
    await asyncio.sleep(0)
    ctx = _last_approval(emitted)
    resolve_approval_response(ctx["approval_id"], "reject")
    tr = await task
    assert tr.error_type == "user_rejected"


# =============================================================================
# 4. 审批超时 → 返回 approval_timeout + 注册表清理
# =============================================================================


async def test_approval_timeout_tool_result(_mock_hook_engine):
    """超时(0.1s)后工具不执行,返回 error="Approval timeout"。"""
    emitted = _mock_hook_engine["emitted"]
    executed = False

    async def _exec(args):
        nonlocal executed
        executed = True
        return {"ok": True}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="run_command", description="执行命令", parameters={}, executor=_exec)],
        approval_enabled=True,
        approval_timeout=0.1,
    )
    tc = ToolCall(id="c1", name="run_command", args={"command": "ls"})
    tr = await loop._execute_single(tc)  # 直接 await,等待超时

    assert executed is False
    assert tr.error == "Approval timeout"
    assert tr.error_type == "approval_timeout"
    assert tr.result == {"approved": False, "reason": "approval_timeout"}
    # 超时后注册表条目已清理(防内存泄漏)
    assert not emitted or _last_approval(emitted)["approval_id"] not in agent_loop_v2._approval_registry


async def test_approval_timeout_cleans_registry(_mock_hook_engine):
    """超时后审批注册表条目被清理(内存泄漏防护)。"""
    loop = AgentLoopV2(None, [], approval_enabled=True, approval_timeout=0.1)
    tc = ToolCall(id="c1", name="write_file", args={})
    await loop._execute_single(tc)
    assert agent_loop_v2._approval_registry == {}


async def test_resolve_unknown_approval_returns_false(_mock_hook_engine):
    """响应不存在的 approval_id(已超时/从未发起)→ 返回 False(端点 404)。"""
    assert resolve_approval_response("appr_not_exist", "approve") is False


# =============================================================================
# 5. 审批关闭时直接执行(不等待)
# =============================================================================


async def test_approval_disabled_executes_directly(_mock_hook_engine):
    """approval_enabled=False(或 env TOOL_APPROVAL_ENABLED=false)时,高危工具直接执行。"""
    emitted = _mock_hook_engine["emitted"]
    executed = False

    async def _exec(args):
        nonlocal executed
        executed = True
        return {"ok": True}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="write_file", description="写文件", parameters={}, executor=_exec)],
        approval_enabled=False,
    )
    tc = ToolCall(id="c1", name="write_file", args={"path": "/tmp/x"})
    tr = await loop._execute_single(tc)
    assert executed is True
    assert tr.error is None
    # 未发任何 tool.approval 事件
    assert all(item["event"] != "tool.approval" for item in emitted)


# =============================================================================
# 6. 非高危工具不经审批门
# =============================================================================


async def test_low_risk_tool_skips_approval(_mock_hook_engine):
    """read_file 等非高危工具直接执行,不发审批事件。"""
    emitted = _mock_hook_engine["emitted"]

    async def _exec(args):
        return {"content": "file content"}

    loop = AgentLoopV2(
        None,
        [ToolDefinition(name="read_file", description="读文件", parameters={}, executor=_exec)],
        approval_enabled=True,
    )
    tc = ToolCall(id="c1", name="read_file", args={"path": "/tmp/x"})
    tr = await loop._execute_single(tc)
    assert tr.error is None
    assert tr.result == {"content": "file content"}
    assert all(item["event"] != "tool.approval" for item in emitted)


# =============================================================================
# 7. hook_engine.emit 失败降级(不抛,继续等待 → 超时兜底)
# =============================================================================


async def test_approval_emit_failure_degrades(_mock_hook_engine, monkeypatch):
    """emit 抛异常不中断审批:仍等待,超时后返回 approval_timeout(安全兜底)。"""
    async def _boom(event, context):
        raise RuntimeError("hook engine down")

    monkeypatch.setattr(agent_loop_v2, "hook_engine", types.SimpleNamespace(emit=_boom))
    loop = AgentLoopV2(None, [], approval_enabled=True, approval_timeout=0.1)
    tc = ToolCall(id="c1", name="write_file", args={})
    tr = await loop._execute_single(tc)
    assert tr.error == "Approval timeout"
    assert tr.error_type == "approval_timeout"
    # 注册表已清理
    assert agent_loop_v2._approval_registry == {}


# =============================================================================
# 8. 审批门不破坏 ReAct 主循环(通过 _execute_tools 集成路径)
# =============================================================================


async def test_approval_through_execute_tools_reject(_mock_hook_engine):
    """通过 _execute_tools 批量执行:高危被拒返回 user_rejected,非高危正常执行。"""
    emitted = _mock_hook_engine["emitted"]

    async def _write(args):
        return {"ok": True}

    async def _read(args):
        return {"content": "hello"}

    tools = [
        ToolDefinition(name="write_file", description="写文件", parameters={}, executor=_write),
        ToolDefinition(name="read_file", description="读文件", parameters={}, executor=_read),
    ]
    loop = AgentLoopV2(None, tools, approval_enabled=True, approval_timeout=5)
    calls = [
        ToolCall(id="c1", name="write_file", args={"path": "/tmp/a"}),
        ToolCall(id="c2", name="read_file", args={"path": "/tmp/b"}),
    ]
    task = asyncio.create_task(loop._execute_tools(calls))
    # 等审批事件发出
    for _ in range(20):
        if any(item["event"] == "tool.approval" for item in emitted):
            break
        await asyncio.sleep(0.01)
    ctx = _last_approval(emitted)
    resolve_approval_response(ctx["approval_id"], "reject")
    results = await task

    by_id = {tr.tool_call_id: tr for tr in results}
    assert by_id["c1"].error == "User rejected tool call"
    assert by_id["c1"].error_type == "user_rejected"
    # 非高危 read_file 不受审批阻塞,正常执行
    assert by_id["c2"].error is None
    assert by_id["c2"].result == {"content": "hello"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
