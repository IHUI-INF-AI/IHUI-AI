# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""重放感知 token 计量(第十五批)单测。

覆盖:
- 固定密度估算:文本 / 结构块 / tool_calls / system / tools schema;
- 图片 offloaded 标记不改变固定启发式;
- 三投影:surface / breakdown / provider 锚点复用与拒绝;
- provider 用量四桶不二次累加 reasoning;
- 按角色拆 prompt/completion 与入参不变。
"""

from __future__ import annotations

import json
import math

from app.core.token_meter import (
    BLOCK_OVERHEAD,
    CHARS_PER_TOKEN,
    ROLE_OVERHEAD,
    ProviderUsage,
    TokenAnchor,
    build_anchor,
    canonical_envelope_key,
    estimate_content,
    estimate_message,
    estimate_messages,
    estimate_system_message,
    estimate_tool_calls,
    estimate_tools,
    measure_messages,
    prompt_completion_tokens,
)


def _tokens(text: str) -> int:
    return math.ceil(len(text) / CHARS_PER_TOKEN)


def _json_len(value: object) -> int:
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True))


def test_estimate_message_fixed_density_and_system_role() -> None:
    assert estimate_message({"role": "user", "content": "abcd"}) == (
        _tokens("abcd") + BLOCK_OVERHEAD + ROLE_OVERHEAD
    )
    assert estimate_system_message({"role": "system", "content": "a" * 8}) == (
        _tokens("a" * 8) + ROLE_OVERHEAD
    )
    assert estimate_system_message({"role": "system", "content": []}) == 0


def test_estimate_content_blocks_and_tool_calls() -> None:
    blocks = [
        {"type": "text", "text": "abcd"},
        {"type": "reasoning", "text": "efgh"},
    ]
    assert estimate_content(blocks) == 2 * (_tokens("abcd") + BLOCK_OVERHEAD)

    call = {"name": "read", "arguments": json.dumps({"path": "a"})}
    assert estimate_tool_calls([call]) == (
        _tokens("read") + _tokens(json.dumps({"path": "a"})) + BLOCK_OVERHEAD
    )

    message = {
        "role": "assistant",
        "content": "abcd",
        "tool_calls": [
            {
                "function": {
                    "name": "read",
                    "arguments": json.dumps({"path": "a"}),
                }
            }
        ],
    }
    assert estimate_message(message) == (
        _tokens("abcd")
        + BLOCK_OVERHEAD
        + estimate_tool_calls(message["tool_calls"])
        + ROLE_OVERHEAD
    )


def test_image_offloaded_marker_does_not_change_heuristic() -> None:
    block = {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}}
    offloaded = {**block, "offloaded": True}
    assert estimate_content([block]) == estimate_content([offloaded])


def test_estimate_tools_schema() -> None:
    tools = [{"type": "function", "function": {"name": "x", "description": "d"}}]
    assert (
        estimate_tools(tools)
        == _tokens(json.dumps(tools, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
        + BLOCK_OVERHEAD
    )
    assert estimate_tools([]) == 0


def test_measure_breakdown_last_nonempty_system() -> None:
    messages = [
        {"role": "system", "content": "s" * 8},
        {"role": "user", "content": "u" * 4},
        {"role": "assistant", "content": "a" * 4},
        {"role": "system", "content": ""},
    ]
    key = canonical_envelope_key()
    assert len(key) == 64
    assert "u" * 4 not in key  # 只回摘要,不回会话正文
    measurement = measure_messages(messages)
    assert measurement.breakdown.system_tokens == _tokens("s" * 8) + ROLE_OVERHEAD
    assert measurement.breakdown.message_tokens == (
        estimate_message(messages[1]) + estimate_message(messages[2])
    )
    assert measurement.surface_tokens == (
        measurement.breakdown.system_tokens + measurement.breakdown.message_tokens
    )
    assert measurement.total_tokens == measurement.surface_tokens


def test_provider_usage_reused_only_with_matching_anchor() -> None:
    messages = [
        {"role": "system", "content": "s" * 8},
        {"role": "user", "content": "u" * 4},
    ]
    envelope = canonical_envelope_key()
    measured = measure_messages(messages)
    anchor = TokenAnchor(
        envelope_key=envelope,
        estimated_tokens=measured.surface_tokens,
        surface_tokens=measured.surface_tokens,
    )
    usage = ProviderUsage(input_tokens=100, output_tokens=10)

    reused = measure_messages(messages, provider_usage=usage, anchor=anchor, envelope_key=envelope)
    assert reused.baseline == "provider_usage"
    assert reused.total_tokens == 110
    assert reused.pressure_tokens == 100
    assert reused.projected_tokens == 100
    assert reused.provider_usage == usage

    appended = [*messages, {"role": "assistant", "content": "a" * 4}]
    projected = measure_messages(
        appended,
        provider_usage=usage,
        anchor=anchor,
        envelope_key=envelope,
    )
    # 信封键由调用方显式钉住;surface 变了 9,于是带符号增量同时进 total 与 projected。
    assert projected.baseline == "provider_usage"
    assert projected.surface_delta_tokens == estimate_message(appended[-1])
    assert projected.total_tokens == 110 + estimate_message(appended[-1])
    assert projected.projected_tokens == 100 + estimate_message(appended[-1])

    mismatch = measure_messages(
        appended,
        provider_usage=usage,
        anchor=anchor,
        envelope_key=canonical_envelope_key(tools=[{"type": "function", "name": "x"}]),
    )
    assert mismatch.baseline == "estimated"
    assert mismatch.projected_tokens is None
    assert mismatch.total_tokens == mismatch.surface_tokens

    # 压缩后 surface 缩水,但 provider 总量低于锚点当时的完整估算 ⇒ 视为上报不完整,
    # 回退估算;不能拿一份小于锚点的旧用量冒充现值。
    shrunk_anchor = TokenAnchor(
        envelope_key=envelope,
        estimated_tokens=0,
        surface_tokens=1000,
    )
    shrunk = measure_messages(
        messages,
        provider_usage=usage,
        anchor=shrunk_anchor,
        envelope_key=envelope,
    )
    assert shrunk.baseline == "estimated"
    assert shrunk.projected_tokens is None
    assert shrunk.total_tokens == shrunk.surface_tokens


def test_provider_usage_below_anchor_falls_back() -> None:
    messages = [{"role": "user", "content": "u" * 4}]
    envelope = canonical_envelope_key()
    measured = measure_messages(messages)
    anchor = TokenAnchor(
        envelope_key=envelope,
        estimated_tokens=measured.surface_tokens,
        surface_tokens=measured.surface_tokens,
    )
    low = ProviderUsage(input_tokens=1, output_tokens=1)
    result = measure_messages(messages, provider_usage=low, anchor=anchor, envelope_key=envelope)
    assert result.baseline == "estimated"
    assert result.total_tokens == measured.surface_tokens


def test_normalized_usage_subtracts_cache_reads_and_writes() -> None:
    usage = {
        "prompt_tokens": 100,
        "completion_tokens": 10,
        "cached_tokens": 20,
        "cache_creation_tokens": 5,
        "reasoning_tokens": 3,
    }
    provider = ProviderUsage.from_normalized_usage(usage)
    assert provider is not None
    assert provider.input_tokens == 75
    assert provider.prompt_tokens == 100
    assert provider.total_tokens == 110
    assert provider.reasoning_output_tokens == 3


def test_build_anchor_samples_before_last_assistant() -> None:
    messages = [
        {"role": "system", "content": "s" * 8},
        {"role": "user", "content": "u" * 4},
        {"role": "assistant", "content": "a" * 4},
    ]
    usage = {"prompt_tokens": 100, "completion_tokens": 10, "cached_tokens": 20}
    built = build_anchor(messages, usage, model="m")
    assert built is not None
    provider, anchor = built
    assert provider.prompt_tokens == 100
    assert anchor.surface_tokens == estimate_message(messages[0]) + estimate_message(messages[1])
    assert anchor.estimated_tokens == (anchor.surface_tokens + estimate_message(messages[2]))
    assert anchor.envelope_key == canonical_envelope_key(model="m")

    measured = measure_messages(
        messages,
        provider_usage=provider,
        anchor=anchor,
        envelope_key=anchor.envelope_key,
    )
    # 采样点 = 最后一条 assistant 之前;当前 surface 多出的正是 assistant 输出,
    # 它同时进 total 与 projected(下一请求的 prompt 会包含它)。
    assistant_tokens = estimate_message(messages[2])
    assert measured.baseline == "provider_usage"
    assert measured.surface_delta_tokens == assistant_tokens
    assert measured.total_tokens == 110 + assistant_tokens
    assert measured.projected_tokens == 100 + assistant_tokens


def test_reasoning_output_is_not_double_counted() -> None:
    usage = ProviderUsage(
        input_tokens=100,
        output_tokens=20,
        cache_read_tokens=30,
        cache_write_tokens=5,
        reasoning_output_tokens=5,
    )
    assert usage.prompt_tokens == 135
    assert usage.total_tokens == 155
    assert usage.as_dict()["reasoningOutputTokens"] == 5


def test_prompt_completion_split_and_input_not_mutated() -> None:
    messages = [
        {"role": "system", "content": "s" * 8},
        {"role": "user", "content": "u" * 4},
        {"role": "tool", "content": "t" * 4},
        {"role": "assistant", "content": "a" * 4},
    ]
    before = json.dumps(messages, ensure_ascii=False, sort_keys=True)
    prompt, completion = prompt_completion_tokens(messages)
    assert prompt == estimate_message(messages[0]) + estimate_message(
        messages[1]
    ) + estimate_message(messages[2])
    assert completion == estimate_message(messages[3])
    assert estimate_messages(messages) == prompt + completion
    assert json.dumps(messages, ensure_ascii=False, sort_keys=True) == before


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
