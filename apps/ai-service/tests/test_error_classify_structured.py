# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构化优先错误分类测试(app.core.error_classify_structured)。

对照 Codex error taxonomy:rate_limit(429) / http_5xx 均 ∈ Retryable。
复现差距:_classify_error 文本启发式对 ProviderError(429) 漏分类(unknown/http_4xx →
undetermined/terminal),本模块用 status_code 优先修复。
"""
from __future__ import annotations

import pytest

from app.core.agent_failure_vocabulary import (
    AGENT_RETRYABLE_ERROR_FAMILIES,
    AGENT_TERMINAL_ERROR_FAMILIES,
    agent_failure_outcome_of,
)
from app.core.error_classify_structured import (
    RATE_LIMIT_RETRYABLE_FAMILY,
    classify_error_structured_first,
    classify_from_status_code,
)
from app.providers.base_provider import ProviderError


# --- classify_from_status_code: 状态码 → 错误族 -------------------------------
def test_429_maps_to_rate_limit():
    assert classify_from_status_code(429) == "rate_limit"


@pytest.mark.parametrize("code", [500, 502, 503, 504])
def test_5xx_maps_to_http_5xx(code: int):
    assert classify_from_status_code(code) == "http_5xx"


@pytest.mark.parametrize("code", [400, 401, 403, 404, 422])
def test_4xx_non_429_maps_to_http_4xx(code: int):
    assert classify_from_status_code(code) == "http_4xx"


@pytest.mark.parametrize("code", [None, 100, 200, 301, 399])
def test_below_400_or_none_falls_back(code):
    assert classify_from_status_code(code) is None


# --- classify_error_structured_first: ProviderError 结构化认领 -----------------
def test_provider_error_429_no_text_keyword_is_rate_limit():
    """差距正解:ProviderError("限频", 429) 文本无关键字,结构化认领 → rate_limit。"""
    e = ProviderError("限频", 429)
    assert classify_error_structured_first(e) == "rate_limit"


def test_provider_error_429_with_http_text_is_rate_limit_not_http_4xx():
    """文本启发式原本把 'http 429 …' 误判 http_4xx;结构化优先纠正为 rate_limit。"""
    e = ProviderError("http 429 too many requests", 429)
    assert classify_error_structured_first(e) == "rate_limit"


@pytest.mark.parametrize("code", [500, 503])
def test_provider_error_5xx_is_http_5xx(code: int):
    assert classify_error_structured_first(ProviderError("server error", code)) == "http_5xx"


def test_provider_error_4xx_non_429_is_http_4xx():
    assert classify_error_structured_first(ProviderError("bad request", 400)) == "http_4xx"


# --- 文本启发式兜底回归(无 status_code 的异常,行为不变)------------------------
def test_timeout_exception_is_timeout():
    # asyncio.TimeoutError 是内置 TimeoutError 的别名(Python 3.11+),二者同一对象。
    assert classify_error_structured_first(TimeoutError()) == "timeout"


class _FakeConnectionError(ConnectionError):
    pass


def test_connection_error_is_connection():
    assert classify_error_structured_first(_FakeConnectionError()) == "connection"


def test_plain_runtime_error_is_unknown():
    assert classify_error_structured_first(RuntimeError("boom")) == "unknown"


def test_text_http_5xx_fallback_still_works():
    """无 status_code 属性的异常走文本兜底,保持既有回归红线。

    注:此处用 ``error 503``(5 在前 12 字符内)触发。逐字对照 loop v2
    ``_classify_error`` 的 ``"5" in text[:12]`` 切片——503 出现在 index 16 的
    形态(如 "got http status 503")在 loop v2 也返回 unknown,该切片脆弱性
    是 loop v2 既有问题,不在本文件范围(在飞文件非在飞窗口另议)。
    """
    e = RuntimeError("error 503 server error")
    assert classify_error_structured_first(e) == "http_5xx"


# --- 消费方词汇表对齐(rate_limit 应 ∈ 可重试族)---------------------------------
def test_rate_limit_family_is_registered_retryable():
    """词汇表须把 rate_limit 登记进可重试族;未登记时本测试红,提示消费方同步。"""
    assert RATE_LIMIT_RETRYABLE_FAMILY in AGENT_RETRYABLE_ERROR_FAMILIES


def test_rate_limit_not_in_terminal_family():
    assert RATE_LIMIT_RETRYABLE_FAMILY not in AGENT_TERMINAL_ERROR_FAMILIES


def test_rate_limit_outcome_is_retryable():
    """端到端:429 → rate_limit → 词汇表判 retryable(对齐 Codex)。"""
    fam = classify_error_structured_first(ProviderError("限频", 429))
    assert fam == "rate_limit"
    assert agent_failure_outcome_of(fam) == "retryable"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
