"""Doubao(字节豆包)适配器。

api_base: https://ark.cn-beijing.volces.com/api/v3
model 前缀: doubao-* (doubao-pro / doubao-lite / doubao-vision)
协议: OpenAI 兼容(火山引擎方舟 Ark 提供 OpenAI 兼容 endpoint)
注: 与 volcengine_provider 同源(均走 Ark api_base),仅 model 前缀不同。
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base_provider import ProviderError
from .openai_provider import OpenAIProvider
from ..core.llm_gateway import get_http_client


class DoubaoProvider(OpenAIProvider):
    """字节豆包适配器:OpenAI 兼容协议(Ark api_base),仅覆写 base_url 与 URL 构造。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        # api_base 已含 /api/v3,不能再加 /v1
        base = api_base or "https://ark.cn-beijing.volces.com/api/v3"
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
        data = await self._request(
            "POST", f"{self.base_url}/chat/completions", headers=self._headers(), json=payload
        )
        choice = data.get("choices", [{}])[0]
        msg = choice.get("message", {})
        result: dict[str, Any] = {
            "content": msg.get("content", ""),
            "model": data.get("model", model),
            "usage": data.get("usage", {}),
            "stub": False,
        }
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
            client = get_http_client()
            async with client.stream(
                "POST", f"{self.base_url}/chat/completions",
                headers=self._headers(), json=payload, timeout=self.timeout,
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise ProviderError(
                        f"Doubao 流式调用失败: {resp.status_code} {body[:300]!r}",
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
            yield {"type": "error", "message": f"Doubao 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}
