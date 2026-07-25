"""显著性检验器(L5-3,2026-07-25 立,对标 Hermes Agent significance testing)。

设计要点:
1. 输入:control_stats + treatment_stats + alpha + min_sample_size
2. 输出:decision(promote/rollback/inconclusive)+ reason dict
3. 三维度检验:
   a. 成功率 → two-proportion z-test(总体比例差)
   b. 耗时 → Welch's t-test(不假设方差相等)
   c. token 用量 → Welch's t-test
4. 不依赖 scipy:用纯 Python 实现 Φ(z) / erf / t-distribution 近似
5. 决策规则:
   - 三个指标都达到 min_sample_size 才检验(否则 inconclusive "样本不足")
   - 任一指标 p_value < α 且方向一致 → 决策
     * treatment 显著优于 control(success↑ / duration↓ / tokens↓)→ promote
     * treatment 显著劣于 control(success↓ / duration↑ / tokens↑)→ rollback
   - 多指标方向不一致 → inconclusive("指标方向冲突")
   - 都不显著 → inconclusive("差异不显著")

闭源对齐:Hermes Agent 用 proportion test + bayesian uplift,本实现采用
frequentist z-test + Welch t-test(零依赖,适合中小样本)。
"""

from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)

# t-distribution 正态近似的最低自由度(低于此值用查表更准,但 min_sample_size=30 已足够)
_MIN_DF_FOR_NORMAL_APPROX = 30


# ============================================================================
# 数学工具:erf / Φ(z) / t-CDF(纯 Python,无 scipy 依赖)
# ============================================================================


def _erf(x: float) -> float:
    """ Abramowitz and Stegun 7.1.26 公式近似 erf(x)。

    最大误差 1.5e-7,对 |z| < 6 足够精确。
    """
    sign = 1.0
    if x < 0:
        sign = -1.0
        x = -x
    # 系数
    a1 = 0.254829592
    a2 = -0.284496736
    a3 = 1.421413741
    a4 = -1.453152027
    a5 = 1.061405429
    p = 0.3275911
    t = 1.0 / (1.0 + p * x)
    y = 1.0 - (
        (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t
    ) * math.exp(-x * x)
    return sign * y


def _normal_cdf(z: float) -> float:
    """标准正态分布 CDF Φ(z)。"""
    return 0.5 * (1.0 + _erf(z / math.sqrt(2.0)))


def _normal_sf(z: float) -> float:
    """标准正态分布 survival function 1 - Φ(z)(数值稳定版)。"""
    return 1.0 - _normal_cdf(z)


def _t_cdf_two_sided_abs_t(t: float, df: float) -> float:
    """计算 2 * P(T > |t|)(双尾 p-value)。

    用正态近似(df >= 30 时与 t 分布差异 < 0.01)。
    """
    if df < _MIN_DF_FOR_NORMAL_APPROX:
        # 对小样本用保守估计:正态近似 + 罚项(df 越小,p_value 越大,越保守)
        # 简化:t 分布比正态分布尾巴更厚,实际 p_value > 正态 p_value
        # 因此用正态近似会低估 p_value,这里加上 df 罚项保守化
        conservative_factor = math.sqrt(df / (df - 2.0)) if df > 2 else 1.0
        z = abs(t) / conservative_factor
    else:
        z = abs(t)
    # 双尾 p-value
    return 2.0 * _normal_sf(z)


# ============================================================================
# 检验方法
# ============================================================================


def _proportion_z_test(
    s1: int, n1: int, s2: int, n2: int
) -> dict[str, float]:
    """两总体比例 z-test(成功率检验)。

    H0: p1 = p2 (control rate == treatment rate)
    H1: p1 ≠ p2

    Args:
        s1: control 成功数
        n1: control 总样本数
        s2: treatment 成功数
        n2: treatment 总样本数

    Returns:
        {"p1": float, "p2": float, "diff": p2-p1, "z": float, "p_value": float}
    """
    if n1 <= 0 or n2 <= 0:
        return {"p1": 0.0, "p2": 0.0, "diff": 0.0, "z": 0.0, "p_value": 1.0}
    p1 = s1 / n1
    p2 = s2 / n2
    # Pooled proportion
    p = (s1 + s2) / (n1 + n2)
    # 避免除零:p=0 或 p=1 时方差为 0 → p_value=1(无差异)
    if p <= 0.0 or p >= 1.0:
        return {
            "p1": p1,
            "p2": p2,
            "diff": p2 - p1,
            "z": 0.0,
            "p_value": 1.0,
        }
    se = math.sqrt(p * (1.0 - p) * (1.0 / n1 + 1.0 / n2))
    if se <= 0.0:
        return {
            "p1": p1,
            "p2": p2,
            "diff": p2 - p1,
            "z": 0.0,
            "p_value": 1.0,
        }
    z = (p2 - p1) / se
    p_value = _t_cdf_two_sided_abs_t(z, df=float(n1 + n2 - 2))
    return {
        "p1": p1,
        "p2": p2,
        "diff": p2 - p1,
        "z": z,
        "p_value": p_value,
    }


def _welch_t_test(
    sum1: float,
    sum_sq1: float,
    n1: int,
    sum2: float,
    sum_sq2: float,
    n2: int,
) -> dict[str, float]:
    """Welch's t-test(连续值检验,用于耗时 / token)。

    H0: μ1 = μ2
    H1: μ1 ≠ μ2

    用累计 sum + sum_sq 计算 mean + variance(无原始样本需求)。

    Args:
        sum1: control 累计和
        sum_sq1: control 累计平方和
        n1: control 样本数
        sum2, sum_sq2, n2: treatment 对应值

    Returns:
        {"mean1": float, "mean2": float, "diff": m2-m1, "t": float, "p_value": float, "df": float}
    """
    if n1 <= 1 or n2 <= 1:
        return {
            "mean1": 0.0,
            "mean2": 0.0,
            "diff": 0.0,
            "t": 0.0,
            "p_value": 1.0,
            "df": 0.0,
        }
    m1 = sum1 / n1
    m2 = sum2 / n2
    # 样本方差:s^2 = (Σx^2 - (Σx)^2 / n) / (n - 1)
    var1 = max(0.0, (sum_sq1 - (sum1 * sum1) / n1) / (n1 - 1))
    var2 = max(0.0, (sum_sq2 - (sum2 * sum2) / n2) / (n2 - 1))
    # Welch's SE
    se_sq = var1 / n1 + var2 / n2
    if se_sq <= 0.0:
        return {
            "mean1": m1,
            "mean2": m2,
            "diff": m2 - m1,
            "t": 0.0,
            "p_value": 1.0,
            "df": 0.0,
        }
    se = math.sqrt(se_sq)
    t = (m2 - m1) / se
    # Welch-Satterthwaite 自由度
    num = (var1 / n1 + var2 / n2) ** 2
    den = (var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)
    df = num / den if den > 0 else float(n1 + n2 - 2)
    p_value = _t_cdf_two_sided_abs_t(t, df=df)
    return {
        "mean1": m1,
        "mean2": m2,
        "diff": m2 - m1,
        "t": t,
        "p_value": p_value,
        "df": df,
    }


# ============================================================================
# 主类:SignificanceTester
# ============================================================================


class SignificanceTester:
    """显著性检验器:从 control/treatment stats 检验差异并给出决策。

    所有方法纯函数,无 IO,无状态(可单例 / 可静态调用)。
    """

    def test(
        self,
        control_stats: dict[str, Any],
        treatment_stats: dict[str, Any],
        *,
        alpha: float = 0.05,
        min_sample_size: int = 30,
    ) -> dict[str, Any]:
        """主入口:对三维度指标做显著性检验,输出决策。

        Args:
            control_stats: ABTestTracker._empty_stats() 风格
                           {success_count, failure_count, duration_ms_sum,
                            duration_ms_sum_sq, tokens_sum, tokens_sum_sq}
            treatment_stats: 同上
            alpha: 显著性水平(默认 0.05)
            min_sample_size: 最小样本量(默认 30)

        Returns:
            {
                "decision": "promote" | "rollback" | "inconclusive",
                "reason": str,
                "details": {
                    "success_rate": {...},
                    "duration_ms": {...},
                    "tokens": {...}
                },
                "alpha": float,
                "minSampleSize": int,
            }
        """
        # 1. 提取样本量
        n1_s = int(control_stats.get("success_count", 0))
        n1_f = int(control_stats.get("failure_count", 0))
        n1 = n1_s + n1_f
        n2_s = int(treatment_stats.get("success_count", 0))
        n2_f = int(treatment_stats.get("failure_count", 0))
        n2 = n2_s + n2_f

        # 2. 样本量不足 → inconclusive
        if n1 < min_sample_size or n2 < min_sample_size:
            return {
                "decision": "inconclusive",
                "reason": (
                    f"样本量不足:control={n1}/{min_sample_size}, "
                    f"treatment={n2}/{min_sample_size}"
                ),
                "details": {},
                "alpha": alpha,
                "minSampleSize": min_sample_size,
                "controlSamples": n1,
                "treatmentSamples": n2,
            }

        # 3. 成功率检验(z-test)
        success_test = _proportion_z_test(n1_s, n1, n2_s, n2)

        # 4. 耗时检验(Welch t-test)
        duration_test = _welch_t_test(
            float(control_stats.get("duration_ms_sum", 0.0)),
            float(control_stats.get("duration_ms_sum_sq", 0.0)),
            n1,
            float(treatment_stats.get("duration_ms_sum", 0.0)),
            float(treatment_stats.get("duration_ms_sum_sq", 0.0)),
            n2,
        )

        # 5. token 检验(Welch t-test)
        token_test = _welch_t_test(
            float(control_stats.get("tokens_sum", 0.0)),
            float(control_stats.get("tokens_sum_sq", 0.0)),
            n1,
            float(treatment_stats.get("tokens_sum", 0.0)),
            float(treatment_stats.get("tokens_sum_sq", 0.0)),
            n2,
        )

        # 6. 决策:统计显著方向
        # 指标方向:treatment 显著优于 control 计 +1,显著劣于 -1,不显著 0
        directions: list[int] = []
        # 成功率:treatment 显著上升 → +1;显著下降 → -1
        if success_test["p_value"] < alpha:
            if success_test["diff"] > 0:
                directions.append(1)
            elif success_test["diff"] < 0:
                directions.append(-1)
        # 耗时:treatment 显著下降 → +1;显著上升 → -1
        if duration_test["p_value"] < alpha:
            if duration_test["diff"] < 0:
                directions.append(1)
            elif duration_test["diff"] > 0:
                directions.append(-1)
        # token:treatment 显著下降 → +1;显著上升 → -1
        if token_test["p_value"] < alpha:
            if token_test["diff"] < 0:
                directions.append(1)
            elif token_test["diff"] > 0:
                directions.append(-1)

        # 决策
        if not directions:
            decision = "inconclusive"
            reason = (
                f"差异不显著(α={alpha}):success p={success_test['p_value']:.4f}, "
                f"duration p={duration_test['p_value']:.4f}, "
                f"token p={token_test['p_value']:.4f}"
            )
        elif all(d > 0 for d in directions):
            decision = "promote"
            reason = (
                f"treatment 在 {len(directions)} 个维度显著优于 control"
                f"(α={alpha}):success diff={success_test['diff']:+.4f} "
                f"(p={success_test['p_value']:.4f}), "
                f"duration diff={duration_test['diff']:+.2f}ms "
                f"(p={duration_test['p_value']:.4f}), "
                f"token diff={token_test['diff']:+.2f} "
                f"(p={token_test['p_value']:.4f})"
            )
        elif all(d < 0 for d in directions):
            decision = "rollback"
            reason = (
                f"treatment 在 {len(directions)} 个维度显著劣于 control"
                f"(α={alpha}):success diff={success_test['diff']:+.4f} "
                f"(p={success_test['p_value']:.4f}), "
                f"duration diff={duration_test['diff']:+.2f}ms "
                f"(p={duration_test['p_value']:.4f}), "
                f"token diff={token_test['diff']:+.2f} "
                f"(p={token_test['p_value']:.4f})"
            )
        else:
            decision = "inconclusive"
            reason = (
                f"指标方向冲突(α={alpha}):success diff={success_test['diff']:+.4f} "
                f"(p={success_test['p_value']:.4f}), "
                f"duration diff={duration_test['diff']:+.2f}ms "
                f"(p={duration_test['p_value']:.4f}), "
                f"token diff={token_test['diff']:+.2f} "
                f"(p={token_test['p_value']:.4f}) → 需人工 review"
            )

        return {
            "decision": decision,
            "reason": reason,
            "details": {
                "success_rate": success_test,
                "duration_ms": duration_test,
                "tokens": token_test,
            },
            "alpha": alpha,
            "minSampleSize": min_sample_size,
            "controlSamples": n1,
            "treatmentSamples": n2,
        }


# 全局单例(无状态,可全局共享)
significance_tester = SignificanceTester()
