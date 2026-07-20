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
from .alibaba_dashscope_provider import AlibabaDashscopeProvider
from .doubao_provider import DoubaoProvider
from .jimeng_provider import JimengProvider
from .kling_provider import KlingProvider
from .luyala_provider import LuyalaProvider
from .openrouter_provider import OpenrouterProvider
from .tencent_hunyuan_provider import TencentHunyuanProvider
from .zhipu_provider import ZhipuProvider
from .volcengine_provider import VolcengineProvider

__all__ = [
    "BaseProvider",
    "ProviderError",
    "OpenAIProvider",
    "AnthropicProvider",
    "GeminiProvider",
    "StepfunProvider",
    "AlibabaDashscopeProvider",
    "DoubaoProvider",
    "JimengProvider",
    "KlingProvider",
    "LuyalaProvider",
    "OpenrouterProvider",
    "TencentHunyuanProvider",
    "ZhipuProvider",
    "VolcengineProvider",
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
    # 国内厂商 / 聚合平台:必须在 OpenAI 兼容 catchall 之前匹配(否则无斜杠前缀会被吞)
    if m.startswith("qwen-"):
        return AlibabaDashscopeProvider(api_key, api_base)
    if m.startswith("doubao-"):
        return DoubaoProvider(api_key, api_base)
    if m.startswith("jimeng-"):
        return JimengProvider(api_key, api_base)
    if m.startswith("kling-"):
        return KlingProvider(api_key, api_base)
    if m.startswith("luyala-"):
        return LuyalaProvider(api_key, api_base)
    if m.startswith("openrouter/"):
        return OpenrouterProvider(api_key, api_base)
    if m.startswith("hunyuan-"):
        return TencentHunyuanProvider(api_key, api_base)
    if m.startswith("glm-"):
        return ZhipuProvider(api_key, api_base)
    if m.startswith("volcengine-"):
        return VolcengineProvider(api_key, api_base)
    # Groq 为 OpenAI 兼容接口,复用 OpenAIProvider 处理 tools 差异
    # OpenRouter 已迁移至专属 OpenrouterProvider,catchall 不再覆盖 openrouter/
    if m.startswith(("gpt-", "o1-", "o3-", "openai/", "groq/")) or "/" not in model:
        return OpenAIProvider(api_key, api_base)
    return None
