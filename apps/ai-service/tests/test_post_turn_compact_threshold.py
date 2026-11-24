# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回合后压缩阈值测试 —— 遵循统一工程规范。

取证纠偏：对照逐字确证边界 ``must be between 0 and 100`` 与字段名；默认值/触发时机/
与 in-turn trigger_ratio 优先级未从二进制确证，已双重标注。
"""

from __future__ import annotations

import pytest

from app.core.post_turn_compact_threshold import (
    DEFAULT_POST_TURN_COMPACT_THRESHOLD_PERCENT,
    MAX_POST_TURN_COMPACT_THRESHOLD_PERCENT,
    MIN_POST_TURN_COMPACT_THRESHOLD_PERCENT,
    PostTurnCompactThresholdError,
    is_post_turn_compaction_triggered,
    validate_post_turn_compact_threshold,
)


class TestValidateBounds:
    def test_zero_is_valid(self) -> None:
        assert validate_post_turn_compact_threshold(0.0) == 0.0

    def test_hundred_is_valid(self) -> None:
        assert validate_post_turn_compact_threshold(100.0) == 100.0

    def test_midpoint_is_valid(self) -> None:
        assert validate_post_turn_compact_threshold(80.0) == 80.0

    def test_below_zero_raises(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError, match="between 0 and 100"):
            validate_post_turn_compact_threshold(-0.1)

    def test_above_hundred_raises(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError, match="between 0 and 100"):
            validate_post_turn_compact_threshold(100.1)

    def test_nan_raises(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError):
            validate_post_turn_compact_threshold(float("nan"))

    def test_inf_raises(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError):
            validate_post_turn_compact_threshold(float("inf"))

    def test_non_numeric_raises(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError):
            validate_post_turn_compact_threshold("80")  # type: ignore[arg-type]

    def test_bool_rejected(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError):
            validate_post_turn_compact_threshold(True)  # type: ignore[arg-type]


class TestBoundaryConstants:
    def test_min_is_zero(self) -> None:
        assert MIN_POST_TURN_COMPACT_THRESHOLD_PERCENT == 0.0

    def test_max_is_hundred(self) -> None:
        assert MAX_POST_TURN_COMPACT_THRESHOLD_PERCENT == 100.0

    def test_default_in_range(self) -> None:
        assert (
            MIN_POST_TURN_COMPACT_THRESHOLD_PERCENT
            <= DEFAULT_POST_TURN_COMPACT_THRESHOLD_PERCENT
            <= MAX_POST_TURN_COMPACT_THRESHOLD_PERCENT
        )


class TestTriggerJudgement:
    def test_at_threshold_triggers(self) -> None:
        """used/limit 达阈值即触发（>= 语义）。"""
        assert is_post_turn_compaction_triggered(
            used_tokens=80.0, limit_tokens=100.0, threshold_percent=80.0
        ) is True

    def test_below_threshold_not_triggered(self) -> None:
        assert is_post_turn_compaction_triggered(
            used_tokens=79.0, limit_tokens=100.0, threshold_percent=80.0
        ) is False

    def test_default_threshold_used(self) -> None:
        assert is_post_turn_compaction_triggered(
            used_tokens=DEFAULT_POST_TURN_COMPACT_THRESHOLD_PERCENT, limit_tokens=100.0
        ) is True

    def test_zero_limit_returns_false_not_crash(self) -> None:
        """limit<=0 未判定返回 False，不拿 0 分母冒充触发（§0 铁律 3）。"""
        assert is_post_turn_compaction_triggered(
            used_tokens=0.0, limit_tokens=0.0, threshold_percent=80.0
        ) is False

    def test_invalid_threshold_raises(self) -> None:
        with pytest.raises(PostTurnCompactThresholdError):
            is_post_turn_compaction_triggered(
                used_tokens=10.0, limit_tokens=100.0, threshold_percent=101.0
            )


class TestReverseMutations:
    def test_threshold_is_out_of_hundred_bounds(self) -> None:
        """校验若放宽到 >100 应转红。"""
        with pytest.raises(PostTurnCompactThresholdError):
            validate_post_turn_compact_threshold(100.5)

    def test_at_threshold_must_trigger(self) -> None:
        """若误把 >= 改成 >（达阈值不触发），此测试暴露。"""
        assert is_post_turn_compaction_triggered(
            used_tokens=80.0, limit_tokens=100.0, threshold_percent=80.0
        ) is True

    def test_zero_limit_must_not_trigger(self) -> None:
        assert is_post_turn_compaction_triggered(
            used_tokens=0.0, limit_tokens=0.0, threshold_percent=0.0
        ) is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
