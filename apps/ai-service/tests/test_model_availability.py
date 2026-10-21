# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


def test_bare_agnes_model_ids_infer_provider() -> None:
    """agnes 官方回裸名(agnes-3.0-flash),表里只有 `agnes/` 会让整家被判"未知 provider"而不出现在 /llm/models。"""
    from app.services.model_availability import _infer_provider_code

    assert _infer_provider_code("agnes-3.0-flash") == "agnes"
    assert _infer_provider_code("agnes-2.5-pro") == "agnes"
    assert _infer_provider_code("agnes-image-2.5-flash") == "agnes"
    assert _infer_provider_code("agnes/agnes-2.5-flash") == "agnes"


# --- 刷新分派:扁平 env key 的 provider 不许被藏(2026-10-21 事故钉子) ---


async def test_flat_env_key_provider_is_pinged_not_hidden(monkeypatch):
    """key 只配在扁平 .env 键(STEPFUN_API_KEY 等)、LLM_PROVIDERS JSON 为空时,
    旧判据把整家标 NOT_CONFIGURED → is_model_available 藏掉,而网关按同一 env 键
    能调通("能调通的没显示")。修复后必须把 env 里的真实 key 交给 ping,
    健康状态由实测说话;env key 缺失时才维持跳过。"""
    import app.services.model_availability as ma
    from app.core.config import settings
    from app.services.local_provider_health import (
        LocalProbeResult,
        LocalProbeVerdict,
        local_provider_health,
    )

    monkeypatch.setattr(settings, "llm_providers", "")
    monkeypatch.setenv("STEPFUN_API_KEY", "sk-test-flat-env-key")

    pinged: list[tuple[str, str, str]] = []

    async def _fake_ping(self, code, api_key, api_base):
        pinged.append((code, api_key, api_base))
        return ma.ProviderHealth(
            status=ma.ProviderHealthStatus.HEALTHY, last_check=1.0
        )

    async def _fake_probe(code, **kwargs):
        return LocalProbeResult(verdict=LocalProbeVerdict.UNDETERMINED, detail="mocked")

    monkeypatch.setattr(ma.ModelAvailabilityService, "_ping_provider_v2", _fake_ping)
    monkeypatch.setattr(local_provider_health, "probe", _fake_probe)

    ma.model_availability._health.clear()
    try:
        await ma.model_availability._refresh_all_providers()
        # 正向:env key 原样进了 ping(ping 收到真钥匙,不是被标 NOT_CONFIGURED)
        entry = next(p for p in pinged if p[0] == "stepfun")
        assert entry[1] == "sk-test-flat-env-key"
        assert entry[2], "ping 的 api_base 不应为空"
        health = ma.model_availability._health["stepfun"]
        assert health.status == ma.ProviderHealthStatus.HEALTHY
        assert health.error_type == ma.ProviderErrorType.NONE

        # 反向(变异自证):摘掉 env key,stepfun 回到"未配置"格 —— 不入 ping、
        # is_model_available False,证明正向断言不是恒真
        monkeypatch.delenv("STEPFUN_API_KEY", raising=False)
        pinged.clear()
        ma.model_availability._health.clear()
        await ma.model_availability._refresh_all_providers()
        assert all(p[0] != "stepfun" for p in pinged)
        assert ma.model_availability.is_model_available("stepfun/step-3.7-flash") is False
    finally:
        ma.model_availability._health.clear()
