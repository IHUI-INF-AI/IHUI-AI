# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""spawn_subagent 的工具面、上下文隔离、取消传递与父上下文预算。"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine
from app.services.agent_loop_v2 import TEAM_RELAY_SUMMARY_MAX
from app.services.subagent_spawn_policy import (
    SubagentToolListError,
    parent_visible_subagent_response,
    parse_optional_tool_list,
    remember_subagent_transcript,
    resolve_subagent_tool_surface,
)


def test_resolve_allow_is_hard_cap_and_deny_wins() -> None:
    allow, deny = resolve_subagent_tool_surface(
        ["read_file", "spawn_subagent"],
        ["write_file"],
        ["read_file", "write_file", "spawn_subagent"],
        ["spawn_subagent"],
    )
    assert allow == ["read_file"]
    assert deny == ["write_file", "spawn_subagent"]


def test_empty_allow_inherits_parent_and_none_means_default() -> None:
    inherited, deny = resolve_subagent_tool_surface(
        ["read_file"],
        [],
        [],
        None,
    )
    assert inherited == ["read_file"]
    assert deny == []
    default, _ = resolve_subagent_tool_surface(None, [], None, None)
    assert default is None


def test_parse_optional_tool_list_rejects_non_arrays() -> None:
    assert parse_optional_tool_list(None, "allowedTools") is None
    assert parse_optional_tool_list([], "allowedTools") == []
    with pytest.raises(SubagentToolListError):
        parse_optional_tool_list("read_file", "allowedTools")
    with pytest.raises(SubagentToolListError):
        parse_optional_tool_list([""], "disallowedTools")


def test_parent_visible_response_caps_at_relay_budget() -> None:
    short, truncated = parent_visible_subagent_response("done", limit=TEAM_RELAY_SUMMARY_MAX)
    assert short == "done" and truncated is False
    full = "x" * (TEAM_RELAY_SUMMARY_MAX + 8)
    visible, was_truncated = parent_visible_subagent_response(full, limit=TEAM_RELAY_SUMMARY_MAX)
    assert was_truncated is True
    assert len(visible) == TEAM_RELAY_SUMMARY_MAX
    assert full not in visible


def test_transcript_side_ledger_drops_oldest() -> None:
    store: dict[str, str] = {}
    order: list[str] = []
    remember_subagent_transcript(store, order, "a", "one", keep=2)
    remember_subagent_transcript(store, order, "b", "two", keep=2)
    remember_subagent_transcript(store, order, "c", "three", keep=2)
    assert "a" not in store
    assert store["c"] == "three"


class _RecordingLoop:
    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}
        self.messages: list[dict[str, Any]] = []
        self.cancel_calls = 0
        self.release: asyncio.Event | None = None

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        self.messages = messages
        if self.release is not None:
            self.release.set()
            await asyncio.Event().wait()
        return _Done()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _Done()

    async def cancel(self) -> str:
        self.cancel_calls += 1
        return "ckpt"


class _Done:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 1
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


class _LongDone(_Done):
    final_response = "y" * (TEAM_RELAY_SUMMARY_MAX + 12)


def _engine(
    loop_cls: type[_RecordingLoop] = _RecordingLoop,
) -> tuple[AgentEngine, list[_RecordingLoop]]:
    loops: list[_RecordingLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _RecordingLoop:
        loop = loop_cls()
        loop.spec = spec
        loops.append(loop)
        return loop

    return AgentEngine(loop_factory=factory), loops


async def _start(engine: AgentEngine) -> Any:
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 1, "method": "thread.start", "params": {"model": "parent-model"}}
    )
    assert response is not None and "error" not in response
    return engine._threads[response["result"]["threadId"]]


@pytest.mark.asyncio
async def test_spawn_applies_tool_surface_and_hides_parent_secret() -> None:
    engine, loops = _engine()
    thread = await _start(engine)
    thread.tool_names = ["read_file", "spawn_subagent"]
    thread.deny_tools = ["write_file"]
    thread.messages.append({"role": "user", "content": "SECRET_SENTINEL_parent"})
    tool = next(
        item for item in engine._builtin_tool_definitions(thread) if item.name == "spawn_subagent"
    )
    result = await tool.executor(
        {
            "prompt": "只读子任务",
            "allowedTools": ["read_file", "write_file", "spawn_subagent"],
            "disallowedTools": ["spawn_subagent"],
        }
    )
    assert result["success"] is True
    assert result["response"] == "done"
    assert "responseTruncated" not in result
    spec = loops[-1].spec
    assert spec["tool_names"] == ["read_file"]
    assert spec["deny_tools"] == ["write_file", "spawn_subagent"]
    blob = " ".join(str(item.get("content") or "") for item in loops[-1].messages)
    assert "SECRET_SENTINEL_parent" not in blob
    assert result["threadId"] not in engine._threads


@pytest.mark.asyncio
async def test_spawn_rejects_bad_tool_list_without_starting_child() -> None:
    engine, loops = _engine()
    thread = await _start(engine)
    tool = next(
        item for item in engine._builtin_tool_definitions(thread) if item.name == "spawn_subagent"
    )
    result = await tool.executor({"prompt": "x", "allowedTools": "read_file"})
    assert "allowedTools" in str(result.get("error", ""))
    assert loops == []


@pytest.mark.asyncio
async def test_spawn_cancel_reaches_child_loop() -> None:
    engine, loops = _engine()
    thread = await _start(engine)
    tool = next(
        item for item in engine._builtin_tool_definitions(thread) if item.name == "spawn_subagent"
    )
    release = asyncio.Event()

    class _Hanging(_RecordingLoop):
        async def run(self, messages: list[dict[str, Any]]) -> Any:
            self.messages = messages
            release.set()
            await asyncio.Event().wait()
            return _Done()

    # 替换工厂，让这一次子循环停在工具等待上
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _Hanging:
        loop = _Hanging()
        loop.spec = spec
        loops.append(loop)
        return loop

    engine._loop_factory = factory
    task = asyncio.create_task(tool.executor({"prompt": "挂起"}))
    await release.wait()
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    await asyncio.sleep(0)
    assert loops[-1].cancel_calls == 1
    assert all(item.thread_id == thread.thread_id for item in engine._threads.values())


@pytest.mark.asyncio
async def test_spawn_long_response_stays_out_of_parent_payload() -> None:
    engine, loops = _engine()
    thread = await _start(engine)

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _RecordingLoop:
        loop = _RecordingLoop()
        loop.spec = spec
        loops.append(loop)

        class _LongLoop(_RecordingLoop):
            async def run(self, messages: list[dict[str, Any]]) -> Any:
                self.messages = messages
                return _LongDone()

        long_loop = _LongLoop()
        long_loop.spec = spec
        loops[-1] = long_loop
        return long_loop

    engine._loop_factory = factory
    tool = next(
        item for item in engine._builtin_tool_definitions(thread) if item.name == "spawn_subagent"
    )
    result = await tool.executor({"prompt": "长答复"})
    assert result["responseTruncated"] is True
    assert len(result["response"]) == TEAM_RELAY_SUMMARY_MAX
    assert "y" * (TEAM_RELAY_SUMMARY_MAX + 12) not in result["response"]
    stored = engine._subagent_transcripts[result["threadId"]]
    assert len(stored) == TEAM_RELAY_SUMMARY_MAX + 12
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
