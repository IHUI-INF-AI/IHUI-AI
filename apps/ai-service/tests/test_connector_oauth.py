# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器用户 OAuth(user_access_token)链路测试。

覆盖:state 签名/TTL/CSRF、令牌密文往返、换取/刷新请求构造、执行层注入、
fail-closed(未授权不得回落 tenant 令牌)。
"""

from __future__ import annotations

import os
from typing import Any

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
# 平台开关:仅官方核实且协议提供 per-user token 的平台放行
# ---------------------------------------------------------------------------


def test_only_verified_providers_enabled():
    assert oauth.provider("feishu").enabled is True
    assert oauth.provider("dingtalk").enabled is True
    # 企微协议不提供 per-user token:不是端点未核实,而是根本无法以用户身份注入
    with pytest.raises(oauth.ConnectorOAuthError, match="per-user"):
        oauth.provider("wecom")
    with pytest.raises(oauth.ConnectorOAuthError, match="不支持"):
        oauth.provider("unknown")


def test_dingtalk_official_endpoints():
    """钉钉端点与字段映射必须与官方文档一致,防止回归成猜测 URL。"""
    cfg = oauth.provider("dingtalk")
    assert cfg.authorize_url == "https://login.dingtalk.com/oauth2/auth"
    assert cfg.token_url == "https://api.dingtalk.com/v1.0/oauth2/userAccessToken"
    assert cfg.client_id_param == "client_id"  # 授权页用下划线
    assert dict(cfg.authorize_extra_params) == {"scope": "openid", "prompt": "consent"}
    # 换取/刷新 token 的 body 用 camelCase,且不传 redirect_uri
    exchange = oauth.build_exchange_body(
        cfg, "authCode1", app_id="dingkey", app_secret="sec", redirect_uri="https://x/cb"
    )
    assert exchange == {
        "grantType": "authorization_code",
        "clientId": "dingkey",
        "clientSecret": "sec",
        "code": "authCode1",
    }
    refresh = oauth.build_refresh_body(cfg, "rt1", app_id="dingkey", app_secret="sec")
    assert refresh == {
        "grantType": "refresh_token",
        "clientId": "dingkey",
        "clientSecret": "sec",
        "refreshToken": "rt1",
    }
    # 响应 camelCase → 统一形状
    norm = oauth.normalize_token_response(
        {"accessToken": "a-token", "refreshToken": "r-token", "expireIn": 7200},
        config=cfg,
        now=1000,
    )
    assert norm["access_token"] == "a-token"
    assert norm["refresh_token"] == "r-token"
    assert norm["expires_at"] == 8200


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
async def test_auth_parts_injects_dingtalk_user_token():
    """钉钉用户态令牌走新版 api.dingtalk.com 的 Authorization: Bearer。"""
    token = {"access_token": "dt-u-token", "refresh_token": "", "expires_at": 9999999999}
    record = {
        "key": "dingtalk:user-oauth",
        "extra": {oauth.USER_TOKEN_EXTRA_KEY: oauth.encrypt_user_token(token)},
    }
    spec = ConnectorSpec.from_dict({"auth_kind": "dingtalk_user", "auth_name": "Authorization"})
    headers, params = await custom_http._auth_parts(record, spec)
    assert headers["Authorization"] == "Bearer dt-u-token"
    assert params == {}  # 不注入 access_token query(那是老版 oapi 的应用身份路径)


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
async def test_dingtalk_authorize_route_includes_official_params(monkeypatch):
    """钉钉授权 URL 必须带 client_id/scope=openid/prompt=consent/state。"""
    from urllib.parse import parse_qs, urlparse

    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.routers.connectors import connector_scope
    from app.services.connectors import managed

    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "dingkey",
            "app_secret": "sec",
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(
        router_mod, "_oauth_redirect_uri", lambda: "https://app.example.com/callback"
    )

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "tenant-A"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/connectors/dingtalk/oauth/authorize")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    parsed = urlparse(body["url"])
    assert parsed.scheme == "https" and "login.dingtalk.com" in parsed.netloc
    qs = parse_qs(parsed.query)
    assert qs["client_id"] == ["dingkey"]
    assert qs["response_type"] == ["code"]
    assert qs["scope"] == ["openid"]  # 官方必填
    assert qs["prompt"] == ["consent"]
    assert qs["state"] == [body["state"]]


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


@pytest.mark.asyncio
async def test_dingtalk_callback_real_exchange_normalizes_camel_case(monkeypatch):
    """钉钉回调用真实 exchange_code:平台回 camelCase,落库/注入用统一形状。

    这是对「code→token 请求体 + 响应映射」的端到端对拍,mock 只在 HTTP 出口。
    """
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.routers.connectors import connector_scope
    from app.services import connector_store
    from app.services.connectors import managed
    from tests._connector_fake import FakeSession

    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "dingkey",
            "app_secret": "sec",
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(router_mod, "_oauth_redirect_uri", lambda: "https://app.example.com/cb")

    captured: dict[str, Any] = {}

    async def fake_http_json(url: str, body: dict[str, Any]) -> dict[str, Any]:
        captured["url"] = url
        captured["body"] = body
        return {"accessToken": "dt-from-code", "refreshToken": "dt-refresh", "expireIn": 7200}

    # 保存未 patch 前的原函数:patch 后 oauth.exchange_code 指向下面的替身,
    # 直接调用会递归。用原函数 + mock 的 HTTP 出口做真实字段映射对拍。
    original_exchange = oauth.exchange_code

    async def real_with_mocked_http(cfg, code, *, app_id, app_secret, redirect_uri, http_json):
        return await original_exchange(
            cfg, code, app_id=app_id, app_secret=app_secret,
            redirect_uri=redirect_uri, http_json=fake_http_json,
        )

    monkeypatch.setattr(router_mod.connector_oauth, "exchange_code", real_with_mocked_http)

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "user-1"

    state = oauth.make_state("dingtalk", "user-1", user_id="user-1", tenant_id="")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(
            "/api/connectors/oauth/callback", params={"code": "auth-code", "state": state}
        )
    assert resp.status_code == 200, resp.text
    assert captured["url"] == "https://api.dingtalk.com/v1.0/oauth2/userAccessToken"
    assert captured["body"] == {
        "grantType": "authorization_code",
        "clientId": "dingkey",
        "clientSecret": "sec",
        "code": "auth-code",
    }

    stored = connector_store.get("user-1", "dingtalk:user-oauth")
    assert stored is not None
    assert oauth.decrypt_user_token(stored["extra"][oauth.USER_TOKEN_EXTRA_KEY])["access_token"] == (
        "dt-from-code"
    )
    spec = ConnectorSpec.from_dict(stored["spec"])
    assert spec.auth_kind == "dingtalk_user"
    headers, params = await custom_http._auth_parts(stored, spec)
    assert headers["Authorization"] == "Bearer dt-from-code"
    assert params == {}


# ---------------------------------------------------------------------------
# 回调地址:复用项目既有配置，不另造新变量
# ---------------------------------------------------------------------------


def test_oauth_redirect_reuses_existing_feishu_config(monkeypatch):
    """生产/开发都已配好飞书回调；连接器授权必须直接复用，不得要求新增配置。"""
    from app.routers import connectors as router_mod

    for name in (
        "CONNECTOR_OAUTH_REDIRECT_URI",
        "FEISHU_REDIRECT_URI",
        "NEXT_PUBLIC_FEISHU_REDIRECT_URI",
    ):
        monkeypatch.delenv(name, raising=False)

    # 生产示例 .env.production.example 里早已配置的值
    monkeypatch.setenv("FEISHU_REDIRECT_URI", "https://bsm.aizhs.top/callback?platform=feishu")
    assert router_mod._oauth_redirect_uri() == "https://bsm.aizhs.top/callback?platform=feishu"

    # Web 侧既有配置也可作为来源
    monkeypatch.delenv("FEISHU_REDIRECT_URI")
    monkeypatch.setenv("NEXT_PUBLIC_FEISHU_REDIRECT_URI", "http://localhost:8801/callback?platform=feishu")
    assert router_mod._oauth_redirect_uri() == "http://localhost:8801/callback?platform=feishu"

    # 显式覆盖仍最高优先
    monkeypatch.setenv("CONNECTOR_OAUTH_REDIRECT_URI", "https://custom.example.com/cb")
    assert router_mod._oauth_redirect_uri() == "https://custom.example.com/cb"

    monkeypatch.delenv("CONNECTOR_OAUTH_REDIRECT_URI")
    monkeypatch.delenv("NEXT_PUBLIC_FEISHU_REDIRECT_URI")
    assert router_mod._oauth_redirect_uri() == ""
