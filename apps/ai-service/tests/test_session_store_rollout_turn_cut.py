# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""rollback 按「已完结回合」截断的接线取证(2026-11-02 立)。

`thread_rollout_truncation.truncate_rollout_after_turn_id`(及 before/n-fork 兄弟)
自 2026-09-19 落地后零调用方,而同模块的 `fork_turn_positions_in_rollout` 早已接在
`session_store._align_fork_boundary` 上。这一半缺口落在 rewind 侧:`SessionStore.rollback`
只按 `MAX(seq) WHERE turn_id = ?` 算截断上界,该 turn 名下**一条 item 都没有**时算出
NULL ⇒ 旧实现落 0,而 `_get_rollback_ceiling` 取的是 `MIN(to_seq)`,于是"回滚到一个空回合"
把**整段历史**抹成不可见(编辑重发的常见形态:开了回合还没落 item)。

现把同一件事交给那份既有截断算法判一遍,两口径按"取更保守的一侧"合流:
① 都判得出且一致 ⇒ 与现状逐零差异;
② 投影判不出(回合进行中 / 非规范边界)⇒ 回落 SQL,不拿 0 冒充算出来了;
③ SQL 判不出(该回合无 item)⇒ 由投影补上真实边界(本票修的洞);
④ 两边都判不出 ⇒ 维持现状 0。

隔离:sqlite 走 tmp_path,不连 PG(8810)/Redis(8811);同一用例跑两次同结果。
"""

from __future__ import annotations

import pytest

from app.services.session_store import (
    SessionStore,
    ThreadNotFoundError,
    TurnNotFoundError,
    UserMessageItem,
)


@pytest.fixture()
def store(tmp_path) -> SessionStore:
    s = SessionStore(db_path=tmp_path / "sessions.db")
    yield s
    s.close()


def _turn_with_item(
    store: SessionStore, thread_id: str, text: str, *, finish: str | None = "completed"
) -> tuple[str, int]:
    turn = store.start_turn(thread_id)
    item = store.append_item(turn.turn_id, UserMessageItem(content=text))
    if finish is not None:
        store.end_turn(turn.turn_id, status=finish)
    assert item.seq is not None
    return turn.turn_id, int(item.seq)


# ---------------------------------------------------------------------------
# ① 两口径一致:与现状逐零差异
# ---------------------------------------------------------------------------


def test_rollback_agrees_with_sql_max_seq(store: SessionStore) -> None:
    thread = store.create_thread(title="t")
    turn1, seq1 = _turn_with_item(store, thread.thread_id, "keep")
    _turn_with_item(store, thread.thread_id, "drop")

    assert store.rollback(thread.thread_id, turn1, reason="undo") == seq1
    items = store.list_items(thread.thread_id)
    assert [i.search_text() for i in items] == ["keep"]
    # 跑两次同结果(同 tid 再回一次仍是同一上界,不随调用次数漂)
    assert store.rollback(thread.thread_id, turn1, reason="undo again") == seq1


# ---------------------------------------------------------------------------
# ③ 本票修的洞:目标回合已完结但没有 item ⇒ 旧实现落 0 抹掉整段历史
# ---------------------------------------------------------------------------


def test_rollback_to_empty_completed_turn_keeps_history(
    store: SessionStore,
) -> None:
    thread = store.create_thread(title="t")
    turn1, seq1 = _turn_with_item(store, thread.thread_id, "keep")
    empty_turn = store.start_turn(thread.thread_id)
    store.end_turn(empty_turn.turn_id, status="completed")

    # 现状口径(SQL)在这里判不出:该 turn 名下 MAX(seq) 为 NULL
    ceiling = store.rollback(thread.thread_id, empty_turn.turn_id, reason="edit-resend")
    assert ceiling == seq1, (
        "回滚到空的已完结回合应停在上一条 item,而不是 0(0 会经 MIN(to_seq) 抹掉整段历史)"
    )
    assert ceiling != 0
    items = store.list_items(thread.thread_id)
    assert [i.search_text() for i in items] == ["keep"], "回滚后历史必须仍可回放"
    # turn1 自身的回滚上界不受影响(两次调用同结果)
    assert store.rollback(thread.thread_id, turn1, reason="again") == seq1


# ---------------------------------------------------------------------------
# ② 投影判不出 ⇒ 回落 SQL(不拿 0 冒充"算出来是 0")
# ---------------------------------------------------------------------------


def test_rollback_falls_back_when_turn_still_running(store: SessionStore) -> None:
    thread = store.create_thread(title="t")
    _turn_with_item(store, thread.thread_id, "keep")
    running_turn, running_seq = _turn_with_item(store, thread.thread_id, "wip", finish=None)

    # running 回合没有终态事件 ⇒ 上游按"进行中"抛 ValueError ⇒ 回落 SQL 口径
    assert store.rollback(thread.thread_id, running_turn, reason="undo wip") == running_seq


def test_rollback_both_sources_unjudgeable_keeps_legacy_zero(store: SessionStore) -> None:
    thread = store.create_thread(title="t")
    _turn_with_item(store, thread.thread_id, "keep")
    empty_running = store.start_turn(thread.thread_id)

    # SQL 判不出(NULL)+ 投影判不出(进行中)⇒ 维持现状 0,并如实落一条 rollback 记录
    assert store.rollback(thread.thread_id, empty_running.turn_id) == 0


# ---------------------------------------------------------------------------
# 既有报错语义不得被接线改变
# ---------------------------------------------------------------------------


def test_rollback_unknown_thread_and_turn_still_raise(store: SessionStore) -> None:
    thread = store.create_thread(title="t")
    turn, _seq = _turn_with_item(store, thread.thread_id, "x")

    with pytest.raises(ThreadNotFoundError):
        store.rollback("nope", turn)
    with pytest.raises(TurnNotFoundError):
        store.rollback(thread.thread_id, "no-turn")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
