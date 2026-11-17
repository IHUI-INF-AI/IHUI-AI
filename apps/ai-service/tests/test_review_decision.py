# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R56 review_decision 封闭集测试（统一工程规范；wire 逐字锚 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.review_decision import (
    AMENDMENT_DECISIONS,
    RETRYABLE_DECISIONS,
    REVIEW_DECISION_VALUES,
    TERMINAL_DECISIONS,
    ReviewDecision,
    ReviewDecisionError,
    ensure_review_decision,
    is_amendment,
    is_retryable,
    is_terminal,
)


class TestClosedSet:
    def test_member_count_is_10(self) -> None:
        assert len(ReviewDecision) == 10

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in ReviewDecision}
        assert got == set(REVIEW_DECISION_VALUES)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"approved", "approved_execpolicy_amendment", "proposed_execpolicy_amendment", "approved_for_session", "approved_mcp_policy_amendment", "network_policy_amendment", "denied", "rejection", "timed_out", "abort"} == {m.value for m in ReviewDecision}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"pending", "running", "aborted", "approved_execpolicy"}.isdisjoint({m.value for m in ReviewDecision})


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", REVIEW_DECISION_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_review_decision(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_state", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(ReviewDecisionError):
            ensure_review_decision(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ReviewDecisionError, match="app/core/review_decision.py"):
            ensure_review_decision("bogus")


class TestPredicates:
    @pytest.mark.parametrize("v", ["approved", "approved_execpolicy_amendment",
                                   "approved_for_session", "approved_mcp_policy_amendment",
                                   "denied", "rejection", "abort"])
    def test_terminal_true(self, v):
        assert is_terminal(v) is True

    @pytest.mark.parametrize("v", ["timed_out", "proposed_execpolicy_amendment"])
    def test_terminal_false(self, v):
        assert is_terminal(v) is False

    @pytest.mark.parametrize("v", ["approved_execpolicy_amendment",
                                   "proposed_execpolicy_amendment",
                                   "approved_mcp_policy_amendment", "network_policy_amendment"])
    def test_amendment_true(self, v):
        assert is_amendment(v) is True

    def test_amendment_false_for_plain(self):
        assert is_amendment("approved") is False
        assert is_amendment("denied") is False

    @pytest.mark.parametrize("v", ["timed_out", "proposed_execpolicy_amendment"])
    def test_retryable_true(self, v):
        assert is_retryable(v) is True

    def test_retryable_false_for_terminals(self):
        assert is_retryable("approved") is False
        assert is_retryable("abort") is False

    def test_predicates_reject_unregistered(self):
        for fn in (is_terminal, is_amendment, is_retryable):
            with pytest.raises(ReviewDecisionError):
                fn("bogus")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self):
        """反向变异：封闭集被删一档 ⇒ 成员数与逐字表失配，测试转红。"""
        vals = {m.value for m in ReviewDecision}
        assert len(vals) == len(REVIEW_DECISION_VALUES) == 10
        assert vals == set(REVIEW_DECISION_VALUES)

    def test_mutating_terminal_set_is_detected(self):
        """反向变异：把 abort 移出终结集 ⇒ 与逐字语义失配转红。"""
        assert "abort" in TERMINAL_DECISIONS
        assert "timed_out" not in TERMINAL_DECISIONS

    def test_amendment_and_terminal_overlap_is_expected(self):
        """交叉不变量：amendment 四档全部⊆封闭集，且多数是终结决策。"""
        assert set(AMENDMENT_DECISIONS).issubset(set(REVIEW_DECISION_VALUES))
        assert set(RETRYABLE_DECISIONS).issubset(set(REVIEW_DECISION_VALUES))
