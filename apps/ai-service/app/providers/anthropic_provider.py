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
from ..services.tool_schema_adapter import (
    anthropic_response_to_openai,
    openai_tools_to_anthropic,
)

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
        """OpenAI function calling tools → Anthropic tool_use 格式(input_schema)。

        委托 tool_schema_adapter.openai_tools_to_anthropic(深拷贝,
        递归保留 input_schema 全部嵌套字段,与入参不共享引用)。
        """
        return openai_tools_to_anthropic(tools)

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
        """解析 Anthropic content blocks → (text, tool_calls)。

        tool_use 块的 OpenAI 形态转换委托
        tool_schema_adapter.anthropic_response_to_openai(统一 tool_calls 契约)。
        """
        text_parts: list[str] = []
        for block in content:
            if block.get("type") == "text":
                text_parts.append(block.get("text", ""))
        tool_calls = anthropic_response_to_openai(content)
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
                # tool_use 块累积器:index → {id, name, arguments_json}
                # content_block_start 携带 id/name,input_json_delta 逐片拼接 arguments,
                # content_block_stop 时以 OpenAI tool_calls 形态产出完整 tool_call 事件
                # (供 llm_gateway._accumulate_tool_calls 归并 → SSE tool_calls 事件)。
                pending_tool_blocks: dict[int, dict[str, Any]] = {}
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    try:
                        event = json.loads(line[6:])
                    except json.JSONDecodeError:
                        continue
                    etype = event.get("type")
                    if etype == "content_block_start":
                        block = event.get("content_block", {}) or {}
                        if block.get("type") == "tool_use":
                            pending_tool_blocks[event.get("index", 0)] = {
                                "id": block.get("id") or "",
                                "name": block.get("name") or "",
                                "arguments": "",
                            }
                    elif etype == "content_block_delta":
                        delta = event.get("delta", {})
                        if delta.get("type") == "text_delta":
                            yield {"type": "chunk", "content": delta.get("text", "")}
                        elif delta.get("type") == "input_json_delta":
                            partial = delta.get("partial_json", "")
                            block = pending_tool_blocks.get(event.get("index", 0))
                            if block is not None and partial:
                                block["arguments"] += partial
                            # 兼容旧行为:逐片透传 tool_call_delta(partial_json)
                            yield {"type": "tool_call_delta", "partial_json": partial}
                    elif etype == "content_block_stop":
                        block = pending_tool_blocks.pop(event.get("index", 0), None)
                        if block is not None:
                            # OpenAI tool_calls 形态(arguments 为 JSON 字符串,空入参兜底 "{}")
                            yield {"type": "tool_call", "tool_calls": [{
                                "id": block["id"],
                                "type": "function",
                                "function": {
                                    "name": block["name"],
                                    "arguments": block["arguments"] or "{}",
                                },
                            }]}
                    elif etype == "message_stop":
                        yield {"type": "done", "model": model, "usage": {}, "stub": False}
        except httpx.HTTPError as e:
            yield {"type": "error", "message": f"Anthropic 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}
