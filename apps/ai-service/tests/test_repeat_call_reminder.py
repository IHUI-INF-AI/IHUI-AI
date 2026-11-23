# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-03 重复调用分级提醒(3/5/8)的判据与接线回归。"""

from __future__ import annotations

from app.core.doom_loop import DOOM_LOOP_REPEAT_THRESHOLD
from app.core.repeat_call_reminder import (
    ADVISORY_CRITICAL_REPEATS,
    ADVISORY_NOTICE_REPEATS,
    ADVISORY_WARNING_REPEATS,
    DOOM_LOOP_ALERT_PREFIX,
    LEVEL_CRITICAL,
    LEVEL_NOTICE,
    LEVEL_WARNING,
    advisory_level,
    build_repeat_reminder,
    classify_repeat_call,
)


def test_below_notice_threshold_returns_none() -> None:
    assert advisory_level(0) is None
    assert advisory_level(2) is None
    assert build_repeat_reminder("run_command", 2) is None


def test_notice_band() -> None:
    assert advisory_level(3) == LEVEL_NOTICE
    assert advisory_level(4) == LEVEL_NOTICE


def test_warning_band() -> None:
    assert advisory_level(5) == LEVEL_WARNING
    assert advisory_level(7) == LEVEL_WARNING


def test_critical_band() -> None:
    assert advisory_level(8) == LEVEL_CRITICAL
    assert advisory_level(12) == LEVEL_CRITICAL


def test_bool_and_non_int_are_not_counted() -> None:
    assert advisory_level(True) is None
    assert advisory_level("3") is None
    assert advisory_level(3.0) is None
    assert advisory_level(None) is None


def test_empty_tool_name_yields_none() -> None:
    assert classify_repeat_call("", 5) is None
    assert build_repeat_reminder("", 5) is None


def test_notice_text_is_verbatim_legacy() -> None:
    """第 3 次看到的字符串与改动前逐字相同(零观感变化)。"""
    assert build_repeat_reminder("run_command", 3) == (
        "[DOOM_LOOP_ALERT] 工具 run_command 已连续 3 次"
        "以完全相同参数被调用,可能陷入死循环。"
        "请检查工具返回值,或换用其他工具/方法。"
    )


def test_all_levels_keep_prefix_and_count() -> None:
    for count in (3, 5, 8):
        text = build_repeat_reminder("write_file", count)
        assert text is not None
        assert text.startswith(DOOM_LOOP_ALERT_PREFIX)
        assert f"已连续 {count} 次" in text


def test_warning_and_critical_are_distinct_from_notice() -> None:
    notice = build_repeat_reminder("t", 3)
    warning = build_repeat_reminder("t", 5)
    critical = build_repeat_reminder("t", 8)
    assert notice != warning != critical
    assert "(警告)" in (warning or "")
    assert "(严重)" in (critical or "")
    assert "(警告)" not in (notice or "")


def test_classify_returns_structured_data() -> None:
    advisory = classify_repeat_call("run_command", 6)
    assert advisory is not None
    assert (advisory.level, advisory.repeat_count) == (LEVEL_WARNING, 6)


def test_thresholds_are_single_source() -> None:
    """阈值单源:notice 档必须等于 doom_loop 的既有阈值,漂开即红。"""
    assert ADVISORY_NOTICE_REPEATS == DOOM_LOOP_REPEAT_THRESHOLD == 3
    assert ADVISORY_NOTICE_REPEATS < ADVISORY_WARNING_REPEATS < ADVISORY_CRITICAL_REPEATS


def test_sentinel_uses_the_same_function_object() -> None:
    """接线防第二份实现:doom_loop 用的就是本模块的函数。"""
    from app.core import doom_loop

    assert doom_loop.build_repeat_reminder is build_repeat_reminder


def test_alert_actions_unchanged_by_reminder_level() -> None:
    """advisory 只是措辞:actions 仍由既有策略决定(reflecting 档的动作不变)。"""
    from app.core.doom_loop import plan_doom_alert_response

    assert plan_doom_alert_response(1) == (["inject_reflection", "skip_tool_execution"], "reflecting")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
