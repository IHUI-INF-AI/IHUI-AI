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
    # 2026-10-26:例子从 stepfun 换成 groq —— stepfun 已永久退役(退役厂商不再参与
    # 探测,见本文件末尾的退役厂商除名用例);本用例的立意是"扁平 env key 的 provider
    # 不许被藏",与厂商身份无关,换一个未退役且在 provider 前缀表内的厂商即可。
    monkeypatch.setenv("GROQ_API_KEY", "sk-test-flat-env-key")

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
        entry = next(p for p in pinged if p[0] == "groq")
        assert entry[1] == "sk-test-flat-env-key"
        assert entry[2], "ping 的 api_base 不应为空"
        health = ma.model_availability._health["groq"]
        assert health.status == ma.ProviderHealthStatus.HEALTHY
        assert health.error_type == ma.ProviderErrorType.NONE

        # 反向(变异自证):摘掉 env key,groq 回到"未配置"格 —— 不入 ping、
        # is_model_available False,证明正向断言不是恒真
        monkeypatch.delenv("GROQ_API_KEY", raising=False)
        pinged.clear()
        ma.model_availability._health.clear()
        await ma.model_availability._refresh_all_providers()
        assert all(p[0] != "groq" for p in pinged)
        assert ma.model_availability.is_model_available("groq/llama-3.3-70b-versatile") is False
    finally:
        ma.model_availability._health.clear()


# --- 永久退役厂商的除名(2026-10-26 机主令) ---
#
# 机主原话:「这些key我想配自然会配 别总说 也别报警」+ stepfun 永久除名。
# 退役要同时管住三个面:同步面(不拉清单)/可用性面(不 ping、不进模型列表)/
# 面板面(管理端不列)。名单只允许一份(core.default_model),否则三面各抄一份必漂移。


def test_retired_provider_list_is_single_source():
    """退役名单只有一份:同步面直接取核心面那份,不是各抄一份。"""
    from app.core.default_model import RETIRED_MODEL_PREFIXES, RETIRED_PROVIDERS
    from app.services import model_sync

    assert model_sync.RETIRED_PROVIDERS is RETIRED_PROVIDERS, (
        "同步面与核心面必须是同一份名单对象(不是等值的两份拷贝)"
    )
    assert {f"{code}/" for code in RETIRED_PROVIDERS} == set(RETIRED_MODEL_PREFIXES), (
        "provider 名单与模型前缀表必须一一对应"
    )


def test_is_retired_provider_by_code():
    """provider_code 维度的退役判定(大小写不敏感;空值不判退役)。"""
    from app.core.default_model import is_retired_provider

    assert is_retired_provider("stepfun") is True
    assert is_retired_provider("STEPFUN") is True
    assert is_retired_provider("agnes") is False
    assert is_retired_provider("") is False
    assert is_retired_provider(None) is False


async def test_retired_provider_is_not_pinged(monkeypatch):
    """退役厂商不参与探测 ⇒ 不再每 5 分钟往日志/面板写「余额不足…需充值」。"""
    import app.services.model_availability as ma
    from app.core.config import settings
    from app.services.local_provider_health import (
        LocalProbeResult,
        LocalProbeVerdict,
        local_provider_health,
    )

    monkeypatch.setattr(settings, "llm_providers", "")
    monkeypatch.setenv("STEPFUN_API_KEY", "sk-test-retired-provider")

    pinged: list[tuple[str, str, str]] = []

    async def _fake_ping(self, code, api_key, api_base):
        pinged.append((code, api_key, api_base))
        return ma.ProviderHealth(status=ma.ProviderHealthStatus.HEALTHY, last_check=1.0)

    async def _fake_probe(code, **kwargs):
        return LocalProbeResult(verdict=LocalProbeVerdict.UNDETERMINED, detail="mocked")

    monkeypatch.setattr(ma.ModelAvailabilityService, "_ping_provider_v2", _fake_ping)
    monkeypatch.setattr(local_provider_health, "probe", _fake_probe)

    ma.model_availability._health.clear()
    try:
        await ma.model_availability._refresh_all_providers()
        assert all(p[0] != "stepfun" for p in pinged), "退役厂商仍在被 ping"
        assert "stepfun" not in ma.model_availability._health, "退役厂商仍在健康缓存里"
        # 模型列表里也不再出现退役厂商的模型
        assert ma.model_availability.is_model_available("stepfun/step-3.7-flash") is False
    finally:
        ma.model_availability._health.clear()


async def test_retired_provider_not_in_providers_health_panel(monkeypatch):
    """管理端 provider 健康面板不列退役厂商(且确实预检过非退役厂商,断言不恒真)。"""
    import json

    from app.core.config import settings
    from app.routers import llm as llm_router

    monkeypatch.setattr(
        settings,
        "llm_providers",
        json.dumps(
            {
                "stepfun": {"api_key": "sk-retired", "api_base": "https://api.stepfun.com"},
                "groq": {"api_key": "sk-live", "api_base": "https://api.groq.com/openai/v1"},
            }
        ),
    )

    checked: list[str] = []

    async def _fake_check(provider_name, api_key, api_base, client):
        checked.append(provider_name)
        return {
            "provider": provider_name,
            "status": "ok",
            "latency_ms": 1,
            "model_count": 1,
            "error": None,
        }

    monkeypatch.setattr(llm_router, "_check_single_provider", _fake_check)

    resp = await llm_router.list_providers_health()
    codes = [p["provider"] for p in resp["data"]["providers"]]
    assert "stepfun" not in codes, f"管理端面板仍列着退役厂商:{codes}"
    assert "groq" in codes, "非退役厂商必须仍在面板里(否则本断言恒真)"
    assert "stepfun" not in checked, "退役厂商仍被主动预检"


def test_ping_resolves_sync_proxy(monkeypatch):
    """ping 必须与同步同用一套出网判据:专用代理表→全局 SYNC_PROXY_URL→直连。

    立测背景(2026-10-26):huggingface 直连被网络封锁(curl 超时)、经 7897 可达(200),
    但 _ping_provider_v2 建 AsyncClient 时没传 proxy,把可达厂商误判 DOWN→
    LlmProviderUnhealthy 误报。此测钉住判据,变异自证:删 proxy= 传参即红。
    """
    import httpx as _httpx

    from app.services import model_availability as ma

    captured: dict = {}

    class _BoomClient:
        def __init__(self, **kw):
            captured.clear()
            captured.update(kw)

        async def __aenter__(self):
            raise _httpx.ConnectError("boom")

        async def __aexit__(self, *a):
            return False

    monkeypatch.setattr(ma.httpx, "AsyncClient", _BoomClient)
    monkeypatch.setattr(ma.settings, "sync_proxy_url", "http://127.0.0.1:7897")
    monkeypatch.setattr(
        ma.settings, "sync_proxy_url_by_provider", {"huggingface": "http://127.0.0.1:7898"}
    )

    svc = ma.ModelAvailabilityService()

    import asyncio

    h = asyncio.run(svc._ping_provider_v2("huggingface", "k", "https://huggingface.co"))
    assert captured.get("proxy") == "http://127.0.0.1:7898", "命中专用代理表却没用专用代理"
    assert h.status == ma.ProviderHealthStatus.DOWN  # ConnectError 语义不变

    asyncio.run(svc._ping_provider_v2("openrouter", "k", "https://openrouter.ai"))
    assert captured.get("proxy") == "http://127.0.0.1:7897", "未命中专用表应回退全局代理"

    monkeypatch.setattr(ma.settings, "sync_proxy_url", "")
    asyncio.run(svc._ping_provider_v2("groq", "k", "https://api.groq.com"))
    assert captured.get("proxy") is None, "全局为空必须直连(None),不得传空串"
