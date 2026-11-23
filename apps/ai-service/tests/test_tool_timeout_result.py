# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B1-01 超时结构化分类的判据与接线回归(对标 DSH TOOL_TIMEOUT,只取判据)。"""

from __future__ import annotations

from pathlib import Path

from app.core.tool_timeout_result import (
    SCOPE_HANDLER,
    SCOPE_LOOP_GUARD,
    SCOPE_MCP_GUARD,
    SCOPE_UNJUDGED,
    TOOL_TIMEOUT_CODE,
    TOOL_TIMEOUT_UNJUDGED_CODE,
    classify_timeout_scope,
    format_timeout_message,
    timeout_scope_fields,
)


def test_explicit_handler_report_wins() -> None:
    """内层 handler 自称超时 ⇒ 必定 handler,不被外层窗口改写(嵌套 deadline 隔离)。"""
    result = classify_timeout_scope(
        reported_by=SCOPE_HANDLER,
        elapsed_s=65.0,
        budget_s=60.0,
        loop_guard_s=65.0,
    )
    assert result.scope == SCOPE_HANDLER
    assert result.reason == "explicit-report"


def test_explicit_loop_guard_report_wins() -> None:
    result = classify_timeout_scope(
        reported_by=SCOPE_LOOP_GUARD, elapsed_s=60.0, budget_s=60.0
    )
    assert (result.scope, result.code) == (SCOPE_LOOP_GUARD, TOOL_TIMEOUT_CODE)


def test_explicit_mcp_guard_report_wins() -> None:
    result = classify_timeout_scope(reported_by=SCOPE_MCP_GUARD)
    assert result.scope == SCOPE_MCP_GUARD


def test_unknown_reported_by_falls_back_to_time_windows() -> None:
    """非法来源不采信,但时间量到了就按窗口判(不因为来源脏就整体未判定)。"""
    result = classify_timeout_scope(reported_by="somewhere", elapsed_s=60.02, budget_s=60.0)
    assert (result.scope, result.reason) == (SCOPE_HANDLER, "handler-window")


def test_loop_guard_window_detected() -> None:
    result = classify_timeout_scope(elapsed_s=65.0, budget_s=60.0, loop_guard_s=65.0)
    assert (result.scope, result.reason) == (SCOPE_LOOP_GUARD, "loop-guard-window")


def test_mcp_guard_window_detected() -> None:
    result = classify_timeout_scope(elapsed_s=62.0, budget_s=60.0, mcp_guard_s=62.0)
    assert (result.scope, result.reason) == (SCOPE_MCP_GUARD, "mcp-guard-window")


def test_outer_window_has_priority_over_handler_window() -> None:
    """同时满足外层与 handler 窗口 ⇒ 归外层(wait_for 到点时 elapsed 必然 ≥ 守卫)。"""
    result = classify_timeout_scope(elapsed_s=65.0, budget_s=65.0, loop_guard_s=65.0)
    assert result.scope == SCOPE_LOOP_GUARD


def test_gap_between_windows_is_unjudged_not_guessed() -> None:
    """落在窗口空隙 ⇒ 未判定,不猜成最近的一档。"""
    result = classify_timeout_scope(elapsed_s=61.5, budget_s=60.0, loop_guard_s=65.0)
    assert (result.scope, result.code, result.reason) == (
        SCOPE_UNJUDGED,
        TOOL_TIMEOUT_UNJUDGED_CODE,
        "outside-all-windows",
    )


def test_missing_elapsed_is_unjudged() -> None:
    result = classify_timeout_scope(elapsed_s=None, budget_s=60.0)
    assert (result.scope, result.reason) == (SCOPE_UNJUDGED, "elapsed-unmeasured")


def test_missing_budget_is_unjudged() -> None:
    result = classify_timeout_scope(elapsed_s=60.0, budget_s=None)
    assert (result.scope, result.reason) == (SCOPE_UNJUDGED, "budget-unmeasured")


def test_non_positive_budget_is_unjudged() -> None:
    assert classify_timeout_scope(elapsed_s=60.0, budget_s=0).scope == SCOPE_UNJUDGED
    assert classify_timeout_scope(elapsed_s=60.0, budget_s=-5).scope == SCOPE_UNJUDGED
    assert classify_timeout_scope(elapsed_s=60.0, budget_s=True).scope == SCOPE_UNJUDGED


def test_non_finite_elapsed_is_unjudged() -> None:
    assert classify_timeout_scope(elapsed_s=float("inf"), budget_s=60.0).scope == SCOPE_UNJUDGED
    assert classify_timeout_scope(elapsed_s=float("nan"), budget_s=60.0).scope == SCOPE_UNJUDGED


def test_epsilon_boundary_is_inclusive() -> None:
    """elapsed 恰在 loop 守卫减容差处 ⇒ 仍算命中(容差不做单向偏置)。"""
    result = classify_timeout_scope(elapsed_s=64.95, budget_s=60.0, loop_guard_s=65.0)
    assert result.scope == SCOPE_LOOP_GUARD


def test_message_text_is_verbatim_legacy() -> None:
    """文案逐字保持历史形态:接线不改变模型可见内容。"""
    assert format_timeout_message(60.0) == "工具执行超时(60s)"
    assert format_timeout_message(60.5) == "工具执行超时(60.5s)"


def test_scope_fields_carry_two_keys_and_distinct_codes() -> None:
    judged = timeout_scope_fields(classify_timeout_scope(reported_by=SCOPE_LOOP_GUARD))
    unjudged = timeout_scope_fields(classify_timeout_scope())
    assert judged == {"timeout_scope": SCOPE_LOOP_GUARD, "timeout_code": TOOL_TIMEOUT_CODE}
    assert unjudged["timeout_scope"] == SCOPE_UNJUDGED
    assert unjudged["timeout_code"] == TOOL_TIMEOUT_UNJUDGED_CODE
    assert judged["timeout_code"] != unjudged["timeout_code"]


def test_loop_uses_the_same_function_objects() -> None:
    """接线防第二份字面量:agent_loop_v2 用的就是本模块的函数对象。"""
    from app.services import agent_loop_v2

    assert agent_loop_v2._format_timeout_message is format_timeout_message
    assert agent_loop_v2._classify_timeout_scope is classify_timeout_scope


def test_agent_loop_has_no_second_timeout_literal() -> None:
    """回潮闸:looper 里不得再出现 f-string 的旧文案字面量。"""
    source = Path(__file__).resolve().parents[1] / "app" / "services" / "agent_loop_v2.py"
    text = source.read_text(encoding="utf-8")
    assert 'f"工具执行超时(' not in text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
