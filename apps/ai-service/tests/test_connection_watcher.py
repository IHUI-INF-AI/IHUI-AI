# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B2-04 分级看门狗重连判据测试(2026-11-28)。

钉四件事:

  1. **原因分级优先于次数分级**:auth/fatal 零重试,不管 attempt 是几;
  2. **前两次走 immediate**:抖动恢复在百毫秒级,退避会拖慢;
  3. **预算耗尽必 give_up 且具名**:不静默继续烧;
  4. **非法输入归一不抛**:attempt 传 0/-1/bool/str 都归一到 1 并标记 `coerced`。
"""

from __future__ import annotations

from app.services.connection_watcher import (
    BACKOFF_SECONDS,
    DEFAULT_MAX_ATTEMPTS,
    IMMEDIATE_ATTEMPTS,
    DisconnectClass,
    ReconnectReason,
    ReconnectTier,
    backoff_delay,
    plan_reconnect,
)


def test_unknown_class_gives_up() -> None:
    out = plan_reconnect(1, 'weird')
    assert out['tier'] == ReconnectTier.GIVE_UP.value
    assert out['reason'] == ReconnectReason.UNKNOWN_CLASS.value
    assert out['delay_s'] == 0.0


def test_non_string_class_gives_up() -> None:
    for bad in (None, 1, [], {}):
        out = plan_reconnect(1, bad)
        assert out['reason'] == ReconnectReason.UNKNOWN_CLASS.value, bad


def test_auth_never_retries() -> None:
    for attempt in (1, 2, 3, 99):
        out = plan_reconnect(attempt, DisconnectClass.AUTH.value)
        assert out['tier'] == ReconnectTier.GIVE_UP.value, attempt
        assert out['reason'] == ReconnectReason.AUTH_INVALID.value


def test_fatal_never_retries() -> None:
    out = plan_reconnect(1, DisconnectClass.FATAL.value)
    assert out['reason'] == ReconnectReason.FATAL_ERROR.value


def test_first_two_transient_are_immediate() -> None:
    for attempt in (1, 2):
        out = plan_reconnect(attempt, DisconnectClass.TRANSIENT.value)
        assert out['tier'] == ReconnectTier.IMMEDIATE.value, attempt
        assert out['delay_s'] == 0.0, attempt


def test_third_transient_backs_off() -> None:
    out = plan_reconnect(3, DisconnectClass.TRANSIENT.value)
    assert out['tier'] == ReconnectTier.BACKOFF.value
    assert out['delay_s'] == 4.0


def test_budget_exhausted_gives_up() -> None:
    out = plan_reconnect(DEFAULT_MAX_ATTEMPTS, DisconnectClass.TRANSIENT.value)
    assert out['tier'] == ReconnectTier.GIVE_UP.value
    assert out['reason'] == ReconnectReason.BUDGET_EXHAUSTED.value


def test_custom_budget_respected() -> None:
    out = plan_reconnect(3, DisconnectClass.TRANSIENT.value, max_attempts=3)
    assert out['tier'] == ReconnectTier.GIVE_UP.value
    assert out['reason'] == ReconnectReason.BUDGET_EXHAUSTED.value


def test_protocol_class_uses_normal_tiers() -> None:
    """protocol 是"可恢复但非抖动",走正常分级而不是零重试。"""
    early = plan_reconnect(1, DisconnectClass.PROTOCOL.value)
    assert early['tier'] == ReconnectTier.IMMEDIATE.value
    late = plan_reconnect(4, DisconnectClass.PROTOCOL.value)
    assert late['tier'] == ReconnectTier.BACKOFF.value


def test_illegal_attempt_is_coerced_not_raised() -> None:
    for bad in (0, -5, True, 'x', None):
        out = plan_reconnect(bad, DisconnectClass.TRANSIENT.value)
        assert out['attempt'] == 1, bad
        assert out['coerced'] is True, bad
        assert out['tier'] == ReconnectTier.IMMEDIATE.value, bad


def test_legal_attempt_is_not_marked_coerced() -> None:
    out = plan_reconnect(3, DisconnectClass.TRANSIENT.value)
    assert out['coerced'] is False


def test_backoff_sequence_values() -> None:
    expected = (1.0, 2.0, 4.0, 8.0, 16.0, 30.0)
    for attempt, want in enumerate(expected, start=1):
        assert backoff_delay(attempt) == want, attempt
    assert len(BACKOFF_SECONDS) == len(expected)


def test_backoff_clamps_at_both_ends() -> None:
    assert backoff_delay(0) == 1.0
    assert backoff_delay(-3) == 1.0
    assert backoff_delay(99) == 30.0


def test_give_up_always_zero_delay() -> None:
    cases = [
        (1, DisconnectClass.AUTH.value),
        (1, DisconnectClass.FATAL.value),
        (99, DisconnectClass.TRANSIENT.value),
        (1, 'unknown'),
    ]
    for attempt, cls in cases:
        out = plan_reconnect(attempt, cls)
        assert out['delay_s'] == 0.0, (attempt, cls)


def test_immediate_attempts_constant() -> None:
    assert IMMEDIATE_ATTEMPTS == 2
    assert DEFAULT_MAX_ATTEMPTS > IMMEDIATE_ATTEMPTS


def test_result_shape() -> None:
    out = plan_reconnect(3, DisconnectClass.TRANSIENT.value)
    assert set(out) == {'tier', 'reason', 'delay_s', 'attempt', 'coerced', 'detail'}
    assert isinstance(out['detail'], str) and out['detail']


def test_enum_values() -> None:
    assert {c.value for c in DisconnectClass} == {'transient', 'protocol', 'auth', 'fatal'}
    assert {t.value for t in ReconnectTier} == {'immediate', 'backoff', 'give_up'}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
