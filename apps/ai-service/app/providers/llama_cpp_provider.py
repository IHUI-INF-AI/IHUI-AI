"""llama.cpp server 本地 LLM 适配器。

llama.cpp server(llama-server)支持 OpenAI 兼容端点 /v1/chat/completions,
直接复用 OpenAIProvider 逻辑,仅覆盖默认 api_base 和 list_models。

- api_base 默认 http://localhost:8080
- api_key 默认 None(llama.cpp server 默认无鉴权)
- complete() / astream() → 复用 OpenAIProvider 的 /v1/chat/completions
- list_models() → 硬编码 [{"id": "local-model", ...}](llama.cpp 无 models 列表端点)
"""

from __future__ import annotations

from typing import Any

from .openai_provider import OpenAIProvider


class LlamaCppProvider(OpenAIProvider):
    """llama.cpp server 适配器:OpenAI 兼容协议,硬编码模型列表。"""

    def __init__(
        self,
        api_key: str | None = None,
        api_base: str | None = None,
        timeout: float = 120.0,
):
        super().__init__(
            api_key=api_key or "llamacpp",
            api_base=api_base or "http://localhost:8080",
            timeout=timeout,
        )

    async def list_models(self) -> list[dict[str, Any]]:
        """llama.cpp server 无 /v1/models 端点,返回硬编码占位模型。"""
        return [
            {
                "id": "local-model",
                "name": "Local Model (llama.cpp)",
            }
        ]
