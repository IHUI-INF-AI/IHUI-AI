"""model_availability 纯逻辑单元测试(2026-08-12 立,补齐 0 覆盖)。

覆盖不依赖网络的纯函数:
- _infer_provider_code: 模型 ID → provider_code 前缀匹配(长前缀优先)
- _to_llm_providers_name: provider_code → LLM_PROVIDERS JSON name 映射
"""

from __future__ import annotations

from app.services.model_availability import (
    _infer_provider_code,
    _to_llm_providers_name,
)


# --- _infer_provider_code ---


def test_infer_provider_code_project_models():
    """主力模型前缀正确映射。"""
    assert _infer_provider_code("stepfun/step-3.7-flash") == "stepfun"
    assert _infer_provider_code("agnes/gpt-4o") == "agnes"


def test_infer_provider_code_special_prefixes():
    """特殊前缀(@cf/cloudflare/nvidia/github/opencode)正确映射。"""
    assert _infer_provider_code("@cf/meta/llama-3.1") == "cloudflare_workers_ai"
    assert _infer_provider_code("cloudflare/deepseek") == "cloudflare_workers_ai"
    assert _infer_provider_code("nvidia/llama-3.1-70b") == "nvidia_nim"
    assert _infer_provider_code("github/gpt-4o-mini") == "github_models"
    assert _infer_provider_code("opencode/big-pickle") == "opencode_zen"


def test_infer_provider_code_case_insensitive():
    """大小写不敏感。"""
    assert _infer_provider_code("STEPFUN/step-1.8v") == "stepfun"


def test_infer_provider_code_unknown_returns_empty():
    """未知 provider 返回空字符串(视为不可显示)。"""
    assert _infer_provider_code("unknown-vendor/anything") == ""
    assert _infer_provider_code("") == ""


def test_infer_provider_code_long_prefix_wins():
    """长前缀优先:cloudflare/ 匹配 cloudflare_workers_ai 而非更短前缀。"""
    # cloudflare/ 在字典中显式存在,直接验证前缀匹配顺序(首个匹配即返回)
    assert _infer_provider_code("cloudflare/xyz") == "cloudflare_workers_ai"


# --- _to_llm_providers_name ---


def test_to_llm_providers_name_mapping():
    """特殊 provider_code 映射到 LLM_PROVIDERS name。"""
    assert _to_llm_providers_name("cloudflare_workers_ai") == "cloudflare"
    assert _to_llm_providers_name("nvidia_nim") == "nvidia"
    assert _to_llm_providers_name("github_models") == "github"
    assert _to_llm_providers_name("opencode_zen") == "opencode"


def test_to_llm_providers_name_identity():
    """未映射的 provider_code 原样返回(大多数与 name 一致)。"""
    assert _to_llm_providers_name("stepfun") == "stepfun"
    assert _to_llm_providers_name("agnes") == "agnes"
