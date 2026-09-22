# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(二十四):tool_call_trace + executed_tool_calls 生产接线测试。

验证 AgentLoopV2 内两个批58模块的真接线(此前"已写未接"假覆盖):
- tool_call_trace: AGENT_TOOL_CALL_TRACE_ENABLED=1 时 received/result_ready
  两里程碑真实发射;off 时零发射。
- executed_tool_calls: AGENT_EXECUTED_TOOL_CALLS_ENABLED=1 时 record +
  per-turn reset + 回灌 metadata 注入;off 时零注入。

全部默认 off、异常隔离、off 时与现状逐零差异。
"""

from __future__ import annotations

import asyncio
from typing import Any

import app.services.agent_loop_v2 as alv
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition


# ---------------------------------------------------------------------------
# 测试替身
# ---------------------------------------------------------------------------
def _make_tool(name: str, result: Any = None) -> ToolDefinition:
    async def executor(args: dict[str, Any]) -> Any:
        return result if result is not None else {"ok": True}

    return ToolDefinition(
        name=name,
        description="fake",
        parameters={"type": "object", "properties": {}},
        executor=executor,
    )


def _make_loop(tools: list[ToolDefinition], **kwargs: Any) -> AgentLoopV2:
    async def llm_complete(messages, tools_schema, **kw):
        return {
            "content": "done",
            "usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
            "model": "m1",
        }

    base: dict[str, Any] = {
        "llm_complete_fn": llm_complete,
        "tools": tools,
        "max_iterations": 1,
    }
    base.update(kwargs)
    return AgentLoopV2(**base)


def _tool_calling_llm_factory(seen: list[dict[str, Any]]):
    """第一轮发 tool_calls,第二轮收敛的 LLM 替身。"""

    async def two_round_llm(messages, tools_schema, **kw):
        seen.append(kw)
        if len(seen) == 1:
            return {
                "tool_calls": [{"id": "c1", "name": "clock_sleep", "args": {}}],
                "usage": {"total_tokens": 1},
                "model": "m1",
            }
        return {"content": "done", "usage": {"total_tokens": 1}, "model": "m1"}

    return two_round_llm


def _run(coro: Any) -> Any:
    return asyncio.get_event_loop().run_until_complete(coro)


# ---------------------------------------------------------------------------
# tool_call_trace
# ---------------------------------------------------------------------------
def test_trace_off_no_events(monkeypatch):
    """off(默认):trace 模块 received/result_ready 不被调用,与现状逐零差异。"""
    monkeypatch.delenv("AGENT_TOOL_CALL_TRACE_ENABLED", raising=False)
    calls: list[str] = []

    import app.core.tool_call_trace as tct

    orig_r, orig_rr = tct.received, tct.result_ready
    monkeypatch.setattr(
        tct, "received", lambda *a, **k: calls.append("received") or orig_r(*a, **k)
    )
    monkeypatch.setattr(
        tct,
        "result_ready",
        lambda *a, **k: calls.append("result_ready") or orig_rr(*a, **k),
    )

    loop = _make_loop(
        [_make_tool("clock_sleep")], llm_complete_fn=_tool_calling_llm_factory([]), max_iterations=3
    )
    _run(loop.run([{"role": "user", "content": "hi"}]))
    assert calls == []


def test_trace_on_emits_both_milestones(monkeypatch):
    """on:received 与 result_ready 两里程碑均真实发射,字段符合红线(无参数/输出)。"""
    monkeypatch.setenv("AGENT_TOOL_CALL_TRACE_ENABLED", "1")
    events: list[Any] = []

    import app.core.tool_call_trace as tct

    _orig_received, _orig_result_ready = tct.received, tct.result_ready
    monkeypatch.setattr(
        tct, "received", lambda *a, **k: events.append(_orig_received(*a, **k))
    )
    monkeypatch.setattr(
        tct, "result_ready", lambda *a, **k: events.append(_orig_result_ready(*a, **k))
    )

    loop = _make_loop(
        [_make_tool("clock_sleep")], llm_complete_fn=_tool_calling_llm_factory([]), max_iterations=3
    )
    _run(loop.run([{"role": "user", "content": "hi"}]))
    names = [e.name for e in events]
    assert "tool_call_received" in names
    assert "tool_result_ready" in names
    for e in events:
        d = e.as_dict()
        assert "tool_name" in d and "call_id" in d
        # 红线:trace 仅含标识符与工具名,绝不含参数或输出
        assert "args" not in d and "output" not in d and "result" not in d


def test_trace_exception_isolated(monkeypatch):
    """trace 抛异常不阻塞工具执行(异常隔离降级跳过)。"""
    monkeypatch.setenv("AGENT_TOOL_CALL_TRACE_ENABLED", "1")

    import app.core.tool_call_trace as tct

    def _boom(*a, **k):
        raise RuntimeError("trace boom")

    monkeypatch.setattr(tct, "received", _boom)

    loop = _make_loop(
        [_make_tool("clock_sleep")], llm_complete_fn=_tool_calling_llm_factory([]), max_iterations=3
    )
    result = _run(loop.run([{"role": "user", "content": "hi"}]))
    assert result.success


# ---------------------------------------------------------------------------
# executed_tool_calls
# ---------------------------------------------------------------------------
def test_executed_off_no_metadata(monkeypatch):
    """off(默认):LLM 请求不带 executed_tool_calls_metadata,与现状逐零差异。"""
    monkeypatch.delenv("AGENT_EXECUTED_TOOL_CALLS_ENABLED", raising=False)
    seen_kwargs: list[dict[str, Any]] = []

    async def llm_complete(messages, tools_schema, **kw):
        seen_kwargs.append(kw)
        return {"content": "ok", "usage": {"total_tokens": 1}, "model": "m1"}

    tool = _make_tool("clock_sleep")
    loop = _make_loop([tool], llm_complete_fn=llm_complete, max_iterations=2)
    # 第一轮触发工具调用,第二轮带 metadata 回灌
    async def two_round_llm(messages, tools_schema, **kw):
        seen_kwargs.append(kw)
        has_tool_msg = any(
            m.get("role") == "tool" or (isinstance(m.get("content"), list))
            for m in messages
        )
        if not seen_kwargs[-1].get("_called"):
            pass
        if len(seen_kwargs) == 1:
            return {
                "tool_calls": [
                    {"id": "c1", "name": "clock_sleep", "args": {}}
                ],
                "usage": {"total_tokens": 1},
                "model": "m1",
            }
        return {"content": "done", "usage": {"total_tokens": 1}, "model": "m1"}

    loop._llm_complete = two_round_llm  # type: ignore[assignment]
    _run(loop.run([{"role": "user", "content": "hi"}]))
    assert all("executed_tool_calls_metadata" not in kw for kw in seen_kwargs)


def test_executed_on_records_and_replays(monkeypatch):
    """on:第一轮工具调用被 record,第二轮请求注入 executed_tool_calls_metadata。"""
    monkeypatch.setenv("AGENT_EXECUTED_TOOL_CALLS_ENABLED", "1")
    seen_kwargs: list[dict[str, Any]] = []

    async def two_round_llm(messages, tools_schema, **kw):
        seen_kwargs.append(kw)
        if len(seen_kwargs) == 1:
            return {
                "tool_calls": [{"id": "c1", "name": "clock_sleep", "args": {}}],
                "usage": {"total_tokens": 1},
                "model": "m1",
            }
        return {"content": "done", "usage": {"total_tokens": 1}, "model": "m1"}

    tool = _make_tool("clock_sleep")
    loop = _make_loop([tool], llm_complete_fn=two_round_llm, max_iterations=3)
    result = _run(loop.run([{"role": "user", "content": "hi"}]))
    assert result.success

    assert loop._executed_tool_calls is not None
    entries = loop._executed_tool_calls.entries()
    assert entries == [{"name": "clock_sleep", "call_id": "c1"}]

    # 第二轮请求带 metadata,codex 形态
    assert len(seen_kwargs) >= 2
    meta = seen_kwargs[1].get("executed_tool_calls_metadata")
    assert meta is not None
    assert meta["tool_calls_complete"] is True
    assert meta["executed_tool_calls"] == [{"name": "clock_sleep", "call_id": "c1"}]


def test_executed_per_turn_reset(monkeypatch):
    """per-turn 生命周期:第二次 run 开始时 reset 清空上一轮记录。"""
    monkeypatch.setenv("AGENT_EXECUTED_TOOL_CALLS_ENABLED", "1")

    async def llm(messages, tools_schema, **kw):
        return {"content": "ok", "usage": {"total_tokens": 1}, "model": "m1"}

    loop = _make_loop([_make_tool("clock_sleep")], llm_complete_fn=llm)
    loop._executed_tool_calls.record("old-1", "old_tool")
    assert loop._executed_tool_calls.entries()

    _run(loop.run([{"role": "user", "content": "hi"}]))
    assert loop._executed_tool_calls.entries() == []


def test_executed_idempotent_record(monkeypatch):
    """同 call_id 重复 record 零副作用(seen_ids 语义)。"""
    monkeypatch.setenv("AGENT_EXECUTED_TOOL_CALLS_ENABLED", "1")

    async def llm(messages, tools_schema, **kw):
        return {"content": "ok", "usage": {"total_tokens": 1}, "model": "m1"}

    loop = _make_loop([_make_tool("clock_sleep")], llm_complete_fn=llm)
    assert loop._executed_tool_calls.record("c1", "tool_a") is True
    assert loop._executed_tool_calls.record("c1", "tool_a") is False
    assert loop._executed_tool_calls.entries() == [{"name": "tool_a", "call_id": "c1"}]


def test_executed_empty_entries_no_injection(monkeypatch):
    """on 但本轮无工具调用 → 不注入空 metadata(与现状逐零差异)。"""
    monkeypatch.setenv("AGENT_EXECUTED_TOOL_CALLS_ENABLED", "1")
    seen_kwargs: list[dict[str, Any]] = []

    async def llm(messages, tools_schema, **kw):
        seen_kwargs.append(kw)
        return {"content": "ok", "usage": {"total_tokens": 1}, "model": "m1"}

    loop = _make_loop([_make_tool("clock_sleep")], llm_complete_fn=llm)
    _run(loop.run([{"role": "user", "content": "hi"}]))
    assert all("executed_tool_calls_metadata" not in kw for kw in seen_kwargs)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
