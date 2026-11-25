# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""用户 OAuth 连接器操作清单回归测试。

缺陷:扫码授权后连接器只落 9 条静态 tenant 模板,台账里 164 条 feishu_user
API 全部调不到。这里钉住「只取 user 态 + 回退 + 上限截断 + 安全门 + 端到端接线」。
"""

from __future__ import annotations

import logging
import os

import pytest

os.environ.setdefault("CONNECTOR_OAUTH_STATE_SECRET", "test-state-secret-32chars-minimum")

from app.routers import connectors as router_mod  # noqa: E402
from app.services.connectors import catalog, coverage  # noqa: E402
from app.services.connectors.base import MAX_OPERATIONS  # noqa: E402


def test_feishu_user_ops_from_ledger():
    """飞书扫码后应落台账全部 user 态 API,不是内置 9 条 tenant 模板。"""
    ops = router_mod._user_oauth_operations("feishu")

    assert len(ops) > 100, f"飞书 user 操作应 >100 条,实际 {len(ops)}"
    assert len(ops) <= MAX_OPERATIONS

    bundle = coverage.load_catalog("feishu")
    user_ids = {a["id"] for a in bundle.apis if a["auth"].endswith("_user")}
    tenant_ids = {a["id"] for a in bundle.apis if a["auth"].endswith("_tenant")}
    op_ids = {op["id"] for op in ops}

    # 全部且仅有 user 态:不得混入任何 tenant 专属 API
    assert op_ids == user_ids
    assert not (op_ids & tenant_ids), "用户授权连接器不得混入 tenant 态 API"

    # api_to_operation 的鉴权提示可证明来源(user 态)
    for op in ops:
        assert "需用户授权" in op["description"], f"{op['id']} 未标注用户态"
        assert "feishu_user" in op["description"], f"{op['id']} 未标注 feishu_user"


def test_dingtalk_falls_back_to_default_template():
    """钉钉台账 auth 全是 dingtalk(0 条 user)⇒ 回退内置默认模板。"""
    ops = router_mod._user_oauth_operations("dingtalk")
    assert ops == catalog.default_operations("dingtalk")
    assert len(ops) == 6


def test_fallback_when_catalog_unavailable(monkeypatch):
    """台账未判定(state != ok)⇒ 回退内置模板,不静默落空壳。"""
    broken = coverage.CatalogBundle(
        platform="feishu",
        label="飞书",
        state="unjudged",
        reason="台账读取失败",
        source={},
        apis=[],
    )
    monkeypatch.setattr(router_mod.coverage, "load_catalog", lambda platform: broken)

    ops = router_mod._user_oauth_operations("feishu")
    assert ops == catalog.default_operations("feishu")
    assert len(ops) == 9


def test_write_ops_keep_safety_gate():
    """user 操作里的写接口仍带 disabled/confirm 安全门,不得因展开而放宽。"""
    ops = router_mod._user_oauth_operations("feishu")
    write_ops = [op for op in ops if op["capability"] == "action"]
    assert write_ops, "user API 中应有写操作"
    assert all(op["disabled"] and op["confirm"] for op in write_ops)
    read_ops = [op for op in ops if op["capability"] != "action"]
    assert read_ops
    assert all(not op["disabled"] and not op["confirm"] for op in read_ops)


def test_user_ops_truncated_at_max_with_warning(monkeypatch, caplog):
    """未来台账膨胀超过 MAX_OPERATIONS 时截断并记 warning,不静默丢弃。"""
    apis = [
        {
            "id": f"feishu_user_api_{i}",
            "name": f"用户接口 {i}",
            "domain": "im",
            "method": "GET",
            "path": f"/im/v1/user/{i}",
            "auth": "feishu_user",
            "scope": "",
            "read": True,
            "query": {},
            "body": None,
        }
        for i in range(MAX_OPERATIONS + 1)
    ]
    huge = coverage.CatalogBundle(
        platform="feishu",
        label="飞书",
        state="ok",
        reason="",
        source={},
        apis=apis,
        base_url="https://open.feishu.cn/open-apis",
    )
    monkeypatch.setattr(router_mod.coverage, "load_catalog", lambda platform: huge)

    with caplog.at_level(logging.WARNING):
        ops = router_mod._user_oauth_operations("feishu")

    assert len(ops) == MAX_OPERATIONS
    assert any("截断" in rec.getMessage() for rec in caplog.records)


@pytest.mark.asyncio
async def test_callback_persists_user_ops_not_default_template(monkeypatch):
    """端到端:扫码回调落库的是台账 user 操作,而非 9 条静态模板。"""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers.connectors import connector_scope
    from app.services import connector_store
    from app.services.connectors import connector_oauth as oauth
    from app.services.connectors import managed
    from tests._connector_fake import FakeSession

    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_x",
            "app_secret": "sec",
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(router_mod, "_oauth_redirect_uri", lambda: "https://app.example.com/cb")

    async def fake_exchange(cfg, code, *, app_id, app_secret, redirect_uri, http_json):
        return {
            "access_token": "u-from-code",
            "refresh_token": "r-from-code",
            "expires_at": 9999999999,
            "token_type": "Bearer",
            "scope": "",
        }

    monkeypatch.setattr(router_mod.connector_oauth, "exchange_code", fake_exchange)

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "user-1"

    state = oauth.make_state("feishu", "user-1", user_id="user-1", tenant_id="")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/connectors/oauth/callback", params={"code": "the-code", "state": state}
        )
    assert resp.status_code == 200, resp.text

    stored = connector_store.get("user-1", "feishu:user-oauth")
    assert stored is not None
    ops = stored["operations"]
    assert len(ops) > 100, f"落库操作应 >100 条,实际 {len(ops)}(疑似回落默认 9 条)"
    assert all("需用户授权" in op["description"] for op in ops)


@pytest.mark.asyncio
async def test_callback_upgrades_existing_user_ops(monkeypatch):
    """存量用户(旧版 9 条操作)重新扫码后,operations 一并补齐全量 user 操作。"""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers.connectors import connector_scope
    from app.services import connector_store
    from app.services.connectors import catalog
    from app.services.connectors import connector_oauth as oauth
    from app.services.connectors import managed
    from tests._connector_fake import FakeSession

    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_x",
            "app_secret": "sec",
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(router_mod, "_oauth_redirect_uri", lambda: "https://app.example.com/cb")

    # 先存一条旧记录:只有 9 条静态模板操作
    old = {
        "key": "feishu:user-oauth",
        "type": "feishu",
        "name": "飞书 · 用户授权",
        "extra": {},
        "mode": "preset",
        "spec": {"base_url": "https://open.feishu.cn/open-apis", "auth_kind": "feishu_user"},
        "operations": catalog.default_operations("feishu"),
        "enabled": True,
        "managed": True,
    }
    connector_store.save("user-1", old)
    assert len(connector_store.get("user-1", "feishu:user-oauth")["operations"]) == 9

    async def fake_exchange(cfg, code, *, app_id, app_secret, redirect_uri, http_json):
        return {
            "access_token": "u-new",
            "refresh_token": "r-new",
            "expires_at": 9999999999,
            "token_type": "Bearer",
            "scope": "",
        }

    monkeypatch.setattr(router_mod.connector_oauth, "exchange_code", fake_exchange)

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "user-1"

    state = oauth.make_state("feishu", "user-1", user_id="user-1", tenant_id="")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/connectors/oauth/callback", params={"code": "the-code", "state": state}
        )
    assert resp.status_code == 200, resp.text

    stored = connector_store.get("user-1", "feishu:user-oauth")
    assert len(stored["operations"]) > 100, "重新扫码后应补齐全量 user 操作,不再是 9 条"
    assert all("需用户授权" in op["description"] for op in stored["operations"])
