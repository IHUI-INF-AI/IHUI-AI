# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""turn_suspension 纯函数判据测试（对标 Codex 26.1111 turn_suspension.rs）。

逐字错误锚来自 codex.exe 364.8MB 流式 strings 抽取，全部保真。
"""

from __future__ import annotations

from app.core.turn_suspension import (
    SUSPENSION_STEP_ORDER,
    VERBATIM_CLOSE_WRITER_FAILED_PREFIX,
    VERBATIM_FLUSH_AFTER_FAILED_PREFIX,
    VERBATIM_FLUSH_BEFORE_FAILED_PREFIX,
    VERBATIM_NO_RUNNING_TASK,
    VERBATIM_NO_RUNNING_TURN,
    VERBATIM_SUSPEND_UNFINISHED_ROOT_TURN,
    VERBATIM_TASK_EXITED_ABNORMALLY,
    VERBATIM_TASK_NOT_GRACEFUL,
    SuspensionDecision,
    SuspensionInput,
    evaluate_suspension,
    suspension_step_order,
)


def _ok() -> SuspensionInput:
    """一个「挂起成功」的基准输入（四段全绿）。"""
    return SuspensionInput(
        suspending_unfinished_root_turn=True,
        has_running_task=True,
        has_running_turn=True,
    )


# ── 1. 不在挂起流程 → REJECT 无锚 ──────────────────────────────────────────

def test_not_suspending_rejects_without_verbatim_anchor() -> None:
    out = evaluate_suspension(SuspensionInput())
    assert out.decision is SuspensionDecision.REJECT
    assert "not suspending" in out.evidence
    assert out.source_line == "suspension.rs:none"


# ── 2. 无运行中 task → REJECT + 逐字锚 ─────────────────────────────────────

def test_no_running_task_rejects_with_verbatim_anchor() -> None:
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=False,
            has_running_turn=True,
        )
    )
    assert out.decision is SuspensionDecision.REJECT
    assert out.evidence == VERBATIM_NO_RUNNING_TASK
    assert out.source_line == "suspension.rs:74"


# ── 3. 无运行中 turn → REJECT + 逐字锚 ─────────────────────────────────────

def test_no_running_turn_rejects_with_verbatim_anchor() -> None:
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=False,
        )
    )
    assert out.decision is SuspensionDecision.REJECT
    assert out.evidence == VERBATIM_NO_RUNNING_TURN
    assert out.source_line == "suspension.rs:77"


# ── 4. abort 判据（优先于挂起四段）─────────────────────────────────────────

def test_task_exited_abnormally_aborts_before_flush() -> None:
    """task 异常退出优先于 flush_before 失败 → ABORT（不谈 flush）。"""
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            task_exit="abnormal",
            flush_before_error="io error",
        )
    )
    assert out.decision is SuspensionDecision.ABORT
    assert out.evidence == VERBATIM_TASK_EXITED_ABNORMALLY


def test_task_not_graceful_aborts_with_verbatim_anchor() -> None:
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            task_exit="not_graceful",
        )
    )
    assert out.decision is SuspensionDecision.ABORT
    assert out.evidence == VERBATIM_TASK_NOT_GRACEFUL


# ── 5. 挂起四段顺序失败 → FAILED，按顺序命中即停 ──────────────────────────

def test_flush_before_failure_fails_first() -> None:
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            flush_before_error="disk full",
        )
    )
    assert out.decision is SuspensionDecision.FAILED
    assert out.evidence == VERBATIM_FLUSH_BEFORE_FAILED_PREFIX + "disk full"
    assert out.source_line == "suspension.rs:74"


def test_flush_after_failure_fails_before_close_writer() -> None:
    """flush_after 和 close_writer 同时失败 → 命中 flush_after（顺序优先）。"""
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            flush_after_error="io error",
            close_writer_error="handle closed",
        )
    )
    assert out.decision is SuspensionDecision.FAILED
    assert out.evidence == VERBATIM_FLUSH_AFTER_FAILED_PREFIX + "io error"
    assert out.source_line == "suspension.rs:77"


def test_close_writer_failure_fails_last() -> None:
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            close_writer_error="broken pipe",
        )
    )
    assert out.decision is SuspensionDecision.FAILED
    assert out.evidence == VERBATIM_CLOSE_WRITER_FAILED_PREFIX + "broken pipe"


def test_suspend_write_failure_fails_between_flushes() -> None:
    """suspend_write_error 排在 flush_before 之后 flush_after 之前（顺序）。"""
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            suspend_write_error="rollout busy",
        )
    )
    assert out.decision is SuspensionDecision.FAILED
    assert "suspend write to rollout failed" in out.evidence


# ── 6. 全部通过 → SUSPENDED + 逐字锚 ───────────────────────────────────────

def test_all_green_suspends_with_verbatim_anchor() -> None:
    out = evaluate_suspension(_ok())
    assert out.decision is SuspensionDecision.SUSPENDED
    assert out.evidence == VERBATIM_SUSPEND_UNFINISHED_ROOT_TURN


# ── 7. 挂起四段固定顺序（可机检）───────────────────────────────────────────

def test_suspension_step_order_is_fail_closed() -> None:
    assert suspension_step_order() == (
        "flush_before",
        "suspend",
        "flush_after",
        "close_writer",
    )
    assert suspension_step_order() == SUSPENSION_STEP_ORDER


# ── 8. 反向变异：抹掉 abort 优先级 → flush_before 抢先 → 测试转红 ─────────

def test_mutation_reversal_abort_must_precede_flush_failure() -> None:
    """如果 abort 不优先于 flush，本测试会拿到 FAILED 而非 ABORT。"""
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=True,
            has_running_turn=True,
            task_exit="abnormal",
            flush_before_error="io error",
        )
    )
    # 钉住：abort 优先于 flush_before 失败
    assert out.decision is SuspensionDecision.ABORT, (
        f"abort must precede flush failure, got {out.decision}: {out.evidence}"
    )


# ── 9. 反向变异：删掉前置校验顺序 → task 校验先于 turn 校验 ───────────────

def test_mutation_reversal_task_check_precedes_turn_check() -> None:
    """两者都缺 → 必须先命中 task 校验（suspension.rs:74），非 turn（:77）。"""
    out = evaluate_suspension(
        SuspensionInput(
            suspending_unfinished_root_turn=True,
            has_running_task=False,
            has_running_turn=False,
        )
    )
    assert out.decision is SuspensionDecision.REJECT
    assert out.evidence == VERBATIM_NO_RUNNING_TASK, (
        f"task check must precede turn check, got: {out.evidence}"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
