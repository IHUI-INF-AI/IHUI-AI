# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Harness 钩子生命周期(2026-09-18 第十二批)单测。

覆盖(对标 Codex hooks crate 的 12 个事件名中此前缺失的四项):
- subagent.start / subagent.stop:派生子代理前后成对发出
- agent.stop:每轮代理工作结束时发出
- agent.interrupt:中断生效时发出(cancel/pause 带 checkpoint)
- 白名单四个新事件已登记
"""

from typing import Any

import pytest

from app.services.agent_engine import AgentEngine
from app.services.hook_engine import HOOK_EVENTS

# =============================================================================
# 夹具
# =============================================================================


class _FakeLoop:
    def __init__(self) -> None:
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> Any:
        return _SimpleResult()

    async def resume_from_checkpoint(self, checkpoint_id: str) -> Any:
        return _SimpleResult()

    async def interrupt(self, mode: str = "cancel") -> Any:
        return None

    async def cancel(self) -> Any:
        return "ckp_cancel"

    async def pause(self) -> Any:
        return "ckp_pause"


class _SimpleResult:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 123
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


class _RecordingBus:
    """记录 hook 事件的假总线。"""

    def __init__(self) -> None:
        self.emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(self, event: str, context: dict[str, Any]) -> list[Any]:
        self.emitted.append((event, context))
        return []

    def subscribe(self, *args: Any, **kwargs: Any) -> Any:
        raise TypeError("no queue support")

    def unsubscribe(self, *args: Any, **kwargs: Any) -> None:
        return None

    def names(self) -> list[str]:
        return [e for e, _ in self.emitted]

    def payloads(self, name: str) -> list[dict[str, Any]]:
        return [c for e, c in self.emitted if e == name]


def _engine(**kwargs: Any):
    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        return _FakeLoop()

    return AgentEngine(loop_factory=factory, **kwargs)


async def _rpc(engine: AgentEngine, method: str, params: dict[str, Any], req_id: int = 1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" not in response, response
    return response["result"]


@pytest.fixture(autouse=True)
def _mock_env(monkeypatch):
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    yield {}


def _find_builtin(engine: AgentEngine, thread: Any, name: str) -> Any:
    for definition in engine._builtin_tool_definitions(thread):
        if getattr(definition, "name", "") == name:
            return definition
    raise AssertionError(f"内置工具未注入: {name}")


# =============================================================================
# 白名单登记
# =============================================================================


def test_hook_events_whitelist_includes_new_lifecycle():
    for name in ("subagent.start", "subagent.stop", "agent.stop", "agent.interrupt"):
        assert name in HOOK_EVENTS


# =============================================================================
# subagent.start / stop
# =============================================================================


@pytest.mark.asyncio
async def test_subagent_hooks_pair():
    bus = _RecordingBus()
    engine = _engine(hook_bus=bus)
    started = await _rpc(engine, "thread.start", {})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "spawn_subagent")
    result = await tool.executor({"prompt": "do a sub task", "role": "researcher"})
    assert result["success"] is True
    starts = bus.payloads("subagent.start")
    stops = bus.payloads("subagent.stop")
    assert len(starts) == 1 and len(stops) == 1
    assert starts[0]["role"] == "researcher"
    assert starts[0]["promptChars"] == len("do a sub task")
    assert stops[0]["role"] == "researcher"
    assert stops[0]["subThreadId"] == result["threadId"]
    # 顺序:start 先于 stop
    assert bus.names().index("subagent.start") < bus.names().index("subagent.stop")


@pytest.mark.asyncio
async def test_agent_stop_hook_emitted_each_turn():
    bus = _RecordingBus()
    engine = _engine(hook_bus=bus)
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    await _rpc(engine, "thread.prompt", {"threadId": tid, "input": "go"}, req_id=2)
    stops = bus.payloads("agent.stop")
    assert len(stops) == 1
    assert stops[0]["threadId"] == tid
    assert stops[0]["success"] is True
    assert isinstance(stops[0]["durationMs"], (int, float))


@pytest.mark.asyncio
async def test_agent_interrupt_hook_on_cancel_and_pause():
    bus = _RecordingBus()
    engine = _engine(hook_bus=bus)
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    thread = engine._threads[tid]
    # 构造 running 态 + 在跑的 loop
    thread.status = "running"
    thread.loop = _FakeLoop()
    result = await _rpc(
        engine, "thread.interrupt", {"threadId": tid, "mode": "cancel"}, req_id=2
    )
    assert result["interrupted"] is True
    hooks = bus.payloads("agent.interrupt")
    assert len(hooks) == 1
    assert hooks[0]["mode"] == "cancel"
    assert hooks[0]["checkpointId"] == "ckp_cancel"

    # pause 模式
    thread.status = "running"
    thread.loop = _FakeLoop()
    await _rpc(
        engine, "thread.interrupt", {"threadId": tid, "mode": "pause"}, req_id=3
    )
    hooks = bus.payloads("agent.interrupt")
    assert len(hooks) == 2
    assert hooks[1]["mode"] == "pause"
    assert hooks[1]["checkpointId"] == "ckp_pause"


@pytest.mark.asyncio
async def test_interrupt_hook_not_emitted_without_active_run():
    bus = _RecordingBus()
    engine = _engine(hook_bus=bus)
    started = await _rpc(engine, "thread.start", {})
    tid = started["threadId"]
    result = await _rpc(
        engine, "thread.interrupt", {"threadId": tid, "mode": "cancel"}, req_id=2
    )
    assert result["interrupted"] is False
    assert bus.payloads("agent.interrupt") == []
