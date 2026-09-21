# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""1-5 AgentEventStream 事件流协作层契约测试(2026-09-08 立)。

覆盖拆层动机中声明的三条语义红线:
1. fail-open:emit 失败仅 warning 降级,绝不阻塞主链路(不抛出);
2. error 事件静默 suppress(silent=True 连 warning 也不记,避免异常路径日志级联);
3. tool.after 的 evidence/payload 构建失败跳过整次事件,同样不阻塞。

外加:tool.after 正常路径的 evidence 逐工具推导(diff/test/rollback)与
便捷方法 payload 结构(session_start/tool_before 等键完整性)。
"""

from __future__ import annotations

import logging
from unittest.mock import AsyncMock, patch

from app.services.agent_loop_v2 import AgentEventStream, ToolCall, ToolResult


def _mk_stream() -> AgentEventStream:
    return AgentEventStream()


def _edit_call() -> ToolCall:
    return ToolCall(
        id="call_1",
        name="edit_file",
        args={"path": "src/app.py", "oldText": "old", "newText": "new"},
    )


def _edit_result() -> ToolResult:
    return ToolResult(
        tool_call_id="call_1",
        name="edit_file",
        result={"ok": True},
        duration_ms=12.5,
    )


# =============================================================================
# 1. fail-open:emit 失败降级不抛
# =============================================================================


async def test_emit_failure_degrades_without_raising():
    """hook_engine.emit 抛异常 → emit 只 warning 降级,主链路不中断。"""
    stream = _mk_stream()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = AsyncMock(side_effect=RuntimeError("hook 崩溃"))
        # 不应抛出(fail-open 红线)
        await stream.session_start(
            session_id="s1",
            user_id="u1",
            conversation_id="c1",
            max_iterations=5,
        )
        mock_he.emit.assert_awaited_once()


async def test_error_event_is_silently_suppressed(caplog):
    """loop_error 的 emit 失败连 warning 都不记(异常路径防日志级联)。"""
    stream = _mk_stream()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = AsyncMock(side_effect=RuntimeError("error 事件发射失败"))
        with caplog.at_level(logging.WARNING, logger="app.services.agent_loop_v2"):
            await stream.loop_error(
                session_id="s1", iteration=2, error="boom", error_type="unknown"
            )
    assert not any("hook_engine.emit" in r.message for r in caplog.records)


# =============================================================================
# 2. tool.after:evidence 推导 + 失败跳过整次事件
# =============================================================================


async def test_tool_after_payload_carries_evidence():
    """正常路径:逐工具明细带 input/diff/rollback 证据(含 checkpoint 引用)。"""
    stream = _mk_stream()
    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit
        await stream.tool_after(
            session_id="s1",
            iteration=1,
            tool_calls=[_edit_call()],
            tool_results=[_edit_result()],
            duration_ms=30.0,
            checkpoint_id="cp-9",
        )
    mock_emit.assert_awaited_once()
    event, payload = mock_emit.await_args.args
    assert event == "tool.after"
    assert payload["iteration"] == 1
    assert payload["tool_calls_count"] == 1
    entry = payload["tool_results"][0]
    assert entry["name"] == "edit_file"
    assert entry["id"] == "call_1"
    assert entry["input"] == {"path": "src/app.py", "oldText": "old", "newText": "new"}
    assert entry["status"] == "ok"
    assert entry["diff"]["before"] == "old"
    assert entry["diff"]["after"] == "new"
    assert entry["rollback"]["checkpoint_id"] == "cp-9"
    assert entry["test"] is None


async def test_tool_after_skips_event_when_payload_build_fails():
    """明细构建抛异常(如 duration_ms=None 进 round)→ 跳过整次事件,不抛不崩。"""
    stream = _mk_stream()
    broken = ToolResult(
        tool_call_id="call_1",
        name="edit_file",
        result={"ok": True},
        duration_ms=None,  # type: ignore[assignment]  # round(None) 将 TypeError
    )
    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit
        # 不应抛出
        await stream.tool_after(
            session_id="s1",
            iteration=1,
            tool_calls=[_edit_call()],
            tool_results=[broken],
            duration_ms=30.0,
        )
    # 构建失败 → 整次事件被跳过(无 emit)
    mock_emit.assert_not_awaited()


# =============================================================================
# 3. 便捷方法 payload 结构
# =============================================================================


async def test_convenience_methods_emit_expected_payloads():
    """session_start/tool_before/message_receive/tool_approval/permission_mode
    的 payload 键结构与拆层前保持一致(逐字段精确断言)。"""
    stream = _mk_stream()
    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit
        await stream.session_start(
            session_id="s1",
            user_id="u1",
            conversation_id="c1",
            max_iterations=7,
        )
        await stream.session_end(
            session_id="s1",
            user_id="u1",
            success=True,
            stop_reason="completed",
            total_iterations=2,
            total_duration_ms=123.4,
        )
        await stream.tool_before(
            session_id="s1", iteration=1, messages_count=4, tools_count=3
        )
        await stream.message_receive(
            session_id="s1", iteration=1, content_length=42
        )
        await stream.tool_approval(
            approval_id="appr_1",
            tool_name="run_command",
            tool_call_id="call_1",
            args_preview='{"command": "ls"}',
            session_id="s1",
        )
        await stream.permission_mode(
            mode="plan", tool_name="read_file", decision="plan_blocked", session_id="s1"
        )

    events = [(c.args[0], c.args[1]) for c in mock_emit.await_args_list]
    assert ("session.start", {
        "session_id": "s1", "user_id": "u1",
        "conversation_id": "c1", "max_iterations": 7,
    }) in events
    assert ("session.end", {
        "session_id": "s1", "user_id": "u1", "success": True,
        "stop_reason": "completed", "total_iterations": 2,
        "total_duration_ms": 123.4,
    }) in events
    assert ("tool.before", {
        "session_id": "s1", "iteration": 1,
        "messages_count": 4, "tools_count": 3,
    }) in events
    assert ("message.receive", {
        "session_id": "s1", "iteration": 1,
        "content_length": 42, "stop_reason": "completed",
    }) in events
    assert ("tool.approval", {
        "approval_id": "appr_1", "tool_name": "run_command",
        "tool_call_id": "call_1", "args_preview": '{"command": "ls"}',
        "danger_level": "high", "session_id": "s1",
    }) in events
    assert ("permission.mode", {
        "mode": "plan", "tool": "read_file",
        "decision": "plan_blocked", "session_id": "s1",
    }) in events


async def test_loop_error_payload_shape():
    """loop_error 发 "error" 事件,payload 四键(session_id/iteration/error/error_type)。"""
    stream = _mk_stream()
    mock_emit = AsyncMock()
    with patch("app.services.agent_loop_v2.hook_engine") as mock_he:
        mock_he.emit = mock_emit
        await stream.loop_error(
            session_id="s1", iteration=3, error="超时", error_type="timeout"
        )
    mock_emit.assert_awaited_once_with("error", {
        "session_id": "s1",
        "iteration": 3,
        "error": "超时",
        "error_type": "timeout",
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
