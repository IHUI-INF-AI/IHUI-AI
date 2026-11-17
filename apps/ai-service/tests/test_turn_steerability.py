# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""turn_steerability 行为测试（逆向 codex turn 可操纵性轴，2026-11-18）。

覆盖三面:
1. ``NonSteerableTurnKind`` 二档封闭集（review/compact，逐字对照 codex wire）；
2. ``is_steerable`` 可操纵性判据（review/compact 不可 steer，普通 turn 可 steer）；
3. ``validate_steer`` 裁决（accept / reject + 连带 thread 回滚 + wire 名逐字）；
4. ``non_steerable_wire_names`` 可机检 + 反向变异。
"""

from __future__ import annotations

import pytest

from app.core.turn_steerability import (
    CODEX_NON_STEERABLE_TOTAL,
    NON_STEERABLE_TURN_KIND_VALUES,
    THREAD_ROLLED_BACK_EVENT,
    NonSteerableTurnKind,
    SteerErrorCode,
    SteerVerdict,
    TurnSteerabilityError,
    ensure_turn_kind,
    is_steerable,
    non_steerable_wire_names,
    steer_error_codes,
    validate_steer,
)

# ---------- 封闭集 ----------

def test_closed_set_two_kinds():
    """review/compact 二档，逐字对照 codex NonSteerableTurnKind。"""
    assert {k.value for k in NonSteerableTurnKind} == {"review", "compact"}


def test_total_constant_matches_members():
    assert CODEX_NON_STEERABLE_TOTAL == len(NonSteerableTurnKind) == 2


def test_literal_table_matches_members():
    assert tuple(k.value for k in NonSteerableTurnKind) == NON_STEERABLE_TURN_KIND_VALUES


# ---------- 可操纵性判据 ----------

@pytest.mark.parametrize("kind", ["review", "compact"])
def test_non_steerable_kinds_rejected(kind: str):
    """review/compact 不可被中途引导。"""
    assert is_steerable(kind) is False


@pytest.mark.parametrize("kind", ["chat", "normal", "user", "", "x"])
def test_ordinary_turns_steerable(kind: str):
    """非封闭集成员（普通对话 turn）可被引导。"""
    assert is_steerable(kind) is True


def test_is_steerable_none_is_steerable():
    """None 不命中封闭集 ⇒ 可 steer（调用方传普通 turn 的宽容处理）。"""
    assert is_steerable(None) is True  # type: ignore[arg-type]


# ---------- 值域闭合 ----------

@pytest.mark.parametrize("raw", ["reviw", "REVIEW", "compaction", "  ", "review "])
def test_ensure_unknown_raises(raw):
    """ensure_turn_kind 只认 review/compact 精确值，误拼/大小写/含空白一律抛错。"""
    with pytest.raises(TurnSteerabilityError):
        ensure_turn_kind(raw)


def test_ensure_known_passthrough():
    assert ensure_turn_kind("review") == "review"
    assert ensure_turn_kind("compact") == "compact"


# ---------- steer 裁决 ----------

@pytest.mark.parametrize(
    ("kind", "wire"),
    [("review", "non_steerable_review"), ("compact", "non_steerable_compact")],
)
def test_steer_rejected_with_error_code(kind: str, wire: str):
    """review/compact 被 steer ⇒ 拒绝 + steer 错误码（不连带回滚）+ wire 名逐字。"""
    result = validate_steer(kind)
    assert result["verdict"] == SteerVerdict.REJECT_NOT_STEERABLE.value
    assert result["error_code"] == SteerErrorCode.ACTIVE_TURN_NOT_STEERABLE.value
    assert result["wire_name"] == wire


@pytest.mark.parametrize("kind", ["chat", "normal", ""])
def test_steer_accepted_for_ordinary(kind: str):
    """普通 turn 被 steer ⇒ 接受、无错误码、无 wire 名。"""
    result = validate_steer(kind)
    assert result["verdict"] == SteerVerdict.ACCEPT.value
    assert result["error_code"] is None
    assert result["wire_name"] is None


def test_steer_result_has_no_rollback_field():
    """拒绝裁决**不**返回「连带回滚」——R52 纠偏后该键已移除（防旧断言回潮）。"""
    result = validate_steer("review")
    assert "thread_rollback" not in result


def test_steer_error_codes_domain():
    """steer 错误码分域：含 not_steerable + rollback_failed，不含回滚成功事件。"""
    codes = steer_error_codes()
    assert codes == (
        SteerErrorCode.ACTIVE_TURN_NOT_STEERABLE.value,
        SteerErrorCode.THREAD_ROLLBACK_FAILED.value,
    )
    assert THREAD_ROLLED_BACK_EVENT == "thread_rolled_back"
    assert THREAD_ROLLED_BACK_EVENT not in codes  # 回滚成功事件不同域


def test_steer_error_code_closed_set():
    assert {c.value for c in SteerErrorCode} == {
        "active_turn_not_steerable",
        "thread_rollback_failed",
    }


def test_verdict_closed_set():
    assert {v.value for v in SteerVerdict} == {"accept", "reject_not_steerable"}


# ---------- wire 名可机检 ----------

def test_wire_names_verbatim_order():
    """wire 名逐字 + 与封闭集同序（serde rename）。"""
    assert non_steerable_wire_names() == (
        "non_steerable_review",
        "non_steerable_compact",
    )


def test_wire_names_all_distinct():
    wires = non_steerable_wire_names()
    assert len(set(wires)) == CODEX_NON_STEERABLE_TOTAL


# ---------- 反向变异（守不住即测试失败） ----------

def test_mutation_review_marked_steerable():
    """若 review 被误判为可 steer 应被抓。"""
    with pytest.raises(AssertionError):
        assert is_steerable("review") is True


def test_mutation_rollback_success_leaks_into_error_codes():
    """若把「回滚成功」事件误并入 steer 错误码表应被抓（分域不可混）。"""
    with pytest.raises(AssertionError):
        assert THREAD_ROLLED_BACK_EVENT in steer_error_codes()


def test_mutation_wire_name_wrong():
    """若 wire 名错位（compact 复用 review 名）应被抓。"""
    with pytest.raises(AssertionError):
        assert non_steerable_wire_names() == (
            "non_steerable_review",
            "non_steerable_review",
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
