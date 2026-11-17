# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A Task 状态封闭集测试 —— 遵循统一工程规范。

取证纠偏：六档逐字确证（submitted 另起、其余拼连续块）；blocked/auth_required 属别的轴已排除。
"""

from __future__ import annotations

import pytest

from app.core.a2a_task_state import (
    A2A_TASK_STATE_VALUES,
    TERMINAL_STATES,
    A2ATaskState,
    A2ATaskStateError,
    ensure_a2a_task_state,
    is_terminal_state,
    requires_client_input,
)


class TestClosedSet:
    def test_member_count_is_6(self) -> None:
        assert len(A2ATaskState) == 6

    def test_literal_table_matches_members(self) -> None:
        assert tuple(m.value for m in A2ATaskState) == A2A_TASK_STATE_VALUES

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚 ``workinginput_requiredcompletedfailedcancelled`` + ``submitted``。"""
        assert {"submitted", "working", "input_required", "completed", "failed", "cancelled"} == {
            m.value for m in A2ATaskState
        }

    def test_excludes_other_axis_states(self) -> None:
        """blocked/auth_required/rejected 属别的轴（remote_catalog 等），不属 TaskState。"""
        assert {"blocked", "auth_required", "rejected"}.isdisjoint(
            {m.value for m in A2ATaskState}
        )


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", A2A_TASK_STATE_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_a2a_task_state(value) == value

    @pytest.mark.parametrize("bad", ["pending", "running", "canceled", "", "blocked", "auth_required"])
    def test_unregistered_raises(self, bad: str) -> None:
        """本仓旧自由字符串（pending/running/canceled）与别轴档均被拒。"""
        with pytest.raises(A2ATaskStateError):
            ensure_a2a_task_state(bad)

    def test_non_string_raises(self) -> None:
        with pytest.raises(A2ATaskStateError):
            ensure_a2a_task_state(7)  # type: ignore[arg-type]

    def test_error_message_names_module(self) -> None:
        with pytest.raises(A2ATaskStateError, match="a2a_task_state"):
            ensure_a2a_task_state("pending")


class TestTerminalJudgement:
    @pytest.mark.parametrize("terminal", ["completed", "failed", "cancelled"])
    def test_three_terminal_states(self, terminal: str) -> None:
        assert is_terminal_state(terminal) is True

    @pytest.mark.parametrize("non_terminal", ["submitted", "working", "input_required"])
    def test_three_non_terminal_states(self, non_terminal: str) -> None:
        assert is_terminal_state(non_terminal) is False

    def test_terminal_set_constant(self) -> None:
        assert frozenset({"completed", "failed", "cancelled"}) == TERMINAL_STATES

    def test_unregistered_raises_not_false(self) -> None:
        with pytest.raises(A2ATaskStateError):
            is_terminal_state("pending")


class TestClientInputPause:
    def test_input_required_is_pause(self) -> None:
        assert requires_client_input("input_required") is True

    @pytest.mark.parametrize("other", ["submitted", "working", "completed", "failed", "cancelled"])
    def test_other_states_not_pause(self, other: str) -> None:
        assert requires_client_input(other) is False

    def test_unregistered_raises(self) -> None:
        with pytest.raises(A2ATaskStateError):
            requires_client_input("running")


class TestProtocolAlignment:
    def test_cancelled_is_double_l(self) -> None:
        """协议双 l ``cancelled``；本仓旧单 l ``canceled`` 不在集内。"""
        assert A2ATaskState.CANCELLED.value == "cancelled"
        assert "canceled" not in {m.value for m in A2ATaskState}

    def test_submitted_replaces_pending(self) -> None:
        """协议 ``submitted`` 对应本仓旧 ``pending``。"""
        assert "submitted" in {m.value for m in A2ATaskState}
        assert "pending" not in {m.value for m in A2ATaskState}

    def test_working_replaces_running(self) -> None:
        assert "working" in {m.value for m in A2ATaskState}
        assert "running" not in {m.value for m in A2ATaskState}

    def test_input_required_present(self) -> None:
        """本仓此前缺失的核心交互态。"""
        assert A2ATaskState.INPUT_REQUIRED.value == "input_required"


class TestReverseMutations:
    def test_terminal_set_must_be_three(self) -> None:
        assert len(TERMINAL_STATES) == 3

    def test_working_must_not_be_terminal(self) -> None:
        assert is_terminal_state("working") is False

    def test_completed_must_be_terminal(self) -> None:
        assert is_terminal_state("completed") is True


class TestEnumType:
    def test_is_strenum(self) -> None:
        assert A2ATaskState.WORKING.value == "working"
        assert isinstance(A2ATaskState.SUBMITTED.value, str)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
