# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R57 command_execution_approval_decision 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.command_execution_approval_decision import (
    APPROVAL_DECISION_ELEMENTS,
    CommandExecutionApprovalDecision,
    CommandExecutionApprovalDecisionError,
    approval_decision_names,
    decision_amendment_kind,
    ensure_approval_decision,
    expected_element_count,
    is_network_amendment,
    validate_approval_decision,
)


class TestClosedSet:
    def test_member_count_is_2(self) -> None:
        assert len(CommandExecutionApprovalDecision) == 2

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in CommandExecutionApprovalDecision}
        assert got == set(APPROVAL_DECISION_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"AcceptWithExecpolicyAmendment", "ApplyNetworkPolicyAmendment"} == {m.value for m in CommandExecutionApprovalDecision}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"accept", "AcceptWithExecPolicyAmendment", "ApplyNetworkAmendment", "network_policy_amendment"}.isdisjoint({m.value for m in CommandExecutionApprovalDecision})


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert APPROVAL_DECISION_ELEMENTS == {"AcceptWithExecpolicyAmendment": 1, "ApplyNetworkPolicyAmendment": 1}

    @pytest.mark.parametrize("name,count", APPROVAL_DECISION_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(CommandExecutionApprovalDecisionError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", APPROVAL_DECISION_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_approval_decision(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(CommandExecutionApprovalDecisionError):
            ensure_approval_decision(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(CommandExecutionApprovalDecisionError, match="app/core/command_execution_approval_decision.py"):
            ensure_approval_decision("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("AcceptWithExecpolicyAmendment", "execpolicy_amendment"),
    ("ApplyNetworkPolicyAmendment", "network_policy_amendment"),
    ])
    def test_family(self, value, expected) -> None:
        assert decision_amendment_kind(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(CommandExecutionApprovalDecisionError):
            decision_amendment_kind("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", APPROVAL_DECISION_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_approval_decision(name, count) == name

    @pytest.mark.parametrize("name,count", APPROVAL_DECISION_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(CommandExecutionApprovalDecisionError, match="元素数应为"):
            validate_approval_decision(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = approval_decision_names()
        assert set(a) == set(APPROVAL_DECISION_ELEMENTS)

    def test_is_network_amendment(self):
        assert is_network_amendment("ApplyNetworkPolicyAmendment") is True
        assert is_network_amendment("AcceptWithExecpolicyAmendment") is False


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(CommandExecutionApprovalDecision) == len(APPROVAL_DECISION_ELEMENTS) == 2
        assert {m.value for m in CommandExecutionApprovalDecision} == set(APPROVAL_DECISION_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "AcceptWithExecpolicyAmendment"
        assert first in APPROVAL_DECISION_ELEMENTS
        assert first.lower() not in APPROVAL_DECISION_ELEMENTS
