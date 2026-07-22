"""Tencent Hunyuan(腾讯混元)适配器(通过 LiteLLM 网关调用)。

api_base: https://hunyuan.tencentcloudapi.com
model 前缀: hunyuan-* (hunyuan-pro / hunyuan-standard / hunyuan-lite)
协议: 通过 LiteLLM 网关调用(litellm.acompletion(model="hunyuan/..."))
注: 腾讯自有协议(TC3-HMAC-SHA256 签名)复杂,直接复用 LiteLLM 内置的 hunyuan 适配。
    LiteLLM 未安装或调用失败时降级为 503。
"""

from __future__ import annotations

import logging
from typing import Any, AsyncIterator

from fastapi import HTTPException

from .base_provider import BaseProvider

logger = logging.getLogger(__name__)


class TencentHunyuanProvider(BaseProvider):
    """腾讯混元适配器:通过 LiteLLM 网关调用,LiteLLM 不可用时降级 503。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        base = api_base or "https://hunyuan.tencentcloudapi.com"
        super().__init__(api_key, base, timeout)
        self.base_url = base.rstrip("/")

    def _litellm_model(self, model: str) -> str:
        """将 hunyuan-pro 转为 LiteLLM 格式 tencent/hunyuan-pro。"""
        return f"tencent/{self._strip_prefix(model)}"

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        try:
            import litellm
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="Tencent Hunyuan 暂不可用:LiteLLM 未安装,无法调用混元模型",
            )

        call_kwargs: dict[str, Any] = {
            "model": self._litellm_model(model),
            "messages": messages,
            "api_key": self.api_key,
        }
        if tools:
            call_kwargs["tools"] = tools
        call_kwargs.update(kwargs)

        try:
            response = await litellm.acompletion(**call_kwargs)
            usage = response.usage
            usage_dict: dict[str, Any] = {}
            if usage is not None:
                usage_dict = (
                    usage.model_dump() if hasattr(usage, "model_dump") else dict(usage)
                )
            result: dict[str, Any] = {
                "content": response.choices[0].message.content,
                "model": response.model or model,
                "usage": usage_dict,
                "stub": False,
            }
            raw_tool_calls = getattr(response.choices[0].message, "tool_calls", None)
            if raw_tool_calls:
                result["tool_calls"] = [
                    {
                        "id": getattr(tc, "id", ""),
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "",
                        },
                    }
                    for tc in raw_tool_calls
                ]
            return result
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Tencent Hunyuan LiteLLM 调用失败: %s", e)
            raise HTTPException(
                status_code=503,
                detail=f"Tencent Hunyuan 暂不可用:LiteLLM 调用失败 - {type(e).__name__}",
            )

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        try:
            import litellm
        except ImportError:
            raise HTTPException(
                status_code=503,
                detail="Tencent Hunyuan 暂不可用:LiteLLM 未安装,无法调用混元模型",
            )
            yield {}  # pragma: no cover

        call_kwargs: dict[str, Any] = {
            "model": self._litellm_model(model),
            "messages": messages,
            "api_key": self.api_key,
            "stream": True,
            "stream_usage": True,
        }
        if tools:
            call_kwargs["tools"] = tools
        call_kwargs.update(kwargs)

        try:
            response = await litellm.acompletion(**call_kwargs)
            final_model = model
            final_usage: dict[str, Any] = {}
            async for chunk in response:
                if hasattr(chunk, "choices") and chunk.choices:
                    delta = chunk.choices[0].delta
                    token = getattr(delta, "content", None)
                    if token:
                        yield {"type": "chunk", "content": token}
                if hasattr(chunk, "usage") and chunk.usage:
                    try:
                        final_usage = (
                            chunk.usage.model_dump()
                            if hasattr(chunk.usage, "model_dump")
                            else dict(chunk.usage)
                        )
                    except Exception:
                        pass
                if hasattr(chunk, "model") and chunk.model:
                    final_model = chunk.model
            yield {
                "type": "done",
                "model": final_model,
                "usage": final_usage,
                "stub": False,
            }
        except Exception as e:
            logger.warning("Tencent Hunyuan LiteLLM 流式调用失败: %s", e)
            yield {
                "type": "error",
                "message": f"Tencent Hunyuan 暂不可用:LiteLLM 流式调用失败 - {type(e).__name__}",
            }
