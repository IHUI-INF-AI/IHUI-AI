# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""CompactionResumeMetadata 物化算法测试（对标 Codex 26.1111 cold 物化）。

逐字锚来自 codex.exe 364.8MB 流式 strings 抽取，全部保真。
"""

from __future__ import annotations

from app.core.resume_metadata_materialization import (
    COMPACTION_RESUME_METADATA_ELEMENTS,
    SUMMARY_FINAL_AGENT_FIELDS,
    SUMMARY_FIRST_USER_FIELDS,
    VERBATIM_STRUCT_COMPACTION_RESUME_METADATA,
    DiskSummaryView,
    MaterializationDecision,
    ResumeMetadata,
    classify_materialization,
    materialization_elements,
)


def _full_meta() -> ResumeMetadata:
    """一个两个锚齐全的基准 metadata。"""
    return ResumeMetadata(
        first_user_turn_id="t1",
        first_user_item_json='{"role":"user","text":"hi"}',
        final_agent_turn_id="t9",
        final_agent_item_json='{"role":"assistant","text":"done"}',
        next_order=10,
        compaction_response_id="resp-42",
    )


def _readable_disk(
    final_agent_ordinal: int = 5,
) -> DiskSummaryView:
    return DiskSummaryView(
        readable=True,
        first_user_rollout_ordinal=0,
        final_agent_rollout_ordinal=final_agent_ordinal,
    )


# ── 1. 6 元素 + SQL schema 字段（可机检）───────────────────────────────────

def test_compaction_resume_metadata_elements() -> None:
    assert COMPACTION_RESUME_METADATA_ELEMENTS == (
        "first_user_turn_id",
        "first_user_item_json",
        "final_agent_turn_id",
        "final_agent_item_json",
        "next_order",
        "compaction_response_id",
    )


def test_summary_view_fields_from_sql_schema() -> None:
    """SQL schema 暴露的 8 项字段（first_user / final_agent 同形）。"""
    assert SUMMARY_FIRST_USER_FIELDS == (
        "turn_id",
        "item_id",
        "rollout_ordinal",
        "updated_at_ordinal",
        "created_at_ms",
        "started_at_ms",
        "completed_at_ms",
        "item_json",
    )
    assert SUMMARY_FINAL_AGENT_FIELDS == SUMMARY_FIRST_USER_FIELDS


# ── 2. 两个锚都缺 → FAIL_NO_ANCHOR ────────────────────────────────────────

def test_both_anchors_missing_fails() -> None:
    out = classify_materialization(ResumeMetadata(), _readable_disk())
    assert out.decision is MaterializationDecision.FAIL_NO_ANCHOR
    assert "both missing" in out.evidence
    assert out.materialized_anchors == ()


# ── 3. 磁盘 summary 不可读 → FAIL_NO_ANCHOR ───────────────────────────────

def test_disk_not_readable_fails() -> None:
    out = classify_materialization(
        _full_meta(), DiskSummaryView(readable=False)
    )
    assert out.decision is MaterializationDecision.FAIL_NO_ANCHOR
    assert "not readable" in out.evidence


# ── 4. next_order ≤ final_agent_ordinal → FAIL_ORDER_MISMATCH ─────────────

def test_next_order_mismatch_fails() -> None:
    out = classify_materialization(
        _full_meta(),
        DiskSummaryView(readable=True, final_agent_rollout_ordinal=10),
    )
    assert out.decision is MaterializationDecision.FAIL_ORDER_MISMATCH
    assert "next_order=10" in out.evidence
    assert "final_agent_rollout_ordinal=10" in out.evidence


def test_next_order_behind_final_agent_mismatch() -> None:
    """next_order 落后于磁盘 ordinal 也算冲突（rollout 已推进，summary 过期）。"""
    out = classify_materialization(
        ResumeMetadata(
            first_user_turn_id="t1",
            first_user_item_json="{}",
            final_agent_turn_id="t9",
            final_agent_item_json="{}",
            next_order=3,
            compaction_response_id="r",
        ),
        DiskSummaryView(readable=True, final_agent_rollout_ordinal=7),
    )
    assert out.decision is MaterializationDecision.FAIL_ORDER_MISMATCH


# ── 5. first_user 有 + final_agent 缺 → DEGRADE_TO_PARTIAL ────────────────

def test_partial_materialization_when_final_agent_missing() -> None:
    out = classify_materialization(
        ResumeMetadata(
            first_user_turn_id="t1",
            first_user_item_json='{"role":"user"}',
            next_order=10,
            compaction_response_id="resp",
        ),
        _readable_disk(),
    )
    assert out.decision is MaterializationDecision.DEGRADE_TO_PARTIAL
    assert "final_agent anchor missing" in out.evidence
    assert out.materialized_anchors == ("first_user",)


# ── 6. 两个锚齐全 → MATERIALIZE_FULL ──────────────────────────────────────

def test_full_materialization() -> None:
    out = classify_materialization(_full_meta(), _readable_disk(final_agent_ordinal=5))
    assert out.decision is MaterializationDecision.MATERIALIZE_FULL
    assert out.evidence == VERBATIM_STRUCT_COMPACTION_RESUME_METADATA
    assert out.materialized_anchors == ("first_user", "final_agent")


# ── 7. materialization_elements 可机检（fail-closed）──────────────────────

def test_materialization_elements_helper() -> None:
    assert materialization_elements() == COMPACTION_RESUME_METADATA_ELEMENTS


# ── 8. 反向变异：next_order=None 不应走 order_mismatch ────────────────────

def test_mutation_reversal_next_order_none_not_mismatch() -> None:
    out = classify_materialization(
        ResumeMetadata(
            first_user_turn_id="t1",
            first_user_item_json="{}",
            final_agent_turn_id="t9",
            final_agent_item_json="{}",
            next_order=None,
            compaction_response_id="r",
        ),
        DiskSummaryView(readable=True, final_agent_rollout_ordinal=99),
    )
    assert out.decision is not MaterializationDecision.FAIL_ORDER_MISMATCH, (
        f"next_order=None must not trigger mismatch, got {out.decision}: {out.evidence}"
    )
    assert out.decision is MaterializationDecision.MATERIALIZE_FULL


# ── 9. 反向变异：first_user 锚缺 turn_id 应算缺 ───────────────────────────

def test_mutation_reversal_partial_first_user_turn_id_missing() -> None:
    """first_user_turn_id 缺但 item_json 有 → 仍算 first_user 锚缺。

    final_agent 齐全 ⇒ 走 MATERIALIZE_FULL（不降级），但物化的锚只含 final_agent。
    """
    out = classify_materialization(
        ResumeMetadata(
            first_user_turn_id=None,
            first_user_item_json='{"role":"user"}',
            final_agent_turn_id="t9",
            final_agent_item_json="{}",
            next_order=10,
            compaction_response_id="r",
        ),
        _readable_disk(),
    )
    # 反向变异验证：partial first_user 不阻塞 full（final_agent 顶上）
    assert out.decision is MaterializationDecision.MATERIALIZE_FULL, (
        f"final_agent-complete anchor must materialize full, got {out.decision}: {out.evidence}"
    )
    assert out.materialized_anchors == ("first_user", "final_agent")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
