"""Ollama / LM Studio / llama.cpp 三个本地 LLM provider 的单元测试。

测试覆盖(15 个用例):
- OllamaProvider: complete(原生 /api/chat + usage 转换)/ astream(NDJSON 流式)/ list_models / 错误处理
- LMStudioProvider: complete(OpenAI 兼容)/ astream(SSE 流式)/ list_models / 错误处理
- LlamaCppProvider: complete / list_models(硬编码)/ 默认 base_url / get_provider 路由
- get_provider 路由:ollama/ / lmstudio/ / llamacpp/ 前缀正确匹配

所有 HTTP 请求通过 mock httpx.AsyncClient 模拟,不依赖真实本地 LLM 服务。
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.providers import (
    BaseProvider,
    LlamaCppProvider,
    LMStudioProvider,
    OllamaProvider,
    OpenAIProvider,
    get_provider,
)
from app.providers.base_provider import ProviderError


# =============================================================================
# Mock 辅助类 — 模拟 httpx.AsyncClient 的 request / stream 方法
# =============================================================================


class MockResponse:
    """模拟 httpx.Response(非流式)。"""

    def __init__(self, json_data: Any, status_code: int = 200):
        self._json = json_data
        self.status_code = status_code

    def json(self) -> Any:
        return self._json


class MockStreamResponse:
    """模拟 httpx.Response(流式,支持 aiter_lines / aread)。"""

    def __init__(self, lines: list[str], status_code: int = 200, error_body: bytes = b"error"):
        self._lines = lines
        self.status_code = status_code
        self._error_body = error_body

    async def aread(self) -> bytes:
        return self._error_body

    async def aiter_lines(self):
        for line in self._lines:
            yield line


class MockStreamContextManager:
    """模拟 async with client.stream(...) 的异步上下文管理器。"""

    def __init__(self, response: MockStreamResponse):
        self._response = response

    async def __aenter__(self) -> MockStreamResponse:
        return self._response

    async def __aexit__(self, *args: Any) -> None:
        pass


class MockHttpClient:
    """模拟 httpx.AsyncClient,支持 request(非流式)和 stream(流式)。"""

    def __init__(
        self,
        response_data: Any = None,
        status_code: int = 200,
        stream_lines: list[str] | None = None,
        stream_status_code: int = 200,
        raise_http_error: bool = False,
    ):
        self._response_data = response_data
        self._status_code = status_code
        self._stream_lines = stream_lines
        self._stream_status_code = stream_status_code
        self._raise_http_error = raise_http_error

    async def request(self, method: str, url: str, **kwargs: Any) -> MockResponse:
        if self._raise_http_error:
            raise httpx.ConnectError("mock connection refused")
        return MockResponse(self._response_data, self._status_code)

    def stream(self, method: str, url: str, **kwargs: Any) -> MockStreamContextManager:
        if self._raise_http_error:
            # stream() 本身不抛错,在 __aenter__ 或迭代时抛;这里模拟连接失败
            raise httpx.ConnectError("mock stream connection refused")
        resp = MockStreamResponse(
            self._stream_lines or [],
            status_code=self._stream_status_code,
        )
        return MockStreamContextManager(resp)


def _make_ollama_complete_response() -> dict[str, Any]:
    """Ollama /api/chat 非流式响应(原生格式)。"""
    return {
        "model": "llama3.2",
        "message": {"content": "Hello from Ollama!", "role": "assistant"},
        "done": True,
        "eval_count": 15,
        "prompt_eval_count": 10,
    }


def _make_ollama_stream_lines() -> list[str]:
    """Ollama /api/chat 流式 NDJSON(每行一个 JSON 对象)。"""
    return [
        json.dumps({"message": {"content": "Hello"}, "done": False}),
        json.dumps({"message": {"content": " world"}, "done": False}),
        json.dumps({
            "message": {},
            "done": True,
            "eval_count": 15,
            "prompt_eval_count": 10,
            "model": "llama3.2",
        }),
    ]


def _make_openai_complete_response() -> dict[str, Any]:
    """OpenAI 兼容 /v1/chat/completions 非流式响应。"""
    return {
        "model": "local-model",
        "choices": [
            {"message": {"content": "Hello from local!", "role": "assistant"}, "index": 0}
        ],
        "usage": {"prompt_tokens": 8, "completion_tokens": 12, "total_tokens": 20},
    }


def _make_openai_stream_lines() -> list[str]:
    """OpenAI 兼容 SSE 流式行(含 data: 前缀)。"""
    return [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}',
        'data: {"choices":[{"delta":{"content":" there"}}]}',
        'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":8,"total_tokens":13},"model":"local-model"}',
        "data: [DONE]",