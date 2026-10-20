# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

"""system-worker 系统身份映射 + 本地 provider 禁用探测测试(2026-10-19 立)。
覆盖:_resolve_owner_uuid 对 system-worker 映射 settings.system_owner_uuid /
普通用户 JWT 路径一字未动 / _resolve_user_role 的 system-worker=admin 判断
不回归 / 禁用清单内的本地 provider 不发 HTTP(MockTransport 零调用)/
未禁用的正常探测不受影响。
"""

import httpx

from app.core.config import settings
from app.routers import llm as llm_router
from app.services.local_provider_health import (
    LocalProbeVerdict,
    LocalProviderHealth,
)


class _FakeState:
    def __init__(self, user_id=None, role_id=None):
        self.user_id = user_id
        self.role_id = role_id


class _FakeRequest:
    def __init__(self, user_id=None, role_id=None):
        self.state = _FakeState(user_id, role_id)


def test_system_worker_maps_to_system_owner_uuid():
    """system-worker ⇒ settings.system_owner_uuid(修 $2::uuid[] invalid UUID)。"""
    req = _FakeRequest(user_id="system-worker")
    resolved = llm_router._resolve_owner_uuid(req)
    assert resolved == settings.system_owner_uuid
    # 必须是合法 UUID 形态(能进 PG uuid 列)
    import uuid as _uuid

    _uuid.UUID(resolved)  # 不抛即合法


def test_normal_user_path_unchanged():
    """普通用户:原样返回 JWT user_id(P0-9 修复的行为不许变)。"""
    uid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    req = _FakeRequest(user_id=uid)
    assert llm_router._resolve_owner_uuid(req) == uid


def test_missing_user_id_returns_none():
    assert llm_router._resolve_owner_uuid(_FakeRequest(user_id=None)) is None


def test_system_worker_role_still_admin():
    """role 判定独立于 owner 映射:system-worker 仍视为 admin(不许被映射带偏)。"""
    req = _FakeRequest(user_id="system-worker", role_id=None)
    assert llm_router._resolve_user_role(req) == 1


def test_normal_user_role_from_state():
    req = _FakeRequest(user_id="u1", role_id=2)
    assert llm_router._resolve_user_role(req) == 2
    req2 = _FakeRequest(user_id="u2", role_id=None)
    assert llm_router._resolve_user_role(req2) == 0


# --- 本地 provider 禁用探测 -------------------------------------------------


def test_disabled_provider_sends_no_http(monkeypatch):
    """禁用清单内的 provider:零 HTTP 调用,判 undetermined(不冒充可用)。"""
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json={"models": []})

    health = LocalProviderHealth()

    import asyncio

    async def scenario():
        result = await health.probe(
            "ollama", transport=httpx.MockTransport(handler), force=True
        )
        return result

    result = asyncio.run(scenario())
    assert calls["n"] == 0, "禁用的 provider 不该发探测请求"
    assert result.verdict == LocalProbeVerdict.UNDETERMINED
    assert "disabled" in result.detail
    # is_available 只认 AVAILABLE ⇒ 禁用即不可选,行为不变
    assert health.is_available("ollama") is False


def test_xinference_disabled_by_default_sends_no_http(monkeypatch):
    """xinference 属未部署本地 provider,默认禁用清单应含它 ⇒ 零 HTTP 调用。

    上一轮只禁了 ollama/lmstudio/llamacpp/vllm,遗漏 xinference,导致每轮
    探活都 ConnectTimeout 刷屏。本例钉死默认清单含 xinference,防回归。
    """
    assert "xinference" in [
        c.strip().lower() for c in settings.local_providers_disabled.split(",") if c.strip()
    ]
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json={"models": []})

    health = LocalProviderHealth()

    import asyncio

    async def scenario():
        return await health.probe(
            "xinference", transport=httpx.MockTransport(handler), force=True
        )

    result = asyncio.run(scenario())
    assert calls["n"] == 0, "默认禁用的 xinference 不该发探测请求"
    assert result.verdict == LocalProbeVerdict.UNDETERMINED


def test_non_disabled_provider_still_probes(monkeypatch):
    """未禁用的 provider:照常探测(MockTransport 返回 200 ⇒ available)。"""
    # 从禁用清单里临时拿掉 ollama(monkeypatch settings 字段)
    monkeypatch.setattr(settings, "local_providers_disabled", "lmstudio,llamacpp,vllm")

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"models": [{"name": "qwen2.5"}]})

    health = LocalProviderHealth()

    import asyncio

    async def scenario():
        return await health.probe(
            "ollama", transport=httpx.MockTransport(handler), force=True
        )

    result = asyncio.run(scenario())
    assert result.verdict == LocalProbeVerdict.AVAILABLE
