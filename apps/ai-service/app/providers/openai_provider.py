"""OpenAI 原生适配器。

核心差异(相对 LiteLLM 通用层):
- function calling 用 JSON schema 格式(tools / tool_choice)
- stream options(stream_options.include_usage 在最后一帧返回 usage)
- vision 图片输入(image_url content type)
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from .base_provider import BaseProvider, ProviderError
from ..core.llm_gateway import get_http_client

logger = logging.getLogger(__name__)


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
        # P1-7: 非流式 usage 缺失日志化(不静默丢 token)
        usage = data.get("usage")
        if not usage:
            logger.warning("OpenAI 非流式响应无 usage 字段, model=%s", model)
        result: dict[str, Any] = {
            "content": msg.get("content", ""),
            "model": data.get("model", model),
            "usage": usage or {},
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
        # P1-7: 流式 done 事件兜底标志
        _done_yielded = False
        _errored = False
        try:
            client = get_http_client()
            async with client.stream(
                "POST", f"{self.base_url}/v1/chat/completions", headers=self._headers(), json=payload,
                timeout=self.timeout,
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
                    except json.JSONDecodeError as e:
                        # P1-7: 坏 chunk 日志化(不静默跳过)
                        logger.warning(
                            "OpenAI 流式 chunk JSON 解析失败, 跳过: %s (raw=%r)",
                            e, chunk_str[:200],
                        )
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
                        _done_yielded = True
        except httpx.HTTPError as e:
            _errored = True
            yield {"type": "error", "message": f"OpenAI 流式网络异常: {e}"}
        except ProviderError as e:
            _errored = True
            yield {"type": "error", "message": str(e)}

        # P1-7: 流式结束但未收到 usage chunk → 兜底发送空 usage done 事件
        if not _done_yielded and not _errored:
            logger.warning(
                "OpenAI 流式结束但未收到 usage chunk, 发送空 usage done, model=%s",
                model,
            )
            yield {"type": "done", "model": model, "usage": {}, "stub": False}

    async def list_models(self) -> list[dict[str, Any]]:
        data = await self._request("GET", f"{self.base_url}/v1/models", headers=self._headers())
        return data.get("data", [])
