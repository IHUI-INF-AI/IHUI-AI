# -*- coding: utf-8 -*-
"""批 46 测试(只读查询面) — thread.search / thread.items.list /
thread.turns.list / thread.read。

自包含假件(直接复刻 test_engine_harness_lifecycle_45 的结构,不 import 该文件);
覆盖:search 命中+过滤+空 query 拒绝+store None 拒绝、items.list 全量+afterSeq、
turns.list、read 命中+不存在 THREAD_NOT_FOUND 等,共 18 个用例(≥8)。
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
    THREAD_NOT_FOUND,
)
from app.services.session_store import (
    AgentMessageItem,
    SessionStore,
    UserMessageItem,
)


class _FakeLoop:
    async def run(self, messages):  # pragma: no cover - 查询面不触发 LLM
        raise AssertionError("批46 查询面测试不应触发 LLM 运行")

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


async def _rpc_error(engine, method, params, req_id=1):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}
    )
    assert response is not None and "error" in response, response
    return response["error"]


class _Collector:
    def __init__(self):
        self.events: list[tuple[str, dict[str, Any]]] = []

    async def __call__(self, message):
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))


def _seed(store: SessionStore, thread_id: str, user_text: str, agent_text: str):
    """造一条完整 turn + user/agent items,供查询面读取。"""
    store.create_thread(thread_id=thread_id, title="测试线程")
    t = store.start_turn(thread_id)
    store.append_item(t.turn_id, UserMessageItem(content=user_text), thread_id=thread_id)
    store.append_item(t.turn_id, AgentMessageItem(content=agent_text), thread_id=thread_id)
    store.end_turn(t.turn_id)
    return t


def _engine_with_store(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "s46.db"))
    return AgentEngine(loop_factory=factory, store=store), store


def _engine_no_store():
    async def factory(spec, host_tools):
        return _FakeLoop()

    return AgentEngine(loop_factory=factory)  # 调用方须先 monkeypatch.setenv(PERSIST=off)


# =============================================================================
# thread.search
# =============================================================================


async def test_search_hit(tmp_path):
    """全文检索命中:返回 hits 且含 threadId/seq/snippet/itemType。"""
    engine, store = _engine_with_store(tmp_path)
    _seed(store, "thr_s1", "如何用 python 读取文件", "用 open() 即可")

    r = await _rpc(engine, "thread.search", {"query": "python"})
    assert r["query"] == "python"
    assert len(r["hits"]) >= 1
    hit = r["hits"][0]
    assert hit["threadId"] == "thr_s1"
    assert hit["seq"] >= 1
    assert "snippet" in hit
    assert "itemType" in hit
    assert "score" in hit


async def test_search_thread_filter(tmp_path):
    """threadId 过滤:命中只应落在该线程内。"""
    engine, store = _engine_with_store(tmp_path)
    _seed(store, "thr_s2", "rust 所有权机制", "move 语义")
    _seed(store, "thr_other", "python 语法糖", "f-string")

    r = await _rpc(engine, "thread.search", {"query": "python", "threadId": "thr_s2"})
    assert r["hits"] == []  # thr_s2 不含 python,被过滤


async def test_search_empty_query_rejected(tmp_path):
    """空 query → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    err = await _rpc_error(engine, "thread.search", {"query": "   "})
    assert err["code"] == INVALID_PARAMS


async def test_search_missing_query_rejected(tmp_path):
    """缺 query → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    err = await _rpc_error(engine, "thread.search", {})
    assert err["code"] == INVALID_PARAMS


async def test_search_no_store_rejected(tmp_path, monkeypatch):
    """未启用持久化 → 搜索需要持久化存储(INVALID_PARAMS)。"""
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    engine = _engine_no_store()
    err = await _rpc_error(engine, "thread.search", {"query": "x"})
    assert err["code"] == INVALID_PARAMS


# =============================================================================
# thread.items.list
# =============================================================================


async def test_items_list_full(tmp_path):
    """items.list 全量:返回 user_message + agent_message 两条。"""
    engine, store = _engine_with_store(tmp_path)
    _seed(store, "thr_i1", "问题一", "回答一")

    r = await _rpc(engine, "thread.items.list", {"threadId": "thr_i1"})
    assert r["threadId"] == "thr_i1"
    assert len(r["items"]) == 2
    types = {it["type"] for it in r["items"]}
    assert "user_message" in types and "agent_message" in types
    for it in r["items"]:
        assert "seq" in it and "threadId" in it and "turnId" in it and "content" in it


async def test_items_list_after_seq(tmp_path):
    """items.list afterSeq 游标:跳过首条,仅余其后者。"""
    engine, store = _engine_with_store(tmp_path)
    _seed(store, "thr_i2", "问题二", "回答二")
    full = await _rpc(engine, "thread.items.list", {"threadId": "thr_i2"})
    first_seq = full["items"][0]["seq"]
    after = await _rpc(
        engine, "thread.items.list", {"threadId": "thr_i2", "afterSeq": first_seq}
    )
    assert len(after["items"]) == 1
    assert after["items"][0]["seq"] > first_seq


async def test_items_list_limit(tmp_path):
    """items.list limit 截断。"""
    engine, store = _engine_with_store(tmp_path)
    store.create_thread(thread_id="thr_i3", title="限量线程")
    # 同线程开两轮,共 4 条 items
    t1 = store.start_turn("thr_i3")
    store.append_item(t1.turn_id, UserMessageItem(content="q1"), thread_id="thr_i3")
    store.append_item(t1.turn_id, AgentMessageItem(content="a1"), thread_id="thr_i3")
    store.end_turn(t1.turn_id)
    t2 = store.start_turn("thr_i3")
    store.append_item(t2.turn_id, UserMessageItem(content="q2"), thread_id="thr_i3")
    store.append_item(t2.turn_id, AgentMessageItem(content="a2"), thread_id="thr_i3")
    store.end_turn(t2.turn_id)

    r = await _rpc(engine, "thread.items.list", {"threadId": "thr_i3", "limit": 1})
    assert len(r["items"]) == 1


async def test_items_list_missing_thread_id_rejected(tmp_path):
    """items.list 缺 threadId → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    err = await _rpc_error(engine, "thread.items.list", {})
    assert err["code"] == INVALID_PARAMS


async def test_items_list_no_store_rejected(tmp_path, monkeypatch):
    """未启用持久化 → items.list 需要持久化存储(INVALID_PARAMS)。"""
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    engine = _engine_no_store()
    err = await _rpc_error(engine, "thread.items.list", {"threadId": "x"})
    assert err["code"] == INVALID_PARAMS


# =============================================================================
# thread.turns.list
# =============================================================================


async def test_turns_list(tmp_path):
    """turns.list:返回 completed turn,字段齐全。"""
    engine, store = _engine_with_store(tmp_path)
    _seed(store, "thr_t1", "q", "a")

    r = await _rpc(engine, "thread.turns.list", {"threadId": "thr_t1"})
    assert r["threadId"] == "thr_t1"
    assert len(r["turns"]) == 1
    turn = r["turns"][0]
    assert turn["status"] == "completed"
    assert "turnId" in turn and "startedAt" in turn and "turnSeq" in turn and "endedAt" in turn


async def test_turns_list_missing_thread_id_rejected(tmp_path):
    """turns.list 缺 threadId → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    err = await _rpc_error(engine, "thread.turns.list", {})
    assert err["code"] == INVALID_PARAMS


async def test_turns_list_no_store_rejected(tmp_path, monkeypatch):
    """未启用持久化 → turns.list 需要持久化存储(INVALID_PARAMS)。"""
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    engine = _engine_no_store()
    err = await _rpc_error(engine, "thread.turns.list", {"threadId": "x"})
    assert err["code"] == INVALID_PARAMS


# =============================================================================
# thread.read
# =============================================================================


async def test_read_hit_with_preview(tmp_path):
    """read 命中:返回元数据 + 首条 user 消息 preview。"""
    engine, store = _engine_with_store(tmp_path)
    _seed(store, "thr_r1", "帮我写一首诗", "明月几时有")

    r = await _rpc(engine, "thread.read", {"threadId": "thr_r1"})
    assert r["threadId"] == "thr_r1"
    assert r["title"] == "测试线程"
    assert r["itemCount"] == 2
    assert r["lastSeq"] is not None
    assert r["preview"] == "帮我写一首诗"
    assert "createdAt" in r and "updatedAt" in r and "metadata" in r


async def test_read_not_found(tmp_path):
    """read 不存在线程 → THREAD_NOT_FOUND。"""
    engine, _store = _engine_with_store(tmp_path)
    err = await _rpc_error(engine, "thread.read", {"threadId": "thr_ghost"})
    assert err["code"] == THREAD_NOT_FOUND


async def test_read_missing_thread_id_rejected(tmp_path):
    """read 缺 threadId → INVALID_PARAMS。"""
    engine, _store = _engine_with_store(tmp_path)
    err = await _rpc_error(engine, "thread.read", {})
    assert err["code"] == INVALID_PARAMS


async def test_read_no_store_rejected(tmp_path, monkeypatch):
    """未启用持久化 → read 需要持久化存储(INVALID_PARAMS)。"""
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")
    engine = _engine_no_store()
    err = await _rpc_error(engine, "thread.read", {"threadId": "x"})
    assert err["code"] == INVALID_PARAMS


# =============================================================================
# 批 47(主会话补):引擎侧 thread/metadata 薄封装
# =============================================================================


async def test_engine_thread_metadata_merge_and_persist(tmp_path):
    """thread/metadata merge: 内存+store 同步,patch None 删键,事件齐发。"""
    engine, store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))["threadId"]

    r1 = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"env": {"os": "win"}, "flag": 1}},
        emit=collector,
    )
    assert r1["metadata"] == {"env": {"os": "win"}, "flag": 1}
    r2 = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"env": {"arch": "x64"}, "flag": None}},
        emit=collector,
    )
    assert r2["metadata"] == {"env": {"os": "win", "arch": "x64"}}
    assert r2["persisted"] is True
    assert store.get_thread(tid).metadata == {"env": {"os": "win", "arch": "x64"}}
    updated = [p for e, p in collector.events if e == "thread.metadata.updated"]
    assert len(updated) == 2


async def test_engine_thread_metadata_replace_mode(tmp_path):
    """merge=False 整体替换;patch 非对象 → INVALID_PARAMS。"""
    engine, store = _engine_with_store(tmp_path)
    tid = (await _rpc(engine, "thread.start", {"model": "test"}))["threadId"]
    await _rpc(engine, "thread.metadata", {"threadId": tid, "patch": {"a": 1, "b": 2}})
    r = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"only": True}, "merge": False},
    )
    assert r["metadata"] == {"only": True}
    assert store.get_thread(tid).metadata == {"only": True}
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": 9, "method": "thread.metadata", "params": {"threadId": tid}}
    )
    assert response is not None and response["error"]["code"] == INVALID_PARAMS
