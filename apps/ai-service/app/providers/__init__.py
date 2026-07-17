"""厂商独立 AI 适配器(R74 审计 P2 补建)。

为每个厂商封装原生 API 差异(function calling 格式 / system prompt 处理 /
safety_settings 等),作为 LiteLLM 的可选增强。未配置时 fallback 到 LiteLLM。

适配器仅实现核心差异,不重复 LiteLLM 已做好的通用部分(重试/限流/路由等)。
不引入厂商 SDK,统一用 httpx 直接调用 API。
"""

from .base_provider import BaseProvider, ProviderError
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .gemini_provider import GeminiProvider
from .stepfun_provider import StepfunProvider

__all__ = [
    "BaseProvider",
    "ProviderError",
    "OpenAIProvider",
    "AnthropicProvider",
    "GeminiProvider",
    "StepfunProvider",
    "get_provider",
]


def get_provider(model: str, api_key: str | None, api_base: str | None) -> BaseProvider | None:
    """根据模型前缀返回对应适配器,无 key 或无匹配前缀时返回 None(fallback LiteLLM)。"""
    if not api_key:
        return None
    m = model.lower()
    if m.startswith(("claude-", "anthropic/")):
        return AnthropicProvider(api_key, api_base)
    if m.startswith("gemini/"):
        return GeminiProvider(api_key, api_base)
    if m.startswith("stepfun/"):
        return StepfunProvider(api_key, api_base)
    # Groq/OpenRouter 均为 OpenAI 兼容接口,复用 OpenAIProvider 处理 tools 差异
    if m.startswith(("gpt-", "o1-", "o3-", "openai/", "groq/", "openrouter/")) or "/" not in model:
        return OpenAIProvider(api_key, api_base)
    return None
