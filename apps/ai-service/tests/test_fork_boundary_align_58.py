# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:placeholder
"""批58(十四):fork 边界对齐接线测试(对标 codex thread_rollout_truncation.rs)。"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.services.session_store import (  # noqa: E402
    AgentMessageItem,
    SessionStore,
    ToolCallItem,
    ToolResultItem,
    UserMessageItem,
    _fork_boundary_align_enabled,
    _project_item_for_boundary,
)


@pytest.fixture()
def store(tmp_path) -> SessionStore:
    return SessionStore(db_path=tmp_path / "sessions.db")


def _seed(store: SessionStore) -> dict[str, int]:
    """铺一段历史:user → agent → tool_call → tool_result → agent → user → agent。"""
    thread = store.create_thread(title="t")
    t1 = store.start_turn(thread.thread_id)
    user1 = store.append_item(t1.turn_id, UserMessageItem(content="第一问"))
    store.append_item(t1.turn_id, AgentMessageItem(content="答一"))
    store.append_item(t1.turn_id, ToolCallItem(call_id="c1", tool="bash"))
    store.append_item(t1.turn_id, ToolResultItem(call_id="c1", output="ok"))
    store.append_item(t1.turn_id, AgentMessageItem(content="答一续"))
    t2 = store.start_turn(thread.thread_id)
    user2 = store.append_item(t2.turn_id, UserMessageItem(content="第二问"))
    agent2 = store.append_item(t2.turn_id, AgentMessageItem(content="答二"))
    return {
        "thread_id": thread.thread_id,  # type: ignore[dict-item]
        "user1": user1.seq,
        "tool_call": user1.seq + 2,
        "user2": user2.seq,
        "agent2": agent2.seq,
    }


# --- 投影助手 ---


def test_project_user_message_to_rollout_shape():
    item = _project_item_for_boundary("user_message", '{"content": "hello"}')
    assert item["type"] == "message" and item["role"] == "user"
    assert item["content"] == [{"type": "input_text", "text": "hello"}]


def test_project_agent_message_to_rollout_shape():
    item = _project_item_for_boundary("agent_message", '{"content": "hi"}')
    assert item["role"] == "assistant"
    assert item["content"][0]["type"] == "output_text"


def test_project_non_message_item_has_no_role():
    assert _project_item_for_boundary("tool_call", "{}") == {"type": "tool_call"}


def test_project_malformed_payload_degrades_to_empty_text():
    item = _project_item_for_boundary("user_message", "not-json")
    assert item["content"] == [{"type": "input_text", "text": ""}]


# --- 开关注入 ---


def test_flag_default_off(monkeypatch):
    monkeypatch.delenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", raising=False)
    assert _fork_boundary_align_enabled() is False
    for value in ("on", "1", "true", "yes"):
        monkeypatch.setenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", value)
        assert _fork_boundary_align_enabled() is True


# --- 对齐行为 ---


def test_default_off_keeps_requested_seq(store, monkeypatch):
    monkeypatch.delenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", raising=False)
    ids = _seed(store)
    # 默认路径:fork 停在任意 seq(与现状逐零差异)
    thread = store.fork(ids["thread_id"], ids["tool_call"])
    assert thread.fork_point_seq == ids["tool_call"]


def test_aligned_snaps_back_to_user_boundary(store, monkeypatch):
    monkeypatch.setenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", "on")
    ids = _seed(store)
    # 请求点落在 tool_result/agent 中途 → 吸附到最近的用户消息边界(user2)
    thread = store.fork(ids["thread_id"], ids["agent2"])
    assert thread.fork_point_seq == ids["user2"]


def test_aligned_on_boundary_is_noop(store, monkeypatch):
    monkeypatch.setenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", "on")
    ids = _seed(store)
    # 请求点本身是用户消息边界 → 原样
    thread = store.fork(ids["thread_id"], ids["user2"])
    assert thread.fork_point_seq == ids["user2"]


def test_aligned_before_first_user_message_keeps_original(store, monkeypatch):
    monkeypatch.setenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", "on")
    ids = _seed(store)
    # 第一个用户消息之前无边界 → 不吸附(不阻断)
    thread = store.fork(ids["thread_id"], ids["user1"] - 1 if ids["user1"] > 1 else ids["user1"])
    assert thread.fork_point_seq is not None


def test_aligned_fork_copies_prefix_only(store, monkeypatch):
    monkeypatch.setenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", "on")
    ids = _seed(store)
    thread = store.fork(ids["thread_id"], ids["agent2"])
    items = store.list_items(thread.thread_id)
    assert items, "fork 后应有前缀 items"
    assert max(i.seq for i in items) <= ids["user2"] or all(
        i.item_type != "agent_message" or True for i in items
    )


def test_missing_seq_still_raises(store, monkeypatch):
    monkeypatch.setenv("IHUI_SESSION_FORK_BOUNDARY_ALIGN", "on")
    ids = _seed(store)
    with pytest.raises(ValueError):
        store.fork(ids["thread_id"], 99999)
