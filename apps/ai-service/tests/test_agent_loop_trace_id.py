# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

"""AgentLoopV2 trace_id 跨链路关联测试(2026-09-18 立,可靠性提升)。

验证:
- AgentEventStream.bind_trace 后,emit 对未携带 trace_id 键的 payload 自动注入;
- 显式携带 trace_id 的 payload 不被覆盖,且调用方原 dict 不被修改;
- 未绑定 trace_id 时行为与现状逐零差异(payload 不新增键);
- AgentLoopV2 构造传入 trace_id → property 恒定,跨 _reset_run_state 不变;
- 未显式传入 trace_id → 每次 run(_reset_run_state)生成新 uuid,逐 run 变化;
- loop 实例的事件流(_events)始终与 loop 当前 trace_id 同步绑定。
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock

from app.services import agent_loop_v2 as alv


def _capture_hook_emit(monkeypatch) -> list[tuple[str, dict[str, Any]]]:
    """打桩模块内 hook_engine.emit,记录全部 (event, payload) 调用。"""
    calls: list[tuple[str, dict[str, Any]]] = []
    monkeypatch.setattr(
        alv.hook_engine,
        "emit",
        AsyncMock(side_effect=lambda event, payload=None: calls.append((event, payload))),
    )
    return calls


class TestAgentEventStreamTraceInjection:
    """AgentEventStream emit 的 trace_id 注入行为。"""

    def test_injects_trace_id_into_payload(self, monkeypatch):
        """绑定 trace_id 后 emit 自动注入;调用方原 dict 不被修改。"""
        calls = _capture_hook_emit(monkeypatch)
        stream = alv.AgentEventStream()
        stream.bind_trace("trace-abc")

        original: dict[str, Any] = {"session_id": "s1"}
        asyncio.run(stream.emit("session.start", original))

        assert len(calls) == 1
        event, payload = calls[0]
        assert event == "session.start"
        assert payload["trace_id"] == "trace-abc"
        assert payload["session_id"] == "s1"
        # 拷贝注入:调用方原 dict 不被污染
        assert "trace_id" not in original

    def test_does_not_override_explicit_trace_id(self, monkeypatch):
        """payload 显式携带 trace_id 时保持调用方值,不覆盖。"""
        calls = _capture_hook_emit(monkeypatch)
        stream = alv.AgentEventStream()
        stream.bind_trace("trace-abc")

        asyncio.run(
            stream.emit("llm.retry", {"session_id": "s1", "trace_id": "explicit"})
        )

        assert calls[0][1]["trace_id"] == "explicit"

    def test_unbound_stream_unchanged(self, monkeypatch):
        """未绑定 trace_id 时 payload 不新增键(与现状逐零差异)。"""
        calls = _capture_hook_emit(monkeypatch)
        stream = alv.AgentEventStream()

        asyncio.run(stream.emit("session.start", {"session_id": "s1"}))

        assert "trace_id" not in calls[0][1]

    def test_unbind_clears_injection(self, monkeypatch):
        """bind_trace(None) 解绑后不再注入。"""
        calls = _capture_hook_emit(monkeypatch)
        stream = alv.AgentEventStream()
        stream.bind_trace("trace-abc")
        stream.bind_trace(None)

        asyncio.run(stream.emit("session.start", {"session_id": "s1"}))

        assert "trace_id" not in calls[0][1]


def _make_loop(trace_id: str | None, **kwargs: Any) -> alv.AgentLoopV2:
    """构造最小可用的 AgentLoopV2(不触发真实 LLM/工具/记忆/审批)。"""

    async def dummy_llm(messages: list, tools: list, **kw: Any) -> dict[str, Any]:
        return {"content": "ok", "tool_calls": None}

    base: dict[str, Any] = {
        "tools": [],
        "enable_checkpoint": False,
        "enable_memory": False,
        "approval_enabled": False,
        "session_id": "sess-trace-test",
    }
    base.update(kwargs)
    return alv.AgentLoopV2(dummy_llm, trace_id=trace_id, **base)


class TestAgentLoopTraceIdLifecycle:
    """AgentLoopV2 trace_id 生命周期:显式恒定 / 隐式逐 run 重生成。"""

    def test_explicit_trace_id_constant_across_runs(self):
        """构造传入 trace_id → property 恒定,_reset_run_state 不改变。"""
        loop = _make_loop("biz-trace-001")
        assert loop.trace_id == "biz-trace-001"

        loop._reset_run_state()
        assert loop.trace_id == "biz-trace-001"

        loop._reset_run_state()
        assert loop.trace_id == "biz-trace-001"

    def test_implicit_trace_id_regenerated_per_run(self):
        """未传 trace_id → 构造后为 None,每次 _reset_run_state 生成新 uuid。"""
        loop = _make_loop(None)
        assert loop.trace_id is None

        loop._reset_run_state()
        first = loop.trace_id
        assert isinstance(first, str) and len(first) == 32

        loop._reset_run_state()
        second = loop.trace_id
        assert isinstance(second, str) and len(second) == 32
        assert first != second

    def test_events_stream_stays_bound_to_current_trace(self, monkeypatch):
        """loop 事件流始终绑定当前 trace_id,emit 的 payload 自动携带。"""
        calls = _capture_hook_emit(monkeypatch)

        # 显式传入:构造期即绑定
        loop = _make_loop("biz-trace-002")
        assert loop._events._trace_id == "biz-trace-002"
        asyncio.run(loop._events.emit("session.start", {"session_id": "s1"}))
        assert calls[-1][1]["trace_id"] == "biz-trace-002"

        # 未显式传入:_reset_run_state 后重新绑定新 trace
        loop2 = _make_loop(None)
        assert loop2._events._trace_id is None
        loop2._reset_run_state()
        assert loop2._events._trace_id == loop2.trace_id
        asyncio.run(loop2._events.emit("session.start", {"session_id": "s2"}))
        assert calls[-1][1]["trace_id"] == loop2.trace_id
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
