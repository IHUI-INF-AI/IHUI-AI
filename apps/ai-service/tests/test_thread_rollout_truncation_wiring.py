# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`truncate_rollout_after_turn_id` 的接线锁(2026-11-02 立)。

同模块的 `fork_turn_positions_in_rollout` 早已接在 `session_store._align_fork_boundary`,
而按回合截断那一半(`truncate_rollout_after_turn_id`)一直零调用方。本文件不重复算式,
只钉三件事:

① `SessionStore.rollback` 每次调用都**真的**问到那份算法(间谍计数 + 入参含目标 turn_id);
② 那个数确实**来自**这份算法:把它换成"判不出"(抛 ValueError),退化行为立刻回到旧口径
   (落 0)⇒ 说明 ③ 的空回合上界不是 session_store 自己另算的;
③ 判据单源:`app/core/thread_rollout_truncation.py` 里那几个截断出口不得被 session_store
   复制出第二份(形状锁:session_store 的投影只做投影,截断动作只经那份算法)。

隔离:sqlite 走 tmp_path,不连 PG/Redis。
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

import pytest

from app.core import thread_rollout_truncation as trt
from app.services import session_store as ss
from app.services.session_store import SessionStore, UserMessageItem

_SESSION_STORE_PY = Path(ss.__file__).resolve()


@pytest.fixture()
def store(tmp_path) -> SessionStore:
    s = SessionStore(db_path=tmp_path / "sessions.db")
    yield s
    s.close()


def _seed_two_turns(store: SessionStore) -> tuple[str, list[str], list[int]]:
    thread = store.create_thread(title="t")
    turn_ids: list[str] = []
    seqs: list[int] = []
    for text in ("keep", "drop"):
        turn = store.start_turn(thread.thread_id)
        item = store.append_item(turn.turn_id, UserMessageItem(content=text))
        store.end_turn(turn.turn_id, status="completed")
        turn_ids.append(turn.turn_id)
        seqs.append(int(item.seq or 0))
    return thread.thread_id, turn_ids, seqs


@pytest.fixture
def spy_outlet(monkeypatch):
    """包住真实截断出口并记录调用(判据仍是那份算法本体,测试不复制)。"""
    calls: list[tuple[int, str]] = []
    real = trt.truncate_rollout_after_turn_id

    def _spy(items: list[dict[str, Any]], last_turn_id: str) -> list[dict[str, Any]]:
        calls.append((len(items), last_turn_id))
        return real(items, last_turn_id)

    monkeypatch.setattr(trt, "truncate_rollout_after_turn_id", _spy)
    return calls


def test_rollback_asks_the_shared_truncation_outlet(store, spy_outlet) -> None:
    """① 普通回滚(两口径一致)也必须真的走过那份算法,而不是只在洞上才被调到。"""
    thread_id, turn_ids, seqs = _seed_two_turns(store)

    assert store.rollback(thread_id, turn_ids[0]) == seqs[0]
    assert spy_outlet, "rollback 未调用 truncate_rollout_after_turn_id ⇒ 接线又断了"
    _projected_len, asked_turn = spy_outlet[-1]
    assert asked_turn == turn_ids[0], "问的必须是目标回合,而不是随便某个 turn_id"


def test_empty_turn_ceiling_comes_from_the_outlet(store, monkeypatch) -> None:
    """②③ 空回合的上界是那份算法给的:把它换成"判不出",就退回旧口径 0。"""
    real = trt.truncate_rollout_after_turn_id

    def _refuse(items: list[dict[str, Any]], last_turn_id: str) -> list[dict[str, Any]]:
        raise ValueError("判不出(测试注入)")

    thread = store.create_thread(title="t")
    turn1 = store.start_turn(thread.thread_id)
    first = store.append_item(turn1.turn_id, UserMessageItem(content="keep"))
    store.end_turn(turn1.turn_id, status="completed")
    empty_turn = store.start_turn(thread.thread_id)
    store.end_turn(empty_turn.turn_id, status="completed")

    monkeypatch.setattr(trt, "truncate_rollout_after_turn_id", _refuse)
    assert store.rollback(thread.thread_id, empty_turn.turn_id) == 0, (
        "出口判不出时须回落旧口径,不得由 session_store 自己另算一个数"
    )

    # 正向对照:同一条数据、同一个目标回合,把出口换回真身 ⇒ 由它给出上一条 item 的 seq
    monkeypatch.setattr(trt, "truncate_rollout_after_turn_id", real)
    assert store.rollback(thread.thread_id, empty_turn.turn_id) == int(first.seq or 0)


def test_projection_does_not_reimplement_truncation() -> None:
    """形状锁:接线点只做投影 + seq 回映射,截断动作交回那份算法。"""
    tree = ast.parse(_SESSION_STORE_PY.read_text(encoding="utf-8"))
    holder = next(
        (
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.FunctionDef) and n.name == "_rollout_cut_seq_for_turn"
        ),
        None,
    )
    assert holder is not None, "session_store 必须保留 _rollout_cut_seq_for_turn 这一接线点"

    called: set[str] = set()
    for node in ast.walk(holder):
        if not isinstance(node, ast.Call):
            continue
        if isinstance(node.func, ast.Name):
            called.add(node.func.id)
        elif isinstance(node.func, ast.Attribute):
            called.add(node.func.attr)
    assert "truncate_rollout_after_turn_id" in called, (
        f"截断动作必须交回 thread_rollout_truncation,实际调用:{sorted(called)}"
    )
    # 投影沿用既有那一份,不在这里另写第二套 item→rollout 形态转换
    assert "_project_item_for_boundary" in called, (
        f"投影必须复用 _project_item_for_boundary,实际调用:{sorted(called)}"
    )
    # 除 seq 回映射外不得再出现按索引切片的"自己算一版截断"
    slicings = [
        s for s in ast.walk(holder) if isinstance(s, ast.Subscript) and isinstance(s.slice, ast.Slice)
    ]
    assert len(slicings) == 1, "只允许 `seq_by_index[: len(kept)]` 这一处回映射切片"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
