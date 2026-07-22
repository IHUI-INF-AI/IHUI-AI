"""Anthropic 原生适配器。

核心差异(相对 OpenAI/LiteLLM 通用层):
- tool_use 格式:tools 用 input_schema(而非 JSON schema),响应为 content blocks
- system prompt 独立参数(不放在 messages 里)
- max_tokens 必填(Anthropic API 强制要求)
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base_provider import BaseProvider, ProviderError
from ..core.llm_gateway import get_http_client

_ANTHROPIC_VERSION = "2023-06-01"


class AnthropicProvider(BaseProvider):
    """Anthropic Messages API 原生适配器。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        super().__init__(api_key, api_base, timeout)
        self.base_url = (api_base or "https://api.anthropic.com").rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        }

    def _split_system(
        self,
        messages: list[dict[str, Any]],
    ) -> tuple[str | None, list[dict[str, Any]]]:
        """分离 system prompt(Anthropic 用独立参数,不放在 messages)。"""
        system_parts: list[str] = []
        rest: list[dict[str, Any]] = []
        for m in messages:
            if m.get("role") == "system":
                content = m.get("content", "")
                if isinstance(content, str):
                    system_parts.append(content)
                else:
                    system_parts.append(json.dumps(content, ensure_ascii=False))
            else:
                rest.append(m)
        system = "\n\n".join(system_parts) if system_parts else None
        return system, rest

    def _convert_tools(self, tools: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
        """OpenAI function calling tools → Anthropic tool_use 格式(input_schema)。"""
        if not tools:
            return None
        converted: list[dict[str, Any]] = []
        for t in tools:
            if t.get("type") == "function":
                fn = t.get("function", {})
                converted.append({
                    "name": fn.get("name"),
                    "description": fn.get("description", ""),
                    "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
                })
            else:
                converted.append(t)
        return converted

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None,
        stream: bool,
        max_tokens: int = 4096,
        **kwargs: Any,
    ) -> dict[str, Any]:
        system, rest = self._split_system(messages)
        payload: dict[str, Any] = {
            "model": self._strip_prefix(model),
            "messages": rest,
            # max_tokens 必填(Anthropic API 强制要求,与 OpenAI 不同)
            "max_tokens": kwargs.pop("max_tokens", max_tokens),
        }
        if system:
            payload["system"] = system
        converted_tools = self._convert_tools(tools)
        if converted_tools:
            payload["tools"] = converted_tools
            if "tool_choice" in kwargs:
                payload["tool_choice"] = kwargs.pop("tool_choice")
        if stream:
            payload["stream"] = True
        payload.update(kwargs)
        return payload

    def _parse_content_blocks(self, content: list[dict[str, Any]]) -> tuple[str, list[dict[str, Any]]]:
        """解析 Anthropic content blocks → (text, tool_calls)。"""
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        for block in content:
            if block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_calls.append({
                    "id": block.get("id"),
                    "type": "function",
                    "function": {
                        "name": block.get("name"),
                        "arguments": json.dumps(block.get("input", {}), ensure_ascii=False),
                    },
                })
        return "".join(text_parts), tool_calls

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = self._build_payload(messages, model, tools=tools, stream=False, **kwargs)
        data = await self._request("POST", f"{self.base_url}/v1/messages", headers=self._headers(), json=payload)
        text, tool_calls = self._parse_content_blocks(data.get("content", []))
        result: dict[str, Any] = {
            "content": text,
            "model": data.get("model", model),
            "usage": data.get("usage", {}),
            "stub": False,
        }
        if tool_calls:
            result["tool_calls"] = tool_calls
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
            client = get_http_client()
            async with client.stream(
                "POST", f"{self.base_url}/v1/messages", headers=self._headers(), json=payload,
                timeout=self.timeout,
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise ProviderError(
                        f"Anthropic 流式调用失败: {resp.status_code} {body[:300]!r}",
                        resp.status_code,
                    )
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        event = json.loads(line[6:])
                    except json.JSONDecodeError:
                        continue
                    etype = event.get("type")
                    if etype == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield {"type": "chunk", "content": delta.get("text", "")}
                        elif delta.get("type") == "input_json_delta":
                            yield {"type": "tool_call_delta", "partial_json": delta.get("partial_json", "")}
                    elif etype == "message_stop":
                        yield {"type": "done", "model": model, "usage": {}, "stub": False}
        except httpx.HTTPError as e:
            yield {"type": "error", "message": f"Anthropic 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}
