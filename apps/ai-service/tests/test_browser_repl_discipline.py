# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_repl_discipline 单测 — 钉住 REPL 状态纪律、刷新路径、校验选路、升级、history。"""

from __future__ import annotations

import pytest

from app.services.browser_repl_discipline import (
    check_tab_refresh_path,
    choose_state_verification,
    diagnose_failing_interaction,
    guard_history_call,
    validate_repl_declaration,
)

# ── validate_repl_declaration ──────────────────────────────────────────────


class TestReplDeclaration:
    def test_const_handle(self):
        r = validate_repl_declaration("const handle = browser.tabs.current()")
        assert r.allowed is True
        assert r.action == "const_handle"
        assert r.handle_name == "handle"

    def test_let_new(self):
        r = validate_repl_declaration("let count = 0")
        assert r.allowed is True
        assert r.action == "let_reassign"
        assert r.handle_name == "count"

    def test_let_redeclare_blocked(self):
        r = validate_repl_declaration(
            "let count = 5", known_let_vars={"count"}
        )
        assert r.allowed is False
        assert r.action == "redeclare"
        assert r.handle_name == "count"

    def test_let_reassign_ok(self):
        r = validate_repl_declaration("count = 5", known_let_vars={"count"})
        assert r.allowed is True
        assert r.action == "let_reassign"
        assert r.handle_name == "count"

    def test_globalthis_forbidden(self):
        r = validate_repl_declaration("globalThis['handle'] = x")
        assert r.allowed is False
        assert r.action == "globalthis"

    def test_globalthis_dot_forbidden(self):
        r = validate_repl_declaration("globalThis.myHandle = x")
        assert r.allowed is False

    def test_bare_expression_ok(self):
        r = validate_repl_declaration("console.log('hello')")
        assert r.allowed is True

    def test_var_declaration(self):
        r = validate_repl_declaration("var x = 1")
        assert r.allowed is True
        assert r.action == "let_reassign"


# ── check_tab_refresh_path ─────────────────────────────────────────────────

class TestTabRefreshPath:
    def test_at_target_goes_reload(self):
        d = check_tab_refresh_path(already_at_target_url=True)
        assert d.should_goto is False
        assert d.should_reload is True

    def test_at_target_with_input_goes_reload(self):
        d = check_tab_refresh_path(
            already_at_target_url=True, has_unsaved_user_input=True
        )
        assert d.should_goto is False
        assert d.should_reload is True

    def test_not_at_target_goes_goto(self):
        d = check_tab_refresh_path(already_at_target_url=False)
        assert d.should_goto is True
        assert d.should_reload is False


# ── choose_state_verification ──────────────────────────────────────────────

class TestStateVerification:
    def test_dom_only(self):
        c = choose_state_verification(need_dom_truth=True, need_visual_confirmation=False)
        assert c.mode == "dom_snapshot"
        assert c.should_dom_snapshot is True
        assert c.should_screenshot is False

    def test_visual_only(self):
        c = choose_state_verification(need_dom_truth=False, need_visual_confirmation=True)
        assert c.mode == "screenshot"
        assert c.should_screenshot is True

    def test_both_downgraded_to_dom(self):
        c = choose_state_verification(need_dom_truth=True, need_visual_confirmation=True)
        assert c.mode == "dom_snapshot"
        assert c.should_screenshot is False

    def test_state_changing_allows_both(self):
        c = choose_state_verification(
            need_dom_truth=True,
            need_visual_confirmation=True,
            state_changing_action_done=True,
        )
        assert c.mode == "both"
        assert c.should_dom_snapshot is True
        assert c.should_screenshot is True

    def test_neither_defaults_to_dom(self):
        c = choose_state_verification(need_dom_truth=False, need_visual_confirmation=False)
        assert c.mode == "dom_snapshot"
        assert c.should_dom_snapshot is True


# ── diagnose_failing_interaction ───────────────────────────────────────────

class TestFailingInteraction:
    def test_first_failure_investigate(self):
        d = diagnose_failing_interaction(attempts=1)
        assert d.action == "investigate_blocker"
        assert d.allowed is True

    def test_repeat_without_blocker_investigation(self):
        d = diagnose_failing_interaction(attempts=3)
        assert d.action == "investigate_blocker"
        assert d.allowed is False

    def test_escalate_after_blocker_investigated(self):
        d = diagnose_failing_interaction(
            attempts=3, blocker_investigated=True
        )
        assert d.action == "escalate_to_coords"
        assert d.allowed is True


# ── guard_history_call ─────────────────────────────────────────────────────

class TestHistoryCall:
    def test_all_clear(self):
        d = guard_history_call(
            has_date_bounds=True, has_focused_query=True, user_approved=True
        )
        assert d.should_proceed is True
        assert d.blockers == []

    def test_missing_date_bounds(self):
        d = guard_history_call(
            has_date_bounds=False, has_focused_query=True, user_approved=True
        )
        assert d.should_proceed is False
        assert "缺日期边界" in d.blockers

    def test_missing_focus(self):
        d = guard_history_call(
            has_date_bounds=True, has_focused_query=False, user_approved=True
        )
        assert d.should_proceed is False
        assert any("聚焦" in b for b in d.blockers)

    def test_missing_approval(self):
        d = guard_history_call(
            has_date_bounds=True, has_focused_query=True, user_approved=False
        )
        assert d.should_proceed is False
        assert any("批准" in b for b in d.blockers)

    def test_all_missing(self):
        d = guard_history_call(
            has_date_bounds=False, has_focused_query=False, user_approved=False
        )
        assert d.should_proceed is False
        assert len(d.blockers) == 3


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
