# -*- coding: utf-8 -*-
"""批 45 测试(自动生成,勿手改) — thread.name/thread.delete/queue 管理面。

生成器: .ihui-agent/tmp/gen_test_45.py
"""
from __future__ import annotations

import os
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.services.agent_engine import (
    AgentEngine,
    INVALID_PARAMS,
    THREAD_BUSY,
)
from app.services.session_store import SessionStore, UserMessageItem


class _FakeLoop:
    async def run(self, messages):  # pragma: no cover - 不跑到
        raise AssertionError("批45测试不应触发 LLM 运行")

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


def _engine_with_store(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "s45.db"))
    return AgentEngine(loop_factory=factory, store=store), store


# =============================================================================
# store 层:set_thread_name / delete_thread
# =============================================================================


def test_store_set_thread_name(tmp_path):
    """set_thread_name 写 title;不存在返回 False。"""
    store = SessionStore(str(tmp_path / "a.db"))
    store.create_thread(thread_id="thr_a", title="旧名")
    assert store.set_thread_name("thr_a", "新名") is True
    assert store.get_thread("thr_a").title == "新名"
    assert store.set_thread_name("thr_nope", "x") is False


def test_store_delete_thread_cascades(tmp_path):
    """delete_thread 级联删 items+turns+fork 子线程;不存在幂等返回 0。"""
    store = SessionStore(str(tmp_path / "b.db"))
    store.create_thread(thread_id="thr_root", title="root")
    t = store.start_turn("thr_root")
    store.append_item(t.turn_id, UserMessageItem(content="q"), thread_id="thr_root")
    store.end_turn(t.turn_id)
    store.create_thread(thread_id="thr_child", title="child", parent_thread_id="thr_root")

    assert store.delete_thread("thr_root") == 1
    assert store.get_thread("thr_root") is None
    assert store.get_thread("thr_child") is None  # 子线程级联
    assert store.list_turns("thr_root") == []
    assert store.list_items("thr_root") == []
    assert store.delete_thread("thr_root") == 0  # 幂等
    assert store.delete_thread("thr_nope") == 0


def test_store_delete_thread_keeps_unrelated(tmp_path):
    """delete_thread 不误删无关线程。"""
    store = SessionStore(str(tmp_path / "c.db"))
    store.create_thread(thread_id="thr_x", title="x")
    store.create_thread(thread_id="thr_y", title="y")
    store.delete_thread("thr_x")
    assert store.get_thread("thr_y") is not None


# =============================================================================
# 引擎层 thread.name
# =============================================================================


async def test_engine_thread_name_persists_and_emits(tmp_path):
    """thread/name: store 写 title + 内存生效 + thread.name.updated 事件。"""
    engine, store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))["threadId"]

    r = await _rpc(engine, "thread.name", {"threadId": tid, "name": " 我的研究 "}, emit=collector)
    assert r["name"] == "我的研究" and r["persisted"] is True
    assert store.get_thread(tid).title == "我的研究"
    updated = collector.payloads("thread.name.updated")
    assert updated and updated[0]["name"] == "我的研究"


async def test_engine_thread_name_validation(tmp_path):
    """thread/name: 空名/缺名 → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    for bad in ({}, {"name": ""}, {"name": "   "}):
        response = await engine.handle_message(
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "thread.name",
                "params": {"threadId": tid, **bad},
            }
        )
        assert response["error"]["code"] == INVALID_PARAMS, bad


async def test_engine_thread_name_pure_memory(tmp_path, monkeypatch):
    """无 store 线程改名:persisted=False 但事件照发(纯内存可改名)。"""
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")

    async def factory(spec, host_tools):
        return _FakeLoop()

    engine = AgentEngine(loop_factory=factory)  # PERSIST=off → 无持久化
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))["threadId"]
    r = await _rpc(engine, "thread.name", {"threadId": tid, "name": "mem"}, emit=collector)
    assert r["persisted"] is False
    assert collector.payloads("thread.name.updated")


# =============================================================================
# 引擎层 thread.delete
# =============================================================================


async def test_engine_thread_delete_persists_and_emits(tmp_path):
    """thread/delete: store 级联 + 内存摘除 + thread.deleted 事件。"""
    engine, store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))["threadId"]
    assert engine._threads[tid].status == "idle"

    r = await _rpc(engine, "thread.delete", {"threadId": tid}, emit=collector)
    assert r["deleted"] is True
    assert tid not in engine._threads  # 内存摘除
    deleted = collector.payloads("thread.deleted")
    assert deleted and deleted[0]["deleted"] is True


async def test_engine_thread_delete_running_rejected(tmp_path):
    """running 线程删除拒绝(THREAD_BUSY)。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    engine._threads[tid].status = "running"
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 9, "method": "thread.delete", "params": {"threadId": tid}}
    )
    assert response is not None and response["error"]["code"] == THREAD_BUSY


async def test_engine_thread_delete_unknown_idempotent(tmp_path):
    """不存在的线程删除:幂等返回 deleted=false,仍发事件。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    r = await _rpc(
        engine, "thread.delete", {"threadId": "thr_ghost"}, emit=collector
    )
    assert r["deleted"] is False
    assert collector.payloads("thread.deleted")


# =============================================================================
# 引擎层 queue 管理面
# =============================================================================


async def test_engine_queue_list_delete_reorder(tmp_path):
    """queue.list 分页 + delete 按 id + reorder 稳定排序,事件齐发。"""
    engine, _store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))["threadId"]

    q1 = (await _rpc(engine, "thread.enqueue", {"threadId": tid, "input": "一"}, emit=collector))
    q2 = (await _rpc(engine, "thread.enqueue", {"threadId": tid, "input": "二"}, emit=collector))
    q3 = (await _rpc(engine, "thread.enqueue", {"threadId": tid, "input": "三"}, emit=collector))
    ids = [q1["id"], q2["id"], q3["id"]]
    assert all(i.startswith("q_") for i in ids)

    # list 全量(注意:这些 rpc 不带 emit,不影响 collector 已收到的)
    lst = await _rpc(engine, "thread.queue.list", {"threadId": tid}, emit=collector)
    assert lst["total"] == 3 and [i["id"] for i in lst["items"]] == ids
    # list 分页
    page = await _rpc(
        engine, "thread.queue.list", {"threadId": tid, "offset": 1, "limit": 1}, emit=collector
    )
    assert [i["id"] for i in page["items"]] == [ids[1]] and page["hasMore"] is True

    # delete 中间项
    d = await _rpc(
        engine, "thread.queue.delete", {"threadId": tid, "queuedSubmissionId": ids[1]}, emit=collector
    )
    assert d["deleted"] is True
    d2 = await _rpc(
        engine, "thread.queue.delete", {"threadId": tid, "queuedSubmissionId": ids[1]}, emit=collector
    )
    assert d2["deleted"] is False  # 幂等(不发事件)

    # reorder:把三挪到一前面
    r = await _rpc(
        engine,
        "thread.queue.reorder",
        {"threadId": tid, "queuedSubmissionIds": [ids[2], ids[0]]},
        emit=collector,
    )
    assert r["order"] == [ids[2], ids[0]]
    # 事件齐:enqueued×3 + deleted×1 + reordered×1(幂等 delete 不发)
    names = [e for e, _ in collector.events]
    assert names.count("thread.queue") == 5
    actions = [
        p.get("action") for e, p in collector.events if e == "thread.queue"
    ]
    assert actions.count("enqueued") == 3 and "deleted" in actions and "reordered" in actions


async def test_engine_queue_delete_validation(tmp_path):
    """queue.delete 缺 queuedSubmissionId → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    response = await engine.handle_message(
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "thread.queue.delete",
            "params": {"threadId": tid},
        }
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS
