"""批 43 测试(自动生成,勿手改) — thread/revert 回合回退 + session_store.revert_thread。

生成器: .ihui-agent/tmp/gen_test_43.py
"""
from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.services.agent_engine import (
    INVALID_PARAMS,
    THREAD_BUSY,
    AgentEngine,
    EngineThread,
)
from app.services.session_store import (
    SessionStore,
    ThreadNotFoundError,
    TurnMismatchError,
    TurnNotFoundError,
    UserMessageItem,
)


class _FakeLoop:
    async def run(self, messages):  # pragma: no cover - 不跑到
        raise AssertionError("revert 测试不应触发 LLM 运行")

    async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
        raise AssertionError

    async def interrupt(self, mode="cancel"):  # pragma: no cover
        return None


class _SimpleResult:
    success = True
    stop_reason = "end_turn"
    final_response = "done"
    iterations: list[Any] = []
    total_duration_ms = 1.0
    total_tokens_used = 10
    checkpoint_id = None
    error = None
    budget = None
    compaction_events: list[Any] = []


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


def _engine_with_store(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "s43.db"))
    return AgentEngine(loop_factory=factory, store=store), store


# =============================================================================
# session_store.revert_thread(store 层)
# =============================================================================


def test_store_revert_truncates_turns_and_items(tmp_path):
    """revert_thread: 截断点及其后的 turns+items 全删,之前的保留。"""
    store = SessionStore(str(tmp_path / "a.db"))
    store.create_thread(thread_id="thr_a", title="t")
    t1 = store.start_turn("thr_a")
    store.append_item(t1.turn_id, UserMessageItem(content="q1"), thread_id="thr_a")
    store.end_turn(t1.turn_id)
    t2 = store.start_turn("thr_a")
    store.append_item(t2.turn_id, UserMessageItem(content="q2"), thread_id="thr_a")
    store.end_turn(t2.turn_id)

    deleted = store.revert_thread("thr_a", t2.turn_id)
    assert deleted == 1
    left = [t.turn_id for t in store.list_turns("thr_a")]
    assert left == [t1.turn_id]
    items = store.list_items("thr_a")
    assert len(items) == 1  # q2 的 item 已删


def test_store_revert_middle_turn_deletes_all_after(tmp_path):
    """revert 中间 turn:其后全部 turn 连带删除(codex 'ends immediately before')。"""
    store = SessionStore(str(tmp_path / "b.db"))
    store.create_thread(thread_id="thr_b", title="t")
    t1 = store.start_turn("thr_b")
    store.end_turn(t1.turn_id)
    t2 = store.start_turn("thr_b")
    store.end_turn(t2.turn_id)
    t3 = store.start_turn("thr_b")
    store.end_turn(t3.turn_id)

    deleted = store.revert_thread("thr_b", t2.turn_id)
    assert deleted == 2  # t2 + t3
    left = [t.turn_id for t in store.list_turns("thr_b")]
    assert left == [t1.turn_id]


def test_store_revert_error_paths(tmp_path):
    """revert_thread 异常路径:线程不存在 / turn 不存在 / turn 跨线程。"""
    store = SessionStore(str(tmp_path / "c.db"))
    store.create_thread(thread_id="thr_c", title="t")
    t = store.start_turn("thr_c")
    store.end_turn(t.turn_id)
    with pytest.raises(ThreadNotFoundError):
        store.revert_thread("thr_nope", t.turn_id)
    with pytest.raises(TurnNotFoundError):
        store.revert_thread("thr_c", "no-such-turn")
    store.create_thread(thread_id="thr_d", title="d")
    with pytest.raises(TurnMismatchError):
        store.revert_thread("thr_d", t.turn_id)


# =============================================================================
# 引擎层 thread/revert
# =============================================================================


async def test_engine_thread_revert_trims_messages(tmp_path):
    """engine thread/revert: 内存消息从被删 user 消息处整段截断,事件发出。"""
    engine, store = _engine_with_store(tmp_path)
    collector = _Collector()
    r = await _rpc(
        engine,
        "thread.start",
        {"model": "test"},
        emit=collector,
    )
    tid = r["threadId"]
    # 造两轮:直接操纵 store + 内存(不走 LLM run)
    u1 = store.start_turn(tid)
    store.append_item(u1.turn_id, UserMessageItem(content="q1"), thread_id=tid)
    store.end_turn(u1.turn_id)
    u2 = store.start_turn(tid)
    store.append_item(u2.turn_id, UserMessageItem(content="q2"), thread_id=tid)
    store.end_turn(u2.turn_id)

    thread = engine._threads[tid]
    thread.messages = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
    ]
    thread.turn_markers = {0: u1.turn_id, 2: u2.turn_id}

    r2 = await _rpc(
        engine, "thread.revert", {"threadId": tid, "beforeTurnId": u2.turn_id}, emit=collector
    )
    assert r2["deletedTurns"] == 1
    assert thread.messages == [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
    ]
    assert thread.turn_markers == {0: u1.turn_id}
    reverted = collector.payloads("thread.reverted")
    assert reverted and reverted[0]["deletedTurns"] == 1
    # store 层同步:只剩 turn1
    assert [t.turn_id for t in store.list_turns(tid)] == [u1.turn_id]


async def test_engine_thread_revert_running_rejected(tmp_path):
    """线程在跑时 revert 拒绝(THREAD_BUSY)。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    thread = engine._threads[tid]
    thread.status = "running"
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 9,
            "method": "thread.revert",
            "params": {"threadId": tid, "beforeTurnId": "x"},
        }
    )
    assert response is not None and response["error"]["code"] == THREAD_BUSY


async def test_engine_thread_revert_missing_params(tmp_path):
    """beforeTurnId 缺失 → INVALID_PARAMS;turn 不存在 → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    r1 = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "thread.revert",
            "params": {"threadId": tid},
        }
    )
    assert r1 is not None and r1["error"]["code"] == INVALID_PARAMS
    r2 = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "thread.revert",
            "params": {"threadId": tid, "beforeTurnId": "ghost"},
        }
    )
    assert r2 is not None and r2["error"]["code"] == INVALID_PARAMS


def test_engine_thread_fork_copies_turn_markers():
    """EngineThread 带 turn_markers 字段且为 dict(回退坐标随分叉保留)。"""
    import dataclasses

    names = {f.name for f in dataclasses.fields(EngineThread)}
    assert "turn_markers" in names
    assert EngineThread.__dataclass_fields__["turn_markers"].default_factory is dict
