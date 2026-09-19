# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core rollout 截断/分叉测试 — 第三十二批(对标 Codex thread_rollout_truncation.rs)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.thread_rollout_truncation import (
    user_message_positions_in_rollout,
    truncate_rollout_before_nth_user_message_from_start,
    fork_turn_positions_in_rollout,
    truncate_rollout_after_turn_id,
    truncate_rollout_before_turn_id,
    truncate_rollout_to_last_n_fork_turns,
    snapshot_turn_state,
    truncate_before_nth_user_message,
    append_interrupted_boundary,
    fork_history_from_snapshot,
    is_user_turn_boundary,
    SnapshotTurnState,
)


def ri(item):  # response_item 包装
    return {"type": "response_item", "item": item}


def ev(etype, **kw):  # event_msg 包装
    return {"type": "event_msg", "event": {"type": etype, **kw}}


def user_msg(text="hi"):
    return ri({"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]})


def asst_msg(text="done"):
    return ri({"type": "message", "role": "assistant", "content": [{"type": "output_text", "text": text}]})


def ctx_user_msg(text="<context_window>env info"):
    # USER_CONTEXTUAL_PREFIXES 表内前缀开头 = 上下文片段,非用户回合边界
    return ri({"type": "message", "role": "user", "content": [{"type": "input_text", "text": text}]})


def turn_started(tid, started_at=100):
    return ev("turn_started", turn_id=tid, started_at=started_at)


def turn_completed(tid):
    return ev("turn_completed", turn_id=tid)


def rolled_back(n):
    return ev("thread_rolled_back", num_turns=n)


# ---------- user_message_positions_in_rollout ----------

def test_positions_basic():
    items = [user_msg("a"), asst_msg("b"), user_msg("c")]
    assert user_message_positions_in_rollout(items) == [0, 2]

def test_positions_skip_contextual():
    items = [ctx_user_msg(), user_msg("real")]
    assert user_message_positions_in_rollout(items) == [1]

def test_positions_rollback_truncates_tail():
    items = [user_msg("a"), user_msg("b"), rolled_back(1), user_msg("c")]
    # b 被回滚,有效边界 = a(0), c(3)
    assert user_message_positions_in_rollout(items) == [0, 3]

def test_positions_rollback_more_than_existing():
    items = [user_msg("a"), rolled_back(5), user_msg("b")]
    assert user_message_positions_in_rollout(items) == [2]


# ---------- truncate_rollout_before_nth_user_message_from_start ----------

def test_truncate_nth_from_start_cut():
    items = [user_msg("a"), asst_msg("x"), user_msg("b"), asst_msg("y")]
    out = truncate_rollout_before_nth_user_message_from_start(items, 1)
    assert out == items[:2]  # 严格在第 1(0-based)个用户消息前截

def test_truncate_nth_from_start_zero_excludes_first():
    items = [user_msg("a"), user_msg("b")]
    assert truncate_rollout_before_nth_user_message_from_start(items, 0) == []

def test_truncate_nth_from_start_noop_when_fewer():
    items = [user_msg("a"), asst_msg("x")]
    out = truncate_rollout_before_nth_user_message_from_start(items, 3)
    assert out == items

def test_truncate_nth_from_start_noop_negative():
    items = [user_msg("a")]
    assert truncate_rollout_before_nth_user_message_from_start(items, -1) == items


# ---------- fork_turn_positions_in_rollout ----------

def test_fork_positions_user_and_trigger():
    trigger = ri({"type": "message", "role": "assistant",
                  "content": [{"type": "output_text", "text": '{"trigger_turn": true}'}]})
    items = [user_msg("a"), trigger, asst_msg("x")]
    assert fork_turn_positions_in_rollout(items) == [0, 1]

def test_fork_positions_rollback_removes_from_earliest_boundary():
    trigger = ri({"type": "message", "role": "assistant",
                  "content": [{"type": "output_text", "text": '{"trigger_turn": true}'}]})
    items = [user_msg("a"), trigger, asst_msg("x"), user_msg("b"), rolled_back(2)]
    # 回滚 2 个指令回合 = 最后两个边界(trigger@1 + user b@3)被剔除;user a@0 保留
    assert fork_turn_positions_in_rollout(items) == [0]

def test_fork_positions_metadata_envelope():
    items = [
        {"type": "inter_agent_communication_metadata", "trigger_turn": True},
        user_msg("a"),
    ]
    assert fork_turn_positions_in_rollout(items) == [0, 1]

def test_fork_positions_agent_message_boundary_and_metadata_suppress():
    items = [ri({"type": "agent_message", "content": []}), user_msg("a")]
    # agent_message 是 user-turn boundary 也入 fork? Codex: 真实用户消息或 trigger;agent_message
    # 本身不是 fork boundary,但其 idx 进 rollback_positions
    assert fork_turn_positions_in_rollout(items) == [1]


# ---------- truncate_rollout_after_turn_id / before_turn_id ----------

def _sample_turns():
    return [
        turn_started("t1"), user_msg("a"), asst_msg("x"), turn_completed("t1"),
        turn_started("t2"), user_msg("b"), turn_completed("t2"),
        turn_started("t3"), user_msg("c"),
    ]

def test_after_turn_id_cuts_before_next_started():
    out = truncate_rollout_after_turn_id(_sample_turns(), "t1")
    assert len(out) == 4 and out[-1] == turn_completed("t1")

def test_after_turn_id_last_turn_keeps_to_end():
    items = _sample_turns() + [turn_completed("t3")]
    out = truncate_rollout_after_turn_id(items, "t3")
    assert out == items

def test_after_turn_id_rejects_in_progress():
    with pytest.raises(ValueError, match="in-progress"):
        truncate_rollout_after_turn_id(_sample_turns(), "t3")

def test_after_turn_id_rejects_unknown():
    with pytest.raises(ValueError, match="canonical"):
        truncate_rollout_after_turn_id(_sample_turns(), "nope")

def test_before_turn_id_cuts_at_started():
    out = truncate_rollout_before_turn_id(_sample_turns(), "t2")
    assert len(out) == 4

def test_before_turn_id_rejects_unknown():
    with pytest.raises(ValueError, match="not found"):
        truncate_rollout_before_turn_id(_sample_turns(), "nope")


# ---------- truncate_rollout_to_last_n_fork_turns ----------

def test_last_n_fork_turns_suffix():
    items = [user_msg("a"), asst_msg("x"), user_msg("b"), asst_msg("y"), user_msg("c")]
    out = truncate_rollout_to_last_n_fork_turns(items, 2)
    assert out == items[2:]

def test_last_n_fork_turns_more_than_existing_keeps_from_first():
    items = [ctx_user_msg(), user_msg("a"), user_msg("b")]
    out = truncate_rollout_to_last_n_fork_turns(items, 5)
    assert out == items[1:]

def test_last_n_fork_turns_zero_empty():
    assert truncate_rollout_to_last_n_fork_turns([user_msg("a")], 0) == []

def test_last_n_fork_turns_no_boundaries_empty():
    assert truncate_rollout_to_last_n_fork_turns([ctx_user_msg(), asst_msg("x")], 2) == []


# ---------- snapshot_turn_state / truncate_before_nth_user_message ----------

def test_snapshot_explicit_active_turn():
    items = [turn_started("t1"), user_msg("a"), asst_msg("x")]
    st = snapshot_turn_state({"kind": "resumed", "items": items})
    assert st.ends_mid_turn is True and st.active_turn_id == "t1" and st.active_turn_start_index == 0

def test_snapshot_completed_turn_not_mid():
    items = [turn_started("t1"), user_msg("a"), turn_completed("t1")]
    st = snapshot_turn_state({"kind": "resumed", "items": items})
    assert st.ends_mid_turn is False and st.active_turn_id is None

def test_snapshot_implicit_mid_turn_after_last_user():
    items = [user_msg("a"), asst_msg("x")]  # 无终结事件
    st = snapshot_turn_state({"kind": "resumed", "items": items})
    assert st.ends_mid_turn is True and st.active_turn_id is None

def test_snapshot_terminated_after_last_user():
    items = [user_msg("a"), asst_msg("x"), turn_completed("t1")]
    st = snapshot_turn_state({"kind": "resumed", "items": items})
    assert st.ends_mid_turn is False

def test_snapshot_empty_history():
    st = snapshot_turn_state({"kind": "new"})
    assert st.ends_mid_turn is False

def test_truncate_before_nth_mid_turn_uses_active_start():
    items = [turn_started("t1"), user_msg("a"), asst_msg("x")]
    hist = {"kind": "resumed", "items": items}
    st = snapshot_turn_state(hist)
    out = truncate_before_nth_user_message(hist, 5, st)  # n 越界且 mid-turn
    assert out == items[:0]  # 截到活动回合起点(Rust truncate(cut_idx) 语义:整回合剔除)

def test_truncate_before_nth_mid_turn_fallback_last_user():
    items = [user_msg("a"), asst_msg("x")]  # 隐式 mid-turn
    hist = {"kind": "resumed", "items": items}
    st = snapshot_turn_state(hist)
    out = truncate_before_nth_user_message(hist, 5, st)
    assert out == items[:1 - 1]  # 回退到最后用户消息位置截断 → []


# ---------- fork_history_from_snapshot / append_interrupted ----------

def test_fork_truncate_variant():
    hist = {"kind": "resumed", "items": [user_msg("a"), asst_msg("x"), user_msg("b")]}
    out = fork_history_from_snapshot({"variant": "truncate_before_nth_user_message", "nth_user_message": 1}, hist)
    assert out == hist["items"][:2]

def test_fork_interrupted_mid_turn_appends_aborted():
    hist = {"kind": "resumed", "items": [turn_started("t1"), user_msg("a")]}
    out = fork_history_from_snapshot({"variant": "interrupted"}, hist)
    assert out[-1]["event"]["type"] == "turn_aborted"
    assert out[-1]["event"]["reason"] == "interrupted"
    assert out[-1]["event"]["turn_id"] == "t1"

def test_fork_interrupted_with_marker():
    hist = {"kind": "resumed", "items": [turn_started("t1"), user_msg("a")]}
    marker = {"type": "message", "role": "developer", "content": [{"type": "input_text", "text": "m"}]}
    out = fork_history_from_snapshot({"variant": "interrupted"}, hist, marker)
    assert out[-2]["item"] == marker  # marker 项在 aborted 事件之前
    assert out[-1]["event"]["type"] == "turn_aborted"

def test_fork_interrupted_not_mid_turn_returns_history():
    hist = {"kind": "forked", "items": [user_msg("a"), turn_completed("t1")]}
    out = fork_history_from_snapshot({"variant": "interrupted"}, hist)
    assert out == hist["items"]

def test_fork_unknown_variant_raises():
    with pytest.raises(ValueError, match="variant"):
        fork_history_from_snapshot({"variant": "wat"}, {"kind": "new"})


# ---------- is_user_turn_boundary ----------

def test_user_turn_boundary_agent_message():
    assert is_user_turn_boundary({"type": "agent_message"}) is True

def test_user_turn_boundary_contextual_user_false():
    assert is_user_turn_boundary({"type": "message", "role": "user",
                                  "content": [{"type": "input_text", "text": "<context_window>env"}]}) is False

def test_user_turn_boundary_real_user_true():
    assert is_user_turn_boundary({"type": "message", "role": "user",
                                  "content": [{"type": "input_text", "text": "hello"}]}) is True
