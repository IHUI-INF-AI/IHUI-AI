# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""session_store 持久化引擎测试(≥35 个用例)。

覆盖:三级模型 CRUD、turn 状态机非法迁移拒绝、resume 配对修复(悬挂 tool_call)、
fork 前缀正确性、rollback 后历史重建、compact 边界回放、FTS5 搜索、
并发写(多线程)、幂等去重、migration 升级路径、WAL 崩溃恢复(关闭重开一致性)。
"""

from __future__ import annotations

import re
import threading
import time
from pathlib import Path

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


# ==================== 41-43: 活动时钟单调性(G-821 Python 半边) ====================

# 库里已是"另一时刻"时,维护性写入不得把它压回本次读到的旧值。
_AHEAD_S = 3600.0


def _seed_updated_at(store: SessionStore, thread_id: str, value: float) -> None:
    """直写连接:绕过 store 的 max 闸门,造出并发另一方刚推进过时钟的前置。"""
    store._conn.execute(
        "UPDATE threads SET updated_at=? WHERE thread_id=?", (value, thread_id)
    )


def _read_updated_at(store: SessionStore, thread_id: str) -> float:
    row = store._conn.execute(
        "SELECT updated_at FROM threads WHERE thread_id=?", (thread_id,)
    ).fetchone()
    assert row is not None
    return float(row["updated_at"])


def _assert_clock_held(
    store: SessionStore, thread_id: str, ahead: float, label: str
) -> None:
    assert _read_updated_at(store, thread_id) == ahead, f"{label} 把时钟压回了过去"


def test_thread_updated_at_never_regresses_when_clock_is_stale(
    store: SessionStore,
) -> None:
    """核心一条:用比库里现值更旧的时刻去更新 ⇒ updated_at 不得倒退。"""
    t = store.create_thread(title="t")
    ahead = time.time() + _AHEAD_S
    _seed_updated_at(store, t.thread_id, ahead)

    turn = store.start_turn(t.thread_id)
    _assert_clock_held(store, t.thread_id, ahead, "start_turn")
    store.append_item(turn.turn_id, UserMessageItem(content="u"))
    _assert_clock_held(store, t.thread_id, ahead, "append_item")
    store.end_turn(turn.turn_id)
    _assert_clock_held(store, t.thread_id, ahead, "end_turn")
    store.set_thread_name(t.thread_id, "renamed")
    _assert_clock_held(store, t.thread_id, ahead, "set_thread_name")
    store.update_thread_metadata(t.thread_id, {"k": "v"})
    _assert_clock_held(store, t.thread_id, ahead, "update_thread_metadata")
    store.set_thread_goal_state(t.thread_id, {"phase": "active"})
    _assert_clock_held(store, t.thread_id, ahead, "set_thread_goal_state")
    store.set_thread_archived(t.thread_id, True)
    _assert_clock_held(store, t.thread_id, ahead, "set_thread_archived")
    store.revert_thread(t.thread_id, turn.turn_id)
    _assert_clock_held(store, t.thread_id, ahead, "revert_thread")


def test_thread_updated_at_still_advances_on_normal_write(store: SessionStore) -> None:
    """正向对照:库里是较旧时刻时,时钟照常被推进(证明闸门没把功能改坏)。"""
    t = store.create_thread(title="t")
    past = time.time() - _AHEAD_S
    _seed_updated_at(store, t.thread_id, past)

    assert store.set_thread_name(t.thread_id, "renamed") is True

    advanced = _read_updated_at(store, t.thread_id)
    assert advanced > past
    assert abs(advanced - time.time()) < 60.0


def _write_shape(sql: str) -> str:
    """语句形态骨架。trace 回调会把绑定参数展开进文本,故先归一化字面量再比。"""
    s = re.sub(r"'[^']*'", "'?'", sql)
    s = re.sub(r"-?\d+(?:\.\d+)?", "?", s)
    return s.split(" WHERE")[0]


def test_all_thread_updated_at_writes_use_monotonic_max(store: SessionStore) -> None:
    """SQL 形状断言:每条 threads.updated_at 写入都必须在语句里取 max。"""
    captured: list[str] = []
    store._conn.set_trace_callback(captured.append)
    try:
        t = store.create_thread(title="t")
        # revert 必须早于 fork:fork 按原 turn_id 复制 items,之后再删 turns 会触发 FK。
        turn1 = store.start_turn(t.thread_id)
        store.append_item(turn1.turn_id, UserMessageItem(content="u1"))
        store.end_turn(turn1.turn_id)
        store.revert_thread(t.thread_id, turn1.turn_id)

        turn2 = store.start_turn(t.thread_id)
        item2 = store.append_item(turn2.turn_id, UserMessageItem(content="u2"))
        store.end_turn(turn2.turn_id)
        store.fork(t.thread_id, item2.seq)

        store.set_thread_archived(t.thread_id, True)
        store.set_thread_name(t.thread_id, "renamed")
        store.set_thread_goal_state(t.thread_id, {"phase": "active"})
        store.update_thread_metadata(t.thread_id, {"k": "v"})
    finally:
        store._conn.set_trace_callback(None)

    writes = [s for s in captured if "UPDATE threads SET" in s and "updated_at" in s]
    assert writes, "未捕获到任何 threads.updated_at 写入,判据在空转"
    bare = [s for s in writes if "max(updated_at" not in s]
    assert not bare, f"这些写入未取 max,会把并发新时刻压回过去: {bare}"
    shapes = {_write_shape(s) for s in writes}
    assert len(shapes) == 4, f"应覆盖 4 种 SET 形态(archived/title/metadata/裸时钟),实得 {shapes}"
    assert len(writes) == 12, f"9 个写入点应共触发 12 条语句,实得 {len(writes)}"

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
