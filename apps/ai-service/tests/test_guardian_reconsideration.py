# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_reconsideration 行为测试(按运行时行为规格 denial reconsideration,2026-11-16)。

覆盖五面(逐条对齐 外部程序 retry.rs 字段语义,取证见
``内部规格``):
1. 重议通过(授权补足 + 非高风险 → APPROVED);
2. critical 终局拒绝(不可重议通过);
3. max_attempts 耗尽终局拒绝;
4. 预算 / deadline 耗尽终局拒绝;
5. 指数退避(initial*2 封顶 max)+ 未判定 fail-closed。

安全语义:critical 一律不可通过;耗尽即终局;未判定绝不提前放行。
"""
from __future__ import annotations

import pytest

from app.core.guardian_reconsideration import (
    DEFAULT_INITIAL_BACKOFF_MS,
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_MAX_BACKOFF_MS,
    ReconsiderationLimits,
    ReconsiderationOutcome,
    ReconsiderationState,
    next_reconsideration,
)
from app.core.guardian_risk import GuardianRiskLevel
from app.core.guardian_scoring import RiskAssessment


def _ra(risk: str | None, authz: str | None) -> RiskAssessment:
    return RiskAssessment.from_raw(risk, authz)


# ---------- 重议通过 ----------

def test_reconsideration_approved_when_authorized_low_risk():
    """授权补足(high)+ 低风险(low)→ APPROVED,attempt+1,wait=0。"""
    state = ReconsiderationState(attempt_count=0)
    outcome, next_state, wait = next_reconsideration(state, _ra("low", "high"))
    assert outcome is ReconsiderationOutcome.APPROVED
    assert next_state.attempt_count == 1
    assert next_state.last_outcome is ReconsiderationOutcome.APPROVED
    assert wait == 0


def test_reconsideration_approved_after_denial_with_new_authz():
    """Codex:denial 后用户补充授权(informed reapproval)→ 重议 APPROVED。"""
    state = ReconsiderationState(attempt_count=1, last_outcome=ReconsiderationOutcome.DENIED)
    outcome, next_state, _ = next_reconsideration(state, _ra("medium", "high"))
    assert outcome is ReconsiderationOutcome.APPROVED


# ---------- critical 终局拒绝 ----------

def test_critical_is_terminal_denial():
    """critical 风险不可重议通过 → 终局 DENIED,wait=0,attempt 不增。"""
    state = ReconsiderationState(attempt_count=0)
    outcome, next_state, wait = next_reconsideration(state, _ra("critical", "high"))
    assert outcome is ReconsiderationOutcome.DENIED
    assert next_state.attempt_count == 0  # 终局不计入退避重试
    assert wait == 0


# ---------- max_attempts 耗尽 ----------

def test_max_attempts_exhausted_is_terminal():
    """attempt 达 max_attempts → 终局 DENIED,不再退避。"""
    limits = ReconsiderationLimits(max_attempts=2)
    state = ReconsiderationState(attempt_count=2)  # 已用完
    outcome, next_state, wait = next_reconsideration(state, _ra("low", "low"), limits)
    assert outcome is ReconsiderationOutcome.DENIED
    assert wait == 0
    assert next_state.last_backoff_ms == 0


def test_reconsideration_stops_after_max_cycles():
    """连续重议 low-authz 动作,max_attempts=3 → 第 3 次后终局。"""
    limits = ReconsiderationLimits(max_attempts=3)
    state = ReconsiderationState()
    outcomes = []
    for _ in range(5):
        outcome, state, _wait = next_reconsideration(state, _ra("low", "low"), limits)
        outcomes.append(outcome)
        if state.last_backoff_ms == 0 and outcome is ReconsiderationOutcome.DENIED:
            # 终局:后续再推进仍是终局拒绝(attempt 不再有效增长到放行)
            break
    assert ReconsiderationOutcome.APPROVED not in outcomes  # 始终未放行


# ---------- 预算 / deadline 耗尽 ----------

def test_zero_budget_is_terminal():
    """remaining_budget_ms=0 → 终局 DENIED,先于评分判定。"""
    limits = ReconsiderationLimits(remaining_budget_ms=0)
    outcome, _next, wait = next_reconsideration(
        ReconsiderationState(), _ra("low", "high"), limits
    )
    assert outcome is ReconsiderationOutcome.DENIED
    assert wait == 0


def test_deadline_limited_is_terminal():
    """deadline_limited=True → 终局 DENIED。"""
    limits = ReconsiderationLimits(deadline_limited=True)
    outcome, _next, wait = next_reconsideration(
        ReconsiderationState(), _ra("low", "high"), limits
    )
    assert outcome is ReconsiderationOutcome.DENIED
    assert wait == 0


def test_insufficient_budget_for_backoff_is_terminal():
    """退避值 > 剩余预算 → 终局拒绝。"""
    limits = ReconsiderationLimits(
        max_attempts=10,
        initial_backoff_ms=1000,
        remaining_budget_ms=500,  # 不够首轮回退
    )
    outcome, _next, wait = next_reconsideration(
        ReconsiderationState(), _ra("low", "low"), limits
    )
    assert outcome is ReconsiderationOutcome.DENIED
    assert wait == 0


# ---------- 指数退避 ----------

def test_first_backoff_uses_initial():
    """首次重议用 initial_backoff_ms。"""
    limits = ReconsiderationLimits(initial_backoff_ms=1000, max_attempts=10)
    _outcome, next_state, wait = next_reconsideration(
        ReconsiderationState(), _ra("low", "low"), limits
    )
    assert wait == 1000
    assert next_state.last_backoff_ms == 1000


def test_backoff_doubles_each_retry():
    """连续重议:退避 1000 → 2000 → 4000(指数)。"""
    limits = ReconsiderationLimits(
        initial_backoff_ms=1000, max_backoff_ms=1_000_000, max_attempts=10
    )
    state = ReconsiderationState()
    waits = []
    for _ in range(3):
        _outcome, state, wait = next_reconsideration(state, _ra("low", "low"), limits)
        waits.append(wait)
    assert waits == [1000, 2000, 4000]


def test_backoff_capped_at_max():
    """退避封顶 max_backoff_ms。"""
    limits = ReconsiderationLimits(
        initial_backoff_ms=1000, max_backoff_ms=1500, max_attempts=10
    )
    state = ReconsiderationState()
    _outcome, state, wait1 = next_reconsideration(state, _ra("low", "low"), limits)
    _outcome, state, wait2 = next_reconsideration(state, _ra("low", "low"), limits)
    assert wait1 == 1000
    assert wait2 == 1500  # 2000 封顶到 1500


# ---------- 未判定 fail-closed ----------

def test_undetermined_assessment_backs_off_not_approves():
    """assessment=None(未判定)→ DENIED 退避重试,绝不放行。"""
    limits = ReconsiderationLimits(max_attempts=10)
    outcome, _next, wait = next_reconsideration(ReconsiderationState(), None, limits)
    assert outcome is ReconsiderationOutcome.DENIED
    assert wait > 0


def test_partial_scores_back_off_not_approves():
    """评分缺失(risk None)→ 不通过,退避重试。"""
    limits = ReconsiderationLimits(max_attempts=10)
    outcome, _next, wait = next_reconsideration(
        ReconsiderationState(), _ra(None, "high"), limits
    )
    assert outcome is ReconsiderationOutcome.DENIED
    assert wait > 0


# ---------- 默认常量 ----------

def test_default_constants_match_codex_baseline():
    """默认上限取保守基线(max=3 / initial=1000 / max_backoff=30000)。"""
    assert DEFAULT_MAX_ATTEMPTS == 3
    assert DEFAULT_INITIAL_BACKOFF_MS == 1000
    assert DEFAULT_MAX_BACKOFF_MS == 30_000


def test_default_limits_used_when_none():
    """limits=None 用默认值:首次重议 low-authz → 退避 1000ms。"""
    _outcome, _next, wait = next_reconsideration(
        ReconsiderationState(), _ra("low", "low"), None
    )
    assert wait == DEFAULT_INITIAL_BACKOFF_MS
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
