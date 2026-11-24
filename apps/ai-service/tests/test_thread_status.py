# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R56 thread_status 封闭集测试（统一工程规范；wire 逐字锚 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.thread_status import (
    ACTIVE_FLAGS,
    THREAD_STATUS_VALUES,
    ThreadStatus,
    ThreadStatusError,
    ensure_active_flags,
    ensure_thread_status,
    is_active,
    is_error,
    is_idle,
    validate_thread_status,
)


class TestClosedSet:
    def test_member_count_is_4(self) -> None:
        assert len(ThreadStatus) == 4

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in ThreadStatus}
        assert got == set(THREAD_STATUS_VALUES)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"notLoaded", "idle", "systemError", "active"} == {m.value for m in ThreadStatus}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"not_loaded", "idle_state", "running", "failed", "system_error"}.isdisjoint({m.value for m in ThreadStatus})


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", THREAD_STATUS_VALUES)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_thread_status(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_state", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(ThreadStatusError):
            ensure_thread_status(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ThreadStatusError, match="app/core/thread_status.py"):
            ensure_thread_status("bogus")


class TestPredicates:
    def test_is_active_error_idle(self):
        assert is_active("active") is True and is_active("idle") is False
        assert is_error("systemError") is True and is_error("idle") is False
        assert is_idle("idle") is True and is_idle("notLoaded") is False

    def test_ensure_active_flags_whitelist(self):
        assert ensure_active_flags(("restricted", "enabled")) == {"restricted", "enabled"}
        assert ensure_active_flags(()) == frozenset()

    def test_ensure_active_flags_rejects_unknown(self):
        with pytest.raises(ThreadStatusError):
            ensure_active_flags(("bogus",))

    def test_validate_consistency_ok(self):
        assert validate_thread_status("active", active_flags=("enabled",)) == "active"
        assert validate_thread_status("idle") == "idle"

    @pytest.mark.parametrize("bad", [("idle", ("enabled",)), ("systemError", ("restricted",)),
                                     ("notLoaded", ("enabled",))])
    def test_validate_rejects_flags_on_non_active(self, bad):
        with pytest.raises(ThreadStatusError):
            validate_thread_status(bad[0], active_flags=bad[1])

    def test_predicates_reject_unregistered(self):
        for fn in (is_active, is_error, is_idle):
            with pytest.raises(ThreadStatusError):
                fn("bogus")


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self):
        assert len(ThreadStatus) == len(THREAD_STATUS_VALUES) == 4
        assert {m.value for m in ThreadStatus} == set(THREAD_STATUS_VALUES)

    def test_mutating_flags_is_detected(self):
        """反向变异：flag 被改写 ⇒ 逐字白名单失配转红。"""
        assert {"restricted", "enabled"} == ACTIVE_FLAGS

    def test_case_sensitive_wire_names(self):
        assert "notLoaded" in THREAD_STATUS_VALUES
        assert "not_loaded" not in THREAD_STATUS_VALUES
