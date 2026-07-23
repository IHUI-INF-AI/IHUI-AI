"""anthropic_provider.py 单元测试。

Anthropic Messages API 原生适配器。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / timeout
- _headers:含 x-api-key + anthropic-version
- _split_system:分离 system prompt / 多 system 合并 / 非 system 保留
- _convert_tools:function → input_schema / 空 tools / 非 function 透传
- _build_payload:max_tokens 必填 / system 独立参数 / tool_choice 透传
- _parse_content_blocks:text + tool_use 解析
- complete:成功路径 / 4xx ProviderError
- astream:text_delta / input_json_delta / message_stop / 4xx → error / 网络异常
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.anthropic_provider import AnthropicProvider, _ANTHROPIC_VERSION
from app.providers.base_provider import ProviderError


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    """Patch get_http_client in both base_provider(_request 用)和 anthropic_provider(astream 用)。"""
    with patch("app.providers.base_provider.get_http_client", return_value=fake_client), \
         patch("app.providers.anthropic_provider.get_http_client", return_value=fake_client):
        yield


# =============================================================================
# __init__ & _headers
# =============================================================================


def test_init_default_base_url():
    """默认 base_url 指向 Anthropic 官方 API。"""
    p = AnthropicProvider(api_key="sk-ant")
    assert p.base_url == "https://api.anthropic.com"
    assert p.api_key == "sk-ant"


def test_init_custom_api_base():
    """自定义 api_base 会覆盖默认值(末尾 / 被剥离)。"""
    p = AnthropicProvider(api_key="k", api_base="https://gateway.example.com/")
    assert p.base_url == "https://gateway.example.com"


def test_init_timeout_default_60():
    """timeout 默认 60.0。"""
    p = AnthropicProvider(api_key="k")
    assert p.timeout == 60.0


def test_init_custom_timeout():
    """可自定义 timeout。"""
    p = AnthropicProvider(api_key="k", timeout=42.0)
    assert p.timeout == 42.0


def test_headers_contain_api_key_and_version():
    """_headers 含 x-api-key + anthropic-version + Content-Type。"""
    p = AnthropicProvider(api_key="sk-ant-x")
    headers = p._headers()
    assert headers["x-api-key"] == "sk-ant-x"
    assert headers["anthropic-version"] == _ANTHROPIC_VERSION
    assert headers["Content-Type"] == "application/json"


# =============================================================================
# _split_system
# =============================================================================


def test_split_system_separates_system_messages():
    """system 消息被抽出,非 system 消息保留。"""
    p = AnthropicProvider(api_key="k")
    messages = [
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "hi"},
    ]
    system, rest = p._split_system(messages)
    assert system == "You are helpful."
    assert len(rest) == 1
    assert rest[0]["role"] == "user"


def test_split_system_multiple_messages_joined():
    """多个 system 消息用 \\n\\n 连接。"""
    p = AnthropicProvider(api_key="k")
    messages = [
        {"role": "system", "content": "rule 1"},
        {"role": "system", "content": "rule 2"},
        {"role": "user", "content": "hi"},
    ]
    system, rest = p._split_system(messages)
    assert system == "rule 1\n\nrule 2"
    assert len(rest) == 1


def test_split_system_returns_none_when_no_system():
    """无 system 消息时返回 (None, all_messages)。"""
    p = AnthropicProvider(api_key="k")
    messages = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    system, rest = p._split_system(messages)
    assert system is None
    assert len(rest) == 2


def test_split_system_handles_non_string_content():
    """system content 非 str 时 JSON 序列化。"""
    p = AnthropicProvider(api_key="k")
    messages = [
        {"role": "system", "content": [{"type": "text", "text": "x"}]},
        {"role": "user", "content": "hi"},
    ]
    system, rest = p._split_system(messages)
    assert system is not None
    assert "text" in system
    assert len(rest) == 1


# =============================================================================
# _convert_tools
# =============================================================================


def test_convert_tools_none_returns_none():
    """tools=None 返回 None。"""
    p = AnthropicProvider(api_key="k")
    assert p._convert_tools(None) is None


def test_convert_tools_empty_list_returns_none():
    """tools=[] 返回 None。"""
    p = AnthropicProvider(api_key="k")
    assert p._convert_tools([]) is None


def test_convert_tools_function_to_input_schema():
    """function 类型 tools 转为 Anthropic input_schema 格式。"""
    p = AnthropicProvider(api_key="k")
    tools = [{
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search web",
            "parameters": {"type": "object", "properties": {"q": {"type": "string"}}},
        },
    }]
    result = p._convert_tools(tools)
    assert len(result) == 1
    assert result[0]["name"] == "search"
    assert result[0]["description"] == "Search web"
    assert result[0]["input_schema"] == tools[0]["function"]["parameters"]


def test_convert_tools_function_default_parameters_when_missing():
    """function 缺 parameters 时默认空 object schema。"""
    p = AnthropicProvider(api_key="k")
    tools = [{"type": "function", "function": {"name": "x"}}]
    result = p._convert_tools(tools)
    assert result[0]["input_schema"] == {"type": "object", "properties": {}}


def test_convert_tools_non_function_passed_through():
    """非 function 类型 tools 原样透传。"""
    p = AnthropicProvider(api_key="k")
    tools = [{"type": "computer_20241022", "name": "computer"}]
    result = p._convert_tools(tools)
    assert result == tools


# =============================================================================
# _build_payload
# =============================================================================


def test_build_payload_max_tokens_required():
    """max_tokens 必填字段(默认 4096)。"""
    p = AnthropicProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "claude-3",
        tools=None,
        stream=False,
    )
    assert payload["max_tokens"] == 4096
    assert payload["model"] == "claude-3"


def test_build_payload_custom_max_tokens_via_kwargs():
    """max_tokens 可通过 kwargs 覆盖。"""
    p = AnthropicProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "claude-3",
        tools=None,
        stream=False,
        max_tokens=100,
    )
    assert payload["max_tokens"] == 100


def test_build_payload_includes_system_when_present():
    """有 system 时 payload['system'] 被设置。"""
    p = AnthropicProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "system", "content": "rule"}, {"role": "user", "content": "hi"}],
        "claude-3",
        tools=None,
        stream=False,
    )
    assert payload["system"] == "rule"
    assert len(payload["messages"]) == 1


def test_build_payload_no_system_key_when_absent():
    """无 system 时 payload 不含 'system' 键。"""
    p = AnthropicProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "claude-3",
        tools=None,
        stream=False,
    )
    assert "system" not in payload


def test_build_payload_stream_flag():
    """stream=True 时 payload['stream']=True。"""
    p = AnthropicProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "claude-3",
        tools=None,
        stream=True,
    )
    assert payload["stream"] is True


def test_build_payload_tools_included_when_present():
    """有 tools 时 payload['tools'] 被设置(转为 input_schema)。"""
    p = AnthropicProvider(api_key="k")
    tools = [{"type": "function", "function": {"name": "x", "description": "d", "parameters": {}}}]
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "claude-3",
        tools=tools,
        stream=False,
        tool_choice="auto",
    )
    assert "tools" in payload
    assert payload["tool_choice"] == "auto"


def test_build_payload_strips_vendor_prefix():
    """model 含 'anthropic/' 前缀时被剥离。"""
    p = AnthropicProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "anthropic/claude-3",
        tools=None,
        stream=False,
    )
    assert payload["model"] == "claude-3"


# =============================================================================
# _parse_content_blocks
# =============================================================================


def test_parse_content_blocks_text_only():
    """纯 text block 返回 (text, [])。"""
    p = AnthropicProvider(api_key="k")
    text, tool_calls = p._parse_content_blocks([
        {"type": "text", "text": "hello "},
        {"type": "text", "text": "world"},
    ])
    assert text == "hello world"
    assert tool_calls == []


def test_parse_content_blocks_tool_use():
    """tool_use block 解析为 OpenAI 风格 tool_calls。"""
    p = AnthropicProvider(api_key="k")
    text, tool_calls = p._parse_content_blocks([
        {"type": "text", "text": "Calling tool"},
        {"type": "tool_use", "id": "tool_1", "name": "search", "input": {"q": "x"}},
    ])
    assert text == "Calling tool"
    assert len(tool_calls) == 1
    assert tool_calls[0]["id"] == "tool_1"
    assert tool_calls[0]["type"] == "function"
    assert tool_calls[0]["function"]["name"] == "search"
    assert json.loads(tool_calls[0]["function"]["arguments"]) == {"q": "x"}


def test_parse_content_blocks_empty():
    """空 content 返回 ('', [])。"""
    p = AnthropicProvider(api_key="k")
    text, tool_calls = p._parse_content_blocks([])
    assert text == ""
    assert tool_calls == []


# =============================================================================
# complete
# =============================================================================


async def test_complete_success_returns_text_and_tool_calls():
    """complete 成功返回 text + tool_calls。"""
    p = AnthropicProvider(api_key="k")

    fake_data = {
        "model": "claude-3",
        "content": [
            {"type": "text", "text": "hi"},
            {"type": "tool_use", "id": "t1", "name": "search", "input": {"q": "x"}},
        ],
        "usage": {"input_tokens": 5, "output_tokens": 10},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "x"}], "claude-3")

    assert result["content"] == "hi"
    assert result["model"] == "claude-3"
    assert result["usage"] == {"input_tokens": 5, "output_tokens": 10}
    assert result["stub"] is False
    assert len(result["tool_calls"]) == 1


async def test_complete_uses_v1_messages_endpoint():
    """complete 调用 /v1/messages endpoint。"""
    p = AnthropicProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"content": []}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        await p.complete([{"role": "user", "content": "x"}], "claude-3")

    args, _ = fake_client.request.call_args
    assert args[1] == "https://api.anthropic.com/v1/messages"


async def test_complete_4xx_raises_provider_error():
    """complete 4xx 抛 ProviderError。"""
    p = AnthropicProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 429
    fake_resp.json.return_value = {"error": "rate limit"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p.complete([{"role": "user", "content": "x"}], "claude-3")

    assert exc_info.value.status_code == 429


# =============================================================================
# astream
# =============================================================================


def _make_stream_resp(lines: list[str], status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code

    async def _aiter_lines():
        for line in lines:
            yield line

    resp.aiter_lines = _aiter_lines
    resp.aread = AsyncMock(return_value=b"err")
    return resp


class _FakeStreamCtx:
    def __init__(self, resp: MagicMock) -> None:
        self.resp = resp

    async def __aenter__(self) -> MagicMock:
        return self.resp

    async def __aexit__(self, *args: Any) -> None:
        return None


async def test_astream_text_delta_yields_chunks():
    """text_delta 事件 yield chunk。"""
    p = AnthropicProvider(api_key="k")

    lines = [
        f'data: {json.dumps({"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}})}',
        f'data: {json.dumps({"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}})}',
        f'data: {json.dumps({"type":"message_stop"})}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    chunks = [e for e in events if e["type"] == "chunk"]
    assert "".join(c["content"] for c in chunks) == "hello world"
    assert any(e["type"] == "done" for e in events)


async def test_astream_input_json_delta_yields_tool_call_delta():
    """input_json_delta 事件 yield tool_call_delta。"""
    p = AnthropicProvider(api_key="k")

    evt1 = {"type": "content_block_delta", "delta": {"type": "input_json_delta", "partial_json": '{"q":'}}
    evt2 = {"type": "content_block_delta", "delta": {"type": "input_json_delta", "partial_json": '"x"}'}}
    evt3 = {"type": "message_stop"}
    lines = [
        f"data: {json.dumps(evt1)}",
        f"data: {json.dumps(evt2)}",
        f"data: {json.dumps(evt3)}",
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    deltas = [e for e in events if e["type"] == "tool_call_delta"]
    assert len(deltas) == 2
    assert deltas[0]["partial_json"] == '{"q":'


async def test_astream_4xx_yields_error_event():
    """4xx 响应 yield error 事件。"""
    p = AnthropicProvider(api_key="k")

    resp = _make_stream_resp([], status_code=500)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "500" in events[0]["message"]


async def test_astream_httpx_error_yields_error_event():
    """httpx.HTTPError yield error 事件(含 '网络异常')。"""
    p = AnthropicProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.stream = MagicMock(side_effect=httpx.ReadTimeout("slow"))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "网络异常" in events[0]["message"]


async def test_astream_skips_non_data_lines():
    """非 'data: ' 前缀行(如 event: 行)应被跳过。"""
    p = AnthropicProvider(api_key="k")

    lines = [
        "event: content_block_delta",
        f'data: {json.dumps({"type":"content_block_delta","delta":{"type":"text_delta","text":"x"}})}',
        f'data: {json.dumps({"type":"message_stop"})}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    assert len(events) == 2  # 一个 chunk + 一个 done
    assert events[0]["type"] == "chunk"


async def test_astream_skips_invalid_json_lines():
    """坏 JSON 行应被跳过。"""
    p = AnthropicProvider(api_key="k")

    lines = [
        "data: {broken",
        f'data: {json.dumps({"type":"message_stop"})}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    assert len(events) == 1
    assert events[0]["type"] == "done"
