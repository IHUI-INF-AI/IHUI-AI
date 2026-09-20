# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# tests/test_responses_retry_56.py
"""responses_retry 纯决策函数单测(2026-09-20 第五十六批)。

stub / monkeypatch 风格对齐同目录近期测试;pytest asyncio_mode=auto 已配。
"""

from __future__ import annotations

import pytest

from app.core.responses_retry import (
    DEFAULT_REQUEST_MAX_RETRIES,
    DEFAULT_STREAM_IDLE_TIMEOUT_MS,
    DEFAULT_STREAM_MAX_RETRIES,
    HARD_MAX_RETRIES_CAP,
    INITIAL_CONNECTION_RETRY_DELAY,
    MAX_CONNECTION_RETRY_DELAY,
    ExhaustedResponseRetry,
    ResponsesStreamRetryState,
    backoff,
    decide_stream_retry,
    handle_retryable_stream_error,
    is_retryable_error,
    jittered,
)


class _RngStub:
    """可注入的 rng stub,random() 固定返回值。"""

    def __init__(self, value: float) -> None:
        self._value = value

    def random(self) -> float:
        return self._value


def _new_state() -> ResponsesStreamRetryState:
    return ResponsesStreamRetryState()


def _unbounded_kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = dict(
        max_retries=5,
        is_connection_failed=True,
        unbounded_connection_retries_enabled=True,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        websocket_transport=True,
    )
    base.update(overrides)
    return base


# --- 常量 ----------------------------------------------------------------
def test_constants_correct() -> None:
    assert INITIAL_CONNECTION_RETRY_DELAY == 5.0
    assert MAX_CONNECTION_RETRY_DELAY == 60.0
    assert DEFAULT_STREAM_MAX_RETRIES == 5
    assert DEFAULT_REQUEST_MAX_RETRIES == 4
    assert HARD_MAX_RETRIES_CAP == 100
    assert DEFAULT_STREAM_IDLE_TIMEOUT_MS == 300_000


# --- backoff -------------------------------------------------------------
def test_backoff_sequence() -> None:
    assert backoff(0) == 0.2
    assert backoff(1) == 0.2
    assert backoff(2) == 0.4
    assert backoff(3) == 0.8


def test_backoff_grows_exponentially() -> None:
    assert backoff(5) == 0.2 * 16  # 3.2
    assert backoff(10) == 0.2 * (2 ** 9)


# --- jittered ------------------------------------------------------------
def test_jittered_low_bound() -> None:
    assert jittered(1.0, _RngStub(0.0)) == 0.9


def test_jittered_high_bound() -> None:
    assert jittered(1.0, _RngStub(0.999)) == 0.9 + 0.999 * 0.2


# --- 无限重连 ------------------------------------------------------------
def test_unbounded_retry_triggers() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(state, **_unbounded_kwargs())  # type: ignore[arg-type]
    assert decision.action == "unbounded_retry"
    assert decision.delay == INITIAL_CONNECTION_RETRY_DELAY
    assert decision.notify_message == "Reconnecting... waiting for network"
    assert state.connection_retries == 1


def test_unbounded_delay_doubles_and_caps() -> None:
    state = _new_state()
    delays: list[float] = []
    for _ in range(8):
        _s, decision = decide_stream_retry(state, **_unbounded_kwargs())  # type: ignore[arg-type]
        delays.append(decision.delay)
    assert delays[:4] == [5.0, 10.0, 20.0, 40.0]
    assert all(d == MAX_CONNECTION_RETRY_DELAY for d in delays[4:])
    assert state.connection_retry_delay == MAX_CONNECTION_RETRY_DELAY


def test_unbounded_not_triggered_feature_disabled() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state, **_unbounded_kwargs(unbounded_connection_retries_enabled=False)  # type: ignore[arg-type]
    )
    assert decision.action != "unbounded_retry"


def test_unbounded_not_triggered_not_connection_failed() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state, **_unbounded_kwargs(is_connection_failed=False)  # type: ignore[arg-type]
    )
    assert decision.action != "unbounded_retry"


def test_unbounded_not_triggered_internal() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state, **_unbounded_kwargs(session_is_internal=True)  # type: ignore[arg-type]
    )
    assert decision.action != "unbounded_retry"


def test_unbounded_not_triggered_bedrock() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state, **_unbounded_kwargs(provider_is_bedrock=True)  # type: ignore[arg-type]
    )
    assert decision.action != "unbounded_retry"


# --- 传输降级 ------------------------------------------------------------
def test_fallback_switch_triggers_and_resets() -> None:
    state = ResponsesStreamRetryState(retries=5)
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=True,
    )
    assert decision.action == "switch_transport"
    assert decision.notify_message.startswith(
        "Falling back from WebSockets to HTTPS transport."
    )
    assert state.retries == 0


def test_fallback_not_triggered_without_fallback_transport() -> None:
    state = ResponsesStreamRetryState(retries=5)
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
    )
    # 没有 fallback 传输 → 进入耗尽分支
    assert decision.action == "exhausted"


# --- 普通重试 + report_error 规则 ----------------------------------------
def test_normal_retry_first_ws_report_error_false() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        websocket_transport=True,
        debug_assertions=False,
    )
    assert decision.action == "retry"
    assert state.retries == 1
    assert decision.notify_message == "Reconnecting... 1/5"
    assert decision.report_error is False


def test_normal_retry_second_report_error_true() -> None:
    state = ResponsesStreamRetryState(retries=1)
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        websocket_transport=True,
        debug_assertions=False,
    )
    assert decision.action == "retry"
    assert state.retries == 2
    assert decision.report_error is True


def test_normal_retry_debug_assertions_forces_report() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        websocket_transport=True,
        debug_assertions=True,
    )
    assert decision.report_error is True


# --- server_retry_delay 优先 ---------------------------------------------
def test_server_retry_delay_preferred_over_backoff() -> None:
    state = _new_state()
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        server_retry_delay=12.5,
    )
    assert decision.delay == 12.5
    assert state.retries == 1


# --- 耗尽 ----------------------------------------------------------------
def test_exhausted_returns_exhausted_no_retry_at() -> None:
    state = ResponsesStreamRetryState(retries=5)
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
    )
    assert decision.action == "exhausted"
    assert decision.notify_message is None
    assert isinstance(decision.exhausted, ExhaustedResponseRetry)
    assert decision.exhausted is not None
    assert decision.exhausted.retry_at is None


def test_exhausted_retry_at_with_server_delay() -> None:
    state = ResponsesStreamRetryState(retries=5)
    fake_clock = lambda: 1000.0  # noqa: E731
    _s, decision = decide_stream_retry(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        server_retry_delay=2.5,
        clock=fake_clock,
    )
    assert decision.action == "exhausted"
    assert decision.exhausted is not None
    assert decision.exhausted.retry_at == 1002.5


# --- is_retryable_error --------------------------------------------------
def test_is_retryable_error_classifications() -> None:
    assert is_retryable_error("timeout") is True
    assert is_retryable_error("connection") is True
    assert is_retryable_error("http_5xx") is True
    assert is_retryable_error("unknown") is True
    assert is_retryable_error("http_4xx") is False
    assert is_retryable_error("cancelled") is False
    assert is_retryable_error("something_else") is False


# --- async 外壳 handle_retryable_stream_error ----------------------------
async def test_handle_retry_sleeps_with_delay(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []
    stub_sleep = lambda d: sleeps.append(d)  # noqa: E731
    monkeypatch.setattr("app.core.responses_retry.asyncio.sleep", stub_sleep)
    state = _new_state()
    decision = await handle_retryable_stream_error(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
        server_retry_delay=0.0,
    )
    assert decision.action == "retry"
    assert sleeps == [0.0]


async def test_handle_exhausted_does_not_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []
    stub_sleep = lambda d: sleeps.append(d)  # noqa: E731
    monkeypatch.setattr("app.core.responses_retry.asyncio.sleep", stub_sleep)
    state = ResponsesStreamRetryState(retries=5)
    decision = await handle_retryable_stream_error(
        state,
        max_retries=5,
        is_connection_failed=False,
        unbounded_connection_retries_enabled=False,
        session_is_internal=False,
        provider_is_bedrock=False,
        fallback_transport_available=False,
    )
    assert decision.action == "exhausted"
    assert sleeps == []
