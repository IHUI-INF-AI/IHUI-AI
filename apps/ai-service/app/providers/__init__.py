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
    """根据模型前缀返回对应适配器,无 key 或无匹配前缀时返回 None(fallback LiteLLM)。

    路由策略(2026-07 扩展):
    - 国内厂商(jimeng/kling/luyala/qwen/doubao/hunyuan/glm/volcengine)有专属适配器
      → 必须放在 OpenAI catchall 之前(否则无斜杠前缀会被吞)
    - 国际原厂(claude/gemini/stepfun)有专属适配器
    - 其他国际厂商(groq/mistral/cohere/perplexity/xai/replicate/stability/ai21/
      watsonx/vertex/together/cerebras/sambanova/deepinfra/friendli/anyscale/
      huggingface/ollama/azure/bedrock/moonshot/baichuan/y)都是 OpenAI 兼容
      → catchall OpenAIProvider 已能处理,此处显式列出仅为提高可读性
        + 未来若厂商有非 OpenAI 兼容协议(例如 ollama 原生 / vertex AI 原生),
          可在路由前补专属适配器
    """
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
    # 国际厂商(均为 OpenAI 兼容,catchall OpenAIProvider 可处理;此处显式列出便于未来扩展专属协议)
    # groq / mistral / cohere / perplexity / xai / replicate / stability / ai21
    # watsonx / vertex / together / cerebras / sambanova / deepinfra / friendli
    # anyscale / huggingface / ollama / azure / bedrock / moonshot / baichuan / y / z
    # → 全部由 catchall OpenAIProvider 处理(无 key 时返回 None → fallback LiteLLM)
    # Groq 为 OpenAI 兼容接口,复用 OpenAIProvider 处理 tools 差异
    # OpenRouter 已迁移至专属 OpenrouterProvider,catchall 不再覆盖 openrouter/
    if m.startswith(("gpt-", "o1-", "o3-", "o4-", "o5-",
                     "openai/", "groq/", "mistral/", "codestral/", "pixtral/",
                     "command-", "sonar-", "grok-",
                     "replicate/", "stability-", "jamba-",
                     "watsonx/", "vertex/", "together-",
                     "cerebras/", "sambanova/", "deepinfra/",
                     "friendli/", "anyscale/", "infermatic/",
                     "huggingface/", "ollama/", "azure/", "bedrock/",
                     "moonshot-", "baichuan-", "yi-",
                     "ernie-", "abab", "minimax-", "spark-",
                     "internlm", "sensenova-", "skywork-",
                     "amazon-nova-",
                     "inflection-",
                     "snowflake-", "stablelm-", "nous-",
                     "phi-", "nemotron-", "llama-", "mistral-",
                     "gemma-", "qwen", "deepseek-",
                     "kimi-",
                     "ornith-", "codebrain-", "mai-",
                     "claude", "gemini-")) or "/" not in model:
        return OpenAIProvider(api_key, api_base)
    return None
