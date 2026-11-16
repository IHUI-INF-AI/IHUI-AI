# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_decisions_comparison 行为测试(按运行时行为规格 decisions_comparison,2026-11-16)。

覆盖四面(逐条对齐 外部程序 字段语义,取证见
``内部规格``):
1. normalize_classification:仅 high/low 有效,其余(含 None/空/其他)→ None;
2. compare_decisions 三态:agree / disagree / unavailable;
3. 线上决策恒取主后端(影子对照不影响线上放行)的安全不变式;
4. 枚举值按行为规格 外部实现(backend=responses/decisions;outcome=agree/disagree/unavailable)。
"""
from __future__ import annotations

import pytest

from app.core.guardian_decisions_comparison import (
    ClassificationVerdict,
    ComparisonOutcome,
    ComparisonResult,
    DecisionBackend,
    compare_decisions,
    normalize_classification,
)


# ---------- normalize_classification ----------

@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("high", ClassificationVerdict.HIGH),
        ("low", ClassificationVerdict.LOW),
        ("HIGH", ClassificationVerdict.HIGH),  # 大小写不敏感
        (" Low ", ClassificationVerdict.LOW),  # 含空白
    ],
)
def test_normalize_valid_verdicts(raw: str, expected: ClassificationVerdict):
    assert normalize_classification(raw) is expected


@pytest.mark.parametrize("raw", [None, "", "high-ish", "block", "allow", "medium"])
def test_normalize_invalid_returns_none(raw: str | None):
    """fail-closed:非 high/low 一律 None(该后端分类失败,计入 unavailable)。"""
    assert normalize_classification(raw) is None


# ---------- compare_decisions 三态 ----------

def test_agree_when_both_high():
    result = compare_decisions("high", "high")
    assert result.outcome is ComparisonOutcome.AGREE
    assert result.primary_verdict is ClassificationVerdict.HIGH
    assert result.shadow_verdict is ClassificationVerdict.HIGH


def test_agree_when_both_low():
    result = compare_decisions("low", "LOW")
    assert result.outcome is ComparisonOutcome.AGREE


def test_disagree_when_primary_high_shadow_low():
    result = compare_decisions("high", "low")
    assert result.outcome is ComparisonOutcome.DISAGREE
    assert result.primary_verdict is ClassificationVerdict.HIGH
    assert result.shadow_verdict is ClassificationVerdict.LOW


def test_disagree_when_primary_low_shadow_high():
    result = compare_decisions("low", "high")
    assert result.outcome is ComparisonOutcome.DISAGREE


def test_unavailable_when_shadow_failed():
    """影子后端失败(非 high/low)→ unavailable;主后端有效仍保留。"""
    result = compare_decisions("high", "")
    assert result.outcome is ComparisonOutcome.UNAVAILABLE
    assert result.primary_verdict is ClassificationVerdict.HIGH  # 线上决策依据保留
    assert result.shadow_verdict is None


def test_unavailable_when_primary_failed():
    """主后端失败 → unavailable,primary_verdict 为 None。"""
    result = compare_decisions(None, "high")
    assert result.outcome is ComparisonOutcome.UNAVAILABLE
    assert result.primary_verdict is None


def test_unavailable_when_both_failed():
    assert compare_decisions(None, None).outcome is ComparisonOutcome.UNAVAILABLE
    assert compare_decisions("", "garbage").outcome is ComparisonOutcome.UNAVAILABLE


# ---------- 线上决策安全不变式 ----------

def test_online_decision_follows_primary_on_disagree():
    """disagree 时线上放行恒取主后端(responses):primary=low → 放行,不受 shadow=high 影响。"""
    result = compare_decisions("low", "high")
    assert result.outcome is ComparisonOutcome.DISAGREE
    assert result.is_online_deciding is True
    assert result.primary_verdict is ClassificationVerdict.LOW  # 线上以 responses 为准


def test_online_decision_none_when_primary_unavailable():
    """主后端不可用 → is_online_deciding False(无有效线上决策,调用方须降级)。"""
    result = compare_decisions(None, "low")
    assert result.is_online_deciding is False


def test_shadow_never_overrides_primary():
    """安全不变式:无论 shadow 输出什么,primary_verdict 不被 shadow 覆盖。"""
    # shadow 说 high(阻断),primary 说 low(放行)→ 线上仍 low
    assert compare_decisions("low", "high").primary_verdict is ClassificationVerdict.LOW
    # shadow 说 low,primary 说 high → 线上仍 high
    assert compare_decisions("high", "low").primary_verdict is ClassificationVerdict.HIGH


# ---------- 枚举按行为规格 外部实现 ----------

def test_backend_enum_matches_codex():
    """按行为规格 外部实现.exe backend 命中值:responses / decisions。"""
    assert {b.value for b in DecisionBackend} == {"responses", "decisions"}


def test_comparison_outcome_enum_matches_codex():
    """按行为规格 外部实现.exe 对照三态:agree / disagree / unavailable。"""
    assert {o.value for o in ComparisonOutcome} == {"agree", "disagree", "unavailable"}


def test_verdict_enum_matches_codex_first_token():
    """按行为规格 外部实现.exe 分类首 token:high / low。"""
    assert {v.value for v in ClassificationVerdict} == {"high", "low"}


def test_comparison_result_is_frozen():
    """ComparisonResult 不可变(纯函数返回值,防调用方篡改对照信号)。"""
    result = compare_decisions("high", "high")
    with pytest.raises(Exception):
        result.outcome = ComparisonOutcome.DISAGREE  # type: ignore[misc]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
