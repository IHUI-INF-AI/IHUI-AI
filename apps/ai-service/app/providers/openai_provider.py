"""OpenAI 原生适配器。

核心差异(相对 LiteLLM 通用层):
- function calling 用 JSON schema 格式(tools / tool_choice)
- stream options(stream_options.include_usage 在最后一帧返回 usage)
- vision 图片输入(image_url content type)
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base_provider import BaseProvider, ProviderError


class OpenAIProvider(BaseProvider):
    """OpenAI 原生 API 适配器(也兼容 OpenAI 兼容 endpoint)。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        super().__init__(api_key, api_base, timeout)
        self.base_url = (api_base or "https://api.openai.com").rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None,
        stream: bool,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._strip_prefix(model),
            "messages": messages,
        }
        # function calling:OpenAI 用 JSON schema 格式,直接透传 tools/tool_choice
        if tools:
            payload["tools"] = tools
            if "tool_choice" in kwargs:
                payload["tool_choice"] = kwargs.pop("tool_choice")
        # stream options:流式时在最后一帧返回 usage
        if stream:
            payload["stream"] = True
            payload["stream_options"] = {"include_usage": True}
        payload.update(kwargs)
        return payload

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = self._build_payload(messages, model, tools=tools, stream=False, **kwargs)
        data = await self._request("POST", f"{self.base_url}/v1/chat/completions", headers=self._headers(), json=payload)
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})
        result: dict[str, Any] = {
            "content": msg.get("content", ""),
            "model": data.get("model", model),
            "usage": data.get("usage", {}),
            "stub": False,
        }
        # function calling 响应:tool_calls 数组
        if msg.get("tool_calls"):
            result["tool_calls"] = msg["tool_calls"]
        return result

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        payload = self._build_payload(messages, model, tools=tools, stream=True, **kwargs)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream(
                    "POST", f"{self.base_url}/v1/chat/completions", headers=self._headers(), json=payload
                ) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        raise ProviderError(
                            f"OpenAI 流式调用失败: {resp.status_code} {body[:300]!r}",
                            resp.status_code,
                        )
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        chunk_str = line[6:]
                        if chunk_str.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(chunk_str)
                        except json.JSONDecodeError:
                            continue
                        choice = chunk.get("choices", [{}])[0]
                        delta = choice.get("delta", {})
                        if delta.get("content"):
                            yield {"type": "chunk", "content": delta["content"]}
                        if delta.get("tool_calls"):
                            yield {"type": "tool_call", "tool_calls": delta["tool_calls"]}
                        if chunk.get("usage"):
                            yield {
                                "type": "done",
                                "model": chunk.get("model", model),
                                "usage": chunk["usage"],
                                "stub": False,
                            }
        except httpx.HTTPError as e:
            yield {"type": "error", "message": f"OpenAI 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}

    async def list_models(self) -> list[dict[str, Any]]:
        data = await self._request("GET", f"{self.base_url}/v1/models", headers=self._headers())
        return data.get("data", [])
