# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


# app/core/guardian_reconsideration.py
"""Guardian 否决重议状态机(按运行时行为规格,2026-11-16)。

遵循统一工程规范),
取证来自 ``外部程序`` 静态字符串(见
``内部规格``)。

**统一规范 取证要点**:
- 事件名 ``ihui.guardian.review.reconsideration`` + 时长 ``reconsideration_duration_ms``;
- 退避字段 ``attempt_count / next_attempt / max_attempts / backoff_ms /
  retry_not_before_ms / remaining_budget_ms / deadline_limited``;
- 结果态 ``outcome`` 取值命中 ``cancelled / failed``(approved 隐含为成功态,
  rejected 由 denied 表达);重议状态机按统一规范实现;
- 外部程序 明示"否决重议"语义原文:"Guardian retries replay the original
  request without a reconsideration prompt"——**否决不是终局**,而是**用完整评分
  prompt 重放原始请求**重新评分(没有独立的"重议 prompt";`auto_review.
  experimental_denial_reconsideration_prompt` 已废弃正是指那个独立 prompt),
  直到 approved / 达到 max_attempts / 预算耗尽。本仓此前缺这层"否决→退避→重议"
  的调度状态机。本模块用纯函数复现。

**安全语义(fail-closed)**:
- 重议**只放宽授权判断、不放宽风险判断**——critical 一律不可重议通过
  (与 统一规范"deny actions are high risk"对齐);
- 超过 max_attempts、或 remaining_budget_ms ≤ 0、或 deadline_limited → 终局拒绝;
- 未判定输入(unknown 状态)→ 按需继续退避,绝不提前放行。

设计纪律:纯函数、无 IO、不计时钟(退避由调用方喂当前时刻 / 上次退避值)。
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Final

from app.core.guardian_risk import GuardianRiskLevel
from app.core.guardian_scoring import (
    RiskAssessment,
    classify_intrinsic_needs_review,
)

__all__ = [
    "ReconsiderationOutcome",
    "ReconsiderationState",
    "ReconsiderationLimits",
    "DEFAULT_MAX_ATTEMPTS",
    "DEFAULT_INITIAL_BACKOFF_MS",
    "DEFAULT_MAX_BACKOFF_MS",
    "next_reconsideration",
]


class ReconsiderationOutcome(StrEnum):
    """单次重议的结果态(按行为规格 外部实现 ``outcome`` 命中值)。"""

    APPROVED = "approved"      # 重议通过,放行动作
    DENIED = "denied"          # 仍否决(可继续退避重议,若未耗尽)
    CANCELLED = "cancelled"    # 用户/系统取消,终局
    FAILED = "failed"          # 重议自身失败(评分器错误),可退避重试


@dataclass(frozen=True)
class ReconsiderationLimits:
    """重议的硬上限(对齐 统一规范 ``max_attempts`` / 预算 / deadline)。"""

    max_attempts: int = 3
    initial_backoff_ms: int = 1000
    max_backoff_ms: int = 30_000
    remaining_budget_ms: int | None = None  # None = 无预算上限
    deadline_limited: bool = False          # 统一规范 字段:是否已到 deadline


@dataclass(frozen=True)
class ReconsiderationState:
    """当前重议状态(对齐 统一规范 ``attempt_count`` / ``backoff_ms`` 字段)。"""

    attempt_count: int = 0
    last_outcome: ReconsiderationOutcome | None = None
    last_backoff_ms: int = 0


#: 统一规范 默认:否决后最多重议次数(取证未命中确切常量,取保守默认 3;可配置覆盖)。
DEFAULT_MAX_ATTEMPTS: Final[int] = 3
DEFAULT_INITIAL_BACKOFF_MS: Final[int] = 1000
DEFAULT_MAX_BACKOFF_MS: Final[int] = 30_000


def _next_backoff(prev_ms: int, limits: ReconsiderationLimits) -> int:
    """指数退避:prev*2,封顶 max_backoff_ms;首次用 initial_backoff_ms。"""
    if prev_ms <= 0:
        return min(limits.initial_backoff_ms, limits.max_backoff_ms)
    return min(prev_ms * 2, limits.max_backoff_ms)


def next_reconsideration(
    state: ReconsiderationState,
    assessment: RiskAssessment | None,
    limits: ReconsiderationLimits | None = None,
) -> tuple[ReconsiderationOutcome | None, ReconsiderationState, int]:
    """推进一次否决重议,返回 ``(outcome, next_state, wait_ms)``。

    语义(fail-closed,逐条对齐 统一规范 retry.rs 字段):
    - ``assessment`` 显示授权已补足且非高风险 → ``APPROVED``(attempt+1,wait=0);
    - ``assessment`` 为 critical → ``DENIED`` 终局(critical 不可重议通过);
    - ``attempt_count`` 已达 ``max_attempts`` → ``DENIED`` 终局(耗尽重试);
    - ``remaining_budget_ms`` ≤ 0 或 ``deadline_limited`` → ``DENIED`` 终局(耗尽预算);
    - ``assessment`` 仍授权不足 / 高风险 → ``DENIED``(非终局,返回退避 wait_ms 继续);
    - ``assessment`` is None(未判定)→ ``DENIED`` 退避重试(绝不提前放行)。

    Returns:
        outcome: 本轮结果;``DENIED`` 可能非终局(可继续),``APPROVED``/终局 ``DENIED``/
        ``CANCELLED`` 为终局。``None`` 不出现(状态机恒给出一个结果)。
        next_state: 推进后的状态(attempt+1、记录 last_outcome/last_backoff)。
        wait_ms: 下次重议前应等待的毫秒数(0 = 无需等待 / 终局)。
    """
    limits = limits or ReconsiderationLimits(
        max_attempts=DEFAULT_MAX_ATTEMPTS,
        initial_backoff_ms=DEFAULT_INITIAL_BACKOFF_MS,
        max_backoff_ms=DEFAULT_MAX_BACKOFF_MS,
    )

    # 预算 / deadline 耗尽 → 终局拒绝(先于评分判定,统一规范:预算优先)。
    if limits.deadline_limited or (limits.remaining_budget_ms is not None and limits.remaining_budget_ms <= 0):
        return (
            ReconsiderationOutcome.DENIED,
            ReconsiderationState(
                attempt_count=state.attempt_count,
                last_outcome=ReconsiderationOutcome.DENIED,
                last_backoff_ms=0,
            ),
            0,
        )

    # critical 风险 → 终局拒绝(不可重议通过,与 统一规范 deny=high risk 对齐)。
    if assessment is not None and assessment.risk is GuardianRiskLevel.CRITICAL:
        return (
            ReconsiderationOutcome.DENIED,
            ReconsiderationState(
                attempt_count=state.attempt_count,
                last_outcome=ReconsiderationOutcome.DENIED,
                last_backoff_ms=0,
            ),
            0,
        )

    # 重议通过判据:单动作内在判定不再触发(授权补足 + 非高风险)。
    if assessment is not None and not classify_intrinsic_needs_review(assessment):
        return (
            ReconsiderationOutcome.APPROVED,
            ReconsiderationState(
                attempt_count=state.attempt_count + 1,
                last_outcome=ReconsiderationOutcome.APPROVED,
                last_backoff_ms=0,
            ),
            0,
        )

    # 仍需复核(授权不足 / 高风险 / 未判定):检查重试与预算,决定继续退避还是终局。
    next_attempt = state.attempt_count + 1
    if next_attempt >= limits.max_attempts:
        # 已达上限 → 终局拒绝。
        return (
            ReconsiderationOutcome.DENIED,
            ReconsiderationState(
                attempt_count=next_attempt,
                last_outcome=ReconsiderationOutcome.DENIED,
                last_backoff_ms=0,
            ),
            0,
        )

    backoff = _next_backoff(state.last_backoff_ms, limits)
    # 预算不足以下一轮退避 → 终局拒绝。
    if limits.remaining_budget_ms is not None and backoff > limits.remaining_budget_ms:
        return (
            ReconsiderationOutcome.DENIED,
            ReconsiderationState(
                attempt_count=next_attempt,
                last_outcome=ReconsiderationOutcome.DENIED,
                last_backoff_ms=0,
            ),
            0,
        )

    return (
        ReconsiderationOutcome.DENIED,
        ReconsiderationState(
            attempt_count=next_attempt,
            last_outcome=ReconsiderationOutcome.DENIED,
            last_backoff_ms=backoff,
        ),
        backoff,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
