# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""session_store 持久化引擎测试(≥35 个用例)。

覆盖:三级模型 CRUD、turn 状态机非法迁移拒绝、resume 配对修复(悬挂 tool_call)、
fork 前缀正确性、rollback 后历史重建、compact 边界回放、FTS5 搜索、
并发写(多线程)、幂等去重、migration 升级路径、WAL 崩溃恢复(关闭重开一致性)。
"""

from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any

import pytest

from app.services.session_store import (
    AgentMessageItem,
    ApprovalRequestItem,
    ApprovalResponseItem,
    CompactionBoundaryItem,
    DuplicateItemError,
    ErrorItem,
    FileEditItem,
    InvalidTurnTransitionError,
    LLMMessage,
    ReasoningItem,
    SessionStore,
    ThreadNotFoundError,
    ToolCallItem,
    ToolResultItem,
    TurnMismatchError,
    TurnNotFoundError,
    UserMessageItem,
)


@pytest.fixture()
def store(tmp_path: Path) -> SessionStore:
    """每个测试独立的临时数据库。"""
    db = tmp_path / "test_sessions.db"
    s = SessionStore(db)
    yield s
    s.close()


# ==================== 1-5: Thread CRUD ====================


def test_create_thread_basic(store: SessionStore) -> None:
    t = store.create_thread(title="hello")
    assert t.thread_id
    assert t.title == "hello"
    assert t.archived is False


def test_get_thread_returns_created(store: SessionStore) -> None:
    t = store.create_thread(title="t1", metadata={"k": "v"})
    got = store.get_thread(t.thread_id)
    assert got is not None
    assert got.title == "t1"
    assert got.metadata == {"k": "v"}


def test_get_thread_nonexistent(store: SessionStore) -> None:
    assert store.get_thread("nonexistent") is None


def test_list_threads_pagination(store: SessionStore) -> None:
    for i in range(5):
        store.create_thread(title=f"t{i}")
    page = store.list_threads(limit=2, offset=0)
    assert len(page.threads) == 2
    assert page.total == 5
    assert page.has_more is True
    page2 = store.list_threads(limit=2, offset=4)
    assert len(page2.threads) == 1
    assert page2.has_more is False


def test_list_threads_exclude_archived(store: SessionStore) -> None:
    t1 = store.create_thread(title="active")
    t2 = store.create_thread(title="archived")
    # 手动归档
    with store._tx() as conn:
        conn.execute(
            "UPDATE threads SET archived = 1 WHERE thread_id = ?", (t2.thread_id,)
        )
    page = store.list_threads(include_archived=False)
    assert page.total == 1
    assert page.threads[0].thread_id == t1.thread_id
    page_all = store.list_threads(include_archived=True)
    assert page_all.total == 2


# ==================== 6-10: Turn CRUD + 状态机 ====================


def test_start_turn_basic(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    assert turn.status == "running"
    assert turn.turn_seq == 1


def test_start_turn_nonexistent_thread(store: SessionStore) -> None:
    with pytest.raises(ThreadNotFoundError):
        store.start_turn("no_such_thread")


def test_end_turn_completed(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    ended = store.end_turn(turn.turn_id, status="completed")
    assert ended.status == "completed"
    assert ended.ended_at is not None


def test_end_turn_interrupted(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    ended = store.end_turn(turn.turn_id, status="interrupted")
    assert ended.status == "interrupted"


def test_end_turn_invalid_transition_rejected(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.end_turn(turn.turn_id, status="completed")
    with pytest.raises(InvalidTurnTransitionError):
        store.end_turn(turn.turn_id, status="running")


def test_end_turn_double_complete_rejected(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.end_turn(turn.turn_id, status="completed")
    with pytest.raises(InvalidTurnTransitionError):
        store.end_turn(turn.turn_id, status="completed")


def test_end_turn_nonexistent(store: SessionStore) -> None:
    with pytest.raises(TurnNotFoundError):
        store.end_turn("no_such_turn")


def test_list_turns_ordered(store: SessionStore) -> None:
    t = store.create_thread()
    t1 = store.start_turn(t.thread_id)
    t2 = store.start_turn(t.thread_id)
    store.end_turn(t1.turn_id)
    store.end_turn(t2.turn_id)
    turns = store.list_turns(t.thread_id)
    assert len(turns) == 2
    assert turns[0].turn_seq < turns[1].turn_seq


# ==================== 11-16: Item CRUD + 幂等去重 ====================


def test_append_item_basic(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    item = UserMessageItem(content="hello world")
    saved = store.append_item(turn.turn_id, item)
    assert saved.seq > 0
    assert saved.thread_id == t.thread_id
    assert saved.turn_id == turn.turn_id


def test_append_item_with_client_id_dedup(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    item = UserMessageItem(content="dedup test", client_item_id="cid-001")
    store.append_item(turn.turn_id, item)
    # 相同 client_item_id 应被拒绝
    with pytest.raises(DuplicateItemError):
        store.append_item(turn.turn_id, UserMessageItem(content="dup", client_item_id="cid-001"))


def test_append_item_different_client_ids_ok(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="a", client_item_id="c1"))
    store.append_item(turn.turn_id, UserMessageItem(content="b", client_item_id="c2"))
    items = store.list_items(t.thread_id)
    assert len(items) == 2


def test_append_item_content_hash(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    saved = store.append_item(turn.turn_id, UserMessageItem(content="hash me"))
    assert saved.seq > 0
    # 验证 content_hash 已写入
    with store._lock:
        row = store._conn.execute(
            "SELECT content_hash FROM items WHERE seq = ?", (saved.seq,)
        ).fetchone()
    assert row is not None
    assert row["content_hash"] is not None


def test_append_item_turn_mismatch(store: SessionStore) -> None:
    t1 = store.create_thread()
    t2 = store.create_thread()
    turn1 = store.start_turn(t1.thread_id)
    with pytest.raises(TurnMismatchError):
        store.append_item(turn1.turn_id, UserMessageItem(content="x"), thread_id=t2.thread_id)


def test_append_item_nonexistent_turn(store: SessionStore) -> None:
    with pytest.raises(TurnNotFoundError):
        store.append_item("no_turn", UserMessageItem(content="x"))


# ==================== 17-20: 多种 Item 类型 ====================


def test_tool_call_and_result_items(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    tc = ToolCallItem(call_id="call-1", tool="read_file", arguments={"path": "/tmp/x"})
    tr = ToolResultItem(call_id="call-1", ok=True, output="file contents")
    store.append_item(turn.turn_id, tc)
    store.append_item(turn.turn_id, tr)
    items = store.list_items(t.thread_id)
    assert len(items) == 2
    assert isinstance(items[0], ToolCallItem)
    assert isinstance(items[1], ToolResultItem)


def test_error_item(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    err = ErrorItem(message="something broke", code="E001")
    saved = store.append_item(turn.turn_id, err)
    assert isinstance(saved, ErrorItem)
    items = store.list_items(t.thread_id)
    assert isinstance(items[0], ErrorItem)
    assert items[0].search_text() == "something broke"


def test_reasoning_item(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    r = ReasoningItem(content="thinking...", summary="short")
    store.append_item(turn.turn_id, r)
    items = store.list_items(t.thread_id)
    assert items[0].search_text() == "short"


def test_approval_items(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    req = ApprovalRequestItem(request_id="r1", tool="rm", reason="dangerous")
    resp = ApprovalResponseItem(request_id="r1", approved=True)
    store.append_item(turn.turn_id, req)
    store.append_item(turn.turn_id, resp)
    items = store.list_items(t.thread_id)
    assert len(items) == 2


# ==================== 21-23: Resume + 配对修复 ====================


def test_resume_basic_messages(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="hi"))
    store.append_item(turn.turn_id, AgentMessageItem(content="hello"))
    store.end_turn(turn.turn_id)
    msgs = store.resume(t.thread_id)
    assert len(msgs) == 2
    assert msgs[0].role == "user"
    assert msgs[1].role == "assistant"


def test_resume_dangling_tool_call_repair(store: SessionStore) -> None:
    """中断的 tool_call 自动补 synthetic interrupted result。"""
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="do it"))
    store.append_item(
        turn.turn_id,
        ToolCallItem(call_id="dangling-1", tool="exec", arguments={}),
    )
    # 不追加 tool_result → 模拟中断
    store.end_turn(turn.turn_id, status="interrupted")
    msgs = store.resume(t.thread_id)
    # user + assistant(tool_call) + synthetic tool result
    tool_msgs = [m for m in msgs if m.role == "tool"]
    assert len(tool_msgs) == 1
    assert "interrupted" in tool_msgs[0].content.lower()
    assert tool_msgs[0].tool_call_id == "dangling-1"


def test_resume_paired_tool_call_no_synthetic(store: SessionStore) -> None:
    """配对的 tool_call/tool_result 不应补 synthetic。"""
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(
        turn.turn_id,
        ToolCallItem(call_id="paired-1", tool="ls", arguments={}),
    )
    store.append_item(
        turn.turn_id,
        ToolResultItem(call_id="paired-1", ok=True, output="ok"),
    )
    store.end_turn(turn.turn_id)
    msgs = store.resume(t.thread_id)
    tool_msgs = [m for m in msgs if m.role == "tool"]
    assert len(tool_msgs) == 1
    assert tool_msgs[0].content == "ok"


# ==================== 24-26: Fork ====================


def test_fork_copies_prefix(store: SessionStore) -> None:
    t = store.create_thread(title="original")
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="msg1"))
    store.append_item(turn.turn_id, AgentMessageItem(content="reply1"))
    last_item = store.append_item(turn.turn_id, UserMessageItem(content="msg2"))
    store.end_turn(turn.turn_id)
    forked = store.fork(t.thread_id, last_item.seq, title="branch")
    assert forked.parent_thread_id == t.thread_id
    assert forked.fork_point_seq == last_item.seq
    fork_items = store.list_items(forked.thread_id)
    assert len(fork_items) == 3  # msg1 + reply1 + msg2


def test_fork_independent_after_fork_point(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    first = store.append_item(turn.turn_id, UserMessageItem(content="shared"))
    store.append_item(turn.turn_id, AgentMessageItem(content="original only"))
    store.end_turn(turn.turn_id)
    forked = store.fork(t.thread_id, first.seq)
    # 在原 thread 继续追加
    turn2 = store.start_turn(t.thread_id)
    store.append_item(turn2.turn_id, UserMessageItem(content="original new"))
    # fork 不应看到原 thread 后续内容
    fork_items = store.list_items(forked.thread_id)
    assert len(fork_items) == 1
    assert fork_items[0].search_text() == "shared"


def test_fork_nonexistent_seq_raises(store: SessionStore) -> None:
    t = store.create_thread()
    with pytest.raises(ValueError):
        store.fork(t.thread_id, 99999)


# ==================== 27-29: Rollback ====================


def test_rollback_soft_delete(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="keep"))
    store.end_turn(turn.turn_id)
    turn2 = store.start_turn(t.thread_id)
    store.append_item(turn2.turn_id, UserMessageItem(content="remove"))
    store.end_turn(turn2.turn_id)
    ceiling = store.rollback(t.thread_id, turn.turn_id, reason="undo")
    assert ceiling > 0
    # rollback 后 list_items 只返回 ceiling 之前的
    items = store.list_items(t.thread_id)
    assert len(items) == 1
    assert items[0].search_text() == "keep"


def test_rollback_preserves_audit(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="x"))
    store.end_turn(turn.turn_id)
    store.rollback(t.thread_id, turn.turn_id, reason="test audit")
    # rollbacks 表有记录
    with store._lock:
        rows = store._conn.execute(
            "SELECT * FROM rollbacks WHERE thread_id = ?", (t.thread_id,)
        ).fetchall()
    assert len(rows) == 1
    assert rows[0]["reason"] == "test audit"


def test_rollback_nonexistent_turn(store: SessionStore) -> None:
    t = store.create_thread()
    with pytest.raises(TurnNotFoundError):
        store.rollback(t.thread_id, "no_turn")


# ==================== 30-31: Compact ====================


def test_compact_boundary_inserted(store: SessionStore) -> None:
    t = store.create_thread()
    boundary = CompactionBoundaryItem(
        summary="earlier context summarized",
        first_seq=1,
        tokens_before=1000,
        tokens_after=200,
    )
    result = store.compact(t.thread_id, boundary)
    assert isinstance(result, CompactionBoundaryItem)
    assert result.seq > 0


def test_resume_after_compact(store: SessionStore) -> None:
    t = store.create_thread()
    turn1 = store.start_turn(t.thread_id)
    store.append_item(turn1.turn_id, UserMessageItem(content="old msg"))
    store.end_turn(turn1.turn_id)
    # compact
    boundary = CompactionBoundaryItem(summary="summary of old", first_seq=1)
    store.compact(t.thread_id, boundary)
    # 新消息
    turn2 = store.start_turn(t.thread_id)
    store.append_item(turn2.turn_id, UserMessageItem(content="new msg"))
    store.end_turn(turn2.turn_id)
    msgs = store.resume(t.thread_id)
    # 应包含 summary + new msg,不含 old msg
    contents = [m.content for m in msgs]
    assert any("summary of old" in c for c in contents)
    assert "new msg" in contents
    assert "old msg" not in contents


# ==================== 32-33: FTS5 搜索 ====================


def test_fts_search_basic(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="Python async programming guide"))
    store.append_item(turn.turn_id, UserMessageItem(content="Java sync programming intro"))
    store.end_turn(turn.turn_id)
    hits = store.full_text_search("async")
    assert len(hits) >= 1
    assert hits[0].thread_id == t.thread_id


def test_fts_search_scoped_to_thread(store: SessionStore) -> None:
    t1 = store.create_thread()
    t2 = store.create_thread()
    turn1 = store.start_turn(t1.thread_id)
    turn2 = store.start_turn(t2.thread_id)
    store.append_item(turn1.turn_id, UserMessageItem(content="unique_alpha"))
    store.append_item(turn2.turn_id, UserMessageItem(content="unique_alpha"))
    hits = store.full_text_search("unique_alpha", thread_id=t1.thread_id)
    assert all(h.thread_id == t1.thread_id for h in hits)


# ==================== 34: 并发写(多线程) ====================


def test_concurrent_writes(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    errors: list[Exception] = []

    def writer(idx: int) -> None:
        try:
            for j in range(10):
                store.append_item(
                    turn.turn_id,
                    UserMessageItem(
                        content=f"msg-{idx}-{j}",
                        client_item_id=f"conc-{idx}-{j}",
                    ),
                )
        except Exception as e:
            errors.append(e)

    threads = [threading.Thread(target=writer, args=(i,)) for i in range(4)]
    for th in threads:
        th.start()
    for th in threads:
        th.join(timeout=30)
    assert not errors, f"并发写失败: {errors}"
    items = store.list_items(t.thread_id)
    assert len(items) == 40


# ==================== 35: Migration 升级路径 ====================


def test_migration_version_recorded(store: SessionStore) -> None:
    assert store.schema_version >= 1
    # FTS5 可用时应为 v2
    if store.fts_enabled:
        assert store.schema_version >= 2


def test_migration_idempotent(tmp_path: Path) -> None:
    """重复打开同一库不应报错(migration 幂等)。"""
    db = tmp_path / "migrate_test.db"
    s1 = SessionStore(db)
    v1 = s1.schema_version
    s1.close()
    s2 = SessionStore(db)
    assert s2.schema_version == v1
    s2.close()


# ==================== 36-37: WAL 崩溃恢复 ====================


def test_wal_close_reopen_consistency(tmp_path: Path) -> None:
    """关闭重开后数据一致(WAL checkpoint)。"""
    db = tmp_path / "wal_test.db"
    s1 = SessionStore(db)
    t = s1.create_thread(title="wal-test")
    turn = s1.start_turn(t.thread_id)
    s1.append_item(turn.turn_id, UserMessageItem(content="persist me"))
    s1.end_turn(turn.turn_id)
    s1.close()
    # 重开
    s2 = SessionStore(db)
    got = s2.get_thread(t.thread_id)
    assert got is not None
    assert got.title == "wal-test"
    items = s2.list_items(t.thread_id)
    assert len(items) == 1
    assert items[0].search_text() == "persist me"
    s2.close()


def test_wal_uncommitted_not_visible(tmp_path: Path) -> None:
    """未提交事务在重开后不可见。"""
    db = tmp_path / "wal_uncommit.db"
    s1 = SessionStore(db)
    t = s1.create_thread(title="safe")
    # 手动 BEGIN 但不 COMMIT(模拟崩溃)
    s1._conn.execute("BEGIN IMMEDIATE")
    s1._conn.execute(
        "INSERT INTO items (seq, thread_id, item_type, created_at, payload, search_text)"
        " VALUES (99999, ?, 'user_message', 0, '{}', '')",
        (t.thread_id,),
    )
    # 不调 COMMIT,直接 close(模拟 kill)
    s1._conn.close()
    # 重开
    s2 = SessionStore(db)
    items = s2.list_items(t.thread_id)
    # 未提交的 seq=99999 不应出现
    assert all(i.seq != 99999 for i in items)
    s2.close()


# ==================== 38: FileEditItem ====================


def test_file_edit_item(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    fe = FileEditItem(path="/src/main.py", op="update", before="old", after="new")
    store.append_item(turn.turn_id, fe)
    items = store.list_items(t.thread_id)
    assert isinstance(items[0], FileEditItem)
    assert items[0].search_text() == "/src/main.py"


# ==================== 39: list_items with kinds filter ====================


def test_list_items_kind_filter(store: SessionStore) -> None:
    t = store.create_thread()
    turn = store.start_turn(t.thread_id)
    store.append_item(turn.turn_id, UserMessageItem(content="u"))
    store.append_item(turn.turn_id, AgentMessageItem(content="a"))
    store.append_item(turn.turn_id, ErrorItem(message="e"))
    users = store.list_items(t.thread_id, kinds=["user_message"])
    assert len(users) == 1
    assert isinstance(users[0], UserMessageItem)
    errors = store.list_items(t.thread_id, kinds=["error"])
    assert len(errors) == 1


# ==================== 40: resume nonexistent thread ====================


def test_resume_nonexistent_thread(store: SessionStore) -> None:
    with pytest.raises(ThreadNotFoundError):
        store.resume("no_such_thread")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
