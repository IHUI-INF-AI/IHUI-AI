# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""装车测试:Workspace Trust 三层判定集成到 agent_runtime `/permission-check`。

2026-11-14 C3 装车点验证。覆盖:
- workspace 为空 → 走纯工具级判定(trustLayer=None)。
- 未信任工作区 → 第一层 deny(workspace_trust),不到工具级判定。
- 已信任 + 安全档(read/default) → allow(trustLayer=delegated)。
- 已信任 + 未知工具名 → deny(delegated),证明信任过仍受工具级管。

不依赖 Redis(TrustStore 内存路径);monkeypatch default_trust_store。
"""

from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.routers import agent_runtime


@pytest.fixture(autouse=True)
def _clear_sessions():
    _sessions = getattr(agent_runtime, "_sessions", None)
    if _sessions is not None:
        _sessions.clear()
    agent_runtime._redis_client = None
    agent_runtime._redis_disabled = False
    yield
    if _sessions is not None:
        _sessions.clear()


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()

    @app.middleware("http")
    async def _fake_jwt(request, call_next):
        request.state.user_id = "u1"
        request.state.role_id = 1
        return await call_next(request)

    app.include_router(agent_runtime.router)
    return app


def _install_fake_store(monkeypatch, verdict_state: str) -> None:
    """把 workspace_trust 默认库替换为返回固定状态的假库。"""
    from app.core import workspace_trust
    from app.core.workspace_trust import TrustDecision, TrustVerdict

    verdict_map = {
        "trusted": TrustVerdict.TRUSTED,
        "distrusted": TrustVerdict.DISTRUSTED,
        "needs_first_trust": TrustVerdict.NEEDS_FIRST_TRUST,
    }
    reason_map = {
        "trusted": "trusted",
        "distrusted": "explicitly distrusted",
        "needs_first_trust": "needs first-trust confirmation",
    }
    fake_store = workspace_trust.TrustStore()
    fake_store.decide = AsyncMock(
        side_effect=lambda ws: TrustDecision(
            workspace=ws,
            verdict=verdict_map[verdict_state],
            allow=verdict_state == "trusted",
            reason=reason_map[verdict_state],
        )
    )
    monkeypatch.setattr(workspace_trust, "_default_store", fake_store)


async def _get_check(ac, payload):
    return await ac.get("/agent-runtime/permission/check", params=payload)


# =============================================================================
# 用例
# =============================================================================


async def test_workspace_empty_skips_trust_layer(monkeypatch):
    """workspace 为空 ⇒ 纯工具级判定,trustLayer=None。"""
    from app.core import workspace_trust

    fake_store = workspace_trust.TrustStore()
    fake_store.decide = AsyncMock()
    monkeypatch.setattr(workspace_trust, "_default_store", fake_store)

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await _get_check(
            ac, {"toolName": "read_file", "mode": "default", "dangerLevel": "read"}
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["decision"] == "allow"
    assert body["trustLayer"] is None
    assert body["workspace"] is None
    fake_store.decide.assert_not_awaited()  # 未触达信任层


async def test_workspace_untrusted_blocks_at_trust_layer(monkeypatch):
    """NEEDS_FIRST_TRUST ⇒ deny,layer=workspace_trust;不到工具级判定。"""
    _install_fake_store(monkeypatch, "needs_first_trust")

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 即便传未知工具名,也应先被信任层拦下,不冒充工具级 deny。
        resp = await _get_check(
            ac,
            {"toolName": "anything_unknown", "mode": "default", "dangerLevel": "read",
             "workspace": r"C:\Some\Untrusted\Path"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["decision"] == "deny"
    assert body["trustLayer"] == "workspace_trust"
    assert body["workspace"] == r"C:\Some\Untrusted\Path"


async def test_workspace_trusted_low_danger_allows(monkeypatch):
    """TRUSTED + read/default ⇒ allow,trustLayer=delegated。"""
    _install_fake_store(monkeypatch, "trusted")

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await _get_check(
            ac,
            {"toolName": "read_file", "mode": "default", "dangerLevel": "read",
             "workspace": "/w/proj"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["decision"] == "allow"
    assert body["trustLayer"] == "delegated"


async def test_workspace_trusted_still_restricted_by_tool_level(monkeypatch):
    """TRUSTED + write 危级 ⇒ ask(非 allow):信任过第一层不等于工具级放行,
    第二层仍按 dangerLevel 判定。"""
    _install_fake_store(monkeypatch, "trusted")

    app = _make_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await _get_check(
            ac,
            {"toolName": "write_file", "mode": "default", "dangerLevel": "write",
             "workspace": "/w/proj"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["decision"] == "ask"  # 若信任层误作最终放行会是 allow
    assert body["trustLayer"] == "delegated"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
