"""Ollama 本地 LLM 适配器。

使用 Ollama 原生 /api/chat 端点(非 OpenAI 兼容 /v1/chat/completions),
因为原生格式支持 tools function calling(Ollama 0.3.0+)。

- api_base 默认 http://localhost:11434
- 不需要 api_key(Ollama 本地服务无鉴权)
- complete() → POST /api/chat(stream=false)
- astream() → POST /api/chat(stream=true,逐行 NDJSON)
- list_models() → GET /api/tags

Ollama 原生响应格式:
  {"message": {"content": "...", "tool_calls": [...]}, "model": "...",
   "eval_count": 123, "prompt_eval_count": 456, "done": true}

usage 转换:
  prompt_tokens = prompt_eval_count
  completion_tokens = eval_count
  total_tokens = eval_count + prompt_eval_count
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

from .base_provider import BaseProvider, ProviderError
from ..core.llm_gateway import get_http_client

logger = logging.getLogger(__name__)


class OllamaProvider(BaseProvider):
    """Ollama 原生 API 适配器(本地部署,无需鉴权)。"""

    def __init__(
        self,
        api_key: str | None = None,
        api_base: str | None = None,
        timeout: float = 60.0,
):
        super().__init__(api_key or "", api_base, timeout)
        self.base_url = (api_base or "http://localhost:11434").rstrip("/")

    def _headers(self) -> dict[str, str]:
        # Ollama 本地服务无需 Authorization,仅设 Content-Type
        return {"Content-Type": "application/json"}

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
            "stream": stream,
        }
        # Ollama 0.3.0+ 原生 tools function calling
        if tools:
            payload["tools"] = tools
        payload.update(kwargs)
        return payload

    @staticmethod
    def _extract_usage(data: dict[str, Any]) -> dict[str, Any]:
        """Ollama eval_count / prompt_eval_count → 标准 usage 格式。"""
        eval_count = data.get("eval_count", 0)
        prompt_eval_count = data.get("prompt_eval_count", 0)
        return {
            "prompt_tokens": prompt_eval_count,
            "completion_tokens": eval_count,
            "total_tokens": eval_count + prompt_eval_count,
        }

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
            "POST", f"{self.base_url}/api/chat", headers=self._headers(), json=payload
        )
        msg = data.get("message", {})
        usage = self._extract_usage(data)
        if not usage.get("total_tokens"):
            logger.warning("Ollama 非流式响应无 usage 字段, model=%s", model)
        result: dict[str, Any] = {
            "content": msg.get("content", ""),
            "model": data.get("model", model),
            "usage": usage,
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
        _done_yielded = False
        _errored = False
        _final_model = model
        _final_usage: dict[str, Any] = {}
        try:
            client = get_http_client()
            async with client.stream(
                "POST", f"{self.base_url}/api/chat",
                headers=self._headers(), json=payload, timeout=self.timeout,
            ) as resp:
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise ProviderError(
                        f"Ollama 流式调用失败: {resp.status_code} {body[:300]!r}",
                        resp.status_code,
                    )
                # Ollama 流式:逐行 NDJSON(每行一个 JSON 对象,非 SSE)
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError as e:
                        logger.warning(
                            "Ollama 流式 chunk JSON 解析失败, 跳过: %s (raw=%r)",
                            e, line[:200],
                        )
                        continue
                    msg = chunk.get("message", {})
                    if msg.get("content"):
                        yield {"type": "chunk", "content": msg["content"]}
                    if msg.get("tool_calls"):
                        yield {"type": "tool_call", "tool_calls": msg["tool_calls"]}
                    # done=true 表示最后一帧,含完整 usage
                    if chunk.get("done"):
                        if chunk.get("model"):
                            _final_model = chunk["model"]
                        _final_usage = self._extract_usage(chunk)
                        yield {
                            "type": "done",
                            "model": _final_model,
                            "usage": _final_usage,
                            "stub": False,
                        }
                        _done_yielded = True
        except httpx.HTTPError as e:
            _errored = True
            yield {"type": "error", "message": f"Ollama 流式网络异常: {e}"}
        except ProviderError as e:
            _errored = True
            yield {"type": "error", "message": str(e)}

        # 流式结束但未收到 done 帧 → 兜底发送空 usage done 事件
        if not _done_yielded and not _errored:
            logger.warning(
                "Ollama 流式结束但未收到 done 帧, 发送空 usage done, model=%s",
                model,
            )
            yield {"type": "done", "model": model, "usage": {}, "stub": False}

    async def list_models(self) -> list[dict[str, Any]]:
        data = await self._request("GET", f"{self.base_url}/api/tags", headers=self._headers())
        models = data.get("models", [])
        return [
            {
                "id": m.get("name", ""),
                "name": m.get("name", ""),
                "size": m.get("size", 0),
                "details": m.get("details", {}),
            }
            for m in models
        ]
