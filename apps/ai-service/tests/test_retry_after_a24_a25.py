# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# tests/test_retry_after_a24_a25.py
"""A24/A25 provider 重试族收口验收(2026-09-26,MECHANISM-SPEC-6)。

判据按规格验收标准逐条落:
- 三层优先级各一正一反(明示不重试 / Retry-After 毫秒 / 秒 / HTTP-date 分别压过曲线);
- 坏值回落不崩;
- 反向对照:**无相关头时本地曲线逐字节不变**(防本票把既有退避改形);
- "次数→尝试数"的 +1 只出现在一个函数里(源码级镜像判据,守门 22c 同型);
- 无上限档:只有放弃/继续两表达式被放宽,退避/指示优先/封顶结构上收不到 budget;
  哨兵 JSON 往返仍是哨兵;合法尝试数 0 不得被判成无上限。
"""

from __future__ import annotations

import inspect
import json
from datetime import UTC, datetime, timedelta
from email.utils import format_datetime
from typing import Any

import httpx
import pytest

from app.core.retry_after import (
    MAX_SERVER_RETRY_DELAY_S,
    UNLIMITED_ATTEMPTS,
    ServerRetryHint,
    attempts_reported,
    extract_server_retry_hint,
    hint_from_error,
    loop_should_continue,
    may_attempt_again,
    parse_retry_after_ms,
    parse_retry_after_seconds,
    parse_should_retry,
    resolve_retry_delay_s,
    retry_budget_to_attempts,
)
from app.providers.base_provider import BaseProvider, ProviderError

_LOCAL_CURVE = 0.2 * (2.0**2)  # 模拟 responses_retry.backoff(3)


# --- 第 2 层:HTTP-date 形态 -----------------------------------------------------
def test_http_date_beats_local_curve() -> None:
    when = datetime.now(UTC) + timedelta(seconds=30)
    hint = extract_server_retry_hint({"Retry-After": format_datetime(when)})
    assert hint.retry_after_s is not None
    assert 20.0 <= hint.retry_after_s <= 31.0
    assert resolve_retry_delay_s(hint, _LOCAL_CURVE) == hint.retry_after_s


def test_http_date_clock_skew_clamped_to_zero_not_negative() -> None:
    when = datetime.now(UTC) - timedelta(seconds=120)
    hint = extract_server_retry_hint({"Retry-After": format_datetime(when)})
    assert hint.retry_after_s == 0.0  # 负等待被夹到 0(风险③)
    assert resolve_retry_delay_s(hint, _LOCAL_CURVE) == 0.0


# --- 第 2 层:毫秒非标准头,且优先级高于秒头 -------------------------------------
def test_retry_after_ms_header_wins_over_seconds_header() -> None:
    hint = extract_server_retry_hint(
        {"retry-after-ms": "5000", "Retry-After": "120"}
    )
    assert hint.retry_after_s == pytest.approx(5.0)


def test_garbage_ms_header_falls_back_to_seconds_header() -> None:
    hint = extract_server_retry_hint(
        {"retry-after-ms": "banana", "Retry-After": "9"}
    )
    assert hint.retry_after_s == 9.0


def test_seconds_beat_body_retry_after() -> None:
    hint = extract_server_retry_hint(
        {"Retry-After": "20"}, {"retry_after": 7}
    )
    assert hint.retry_after_s == 20.0


def test_body_retry_after_used_when_no_headers() -> None:
    hint = extract_server_retry_hint({}, {"retry_after": 30})
    assert hint.retry_after_s == 30.0
    assert resolve_retry_delay_s(hint, _LOCAL_CURVE) == 30.0


def test_body_retry_after_negative_is_bad_value_fallback() -> None:
    hint = extract_server_retry_hint({}, {"retry_after": -5})
    assert hint.retry_after_s is None


# --- 第 1 层:明示不要再试,压过一切(含 Retry-After)-----------------------------
def test_should_retry_false_overrides_retry_after_and_curve() -> None:
    hint = extract_server_retry_hint(
        {"x-should-retry": "false", "Retry-After": "30"}
    )
    assert hint.should_retry is False
    assert resolve_retry_delay_s(hint, _LOCAL_CURVE) is None  # None = 不重试


def test_should_retry_true_is_non_interference_not_a_command() -> None:
    # "true" 只代表"允许重试",不得反过来强制重试或改写等待
    hint = extract_server_retry_hint({"x-should-retry": "true"})
    assert hint.should_retry is True
    assert resolve_retry_delay_s(hint, _LOCAL_CURVE) == _LOCAL_CURVE


# --- 反向对照:无相关头时曲线逐字节不变 ------------------------------------------
def test_no_headers_curve_is_byte_identical_passthrough() -> None:
    hint = extract_server_retry_hint(
        {"content-type": "application/json", "x-trace": "abc"}, {"error": {"code": "oops"}}
    )
    assert hint == ServerRetryHint()  # 缺省 = 不干预
    resolved = resolve_retry_delay_s(hint, _LOCAL_CURVE)
    assert resolved is not None
    assert repr(resolved) == repr(_LOCAL_CURVE)  # 逐字节:同一个 float,无缩放
    assert repr(resolve_retry_delay_s(None, _LOCAL_CURVE)) == repr(_LOCAL_CURVE)


# --- 坏值回落不崩 ------------------------------------------------------------------
@pytest.mark.parametrize("bad", [None, "", "   ", "-5", "banana", "Fri, 99 Xyz 2026", True, [], {}, 3.5e400])
def test_bad_values_fall_back_to_none_without_raising(bad: object) -> None:
    assert parse_retry_after_seconds(bad) is None or parse_retry_after_seconds(bad) == pytest.approx(
        3.5e400
    )  # float('inf') 形态允许存在,封顶在 resolve 兜


def test_parse_primitives_edge_forms() -> None:
    assert parse_retry_after_seconds("30") == 30.0
    assert parse_retry_after_seconds(" 30.5 ") == 30.5
    assert parse_retry_after_seconds(30) == 30.0
    assert parse_retry_after_ms("2500") == 2.5
    assert parse_retry_after_ms(-1) is None
    assert parse_should_retry("FALSE") is False
    assert parse_should_retry("yes") is None  # 非法值 = 不干预,不是 True


def test_server_delay_capped_to_guard_against_silent_hang() -> None:
    hint = ServerRetryHint(retry_after_s=3600.0)
    assert resolve_retry_delay_s(hint, _LOCAL_CURVE) == MAX_SERVER_RETRY_DELAY_S


# --- "次数 vs 尝试数"换算只在一处(源码级镜像判据)--------------------------------
def test_plus_one_conversion_lives_in_exactly_one_function() -> None:
    module = inspect.getmodule(retry_budget_to_attempts)
    assert module is not None
    carriers = [
        name
        for name, fn in inspect.getmembers(module, inspect.isfunction)
        if fn.__module__ == module.__name__ and "+ 1" in inspect.getsource(fn)
    ]
    assert carriers == ["retry_budget_to_attempts"], (
        f"+1 换算泄漏到 {carriers}:全仓只允许 retry_budget_to_attempts 一处"
    )


def test_budget_to_attempts_semantics_match_provider_caps() -> None:
    # provider_caps.request_max_retries 缺省 2(不含首次)→ 尝试数 3(含首次)
    assert retry_budget_to_attempts(2) == 3
    assert retry_budget_to_attempts(0) == 1  # 0 次重试 = 恰好首发


# --- A24:无上限哨兵与三条等价表达式 ------------------------------------------------
def test_unlimited_relaxes_only_giveup_and_continue() -> None:
    assert may_attempt_again(UNLIMITED_ATTEMPTS, 10**6) is True
    assert loop_should_continue(UNLIMITED_ATTEMPTS, 10**6) is True
    # 有限预算逐条不变(只放宽两表达式,不顺手改其它档)
    assert may_attempt_again(2, 2) is True
    assert may_attempt_again(2, 3) is False
    assert loop_should_continue(2, 3) is False


def test_unlimited_does_not_touch_backoff_or_server_priority() -> None:
    # 结构性证明:退避/指示裁决的签名里根本没有 budget 参数 —— 无上限档
    # 在类型上就无法改这两处判据(规格"只放宽一条判据"的机器形态)。
    for fn in (resolve_retry_delay_s, extract_server_retry_hint, retry_budget_to_attempts):
        assert "budget" not in inspect.signature(fn).parameters


def test_sentinel_serialization_roundtrip_is_sentinel_not_zero() -> None:
    payload = json.dumps({"max_attempts": attempts_reported(UNLIMITED_ATTEMPTS, 7)})
    back = json.loads(payload)
    assert back["max_attempts"] == UNLIMITED_ATTEMPTS
    assert back["max_attempts"] != 0  # 不得被序列化成"0 次尝试"的假象


def test_zero_attempts_is_not_unlimited() -> None:
    assert attempts_reported(5, 0) == 0
    assert attempts_reported(5, 0) != UNLIMITED_ATTEMPTS
    # 预算 0(不重试)与"无上限"是值域两端,不得互判
    assert may_attempt_again(0, 0) is True  # 首发仍允许
    assert may_attempt_again(0, 1) is False


# --- 生产端接线:ProviderError 携带 + hint_from_error 读出 --------------------------
def test_provider_error_carries_hint_defaults_are_backcompat() -> None:
    legacy = ProviderError("旧调用点不传新参数", 429)
    assert legacy.retry_after_s is None
    assert legacy.should_retry is True
    err = ProviderError("限频", 429, retry_after_s=17.0, should_retry=False)
    hint = hint_from_error(err)
    assert hint is not None
    assert hint.retry_after_s == 17.0
    assert hint.should_retry is False


def test_hint_from_error_on_unrelated_exception_is_none() -> None:
    # 反向对照:LiteLLM 等不携带指示的异常 → None → 调用方曲线零变化
    assert hint_from_error(RuntimeError("boom")) is None


class _ProbeProvider(BaseProvider):
    """最小可实例化子类,只为驱动 _request 单点。"""

    async def complete(
        self, messages: list[dict[str, Any]], model: str, *, tools: list[dict[str, Any]] | None = None, **kwargs: Any
    ) -> dict[str, Any]:
        return {}

    def astream(
        self, messages: list[dict[str, Any]], model: str, *, tools: list[dict[str, Any]] | None = None, **kwargs: Any
    ) -> Any:
        raise NotImplementedError


class _FakeClient:
    def __init__(self, response: httpx.Response) -> None:
        self._response = response

    async def request(self, *_args: Any, **_kwargs: Any) -> httpx.Response:
        return self._response


async def test_base_provider_request_attaches_retry_after_from_headers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    resp = httpx.Response(
        429,
        headers={"Retry-After": "17", "x-should-retry": "true"},
        json={"error": {"message": "slow down"}},
    )
    monkeypatch.setattr(
        "app.providers.base_provider.get_http_client", lambda: _FakeClient(resp)
    )
    probe = _ProbeProvider(api_key="k")
    with pytest.raises(ProviderError) as caught:
        await probe._request("POST", "https://example.invalid/v1/x")
    assert caught.value.retry_after_s == 17.0
    assert caught.value.should_retry is True


async def test_base_provider_request_non_json_error_body_still_carries_header(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # 429 + HTML 错误页:体解析失败,但头里的指示必须随异常上行
    resp = httpx.Response(503, headers={"retry-after": "8"}, text="<html>503</html>")
    monkeypatch.setattr(
        "app.providers.base_provider.get_http_client", lambda: _FakeClient(resp)
    )
    probe = _ProbeProvider(api_key="k")
    with pytest.raises(ProviderError) as caught:
        await probe._request("GET", "https://example.invalid/v1/y")
    assert caught.value.retry_after_s == 8.0


async def test_base_provider_request_plain_success_has_no_hint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    resp = httpx.Response(200, json={"ok": True})
    monkeypatch.setattr(
        "app.providers.base_provider.get_http_client", lambda: _FakeClient(resp)
    )
    probe = _ProbeProvider(api_key="k")
    data = await probe._request("GET", "https://example.invalid/v1/z")
    assert data == {"ok": True}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
