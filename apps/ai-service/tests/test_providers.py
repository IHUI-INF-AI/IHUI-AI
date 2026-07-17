"""providers/__init__.py 的 get_provider 工厂函数单元测试。

测试覆盖:
- 模型前缀路由(claude-/anthropic/ → Anthropic,gemini/ → Gemini,stepfun/ → Stepfun,
  gpt-/o1-/o3-/openai/groq/openrouter/裸模型 → OpenAI)
- 无 api_key → None(fallback LiteLLM)
- 未知前缀 → None
- 5 个 provider 实例化 + BaseProvider 类型校验
- ProviderError 异常场景
- provider 方法完整性(complete/astream/list_models/_strip_prefix/_request)
- api_base 透传 + 大小写不敏感
"""

from __future__ import annotations

import pytest

from app.providers import (
    AnthropicProvider,
    BaseProvider,
    GeminiProvider,
    OpenAIProvider,
    ProviderError,
    StepfunProvider,
    get_provider,
)


# =============================================================================
# 前缀路由 — AnthropicProvider
# =============================================================================


def test_claude_prefix_routes_to_anthropic():
    """claude- 前缀 → AnthropicProvider。"""
    p = get_provider("claude-3-5-sonnet", "sk-ant-test", None)
    assert isinstance(p, AnthropicProvider)


def test_anthropic_slash_prefix_routes_to_anthropic():
    """anthropic/ 前缀 → AnthropicProvider。"""
    p = get_provider("anthropic/claude-3-opus", "sk-ant-test", None)
    assert isinstance(p, AnthropicProvider)


# =============================================================================
# 前缀路由 — GeminiProvider
# =============================================================================


def test_gemini_prefix_routes_to_gemini():
    """gemini/ 前缀 → GeminiProvider。"""
    p = get_provider("gemini/gemini-1.5-flash", "sk-gem-test", None)
    assert isinstance(p, GeminiProvider)


# =============================================================================
# 前缀路由 — StepfunProvider
# =============================================================================


def test_stepfun_prefix_routes_to_stepfun():
    """stepfun/ 前缀 → StepfunProvider。"""
    p = get_provider("stepfun/step-3.7-flash", "sk-step-test", None)
    assert isinstance(p, StepfunProvider)


# =============================================================================
# 前缀路由 — OpenAIProvider
# =============================================================================


def test_gpt_prefix_routes_to_openai():
    """gpt- 前缀 → OpenAIProvider。"""
    p = get_provider("gpt-4o", "sk-test", None)
    assert isinstance(p, OpenAIProvider)


def test_o1_prefix_routes_to_openai():
    """o1- 前缀 → OpenAIProvider。"""
    p = get_provider("o1-preview", "sk-test", None)
    assert isinstance(p, OpenAIProvider)


def test_o3_prefix_routes_to_openai():
    """o3- 前缀 → OpenAIProvider。"""
    p = get_provider("o3-mini", "sk-test", None)
    assert isinstance(p, OpenAIProvider)


def test_openai_slash_prefix_routes_to_openai():
    """openai/ 前缀 → OpenAIProvider。"""
    p = get_provider("openai/gpt-4", "sk-test", None)
    assert isinstance(p, OpenAIProvider)


def test_groq_prefix_routes_to_openai():
    """groq/ 前缀 → OpenAIProvider(OpenAI 兼容接口复用)。"""
    p = get_provider("groq/llama-3.3-70b", "sk-groq-test", None)
    assert isinstance(p, OpenAIProvider)


def test_openrouter_prefix_routes_to_openai():
    """openrouter/ 前缀 → OpenAIProvider(OpenAI 兼容接口复用)。"""
    p = get_provider("openrouter/llama-3", "sk-or-test", None)
    assert isinstance(p, OpenAIProvider)


def test_bare_model_name_routes_to_openai():
    """无 / 的裸模型名 → OpenAIProvider(默认路由)。"""
    p = get_provider("llama-3", "sk-test", None)
    assert isinstance(p, OpenAIProvider)


# =============================================================================
# 无 api_key / 未知前缀 → None
# =============================================================================


def test_no_api_key_returns_none():
    """无 api_key(None)→ None(fallback LiteLLM)。"""
    assert get_provider("gpt-4o", None, None) is None


def test_empty_api_key_returns_none():
    """空字符串 api_key → None(falsy 检测)。"""
    assert get_provider("gpt-4o", "", None) is None


def test_unknown_prefix_returns_none():
    """未知前缀(含 / 但不匹配任何厂商)→ None。"""
    assert get_provider("unknown/some-model", "sk-test", None) is None


# =============================================================================
# 5 个 provider 实例化 + BaseProvider 类型校验
# =============================================================================


def test_all_providers_are_base_provider_subclasses():
    """5 个 provider 实例化成功且均为 BaseProvider 子类。"""
    providers = [
        get_provider("claude-3", "sk", None),
        get_provider("anthropic/claude", "sk", None),
        get_provider("gemini/gemini-1.5", "sk", None),
        get_provider("stepfun/step-3", "sk", None),
        get_provider("gpt-4o", "sk", None),
    ]
    assert len(providers) == 5
    for p in providers:
        assert isinstance(p, BaseProvider)


def test_stepfun_provider_is_also_openai_subclass():
    """StepfunProvider 继承自 OpenAIProvider(复用 OpenAI 兼容协议)。"""
    p = get_provider("stepfun/step-3", "sk", None)
    assert isinstance(p, StepfunProvider)
    assert isinstance(p, OpenAIProvider)


# =============================================================================
# ProviderError 异常场景
# =============================================================================


def test_provider_error_is_exception_subclass():
    """ProviderError 是 Exception 子类。"""
    assert issubclass(ProviderError, Exception)


def test_provider_error_default_status_code():
    """ProviderError 默认 status_code=502。"""
    err = ProviderError("test error")
    assert err.status_code == 502
    assert "test error" in str(err)


def test_provider_error_custom_status_code():
    """ProviderError 支持自定义 status_code。"""
    err = ProviderError("not found", status_code=404)
    assert err.status_code == 404


def test_provider_error_can_be_raised_and_caught():
    """ProviderError 可抛出并被 except 捕获。"""
    with pytest.raises(ProviderError) as exc_info:
        raise ProviderError("boom", status_code=500)
    assert exc_info.value.status_code == 500


# =============================================================================
# provider 方法完整性(BaseProvider 抽象方法已实现)
# =============================================================================


def test_provider_has_complete_method():
    """get_provider 返回的 provider 有 complete 方法。"""
    p = get_provider("gpt-4o", "sk-test", None)
    assert hasattr(p, "complete")
    assert callable(p.complete)


def test_provider_has_astream_method():
    """get_provider 返回的 provider 有 astream 方法。"""
    p = get_provider("gpt-4o", "sk-test", None)
    assert hasattr(p, "astream")
    assert callable(p.astream)


def test_provider_has_list_models_method():
    """get_provider 返回的 provider 有 list_models 方法。"""
    p = get_provider("gpt-4o", "sk-test", None)
    assert hasattr(p, "list_models")
    assert callable(p.list_models)


def test_provider_has_strip_prefix_method():
    """get_provider 返回的 provider 有 _strip_prefix 方法(去厂商前缀)。"""
    p = get_provider("stepfun/step-3", "sk-test", None)
    assert p._strip_prefix("stepfun/step-3") == "step-3"
    assert p._strip_prefix("gpt-4o") == "gpt-4o"


def test_provider_has_request_method():
    """get_provider 返回的 provider 有 _request 方法(httpx 封装)。"""
    p = get_provider("gpt-4o", "sk-test", None)
    assert hasattr(p, "_request")
    assert callable(p._request)


def test_provider_stores_api_key_and_base():
    """get_provider 返回的 provider 正确存储 api_key/api_base。"""
    p = get_provider("gpt-4o", "sk-test-key", "https://custom.api/v1")
    assert p.api_key == "sk-test-key"
    assert p.api_base == "https://custom.api/v1"


# =============================================================================
# 大小写不敏感
# =============================================================================


def test_claude_prefix_case_insensitive():
    """CLAUDE- 大写前缀 → AnthropicProvider(model.lower() 匹配)。"""
    p = get_provider("CLAUDE-3-OPUS", "sk-test", None)
    assert isinstance(p, AnthropicProvider)


def test_gemini_prefix_case_insensitive():
    """GEMINI/ 大写前缀 → GeminiProvider。"""
    p = get_provider("GEMINI/gemini-1.5", "sk-test", None)
    assert isinstance(p, GeminiProvider)


def test_bare_model_with_uppercase_routes_to_openai():
    """大写裸模型名(无 /)→ OpenAIProvider。"""
    p = get_provider("LLAMA-3", "sk-test", None)
    assert isinstance(p, OpenAIProvider)


# =============================================================================
# api_base 透传
# =============================================================================


def test_api_base_passed_to_anthropic_provider():
    """api_base 透传到 AnthropicProvider.base_url。"""
    p = get_provider("claude-3", "sk", "https://custom.anthropic.com")
    assert isinstance(p, AnthropicProvider)
    assert p.base_url == "https://custom.anthropic.com"


def test_api_base_none_uses_default_openai_url():
    """api_base=None 时 OpenAIProvider 用默认 https://api.openai.com。"""
    p = get_provider("gpt-4o", "sk", None)
    assert isinstance(p, OpenAIProvider)
    assert p.base_url == "https://api.openai.com"


def test_stepfun_default_base_url_when_api_base_none():
    """stepfun/ + api_base=None 时用默认 https://api.stepfun.com。"""
    p = get_provider("stepfun/step-3", "sk", None)
    assert isinstance(p, StepfunProvider)
    assert p.base_url == "https://api.stepfun.com"
