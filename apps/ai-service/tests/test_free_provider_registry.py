"""free_provider_registry.py 单元测试(P0-3b 免费 provider 注册表)。

测试覆盖:
- FreeProvider 数据类构造
- ProviderCategory 枚举(domestic/international/local/credits)
- ProviderStatus 枚举(configured/not_configured/local)
- FreeProviderRegistry:list_all / list_by_category / list_domestic / list_international / list_local / list_credits
- get_by_code / get_default_base_url / get_default_models
- is_key_configured:configured / not_configured / local 三态
- list_configured / list_not_configured(从环境变量检测)
- to_dashboard_dict:含 status 字段
- __len__:30+ provider 覆盖
- 申请链接完整性:每条都有 signup_url
"""

from __future__ import annotations

import os
from unittest.mock import patch

import pytest

from app.services.free_provider_registry import (
    FreeProvider,
    FreeProviderRegistry,
    ProviderCategory,
    ProviderStatus,
    free_provider_registry,
)


# =============================================================================
# FreeProvider 数据类
# =============================================================================


def test_free_provider_construction():
    """FreeProvider 数据类正常构造。"""
    p = FreeProvider(
        provider_code="test",
        display_name="Test Provider",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://example.com",
        free_quota="1M tokens/月",
        rate_limit="60 RPM",
        default_base_url="https://api.example.com/v1",
        key_env_vars=["TEST_API_KEY"],
        default_models=["test-model"],
        protocol="openai_chat",
        docs_url="https://docs.example.com",
        notes="test notes",
    )
    assert p.provider_code == "test"
    assert p.category == ProviderCategory.INTERNATIONAL
    assert p.default_base_url == "https://api.example.com/v1"


def test_provider_category_enum_values():
    """ProviderCategory 枚举 4 个值。"""
    assert ProviderCategory.DOMESTIC.value == "domestic"
    assert ProviderCategory.INTERNATIONAL.value == "international"
    assert ProviderCategory.LOCAL.value == "local"
    assert ProviderCategory.CREDITS.value == "credits"


def test_provider_status_enum_values():
    """ProviderStatus 枚举 3 个值。"""
    assert ProviderStatus.CONFIGURED.value == "configured"
    assert ProviderStatus.NOT_CONFIGURED.value == "not_configured"
    assert ProviderStatus.LOCAL.value == "local"


# =============================================================================
# 注册表覆盖(30+ provider)
# =============================================================================


def test_registry_has_30_plus_providers():
    """注册表含 30+ 免费 provider(超越 OmniRoute 18 个)。"""
    assert len(free_provider_registry) >= 30


def test_registry_signup_url_complete():
    """每条 provider 都有 signup_url(申请入口完整性)。"""
    for p in free_provider_registry.list_all():
        assert p.signup_url, f"provider {p.provider_code} 缺 signup_url"
        assert p.signup_url.startswith("http"), f"provider {p.provider_code} signup_url 非 http(s)"


def test_registry_default_models_not_empty():
    """每条 provider 都有推荐模型。"""
    for p in free_provider_registry.list_all():
        assert p.default_models, f"provider {p.provider_code} 缺 default_models"
        assert len(p.default_models) > 0


def test_registry_display_name_not_empty():
    """每条 provider 都有展示名。"""
    for p in free_provider_registry.list_all():
        assert p.display_name, f"provider {p.provider_code} 缺 display_name"


# =============================================================================
# 按分类查询
# =============================================================================


def test_list_by_category():
    """list_by_category 按分类过滤。"""
    domestic = free_provider_registry.list_by_category(ProviderCategory.DOMESTIC)
    for p in domestic:
        assert p.category == ProviderCategory.DOMESTIC


def test_list_domestic():
    """list_domestic 返回国内 provider。"""
    domestic = free_provider_registry.list_domestic()
    assert len(domestic) >= 5  # 至少 5 个国内 provider
    codes = [p.provider_code for p in domestic]
    assert "moonshot" in codes
    assert "zhipu" in codes
    assert "deepseek" in codes


def test_list_international():
    """list_international 返回国际 provider。"""
    intl = free_provider_registry.list_international()
    assert len(intl) >= 5
    codes = [p.provider_code for p in intl]
    assert "groq" in codes
    assert "mistral" in codes


def test_list_local():
    """list_local 返回本地 LLM(无需 key)。"""
    local = free_provider_registry.list_local()
    assert len(local) >= 3  # 至少 ollama / lmstudio / llamacpp
    codes = [p.provider_code for p in local]
    assert "ollama" in codes
    assert "lmstudio" in codes


def test_list_credits():
    """list_credits 返回试用 credits provider。"""
    credits = free_provider_registry.list_credits()
    assert len(credits) >= 3
    codes = [p.provider_code for p in credits]
    assert "togetherai" in codes


# =============================================================================
# 按 provider_code 查询
# =============================================================================


def test_get_by_code_hit():
    """get_by_code 命中。"""
    p = free_provider_registry.get_by_code("moonshot")
    assert p is not None
    assert p.display_name == "Moonshot Kimi(月之暗面)"
    assert p.default_base_url == "https://api.moonshot.cn/v1"


def test_get_by_code_miss():
    """get_by_code 未命中返回 None。"""
    assert free_provider_registry.get_by_code("nonexistent") is None


def test_get_default_base_url():
    """get_default_base_url 返回默认 base_url。"""
    url = free_provider_registry.get_default_base_url("groq")
    assert url == "https://api.groq.com/openai/v1"


def test_get_default_base_url_miss():
    """get_default_base_url 未命中返回 None。"""
    assert free_provider_registry.get_default_base_url("nonexistent") is None


def test_get_default_models():
    """get_default_models 返回推荐模型列表。"""
    models = free_provider_registry.get_default_models("zhipu")
    assert "glm-4-flash" in models


def test_get_default_models_miss():
    """get_default_models 未命中返回空列表。"""
    assert free_provider_registry.get_default_models("nonexistent") == []


# =============================================================================
# is_key_configured(从环境变量检测)
# =============================================================================


def test_is_key_configured_local_provider():
    """本地 LLM(ollama)返回 LOCAL 状态。"""
    status = free_provider_registry.is_key_configured("ollama")
    assert status == ProviderStatus.LOCAL


def test_is_key_configured_not_configured():
    """未配置 key 的 provider 返回 NOT_CONFIGURED。"""
    # 清空环境变量确保测试稳定
    with patch.dict(os.environ, {}, clear=False):
        for k in ("MOONSHOT_API_KEY",):
            os.environ.pop(k, None)
        status = free_provider_registry.is_key_configured("moonshot")
        assert status == ProviderStatus.NOT_CONFIGURED


def test_is_key_configured_configured():
    """已配置 key 的 provider 返回 CONFIGURED。"""
    with patch.dict(os.environ, {"MOONSHOT_API_KEY": "sk-test"}):
        status = free_provider_registry.is_key_configured("moonshot")
        assert status == ProviderStatus.CONFIGURED


def test_is_key_configured_unknown_provider():
    """未知 provider 返回 NOT_CONFIGURED。"""
    assert free_provider_registry.is_key_configured("nonexistent") == ProviderStatus.NOT_CONFIGURED


# =============================================================================
# list_configured / list_not_configured
# =============================================================================


def test_list_configured_returns_only_configured():
    """list_configured 只返回 CONFIGURED 状态的 provider。"""
    with patch.dict(os.environ, {}, clear=False):
        # 清空所有 key 确保测试稳定
        for k in list(os.environ.keys()):
            if k.endswith("_API_KEY") or k.endswith("_API_TOKEN") or k.endswith("_TOKEN"):
                os.environ.pop(k, None)
        configured = free_provider_registry.list_configured()
        # 本地 LLM 不算 configured(算 local),应不在 configured 列表
        codes = [p.provider_code for p in configured]
        assert "ollama" not in codes


def test_list_not_configured_excludes_local():
    """list_not_configured 排除 LOCAL 状态的 provider。"""
    not_configured = free_provider_registry.list_not_configured()
    codes = [p.provider_code for p in not_configured]
    # 本地 LLM 不在 not_configured 列表(它们是 LOCAL 状态)
    assert "ollama" not in codes
    assert "lmstudio" not in codes


# =============================================================================
# to_dashboard_dict
# =============================================================================


def test_to_dashboard_dict_structure():
    """to_dashboard_dict 返回含 status 字段的 list[dict]。"""
    dashboard = free_provider_registry.to_dashboard_dict()
    assert len(dashboard) >= 30
    for item in dashboard:
        assert "provider_code" in item
        assert "display_name" in item
        assert "category" in item
        assert "signup_url" in item
        assert "status" in item
        assert item["status"] in ("configured", "not_configured", "local")


def test_to_dashboard_dict_local_status():
    """to_dashboard_dict 中本地 LLM status=local。"""
    dashboard = free_provider_registry.to_dashboard_dict()
    ollama = next(p for p in dashboard if p["provider_code"] == "ollama")
    assert ollama["status"] == "local"


# =============================================================================
# 关键 provider 存在性验证(国内 / 国际 / credits / local 四类各 1+)
# =============================================================================


def test_moonshot_exists():
    """Moonshot Kimi(国内免费长上下文)在注册表中。"""
    p = free_provider_registry.get_by_code("moonshot")
    assert p is not None
    assert "kimi-k2" in p.default_models


def test_zhipu_free_model_exists():
    """智谱 glm-4-flash 永久免费模型在注册表中。"""
    p = free_provider_registry.get_by_code("zhipu")
    assert p is not None
    assert "glm-4-flash" in p.default_models


def test_stepfun_configured_in_registry():
    """阶跃星辰 stepfun(项目已配置 plan 套餐)在注册表中。"""
    p = free_provider_registry.get_by_code("stepfun")
    assert p is not None
    assert "stepfun/step-3.7-flash" in p.default_models


def test_ollama_local_no_key_required():
    """Ollama 本地 LLM 无需 key(key_env_vars 为空)。"""
    p = free_provider_registry.get_by_code("ollama")
    assert p is not None
    assert p.category == ProviderCategory.LOCAL
    assert p.key_env_vars == []


def test_custom_registry_injection():
    """支持自定义 registry 注入(便于测试)。"""
    custom = [FreeProvider(
        provider_code="custom",
        display_name="Custom",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://custom.example.com",
        free_quota="test",
    )]
    reg = FreeProviderRegistry(registry=custom)
    assert len(reg) == 1
    assert reg.get_by_code("custom") is not None
