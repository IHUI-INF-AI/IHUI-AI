# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 33 批(R12):同族 SSRF 漏面 + agent 归属 + 连接器写面回归。

覆盖:
- scheduler http_webhook:私网拒绝且不发请求;公网目标必须走钉定 IP 并带 Host/SNI;
- a2a 派发:公网目标钉不到 IP 即拒;成功时请求打到钉定 URL;
- a2a agent 归属:can_manage_agent 三档;跨属主覆盖注册 403;列表按归属过滤;
- connector_store:不可解密密文不被后续整表写覆盖,内部键不外泄;
- connectors 路由:删除/同步状态写失败不再回 ok。
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import a2a as a2a_router
from app.routers import connectors as connectors_router
from app.services import a2a_service, connector_store, scheduler_service, screenshot_service
from app.services.a2a_service import (
    A2AAgent,
    A2AServer,
    A2ATask,
    can_manage_agent,
)
from app.services.capability_gate import Principal


def _principal(sub: str | None = "user-1", *, role: int = 0) -> Principal:
    return Principal(kind="jwt", sub=sub, role=role, scopes=frozenset())


class _FakeResponse:
    status_code = 204
    text = ""

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return {"ok": True}


class _FakeClient:
    calls: list[tuple[str, dict[str, Any]]] = []

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        pass

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    async def post(self, url: str, **kwargs: Any) -> _FakeResponse:
        _FakeClient.calls.append((url, kwargs))
        return _FakeResponse()


# =============================================================================
# scheduler http_webhook SSRF
# =============================================================================


def test_scheduler_webhook_rejects_private_target(monkeypatch: pytest.MonkeyPatch) -> None:
    """私网/元数据目标:抛错且一次请求都不发。"""
    monkeypatch.setattr(screenshot_service, "_validate_url_ssrf", lambda _u: (False, "私网地址"))
    monkeypatch.setattr(scheduler_service.httpx, "AsyncClient", _FakeClient)
    _FakeClient.calls.clear()

    with pytest.raises(ValueError, match="不允许访问"):
        asyncio.run(
            scheduler_service.TaskScheduler()._execute_callback(
                {"type": "http_webhook", "url": "http://169.254.169.254/latest", "payload": {}}
            )
        )
    assert _FakeClient.calls == []


def test_scheduler_webhook_uses_pinned_ip(monkeypatch: pytest.MonkeyPatch) -> None:
    """公网目标:请求打到钉定 IP,Host/SNI 保持原域名。"""
    monkeypatch.setattr(screenshot_service, "_validate_url_ssrf", lambda _u: (True, ""))
    monkeypatch.setattr(
        screenshot_service,
        "resolve_pinned_target",
        lambda _u: ("https://93.184.216.34/hook", "hooks.example.com"),
    )
    monkeypatch.setattr(scheduler_service.httpx, "AsyncClient", _FakeClient)
    _FakeClient.calls.clear()

    asyncio.run(
        scheduler_service.TaskScheduler()._execute_callback(
            {"type": "http_webhook", "url": "https://hooks.example.com/hook", "payload": {"a": 1}}
        )
    )
    url, kwargs = _FakeClient.calls[0]
    assert url == "https://93.184.216.34/hook"
    assert kwargs["headers"] == {"Host": "hooks.example.com"}
    assert kwargs["extensions"] == {"sni_hostname": "hooks.example.com"}


# =============================================================================
# a2a 派发钉 IP
# =============================================================================


def _task() -> A2ATask:
    return A2ATask(task_id="task-1", name="t", agent_id="a1", input_data={})


def test_a2a_dispatch_rejects_unpinnable_public_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(a2a_service, "validate_a2a_endpoint", lambda ep: ep.rstrip("/"))
    monkeypatch.setattr(screenshot_service, "resolve_pinned_target", lambda _u: None)
    server = A2AServer()
    with pytest.raises(ValueError, match="无法钉定"):
        asyncio.run(server._dispatch_remote("https://agent.example.com", _task()))


def test_a2a_dispatch_posts_to_pinned_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(a2a_service, "validate_a2a_endpoint", lambda ep: ep.rstrip("/"))
    monkeypatch.setattr(
        screenshot_service,
        "resolve_pinned_target",
        lambda _u: ("https://93.184.216.34", "agent.example.com"),
    )
    monkeypatch.setattr(scheduler_service.httpx, "AsyncClient", _FakeClient)
    _FakeClient.calls.clear()

    out = asyncio.run(A2AServer()._dispatch_remote("https://agent.example.com", _task()))
    assert out == {"ok": True}
    url, kwargs = _FakeClient.calls[0]
    assert url == "https://93.184.216.34/tasks/task-1/execute"
    assert kwargs["headers"] == {"Host": "agent.example.com"}


# =============================================================================
# a2a agent 归属
# =============================================================================


def test_can_manage_agent_three_tiers() -> None:
    owned = A2AAgent("a1", "n", owner_id="owner-1")
    assert can_manage_agent(owned, _principal("owner-1"))
    assert not can_manage_agent(owned, _principal("attacker"))
    assert can_manage_agent(owned, _principal("admin", role=1))
    legacy = A2AAgent("legacy", "n")
    assert can_manage_agent(legacy, _principal("anyone"))


def test_register_rejects_cross_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    existing = A2AAgent("a1", "n", owner_id="owner-1")
    server = A2AServer()
    server._agents["a1"] = existing
    monkeypatch.setattr(a2a_router, "a2a_server", server)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            a2a_router.register_agent(
                a2a_router.RegisterAgentRequest(id="a1", name="hijack"),
                _principal("attacker"),
            )
        )
    assert exc.value.status_code == 403


def test_register_claims_legacy_and_sets_owner(monkeypatch: pytest.MonkeyPatch) -> None:
    server = A2AServer()
    server._agents["legacy"] = A2AAgent("legacy", "old")
    monkeypatch.setattr(a2a_router, "a2a_server", server)

    out = asyncio.run(
        a2a_router.register_agent(
            a2a_router.RegisterAgentRequest(id="legacy", name="claimed"),
            _principal("new-owner"),
        )
    )
    assert out["id"] == "legacy"
    assert server.get_agent("legacy").owner_id == "new-owner"


def test_list_agents_filters_by_ownership(monkeypatch: pytest.MonkeyPatch) -> None:
    server = A2AServer()
    server._agents = {
        "mine": A2AAgent("mine", "m", owner_id="user-1"),
        "other": A2AAgent("other", "o", owner_id="user-2"),
        "legacy": A2AAgent("legacy", "l"),
    }
    monkeypatch.setattr(a2a_router, "a2a_server", server)

    mine = asyncio.run(a2a_router.list_agents(_principal("user-1")))
    assert {a["id"] for a in mine["agents"]} == {"mine", "legacy"}
    admin = asyncio.run(a2a_router.list_agents(_principal("admin", role=1)))
    assert admin["count"] == 3


# =============================================================================
# connector_store:不可解密密文保全
# =============================================================================


def test_unreadable_ciphertext_survives_next_write(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> None:
    store = tmp_path / "connectors.json"
    monkeypatch.setattr(connector_store, "_STORE_PATH", store)
    monkeypatch.setattr(connector_store, "_encrypt_secret", lambda p: f"enc:v1:{p}")
    store.write_text(
        json.dumps(
            [{"key": "k1", "type": "t", "owner_user_id": "u1", "app_secret": "enc:v1:undecryptable"}]
        ),
        encoding="utf-8",
    )

    loaded = connector_store.list_owned("u1")
    assert loaded[0]["app_secret"] == ""
    assert all(not str(k).startswith("_") for k in loaded[0]), "内部记账键不得外泄"

    assert connector_store.save("u1", {"key": "k2", "type": "t", "app_secret": "plain"}) is not None
    persisted = json.loads(store.read_text(encoding="utf-8"))
    by_key = {rec["key"]: rec for rec in persisted}
    assert by_key["k1"]["app_secret"] == "enc:v1:undecryptable", "整表写入不得把不可解密密文抹成空串"
    assert by_key["k2"]["app_secret"] == "enc:v1:plain"
    assert all(not any(str(k).startswith("_") for k in rec) for rec in persisted)


# =============================================================================
# connectors 路由:写失败不再回 ok
# =============================================================================


def test_delete_returns_500_when_store_write_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(connectors_router.connector_store, "get", lambda _u, _k: {"key": "k"})
    monkeypatch.setattr(connectors_router.connector_store, "remove", lambda _u, _k: False)

    res = asyncio.run(connectors_router.delete_connector("k", user_id="u1"))
    assert res.status_code == 500


def test_sync_returns_500_when_state_persist_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    class _Mod:
        async def sync(self, _rec: dict[str, Any]) -> dict[str, Any]:
            return {"ok": True, "items": [], "last_sync_at": "2026-10-31T00:00:00Z"}

    monkeypatch.setattr(
        connectors_router.connector_store, "get", lambda _u, _k: {"key": "k", "type": "t", "app_id": "x"}
    )
    monkeypatch.setattr(connectors_router, "get_connector", lambda _t: _Mod())
    monkeypatch.setattr(connectors_router.connector_store, "set_sync_state", lambda *a, **kw: None)

    res = asyncio.run(
        connectors_router.sync_connector(connectors_router.ConnectorSyncRequest(key="k"), user_id="u1")
    )
    assert res.status_code == 500
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
