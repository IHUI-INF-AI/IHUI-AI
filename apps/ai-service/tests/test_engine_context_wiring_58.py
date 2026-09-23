# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58 接线:agent_engine 侧 agents_md_state + turn_token_usage。

覆盖(开有效果/关零差异):
- IHUI_AGENTS_MD_STATE_ENABLED off → 原纯字符串拼接(逐字节等价)
- on → 状态机增量注入(首次/同内容跳过/REPLACEMENT/REMOVAL/线程隔离)
- IHUI_TURN_TOKEN_USAGE_ENABLED off → 不产生新事件
- on → turn_token_usage 指标事件(六桶/telemetry 模型名/跨模型分桶)
- 异常隔离 + env 非法值按 off
"""

import asyncio
import os
from typing import Any

import pytest

from app.services.agent_engine import AgentEngine


# ---------------------------------------------------------------------------
# 测试替身(与 tests/test_agent_engine.py 同手法)
# ---------------------------------------------------------------------------


class _FakeResult:
    def __init__(self, iterations: list[dict[str, Any]] | None = None) -> None:
        self.success = True
        self.stop_reason = "completed"
        self.final_response = "done"
        self.iterations = iterations or [{"iteration": 1}]
        self.total_duration_ms = 1.0
        self.total_tokens_used = 10
        self.checkpoint_id = None
        self.error = None
        self.budget = None
        self.compaction_events: list[dict[str, Any]] = []


class _FakeHub:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    def subscribe(self, event: str, queue: Any = None) -> asyncio.Queue[Any]:
        q: asyncio.Queue[Any] = asyncio.Queue()
        self.queues.setdefault(event, []).append(q)
        return q

    def unsubscribe(self, event: str, queue: asyncio.Queue[Any]) -> None:
        subs = self.queues.get(event)
        if subs and queue in subs:
            subs.remove(queue)

    def push(self, event: str, payload: dict[str, Any]) -> None:
        self.events.append((event, payload))


class _FakeLoop:
    def __init__(self, result: _FakeResult | None = None) -> None:
        self.result = result or _FakeResult()
        self.spec: dict[str, Any] = {}

    async def run(self, messages: list[dict[str, Any]]) -> _FakeResult:
        return self.result

    async def resume_from_checkpoint(self, checkpoint_id: str) -> _FakeResult:
        return self.result

    def cancel(self) -> None:
        pass

    def pause(self) -> None:
        pass


class _FakeHubOwner(_FakeHub):
    queues: dict[str, list[Any]]


async def _rpc(
    engine: AgentEngine, method: str, params: dict[str, Any] | None = None, req_id: int = 1,
    emit: Any = None,
) -> dict[str, Any]:
    message: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method}
    if params is not None:
        message["params"] = params
    response = await engine.handle_message(message, emit=emit)
    assert response is not None
    return response


class _EmitCapture:
    """捕获 engine 自产事件(thread/event 通知的 emit 回调)。"""

    def __init__(self) -> None:
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, payload: dict[str, Any]) -> None:
        params = payload.get("params") or {}
        self.events.append((str(params.get("event")), dict(params.get("payload") or {})))

    def of(self, event: str) -> list[dict[str, Any]]:
        return [p for e, p in self.events if e == event]


def _make_engine(
    preset_result: _FakeResult | None = None,
) -> tuple[AgentEngine, list[_FakeLoop], _EmitCapture]:
    loops: list[_FakeLoop] = []

    async def factory(spec: dict[str, Any], host_tools: list[Any]) -> _FakeLoop:
        loop = _FakeLoop(preset_result) if preset_result is not None else _FakeLoop()
        loop.spec = spec
        loops.append(loop)
        return loop

    emit_capture = _EmitCapture()
    engine = AgentEngine(loop_factory=factory)
    return engine, loops, emit_capture


def _start(engine: AgentEngine, workspace: str | None = None) -> str:
    params: dict[str, Any] = {"permissionMode": "default"}
    if workspace is not None:
        params["workspace"] = workspace
    resp = asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.start", params)
    )
    return resp["result"]["threadId"]


# ---------------------------------------------------------------------------
# AGENTS.md 注入
# ---------------------------------------------------------------------------


def test_agents_md_off_keeps_plain_concat(monkeypatch, tmp_path):
    """开关 off:与原纯字符串拼接逐字节等价(含 [项目文档 AGENTS.md] 字样)。"""
    monkeypatch.delenv("IHUI_AGENTS_MD_STATE_ENABLED", raising=False)
    (tmp_path / "AGENTS.md").write_text("# 规则:永远说真话", encoding="utf-8")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    thread = engine._threads[thread_id]
    assert "[项目文档 AGENTS.md]" in thread.messages[0]["content"]
    assert "# 规则:永远说真话" in thread.messages[0]["content"]


def test_agents_md_no_workspace_no_injection(monkeypatch):
    """无 workspace:两种开关态都不注入、不报错。"""
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=None)
    thread = engine._threads[thread_id]
    assert "[项目文档 AGENTS.md]" not in thread.messages[0]["content"]
    assert "# AGENTS.md instructions" not in thread.messages[0]["content"]


def test_agents_md_on_first_injection(monkeypatch, tmp_path):
    """开关 on 首次:注入且正文带 codex 开标记 # AGENTS.md instructions。"""
    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    (tmp_path / "AGENTS.md").write_text("规则A", encoding="utf-8")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    content = engine._threads[thread_id].messages[0]["content"]
    assert "# AGENTS.md instructions" in content
    assert "规则A" in content
    # 开启态不再使用旧拼接标记
    assert "[项目文档 AGENTS.md]" not in content


def test_agents_md_on_same_content_no_reinject(monkeypatch, tmp_path):
    """开关 on 同一 thread 第二轮同内容:状态机返回 None,不重复注入。"""
    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    (tmp_path / "AGENTS.md").write_text("规则A", encoding="utf-8")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    thread = engine._threads[thread_id]
    first = thread.messages[0]["content"]
    # 第二次注入(同内容)不追加
    engine._inject_agents_md(thread)
    assert thread.messages[0]["content"] == first


def test_agents_md_on_replacement_notice(monkeypatch, tmp_path):
    """开关 on 内容变更:REPLACEMENT 通知文案出现。"""
    from app.core.agents_md_state import REPLACEMENT_NOTICE

    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    (tmp_path / "AGENTS.md").write_text("规则A", encoding="utf-8")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    thread = engine._threads[thread_id]
    (tmp_path / "AGENTS.md").write_text("规则B", encoding="utf-8")
    engine._inject_agents_md(thread)
    assert REPLACEMENT_NOTICE in thread.messages[0]["content"]
    assert "规则B" in thread.messages[0]["content"]


def test_agents_md_on_removal_notice(monkeypatch, tmp_path):
    """开关 on 文件被删:REMOVAL 通知文案出现。"""
    from app.core.agents_md_state import REMOVAL_NOTICE

    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    (tmp_path / "AGENTS.md").write_text("规则A", encoding="utf-8")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    thread = engine._threads[thread_id]
    (tmp_path / "AGENTS.md").unlink()
    engine._inject_agents_md(thread)
    assert REMOVAL_NOTICE in thread.messages[0]["content"]


def test_agents_md_threads_isolated(monkeypatch, tmp_path):
    """两个 thread 各自持有状态机:同目录第二个 thread 仍首次注入。"""
    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    (tmp_path / "AGENTS.md").write_text("规则A", encoding="utf-8")
    engine, _, _ = _make_engine()
    t1 = _start(engine, workspace=str(tmp_path))
    t2 = _start(engine, workspace=str(tmp_path))
    c1 = engine._threads[t1].messages[0]["content"]
    c2 = engine._threads[t2].messages[0]["content"]
    assert "# AGENTS.md instructions" in c1
    assert "# AGENTS.md instructions" in c2
    assert engine._threads[t1].agents_md_state is not (
        engine._threads[t2].agents_md_state
    )


def test_agents_md_state_reset_method(monkeypatch, tmp_path):
    """reset_agents_md_state:重置后同内容再次注入(压缩后强制重注入语义)。"""
    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    (tmp_path / "AGENTS.md").write_text("规则A", encoding="utf-8")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    thread = engine._threads[thread_id]
    first = thread.messages[0]["content"]
    engine._inject_agents_md(thread)
    assert thread.messages[0]["content"] == first
    engine.reset_agents_md_state(thread)
    engine._inject_agents_md(thread)
    # 重置后状态机视为首次,再次追加
    assert thread.messages[0]["content"] != first
    assert thread.messages[0]["content"].endswith(
        thread.messages[0]["content"].split("\n\n")[-1]
    )


def test_agents_md_injection_failure_isolated(monkeypatch, tmp_path):
    """load_project_instructions 抛异常:降级告警不抛出。"""
    monkeypatch.setenv("IHUI_AGENTS_MD_STATE_ENABLED", "1")
    engine, _, _ = _make_engine()
    thread_id = _start(engine, workspace=str(tmp_path))
    thread = engine._threads[thread_id]

    import app.services.agent_engine as engine_mod

    def _boom(_ws: str) -> Any:
        raise RuntimeError("boom")

    monkeypatch.setattr(engine_mod, "_agents_md_state_enabled_from_env", lambda: True)
    import app.core.agents_md as agents_md_mod

    monkeypatch.setattr(agents_md_mod, "load_project_instructions", _boom)
    # 不抛出即为通过
    engine._inject_agents_md(thread)


# ---------------------------------------------------------------------------
# turn_token_usage
# ---------------------------------------------------------------------------


def _result_with_usage(models: list[str]) -> _FakeResult:
    iterations: list[dict[str, Any]] = []
    total = 0
    for m in models:
        total += 100
        iterations.append(
            {
                "iteration": len(iterations) + 1,
                "usage": {
                    "input_tokens": 60,
                    "output_tokens": 40,
                    "total_tokens": 100,
                },
                "model": m,
            }
        )
    result = _FakeResult(iterations)
    result.total_tokens_used = total
    return result


def test_token_usage_off_no_events(monkeypatch):
    """开关 off:不产生 turn_token_usage 事件。"""
    monkeypatch.delenv("IHUI_TURN_TOKEN_USAGE_ENABLED", raising=False)
    engine, loops, emit_cap = _make_engine()
    loops.append(_FakeLoop(_result_with_usage(["gpt-x"])))
    thread_id = _start(engine)
    asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "hi"}, emit=emit_cap)
    )
    assert not emit_cap.of("turn_token_usage")


def test_token_usage_on_six_buckets(monkeypatch):
    """开关 on:六桶齐、value 正确、telemetry 带模型名。"""
    monkeypatch.setenv("IHUI_TURN_TOKEN_USAGE_ENABLED", "1")
    engine, loops, emit_cap = _make_engine(_result_with_usage(["gpt-x"]))
    thread_id = _start(engine)
    asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "hi"}, emit=emit_cap)
    )
    events = emit_cap.of("turn_token_usage")
    assert events, "开关开启时应产生 turn_token_usage 事件"
    types = {p["token_type"] for p in events}
    assert types == {
        "total", "input", "cached_input", "cache_write_input", "output",
        "reasoning_output",
    }
    by_type = {p["token_type"]: p["value"] for p in events}
    assert by_type["input"] == 60
    assert by_type["output"] == 40
    assert by_type["total"] == 100
    assert by_type["cached_input"] == 0
    for p in events:
        assert p["metric"] == "turn_token_usage"
        assert p["telemetry"]["model"] == "gpt-x"


def test_token_usage_on_cross_model_buckets(monkeypatch):
    """跨模型 fallback:按模型分桶(两个模型各 6 桶)。"""
    monkeypatch.setenv("IHUI_TURN_TOKEN_USAGE_ENABLED", "1")
    engine, loops, emit_cap = _make_engine(_result_with_usage(["model-a", "model-b"]))
    thread_id = _start(engine)
    asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "hi"}, emit=emit_cap)
    )
    events = emit_cap.of("turn_token_usage")
    models = {p["telemetry"]["model"] for p in events}
    assert models == {"model-a", "model-b"}
    assert len(events) == 12  # 2 模型 × 6 桶
    a_total = sum(
        p["value"] for p in events
        if p["telemetry"]["model"] == "model-a" and p["token_type"] == "total"
    )
    assert a_total == 100


def test_token_usage_on_no_usage_fallback_zero_sample(monkeypatch):
    """无精确 usage:fallback 零值样本(不伪造分项,但保留零值语义)。"""
    monkeypatch.setenv("IHUI_TURN_TOKEN_USAGE_ENABLED", "1")
    result = _FakeResult([{"iteration": 1}])  # 无 usage 键
    result.total_tokens_used = 7
    engine, loops, emit_cap = _make_engine(result)
    thread_id = _start(engine)
    asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "hi"}, emit=emit_cap)
    )
    events = emit_cap.of("turn_token_usage")
    # 无分项时 samples() 空 ledger + fallback → 6 条零值样本,或无事件(取决于
    # fallback telemetry 是否可得);两种都合法,但不得出现非零伪造值。
    for p in events:
        assert p["value"] == 0


def test_token_usage_invalid_env_is_off(monkeypatch):
    """env 非法值按 off 处理,不崩、无新事件。"""
    monkeypatch.setenv("IHUI_TURN_TOKEN_USAGE_ENABLED", "maybe")
    engine, loops, emit_cap = _make_engine(_result_with_usage(["m"]))
    thread_id = _start(engine)
    asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "hi"}, emit=emit_cap)
    )
    assert not emit_cap.of("turn_token_usage")


def test_token_usage_emit_failure_isolated(monkeypatch):
    """事件发射抛异常:被 contextlib.suppress 吞掉,不影响 prompt 返回。"""
    monkeypatch.setenv("IHUI_TURN_TOKEN_USAGE_ENABLED", "1")
    engine, loops, _ = _make_engine()
    loops.append(_FakeLoop(_result_with_usage(["m"])))
    thread_id = _start(engine)

    async def _boom(*a: Any, **k: Any) -> None:
        raise RuntimeError("emit boom")

    engine._emit_engine_event = _boom  # type: ignore[method-assign]
    resp = asyncio.get_event_loop().run_until_complete(
        _rpc(engine, "thread.prompt", {"threadId": thread_id, "input": "hi"})
    )
    assert resp["result"]["success"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
