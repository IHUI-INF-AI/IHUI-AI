# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""turn_resume_kind 纯函数判据测试（对标 Codex 26.1111 resume 六值封闭集）。

逐字错误锚来自 codex.exe 364.8MB 流式 strings 抽取，全部保真。
"""

from __future__ import annotations

from app.core.turn_resume_kind import (
    RESUME_KIND_VALUES,
    VERBATIM_JOB_LOCK_POISONED,
    VERBATIM_RESUME_PROCESS_FAILED_PREFIX,
    VERBATIM_STRUCT_COMPACTION_RESUME_METADATA,
    ResumeAction,
    ResumeInput,
    classify_resume_kind,
    is_cold_kind,
    is_fork_kind,
    is_fresh_kind,
)

# ── 1. 六值封闭集（可机检）─────────────────────────────────────────────────

def test_resume_kind_values_closed_set() -> None:
    assert RESUME_KIND_VALUES == (
        "new",
        "cleared",
        "cold_resume",
        "warm_fork",
        "cold_fork",
        "supplied_history",
    )


# ── 2. 非法 kind → FAILED ─────────────────────────────────────────────────

def test_unknown_kind_fails() -> None:
    out = classify_resume_kind(ResumeInput(kind="banana"))
    assert out.action is ResumeAction.FAILED
    assert "unknown resume kind" in out.evidence
    assert out.kind == "banana"


# ── 3. Windows job object 恢复（NTSTATUS）─────────────────────────────────

def test_resume_process_failure_includes_ntstatus() -> None:
    out = classify_resume_kind(
        ResumeInput(kind="cold_resume", has_suspended_process=True, ntstatus=3221225506)
    )
    assert out.action is ResumeAction.FAILED
    assert out.evidence == VERBATIM_RESUME_PROCESS_FAILED_PREFIX + "3221225506"
    assert out.kind == "cold_resume"


def test_resume_process_success_path() -> None:
    out = classify_resume_kind(
        ResumeInput(kind="cold_resume", has_suspended_process=True, ntstatus=0)
    )
    assert out.action is ResumeAction.RESUME_PROCESS
    assert "(ok)" in out.evidence


def test_job_lock_poisoned_fails() -> None:
    out = classify_resume_kind(
        ResumeInput(
            kind="cold_resume",
            has_suspended_process=True,
            ntstatus=0,
            job_lock_poisoned=True,
        )
    )
    assert out.action is ResumeAction.FAILED
    assert out.evidence == VERBATIM_JOB_LOCK_POISONED


# ── 4. cold 物化（cold_resume / cold_fork）────────────────────────────────

def test_cold_resume_without_metadata_fails() -> None:
    out = classify_resume_kind(ResumeInput(kind="cold_resume"))
    assert out.action is ResumeAction.FAILED
    assert out.evidence == VERBATIM_STRUCT_COMPACTION_RESUME_METADATA


def test_cold_resume_with_metadata_materializes() -> None:
    out = classify_resume_kind(
        ResumeInput(kind="cold_resume", has_resume_metadata=True)
    )
    assert out.action is ResumeAction.MATERIALIZE
    assert out.kind == "cold_resume"


def test_cold_fork_without_metadata_fails() -> None:
    out = classify_resume_kind(ResumeInput(kind="cold_fork"))
    assert out.action is ResumeAction.FAILED


def test_cold_fork_with_metadata_materializes() -> None:
    out = classify_resume_kind(
        ResumeInput(kind="cold_fork", has_resume_metadata=True)
    )
    assert out.action is ResumeAction.MATERIALIZE


# ── 5. warm_fork → FORK ───────────────────────────────────────────────────

def test_warm_fork_forks() -> None:
    out = classify_resume_kind(ResumeInput(kind="warm_fork"))
    assert out.action is ResumeAction.FORK
    assert out.kind == "warm_fork"


# ── 6. supplied_history（缺载荷拒 / 有载荷物化）───────────────────────────

def test_supplied_history_without_payload_rejects() -> None:
    out = classify_resume_kind(ResumeInput(kind="supplied_history"))
    assert out.action is ResumeAction.REJECT_SUPPLIED
    assert "requires history payload" in out.evidence


def test_supplied_history_with_payload_materializes() -> None:
    out = classify_resume_kind(
        ResumeInput(kind="supplied_history", has_supplied_history_payload=True)
    )
    assert out.action is ResumeAction.MATERIALIZE


# ── 7. new / cleared → START_FRESH ────────────────────────────────────────

def test_new_starts_fresh() -> None:
    out = classify_resume_kind(ResumeInput(kind="new"))
    assert out.action is ResumeAction.START_FRESH


def test_cleared_starts_fresh() -> None:
    out = classify_resume_kind(ResumeInput(kind="cleared"))
    assert out.action is ResumeAction.START_FRESH


# ── 8. fork / cold / fresh 分类辅助（可机检）──────────────────────────────

def test_kind_predicate_helpers() -> None:
    assert is_fork_kind("warm_fork") and is_fork_kind("cold_fork")
    assert not is_fork_kind("cold_resume")
    assert is_cold_kind("cold_resume") and is_cold_kind("cold_fork")
    assert not is_cold_kind("warm_fork")
    assert is_fresh_kind("new") and is_fresh_kind("cleared")
    assert not is_fresh_kind("cold_resume")


# ── 9. 反向变异：NTSTATUS=0 不应走 FAILED 路径 ────────────────────────────

def test_mutation_reversal_ntstatus_zero_not_failure() -> None:
    out = classify_resume_kind(
        ResumeInput(kind="cold_resume", has_suspended_process=True, ntstatus=0)
    )
    assert out.action is not ResumeAction.FAILED, (
        f"NTSTATUS=0 must not fail, got {out.action}: {out.evidence}"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
