# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R56 mcp_startup_status 封闭集测试（统一工程规范；wire 逐字锚 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.mcp_startup_status import (
    FAILURE_STARTUP_STATUSES,
    MCP_STARTUP_STATUS_VALUES,
    TERMINAL_STARTUP_STATUSES,
    McpStartupStatus,
    McpStartupStatusError,
    ensure_mcp_startup_status,
    is_failure,
    is_ready,
    is_terminal,
    mcp_startup_status_values,
)


class TestClosedSet:
    def test_member_count_is_6(self) -> None:
        assert len(McpStartupStatus) == 6

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in McpStartupStatus}
        assert got == set(MCP_STARTUP_STATUS_VALUES)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"Starting", "Ready", "Cancelled", "completed", "declined", "Failed"} == {m.value for m in McpStartupStatus}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"ready", "cancelled", "declined_retry", "timed_out", "unavailable"}.isdisjoint({m.value for m in McpStartupStatus})


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", MCP_STARTUP_STATUS_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_mcp_startup_status(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_state", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(McpStartupStatusError):
            ensure_mcp_startup_status(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(McpStartupStatusError, match="app/core/mcp_startup_status.py"):
            ensure_mcp_startup_status("bogus")


class TestPredicates:
    @pytest.mark.parametrize("v", ["Cancelled", "completed", "declined", "Failed"])
    def test_terminal_true(self, v):
        assert is_terminal(v) is True

    @pytest.mark.parametrize("v", ["Starting", "Ready"])
    def test_terminal_false(self, v):
        assert is_terminal(v) is False

    def test_is_ready(self):
        assert is_ready("Ready") is True
        assert is_ready("completed") is False

    @pytest.mark.parametrize("v", ["Cancelled", "declined", "Failed"])
    def test_is_failure(self, v):
        assert is_failure(v) is True

    def test_values_table_returns_tuple(self):
        a = mcp_startup_status_values()
        assert isinstance(a, tuple)
        assert a == MCP_STARTUP_STATUS_VALUES

    def test_predicates_reject_unregistered(self):
        for fn in (is_terminal, is_ready, is_failure):
            with pytest.raises(McpStartupStatusError):
                fn("bogus")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self):
        assert len(McpStartupStatus) == len(MCP_STARTUP_STATUS_VALUES) == 6
        assert {m.value for m in McpStartupStatus} == set(MCP_STARTUP_STATUS_VALUES)

    def test_mutating_failed_variant_is_detected(self):
        """反向变异：Failed 变体被删 ⇒ 逐字锚失配转红。"""
        assert "Failed" in [m.value for m in McpStartupStatus]
        assert "Failed" in TERMINAL_STARTUP_STATUSES
        assert "Failed" in FAILURE_STARTUP_STATUSES

    def test_case_sensitive_wire_names(self):
        """wire 名大小写敏感（Starting/completed 混用逐字），小写形态非登记值。"""
        assert "Starting" in MCP_STARTUP_STATUS_VALUES
        assert "starting" not in MCP_STARTUP_STATUS_VALUES
