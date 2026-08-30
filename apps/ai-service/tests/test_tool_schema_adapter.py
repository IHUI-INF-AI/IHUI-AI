"""tool_schema_adapter.py 单元测试(Anthropic 原生 tools 格式适配层)。

覆盖:
- openai_tools_to_anthropic:格式转换 / 嵌套 schema 递归保留 / 深拷贝不共享引用
- anthropic_response_to_openai:tool_use block → OpenAI tool_calls(三种输入形态)
- is_anthropic_model:claude 系列判定 / 非 claude 不受影响
- 集成:AnthropicProvider 请求侧用适配后的 tools、响应侧转回 OpenAI 形态、
  流式 tool_use 累积为 OpenAI 风格 tool_call 事件、provider 路由判定
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.providers import AnthropicProvider, OpenAIProvider, StepfunProvider, get_provider
from app.providers.anthropic_provider import AnthropicProvider as _AP
from app.services.tool_schema_adapter import (
    anthropic_response_to_openai,
    is_anthropic_model,
    openai_tools_to_anthropic,
)


# =============================================================================
# openai_tools_to_anthropic
# =============================================================================


def test_openai_tools_to_anthropic_basic_conversion():
    """基础转换:function.parameters → input_schema。"""
    tools = [{
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search the web",
            "parameters": {
                "type": "object",
                "properties": {"q": {"type": "string", "description": "query"}},
                "required": ["q"],
            },
        },
    }]
    result = openai_tools_to_anthropic(tools)
    assert result == [{
        "name": "search",
        "description": "Search the web",
        "input_schema": {
            "type": "object",
            "properties": {"q": {"type": "string", "description": "query"}},
            "required": ["q"],
        },
    }]


def test_openai_tools_to_anthropic_preserves_nested_schema():
    """嵌套 schema(items/anyOf/$defs/enum 等)递归保留全部字段。"""
    parameters = {
        "type": "object",
        "properties": {
            "filters": {
                "type": "object",
                "properties": {
                    "tags": {
                        "type": "array",
                        "items": {"type": "string", "enum": ["a", "b"]},
                    },
                },
                "required": ["tags"],
            },
            "mode": {
                "anyOf": [
                    {"type": "string", "enum": ["fast", "deep"]},
                    {"type": "null"},
                ],
            },
        },
        "required": ["filters"],
        "additionalProperties": False,
    }
    result = openai_tools_to_anthropic([{
        "type": "function",
        "function": {"name": "run", "description": "d", "parameters": parameters},
    }])
    assert result[0]["input_schema"] == parameters
    # 逐层抽查明深拷贝后字段完整
    schema = result[0]["input_schema"]
    assert schema["properties"]["filters"]["properties"]["tags"]["items"]["enum"] == ["a", "b"]
    assert schema["properties"]["mode"]["anyOf"][1]["type"] == "null"
    assert schema["additionalProperties"] is False


def test_openai_tools_to_anthropic_deep_copy_no_shared_refs():
    """深拷贝:修改入参与修改结果互不影响(双向验证)。"""
    tools = [{
        "type": "function",
        "function": {
            "name": "t",
            "parameters": {
                "type": "object",
                "properties": {"a": {"type": "object", "properties": {"b": {"type": "string"}}}},
            },
        },
    }]
    result = openai_tools_to_anthropic(tools)
    # 修改入参不影响结果
    tools[0]["function"]["parameters"]["properties"]["a"]["properties"]["b"]["type"] = "number"
    tools[0]["function"]["name"] = "mutated"
    assert result[0]["name"] == "t"
    assert result[0]["input_schema"]["properties"]["a"]["properties"]["b"]["type"] == "string"
    # 修改结果不影响入参
    result[0]["input_schema"]["properties"]["a"]["properties"]["b"]["type"] = "boolean"
    assert tools[0]["function"]["parameters"]["properties"]["a"]["properties"]["b"]["type"] == "number"


def test_openai_tools_to_anthropic_none_and_empty():
    """None / 空列表返回 None(无工具可传)。"""
    assert openai_tools_to_anthropic(None) is None
    assert openai_tools_to_anthropic([]) is None


def test_openai_tools_to_anthropic_missing_parameters_defaults():
    """function 缺 parameters 时默认空 object schema。"""
    result = openai_tools_to_anthropic([{"type": "function", "function": {"name": "x"}}])
    assert result[0]["input_schema"] == {"type": "object", "properties": {}}


def test_openai_tools_to_anthropic_non_function_passthrough_deep_copy():
    """非 function 类型(Anthropic 原生 block)深拷贝透传。"""
    tools = [{"type": "computer_20241022", "name": "computer", "config": {"nested": [1, 2]}}]
    result = openai_tools_to_anthropic(tools)
    assert result == tools
    result[0]["config"]["nested"].append(3)
    assert tools[0]["config"]["nested"] == [1, 2]


# =============================================================================
# anthropic_response_to_openai
# =============================================================================


def test_anthropic_response_to_openai_full_response_dict():
    """完整 Messages API 响应 dict:content 中的 tool_use 转为 OpenAI tool_calls。"""
    response = {
        "id": "msg_1",
        "model": "claude-3-5-sonnet",
        "content": [
            {"type": "text", "text": "Let me search."},
            {"type": "tool_use", "id": "toolu_1", "name": "search", "input": {"q": "x", "n": 3}},
        ],
        "usage": {"input_tokens": 1, "output_tokens": 2},
    }
    result = anthropic_response_to_openai(response)
    assert len(result) == 1
    assert result[0]["id"] == "toolu_1"
    assert result[0]["type"] == "function"
    assert result[0]["function"]["name"] == "search"
    assert json.loads(result[0]["function"]["arguments"]) == {"q": "x", "n": 3}


def test_anthropic_response_to_openai_content_block_list():
    """直接传 content blocks 列表。"""
    blocks = [{"type": "tool_use", "id": "t1", "name": "f", "input": {}}]
    result = anthropic_response_to_openai(blocks)
    assert len(result) == 1
    assert result[0]["function"]["arguments"] == "{}"


def test_anthropic_response_to_openai_single_tool_use_block():
    """直接传单个 tool_use block dict。"""
    block = {"type": "tool_use", "id": "t2", "name": "g", "input": {"a": [1, {"b": True}]}}
    result = anthropic_response_to_openai(block)
    assert len(result) == 1
    assert json.loads(result[0]["function"]["arguments"]) == {"a": [1, {"b": True}]}


def test_anthropic_response_to_openai_multiple_tool_use_blocks():
    """多个 tool_use block 全部转换(并行工具调用),顺序保留。"""
    blocks = [
        {"type": "tool_use", "id": "t1", "name": "f1", "input": {"x": 1}},
        {"type": "text", "text": "interleaved"},
        {"type": "tool_use", "id": "t2", "name": "f2", "input": {"y": 2}},
    ]
    result = anthropic_response_to_openai(blocks)
    assert [tc["id"] for tc in result] == ["t1", "t2"]
    assert [tc["function"]["name"] for tc in result] == ["f1", "f2"]


def test_anthropic_response_to_openai_no_tool_use():
    """无 tool_use(text only / 空响应 / None)返回空列表。"""
    assert anthropic_response_to_openai({"content": [{"type": "text", "text": "hi"}]}) == []
    assert anthropic_response_to_openai({"content": []}) == []
    assert anthropic_response_to_openai([]) == []
    assert anthropic_response_to_openai(None) == []


def test_anthropic_response_to_openai_unicode_not_escaped():
    """arguments JSON 序列化不转义非 ASCII(中文参数保留)。"""
    blocks = [{"type": "tool_use", "id": "t", "name": "f", "input": {"q": "中文查询"}}]
    result = anthropic_response_to_openai(blocks)
    assert result[0]["function"]["arguments"] == '{"q": "中文查询"}'


# =============================================================================
# is_anthropic_model
# =============================================================================


@pytest.mark.parametrize("model", [
    "claude-3-5-sonnet-20241022",
    "claude-sonnet-4-5",
    "claude-opus-4-1",
    "anthropic/claude-3-haiku",
    "Claude-3-5-Sonnet",  # 大小写不敏感
])
def test_is_anthropic_model_true(model):
    """claude 系列模型名判定为 Anthropic。"""
    assert is_anthropic_model(model) is True


@pytest.mark.parametrize("model", [
    "gpt-4o",
    "openai/gpt-4o",
    "stepfun/step-3.7-flash",
    "gemini/gemini-2.5-flash",
    "deepseek-chat",
    "glm-4-plus",
    "claudette-x",  # claude 前缀但非 claude 系(误匹配防御)
    "",
    None,
])
def test_is_anthropic_model_false(model):
    """非 claude 模型不走 Anthropic 适配路径。"""
    assert is_anthropic_model(model) is False


def test_is_anthropic_model_provider_code_override():
    """显式 provider_code=anthropic 时直接判定为 True。"""
    assert is_anthropic_model("custom-model", provider_code="anthropic") is True
    assert is_anthropic_model("custom-model", provider_code="openai") is False


# =============================================================================
# 集成:AnthropicProvider(请求侧 + 响应侧)
# =============================================================================


def test_provider_convert_tools_delegates_to_adapter():
    """请求侧:AnthropicProvider._convert_tools 走适配模块(深拷贝)。"""
    p = AnthropicProvider(api_key="k")
    tools = [{
        "type": "function",
        "function": {
            "name": "search",
            "description": "d",
            "parameters": {"type": "object", "properties": {"q": {"type": "string"}}},
        },
    }]
    result = p._convert_tools(tools)
    assert result[0]["name"] == "search"
    assert result[0]["input_schema"] == tools[0]["function"]["parameters"]
    # 深拷贝:结果与入参不共享引用
    result[0]["input_schema"]["properties"]["q"]["type"] = "number"
    assert tools[0]["function"]["parameters"]["properties"]["q"]["type"] == "string"
    assert p._convert_tools(None) is None


def test_provider_build_payload_uses_anthropic_tools_format():
    """请求组装点:_build_payload 的 tools 已是 Anthropic input_schema 格式。"""
    p = AnthropicProvider(api_key="k")
    tools = [{
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search",
            "parameters": {"type": "object", "properties": {"q": {"type": "string"}}},
        },
    }]
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}], "claude-3", tools=tools, stream=False,
    )
    assert payload["tools"] == [{
        "name": "search",
        "description": "Search",
        "input_schema": {"type": "object", "properties": {"q": {"type": "string"}}},
    }]
    # 原 OpenAI 格式 tools 不被修改
    assert tools[0]["function"]["parameters"]["type"] == "object"


def test_provider_parse_content_blocks_returns_openai_tool_calls():
    """响应侧:tool_use 块转回 OpenAI tool_calls 形态。"""
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


def test_get_provider_routes_claude_to_anthropic_adapter():
    """claude 模型走 Anthropic 适配路径(复用 is_anthropic_model 判定)。"""
    provider = get_provider("claude-3-5-sonnet", "sk-ant", None)
    assert isinstance(provider, _AP)
    provider = get_provider("anthropic/claude-sonnet-4", "sk-ant", None)
    assert isinstance(provider, _AP)


def test_get_provider_non_claude_unaffected():
    """非 claude 模型不受影响:gpt→OpenAIProvider,stepfun→StepfunProvider。"""
    assert isinstance(get_provider("gpt-4o", "k", None), OpenAIProvider)
    assert isinstance(get_provider("stepfun/step-3.7-flash", "k", None), StepfunProvider)
    assert isinstance(get_provider("deepseek-chat", "k", None), OpenAIProvider)


# =============================================================================
# 集成:astream 流式 tool_use → OpenAI 风格 tool_call 事件
# =============================================================================


class _FakeStreamCtx:
    def __init__(self, resp: MagicMock) -> None:
        self.resp = resp

    async def __aenter__(self) -> MagicMock:
        return self.resp

    async def __aexit__(self, *args: Any) -> None:
        return None


def _make_stream_resp(lines: list[str], status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code

    async def _aiter_lines():
        for line in lines:
            yield line

    resp.aiter_lines = _aiter_lines
    resp.aread = AsyncMock(return_value=b"err")
    return resp


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    with patch("app.providers.anthropic_provider.get_http_client", return_value=fake_client):
        yield


async def test_astream_accumulates_tool_use_to_openai_tool_call_event():
    """流式:content_block_start + input_json_delta 分片累积,content_block_stop
    时以 OpenAI tool_calls 形态产出 tool_call 事件(进入 gateway 累积/SSE 流)。"""
    p = AnthropicProvider(api_key="k")
    lines = [
        "data: " + json.dumps({"type": "content_block_start", "index": 1, "content_block": {"type": "tool_use", "id": "toolu_9", "name": "search"}}),
        "data: " + json.dumps({"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": '{"q":'}}),
        "data: " + json.dumps({"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": ' "hi"}'}}),
        "data: " + json.dumps({"type": "content_block_stop", "index": 1}),
        "data: " + json.dumps({"type": "message_stop"}),
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    tool_call_events = [e for e in events if e["type"] == "tool_call"]
    assert len(tool_call_events) == 1
    tc = tool_call_events[0]["tool_calls"][0]
    assert tc["id"] == "toolu_9"
    assert tc["type"] == "function"
    assert tc["function"]["name"] == "search"
    assert json.loads(tc["function"]["arguments"]) == {"q": "hi"}
    assert any(e["type"] == "done" for e in events)


async def test_astream_tool_use_empty_input_defaults_empty_object():
    """流式 tool_use 无 input_json_delta(空入参)时 arguments 兜底 "{}"。"""
    p = AnthropicProvider(api_key="k")
    lines = [
        f'data: {json.dumps({"type": "content_block_start", "index": 0, "content_block": {"type": "tool_use", "id": "t1", "name": "noop"}})}',
        f'data: {json.dumps({"type": "content_block_stop", "index": 0})}',
        f'data: {json.dumps({"type": "message_stop"})}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    tool_call_events = [e for e in events if e["type"] == "tool_call"]
    assert len(tool_call_events) == 1
    assert tool_call_events[0]["tool_calls"][0]["function"]["arguments"] == "{}"


async def test_astream_multiple_tool_use_blocks():
    """流式多个 tool_use 块(并行工具调用)各自累积、互不串扰。"""
    p = AnthropicProvider(api_key="k")
    lines = [
        "data: " + json.dumps({"type": "content_block_start", "index": 0, "content_block": {"type": "tool_use", "id": "t1", "name": "f1"}}),
        "data: " + json.dumps({"type": "content_block_delta", "index": 0, "delta": {"type": "input_json_delta", "partial_json": '{"a":1}'}}),
        "data: " + json.dumps({"type": "content_block_stop", "index": 0}),
        "data: " + json.dumps({"type": "content_block_start", "index": 1, "content_block": {"type": "tool_use", "id": "t2", "name": "f2"}}),
        "data: " + json.dumps({"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": '{"b":2}'}}),
        "data: " + json.dumps({"type": "content_block_stop", "index": 1}),
        f'data: {json.dumps({"type": "message_stop"})}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    tool_call_events = [e for e in events if e["type"] == "tool_call"]
    assert len(tool_call_events) == 2
    first, second = tool_call_events
    assert first["tool_calls"][0]["id"] == "t1"
    assert json.loads(first["tool_calls"][0]["function"]["arguments"]) == {"a": 1}
    assert second["tool_calls"][0]["id"] == "t2"
    assert json.loads(second["tool_calls"][0]["function"]["arguments"]) == {"b": 2}


async def test_astream_text_only_no_tool_call_events():
    """纯文本流不产出 tool_call 事件(非工具调用不受影响)。"""
    p = AnthropicProvider(api_key="k")
    lines = [
        f'data: {json.dumps({"type": "content_block_start", "index": 0, "content_block": {"type": "text"}})}',
        f'data: {json.dumps({"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "hello"}})}',
        f'data: {json.dumps({"type": "content_block_stop", "index": 0})}',
        f'data: {json.dumps({"type": "message_stop"})}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "claude-3")]

    assert [e for e in events if e["type"] == "tool_call"] == []
    chunks = [e for e in events if e["type"] == "chunk"]
    assert "".join(c["content"] for c in chunks) == "hello"
