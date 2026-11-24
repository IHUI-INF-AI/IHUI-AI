# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""guardian_scoring 行为测试(逆向 Codex guardian v2 Predictive Classification,2026-11-16)。

覆盖四面(逐条对齐 codex.exe 内嵌 prompt 原文,取证见
``.ihui-agent/tmp/goal-codex/evidence/codex-guardian-v2-prompts-verbatim.md``):
1. ``UserAuthorization`` 四档 + ``is_authorized``/``is_clear`` 语义;
2. ``normalize_user_authorization`` 归一化(未知返回 None,fail-closed);
3. ``classify_intrinsic_needs_review`` 单动作判定(Predictive 条件 a);
4. ``classify_needs_blocking_review`` 滑窗四条件 (a)(b)(c)(d) + 放行 + 未判定。

安全语义:所有"未判定"(None)路径一律阻断,绝不因缺评分放行。
"""

from __future__ import annotations

import pytest

from app.core.guardian_scoring import (
    PREDICTIVE_WINDOW_AHEAD,
    PREDICTIVE_WINDOW_RECENT,
    RiskAssessment,
    TrajectoryWindow,
    UserAuthorization,
    classify_intrinsic_needs_review,
    classify_needs_blocking_review,
    normalize_user_authorization,
)


def _ra(risk: str | None, authz: str | None) -> RiskAssessment:
    return RiskAssessment.from_raw(risk, authz)


# ---------- UserAuthorization ----------

def test_authorization_four_tiers_match_codex():
    """逐字对齐 Codex:high/medium/low/unknown。"""
    assert {a.value for a in UserAuthorization} == {"high", "medium", "low", "unknown"}


def test_authorization_is_authorized():
    """Codex:high/medium 算已授权;low/unknown 未充分授权。"""
    assert UserAuthorization.HIGH.is_authorized is True
    assert UserAuthorization.MEDIUM.is_authorized is True
    assert UserAuthorization.LOW.is_authorized is False
    assert UserAuthorization.UNKNOWN.is_authorized is False


def test_authorization_is_clear():
    """Codex:unknown 触发条件 (a)(d);其余算明确。"""
    assert UserAuthorization.UNKNOWN.is_clear is False
    assert UserAuthorization.LOW.is_clear is True


# ---------- normalize_user_authorization ----------

@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("high", UserAuthorization.HIGH),
        ("medium", UserAuthorization.MEDIUM),
        ("med", UserAuthorization.MEDIUM),
        ("low", UserAuthorization.LOW),
        ("unknown", UserAuthorization.UNKNOWN),
        ("none", UserAuthorization.UNKNOWN),  # 无授权证据 = unknown
        ("HIGH", UserAuthorization.HIGH),  # 大小写不敏感
        (" Low ", UserAuthorization.LOW),  # 含空白
    ],
)
def test_normalize_authorization_known(raw: str, expected: UserAuthorization):
    assert normalize_user_authorization(raw) is expected


@pytest.mark.parametrize("raw", [None, "", "maybe", "yes", "granted"])
def test_normalize_authorization_unknown_returns_none(raw: str | None):
    """fail-closed:未知**返回 None**,不猜档。"""
    assert normalize_user_authorization(raw) is None


# ---------- classify_intrinsic_needs_review(条件 a) ----------

def test_intrinsic_authorized_low_risk_clears():
    """已授权(high/medium) + 低风险(low/medium) → 不需复核。"""
    assert classify_intrinsic_needs_review(_ra("low", "high")) is False
    assert classify_intrinsic_needs_review(_ra("medium", "medium")) is False


def test_intrinsic_high_risk_blocks_even_if_authorized():
    """Codex 条件 (a):风险 high/critical → 即使已授权也阻断。"""
    assert classify_intrinsic_needs_review(_ra("high", "high")) is True
    assert classify_intrinsic_needs_review(_ra("critical", "high")) is True


def test_intrinsic_unauthorized_blocks_even_if_low_risk():
    """Codex 条件 (a):授权 low/unknown → 即使低风险也阻断。"""
    assert classify_intrinsic_needs_review(_ra("low", "low")) is True
    assert classify_intrinsic_needs_review(_ra("low", "unknown")) is True


def test_intrinsic_undetermined_fails_closed():
    """未判定(risk/authz None / assessment None)一律阻断。"""
    assert classify_intrinsic_needs_review(None) is True
    assert classify_intrinsic_needs_review(_ra(None, "high")) is True
    assert classify_intrinsic_needs_review(_ra("low", None)) is True
    assert classify_intrinsic_needs_review(_ra(None, None)) is True


# ---------- classify_needs_blocking_review 滑窗四条件 ----------

def test_window_constants_match_codex():
    """逐字对齐 prompt:"previous five actions" / "next two actions"。"""
    assert PREDICTIVE_WINDOW_RECENT == 5
    assert PREDICTIVE_WINDOW_AHEAD == 2


def test_all_clear_releases():
    """四条件均不满足 → 放行(reason None)。当前已授权低风险,近期/未来均干净。"""
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("low", "high")] * 5,
        anticipated=[],
    )
    assert classify_needs_blocking_review(traj) == (False, None)


def test_condition_a_authorization():
    """条件 (a):当前授权不足(low)→ 阻断,reason a-authorization。"""
    traj = TrajectoryWindow(current=_ra("low", "low"))
    assert classify_needs_blocking_review(traj) == (True, "a-authorization")


def test_condition_a_risk():
    """条件 (a):当前高风险 → 阻断,reason a-risk。"""
    traj = TrajectoryWindow(current=_ra("critical", "high"))
    assert classify_needs_blocking_review(traj) == (True, "a-risk")


def test_condition_b_recent_unknown_authorization():
    """条件 (b):最近 5 动作里任一 unknown authorization → 阻断。"""
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("low", "high")] * 4 + [_ra("low", "unknown")],
    )
    assert classify_needs_blocking_review(traj) == (True, "b-recent-authorization")


def test_condition_b_recent_critical():
    """条件 (b):最近 5 动作里任一 critical risk → 阻断。"""
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("low", "high"), _ra("critical", "high"), _ra("low", "high")],
    )
    assert classify_needs_blocking_review(traj) == (True, "b-recent-critical")


def test_condition_b_window_caps_at_five():
    """滑窗只看最近 5 个:超出截断保留**最近** 5 个(丢最早)。

    6 个 recent(5 low + 末尾 critical)→ 丢最早 low,保留含末尾 critical 的 5 个
    → critical 仍在窗内 → 触发 (b)。验证截断方向是"保最近"。
    """
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("low", "high")] * 5 + [_ra("critical", "high")],  # 6 个,末尾最近
    )
    # recent 超过 5 → 截断保留最近 5 个(丢最早的 low,留末尾 critical)
    assert traj.recent == tuple([_ra("low", "high")] * 4 + [_ra("critical", "high")])
    assert classify_needs_blocking_review(traj) == (True, "b-recent-critical")


def test_condition_b_old_critical_outside_window():
    """滑窗保最近:critical 在**最早**位置(被截掉)→ 不触发 (b),放行。"""
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("critical", "high")] + [_ra("low", "high")] * 5,  # 6 个,critical 最早
    )
    # 截断保留最近 5 个(全是 low)→ critical 已被丢出窗外
    assert traj.recent == tuple([_ra("low", "high")] * 5)
    assert classify_needs_blocking_review(traj) == (False, None)


def test_condition_c_anticipated_high_risk():
    """条件 (c):预期未来 2 动作出现 high/critical → 阻断。"""
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("low", "high")] * 5,
        anticipated=[_ra("high", "medium")],
    )
    assert classify_needs_blocking_review(traj) == (True, "c-anticipated")


def test_condition_d_undetermined_current():
    """条件 (d):当前评分缺上下文(risk None)→ 阻断,reason d。"""
    traj = TrajectoryWindow(current=_ra(None, "high"))
    assert classify_needs_blocking_review(traj) == (True, "d")


def test_condition_d_null_current():
    """条件 (d):current 为 None(完全未评估)→ 阻断,reason d。"""
    traj = TrajectoryWindow(current=None)
    assert classify_needs_blocking_review(traj) == (True, "d")


def test_none_trajectory_fails_closed():
    """trajectory 为 None → 阻断,reason undetermined。"""
    assert classify_needs_blocking_review(None) == (True, "undetermined")


def test_recent_none_slot_fails_closed():
    """条件 (b):recent 槽位为 None(未判定)→ fail-closed 阻断。"""
    traj = TrajectoryWindow(
        current=_ra("low", "high"),
        recent=[_ra("low", "high"), None],
    )
    needs, reason = classify_needs_blocking_review(traj)
    assert needs is True
    assert reason in (
        "b-recent-undetermined",
        "b-recent-authorization",
        "b-recent-critical",
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
