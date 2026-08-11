"""Hook 引擎集成测试 — 验证 agent_loop_v2 中 6 个 hook_engine.emit() 调用点。

测试覆盖:
- session.start / session.end 在 run() 中被调用
- tool.before / tool.after 在迭代中被调用
- message.receive 在完成时被调用
- error 在异常时被调用
- emit 失败不阻塞主循环
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


# =============================================================================
# 辅助
# =============================================================================


async def _weather_executor(args: dict) -> dict:
    return {"city": args["city"], "weather": "晴", "temp": 25}


def _weather_tool() -> ToolDefinition:
    return ToolDefinition(
        name="get_weather",
        description="查询城市天气",
        parameters={
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
        executor=_weather_executor,
    )


def _default_messages() -> list[dict]:
    return [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "北京天气"},
    ]


# =============================================================================
# 1. session.start / session.end 在 run() 中被调用
# =============================================================================


async def test_session_start_end_emitted():
    """验证 run() 调用 session.start 和 session.end。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [
                    {"id": "call_1", "name": "get_weather", "args": {"city": "北京"}}
                ],
            }
        return {"content": "北京天气晴,25°C", "tool_calls": None}

    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit

        loop = AgentLoopV2(
            llm_complete_fn=mock_llm,
            tools=[_weather_tool()],
            max_iterations=5,
            enable_checkpoint=False,
            enable_memory=False,
        )
        result = await loop.run(_default_messages())

    assert result.success is True

    # session.start:此时 _session_id 尚未生成,传空字符串
    mock_emit.assert_any_call("session.start", {
        "session_id": "",
        "user_id": "",
        "conversation_id": "",
        "max_iterations": 5,
    })

    # session.end:_session_id 已生成
    mock_emit.assert_any_call("session.end", {
        "session_id": loop._session_id or "",
        "user_id": "",
        "success": True,
        "stop_reason": "completed",
        "total_iterations": 2,
        "total_duration_ms": result.total_duration_ms,
    })

    # 至少 4 次:session.start + tool.before + tool.after + session.end
    assert mock_emit.call_count >= 4


# =============================================================================
# 2. tool.before / tool.after 在迭代中被调用
# =============================================================================


async def test_tool_before_after_emitted():
    """验证每轮迭代调用 tool.before 和 tool.after。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [
                    {"id": "call_1", "name": "get_weather", "args": {"city": "北京"}}
                ],
            }
        return {"content": "晴", "tool_calls": None}

    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit

        loop = AgentLoopV2(
            llm_complete_fn=mock_llm,
            tools=[_weather_tool()],
            max_iterations=5,
            enable_checkpoint=False,
            enable_memory=False,
        )
        await loop.run(_default_messages())

    # tool.before 在第 1 轮被调用
    tool_before_calls = [
        c for c in mock_emit.call_args_list if c[0][0] == "tool.before"
    ]
    assert len(tool_before_calls) >= 1
    assert tool_before_calls[0][0][1]["iteration"] == 1

    # tool.after 在第 1 轮被调用
    tool_after_calls = [
        c for c in mock_emit.call_args_list if c[0][0] == "tool.after"
    ]
    assert len(tool_after_calls) >= 1
    assert tool_after_calls[0][0][1]["iteration"] == 1
    assert tool_after_calls[0][0][1]["tool_calls_count"] == 1


# =============================================================================
# 3. message.receive 在完成时被调用
# =============================================================================


async def test_message_receive_emitted():
    """验证 LLM 返回无 tool_calls 时调用 message.receive。"""
    async def mock_llm(messages, tools):
        return {"content": "直接回复,无需工具", "tool_calls": None}

    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit

        loop = AgentLoopV2(
            llm_complete_fn=mock_llm,
            tools=[],
            max_iterations=5,
            enable_checkpoint=False,
            enable_memory=False,
        )
        result = await loop.run(_default_messages())

    assert result.success is True
    mock_emit.assert_any_call("message.receive", {
        "session_id": loop._session_id or "",
        "iteration": 1,
        "content_length": len("直接回复,无需工具"),
        "stop_reason": "completed",
    })


# =============================================================================
# 4. error 在异常时被调用
# =============================================================================


async def test_error_emitted_on_exception():
    """验证 LLM 调用异常时调用 error 事件。"""
    async def mock_llm(messages, tools):
        raise ValueError("LLM API 调用失败")

    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit

        loop = AgentLoopV2(
            llm_complete_fn=mock_llm,
            tools=[],
            max_iterations=5,
            enable_checkpoint=False,
            enable_memory=False,
        )
        result = await loop.run(_default_messages())

    assert result.success is False
    assert result.stop_reason == "error"
    mock_emit.assert_any_call("error", {
        "session_id": loop._session_id or "",
        "iteration": 1,
        "error": "LLM API 调用失败",
    })
    # 异常时也应有 session.end
    assert any(c[0][0] == "session.end" for c in mock_emit.call_args_list)


# =============================================================================
# 5. emit 失败不阻塞主循环
# =============================================================================


async def test_emit_failure_does_not_block():
    """验证 emit 抛出异常时不阻塞主循环。"""
    call_count = 0

    async def mock_llm(messages, tools):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return {
                "content": "查天气",
                "tool_calls": [
                    {"id": "call_1", "name": "get_weather", "args": {"city": "北京"}}
                ],
            }
        return {"content": "晴,25°C", "tool_calls": None}

    mock_emit = AsyncMock(side_effect=RuntimeError("emit 失败"))
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit

        loop = AgentLoopV2(
            llm_complete_fn=mock_llm,
            tools=[_weather_tool()],
            max_iterations=5,
            enable_checkpoint=False,
            enable_memory=False,
        )
        result = await loop.run(_default_messages())

    # 即使 emit 全部失败,主循环仍应正常完成
    assert result.success is True
    assert result.stop_reason == "completed"
    assert len(result.iterations) == 2