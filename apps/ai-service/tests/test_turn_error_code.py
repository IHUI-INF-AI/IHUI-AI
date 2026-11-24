# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合细粒度错误码封闭集测试 —— 遵循统一工程规范。

取证纠偏：封闭集 43 成员来自 strings 观察候选（连续 token 拼接形态），非 schema
逐字段确证。测试双重标注：所有断言均以「对照物 strings 逐字锚」为基准，非凭空发明。
"""

from __future__ import annotations

import pytest

from app.core.turn_error_code import (
    UNDETERMINED_FAMILY,
    UNKNOWN_CODE,
    RecoveryFamily,
    TurnErrorCode,
    TurnErrorCodeClassification,
    classify_turn_error_code,
    turn_error_code_count,
)
from app.core.turn_error_kind import TurnErrorKind

# ---------------------------------------------------------------------------
# 封闭集完整性
# ---------------------------------------------------------------------------


class TestClosedSet:
    def test_member_count_is_43(self) -> None:
        """对照物 strings 逐字锚登记 43 个 turn 错误码成员。"""
        assert turn_error_code_count() == 43

    def test_enum_values_match_binary_tokens(self) -> None:
        """抽样对照 strings 逐字 token（连续块形态）。"""
        expected_anchors = {
            "session_budget_exceeded",
            "rate_limit_exceeded",
            "misalignment_policy_violation",
            "active_turn_not_steerable",
            "server_overloaded",
            "context_window_exceeded",
            "gateway_login_required",
        }
        actual = {m.value for m in TurnErrorCode}
        assert expected_anchors.issubset(actual)

    def test_no_status_axis_members(self) -> None:
        """状态轴 token（active/paused/blocked/…）**不得**混入错误码封闭集。"""
        status_tokens = {"active", "paused", "blocked", "usage_limited", "budget_limited", "complete"}
        actual = {m.value for m in TurnErrorCode}
        assert status_tokens.isdisjoint(actual)

    def test_turn_aborted_event_marker_excluded(self) -> None:
        """turn_aborted 是事件标记非错误码，不在封闭集。"""
        assert "turn_aborted" not in {m.value for m in TurnErrorCode}

    def test_recovery_family_has_four_values(self) -> None:
        assert {r.value for r in RecoveryFamily} == {
            "retryable",
            "terminal",
            "fatal",
            "undetermined",
        }


# ---------------------------------------------------------------------------
# classify_turn_error_code —— 二维归属
# ---------------------------------------------------------------------------


class TestClassifyKnownCodes:
    def test_interrupted_maps_to_interrupted_kind_terminal(self) -> None:
        c = classify_turn_error_code("interrupted")
        assert c.kind == TurnErrorKind.INTERRUPTED
        assert c.recovery == RecoveryFamily.TERMINAL

    def test_thread_not_found_maps_to_not_found_kind(self) -> None:
        c = classify_turn_error_code("thread_not_found")
        assert c.kind == TurnErrorKind.NOT_FOUND
        assert c.recovery == RecoveryFamily.TERMINAL

    def test_misalignment_maps_to_misalignment_kind(self) -> None:
        c = classify_turn_error_code("misalignment_policy_violation")
        assert c.kind == TurnErrorKind.MISALIGNMENT
        assert c.recovery == RecoveryFamily.TERMINAL

    def test_cyber_policy_maps_to_misalignment(self) -> None:
        c = classify_turn_error_code("cyber_policy")
        assert c.kind == TurnErrorKind.MISALIGNMENT

    def test_rate_limit_is_retryable(self) -> None:
        """对照物 error taxonomy: 429 rate_limit ∈ Retryable。"""
        c = classify_turn_error_code("rate_limit_exceeded")
        assert c.recovery == RecoveryFamily.RETRYABLE
        assert c.kind == TurnErrorKind.ERRORED

    def test_server_overloaded_is_retryable(self) -> None:
        c = classify_turn_error_code("server_overloaded")
        assert c.recovery == RecoveryFamily.RETRYABLE

    def test_timeout_is_retryable(self) -> None:
        c = classify_turn_error_code("timeout")
        assert c.recovery == RecoveryFamily.RETRYABLE

    def test_budget_exceeded_is_terminal_not_retryable(self) -> None:
        """额度耗尽重试同请求不会恢复额度，归终态。"""
        c = classify_turn_error_code("session_budget_exceeded")
        assert c.recovery == RecoveryFamily.TERMINAL

    def test_refresh_token_failed_is_fatal(self) -> None:
        c = classify_turn_error_code("refresh_token_failed")
        assert c.recovery == RecoveryFamily.FATAL

    def test_gateway_login_required_is_fatal(self) -> None:
        c = classify_turn_error_code("gateway_login_required")
        assert c.recovery == RecoveryFamily.FATAL

    def test_internal_agent_died_is_fatal(self) -> None:
        c = classify_turn_error_code("internal_agent_died")
        assert c.recovery == RecoveryFamily.FATAL

    def test_active_turn_not_steerable_is_terminal(self) -> None:
        c = classify_turn_error_code("active_turn_not_steerable")
        assert c.recovery == RecoveryFamily.TERMINAL
        assert c.kind == TurnErrorKind.ERRORED

    def test_landlock_recognized_but_not_in_enum(self) -> None:
        """landlock 单独登记映射，不计入封闭集成员数。"""
        c = classify_turn_error_code("landlock_sandbox_executable_not_provided")
        assert c.recovery == RecoveryFamily.FATAL
        assert "landlock_sandbox_executable_not_provided" not in {
            m.value for m in TurnErrorCode
        }


class TestUnknownCodeFallback:
    def test_none_returns_unknown_undetermined(self) -> None:
        c = classify_turn_error_code(None)
        assert c.code == UNKNOWN_CODE
        assert c.recovery == RecoveryFamily.UNDETERMINED
        assert c.kind == TurnErrorKind.ERRORED

    def test_empty_string_returns_unknown(self) -> None:
        c = classify_turn_error_code("")
        assert c.code == UNKNOWN_CODE
        assert c.recovery == RecoveryFamily.UNDETERMINED

    def test_gibberish_returns_unknown(self) -> None:
        c = classify_turn_error_code("totally_made_up_code_xyz")
        assert c.code == UNKNOWN_CODE
        assert c.recovery == RecoveryFamily.UNDETERMINED

    def test_whitespace_only_returns_unknown(self) -> None:
        c = classify_turn_error_code("   ")
        assert c.code == UNKNOWN_CODE

    def test_leading_trailing_whitespace_normalized(self) -> None:
        """strip 归一化：前后空白应被忽略，仍命中已知码。"""
        c = classify_turn_error_code("  rate_limit_exceeded  ")
        assert c.code == "rate_limit_exceeded"
        assert c.recovery == RecoveryFamily.RETRYABLE


# ---------------------------------------------------------------------------
# 反向变异测试：防后人踩
# ---------------------------------------------------------------------------


class TestReverseMutations:
    """改坏判据应转红。"""

    def test_rate_limit_must_not_be_terminal(self) -> None:
        """若误判 rate_limit 为终态，此测试暴露。"""
        c = classify_turn_error_code("rate_limit_exceeded")
        assert c.recovery != RecoveryFamily.TERMINAL

    def test_budget_must_not_be_retryable(self) -> None:
        """若误判 budget 为可重试（无限额度循环），此测试暴露。"""
        c = classify_turn_error_code("session_budget_exceeded")
        assert c.recovery != RecoveryFamily.RETRYABLE

    def test_unknown_must_not_be_retryable(self) -> None:
        """未知码保守归 undetermined，不得误升级为可重试。"""
        c = classify_turn_error_code("???")
        assert c.recovery != RecoveryFamily.RETRYABLE
        assert c.recovery != RecoveryFamily.TERMINAL

    def test_misalignment_must_not_be_retryable(self) -> None:
        """策略拒绝不可重试（重试同请求仍被拒）。"""
        c = classify_turn_error_code("misalignment_policy_violation")
        assert c.recovery != RecoveryFamily.RETRYABLE

    def test_interrupted_must_not_be_retryable(self) -> None:
        """用户中断不可自动重试（人意志凌驾自动恢复）。"""
        c = classify_turn_error_code("interrupted")
        assert c.recovery != RecoveryFamily.RETRYABLE

    def test_status_axis_isolation(self) -> None:
        """状态轴 token 不应被 classify 识别为错误码（应归 unknown）。"""
        c = classify_turn_error_code("active")
        assert c.code == UNKNOWN_CODE

    def test_all_enum_members_have_classification(self) -> None:
        """封闭集每个成员都应能被 classify 命中，不落 unknown。"""
        for member in TurnErrorCode:
            c = classify_turn_error_code(member.value)
            assert c.code == member.value, f"member {member.value} 落 unknown"


# ---------------------------------------------------------------------------
# 数据类不可变性
# ---------------------------------------------------------------------------


class TestDataclassImmutability:
    def test_classification_is_frozen(self) -> None:
        c = classify_turn_error_code("timeout")
        with pytest.raises(AttributeError):
            c.code = "other"  # type: ignore[misc]

    def test_classification_equality(self) -> None:
        a = classify_turn_error_code("timeout")
        b = classify_turn_error_code("timeout")
        assert a == b

    def test_classification_is_dataclass(self) -> None:
        c = classify_turn_error_code("other")
        assert isinstance(c, TurnErrorCodeClassification)

    def test_undetermined_family_value_is_string(self) -> None:
        assert UNDETERMINED_FAMILY == "undetermined"
        assert isinstance(UNDETERMINED_FAMILY, str)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
