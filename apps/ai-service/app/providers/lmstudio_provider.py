"""LM Studio 本地 LLM 适配器。

LM Studio 是 OpenAI 兼容 endpoint,直接复用 OpenAIProvider 逻辑,
仅覆盖默认 api_base(http://localhost:1234)和 api_key(任意值 "lm-studio")。

- api_base 默认 http://localhost:1234
- api_key 默认 "lm-studio"(LM Studio 不校验 key,但 OpenAI 兼容协议要求传 Bearer)
- complete() / astream() / list_models() → 复用 OpenAIProvider 的 /v1/chat/completions
"""

from __future__ import annotations

from .openai_provider import OpenAIProvider


class LMStudioProvider(OpenAIProvider):
    """LM Studio 本地适配器:OpenAI 兼容协议,仅设默认 base_url 与占位 key。"""

    def __init__(
        self,
        api_key: str | None = None,
        api_base: str | None = None,
        timeout: float = 60.0,
):
        super().__init__(
            api_key=api_key or "lm-studio",
            api_base=api_base or "http://localhost:1234",
            timeout=timeout,
        )
