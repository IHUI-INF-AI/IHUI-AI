# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_risk + ToolAnnotations.idempotent_hint 行为测试(逆向 Codex,2026-11-16)。

覆盖三面:
1. ``GuardianRiskLevel`` 四档枚举 + 阻断语义(high/critical → is_blocking);
2. ``normalize_risk_level`` 归一化(既有散落字符串 none/med/crit → 唯一枚举;未知 → None 不猜档);
3. ``GuardianAssessmentStatus`` / ``GuardianReviewReason`` 终态/九档原因;
4. ``risk_level_allows_auto_approve`` fail-closed(未判定/阻断级/非只读 → False);
5. ``ToolAnnotations`` 第五维 ``idempotent_hint`` 向后兼容(默认 None,不破坏三维构造)。
"""

from __future__ import annotations

import pytest

from app.core.guardian_risk import (
    GuardianAssessmentStatus,
    GuardianReviewReason,
    GuardianRiskLevel,
    normalize_risk_level,
    risk_level_allows_auto_approve,
)
from app.core.mcp_tool_approval import ToolAnnotations, requires_mcp_tool_approval

# ---------- GuardianRiskLevel ----------

def test_risk_level_four_tiers():
    assert {r.value for r in GuardianRiskLevel} == {"low", "medium", "high", "critical"}


def test_risk_level_blocking_semantics():
    """Codex 语义:high/critical 触发阻断复核;low/medium 不阻断。"""
    assert GuardianRiskLevel.LOW.is_blocking is False
    assert GuardianRiskLevel.MEDIUM.is_blocking is False
    assert GuardianRiskLevel.HIGH.is_blocking is True
    assert GuardianRiskLevel.CRITICAL.is_blocking is True


# ---------- normalize_risk_level ----------

@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("none", GuardianRiskLevel.LOW),  # agent_loop_v2 占位
        ("low", GuardianRiskLevel.LOW),
        ("med", GuardianRiskLevel.MEDIUM),  # injection_event_recorder 口径
        ("medium", GuardianRiskLevel.MEDIUM),
        ("high", GuardianRiskLevel.HIGH),
        ("crit", GuardianRiskLevel.CRITICAL),
        ("critical", GuardianRiskLevel.CRITICAL),
        ("HIGH", GuardianRiskLevel.HIGH),  # 大小写不敏感
        (" Critical ", GuardianRiskLevel.CRITICAL),  # 含空白
    ],
)
def test_normalize_known_aliases(raw: str, expected: GuardianRiskLevel):
    assert normalize_risk_level(raw) is expected


@pytest.mark.parametrize("raw", [None, "", "unknown", "extreme", "  ", "low-ish"])
def test_normalize_unknown_returns_none(raw: str | None):
    """fail-closed:未知**返回 None**,调用方按未判定处理,不得默认 low。"""
    assert normalize_risk_level(raw) is None


# ---------- GuardianAssessmentStatus ----------

def test_assessment_status_terminal():
    assert GuardianAssessmentStatus.PENDING.is_terminal is False
    assert GuardianAssessmentStatus.APPROVED.is_terminal is True
    assert GuardianAssessmentStatus.DENIED.is_terminal is True
    assert GuardianAssessmentStatus.TIMED_OUT.is_terminal is True
    assert GuardianAssessmentStatus.ABORTED.is_terminal is True


def test_assessment_status_values_match_codex():
    """逐字对齐 Codex ``approved | denied | timed_out | aborted`` + 本仓补 pending 中间态。

    R30(2026-11-18) 补 ``aborted``:外部程序 strings 逐字锚
    ``request_permissions+approved/denied/timed_out/aborted`` + ``ElicitationAbandoned``。
    """
    assert {s.value for s in GuardianAssessmentStatus} == {
        "pending", "approved", "denied", "timed_out", "aborted",
    }


# ---------- GuardianReviewReason ----------

def test_review_reason_nine_tiers_match_codex():
    """逐字对齐 Codex 九档原因(codex.exe 原词全命中)。"""
    assert {r.value for r in GuardianReviewReason} == {
        "policy", "fresh_required", "missing_scores", "stale_scores",
        "invalid_scores", "incompatible_compaction", "elevated_risk",
        "scoring_failure", "authorization_changed",
    }


# ---------- risk_level_allows_auto_approve ----------

def test_auto_approve_fail_closed_on_undetermined():
    """未判定(None / 未知串)一律不允许自动放行。"""
    assert risk_level_allows_auto_approve(None, annotations_read_only=True) is False
    assert risk_level_allows_auto_approve("unknown", annotations_read_only=True) is False


def test_auto_approve_blocking_levels_denied():
    """high/critical 即使只读也不自动放行(阻断复核优先)。"""
    assert risk_level_allows_auto_approve("high", annotations_read_only=True) is False
    assert risk_level_allows_auto_approve("critical", annotations_read_only=True) is False


def test_auto_approve_read_only_low_risk():
    """low/medium + 只读 → 自动放行。"""
    assert risk_level_allows_auto_approve("low", annotations_read_only=True) is True
    assert risk_level_allows_auto_approve("medium", annotations_read_only=True) is True


def test_auto_approve_non_read_only_requires_human():
    """low/medium 但非只读(写操作)→ 人工确认,不自动放行。"""
    assert risk_level_allows_auto_approve("low", annotations_read_only=False) is False
    assert risk_level_allows_auto_approve("low", annotations_read_only=None) is False


# ---------- ToolAnnotations.idempotent_hint ----------

def test_tool_annotations_default_unchanged():
    """三维构造向后兼容:idempotent_hint 默认 None,不破坏既有调用点。"""
    ann = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=False)
    assert ann.idempotent_hint is None
    assert ann.is_idempotent is False
    assert ann.is_known is False  # idempotent 缺失 → 非全显式


def test_tool_annotations_idempotent_flag():
    ann = ToolAnnotations(idempotent_hint=True)
    assert ann.is_idempotent is True
    ann_all = ToolAnnotations(
        read_only_hint=True, destructive_hint=False,
        idempotent_hint=True, open_world_hint=False,
    )
    assert ann_all.is_known is True


def test_idempotent_does_not_lower_approval_bar():
    """幂等 hint 不降低审批门槛:destructive=True 仍需批(破坏性判定独立)。"""
    ann = ToolAnnotations(read_only_hint=False, destructive_hint=True, idempotent_hint=True)
    assert requires_mcp_tool_approval(ann) is True


def test_idempotent_read_only_still_no_approval():
    """只读 + 幂等:本就不需批(idempotent 不改变结果,纯信息)。"""
    ann = ToolAnnotations(read_only_hint=True, idempotent_hint=True)
    assert requires_mcp_tool_approval(ann) is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
