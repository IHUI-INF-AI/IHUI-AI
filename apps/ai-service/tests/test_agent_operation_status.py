# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Agent/Operation 生命周期状态封闭集测试 —— 遵循统一工程规范。

取证纠偏：Rust 变体名 6 档 vs wire serde 7 档（not_found 为 wire 独有），本集取 wire 七档；
not_found 标注为「wire 独有、Rust 变体名未现」。是否同一 enum / serde rename 未逐字段确证。
"""

from __future__ import annotations

import pytest

from app.core.agent_operation_status import (
    AGENT_OPERATION_STATUS_VALUES,
    IN_FLIGHT_STATES,
    MESSAGE_EMITTING_STATES,
    AgentOperationStatus,
    AgentOperationStatusError,
    emits_message,
    ensure_agent_operation_status,
    is_in_flight,
    is_terminal_state,
)


class TestClosedSet:
    def test_member_count_is_7(self) -> None:
        """wire serde 七档（含 not_found）。"""
        assert len(AgentOperationStatus) == 7

    def test_literal_table_matches_members(self) -> None:
        assert tuple(m.value for m in AgentOperationStatus) == AGENT_OPERATION_STATUS_VALUES

    def test_binary_token_anchor(self) -> None:
        """strings 逐字锚 wire 七档连续块。"""
        assert {
            "pending_init", "running", "interrupted", "completed",
            "errored", "shutdown", "not_found",
        } == {m.value for m in AgentOperationStatus}

    def test_rust_variant_names_are_six(self) -> None:
        """Rust 变体名只有 6 档（无 not_found），wire 多 not_found——本集取 wire。"""
        rust_variants = {"pending_init", "running", "interrupted", "completed", "errored", "shutdown"}
        assert rust_variants < {m.value for m in AgentOperationStatus}
        assert "not_found" in {m.value for m in AgentOperationStatus}


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", AGENT_OPERATION_STATUS_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_agent_operation_status(value) == value

    @pytest.mark.parametrize("bad", ["", "started", "done", "failed", "unknown", "queued"])
    def test_unregistered_raises(self, bad: str) -> None:
        with pytest.raises(AgentOperationStatusError):
            ensure_agent_operation_status(bad)

    def test_non_string_raises(self) -> None:
        with pytest.raises(AgentOperationStatusError):
            ensure_agent_operation_status(3)  # type: ignore[arg-type]

    def test_error_message_names_module(self) -> None:
        with pytest.raises(AgentOperationStatusError, match="agent_operation_status"):
            ensure_agent_operation_status("done")


class TestStateGrouping:
    @pytest.mark.parametrize("in_flight", ["pending_init", "running", "interrupted"])
    def test_in_flight_states(self, in_flight: str) -> None:
        assert is_in_flight(in_flight) is True
        assert emits_message(in_flight) is False
        assert is_terminal_state(in_flight) is False

    @pytest.mark.parametrize("emitting", ["completed", "errored", "shutdown", "not_found"])
    def test_message_emitting_states(self, emitting: str) -> None:
        assert emits_message(emitting) is True
        assert is_in_flight(emitting) is False
        assert is_terminal_state(emitting) is True

    def test_partition_is_exhaustive(self) -> None:
        """在飞三态 + 发消息四态 = 全七档，两集合互斥。"""
        assert {
            m.value for m in AgentOperationStatus
        } == IN_FLIGHT_STATES | MESSAGE_EMITTING_STATES
        assert IN_FLIGHT_STATES.isdisjoint(MESSAGE_EMITTING_STATES)

    def test_constants_match_membership(self) -> None:
        assert {m.value for m in AgentOperationStatus if is_in_flight(m.value)} == IN_FLIGHT_STATES
        assert {
            m.value for m in AgentOperationStatus if emits_message(m.value)
        } == MESSAGE_EMITTING_STATES


class TestReverseMutations:
    def test_not_found_is_terminal_and_emits(self) -> None:
        """not_found 既终态也发消息（区别于 in-flight 三态）。"""
        assert is_terminal_state("not_found") is True
        assert emits_message("not_found") is True

    def test_completed_must_emit(self) -> None:
        assert emits_message("completed") is not False

    def test_running_must_not_emit(self) -> None:
        assert emits_message("running") is not True

    def test_pending_init_must_not_be_terminal(self) -> None:
        assert is_terminal_state("pending_init") is False

    def test_unregistered_raises_not_silent_none(self) -> None:
        """对齐 session_prefix 的 else: return None 静默吞档位——本判据须抛错。"""
        with pytest.raises(AgentOperationStatusError):
            emits_message("bogus")
        with pytest.raises(AgentOperationStatusError):
            is_terminal_state("bogus")
        with pytest.raises(AgentOperationStatusError):
            is_in_flight("bogus")


class TestEnumType:
    def test_is_strenum(self) -> None:
        assert AgentOperationStatus.RUNNING.value == "running"
        assert isinstance(AgentOperationStatus.NOT_FOUND.value, str)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
