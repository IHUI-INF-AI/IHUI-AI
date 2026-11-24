# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R58 scheduled_task_schedule 封闭集测试（统一工程规范；struct variant 逐字表 + 反向变异）。"""

from __future__ import annotations

import pytest

from app.core.scheduled_task_schedule import (
    SCHEDULE_ELEMENTS,
    SCHEDULE_FREQUENCY,
    ScheduledTaskSchedule,
    ScheduledTaskScheduleError,
    ensure_scheduled_task_schedule,
    expected_element_count,
    schedule_frequency,
    schedule_names,
    validate_schedule,
)


class TestClosedSet:
    def test_member_count_is_4(self) -> None:
        assert len(ScheduledTaskSchedule) == 4

    def test_literal_table_matches_members(self) -> None:
        got = {m.value for m in ScheduledTaskSchedule}
        assert got == set(SCHEDULE_ELEMENTS)

    def test_binary_token_anchors(self) -> None:
        """strings 逐字锚。"""
        assert {"Daily", "Hourly", "Weekly", "Weekdays"} == {m.value for m in ScheduledTaskSchedule}

    def test_excludes_other_axis_values(self) -> None:
        """别的轴/大小写漂移值不属本封闭集。"""
        assert {"daily", "Day", "Hour", "Week", "WeekDay", "Monthly"}.isdisjoint(set(SCHEDULE_ELEMENTS))


class TestElementCounts:
    def test_verbatim_element_count_table(self) -> None:
        """反向变异：任一 with-N-element 被篡改 ⇒ 逐字表失配转红。"""
        assert SCHEDULE_ELEMENTS == {"Daily": 1, "Hourly": 2, "Weekly": 2, "Weekdays": 1}

    @pytest.mark.parametrize("name,count", SCHEDULE_ELEMENTS.items())
    def test_expected_element_count_matches(self, name, count) -> None:
        assert expected_element_count(name) == count

    def test_unknown_name_raises(self) -> None:
        with pytest.raises(ScheduledTaskScheduleError):
            expected_element_count("bogus")


class TestEnsureClosedSet:
    @pytest.mark.parametrize("value", SCHEDULE_ELEMENTS)
    def test_registered_passes_through(self, value: str) -> None:
        assert ensure_scheduled_task_schedule(value) == value

    @pytest.mark.parametrize("bad", ["bogus", "", "not_a_variant", 7])
    def test_unregistered_raises(self, bad) -> None:
        with pytest.raises(ScheduledTaskScheduleError):
            ensure_scheduled_task_schedule(bad)

    def test_error_message_names_module(self) -> None:
        with pytest.raises(ScheduledTaskScheduleError, match="app/core/scheduled_task_schedule.py"):
            ensure_scheduled_task_schedule("bogus")


class TestClassification:
    @pytest.mark.parametrize("value,expected", [
    ("Daily", "daily"),
    ("Hourly", "hourly"),
    ("Weekly", "weekly"),
    ("Weekdays", "weekdays"),
    ])
    def test_family(self, value, expected) -> None:
        assert schedule_frequency(value) == expected

    def test_family_rejects_unregistered(self) -> None:
        with pytest.raises(ScheduledTaskScheduleError):
            schedule_frequency("bogus")


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", SCHEDULE_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_schedule(name, count) == name

    @pytest.mark.parametrize("name,count", SCHEDULE_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ScheduledTaskScheduleError, match="元素数应为"):
            validate_schedule(name, count + 1)

    def test_names_returns_copy(self) -> None:
        a = schedule_names()
        assert set(a) == set(SCHEDULE_ELEMENTS)

    def test_schedule_frequency_covers_all(self):
        assert set(SCHEDULE_FREQUENCY) == set(SCHEDULE_ELEMENTS)

    def test_interval_variants_have_two_elements(self):
        # Hourly/Weekly 带区间参数(2), Daily/Weekdays 无(1)
        assert SCHEDULE_ELEMENTS["Hourly"] == SCHEDULE_ELEMENTS["Weekly"] == 2
        assert SCHEDULE_ELEMENTS["Daily"] == SCHEDULE_ELEMENTS["Weekdays"] == 1


class TestReverseMutation:
    def test_mutating_enum_count_is_detected(self) -> None:
        assert len(ScheduledTaskSchedule) == len(SCHEDULE_ELEMENTS) == 4
        assert {m.value for m in ScheduledTaskSchedule} == set(SCHEDULE_ELEMENTS)

    def test_case_sensitive_wire_names(self) -> None:
        """variant 名大小写敏感（Rust struct variant 逐字，小写形态非登记值）。"""
        first = "Daily"
        assert first in SCHEDULE_ELEMENTS
        assert first.lower() not in SCHEDULE_ELEMENTS
