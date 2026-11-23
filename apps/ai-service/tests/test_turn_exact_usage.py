# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""精确逐次 token 记账单测(对齐 DSH `dsh-token-meter` 的 turn-usage 严格 fold)。"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.core.turn_exact_usage import (
    MAX_SAFE_INTEGER,
    aggregate_attempts,
    derive_exact_turn_usage_from_iterations,
    parse_attempt_usage,
    summarize_attempts_for_display,
)
from app.core.usage_cache import raw_usage_shape
from app.services.agent_engine import AgentEngine
from app.services.agent_loop_v2 import AgentLoopV2


def test_openai_total_style_splits_cache_buckets() -> None:
    raw = {
        "prompt_tokens": 100,
        "completion_tokens": 10,
        "total_tokens": 110,
        "prompt_tokens_details": {"cached_tokens": 20},
        "cache_creation_input_tokens": 5,
    }
    parsed = parse_attempt_usage(raw)
    assert parsed is not None
    assert parsed.uncached_input_tokens == 75
    assert parsed.cache_read_tokens == 20
    assert parsed.cache_write_tokens == 5
    assert parsed.output_tokens == 10
    assert parsed.total_tokens == 110


def test_anthropic_uncached_style_adds_cache_to_prompt() -> None:
    raw = {
        "input_tokens": 80,
        "output_tokens": 10,
        "cache_read_input_tokens": 20,
        "cache_creation_input_tokens": 5,
        "total_tokens": 115,
    }
    parsed = parse_attempt_usage(raw)
    assert parsed is not None
    assert parsed.uncached_input_tokens == 80
    assert parsed.cache_read_tokens == 20
    assert parsed.cache_write_tokens == 5
    assert parsed.total_tokens == 115


def test_missing_total_requires_both_cache_buckets() -> None:
    assert (
        parse_attempt_usage(
            {
                "prompt_tokens": 100,
                "completion_tokens": 10,
                "prompt_tokens_details": {"cached_tokens": 20},
            }
        )
        is None
    )
    parsed = parse_attempt_usage(
        {
            "prompt_tokens": 100,
            "completion_tokens": 10,
            "prompt_tokens_details": {"cached_tokens": 20},
            "cache_creation_input_tokens": 5,
        }
    )
    assert parsed is not None and parsed.total_tokens == 110


def test_contradictory_total_is_rejected() -> None:
    assert (
        parse_attempt_usage(
            {
                "prompt_tokens": 100,
                "completion_tokens": 10,
                "total_tokens": 90,
            }
        )
        is None
    )
    # 两维缓存都已知时,精确 prompt 必须等于已知 prompt(不允许隐藏差额)。
    assert (
        parse_attempt_usage(
            {
                "prompt_tokens": 100,
                "completion_tokens": 10,
                "total_tokens": 120,
                "prompt_tokens_details": {"cached_tokens": 20},
                "cache_creation_input_tokens": 5,
            }
        )
        is None
    )
    # 未知缓存维允许精确 prompt 大于已知下界。
    parsed = parse_attempt_usage(
        {
            "prompt_tokens": 100,
            "completion_tokens": 10,
            "total_tokens": 120,
        }
    )
    assert parsed is not None and parsed.total_tokens == 120


def test_reasoning_bool_and_negative_are_rejected() -> None:
    assert (
        parse_attempt_usage(
            {
                "prompt_tokens": 10,
                "completion_tokens": 3,
                "total_tokens": 13,
                "reasoning_tokens": 4,
            }
        )
        is None
    )
    assert (
        parse_attempt_usage(
            {
                "prompt_tokens": True,
                "completion_tokens": 10,
                "total_tokens": 11,
            }
        )
        is None
    )
    assert (
        parse_attempt_usage(
            {
                "prompt_tokens": -1,
                "completion_tokens": 10,
                "total_tokens": 9,
            }
        )
        is None
    )


def test_optional_bucket_only_when_all_attempts_report() -> None:
    first = parse_attempt_usage(
        {
            "prompt_tokens": 100,
            "completion_tokens": 10,
            "total_tokens": 110,
            "prompt_tokens_details": {"cached_tokens": 20},
            "cache_creation_input_tokens": 5,
        }
    )
    second = parse_attempt_usage(
        {
            "prompt_tokens": 50,
            "completion_tokens": 5,
            "total_tokens": 55,
        }
    )
    assert first is not None and second is not None
    exact = aggregate_attempts([first, second])
    assert exact is not None
    assert exact.uncached_input_tokens == 75 + 50
    assert exact.total_tokens == 165
    # 第二次没报缓存维 ⇒ 可选桶整轮不出现,但必需总量仍精确。
    assert exact.cache_read_tokens is None
    assert exact.cache_write_tokens is None
    assert "cacheReadTokens" not in exact.as_dict()


def test_routes_only_when_all_attempts_attributed() -> None:
    a = parse_attempt_usage(
        {
            "prompt_tokens": 10,
            "completion_tokens": 2,
            "total_tokens": 12,
            "provider": "openai",
            "model": "m1",
        }
    )
    b = parse_attempt_usage(
        {
            "prompt_tokens": 20,
            "completion_tokens": 3,
            "total_tokens": 23,
            "provider": "openai",
            "model": "m2",
        }
    )
    assert a is not None and b is not None
    exact = aggregate_attempts([a, b])
    assert exact is not None
    assert exact.routes == (("openai", "m1"), ("openai", "m2"))
    c = parse_attempt_usage({"prompt_tokens": 10, "completion_tokens": 2, "total_tokens": 12})
    assert c is not None
    assert aggregate_attempts([a, c]).routes == ()


def test_safe_integer_overflow_rejected() -> None:
    big = {
        "prompt_tokens": MAX_SAFE_INTEGER,
        "completion_tokens": 1,
        "total_tokens": MAX_SAFE_INTEGER + 1,
    }
    assert parse_attempt_usage(big) is None


def test_iterations_with_missing_attempt_make_exact_unknown() -> None:
    assert derive_exact_turn_usage_from_iterations([]) is None
    assert (
        derive_exact_turn_usage_from_iterations(
            [
                SimpleNamespace(
                    usage_attempts=[
                        {
                            "prompt_tokens": 10,
                            "completion_tokens": 2,
                            "total_tokens": 12,
                        }
                    ]
                ),
                SimpleNamespace(usage_attempts=[]),
            ]
        )
        is None
    )
    exact = derive_exact_turn_usage_from_iterations(
        [
            SimpleNamespace(
                usage_attempts=[
                    {
                        "prompt_tokens": 10,
                        "completion_tokens": 2,
                        "total_tokens": 12,
                    },
                    {
                        "prompt_tokens": 20,
                        "completion_tokens": 3,
                        "total_tokens": 23,
                    },
                ]
            )
        ]
    )
    assert exact is not None
    assert exact.uncached_input_tokens == 30
    assert exact.total_tokens == 35


def test_summarize_attempts_keeps_old_keys_and_optional_presence() -> None:
    attempts = [
        parse_attempt_usage(
            {
                "prompt_tokens": 100,
                "completion_tokens": 10,
                "total_tokens": 110,
                "prompt_tokens_details": {"cached_tokens": 20},
                "cache_creation_input_tokens": 5,
                "reasoning_tokens": 3,
            }
        )
    ]
    display = summarize_attempts_for_display([a for a in attempts if a is not None])
    assert display is not None
    assert display["input_tokens"] == 100  # prompt 总量含缓存
    assert display["cached_tokens"] == 20
    assert display["cache_creation_tokens"] == 5
    assert display["reasoning_output_tokens"] == 3
    assert display["attemptCount"] == 1


def test_raw_usage_shape_preserves_unknown_bucket() -> None:
    shape = raw_usage_shape({"prompt_tokens": 10, "completion_tokens": 2})
    assert shape["cache_read_tokens"] is None
    assert shape["cache_write_tokens"] is None
    assert shape["prompt_style"] == "total"
    assert shape["reasoning_tokens"] is None


def test_turn_usage_strict_fold_and_display() -> None:
    result = SimpleNamespace(
        total_tokens_used=110,
        iterations=[
            SimpleNamespace(
                usage_attempts=[
                    {
                        "prompt_tokens": 100,
                        "completion_tokens": 10,
                        "total_tokens": 110,
                        "prompt_tokens_details": {"cached_tokens": 20},
                        "cache_creation_input_tokens": 5,
                        "reasoning_tokens": 2,
                    }
                ]
            )
        ],
    )
    usage = AgentEngine._turn_usage(result)
    assert usage["breakdownSource"] == "provider-exact"
    assert usage["attempts"] == 1
    assert usage["exact"]["totalTokens"] == 110
    assert usage["exact"]["cacheReadTokens"] == 20
    assert usage["exact"]["cacheWriteTokens"] == 5
    assert usage["exact"]["reasoningTokens"] == 2
    assert usage["perIteration"][0]["input_tokens"] == 100


def test_turn_usage_partial_when_attempt_lacks_total() -> None:
    result = SimpleNamespace(
        total_tokens_used=12,
        iterations=[
            SimpleNamespace(usage_attempts=[{"prompt_tokens": 10, "completion_tokens": 2}])
        ],
    )
    usage = AgentEngine._turn_usage(result)
    assert usage["breakdownSource"] == "provider-partial"
    assert "exact" not in usage
    assert "perIteration" not in usage


def test_agent_loop_records_each_llm_attempt_usage() -> None:
    async def _llm(messages, tools):
        return {
            "content": "ok",
            "tool_calls": None,
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 2,
                "total_tokens": 12,
                "prompt_tokens_details": {"cached_tokens": 4},
                "cache_creation_input_tokens": 1,
            },
        }

    async def _run() -> AgentLoopV2:
        loop = AgentLoopV2(
            _llm,
            [],
            enable_checkpoint=False,
            budget_enabled=False,
        )
        result = await loop.run([{"role": "user", "content": "hi"}])
        assert result.success is True
        assert len(result.iterations) == 1
        return result.iterations[0]

    iteration = asyncio.run(_run())
    assert len(iteration.usage_attempts) == 1
    assert iteration.usage_attempts[0]["total_tokens"] == 12
    exact = derive_exact_turn_usage_from_iterations([iteration])
    assert exact is not None
    assert exact.total_tokens == 12
    assert exact.cache_read_tokens == 4
    assert exact.cache_write_tokens == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
