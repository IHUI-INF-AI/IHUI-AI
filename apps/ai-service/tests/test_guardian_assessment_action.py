# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R56 guardian_assessment_action 封闭集测试（统一工程规范；wire 逐字锚 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.guardian_assessment_action import (
    GUARDIAN_ACTION_ELEMENTS,
    GuardianAssessmentAction,
    GuardianAssessmentActionError,
    ensure_guardian_action,
    expected_element_count,
    guardian_action_names,
    is_privileged,
)


class TestClosedSet:
    def test_member_count_is_7(self) -> None:
        assert len(GuardianAssessmentAction) == 7

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in GuardianAssessmentAction}
        assert got == set(GUARDIAN_ACTION_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"Execve", "Command", "WriteStdin", "ApplyPatch", "McpToolCall", "NetworkAccess", "RequestPermissions"} == {m.value for m in GuardianAssessmentAction}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"execve", "command", "Shell", "FileWrite"}.isdisjoint({m.value for m in GuardianAssessmentAction})


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", GUARDIAN_ACTION_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_guardian_action(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_state", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(GuardianAssessmentActionError):
            ensure_guardian_action(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(GuardianAssessmentActionError, match="app/core/guardian_assessment_action.py"):
            ensure_guardian_action("bogus")


class TestElementCounts:
    @pytest.mark.parametrize("name,count", GUARDIAN_ACTION_ELEMENTS.items())
    def test_element_count_matches(self, name, count):
        assert expected_element_count(name) == count

    def test_verbatim_element_counts(self):
        """反向变异：任一元素数被篡改 ⇒ 与逐字 with-N-elements 锚失配转红。"""
        assert GUARDIAN_ACTION_ELEMENTS == {
            "Execve": 4, "Command": 3, "WriteStdin": 4, "ApplyPatch": 2,
            "McpToolCall": 5, "NetworkAccess": 4, "RequestPermissions": 2,
        }


class TestPredicates:
    @pytest.mark.parametrize("v", ["Execve", "Command", "NetworkAccess",
                                   "RequestPermissions", "McpToolCall"])
    def test_privileged_true(self, v):
        assert is_privileged(v) is True

    @pytest.mark.parametrize("v", ["WriteStdin", "ApplyPatch"])
    def test_privileged_false(self, v):
        assert is_privileged(v) is False

    def test_guardian_action_names_returns_copy(self):
        a = guardian_action_names()
        assert set(a) == set(GUARDIAN_ACTION_ELEMENTS)
        assert a is not GUARDIAN_ACTION_ELEMENTS

    def test_predicates_reject_unregistered(self):
        with pytest.raises(GuardianAssessmentActionError):
            is_privileged("bogus")
        with pytest.raises(GuardianAssessmentActionError):
            expected_element_count("bogus")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self):
        assert len(GuardianAssessmentAction) == len(GUARDIAN_ACTION_ELEMENTS) == 7
        assert {m.value for m in GuardianAssessmentAction} == set(GUARDIAN_ACTION_ELEMENTS)
