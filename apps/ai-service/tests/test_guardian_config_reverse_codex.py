# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_config 行为测试(逆向 Codex GuardianV2ConfigToml/Transcript,2026-11-16)。

覆盖三面(逐条对齐 codex.exe 校验错误原文,取证见
``.ihui-agent/tmp/goal-codex/evidence/guardian-config-fields-scan.mjs``):
1. transcript 5 字段校验(entry ≤ transcript、recent 非负);
2. config 顶层校验(review_threshold ∈ [0,1]、conversation_token_limit > 0);
3. 配置 → 滑窗决策接线(blocking_risk_level / predictive_window)。

安全语义:所有非法配置 validate() 返回非空错误列表,绝不静默放行。
"""
from __future__ import annotations

from app.core.guardian_config import (
    GuardianConfigError,
    GuardianV2Config,
    GuardianV2ReviewScopeConfig,
    GuardianV2TranscriptConfig,
    default_guardian_v2_config,
)
from app.core.guardian_risk import GuardianRiskLevel
from app.core.guardian_scoring import (
    RiskAssessment,
    TrajectoryWindow,
    classify_needs_blocking_review,
)

# ---------- transcript 校验 ----------

def test_transcript_valid_when_empty():
    """全 None(未配置)= 合法,不报错。"""
    assert GuardianV2TranscriptConfig().validate() == []


def test_transcript_entry_exceeds_transcript_rejected():
    """codex 原文:entry_tokens must not exceed transcript_tokens。"""
    cfg = GuardianV2TranscriptConfig(
        max_message_entry_tokens=100,
        max_message_transcript_tokens=50,  # entry > transcript → 非法
    )
    errors = cfg.validate()
    assert any("must not exceed" in e for e in errors)
    assert any("max_message_entry_tokens" in e for e in errors)


def test_transcript_tool_entry_exceeds_transcript_rejected():
    cfg = GuardianV2TranscriptConfig(
        max_tool_entry_tokens=200,
        max_tool_transcript_tokens=100,
    )
    assert any("max_tool_entry_tokens" in e for e in cfg.validate())


def test_transcript_entry_equal_transcript_ok():
    """entry == transcript 合法(边界)。"""
    cfg = GuardianV2TranscriptConfig(
        max_message_entry_tokens=100,
        max_message_transcript_tokens=100,
    )
    assert cfg.validate() == []


def test_transcript_recent_non_positive_rejected():
    """codex 原文:max_recent_non_user_entries must be positive。"""
    assert any(
        "max_recent_non_user_entries must be positive" in e
        for e in GuardianV2TranscriptConfig(max_recent_non_user_entries=0).validate()
    )
    assert any(
        "max_recent_non_user_entries must be positive" in e
        for e in GuardianV2TranscriptConfig(max_recent_non_user_entries=-1).validate()
    )


def test_transcript_recent_positive_ok():
    assert GuardianV2TranscriptConfig(max_recent_non_user_entries=1).validate() == []


# ---------- config 顶层校验 ----------

def test_config_valid_when_empty():
    assert default_guardian_v2_config().validate() == []


def test_config_review_threshold_out_of_range_rejected():
    """codex 原文:review_threshold must be between 0.0 and 1.0。"""
    for bad in (-0.1, 1.1, 2.0):
        errors = GuardianV2Config(review_threshold=bad).validate()
        assert any("review_threshold must be between 0.0 and 1.0" in e for e in errors)


def test_config_review_threshold_boundary_ok():
    """0.0 和 1.0 是合法边界。"""
    assert GuardianV2Config(review_threshold=0.0).validate() == []
    assert GuardianV2Config(review_threshold=1.0).validate() == []


def test_config_conversation_token_limit_positive():
    """codex 原文:async_classifier_conversation_token_limit must be positive。"""
    errors = GuardianV2Config(async_classifier_conversation_token_limit=0).validate()
    assert any("must be positive" in e for e in errors)


def test_config_transcript_errors_propagate():
    """嵌套 transcript 错误冒泡到顶层 validate。"""
    cfg = GuardianV2Config(
        transcript=GuardianV2TranscriptConfig(max_recent_non_user_entries=0),
    )
    assert any("max_recent_non_user_entries" in e for e in cfg.validate())


def test_guardian_config_error_is_value_error():
    """GuardianConfigError 是 ValueError 子类(调用方 except ValueError 即捕获)。"""
    assert issubclass(GuardianConfigError, ValueError)


# ---------- 配置 → 滑窗决策接线 ----------

def test_blocking_level_default_is_high():
    """Codex 默认(review_threshold=None)= high+ 阻断(Prompt 原文)。"""
    assert default_guardian_v2_config().blocking_risk_level() is GuardianRiskLevel.HIGH


def test_blocking_level_aggressive_threshold():
    """低阈值(< 0.5)= medium+ 阻断(更激进)。"""
    assert GuardianV2Config(review_threshold=0.3).blocking_risk_level() is GuardianRiskLevel.MEDIUM


def test_blocking_level_lenient_threshold():
    """高阈值(>= 0.5)= 仅 critical 阻断(更宽松)。"""
    assert GuardianV2Config(review_threshold=0.5).blocking_risk_level() is GuardianRiskLevel.CRITICAL
    assert GuardianV2Config(review_threshold=0.9).blocking_risk_level() is GuardianRiskLevel.CRITICAL


def test_predictive_window_default():
    """默认滑窗 (5, 2) 逐字对齐 Codex Prompt。"""
    assert default_guardian_v2_config().predictive_window() == (5, 2)


def test_predictive_window_computer_use_only_tightens():
    """computer_use_only 收紧到 (3, 1)。"""
    cfg = GuardianV2Config(review_scope=GuardianV2ReviewScopeConfig(computer_use_only=True))
    assert cfg.predictive_window() == (3, 1)


def test_config_drives_sliding_window_decision():
    """端到端:配置的 review_scope 收紧滑窗,影响 Predictive 条件 (b) 判定。

    recent 里有 1 个 unknown 授权动作。默认滑窗 (5,2) 下它触发 (b);
    这里验证配置层能驱动 TrajectoryWindow 的窗口大小(调用方按 predictive_window 截断)。
    """
    cfg = GuardianV2Config(review_scope=GuardianV2ReviewScopeConfig(computer_use_only=True))
    recent, _ahead = cfg.predictive_window()
    # 按配置截断 recent 到窗口大小
    full_recent = [RiskAssessment.from_raw("low", "high")] * 3 + [
        RiskAssessment.from_raw("low", "unknown"),
    ]
    windowed = full_recent[-recent:] if len(full_recent) > recent else full_recent
    traj = TrajectoryWindow(current=RiskAssessment.from_raw("low", "high"), recent=windowed)
    # unknown 授权仍在窗内 → 触发条件 (b)
    needs, reason = classify_needs_blocking_review(traj)
    assert needs is True
    assert reason == "b-recent-authorization"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
