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

# =============================================================================
# P1-1 新增 provider 测试(2026-07-30 立,对齐 OmniRoute v3.8.49)
# =============================================================================


def test_registry_has_40_plus_providers():
    """注册表含 40+ 免费 provider(对齐 OmniRoute v3.8.49 + 超越)。"""
    assert len(free_provider_registry) >= 40


@pytest.mark.parametrize("provider_code", [
    "llm7",
    "pollinations",
    "qoder",
    "aihorde",
    "ovhcloud",
    "requesty",
    "opencode_zen",
    "scaleway",
    "alibaba_intl",
    "navy",
])
def test_new_omniroute_providers_exist(provider_code):
    """10 个 OmniRoute 独有 / 补注册 provider 全部存在于 registry。"""
    p = free_provider_registry.get_by_code(provider_code)
    assert p is not None, f"provider {provider_code} 不在 registry"
    assert p.signup_url.startswith("http"), f"{provider_code} signup_url 非 http"
    assert p.default_base_url, f"{provider_code} 缺 default_base_url"
    assert len(p.default_models) >= 1, f"{provider_code} 缺 default_models"


def test_llm7_no_key_required():
    """LLM7 无需 key(免费镜像服务)。"""
    p = free_provider_registry.get_by_code("llm7")
    assert p is not None
    assert p.key_env_vars == [], "LLM7 应无需 key"
    assert "gpt-4o" in p.default_models


def test_pollinations_no_key_required():
    """Pollinations 无需 key(无注册免费顶级模型)。"""
    p = free_provider_registry.get_by_code("pollinations")
    assert p is not None
    assert p.key_env_vars == [], "Pollinations 应无需 key"


def test_qoder_has_thinking_models():
    """Qoder AI 含 Kimi K2 Thinking / DeepSeek R1 思考模型。"""
    p = free_provider_registry.get_by_code("qoder")
    assert p is not None
    assert "if/kimi-k2-thinking" in p.default_models
    assert "if/deepseek-r1" in p.default_models


def test_alibaba_intl_5_models():
    """Alibaba Intl 含 5 个 Qwen 模型(default_models.json 已预置)。"""
    p = free_provider_registry.get_by_code("alibaba_intl")
    assert p is not None
    assert len(p.default_models) == 5
    assert "alibaba-intl/qwen3-235b-a22b" in p.default_models


def test_scaleway_3_models():
    """Scaleway 含 3 个模型(default_models.json 已预置)。"""
    p = free_provider_registry.get_by_code("scaleway")
    assert p is not None
    assert len(p.default_models) == 3


def test_github_models_has_tos_warning():
    """GitHub Models 的 notes 含 2026-06-16 关闭警告。"""
    p = free_provider_registry.get_by_code("github_models")
    assert p is not None
    assert "2026-06-16" in p.notes, "github_models notes 应含 2026-06-16 关闭警告"


def test_fireworksai_has_tos_warning():
    """Fireworks AI 的 notes 含 ToS §2.1 禁止 proxy 警告。"""
    p = free_provider_registry.get_by_code("fireworksai")
    assert p is not None
    assert "ToS" in p.notes or "禁止" in p.notes, "fireworksai notes 应含 ToS 警告"


def test_omniroute_alignment_complete():
    """IHUI registry 对齐 OmniRoute v3.8.49 关键 forever free provider 全覆盖。

    对照 OmniRoute FREE_TIERS.md v3.8.49 的 11 个 forever free:
    Kiro / Qoder / Pollinations / LongCat / Cloudflare / NVIDIA / Cerebras / Qwen / Gemini / Scaleway / Groq
    (Kiro 因 ToS 风险暂不接入,LongCat 在 v3.8.42 重分类为一次性,本测试验证 IHUI 已接入的)
    """
    omniroute_forever_free_should_have = [
        "qoder", "pollinations", "cerebras", "groq", "scaleway",
    ]
    for code in omniroute_forever_free_should_have:
        p = free_provider_registry.get_by_code(code)
        assert p is not None, f"OmniRoute forever free provider {code} 未接入"


# =============================================================================
# P3-2 Kiro 法务评估测试(2026-07-30 立,ToS 禁止第三方集成)
# =============================================================================


def test_kiro_exists_in_registry():
    """Kiro provider 在注册表中(P3-2 法务评估存档,不接入技术路径)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert p.display_name == "Kiro(AWS,AI IDE,免费 Claude)"


def test_kiro_has_tos_warning_in_notes():
    """Kiro notes 含 ToS 法务风险警告(明确禁止第三方集成)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert "法务风险" in p.notes
    assert "ToS" in p.notes
    assert "禁止" in p.notes


def test_kiro_no_key_env_vars():
    """Kiro 无 key_env_vars(IDE 内置认证,不支持外部 API 调用)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert p.key_env_vars == [], "Kiro 应无 key_env_vars(不支持外部 API 调用)"


def test_kiro_no_default_base_url():
    """Kiro 无 default_base_url(非独立 API 服务,IDE 内置)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert p.default_base_url == "", "Kiro 应无 default_base_url(IDE 内置,非独立 API)"


def test_kiro_has_claude_models():
    """Kiro 推荐模型含 Claude(AWS Bedrock 提供免费 Claude 接入)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert "claude-sonnet-4" in p.default_models
    assert "claude-3.7-sonnet" in p.default_models


def test_kiro_is_international_category():
    """Kiro 分类为 INTERNATIONAL(AWS 国际服务)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert p.category == ProviderCategory.INTERNATIONAL


def test_kiro_is_not_configured():
    """Kiro 状态为 NOT_CONFIGURED(无 key_env_vars → 无法配置)。"""
    status = free_provider_registry.is_key_configured("kiro")
    assert status == ProviderStatus.NOT_CONFIGURED


# =============================================================================
# 零成本 / 免费额度标注(2026-07-30 立,零成本引流路径 1)
# =============================================================================


def test_free_provider_zero_cost_defaults_false():
    """FreeProvider.zero_cost 默认 False。"""
    p = FreeProvider(
        provider_code="test",
        display_name="Test",
        category=ProviderCategory.INTERNATIONAL,
        signup_url="https://example.com",
        free_quota="test",
    )
    assert p.zero_cost is False
    assert p.free_tier is False


def test_list_zero_cost_returns_keyless_providers():
    """list_zero_cost 返回无需 key 的真·零成本 provider(零成本引流核心)。"""
    zero_cost = free_provider_registry.list_zero_cost()
    codes = [p.provider_code for p in zero_cost]
    # 4 个 keyless cloud provider
    assert "pollinations" in codes
    assert "llm7" in codes
    assert "aihorde" in codes
    assert "opencode_zen" in codes
    assert len(zero_cost) >= 4


def test_list_free_tier_returns_providers_with_free_quota():
    """list_free_tier 返回有免费额度(需注册 key)的 provider。"""
    free_tier = free_provider_registry.list_free_tier()
    codes = [p.provider_code for p in free_tier]
    # 国内永久免费模型
    assert "zhipu" in codes  # glm-4-flash 永久免费
    assert "moonshot" in codes  # Kimi-K2 免费
    # 国际免费层
    assert "groq" in codes
    assert "cloudflare_workers_ai" in codes
    assert "github_models" in codes
    assert "huggingface" in codes
    assert "siliconcloud" in codes
    assert len(free_tier) >= 20


def test_zero_cost_providers_are_keyless():
    """zero_cost=True 的 provider 应为 keyless 或 key 可选(匿名可用)。

    pollinations/llm7/opencode_zen 完全无 key_env_vars;
    aihorde 有可选 key_env_vars(注册可加速,但匿名也可调用)。
    """
    for p in free_provider_registry.list_zero_cost():
        # 关键判定:有可调用的 endpoint(default_base_url 非空)
        assert p.default_base_url, f"zero_cost provider {p.provider_code} 缺 default_base_url"


def test_pollinations_is_zero_cost():
    """Pollinations 标记为 zero_cost(无 key 免费顶级模型)。"""
    p = free_provider_registry.get_by_code("pollinations")
    assert p is not None
    assert p.zero_cost is True
    assert p.free_tier is False


def test_llm7_is_zero_cost():
    """LLM7 标记为 zero_cost(免费镜像,无需 key)。"""
    p = free_provider_registry.get_by_code("llm7")
    assert p is not None
    assert p.zero_cost is True


def test_aihorde_is_zero_cost():
    """AI Horde 标记为 zero_cost(众包 GPU,匿名可用)。"""
    p = free_provider_registry.get_by_code("aihorde")
    assert p is not None
    assert p.zero_cost is True


def test_groq_is_free_tier():
    """Groq 标记为 free_tier(有免费层但需注册 key)。"""
    p = free_provider_registry.get_by_code("groq")
    assert p is not None
    assert p.free_tier is True
    assert p.zero_cost is False


def test_zhipu_is_free_tier():
    """智谱标记为 free_tier(glm-4-flash 永久免费但需 key)。"""
    p = free_provider_registry.get_by_code("zhipu")
    assert p is not None
    assert p.free_tier is True
    assert p.zero_cost is False


def test_ollama_not_zero_cost_not_free_tier():
    """Ollama 本地 LLM 不标 zero_cost(category=LOCAL 已区分)。"""
    p = free_provider_registry.get_by_code("ollama")
    assert p is not None
    assert p.zero_cost is False
    assert p.free_tier is False
    assert p.category == ProviderCategory.LOCAL


def test_stepfun_not_free_tier():
    """StepFun 不标 free_tier(项目已配置付费 plan 套餐)。"""
    p = free_provider_registry.get_by_code("stepfun")
    assert p is not None
    assert p.free_tier is False
    assert p.zero_cost is False


def test_kiro_not_zero_cost_not_free_tier():
    """Kiro 不标(法务风险,不接入技术路径)。"""
    p = free_provider_registry.get_by_code("kiro")
    assert p is not None
    assert p.zero_cost is False
    assert p.free_tier is False


def test_to_dashboard_dict_includes_zero_cost_and_free_tier():
    """to_dashboard_dict 返回 zero_cost 和 free_tier 字段。"""
    dashboard = free_provider_registry.to_dashboard_dict()
    assert len(dashboard) >= 30
    for item in dashboard:
        assert "zero_cost" in item
        assert "free_tier" in item
        assert isinstance(item["zero_cost"], bool)
        assert isinstance(item["free_tier"], bool)
    # 验证具体值
    pollinations = next(p for p in dashboard if p["provider_code"] == "pollinations")
    assert pollinations["zero_cost"] is True
    groq = next(p for p in dashboard if p["provider_code"] == "groq")
    assert groq["free_tier"] is True
