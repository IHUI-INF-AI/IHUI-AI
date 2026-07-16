"""StepFun 适配器(OpenAI 兼容 + reasoning_content 透传)。

StepFun API 与 OpenAI Chat Completions 兼容,差异点:
- reasoning_content:思维链内容(非标准 OpenAI 字段),需透传给调用方
其余复用 OpenAI 适配器实现,仅扩展 reasoning_content 处理。
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .openai_provider import OpenAIProvider
from .base_provider import ProviderError


class StepfunProvider(OpenAIProvider):
    """StepFun 适配器:继承 OpenAI 兼容协议,额外透传 reasoning_content。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        # StepFun 默认 base url(api_base 为空时用 .env 配置的 stepfun_api_base)
        base = api_base or "https://api.stepfun.com"
        super().__init__(api_key, base, timeout)

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = self._build_payload(messages, model, tools=tools, stream=False, **kwargs)
        data = await self._request("POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=payload)
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})
        result: dict[str, Any] = {
            "content": msg.get("content", ""),
            "model": data.get("model", model),
            "usage": data.get("usage", {}),
            "stub": False,
        }
        # reasoning_content:StepFun 思维链字段(非标准 OpenAI),透传
        reasoning = msg.get("reasoning_content")
        if reasoning:
            result["reasoning"] = reasoning
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
                    "POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=payload
                ) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        raise ProviderError(
                            f"StepFun 流式调用失败: {resp.status_code} {body[:300]!r}",
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
                        # reasoning_content 透传(思维链流式)
                        if delta.get("reasoning_content"):
                            yield {"type": "reasoning", "content": delta["reasoning_content"]}
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
            yield {"type": "error", "message": f"StepFun 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}
