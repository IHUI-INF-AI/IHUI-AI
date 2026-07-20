"""Tencent Hunyuan(腾讯混元)适配器(自有协议,待实现)。

api_base: https://hunyuan.tencentcloudapi.com
model 前缀: hunyuan-* (hunyuan-pro / hunyuan-standard / hunyuan-lite)
协议: 腾讯自有协议(基于 TC3-HMAC-SHA256 签名的 ChatCompletions API,非 OpenAI 兼容)
注: 自有协议(签名 + 请求格式)待实现,目前请通过 LiteLLM 集成路径调用。
    LiteLLM 已内置 hunyuan 适配(litellm.acompletion(model="hunyuan/..."))。
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from .base_provider import BaseProvider


class TencentHunyuanProvider(BaseProvider):
    """腾讯混元适配器:自有协议(TC3-HMAC-SHA256 签名),待实现。

    临时行为:complete / astream 抛 NotImplementedError,调用方应 fallback 到 LiteLLM。
    """

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        base = api_base or "https://hunyuan.tencentcloudapi.com"
        super().__init__(api_key, base, timeout)
        self.base_url = base.rstrip("/")

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        raise NotImplementedError(
            "tencent-hunyuan 自有协议待实现,请使用 LiteLLM 集成路径"
        )

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        raise NotImplementedError(
            "tencent-hunyuan 自有协议待实现,请使用 LiteLLM 集成路径"
        )
        # 不可达:仅为满足 AsyncIterator 类型签名,使函数成为 async generator
        yield {}  # pragma: no cover
