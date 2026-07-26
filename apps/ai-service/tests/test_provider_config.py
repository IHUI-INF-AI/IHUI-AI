"""ProviderConfig 强类型 + get_provider_config 向后兼容单测(2026-07-26 阶段 2).

覆盖场景:
1. get_provider_config 返回强类型 ProviderConfig(不再是 dict)
2. 旧扁平字段(无 llm_providers JSON)仍能工作,返回有效 ProviderConfig
3. LLM_PROVIDERS_JSON 存在时优先使用 JSON 配置(强类型校验 + 字段映射)
4. api_base 末尾斜杠自动去除(避免拼接 //v1 双斜杠)
5. JSON 解析失败时降级到扁平字段(不抛异常)
6. 未知 provider 返回空 ProviderConfig(不抛 KeyError)
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.provider_config import ProviderConfig


# =============================================================================
# 1. get_provider_config 返回类型强类型化
# =============================================================================


def test_get_provider_config_returns_strong_type():
    """get_provider_config 必须返回 ProviderConfig 而非 dict。"""
    s = Settings()
    cfg = s.get_provider_config("openai")
    assert isinstance(cfg, ProviderConfig), (
        f"expected ProviderConfig, got {type(cfg).__name__}"
    )
    # 强类型字段访问(不再是 dict.get)
    assert hasattr(cfg, "api_key")
    assert hasattr(cfg, "api_base")
    assert hasattr(cfg, "enabled")
    assert hasattr(cfg, "models")
    assert hasattr(cfg, "default_model")
    # 默认值
    assert isinstance(cfg.api_key, str)
    assert cfg.enabled is True
    assert isinstance(cfg.models, list)


# =============================================================================
# 2. 向后兼容:旧扁平字段(无 llm_providers)仍工作
# =============================================================================


def test_provider_config_backward_compat_flat_field(monkeypatch):
    """旧扁平字段(无 llm_providers JSON)仍能工作,降级为 ProviderConfig 实例。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    s = Settings()
    # 即便 api_key 为空(conftest autouse fixture 已清空),也要返回有效 ProviderConfig
    cfg = s.get_provider_config("openai")
    assert cfg is not None
    assert isinstance(cfg, ProviderConfig)
    assert isinstance(cfg.api_key, str)
    # api_base 可能为 None(扁平字段无该 provider 时)
    assert cfg.api_base is None or isinstance(cfg.api_base, str)


def test_provider_config_backward_compat_with_flat_api_key(monkeypatch):
    """旧扁平字段存在 OPENAI_API_KEY 时,降级路径能正确读取。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-flat-legacy-key")
    s = Settings()
    cfg = s.get_provider_config("openai")
    assert isinstance(cfg, ProviderConfig)
    assert cfg.api_key == "sk-flat-legacy-key"


def test_provider_config_backward_compat_with_api_base(monkeypatch):
    """旧扁平字段 AGNES_API_BASE 也能降级读取(agnes 是有 api_base 字段的 7 个 provider 之一)。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    monkeypatch.setenv("AGNES_API_BASE", "https://legacy.api.example.com/v1")
    s = Settings()
    cfg = s.get_provider_config("agnes")
    assert isinstance(cfg, ProviderConfig)
    # ProviderConfig 自动去除末尾 /
    assert cfg.api_base == "https://legacy.api.example.com/v1"


# =============================================================================
# 3. LLM_PROVIDERS_JSON 优先(阶段 2 主路径)
# =============================================================================


def test_provider_config_json_override_takes_priority(monkeypatch):
    """当 LLM_PROVIDERS 存在时,优先使用 JSON 配置。"""
    monkeypatch.setenv(
        "LLM_PROVIDERS",
        '{"openai":{"api_key":"sk-test","api_base":"https://custom.api/v1","default_model":"gpt-4o"}}',
    )
    s = Settings()
    cfg = s.get_provider_config("openai")
    assert cfg.api_key == "sk-test"
    assert cfg.api_base == "https://custom.api/v1"
    assert cfg.default_model == "gpt-4o"
    assert cfg.enabled is True


def test_provider_config_json_strips_trailing_slash(monkeypatch):
    """JSON 中的 api_base 末尾 / 应被 ProviderConfig 自动去除。"""
    monkeypatch.setenv(
        "LLM_PROVIDERS",
        '{"openai":{"api_key":"sk","api_base":"https://api.example.com/v1/"}}',
    )
    s = Settings()
    cfg = s.get_provider_config("openai")
    assert cfg.api_base == "https://api.example.com/v1"


def test_provider_config_json_partial_fields(monkeypatch):
    """JSON 仅含部分字段时,缺省值由 Pydantic 提供(enabled=True, models=[])."""
    monkeypatch.setenv(
        "LLM_PROVIDERS",
        '{"anthropic":{"api_key":"sk-ant"}}',
    )
    s = Settings()
    cfg = s.get_provider_config("anthropic")
    assert cfg.api_key == "sk-ant"
    assert cfg.api_base is None
    assert cfg.enabled is True
    assert cfg.models == []


# =============================================================================
# 4. 错误处理:JSON 解析失败降级 + 未知 provider 返回空
# =============================================================================


def test_provider_config_json_invalid_fallback_to_flat(monkeypatch, caplog):
    """JSON 解析失败时降级到扁平字段,不抛异常。"""
    monkeypatch.setenv("LLM_PROVIDERS", "{invalid json")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fallback")
    s = Settings()
    cfg = s.get_provider_config("openai")
    # 降级到扁平字段
    assert isinstance(cfg, ProviderConfig)
    assert cfg.api_key == "sk-fallback"


def test_provider_config_unknown_provider_returns_empty(monkeypatch):
    """未知 provider 返回空 ProviderConfig(不抛 KeyError)。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    s = Settings()
    cfg = s.get_provider_config("nonexistent_provider_xyz")
    assert isinstance(cfg, ProviderConfig)
    assert cfg.api_key == ""
    assert cfg.api_base is None


# =============================================================================
# 5. ProviderConfig 模型独立校验
# =============================================================================


def test_provider_config_model_basic():
    """ProviderConfig 基本构造 + 默认值。"""
    cfg = ProviderConfig()
    assert cfg.api_key == ""
    assert cfg.api_base is None
    assert cfg.enabled is True
    assert cfg.models == []
    assert cfg.default_model is None


def test_provider_config_model_with_fields():
    """ProviderConfig 显式构造 + 字段赋值。"""
    cfg = ProviderConfig(
        api_key="sk-test",
        api_base="https://api.example.com/v1",
        enabled=False,
        models=["gpt-4o", "gpt-4o-mini"],
        default_model="gpt-4o",
    )
    assert cfg.api_key == "sk-test"
    assert cfg.api_base == "https://api.example.com/v1"
    assert cfg.enabled is False
    assert cfg.models == ["gpt-4o", "gpt-4o-mini"]
    assert cfg.default_model == "gpt-4o"


def test_provider_config_strips_trailing_slash():
    """api_base 末尾 / 应被自动去除(独立 model 校验)。"""
    cfg = ProviderConfig(api_base="https://api.example.com/v1/")
    assert cfg.api_base == "https://api.example.com/v1"

    cfg2 = ProviderConfig(api_base="https://api.example.com")
    assert cfg2.api_base == "https://api.example.com"

    cfg3 = ProviderConfig(api_base=None)
    assert cfg3.api_base is None


# =============================================================================
# 6. 24 个 LLM provider 独立 happy path 单测(2026-07-26 阶段 2 扩展)
# =============================================================================
# 覆盖 config.py L48-110 所有 *_api_key 字段对应的 provider name(仅含 api_key 字段、
# 不含 api_base 字段的 24 个 provider)。
# 验证 get_provider_config(name) 对每个 provider 都能返回有效 ProviderConfig。
#
# 24 provider 列表(按字母排序,字段名 = provider_name + "_api_key"):
#   openai / anthropic / gemini / groq / openrouter
#   cloudflare (alias: cloudflare_api_token)
#   nvidia / github (alias: github_token) / vercel (alias: vercel_ai_gateway_key)
#   opencode (alias: opencode_zen_key)
#   modal / inference_net / nlp_cloud / scaleway / alibaba_intl
#   cerebras / mistral / cohere / huggingface / zai
#   reka / routeway / bazaarlink / ainative
PROVIDERS_WITH_API_KEY_ONLY: list[str] = [
    "openai",
    "anthropic",
    "gemini",
    "groq",
    "openrouter",
    "cloudflare",  # alias → cloudflare_api_token
    "nvidia",
    "github",  # alias → github_token
    "vercel",  # alias → vercel_ai_gateway_key
    "opencode",  # alias → opencode_zen_key
    "modal",
    "inference_net",
    "nlp_cloud",
    "scaleway",
    "alibaba_intl",
    "cerebras",
    "mistral",
    "cohere",
    "huggingface",
    "zai",
    "reka",
    "routeway",
    "bazaarlink",
    "ainative",
]


@pytest.mark.parametrize("provider", PROVIDERS_WITH_API_KEY_ONLY)
def test_get_provider_config_happy_path_each_api_key_provider(provider):
    """每个有 api_key 字段的 provider:get_provider_config 必须返回有效 ProviderConfig。

    不依赖 env/.env 状态(autouse fixture _isolate_llm_env 已清空所有 key),
    即便 provider 在 .env 中没设任何 key,也能返回结构正确的 ProviderConfig。
    """
    s = Settings()
    cfg = s.get_provider_config(provider)
    assert isinstance(cfg, ProviderConfig), (
        f"provider={provider}: expected ProviderConfig, got {type(cfg).__name__}"
    )
    # 强类型字段访问(Pydantic BaseModel)
    assert hasattr(cfg, "api_key")
    assert hasattr(cfg, "api_base")
    assert hasattr(cfg, "enabled")
    assert hasattr(cfg, "models")
    assert hasattr(cfg, "default_model")
    # 字段类型校验
    assert isinstance(cfg.api_key, str)
    # 这 24 个 provider 无 api_base 字段,getattr 返回 None
    assert cfg.api_base is None
    assert isinstance(cfg.enabled, bool)
    assert isinstance(cfg.models, list)
    # enabled 默认 True
    assert cfg.enabled is True
    # models 默认空列表
    assert cfg.models == []


@pytest.mark.parametrize("provider", PROVIDERS_WITH_API_KEY_ONLY)
def test_provider_config_returns_str_provider_structure(provider, monkeypatch):
    """每个 provider:get_provider_config 返回的 cfg 必须有 str 类型 api_key 字段。

    不强求 api_key 为空字符串(取决于 .env 是否有真实 key),
    只验证 cfg 结构正确 + 字段类型 + Pydantic 强类型访问可用。
    这是 Pydantic ProviderConfig 替代 dict 的核心契约。
    """
    # 清空 JSON 路径,确保走扁平字段降级路径
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    s = Settings()
    cfg = s.get_provider_config(provider)
    assert isinstance(cfg, ProviderConfig)
    # api_key 必须是 str(Pydantic 类型约束,旧 dict 可能返回 None)
    assert isinstance(cfg.api_key, str), (
        f"provider={provider}: api_key type={type(cfg.api_key).__name__}, expected str"
    )
    # 默认值字段(Pydantic 强类型访问)
    assert cfg.enabled is True
    assert isinstance(cfg.models, list)
    assert cfg.models == []
    assert cfg.default_model is None
    # api_base 对这 24 个无该字段的 provider 应为 None
    assert cfg.api_base is None


# =============================================================================
# 7. 7 个 api_base provider 独立 happy path 单测(2026-07-26 阶段 2 扩展)
# =============================================================================
# config.py L48-110 含 api_base 字段的 7 个 provider:
#   agnes / stepfun(同时有 api_key)
#   kilo / pollinations / ovh(纯 keyless,仅 api_base)
#   llm7 / aihorde(api_key 可选/默认匿名,api_base 有默认值)
#
# 验证:get_provider_config(name) 对每个 provider 都能返回有效 ProviderConfig,
# 且 api_base 字段(有默认值时)是合法 URL 字符串(自动 strip 末尾 /)。
PROVIDERS_WITH_API_BASE: list[str] = [
    "agnes",
    "stepfun",
    "kilo",  # keyless,仅 api_base
    "pollinations",  # keyless,仅 api_base
    "llm7",  # api_key 可选
    "ovh",  # keyless,仅 api_base
    "aihorde",  # api_key 默认匿名 0000000000
]


@pytest.mark.parametrize("provider", PROVIDERS_WITH_API_BASE)
def test_get_provider_config_happy_path_each_api_base_provider(provider):
    """每个有 api_base 字段的 provider:get_provider_config 必须返回有效 ProviderConfig,
    且 api_base 字段(若有值)必须是合法 URL 字符串。"""
    s = Settings()
    cfg = s.get_provider_config(provider)
    assert isinstance(cfg, ProviderConfig), (
        f"provider={provider}: expected ProviderConfig, got {type(cfg).__name__}"
    )
    # 强类型字段访问
    assert hasattr(cfg, "api_key")
    assert hasattr(cfg, "api_base")
    assert hasattr(cfg, "enabled")
    assert hasattr(cfg, "models")
    # 字段类型校验
    assert isinstance(cfg.api_key, str)
    # api_base 可能是 str(有默认值)或 None(扁平字段无该 provider)
    assert cfg.api_base is None or isinstance(cfg.api_base, str)
    # 若 api_base 有值,应不包含末尾 / (ProviderConfig 自动 strip)
    if cfg.api_base is not None:
        assert not cfg.api_base.endswith("/"), (
            f"provider={provider}: api_base={cfg.api_base} should not end with /"
        )
    # enabled 默认 True
    assert cfg.enabled is True
    # models 默认空列表
    assert cfg.models == []


@pytest.mark.parametrize("provider", PROVIDERS_WITH_API_BASE)
def test_provider_config_api_base_strips_trailing_slash_via_env(provider, monkeypatch):
    """设置 *_API_BASE 带末尾 / 时,get_provider_config 返回的 api_base 应被 ProviderConfig 自动 strip。

    模拟 .env 配置文件传入带末尾 / 的 url(常见 copy-paste 错误),
    验证 Pydantic field_validator 兜底逻辑生效。
    """
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    # 7 个 provider 的 env var 命名都是 {NAME}_API_BASE(全大写)
    env_key = f"{provider.upper()}_API_BASE"
    test_url = f"https://test.{provider}.example.com/v1/"
    monkeypatch.setenv(env_key, test_url)
    s = Settings()
    cfg = s.get_provider_config(provider)
    assert isinstance(cfg, ProviderConfig)
    # 末尾 / 应被自动 strip
    if cfg.api_base is not None:
        assert cfg.api_base == test_url.rstrip("/"), (
            f"provider={provider}: expected {test_url.rstrip('/')!r}, "
            f"got {cfg.api_base!r}"
        )


# =============================================================================
# 7. fallback 路径 DeprecationWarning 测试(2026-07-26 阶段 3 前置)
# =============================================================================


def test_fallback_path_emits_deprecation_warning(monkeypatch):
    """fallback 路径(无 LLM_PROVIDERS,有扁平字段)应触发 DeprecationWarning。"""
    import app.core.config as config_module
    # 重置模块级 _warned_providers(避免跨测试污染)
    config_module._warned_providers.clear()

    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-flat-legacy-key")
    s = Settings()

    import warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        cfg = s.get_provider_config("openai")

    assert cfg.api_key == "sk-flat-legacy-key"
    deprecation_warnings = [x for x in w if issubclass(x.category, DeprecationWarning)]
    assert len(deprecation_warnings) >= 1, "fallback 路径必须触发 DeprecationWarning"
    msg = str(deprecation_warnings[0].message)
    assert "openai" in msg
    assert "LLM_PROVIDERS" in msg or "flat-field" in msg.lower()


def test_json_path_does_not_emit_deprecation_warning(monkeypatch):
    """JSON 优先路径不应触发 DeprecationWarning(只在 fallback 路径触发)。"""
    import app.core.config as config_module
    config_module._warned_providers.clear()

    monkeypatch.setenv(
        "LLM_PROVIDERS",
        '{"openai":{"api_key":"sk-test","api_base":"https://custom.api/v1"}}',
    )
    s = Settings()

    import warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        cfg = s.get_provider_config("openai")

    assert cfg.api_key == "sk-test"
    deprecation_warnings = [x for x in w if issubclass(x.category, DeprecationWarning)]
    assert len(deprecation_warnings) == 0, "JSON 路径不应触发 DeprecationWarning"


def test_fallback_warning_dedup_per_provider(monkeypatch):
    """同一 provider 多次调用只 warn 一次(避免日志噪音)。"""
    import app.core.config as config_module
    config_module._warned_providers.clear()

    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-flat-legacy-key")
    s = Settings()

    import warnings
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        s.get_provider_config("openai")
        s.get_provider_config("openai")  # 第二次,不应再 warn
        s.get_provider_config("openai")  # 第三次,不应再 warn

    deprecation_warnings = [x for x in w if issubclass(x.category, DeprecationWarning)]
    assert len(deprecation_warnings) == 1, f"同一 provider 应只 warn 一次,实际 {len(deprecation_warnings)}"
