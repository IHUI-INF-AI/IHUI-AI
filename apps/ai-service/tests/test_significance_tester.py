"""SignificanceTester 显著性检验器测试(L5-3,2026-07-25 立)。

覆盖 significance_tester.py:
- _erf / _normal_cdf / _normal_sf 数学函数
- _proportion_z_test 两总体比例 z-test
- _welch_t_test Welch's t-test
- SignificanceTester.test 主入口
  - 样本量不足 → inconclusive
  - treatment 显著优于 control → promote
  - treatment 显著劣于 control → rollback
  - 多指标方向冲突 → inconclusive
  - 差异不显著 → inconclusive
- 全局单例 significance_tester
"""

from __future__ import annotations

import math

import pytest

from app.services.ab_test_tracker import _empty_stats, _merge_stats_add
from app.services.significance_tester import (
    SignificanceTester,
    _erf,
    _normal_cdf,
    _proportion_z_test,
    _welch_t_test,
    significance_tester,
)


# =============================================================================
# _erf / _normal_cdf 数学函数
# =============================================================================


class TestErf:
    """_erf Abramowitz and Stegun 7.1.26 近似。"""

    def test_zero(self):
        # erf(0) ≈ 0(浮点近似 1e-9 量级误差)
        assert abs(_erf(0.0)) < 1e-6

    def test_positive(self):
        # erf(1) ≈ 0.8427
        assert abs(_erf(1.0) - 0.8427) < 0.01

    def test_negative_symmetric(self):
        # erf(-x) = -erf(x)
        assert abs(_erf(-1.0) + _erf(1.0)) < 1e-6

    def test_large_x(self):
        # erf(3) ≈ 0.99998
        assert abs(_erf(3.0) - 1.0) < 1e-3


class TestNormalCdf:
    """_normal_cdf 标准正态分布 CDF。"""

    def test_zero(self):
        # Φ(0) = 0.5(浮点近似 1e-9 量级误差)
        assert abs(_normal_cdf(0.0) - 0.5) < 1e-6

    def test_positive(self):
        # Φ(1.96) ≈ 0.975(95% 置信)
        assert abs(_normal_cdf(1.96) - 0.975) < 0.01

    def test_negative(self):
        # Φ(-1.96) ≈ 0.025
        assert abs(_normal_cdf(-1.96) - 0.025) < 0.01

    def test_monotonic(self):
        # CDF 单调递增
        assert _normal_cdf(-1.0) < _normal_cdf(0.0) < _normal_cdf(1.0)


# =============================================================================
# _merge_stats_add 累加
# =============================================================================


class TestMergeStatsAdd:
    """_merge_stats_add 累加一次调用到 stats。"""

    def test_first_success(self):
        stats = _empty_stats()
        new = _merge_stats_add(stats, success=True, duration_ms=100.0, tokens=50)
        assert new["success_count"] == 1
        assert new["failure_count"] == 0
        assert new["duration_ms_sum"] == 100.0
        assert new["duration_ms_sum_sq"] == 10000.0  # 100^2
        assert new["tokens_sum"] == 50
        assert new["tokens_sum_sq"] == 2500.0  # 50^2

    def test_first_failure(self):
        stats = _empty_stats()
        new = _merge_stats_add(stats, success=False, duration_ms=200.0, tokens=30)
        assert new["success_count"] == 0
        assert new["failure_count"] == 1
        assert new["duration_ms_sum"] == 200.0
        assert new["tokens_sum"] == 30

    def test_does_not_mutate_original(self):
        stats = _empty_stats()
        _merge_stats_add(stats, success=True, duration_ms=100.0, tokens=50)
        # 原 stats 应保持不变
        assert stats["success_count"] == 0
        assert stats["duration_ms_sum"] == 0.0

    def test_cumulative(self):
        stats = _empty_stats()
        stats = _merge_stats_add(stats, success=True, duration_ms=100.0, tokens=50)
        stats = _merge_stats_add(stats, success=True, duration_ms=200.0, tokens=100)
        stats = _merge_stats_add(stats, success=False, duration_ms=300.0, tokens=150)
        assert stats["success_count"] == 2
        assert stats["failure_count"] == 1
        assert stats["duration_ms_sum"] == 600.0  # 100+200+300
        assert stats["duration_ms_sum_sq"] == 100**2 + 200**2 + 300**2  # 140000
        assert stats["duration_ms_sum_sq"] == 140000.0
        assert stats["tokens_sum"] == 300
        assert stats["tokens_sum_sq"] == 50**2 + 100**2 + 150**2  # 35000


# =============================================================================
# _proportion_z_test 两总体比例 z-test
# =============================================================================


class TestProportionZTest:
    """_proportion_z_test 成功率检验。"""

    def test_equal_proportions(self):
        # 50/100 vs 50/100 → diff=0, p_value=1.0
        result = _proportion_z_test(50, 100, 50, 100)
        assert result["p1"] == 0.5
        assert result["p2"] == 0.5
        assert result["diff"] == 0.0
        assert result["p_value"] > 0.99  # 无差异

    def test_treatment_better_significant(self):
        # 50/100 vs 70/100 → treatment 显著好
        result = _proportion_z_test(50, 100, 70, 100)
        assert result["diff"] > 0.0
        assert result["p_value"] < 0.05  # 显著

    def test_treatment_worse_significant(self):
        # 70/100 vs 50/100 → treatment 显著差
        result = _proportion_z_test(70, 100, 50, 100)
        assert result["diff"] < 0.0
        assert result["p_value"] < 0.05

    def test_zero_n(self):
        # n=0 → p_value=1.0
        result = _proportion_z_test(0, 0, 0, 0)
        assert result["p_value"] == 1.0

    def test_p_zero_or_one(self):
        # p=0(pooled proportion 边界)→ p_value=1.0
        result = _proportion_z_test(0, 10, 0, 10)
        assert result["p_value"] == 1.0

    def test_p_one(self):
        # p=1 → p_value=1.0
        result = _proportion_z_test(10, 10, 10, 10)
        assert result["p_value"] == 1.0


# =============================================================================
# _welch_t_test Welch's t-test
# =============================================================================


class TestWelchTTest:
    """_welch_t_test 连续值检验。"""

    def test_equal_means(self):
        # 两组相同 mean → diff=0
        # sum=100, sum_sq=1000, n=10 → mean=10, var=(1000-100^2/10)/9 = 0
        # 0 方差 → p_value=1.0
        result = _welch_t_test(100, 1000, 10, 100, 1000, 10)
        assert result["mean1"] == 10.0
        assert result["mean2"] == 10.0
        assert result["diff"] == 0.0
        assert result["p_value"] == 1.0  # 方差=0 → 无差异

    def test_treatment_lower_duration(self):
        # control: mean=100, treatment: mean=80(treatment 更快)
        # sum=1000, sum_sq=110000, n=10 → mean=100, var=(110000-100000)/9=1111
        # treatment: sum=800, sum_sq=90000, n=10 → mean=80, var=(90000-64000)/9=2889
        result = _welch_t_test(1000, 110000, 10, 800, 90000, 10)
        assert result["mean1"] == 100.0
        assert result["mean2"] == 80.0
        assert result["diff"] == -20.0  # treatment 比 control 低 20
        # 显著(但样本量小,可能 p_value 较大)
        assert result["t"] < 0.0  # t-statistic < 0 表示 treatment < control

    def test_insufficient_samples(self):
        # n<=1 → p_value=1.0
        result = _welch_t_test(100, 10000, 1, 80, 6400, 1)
        assert result["p_value"] == 1.0


# =============================================================================
# SignificanceTester.test 主入口
# =============================================================================


def _make_stats(
    n_success: int,
    n_failure: int,
    durations: list[float],
    tokens: list[int],
) -> dict:
    """构造 stats 字典(便于测试)。"""
    stats = _empty_stats()
    for _ in range(n_success):
        stats = _merge_stats_add(stats, True, 0.0, 0)
    for _ in range(n_failure):
        stats = _merge_stats_add(stats, False, 0.0, 0)
    for d in durations:
        # 用 _merge_stats_add 但不带 success(不能,只能 success/failure 二选一)
        # 简化:duration 累加通过 _merge_stats_add(success=True)然后单独管理
        pass
    # 简化实现:直接累加 duration 和 token
    if durations:
        stats["duration_ms_sum"] = sum(durations)
        stats["duration_ms_sum_sq"] = sum(d * d for d in durations)
    if tokens:
        stats["tokens_sum"] = sum(tokens)
        stats["tokens_sum_sq"] = sum(t * t for t in tokens)
    return stats


class TestSignificanceTesterTest:
    """SignificanceTester.test 主入口。"""

    def test_insufficient_samples_inconclusive(self):
        """样本量 < min_sample_size → inconclusive。"""
        control = _make_stats(5, 0, [100.0], [50])  # n=5
        treatment = _make_stats(5, 0, [100.0], [50])  # n=5
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "inconclusive"
        assert "样本量不足" in result["reason"]
        assert result["controlSamples"] == 5
        assert result["treatmentSamples"] == 5

    def test_treatment_better_promote(self):
        """treatment 成功率显著优于 control → promote。"""
        # control: 50/100=50%, treatment: 80/100=80% → 显著差异
        control = _make_stats(50, 50, [], [])
        treatment = _make_stats(80, 20, [], [])
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "promote"
        assert "显著优于" in result["reason"]

    def test_treatment_worse_rollback(self):
        """treatment 成功率显著劣于 control → rollback。"""
        # control: 80/100=80%, treatment: 50/100=50% → 显著差异(treatment 差)
        control = _make_stats(80, 20, [], [])
        treatment = _make_stats(50, 50, [], [])
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "rollback"
        assert "显著劣于" in result["reason"]

    def test_no_significance_inconclusive(self):
        """差异不显著 → inconclusive。"""
        # control: 50/100, treatment: 52/100 → 不显著
        control = _make_stats(50, 50, [], [])
        treatment = _make_stats(52, 48, [], [])
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "inconclusive"
        assert "差异不显著" in result["reason"]

    def test_direction_conflict_inconclusive(self):
        """指标方向冲突 → inconclusive(需人工 review)。"""
        # control: 成功率 80%(更好),耗时 mean=100ms
        # treatment: 成功率 50%(更差),耗时 mean=80ms(更快)
        # tokens 相同(不显著)
        # directions = [success: -1, duration: +1] → 冲突 → inconclusive
        # var 取 1.0(极小,使 duration 差异 20ms 显著)
        # duration mean=100, var=1 → sum=10000, sum_sq=100*100*100 + 99*1 = 1000099
        # (注:var = (sum_sq - sum^2/n)/(n-1) → sum_sq = (n-1)*var + sum^2/n = 99 + 10000 = 1000099)
        # tokens mean=50, var=1 → sum=5000, sum_sq=99 + 5000*50 = 250099
        control = {
            "success_count": 80,
            "failure_count": 20,
            "duration_ms_sum": 10000.0,
            "duration_ms_sum_sq": 1000099.0,  # var = 1.0(使 duration 差异显著)
            "tokens_sum": 5000,
            "tokens_sum_sq": 250099.0,
        }
        # treatment duration mean=80, var=1 → sum=8000, sum_sq=99 + 8000*80 = 640099
        treatment = {
            "success_count": 50,
            "failure_count": 50,
            "duration_ms_sum": 8000.0,
            "duration_ms_sum_sq": 640099.0,  # var = 1.0
            "tokens_sum": 5000,
            "tokens_sum_sq": 250099.0,
        }
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "inconclusive"
        assert "冲突" in result["reason"] or "人工 review" in result["reason"]

    def test_all_three_dimensions_promote(self):
        """三个维度都显著优 → promote。"""
        # control 成功率 50%, treatment 80%(显著好)
        # control 耗时 100ms, treatment 80ms(显著快)
        # control tokens 100, treatment 80(显著少)
        control = _make_stats(50, 50, [100.0] * 100, [100] * 100)
        treatment = _make_stats(80, 20, [80.0] * 100, [80] * 100)
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "promote"

    def test_includes_details(self):
        """结果包含 details(success_rate / duration_ms / tokens)。"""
        control = _make_stats(50, 50, [100.0] * 100, [100] * 100)
        treatment = _make_stats(80, 20, [80.0] * 100, [80] * 100)
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert "success_rate" in result["details"]
        assert "duration_ms" in result["details"]
        assert "tokens" in result["details"]
        assert "p_value" in result["details"]["success_rate"]
        assert "p_value" in result["details"]["duration_ms"]
        assert "p_value" in result["details"]["tokens"]

    def test_returns_alpha_and_min_sample(self):
        """结果包含 alpha 和 min_sample_size。"""
        control = _make_stats(5, 0, [], [])
        treatment = _make_stats(5, 0, [], [])
        result = significance_tester.test(
            control, treatment, alpha=0.01, min_sample_size=50
        )
        assert result["alpha"] == 0.01
        assert result["minSampleSize"] == 50

    def test_treatment_zero_success(self):
        """treatment 全部失败 → 显著劣于 control → rollback。"""
        # control: 80/100 成功,treatment: 0/100 全失败
        control = _make_stats(80, 20, [], [])
        treatment = _make_stats(0, 100, [], [])
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        assert result["decision"] == "rollback"

    def test_both_zero_success(self):
        """两组都全失败 → 无法对比 → inconclusive。"""
        control = _make_stats(0, 30, [], [])
        treatment = _make_stats(0, 30, [], [])
        result = significance_tester.test(
            control, treatment, alpha=0.05, min_sample_size=30
        )
        # p=0 → p_value=1.0 → inconclusive "差异不显著"
        assert result["decision"] == "inconclusive"


# =============================================================================
# 全局单例
# =============================================================================


class TestSingleton:
    """全局单例 significance_tester。"""

    def test_singleton_exists(self):
        assert significance_tester is not None
        assert isinstance(significance_tester, SignificanceTester)

    def test_singleton_callable(self):
        control = _make_stats(50, 50, [], [])
        treatment = _make_stats(80, 20, [], [])
        result = significance_tester.test(control, treatment)
        assert "decision" in result
