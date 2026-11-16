# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""hook event 触发时序拓扑测试（对标 Codex 26.1111 lifecycle.rs 发射顺序）。

逐字锚来自 codex.exe 364.8MB 流式 strings 抽取，全部保真。
"""

from __future__ import annotations

from app.core.hook_event_ordering import (
    FLUSH_BEFORE_HOOKS,
    HOOK_DECLARATION_ORDER,
    HOOK_EVENT_TOTAL,
    OrderingViolation,
    flush_before_hooks,
    hook_declaration_order,
    validate_hook_sequence,
)

# ── 1. 封闭集总数 + 声明顺序（可机检，对照真相源）──────────────────────────

def test_hook_event_total_is_14() -> None:
    assert HOOK_EVENT_TOTAL == 14


def test_hook_declaration_order_verbatim() -> None:
    """声明顺序逐字保真（strings 多处重复锚，此处取最完整一处）。"""
    assert hook_declaration_order() == (
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "PreCompact",
        "PostCompact",
        "SessionStart",
        "SessionEnd",
        "UserPromptSubmit",
        "SubagentStart",
        "SubagentStop",
        "Stop",
        "Interrupt",
        "PreModelRequest",
        "PostModelRequest",
    )


# ── 2. FLUSH_BEFORE_HOOKS 三类（可机检）───────────────────────────────────

def test_flush_before_hooks_closed_set() -> None:
    assert flush_before_hooks() == frozenset(
        {"Interrupt", "SessionEnd", "SubagentStop"}
    )
    assert frozenset(HOOK_DECLARATION_ORDER) >= FLUSH_BEFORE_HOOKS


# ── 3. OK：合法序列 ───────────────────────────────────────────────────────

def test_valid_session_lifecycle_ok() -> None:
    """SessionStart → 工具流 → SessionEnd + flush 在 SessionEnd 前 = OK。"""
    sequence = [
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PermissionRequest",
        "PostToolUse",
        "PreModelRequest",
        "PostModelRequest",
        "Stop",
        "flush",  # 占位（不进 VALID_EVENTS 校验，仅示意 flush 位置）
        "SessionEnd",
    ]
    # flush 发生在 index 8（SessionEnd 之前）
    check = validate_hook_sequence(
        [e for e in sequence if e != "flush"],
        flush_positions=[7],  # SessionEnd 之前
    )
    assert check.verdict is OrderingViolation.OK
    assert check.ok
    assert check.violations == ()


def test_minimal_sequence_ok() -> None:
    """无 SessionEnd / 无 FLUSH_BEFORE_HOOKS 事件 → OK。"""
    check = validate_hook_sequence(["PreToolUse", "PostToolUse"])
    assert check.ok


# ── 4. UNKNOWN_EVENT：非封闭集事件 fail-closed ────────────────────────────

def test_unknown_event_fails_closed() -> None:
    check = validate_hook_sequence(["PreToolUse", "BananaEvent"])
    assert check.verdict is OrderingViolation.UNKNOWN_EVENT
    assert any("BananaEvent" in v for v in check.violations)


# ── 5. SESSION_BOUNDARY_VIOLATION：SessionEnd 早于 SessionStart ───────────

def test_session_end_before_session_start_fails() -> None:
    check = validate_hook_sequence(["SessionEnd", "SessionStart"])
    assert check.verdict is OrderingViolation.SESSION_BOUNDARY_VIOLATION
    assert any("precedes SessionStart" in v for v in check.violations)


def test_session_end_without_session_start_fails() -> None:
    check = validate_hook_sequence(["Stop", "SessionEnd"])
    assert check.verdict is OrderingViolation.SESSION_BOUNDARY_VIOLATION
    assert any("never emitted" in v for v in check.violations)


def test_session_start_twice_fails() -> None:
    check = validate_hook_sequence(["SessionStart", "Stop", "SessionStart"])
    assert check.verdict is OrderingViolation.SESSION_BOUNDARY_VIOLATION
    assert any("twice" in v for v in check.violations)


# ── 6. PRE_BEFORE_POST_VIOLATION：Post* 早于对应 Pre* ─────────────────────

def test_post_tool_use_before_pre_tool_use_fails() -> None:
    check = validate_hook_sequence(["PostToolUse", "PreToolUse"])
    assert check.verdict is OrderingViolation.PRE_BEFORE_POST_VIOLATION
    assert any(
        "PostToolUse" in v and "PreToolUse" in v for v in check.violations
    )


def test_post_compact_without_pre_compact_fails() -> None:
    check = validate_hook_sequence(["PostCompact"])
    assert check.verdict is OrderingViolation.PRE_BEFORE_POST_VIOLATION


def test_post_model_request_without_pre_model_request_fails() -> None:
    check = validate_hook_sequence(["PostModelRequest"])
    assert check.verdict is OrderingViolation.PRE_BEFORE_POST_VIOLATION


# ── 7. FLUSH_BEFORE_HOOK_VIOLATION：Interrupt/SessionEnd/SubagentStop 前未 flush ─

def test_interrupt_without_flush_fails() -> None:
    """Interrupt 前未 flush transcript = 违规（逐字锚：failed to flush transcript
    before Interrupt hook）。"""
    check = validate_hook_sequence(["PreToolUse", "Interrupt"])
    assert check.verdict is OrderingViolation.FLUSH_BEFORE_HOOK_VIOLATION
    assert any("Interrupt" in v and "flush" in v for v in check.violations)


def test_session_end_without_flush_fails() -> None:
    """SessionEnd 前未 flush transcript = 违规（逐字锚：failed to flush transcript
    before SessionEnd hook）。"""
    check = validate_hook_sequence(["SessionStart", "SessionEnd"])
    assert check.verdict is OrderingViolation.FLUSH_BEFORE_HOOK_VIOLATION
    assert any("SessionEnd" in v and "flush" in v for v in check.violations)


def test_subagent_stop_without_flush_fails() -> None:
    check = validate_hook_sequence(["SubagentStart", "SubagentStop"])
    assert check.verdict is OrderingViolation.FLUSH_BEFORE_HOOK_VIOLATION


def test_flush_after_hook_does_not_count() -> None:
    """flush 发生在 SessionEnd **之后** = 仍违规（flush 必须先于）。"""
    check = validate_hook_sequence(
        ["SessionStart", "SessionEnd"],
        flush_positions=[2],  # SessionEnd 在 index 1，flush 在 index 2 = 之后
    )
    assert check.verdict is OrderingViolation.FLUSH_BEFORE_HOOK_VIOLATION


def test_flush_before_hook_ok() -> None:
    """flush 发生在 SessionEnd **之前** = OK。"""
    check = validate_hook_sequence(
        ["SessionStart", "SessionEnd"],
        flush_positions=[0],  # SessionEnd 在 index 1，flush 在 index 0 = 之前
    )
    assert check.ok


# ── 8. 反向变异：抹掉优先级 → UNKNOWN 应最优先 ───────────────────────────

def test_mutation_reversal_unknown_takes_precedence() -> None:
    """序列同时有 unknown + Session 边界违规 + Pre/Post 违规 → UNKNOWN 最优先。"""
    check = validate_hook_sequence(
        ["SessionEnd", "PostToolUse", "Banana"]
    )
    assert check.verdict is OrderingViolation.UNKNOWN_EVENT, (
        f"unknown must take precedence, got {check.verdict}: {check.violations}"
    )


# ── 9. 反向变异：优先级顺序 SESSION > PRE_POST > FLUSH ───────────────────

def test_mutation_reversal_session_takes_precedence_over_flush() -> None:
    """SessionEnd 早于 SessionStart 且 SessionEnd 前未 flush → SESSION 最优先。"""
    check = validate_hook_sequence(["SessionEnd"])  # SessionEnd 无 SessionStart + 无 flush
    assert check.verdict is OrderingViolation.SESSION_BOUNDARY_VIOLATION, (
        f"session boundary must take precedence over flush, got {check.verdict}"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
