# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/guardian_decisions_comparison.py
"""Guardian v2 双评分后端对照机制(按运行时行为规格,2026-11-16)。

遵循统一工程规范),
取证来自 ``外部程序`` 静态字符串(见
``内部规格`` 与
``classification-output-scan.mjs``)。

**统一规范 取证要点**:
- 事件名 ``ihui.guardian_v2.decisions_comparison.comparison`` + ``.duration_ms``;
- 双后端 ``backend ∈ { responses, decisions }``:``responses`` 走常规 inference 端点,
  ``decisions`` 走独立决策端点 ``api.openai.com/v1/decisions``(凭据
  ``CODEX_GUARDIAN_DECISIONS_API_KEY``);
- 对照三态 ``agree / disagree / unavailable``:两后端都产出 → 比对是否一致(agree/
  disagree);任一不可用 → unavailable;
- 单次分类首 token 输出 ``high / low``(阻断/放行二元);分类失败态 ``invalid_output /
  context_build_error / action_deserialization_error / not_initialized /
  preparation_failed / superseded``。

**这是"影子对照/金丝雀"机制**:``decisions`` 端点是 统一规范 在评估的新决策服务,
与线上 ``responses`` 并行评分,只记录 ``agree/disagree`` 指标用于对照分析,
**不影响线上放行决策**(对照失败 → unavailable,仍以 ``responses`` 为准)。
这正是金丝雀上线的安全模式:新评分器先影子跑,一致率达标才切主。

**为什么复现**:本仓若要引入第二评分后端(如本地小模型 vs 云端大模型做
guardian 对照),需要这套"影子对照不影响线上 + 不可用降级 + 一致率统计"的
调度语义。本模块用纯函数复现对照判定内核。

**安全语义(fail-closed)**:
- 对照**永不覆盖主决策**——``decisions`` 后端只产出对照信号,线上放行恒以主后端为准;
- 任一后端不可用 → ``UNAVAILABLE``(不臆造一致/不一致);
- 分类输出非 ``high/low`` → 视为该后端失败,计入 unavailable。

设计纪律:纯函数、无 IO、不调端点。调用方负责取两后端评分,本模块只锁对照判定。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final

__all__ = [
    "ClassificationVerdict",
    "DecisionBackend",
    "ComparisonResult",
    "ComparisonOutcome",
    "compare_decisions",
    "normalize_classification",
]


class ClassificationVerdict(StrEnum):
    """单次分类首 token 二元输出(按行为规格 外部实现 ``high / low``)。"""

    HIGH = "high"  # 阻断复核
    LOW = "low"    # 放行


class DecisionBackend(StrEnum):
    """评分后端(按行为规格 外部实现 ``backend`` 命中值)。"""

    RESPONSES = "responses"  # 常规 inference 端点(线上主决策)
    DECISIONS = "decisions"  # 独立决策端点 /v1/decisions(影子对照)


class ComparisonOutcome(StrEnum):
    """对照三态(按行为规格 外部实现 ``agree / disagree / unavailable``)。"""

    AGREE = "agree"
    DISAGREE = "disagree"
    UNAVAILABLE = "unavailable"


#: 合法分类输出集合;之外的取值(空串/其他)视为该后端分类失败。
_VALID_VERDICTS: Final[frozenset[str]] = frozenset({"high", "low"})


def normalize_classification(raw: str | None) -> ClassificationVerdict | None:
    """归一化单后端分类输出;非 high/low(含 None/空/其他)→ None(该后端失败)。

    fail-closed:不猜档。``"high-ish"`` / 空串 / None 一律 None,计入 unavailable。
    """
    if raw is None:
        return None
    token = raw.strip().lower()
    if token not in _VALID_VERDICTS:
        return None
    return ClassificationVerdict(token)


@dataclass(frozen=True)
class ComparisonResult:
    """对照结果(对齐 统一规范 ``comparison`` + ``backend`` 字段)。"""

    outcome: ComparisonOutcome
    primary_verdict: ClassificationVerdict | None = None  # responses 后端输出
    shadow_verdict: ClassificationVerdict | None = None   # decisions 后端输出

    @property
    def is_online_deciding(self) -> bool:
        """线上放行是否由主后端(responses)决定——恒 True(影子对照不影响线上)。"""
        return self.primary_verdict is not None


def compare_decisions(
    primary_raw: str | None,
    shadow_raw: str | None,
) -> ComparisonResult:
    """比对双后端分类输出,返回对照三态。

    逐条对齐 统一规范 decisions_comparison 语义:
    - 两后端均产出且相等 → ``AGREE``;
    - 两后端均产出但不等 → ``DISAGREE``;
    - 任一后端失败/不可用(非 high/low)→ ``UNAVAILABLE``(不臆造一致/不一致)。

    安全不变式:线上放行恒取 ``primary_raw``(responses);shadow(disagreements)仅记录。

    Args:
        primary_raw: 主后端(responses)分类输出原串。
        shadow_raw: 影子后端(decisions)分类输出原串。

    Returns:
        ``ComparisonResult``:outcome ∈ {agree, disagree, unavailable};
        ``primary_verdict`` 仅在主后端有效时非 None(线上决策依据)。
    """
    primary = normalize_classification(primary_raw)
    shadow = normalize_classification(shadow_raw)
    if primary is None or shadow is None:
        return ComparisonResult(
            outcome=ComparisonOutcome.UNAVAILABLE,
            primary_verdict=primary,  # 主后端有效时仍保留,作为线上决策依据
            shadow_verdict=shadow,
        )
    if primary is shadow:
        return ComparisonResult(
            outcome=ComparisonOutcome.AGREE,
            primary_verdict=primary,
            shadow_verdict=shadow,
        )
    return ComparisonResult(
        outcome=ComparisonOutcome.DISAGREE,
        primary_verdict=primary,
        shadow_verdict=shadow,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
