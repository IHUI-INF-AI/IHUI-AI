# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票85① 本地 provider 健康探针的渲染级/判定级用例。

唯一要紧的判据:**三态不得互相折叠**。
- 连接拒绝 ⇒ unavailable(可下"没在跑"的结论);
- 超时/异常 ⇒ undetermined(判不了,**不是**"没在跑");
- 没探过 ⇒ snapshot=None(**不是**任何一态)。
is_model_available 与 _local_auto_eligible 的消费格各自钉死在用例里。
"""

from __future__ import annotations

import time

import httpx
import pytest

from app.core.llm_gateway import _local_auto_eligible
from app.services.local_provider_health import (
    LocalProbeResult,
    LocalProbeVerdict,
    local_provider_health,
)
from app.services.model_availability import (
    ProviderHealth,
    ProviderHealthStatus,
    model_availability,
)


def _transport_json(payload: dict, calls: list[str]):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        return httpx.Response(200, json=payload)

    return httpx.MockTransport(handler)


def _transport_error(exc: Exception, calls: list[str]):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(str(request.url))
        raise exc

    return httpx.MockTransport(handler)


@pytest.fixture(autouse=True)
def _clean_cache():
    local_provider_health._cache.clear()
    yield
    local_provider_health._cache.clear()


@pytest.fixture(autouse=True)
def _clear_disabled_list(monkeypatch):
    """2026-10-19:本文件测的是**探测逻辑本身**(URL 形状/三态分类/TTL),
    样本用 ollama/lmstudio 等本地 provider。生产默认禁用清单
    (local_providers_disabled)是部署决策,不该把逻辑单测绑票——
    在此显式清空,让每个用例都回到"未禁用"语义。禁用行为本身的测试在
    test_system_owner_and_local_disabled.py。
    """
    from app.core.config import settings as _settings

    monkeypatch.setattr(_settings, "local_providers_disabled", "")


# ---------------------------------------------------------------- 探针三态


async def test_probe_available_ollama_parses_model_count_and_caches():
    calls: list[str] = []
    transport = _transport_json({"models": [{"name": "qwen2.5"}, {"name": "llama3.2"}]}, calls)
    r1 = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    assert r1.verdict == LocalProbeVerdict.AVAILABLE
    assert r1.model_count == 2
    assert calls and calls[0].endswith("/api/tags")
    # TTL 缓存:第二次不发真请求
    r2 = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    assert r2 is r1
    assert len(calls) == 1


async def test_probe_available_openai_compatible_url_shape():
    # lmstudio 类 base 已带 /v1 ⇒ /models;llamacpp 类 base 不带 ⇒ /v1/models
    calls: list[str] = []
    transport = _transport_json({"data": [{"id": "m1"}]}, calls)
    await local_provider_health.probe(
        "lmstudio", base_override="http://127.0.0.1:1234/v1", transport=transport
    )
    await local_provider_health.probe(
        "llamacpp", base_override="http://127.0.0.1:8080", transport=transport
    )
    assert any(u.endswith("/models") for u in calls)
    assert any(u.endswith("/v1/models") for u in calls)


async def test_connect_refused_is_unavailable_not_undetermined():
    calls: list[str] = []
    transport = _transport_error(httpx.ConnectError("connection refused"), calls)
    r = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    assert r.verdict == LocalProbeVerdict.UNAVAILABLE
    assert local_provider_health.is_available("ollama") is False


async def test_connect_timeout_is_unavailable_not_undetermined():
    """2026-10-21 事故钉子:本仓 httpx 0.28 里 ConnectTimeout **不继承** ConnectError,
    直连下 TCP 握手超时 = 端口没监听(与 refused 同为可下结论证据);旧判据把它
    折进 undetermined → 没跑的本地模型照样显示。与 ReadTimeout 用例成对:读超时
    仍判不了(服务可能只是慢),握手超时可下结论。"""
    calls: list[str] = []
    transport = _transport_error(httpx.ConnectTimeout("connect timed out"), calls)
    r = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    assert r.verdict == LocalProbeVerdict.UNAVAILABLE
    assert local_provider_health.is_available("ollama") is False


async def test_timeout_is_undetermined_and_never_folds_into_unavailable():
    calls: list[str] = []
    transport = _transport_error(httpx.ReadTimeout("timed out"), calls)
    r = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    # 关键反向断言:判不了 ≠ 没在跑
    assert r.verdict == LocalProbeVerdict.UNDETERMINED
    assert r.verdict != LocalProbeVerdict.UNAVAILABLE


async def test_no_base_is_undetermined_not_unavailable():
    # vllm 等没有 settings 字段、也没给 base_override:判不了,不冒充"不在跑"
    r = await local_provider_health.probe("vllm", transport=_transport_json({}, []))
    assert r.verdict == LocalProbeVerdict.UNDETERMINED


async def test_ttl_expiry_reprobes():
    calls: list[str] = []
    transport = _transport_json({"models": []}, calls)
    r1 = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    r1.probed_at = time.time() - 3600  # 手工把结论推到 TTL 之外
    await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    assert len(calls) == 2


async def test_http_error_status_is_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    r = await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=httpx.MockTransport(handler)
    )
    assert r.verdict == LocalProbeVerdict.UNAVAILABLE


# ---------------------------------------------------------------- 消费格


def test_local_auto_eligible_three_states():
    health = local_provider_health
    # 非 LOCAL:不归本判据管
    assert _local_auto_eligible("stepfun/step-3.7-flash", health) is True
    # 没探过:snapshot None ⇒ is_available False ⇒ 不进 auto 池(判据实证过才选)
    assert _local_auto_eligible("ollama/llama3.2", health) is False
    # 实证 available ⇒ 进
    health._cache["ollama"] = LocalProbeResult(
        verdict=LocalProbeVerdict.AVAILABLE, probed_at=time.time()
    )
    assert _local_auto_eligible("ollama/llama3.2", health) is True
    # 实证 unavailable / undetermined ⇒ 都不进
    health._cache["ollama"] = LocalProbeResult(
        verdict=LocalProbeVerdict.UNAVAILABLE, probed_at=time.time()
    )
    assert _local_auto_eligible("ollama/llama3.2", health) is False
    health._cache["ollama"] = LocalProbeResult(
        verdict=LocalProbeVerdict.UNDETERMINED, probed_at=time.time()
    )
    assert _local_auto_eligible("ollama/llama3.2", health) is False


def test_is_model_available_local_three_states():
    mid = "ollama/llama3.2"
    # 隔离:清掉单例上可能被同会话其他用例写进去的 ollama 健康行
    model_availability._health.pop("ollama", None)
    # 没探过且服务没刷新过(_health 空)⇒ 旧态宽松 True(显示,不冒充实证)
    assert model_availability.is_model_available(mid) is True
    # 探针实证 unavailable ⇒ 不显示(即使 _health 还没刷新)
    local_provider_health._cache["ollama"] = LocalProbeResult(
        verdict=LocalProbeVerdict.UNAVAILABLE, probed_at=time.time()
    )
    assert model_availability.is_model_available(mid) is False
    local_provider_health._cache.clear()
    # _health 实证 DOWN ⇒ 不显示
    model_availability._health["ollama"] = ProviderHealth(
        status=ProviderHealthStatus.DOWN, last_check=time.time()
    )
    try:
        assert model_availability.is_model_available(mid) is False
        # _health HEALTHY ⇒ 显示
        model_availability._health["ollama"] = ProviderHealth(
            status=ProviderHealthStatus.HEALTHY, last_check=time.time()
        )
        assert model_availability.is_model_available(mid) is True
        # _health LOCAL(未实证)⇒ 维持旧态显示
        model_availability._health["ollama"] = ProviderHealth(
            status=ProviderHealthStatus.LOCAL, last_check=time.time()
        )
        assert model_availability.is_model_available(mid) is True
    finally:
        model_availability._health.pop("ollama", None)


async def test_ensure_probed_skips_fresh_cache():
    calls: list[str] = []
    transport = _transport_json({"models": []}, calls)
    await local_provider_health.probe(
        "ollama", base_override="http://127.0.0.1:11434", transport=transport
    )
    await local_provider_health.ensure_probed(["ollama", "lmstudio"])
    # ollama 命中新鲜缓存不重探;lmstudio 没缓存会真探(settings 默认 base,handler 也计)
    assert len(calls) >= 1
    fresh = local_provider_health.snapshot("ollama")
    assert fresh is not None and fresh.verdict == LocalProbeVerdict.AVAILABLE
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
