"""Qwen3.5 本地 LLM 适配器(基于 Ollama 原生协议)。

继承 OllamaProvider,针对 Qwen3.5 ChatML 模板做两项优化:
- 注入 ChatML stop tokens(<|im_end|> / <|endoftext|>),避免模型续写
  系统提示或多轮对话边界,显著提升对话终止准确率。
- 扩大 num_ctx 至 32768(Qwen3.5 支持 32K 上下文),默认 2048 会截断长 prompt。

调用方显式传入 options.stop / options.num_ctx 时不覆盖,保留自定义能力。
"""

from __future__ import annotations

from typing import Any

from .ollama_provider import OllamaProvider


class QwenLocalProvider(OllamaProvider):
    """Qwen3.5 本地适配器:Ollama 原生协议 + ChatML stop tokens + 32K ctx。"""

    PROVIDER_NAME = "qwen-local"
    SUPPORTED_MODELS = [
        "qwen2.5:7b",
        "qwen2.5:14b",
        "qwen2.5:32b",
        "qwen2.5:72b",
        "qwen2.5-coder:7b",
    ]

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None,
        stream: bool,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = super()._build_payload(messages, model, tools=tools, stream=stream, **kwargs)
        options: dict[str, Any] = payload.get("options") or {}
        # ChatML stop tokens(调用方未指定时注入)
        options.setdefault("stop", ["<|im_end|>", "<|endoftext|>"])
        # Qwen3.5 32K 上下文(调用方未指定时扩大)
        options.setdefault("num_ctx", 32768)
        payload["options"] = options
        return payload

    async def list_models(self) -> list[dict[str, Any]]:
        """只返回 Qwen 系列模型(过滤 name 含 'qwen')。"""
        models = await super().list_models()
        return [m for m in models if "qwen" in m.get("name", "").lower()]
