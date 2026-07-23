"""alibaba_dashscope_provider.py 单元测试。

阿里云通义千问适配器:OpenAI 兼容协议,仅覆写 base_url 与 URL 构造。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / timeout
- complete:成功路径(content/tool_calls/usage)/ 4xx 抛 ProviderError
- astream:正常 chunk 流 / [DONE] 终止 / tool_call 帧 / usage done 帧
- astream:4xx → error 帧 / httpx 网络异常 → error 帧
- 继承 OpenAIProvider:_headers / _build_payload 透传
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.alibaba_dashscope_provider import AlibabaDashscopeProvider
from app.providers.base_provider import ProviderError
from app.providers.openai_provider import OpenAIProvider


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    """Patch get_http_client in both base_provider(_request 用)和 alibaba_dashscope_provider(astream 用)。"""
    with patch("app.providers.base_provider.get_http_client", return_value=fake_client), \
         patch("app.providers.alibaba_dashscope_provider.get_http_client", return_value=fake_client):
        yield


# =============================================================================
# __init__
# =============================================================================


def test_init_default_base_url():
    """默认 base_url 指向 DashScope 兼容 endpoint。"""
    p = AlibabaDashscopeProvider(api_key="sk-dash")
    assert p.base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert p.api_key == "sk-dash"


def test_init_custom_api_base():
    """自定义 api_base 会覆盖默认值。"""
    p = AlibabaDashscopeProvider(api_key="k", api_base="https://custom.example.com/v1")
    assert p.base_url == "https://custom.example.com/v1"


def test_init_timeout_default_60():
    """timeout 默认 60.0。"""
    p = AlibabaDashscopeProvider(api_key="k")
    assert p.timeout == 60.0


def test_init_custom_timeout():
    """可自定义 timeout。"""
    p = AlibabaDashscopeProvider(api_key="k", timeout=30.0)
    assert p.timeout == 30.0


def test_inherits_openai_provider():
    """AlibabaDashscopeProvider 继承 OpenAIProvider。"""
    p = AlibabaDashscopeProvider(api_key="k")
    assert isinstance(p, OpenAIProvider)


def test_headers_contain_bearer_token():
    """_headers 含 Bearer 鉴权(继承自 OpenAIProvider)。"""
    p = AlibabaDashscopeProvider(api_key="sk-secret")
    headers = p._headers()
    assert headers["Authorization"] == "Bearer sk-secret"
    assert headers["Content-Type"] == "application/json"


# =============================================================================
# complete 成功路径
# =============================================================================


async def test_complete_returns_content_and_usage():
    """complete 成功返回 content/model/usage。"""
    p = AlibabaDashscopeProvider(api_key="k")

    fake_data = {
        "model": "qwen-plus",
        "choices": [{"message": {"content": "hello"}}],
        "usage": {"total_tokens": 10},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "hi"}], "qwen-plus")

    assert result["content"] == "hello"
    assert result["model"] == "qwen-plus"
    assert result["usage"] == {"total_tokens": 10}
    assert result["stub"] is False
    assert "tool_calls" not in result

    args, _ = fake_client.request.call_args
    assert args[0] == "POST"
    assert args[1].endswith("/chat/completions")


async def test_complete_with_tool_calls():
    """complete 含 tool_calls 时透传到结果。"""
    p = AlibabaDashscopeProvider(api_key="k")

    fake_data = {
        "model": "qwen-max",
        "choices": [{"message": {
            "content": "",
            "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "search", "arguments": "{}"}}],
        }}],
        "usage": {"total_tokens": 5},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "x"}], "qwen-max", tools=[{"type": "function"}])

    assert result["tool_calls"] == fake_data["choices"][0]["message"]["tool_calls"]


async def test_complete_4xx_raises_provider_error():
    """complete 4xx 响应抛 ProviderError。"""
    p = AlibabaDashscopeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 401
    fake_resp.json.return_value = {"error": "unauthorized"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p.complete([{"role": "user", "content": "x"}], "qwen-plus")

    assert exc_info.value.status_code == 401


async def test_complete_url_uses_base_url():
    """complete URL 用 self.base_url(不含 /v1 前缀,因 base 已含 compatible-mode/v1)。"""
    p = AlibabaDashscopeProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"choices": [{}]}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        await p.complete([{"role": "user", "content": "x"}], "qwen-plus")

    args, _ = fake_client.request.call_args
    assert args[1] == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"


# =============================================================================
# astream 流式
# =============================================================================


def _make_stream_resp(lines: list[str], status_code: int = 200) -> MagicMock:
    """构造模拟的 httpx 流式响应。"""
    resp = MagicMock()
    resp.status_code = status_code

    async def _aiter_lines():
        for line in lines:
            yield line

    resp.aiter_lines = _aiter_lines
    resp.aread = AsyncMock(return_value=b"error body")
    return resp


class _FakeStreamCtx:
    """模拟 client.stream(...) async context manager。"""

    def __init__(self, resp: MagicMock) -> None:
        self.resp = resp

    async def __aenter__(self) -> MagicMock:
        return self.resp

    async def __aexit__(self, *args: Any) -> None:
        return None


async def test_astream_yields_chunks_and_done():
    """astream 正常流:chunk 帧 + usage done 帧。"""
    p = AlibabaDashscopeProvider(api_key="k")

    lines = [
        'data: {"choices":[{"delta":{"content":"hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}],"model":"qwen-plus"}',
        'data: {"model":"qwen-plus","usage":{"total_tokens":10}}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)

    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "hi"}], "qwen-plus")]

    types = [e["type"] for e in events]
    assert "chunk" in types
    assert "done" in types
    chunks = [e for e in events if e["type"] == "chunk"]
    assert "".join(c["content"] for c in chunks) == "hello world"
    done = next(e for e in events if e["type"] == "done")
    assert done["usage"] == {"total_tokens": 10}
    assert done["model"] == "qwen-plus"


async def test_astream_handles_done_sentinel():
    """[DONE] 哨兵行应终止流(不再 yield)。"""
    p = AlibabaDashscopeProvider(api_key="k")

    lines = [
        'data: {"choices":[{"delta":{"content":"a"}}]}',
        "data: [DONE]",
        'data: {"choices":[{"delta":{"content":"should-not-yield"}}]}',
    ]
    resp = _make_stream_resp(lines)

    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "qwen-plus")]

    chunks = [e for e in events if e["type"] == "chunk"]
    assert len(chunks) == 1
    assert chunks[0]["content"] == "a"


async def test_astream_tool_call_frame():
    """astream 透传 tool_calls 帧。"""
    p = AlibabaDashscopeProvider(api_key="k")

    tc = [{"id": "call_1", "type": "function", "function": {"name": "search", "arguments": "{}"}}]
    lines = [
        f'data: {json.dumps({"choices":[{"delta":{"tool_calls":tc}}]})}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)

    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "qwen-plus", tools=[{"type": "function"}])]

    tool_events = [e for e in events if e["type"] == "tool_call"]
    assert len(tool_events) == 1
    assert tool_events[0]["tool_calls"] == tc


async def test_astream_skips_non_data_lines():
    """非 'data: ' 前缀的行(如注释/event 行)应被跳过。"""
    p = AlibabaDashscopeProvider(api_key="k")

    lines = [
        ": comment line",
        "event: ping",
        'data: {"choices":[{"delta":{"content":"x"}}]}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)

    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "qwen-plus")]

    assert len(events) == 1
    assert events[0]["content"] == "x"


async def test_astream_skips_invalid_json_chunk():
    """坏 JSON 行应被跳过(不抛错)。"""
    p = AlibabaDashscopeProvider(api_key="k")

    lines = [
        "data: {invalid json}",
        'data: {"choices":[{"delta":{"content":"ok"}}]}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)

    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "qwen-plus")]

    assert len(events) == 1
    assert events[0]["content"] == "ok"


async def test_astream_4xx_yields_error_event():
    """4xx 响应应 yield error 事件(不抛异常)。"""
    p = AlibabaDashscopeProvider(api_key="k")

    resp = _make_stream_resp([], status_code=401)

    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "qwen-plus")]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "401" in events[0]["message"]


async def test_astream_httpx_error_yields_error_event():
    """httpx.HTTPError 应 yield error 事件(含 '网络异常')。"""
    p = AlibabaDashscopeProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.stream = MagicMock(side_effect=httpx.ConnectError("conn refused"))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "qwen-plus")]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "网络异常" in events[0]["message"]
