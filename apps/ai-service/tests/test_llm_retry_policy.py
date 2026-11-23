# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""LLM 重试策略纯函数层:白名单、档位、退避、retryId 与 env 解析。"""
from __future__ import annotations

import pytest

from app.core.llm_retry_policy import (
    MAX_ALWAYS_ATTEMPTS,
    LlmRetryPolicy,
    resolve_llm_retry_policy,
    retry_id_for,
)


def test_default_policy_keeps_all_error_families_retryable():
    # 缺省不设白名单:与接线前的"除 cancelled 外都可重试"逐字同义。
    policy = LlmRetryPolicy()
    assert policy.allows("unknown") is True
    assert policy.allows("http_4xx") is True
    assert policy.allows("cancelled") is False
    assert policy.attempt_limit(3) == 3


def test_explicit_whitelist_rejects_outside_codes():
    policy = LlmRetryPolicy(retryable_codes=frozenset({"timeout", "rate_limit"}))
    assert policy.allows("timeout") is True
    assert policy.allows("rate_limit") is True
    assert policy.allows("http_4xx") is False
    assert policy.allows("unknown") is False


def test_always_mode_extends_budget_but_still_never_retries_cancel():
    policy = LlmRetryPolicy(mode="always")
    assert policy.attempt_limit(0) == MAX_ALWAYS_ATTEMPTS
    assert policy.allows("http_4xx") is True
    assert policy.allows("cancelled") is False


def test_backoff_matches_existing_curve_and_caps_at_max_delay():
    policy = LlmRetryPolicy(initial_delay_s=1.0, jitter_ratio=0.5, max_delay_s=10.0)
    assert policy.backoff_s(0, rng=lambda: 1.0) == pytest.approx(1.0)
    assert policy.backoff_s(0, rng=lambda: 0.0) == pytest.approx(0.5)
    assert policy.backoff_s(3, rng=lambda: 1.0) == pytest.approx(8.0)
    assert policy.backoff_s(9, rng=lambda: 1.0) == pytest.approx(10.0)


def test_retry_id_is_deterministic_per_session_and_iteration():
    a = retry_id_for("s1", 2)
    b = retry_id_for("s1", 2)
    c = retry_id_for("s1", 3)
    d = retry_id_for(None, 2)
    assert a == b and a != c and a != d
    assert a.startswith("llmretry-") and len(a) == len("llmretry-") + 16


def test_env_resolution_parses_mode_codes_and_delay():
    policy = resolve_llm_retry_policy(
        None,
        configured_retries=2,
        configured_backoff=0.5,
        environ={
            "IHUI_LLM_RETRY_MODE": "always",
            "IHUI_LLM_RETRYABLE_CODES": "timeout, rate_limit ,,",
            "IHUI_LLM_RETRY_MAX_DELAY_S": "12.5",
        },
    )
    assert policy.mode == "always"
    assert policy.retryable_codes == frozenset({"timeout", "rate_limit"})
    assert policy.max_delay_s == 12.5
    assert policy.initial_delay_s == 0.5


def test_env_resolution_rejects_invalid_mode_and_delay():
    with pytest.raises(ValueError, match="IHUI_LLM_RETRY_MODE"):
        resolve_llm_retry_policy(
            None,
            configured_retries=2,
            configured_backoff=0.5,
            environ={"IHUI_LLM_RETRY_MODE": "sometimes"},
        )
    with pytest.raises(ValueError, match="IHUI_LLM_RETRY_MAX_DELAY_S"):
        resolve_llm_retry_policy(
            None,
            configured_retries=2,
            configured_backoff=0.5,
            environ={"IHUI_LLM_RETRY_MAX_DELAY_S": "soon"},
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
