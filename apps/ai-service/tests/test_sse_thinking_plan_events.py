# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-5(2026-09-13) thinking/plan-step SSE 事件测试。

覆盖:
1. emit_thinking_delta / emit_plan_step payload 结构(单元级);
2. _execute_tools 工具执行 plan.step started/completed 成对发射(串行 + 并行);
3. reasoning 为空时 thinking.delta 不发射(循环级);
4. hook 白名单放行(emit 可达订阅者,无"未知事件"告警)。

mock 策略:patch agent_loop_v2 命名空间的 hook_engine(与 test_agent_event_stream
同体例);白名单用例用内存模式 HookEngine(redis_client=None,不连 Redis)。
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

from app.services.agent_loop_v2 import (
    AgentEventStream,
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
)
from app.services.hook_engine import HOOK_EVENTS, HookEngine

# =============================================================================
# 构造辅助
# =============================================================================


def _echo_tool(name: str = "echo_tool") -> ToolDefinition:
    async def executor(args: dict) -> dict:
        return {"ok": True, "echo": args}

    return ToolDefinition(
        name=name,
        description="echo",
        parameters={"type": "object"},
        executor=executor,
    )


def _make_loop(content: str, *, session_id: str = "s-p05", **kw) -> AgentLoopV2:
    async def mock_llm(messages, tools_schema):  # noqa: ANN001, ANN202
        return {"content": content, "tool_calls": None}

    return AgentLoopV2(mock_llm, [_echo_tool()], session_id=session_id, **kw)


def _plan_step_emits(mock_he) -> list[tuple[str, dict]]:
    """从 mock hook_engine 的 emit 调用中抽取 plan.step 事件(保序)。"""
    return [
        (c.args[0], c.args[1])
        for c in mock_he.emit.await_args_list
        if c.args and c.args[0] == "plan.step"
    ]


def _thinking_emits(mock_he) -> list[tuple[str, dict]]:
    return [
        (c.args[0], c.args[1])
        for c in mock_he.emit.await_args_list
        if c.args and c.args[0] == "thinking.delta"
    ]


# =============================================================================
# 1. AgentEventStream 便捷方法 payload 结构
# =============================================================================


async def test_thinking_delta_payload_structure():
    """thinking.delta payload 四键:run_id/content/iteration/is_final。"""
    stream = AgentEventStream()
    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit
        await stream.emit_thinking_delta("s1", "思考内容", iteration=2)
    mock_emit.assert_awaited_once_with("thinking.delta", {
        "run_id": "s1",
        "content": "思考内容",
        "iteration": 2,
        "is_final": True,
    })


async def test_plan_step_payload_structure():
    """plan.step payload 六键:run_id/step_index/tool_name/status/decision/reason。"""
    stream = AgentEventStream()
    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit
        await stream.emit_plan_step("s1", 0, "echo_tool", "started")
        await stream.emit_plan_step(
            "s1", 0, "echo_tool", "completed",
            decision="execute_tool", reason="",
        )
    assert mock_emit.await_args_list[0].args == ("plan.step", {
        "run_id": "s1",
        "step_index": 0,
        "tool_name": "echo_tool",
        "status": "started",
        "decision": None,
        "reason": None,
    })
    assert mock_emit.await_args_list[1].args == ("plan.step", {
        "run_id": "s1",
        "step_index": 0,
        "tool_name": "echo_tool",
        "status": "completed",
        "decision": "execute_tool",
        "reason": "",
    })


# =============================================================================
# 2. _execute_tools:plan.step started/completed 成对发射
# =============================================================================


async def test_plan_step_pair_serial():
    """串行执行:单工具 started → completed 依序成对,completed 带推导 decision。"""
    loop = _make_loop("done")
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = AsyncMock()
        await loop._execute_tools(
            [ToolCall(id="c1", name="echo_tool", args={"q": 1})]
        )
    emits = _plan_step_emits(mock_he)
    assert [payload["status"] for _, payload in emits] == ["started", "completed"]
    started, completed = emits[0][1], emits[1][1]
    assert started["run_id"] == "s-p05"
    assert started["step_index"] == 0
    assert started["tool_name"] == "echo_tool"
    assert completed["step_index"] == 0
    assert completed["decision"] == "execute_tool"


async def test_plan_step_pairs_parallel():
    """并行执行:2 工具各发 started/completed,step_index 与批内序号对齐。"""
    loop = _make_loop(
        "done", parallel_tool_calls=True,
    )
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = AsyncMock()
        await loop._execute_tools([
            ToolCall(id="c1", name="t_a", args={}),
            ToolCall(id="c2", name="t_b", args={}),
        ])
    emits = _plan_step_emits(mock_he)
    started = [p for _, p in emits if p["status"] == "started"]
    completed = [p for _, p in emits if p["status"] == "completed"]
    assert len(started) == 2 and len(completed) == 2
    assert {p["tool_name"] for p in started} == {"t_a", "t_b"}
    assert {p["step_index"] for p in completed} == {0, 1}


# =============================================================================
# 3. thinking.delta 发射 gating
# =============================================================================


async def test_thinking_delta_emitted_when_reasoning_nonempty():
    """reasoning 非空 → 循环级恰好发射一次 thinking.delta(payload 完整)。"""
    loop = _make_loop("思考过程与最终回复")
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = AsyncMock()
        result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.success is True
    emits = _thinking_emits(mock_he)
    assert len(emits) == 1
    payload = emits[0][1]
    assert payload == {
        "run_id": "s-p05",
        "content": "思考过程与最终回复",
        "iteration": 1,
        "is_final": True,
    }


async def test_thinking_delta_skipped_when_reasoning_empty():
    """reasoning 为空 → 不发射 thinking.delta(其余事件不受影响)。"""
    loop = _make_loop("")
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = AsyncMock()
        result = await loop.run([{"role": "user", "content": "hi"}])
    assert result.success is True
    assert _thinking_emits(mock_he) == []
    # 无 tool_calls 单轮完成路径事件仍在(message.receive)
    assert any(
        c.args and c.args[0] == "message.receive"
        for c in mock_he.emit.await_args_list
    )


# =============================================================================
# 4. hook 白名单放行
# =============================================================================


async def test_hook_whitelist_allows_new_events(caplog):
    """thinking.delta / plan.step 在 HOOK_EVENTS 白名单内,emit 可达订阅者且无告警。"""
    assert "thinking.delta" in HOOK_EVENTS
    assert "plan.step" in HOOK_EVENTS
    engine = HookEngine(redis_client=None)
    q_thinking = engine.subscribe("thinking.delta")
    q_plan = engine.subscribe("plan.step")
    with caplog.at_level(logging.WARNING, logger="app.services.hook_engine"):
        await engine.emit(
            "thinking.delta",
            {"run_id": "s1", "content": "c", "iteration": 1, "is_final": True},
        )
        await engine.emit(
            "plan.step",
            {"run_id": "s1", "step_index": 0, "tool_name": "t", "status": "started"},
        )
    assert not any("未知事件" in r.message for r in caplog.records)
    assert q_thinking.get_nowait()["content"] == "c"
    assert q_plan.get_nowait()["status"] == "started"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
