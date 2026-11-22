# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""永久保活自愈策略测试(2026-11-22)。

覆盖三个断链判据:回写带界重试、软/硬失效区分、历史凭据回滚。
纯函数测试,零 IO。含变异验证防止恒真守卫。
"""

from __future__ import annotations

import pytest

from app.services.publish.perpetual import (
    RecoveryCandidate,
    WritebackAction,
    is_hard_expire,
    is_soft_expire,
    plan_recovery,
    soft_failure_needs_retry,
    writeback_verdict,
)


# --- 回写判据 ---------------------------------------------------------------
def test_no_change_needs_no_writeback() -> None:
    assert writeback_verdict(changed=False, failures=0).action == WritebackAction.NOTHING


def test_writeback_retries_within_budget() -> None:
    assert writeback_verdict(changed=True, failures=0).action == WritebackAction.RETRY
    assert writeback_verdict(changed=True, failures=1).action == WritebackAction.RETRY


def test_writeback_gives_up_at_budget() -> None:
    v = writeback_verdict(changed=True, failures=3)
    assert v.action == WritebackAction.GIVE_UP
    assert "暴露告警" in v.detail


def test_writeback_budget_floor_one() -> None:
    """即便预算传 0,首次也至少回写一次(否则等于从不回写)。"""
    assert writeback_verdict(changed=True, failures=0, max_attempts=0).action == WritebackAction.RETRY
    assert writeback_verdict(changed=True, failures=1, max_attempts=0).action == WritebackAction.GIVE_UP


def test_writeback_negative_failures_clamped() -> None:
    assert writeback_verdict(changed=True, failures=-5).attempts == 0


# --- 软/硬失效 -------------------------------------------------------------
@pytest.mark.parametrize(
    "message",
    ["未检测到目标 cookie,可能已过期", "未登录", "登录态失效", "无权限"],
)
def test_soft_expire_detected(message: str) -> None:
    assert is_soft_expire(message) is True
    assert is_hard_expire(message) is False


@pytest.mark.parametrize(
    "message",
    ["凭证无法解密(InvalidTag)", "解密失败", "invalid token", "invalidtag"],
)
def test_hard_expire_detected(message: str) -> None:
    assert is_hard_expire(message) is True
    assert is_soft_expire(message) is False


def test_hard_wins_when_both_markers_present() -> None:
    """同时命中软硬标记时按硬算(避免解不开的死症被当软失败反复重试)。"""
    m = "未登录; 凭证无法解密 invalidtag"
    assert is_hard_expire(m) is True
    assert is_soft_expire(m) is False


def test_ok_message_is_neither() -> None:
    assert is_soft_expire("Cookie 保活成功") is False
    assert is_hard_expire("Cookie 保活成功") is False


def test_soft_failure_retries_within_budget() -> None:
    assert soft_failure_needs_retry("未检测到目标 cookie", 0) is True
    assert soft_failure_needs_retry("未检测到目标 cookie", 1) is True   # 默认预算 2
    assert soft_failure_needs_retry("未检测到目标 cookie", 2) is False  # 耗尽


def test_soft_failure_hard_never_retries() -> None:
    assert soft_failure_needs_retry("凭证无法解密", 0) is False


def test_soft_failure_non_expire_never_retries() -> None:
    assert soft_failure_needs_retry("保活成功", 0) is False


# --- 历史回滚 ---------------------------------------------------------------
def _cand(label: str, alive: bool, enc: str | None = None) -> RecoveryCandidate:
    return RecoveryCandidate(label=label, enc=enc if enc is not None else "enc-" + label, alive=alive)


def test_current_alive_no_rollback() -> None:
    plan = plan_recovery([_cand("current", True), _cand("history[0]", True)])
    assert plan.chosen is not None and plan.chosen.label == "current"
    assert plan.recovered_from_history is False
    assert plan.tried == 2


def test_rolls_back_to_first_alive_history() -> None:
    plan = plan_recovery([
        _cand("current", False),
        _cand("history[0]", False),
        _cand("history[1]", True),
    ])
    assert plan.chosen is not None and plan.chosen.label == "history[1]"
    assert plan.recovered_from_history is True


def test_all_dead_yields_no_candidate() -> None:
    """全军覆没才给 None —— 这是允许喊人工重扫的唯一条件。"""
    plan = plan_recovery([_cand("current", False), _cand("history[0]", False)])
    assert plan.chosen is None
    assert plan.recovered_from_history is False


def test_empty_candidates_is_none() -> None:
    assert plan_recovery([]).chosen is None


def test_empty_enc_never_chosen() -> None:
    """空密文即使标 alive 也不能被选中(不会把空凭据写回库)。"""
    plan = plan_recovery([RecoveryCandidate(label="current", enc="", alive=True)])
    assert plan.chosen is None


# --- 变异验证:守卫非恒真 ----------------------------------------------------
def test_mutation_hard_wins() -> None:
    """若把硬优先删掉,混合串会被误判为软 —— 钉住这个反例。"""
    m = "未登录; 凭证无法解密 invalidtag"
    # 反事实:软标记单独看是命中的
    assert any(x in m.lower() for x in ("未登录",))  # 软确实命中
    # 但综合判据必须按硬算
    assert is_hard_expire(m) and not is_soft_expire(m)


def test_mutation_rollback_order() -> None:
    """current 活着时不得回滚到 history(顺序反了会更替成旧凭据)。"""
    plan = plan_recovery([_cand("current", True), _cand("history[0]", True)])
    assert plan.chosen is not None and plan.chosen.label == "current"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
