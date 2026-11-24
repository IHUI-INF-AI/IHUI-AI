# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器用户 OAuth(user_access_token)链路测试。

覆盖:state 签名/TTL/CSRF、令牌密文往返、换取/刷新请求构造、执行层注入、
fail-closed(未授权不得回落 tenant 令牌)。
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("CONNECTOR_OAUTH_STATE_SECRET", "test-state-secret-32chars-minimum")

from app.services.connectors import connector_oauth as oauth  # noqa: E402
from app.services.connectors import custom_http  # noqa: E402
from app.services.connectors.base import ConnectorSpec  # noqa: E402


# ---------------------------------------------------------------------------
# state:CSRF 防护
# ---------------------------------------------------------------------------


def test_state_roundtrip_and_tamper_rejection():
    state = oauth.make_state("feishu", "tenant-A", user_id="user-1", now=1000)
    oauth.verify_state(state, "feishu", "tenant-A", now=1000)

    # 篡改签名 → 拒
    tampered = state[:-2] + ("aa" if not state.endswith("aa") else "bb")
    with pytest.raises(oauth.ConnectorOAuthError, match="签名"):
        oauth.verify_state(tampered, "feishu", "tenant-A", now=1000)

    # 错平台/错租户 → 拒(CSRF)
    with pytest.raises(oauth.ConnectorOAuthError, match="不匹配"):
        oauth.verify_state(state, "wecom", "tenant-A", now=1000)
    with pytest.raises(oauth.ConnectorOAuthError, match="不匹配"):
        oauth.verify_state(state, "feishu", "tenant-B", now=1000)

    # 过期 / 未来时间戳 → 拒
    with pytest.raises(oauth.ConnectorOAuthError, match="过期"):
        oauth.verify_state(state, "feishu", "tenant-A", now=1000 + 601)
    with pytest.raises(oauth.ConnectorOAuthError, match="过期"):
        oauth.verify_state(state, "feishu", "tenant-A", now=1000 - 100)


def test_state_contains_user_id_in_signature():
    """user_id 必须进签名:改 payload 里的 u 而不改签名应被拒。"""
    import base64
    import json

    state = oauth.make_state("feishu", "tenant-A", user_id="user-1", now=1000)
    body, sig = state.split(".", 1)
    payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    assert payload["u"] == "user-1"
    payload["u"] = "attacker"
    forged_body = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    ).decode().rstrip("=")
    with pytest.raises(oauth.ConnectorOAuthError, match="签名"):
        oauth.verify_state(f"{forged_body}.{sig}", "feishu", "tenant-A", now=1000)


# ---------------------------------------------------------------------------
# token 密文与规范化
# ---------------------------------------------------------------------------


def test_user_token_encrypt_decrypt_roundtrip():
    token = {
        "access_token": "u-token-xyz",
        "refresh_token": "r-token-xyz",
        "expires_at": 9999999999,
        "token_type": "Bearer",
        "scope": "contact:contact",
    }
    cipher = oauth.encrypt_user_token(token)
    assert "u-token-xyz" not in cipher, "密文不得含令牌明文"
    assert oauth.decrypt_user_token(cipher)["access_token"] == "u-token-xyz"


def test_user_token_decrypt_fail_closed():
    with pytest.raises(oauth.ConnectorOAuthError, match="不存在"):
        oauth.decrypt_user_token("")
    with pytest.raises(oauth.ConnectorOAuthError, match="不存在"):
        oauth.decrypt_user_token("plain-token")
    with pytest.raises(oauth.ConnectorOAuthError, match="解密失败"):
        oauth.decrypt_user_token(oauth._TOKEN_CIPHER_PREFIX + "garbage-cipher")


def test_normalize_token_and_refresh_window():
    norm = oauth.normalize_token_response(
        {"access_token": "tok", "refresh_token": "rf", "expires_in": 3600}, now=1000
    )
    assert norm["expires_at"] == 4600
    assert oauth.needs_refresh(norm, now=1000) is False
    assert oauth.needs_refresh(norm, now=4600 - oauth.REFRESH_SKEW_SECONDS + 1) is True
    # 无过期时间视为不过期
    no_exp = oauth.normalize_token_response({"access_token": "tok"}, now=1000)
    assert no_exp["expires_at"] == 0
    assert oauth.needs_refresh(no_exp, now=999999) is False


# ---------------------------------------------------------------------------
# 平台开关:未核实的端点不得放行
# ---------------------------------------------------------------------------


def test_only_verified_providers_enabled():
    assert oauth.provider("feishu").enabled is True
    for platform in ("dingtalk", "wecom"):
        with pytest.raises(oauth.ConnectorOAuthError, match="尚未经官方"):
            oauth.provider(platform)
    with pytest.raises(oauth.ConnectorOAuthError, match="不支持"):
        oauth.provider("unknown")


# ---------------------------------------------------------------------------
# 执行层:user token 注入 / fail-closed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_auth_parts_injects_user_token():
    token = {"access_token": "u-live-token", "refresh_token": "", "expires_at": 9999999999}
    record = {"key": "feishu:user-oauth", "extra": {oauth.USER_TOKEN_EXTRA_KEY: oauth.encrypt_user_token(token)}}
    spec = ConnectorSpec.from_dict({"auth_kind": "feishu_user", "auth_name": "Authorization"})
    headers, params = await custom_http._auth_parts(record, spec)
    assert headers["Authorization"] == "Bearer u-live-token"
    assert params == {}


@pytest.mark.asyncio
async def test_auth_parts_no_user_token_fails_closed():
    """未授权时不得回落 tenant 令牌,必须明确报错让用户去扫码。"""
    record = {"key": "feishu:user-oauth", "app_id": "cli_x", "app_secret": "sec", "extra": {}}
    spec = ConnectorSpec.from_dict({"auth_kind": "feishu_user", "auth_name": "Authorization"})
    with pytest.raises(custom_http.ConnectorExecutionError, match="用户授权"):
        await custom_http._auth_parts(record, spec)


# ---------------------------------------------------------------------------
# 请求构造:官方端点与字段
# ---------------------------------------------------------------------------


def test_exchange_and_refresh_body_use_official_fields():
    cfg = oauth.provider("feishu")
    assert cfg.token_url == "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
    assert cfg.authorize_url.endswith("/authen/v1/authorize")

    exchange = oauth.build_exchange_body(
        cfg, "code123", app_id="cli_x", app_secret="sec", redirect_uri="https://x/cb"
    )
    assert exchange["grant_type"] == "authorization_code"
    assert exchange["client_id"] == "cli_x"
    assert exchange["code"] == "code123"
    assert exchange["redirect_uri"] == "https://x/cb"

    refresh = oauth.build_refresh_body(
        cfg, "rt123", app_id="cli_x", app_secret="sec"
    )
    assert refresh["grant_type"] == "refresh_token"
    assert refresh["refresh_token"] == "rt123"


# ---------------------------------------------------------------------------
# 路由:授权 URL 生成(验证 scope 参数不污染 + state 进 URL)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_authorize_route_builds_official_url(monkeypatch):
    from urllib.parse import parse_qs, urlparse

    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.services.connectors import managed

    # 平台应用凭据 mock(不触网、不依赖环境变量)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_test",
            "app_secret": "sec_test",
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(
        router_mod, "_oauth_redirect_uri", lambda: "https://app.example.com/api/connectors/oauth/callback"
    )

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    # connector_scope 依赖链需要 tenant_scope;直接覆盖为固定作用域
    from app.routers.connectors import connector_scope

    app.dependency_overrides[connector_scope] = lambda: "tenant-A"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/connectors/feishu/oauth/authorize",
            params={"oauth_scope": "contact:contact"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["platform"] == "feishu"
    parsed = urlparse(body["url"])
    assert parsed.scheme == "https" and "open.feishu.cn" in parsed.netloc
    qs = parse_qs(parsed.query)
    assert qs["client_id"] == ["cli_test"]
    assert qs["response_type"] == ["code"]
    assert qs["scope"] == ["contact:contact"], "oauth_scope 必须进授权 URL"
    assert qs["state"] == [body["state"]]
    # state 绑定的是租户作用域,不是 oauth_scope
    oauth.verify_state(body["state"], "feishu", "tenant-A", now=None)


@pytest.mark.asyncio
async def test_callback_exchanges_code_and_stores_encrypted_token(monkeypatch):
    """回调全链:state → code 换 token → 加密落库 → AI 按同 scope 能列到。"""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.services import connector_store
    from app.services.connectors import managed

    # 假 DB(用项目自带 FakeSession)
    from tests._connector_fake import FakeSession

    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {"app_id": "cli_x", "app_secret": "sec", "source": "platform_env"},
    )
    monkeypatch.setattr(
        router_mod, "_oauth_redirect_uri", lambda: "https://app.example.com/cb"
    )

    # mock code→token 换取(不触网)
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
    from app.routers.connectors import connector_scope

    app.dependency_overrides[connector_scope] = lambda: "user-1"  # 个人模式

    state = oauth.make_state("feishu", "user-1", user_id="user-1", tenant_id="")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/connectors/oauth/callback", params={"code": "the-code", "state": state}
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["connector_key"] == "feishu:user-oauth"

    # 用户令牌密文落库,明文不泄露
    stored = connector_store.get("user-1", "feishu:user-oauth")
    assert stored is not None
    cipher = stored["extra"][oauth.USER_TOKEN_EXTRA_KEY]
    assert "u-from-code" not in cipher
    assert oauth.decrypt_user_token(cipher)["access_token"] == "u-from-code"

    # AI 按同 scope 能列到该连接器,且令牌能注入
    listed = connector_store.list_owned("user-1")
    assert any(c["key"] == "feishu:user-oauth" for c in listed)
    spec = ConnectorSpec.from_dict(stored["spec"])
    headers, _ = await custom_http._auth_parts(stored, spec)
    assert headers["Authorization"] == "Bearer u-from-code"
