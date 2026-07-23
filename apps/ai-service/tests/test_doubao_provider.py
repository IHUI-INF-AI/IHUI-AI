"""doubao_provider.py 单元测试。

字节豆包适配器:OpenAI 兼容协议(Ark api_base),仅覆写 base_url 与 URL 构造。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / timeout
- 继承 OpenAIProvider / _headers 含 Bearer
- complete:成功路径(content/tool_calls/usage)/ 4xx ProviderError / URL 正确
- astream:正常 chunk 流 / [DONE] 终止 / tool_call / usage done / 4xx error / 网络异常
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.base_provider import ProviderError
from app.providers.doubao_provider import DoubaoProvider
from app.providers.openai_provider import OpenAIProvider


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    """Patch get_http_client in both base_provider(_request 用)和 doubao_provider(astream 用)。"""
    with patch("app.providers.base_provider.get_http_client", return_value=fake_client), \
         patch("app.providers.doubao_provider.get_http_client", return_value=fake_client):
        yield


# =============================================================================
# __init__
# =============================================================================


def test_init_default_base_url():
    """默认 base_url 指向火山引擎方舟 Ark api_base。"""
    p = DoubaoProvider(api_key="ark-key")
    assert p.base_url == "https://ark.cn-beijing.volces.com/api/v3"
    assert p.api_key == "ark-key"


def test_init_custom_api_base():
    """自定义 api_base 会覆盖默认值。"""
    p = DoubaoProvider(api_key="k", api_base="https://ark.example.com/api/v3")
    assert p.base_url == "https://ark.example.com/api/v3"


def test_init_timeout_default_60():
    """timeout 默认 60.0。"""
    p = DoubaoProvider(api_key="k")
    assert p.timeout == 60.0


def test_init_custom_timeout():
    """可自定义 timeout。"""
    p = DoubaoProvider(api_key="k", timeout=120.0)
    assert p.timeout == 120.0


def test_inherits_openai_provider():
    """DoubaoProvider 继承 OpenAIProvider。"""
    p = DoubaoProvider(api_key="k")
    assert isinstance(p, OpenAIProvider)


def test_headers_contain_bearer_token():
    """_headers 含 Bearer 鉴权(继承自 OpenAIProvider)。"""
    p = DoubaoProvider(api_key="ark-secret")
    headers = p._headers()
    assert headers["Authorization"] == "Bearer ark-secret"
    assert headers["Content-Type"] == "application/json"


# =============================================================================
# complete 成功路径
# =============================================================================


async def test_complete_returns_content_and_usage():
    """complete 成功返回 content/model/usage。"""
    p = DoubaoProvider(api_key="k")

    fake_data = {
        "model": "doubao-pro",
        "choices": [{"message": {"content": "hello"}}],
        "usage": {"total_tokens": 12},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "hi"}], "doubao-pro")

    assert result["content"] == "hello"
    assert result["model"] == "doubao-pro"
    assert result["usage"] == {"total_tokens": 12}
    assert result["stub"] is False


async def test_complete_with_tool_calls():
    """complete 含 tool_calls 时透传到结果。"""
    p = DoubaoProvider(api_key="k")

    tc = [{"id": "c1", "type": "function", "function": {"name": "search", "arguments": "{}"}}]
    fake_data = {
        "model": "doubao-pro",
        "choices": [{"message": {"content": "", "tool_calls": tc}}],
        "usage": {},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "x"}], "doubao-pro", tools=[{"type": "function"}])

    assert result["tool_calls"] == tc


async def test_complete_url_uses_base_url():
    """complete URL 用 self.base_url(已含 /api/v3)。"""
    p = DoubaoProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"choices": [{}]}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        await p.complete([{"role": "user", "content": "x"}], "doubao-pro")

    args, _ = fake_client.request.call_args
    assert args[1] == "https://ark.cn-beijing.volces.com/api/v3/chat/completions"


async def test_complete_4xx_raises_provider_error():
    """complete 4xx 响应抛 ProviderError。"""
    p = DoubaoProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 401
    fake_resp.json.return_value = {"error": "unauthorized"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p.complete([{"role": "user", "content": "x"}], "doubao-pro")

    assert exc_info.value.status_code == 401


async def test_complete_httpx_error_raises_provider_error():
    """complete 网络异常抛 ProviderError。"""
    p = DoubaoProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.request = AsyncMock(side_effect=httpx.ConnectError("conn refused"))

    with _patch_http_client(fake_client):
        with pytest.raises(ProviderError, match="网络异常"):
            await p.complete([{"role": "user", "content": "x"}], "doubao-pro")


# =============================================================================
# astream 流式
# =============================================================================


def _make_stream_resp(lines: list[str], status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code

    async def _aiter_lines():
        for line in lines:
            yield line

    resp.aiter_lines = _aiter_lines
    resp.aread = AsyncMock(return_value=b"err body")
    return resp


class _FakeStreamCtx:
    def __init__(self, resp: MagicMock) -> None:
        self.resp = resp

    async def __aenter__(self) -> MagicMock:
        return self.resp

    async def __aexit__(self, *args: Any) -> None:
        return None


async def test_astream_yields_chunks_and_done():
    """astream 正常流:chunk + done。"""
    p = DoubaoProvider(api_key="k")

    lines = [
        'data: {"choices":[{"delta":{"content":"hello"}}]}',
        'data: {"model":"doubao-pro","usage":{"total_tokens":5}}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "doubao-pro")]

    chunks = [e for e in events if e["type"] == "chunk"]
    assert chunks[0]["content"] == "hello"
    done = next(e for e in events if e["type"] == "done")
    assert done["usage"] == {"total_tokens": 5}


async def test_astream_done_sentinel_terminates():
    """[DONE] 行终止流。"""
    p = DoubaoProvider(api_key="k")

    lines = [
        'data: {"choices":[{"delta":{"content":"a"}}]}',
        "data: [DONE]",
        'data: {"choices":[{"delta":{"content":"should-not-yield"}}]}',
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "doubao-pro")]

    chunks = [e for e in events if e["type"] == "chunk"]
    assert len(chunks) == 1


async def test_astream_tool_call_frame():
    """astream 透传 tool_calls 帧。"""
    p = DoubaoProvider(api_key="k")

    tc = [{"id": "c1", "type": "function", "function": {"name": "x", "arguments": "{}"}}]
    lines = [
        f'data: {json.dumps({"choices":[{"delta":{"tool_calls":tc}}]})}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "doubao-pro")]

    assert any(e["type"] == "tool_call" for e in events)


async def test_astream_skips_invalid_json():
    """坏 JSON 行跳过。"""
    p = DoubaoProvider(api_key="k")

    lines = [
        "data: {broken",
        'data: {"choices":[{"delta":{"content":"ok"}}]}',
        "data: [DONE]",
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "doubao-pro")]

    chunks = [e for e in events if e["type"] == "chunk"]
    assert len(chunks) == 1
    assert chunks[0]["content"] == "ok"


async def test_astream_4xx_yields_error_event():
    """4xx yield error 事件。"""
    p = DoubaoProvider(api_key="k")

    resp = _make_stream_resp([], status_code=429)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "doubao-pro")]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "429" in events[0]["message"]


async def test_astream_httpx_error_yields_error_event():
    """httpx 异常 yield error 事件(含 '网络异常')。"""
    p = DoubaoProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.stream = MagicMock(side_effect=httpx.ConnectError("refused"))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "doubao-pro")]

    assert len(events) == 1
    assert events[0]["type"] == "error"
    assert "网络异常" in events[0]["message"]
