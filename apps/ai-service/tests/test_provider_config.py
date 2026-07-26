"""ProviderConfig 强类型 + get_provider_config JSON 路径单测(2026-07-26 阶段 3 主体).

覆盖场景:
1. get_provider_config 返回强类型 ProviderConfig
2. LLM_PROVIDERS JSON 配置优先(阶段 3 主体:唯一路径)
3. api_base 末尾斜杠自动去除(避免拼接 //v1 双斜杠)
4. JSON 解析失败时返回空 ProviderConfig(不抛异常)
5. 未知 provider 返回空 ProviderConfig(不抛 KeyError)
6. ProviderConfig 模型独立校验
"""

from __future__ import annotations

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
# 2. LLM_PROVIDERS JSON 配置(阶段 3 主体:唯一路径)
# =============================================================================


def test_provider_config_json_override_takes_priority(monkeypatch):
    """当 LLM_PROVIDERS 存在时,使用 JSON 配置(阶段 3 主体:唯一路径)。"""
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
# 3. 错误处理:JSON 解析失败 + 未知 provider + 空 LLM_PROVIDERS
# =============================================================================


def test_provider_config_json_invalid_returns_empty(monkeypatch):
    """JSON 解析失败时返回空 ProviderConfig,不抛异常。"""
    monkeypatch.setenv("LLM_PROVIDERS", "{invalid json")
    s = Settings()
    cfg = s.get_provider_config("openai")
    assert isinstance(cfg, ProviderConfig)
    assert cfg.api_key == ""
    assert cfg.api_base is None


def test_provider_config_unknown_provider_returns_empty(monkeypatch):
    """未知 provider 返回空 ProviderConfig(不抛 KeyError)。"""
    monkeypatch.setenv("LLM_PROVIDERS", '{"openai":{"api_key":"sk-test"}}')
    s = Settings()
    cfg = s.get_provider_config("nonexistent_provider_xyz")
    assert isinstance(cfg, ProviderConfig)
    assert cfg.api_key == ""
    assert cfg.api_base is None


def test_provider_config_empty_llm_providers_returns_empty(monkeypatch):
    """LLM_PROVIDERS 未配置时返回空 ProviderConfig。"""
    monkeypatch.delenv("LLM_PROVIDERS", raising=False)
    s = Settings()
    cfg = s.get_provider_config("openai")
    assert isinstance(cfg, ProviderConfig)
    assert cfg.api_key == ""
    assert cfg.api_base is None


# =============================================================================
# 4. ProviderConfig 模型独立校验
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
