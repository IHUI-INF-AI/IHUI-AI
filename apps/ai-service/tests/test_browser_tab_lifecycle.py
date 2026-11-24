# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_tab_lifecycle 单测 — 钉住三态归属、收尾处置、handoff 跨 turn、claim 独占、visibility。"""

from __future__ import annotations

import pytest

from app.services.browser_tab_lifecycle import (
    BrowserTabLifecycle,
    TabDisposition,
    TabMark,
    TabOwnership,
    decide_visibility,
)

# ── 创建 / 归属 ────────────────────────────────────────────────────────────


def test_create_tab_is_agent_owned() -> None:
    lc = BrowserTabLifecycle()
    st = lc.create_tab("t1", turn=1)
    assert st.ownership == TabOwnership.AGENT_CREATED
    assert st.controlling_session == "self"
    assert st.mark is None  # 默认无标记


def test_register_user_tab_unclaimed() -> None:
    lc = BrowserTabLifecycle()
    st = lc.register_user_tab("u1", controlling_session=None)
    assert st.ownership == TabOwnership.USER_UNCLAIMED
    assert st.controlling_session is None


def test_register_user_tab_claimed() -> None:
    lc = BrowserTabLifecycle()
    st = lc.register_user_tab("u2", controlling_session="sess-A")
    assert st.ownership == TabOwnership.CLAIMED_USER


# ── claim 单会话独占 ────────────────────────────────────────────────────────


def test_claim_success_when_uncontrolled() -> None:
    lc = BrowserTabLifecycle()
    lc.register_user_tab("u1", controlling_session=None)
    out = lc.claim_tab("u1", session_id="sess-A")
    assert out.ok is True
    assert out.controlling_session == "sess-A"


def test_claim_fails_when_other_session_controls() -> None:
    """单会话独占:被他会话控制即 claim 失败,不抢。"""
    lc = BrowserTabLifecycle()
    lc.register_user_tab("u1", controlling_session="sess-A")
    out = lc.claim_tab("u1", session_id="sess-B")
    assert out.ok is False
    assert out.controlling_session == "sess-A"
    assert "独占" in out.detail


def test_claim_same_session_ok() -> None:
    lc = BrowserTabLifecycle()
    lc.register_user_tab("u1", controlling_session="sess-A")
    out = lc.claim_tab("u1", session_id="sess-A")
    assert out.ok is True


def test_claim_nonexistent_tab_fails() -> None:
    lc = BrowserTabLifecycle()
    out = lc.claim_tab("ghost", session_id="sess-A")
    assert out.ok is False
    assert "不存在" in out.detail


# ── turn 收尾:agent 建临时 tab 未标记 → 关 ─────────────────────────────────


def test_settle_agent_tab_unmarked_closes() -> None:
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    outcomes = lc.settle_turn(turn=1)
    assert len(outcomes) == 1
    assert outcomes[0].disposition == TabDisposition.CLOSE
    assert "ephemeral" in outcomes[0].detail


def test_settle_agent_tab_deliverable_keeps() -> None:
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    assert lc.mark_tab("t1", TabMark.DELIVERABLE, turn=1) is True
    outcomes = lc.settle_turn(turn=1)
    assert outcomes[0].disposition == TabDisposition.KEEP_OPEN


def test_settle_agent_tab_handoff_pending_remark() -> None:
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    lc.mark_tab("t1", TabMark.HANDOFF, turn=1)
    outcomes = lc.settle_turn(turn=1)
    assert outcomes[0].disposition == TabDisposition.KEEP_PENDING_REMARK


# ── turn 收尾:用户 tab ─────────────────────────────────────────────────────


def test_settle_claimed_user_tab_unmarked_release() -> None:
    """已 claim 未标记用户 tab:释放出会话控制,保持打开。"""
    lc = BrowserTabLifecycle()
    lc.register_user_tab("u1", controlling_session="self")
    outcomes = lc.settle_turn(turn=1)
    assert outcomes[0].disposition == TabDisposition.RELEASE_AND_KEEP


def test_settle_unclaimed_user_tab_keep() -> None:
    lc = BrowserTabLifecycle()
    lc.register_user_tab("u1", controlling_session=None)
    outcomes = lc.settle_turn(turn=1)
    assert outcomes[0].disposition == TabDisposition.KEEP_OPEN


# ── handoff 跨 turn 清除 ───────────────────────────────────────────────────


def test_begin_turn_clears_old_handoff() -> None:
    """Codex:下一 turn 之前的 handoff 标记被清除,须重新标记。"""
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    lc.mark_tab("t1", TabMark.HANDOFF, turn=1)
    cleared = lc.begin_turn(turn=2)
    assert "t1" in cleared
    st = lc.get_tab("t1")
    assert st is not None
    assert st.mark is None  # 旧 handoff 已清
    # 若不重新标记,turn2 收尾会关掉
    lc.settle_turn(turn=2)
    # (再 settle 仍是 KEEP_PENDING_REMARK 逻辑,但 mark 已 None)
    outcomes2 = lc.settle_turn(turn=2)
    assert outcomes2[0].disposition == TabDisposition.CLOSE


def test_begin_turn_does_not_clear_current_turn_handoff() -> None:
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=2)
    lc.mark_tab("t1", TabMark.HANDOFF, turn=2)
    cleared = lc.begin_turn(turn=2)
    assert "t1" not in cleared
    st = lc.get_tab("t1")
    assert st is not None
    assert st.mark == TabMark.HANDOFF


def test_begin_turn_does_not_clear_deliverable() -> None:
    """deliverable 面向用户输出,跨 turn 留,不被 begin_turn 清除。"""
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    lc.mark_tab("t1", TabMark.DELIVERABLE, turn=1)
    cleared = lc.begin_turn(turn=2)
    assert "t1" not in cleared
    st = lc.get_tab("t1")
    assert st is not None
    assert st.mark == TabMark.DELIVERABLE


def test_mark_latest_wins() -> None:
    """最新标记胜出。"""
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    lc.mark_tab("t1", TabMark.HANDOFF, turn=1)
    lc.mark_tab("t1", TabMark.DELIVERABLE, turn=1)
    st = lc.get_tab("t1")
    assert st is not None
    assert st.mark == TabMark.DELIVERABLE


def test_mark_nonexistent_returns_false() -> None:
    lc = BrowserTabLifecycle()
    assert lc.mark_tab("ghost", TabMark.HANDOFF, turn=1) is False


# ── 可见性 ─────────────────────────────────────────────────────────────────


def test_visibility_show_to_user() -> None:
    d = decide_visibility("show_to_user")
    assert d.should_be_visible is True


@pytest.mark.parametrize("intent", ["answer_question", "background_task"])
def test_visibility_background(intent: str) -> None:
    d = decide_visibility(intent)
    assert d.should_be_visible is False


def test_visibility_unknown_defaults_background() -> None:
    d = decide_visibility("whatever")
    assert d.should_be_visible is False
    assert "默认后台" in d.detail


def test_visibility_decision_detail_never_empty() -> None:
    for intent in ("show_to_user", "answer_question", "background_task", ""):
        assert decide_visibility(intent).detail


# ── to_dict 形状 ───────────────────────────────────────────────────────────


def test_tab_state_to_dict() -> None:
    lc = BrowserTabLifecycle()
    st = lc.create_tab("t1", turn=1)
    d = st.to_dict()
    assert d["tab_id"] == "t1"
    assert d["ownership"] == "agent_created"
    assert d["mark"] is None
    assert d["opened_turn"] == 1


def test_list_tabs() -> None:
    lc = BrowserTabLifecycle()
    lc.create_tab("t1", turn=1)
    lc.create_tab("t2", turn=1)
    assert len(lc.list_tabs()) == 2


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
