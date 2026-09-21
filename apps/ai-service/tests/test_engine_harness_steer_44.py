"""批 44 测试(自动生成,勿手改) — turn/steer 运行中转向 + loop 注入点。

生成器: .ihui-agent/tmp/gen_test_44.py
"""
from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from app.services.agent_engine import AgentEngine
from app.services.agent_loop_v2 import AgentLoopV2


class _FakeLoop:
    async def run(self, messages):  # pragma: no cover - 不跑到
        raise AssertionError("steer 测试不应触发 LLM 运行")

    async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
        raise AssertionError

    async def interrupt(self, mode="cancel"):  # pragma: no cover
        return None


async def _rpc(engine, method, params, req_id=1, emit=None):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params},
        emit=emit,
    )
    assert response is not None and "error" not in response, response
    return response["result"]


class _Collector:
    def __init__(self):
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, message):
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))

    def payloads(self, name):
        return [p for e, p in self.events if e == name]


def _engine(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    return AgentEngine(loop_factory=factory)


# =============================================================================
# loop 层 steer() / _drain_steers / take_leftover_steers
# =============================================================================


def _make_loop() -> AgentLoopV2:
    """最小可构造 loop(仅测 steer 队列语义,不跑 LLM)。"""
    async def _llm(*args, **kwargs):  # pragma: no cover
        raise AssertionError("steer 队列测试不应触发 LLM")

    return AgentLoopV2(
        llm_complete_fn=_llm,
        tools=[],
        max_iterations=3,
        enable_checkpoint=False,
        enable_memory=False,
    )


def test_loop_steer_rejects_before_run():
    """run() 未启动时 steer 返回 False(无活跃回合 → NotSubmitted)。"""
    loop = _make_loop()
    assert loop.steer("hi") is False
    assert loop.take_leftover_steers() == []


def test_loop_steer_accepts_while_running_and_drains():
    """run 中 steer 入队,_drain_steers 依序取出并清空。"""
    loop = _make_loop()
    # 模拟 run 已启动:_messages 非 None
    loop._messages = [{"role": "user", "content": "q"}]
    assert loop.steer("补充指令A") is True
    assert loop.steer("补充指令B") is True
    assert loop._drain_steers() == ["补充指令A", "补充指令B"]
    assert loop._drain_steers() == []  # 清空后为空


def test_loop_reset_clears_pending_steers():
    """_reset_run_state 清空 steer 队列(跨 run 不残留)。"""
    loop = _make_loop()
    loop._messages = [{"role": "user", "content": "q"}]
    loop.steer("旧残留")
    loop._messages = None
    loop._reset_run_state()
    assert loop.take_leftover_steers() == []


# =============================================================================
# 引擎层 turn/steer
# =============================================================================


async def test_engine_turn_steer_running_injects(tmp_path):
    """running 时 turn/steer 真注入 loop 队列,发 turn.steered 事件。"""
    engine = _engine(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))["threadId"]
    thread = engine._threads[tid]
    thread.status = "running"
    thread.loop = _SteerableLoop()
    thread.current_turn_id = "turn_x"

    r = await _rpc(
        engine,
        "turn.steer",
        {"threadId": tid, "input": "改一下方向"},
        emit=collector,
    )
    assert r["submitted"] is True and r["reason"] is None
    assert thread.loop.pending == ["改一下方向"]
    steered = collector.payloads("turn.steered")
    assert steered and steered[0]["turnId"] == "turn_x"


class _SteerableLoop:
    """最小 steer 协议假件(与 AgentLoopV2.steer 同签名)。"""

    def __init__(self):
        self.pending: list[str] = []

    def steer(self, text: str) -> bool:
        self.pending.append(text)
        return True


async def test_engine_turn_steer_idle_not_submitted(tmp_path):
    """空闲线程 turn/steer 返回 submitted=false(no_active_turn),不抛错。"""
    engine = _engine(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    r = await _rpc(engine, "turn.steer", {"threadId": tid, "input": "hi"})
    assert r["submitted"] is False
    assert r["reason"] == "no_active_turn"


async def test_engine_turn_steer_missing_input(tmp_path):
    """input 缺失 → INVALID_PARAMS。"""
    from app.services.agent_engine import INVALID_PARAMS

    engine = _engine(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "turn.steer",
            "params": {"threadId": tid},
        }
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS


async def test_engine_run_thread_recovers_leftover_steers(tmp_path):
    """回合结束后未消费的 steer 被回收转 queue(竞态兜底不丢消息)。"""

    class _Result:
        success = True
        stop_reason = "completed"
        final_response = "ok"
        iterations: list[Any] = []
        total_duration_ms = 1.0
        total_tokens_used = 5
        checkpoint_id = None
        error = None
        budget = None
        compaction_events: list[Any] = []

    class _RacingLoop:
        """主循环完成后仍残留未消费 steer(竞态窗口)。"""

        def __init__(self):
            self.pending: list[str] = ["迟到的转向"]

        def steer(self, text: str) -> bool:
            self.pending.append(text)
            return True

        def take_leftover_steers(self) -> list[str]:
            drained = list(self.pending)
            self.pending.clear()
            return drained

        async def run(self, messages):
            return _Result()

        async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
            return _Result()

    async def factory(spec, host_tools):
        return _RacingLoop()

    engine = AgentEngine(loop_factory=factory)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    thread = engine._threads[tid]
    await engine._run_thread(thread, lambda msg: None)
    # _run_thread finally 已把 loop 置 None,但 queue 应吸收 leftover
    assert thread.status == "idle"
    queued = [q["input"] for q in thread.queue]
    assert "迟到的转向" in queued
    assert any(q.get("via") == "steer" for q in thread.queue)
