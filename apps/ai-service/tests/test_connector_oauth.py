# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器用户 OAuth(user_access_token)链路测试。

覆盖:state 签名/TTL/CSRF、令牌密文往返、换取/刷新请求构造、执行层注入、
fail-closed(未授权不得回落 tenant 令牌)。
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

import httpx
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
    """钉钉 userAccessToken 只认 x-acs-dingtalk-access-token,不是 Authorization: Bearer。

    钉钉新版 v1.0 REST API(如 /v1.0/contact/users/me)的 header 是
    ``x-acs-dingtalk-access-token``;传 Authorization: Bearer 会被拒
    "缺少参数 x-acs-dingtalk-access-token"。变异:改回 Bearer 则此测试红。
    """
    token = {"access_token": "dt-u-token", "refresh_token": "", "expires_at": 9999999999}
    record = {
        "key": "dingtalk:user-oauth",
        "extra": {oauth.USER_TOKEN_EXTRA_KEY: oauth.encrypt_user_token(token)},
    }
    spec = ConnectorSpec.from_dict({"auth_kind": "dingtalk_user", "auth_name": "Authorization"})
    headers, params = await custom_http._auth_parts(record, spec)
    assert headers["x-acs-dingtalk-access-token"] == "dt-u-token"
    assert "Authorization" not in headers, "钉钉不认 Authorization: Bearer"
    assert params == {}  # 不注入 access_token query(那是老版 oapi 的应用身份路径)


@pytest.mark.asyncio
async def test_auth_parts_no_user_token_fails_closed():
    """未授权时不得回落 tenant 令牌,必须明确报错让用户去扫码。"""
    record = {"key": "feishu:user-oauth", "app_id": "cli_x", "app_secret": "sec", "extra": {}}
    spec = ConnectorSpec.from_dict({"auth_kind": "feishu_user", "auth_name": "Authorization"})
    with pytest.raises(custom_http.ConnectorExecutionError, match="用户授权"):
        await custom_http._auth_parts(record, spec)


# ---------------------------------------------------------------------------
# 刷新关键分支:临近过期 → 真实 refresh 请求 → 新令牌注入 → 新密文持久化
# ---------------------------------------------------------------------------


class _FakeResponse:
    """httpx.Response 最小替身(refresh 与操作请求共用)。"""

    def __init__(self, data: dict[str, Any], status_code: int = 200) -> None:
        self._data = data
        self.status_code = status_code
        self.content = json.dumps(data, ensure_ascii=False).encode()

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> dict[str, Any]:
        return self._data


class _RefreshHttpClient:
    """httpx.AsyncClient 替身:拦截 refresh POST 与操作请求,记录调用参数。

    执行层的 refresh 与操作请求都走它,便于断言"刷新请求字段正确 / 新令牌进
    header / 全程不触网"。
    """

    def __init__(self, token_payload: dict[str, Any]) -> None:
        self.token_payload = token_payload
        self.refresh_calls: list[tuple[str, dict[str, Any]]] = []
        self.operation_headers: dict[str, str] = {}

    def __call__(self, *args: Any, **kwargs: Any) -> "_RefreshHttpClient":
        return self

    async def __aenter__(self) -> "_RefreshHttpClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        return None

    async def post(self, url: str, json: dict[str, Any] | None = None) -> _FakeResponse:
        self.refresh_calls.append((url, dict(json or {})))
        return _FakeResponse(self.token_payload)

    async def request(self, method: str, url: str, **kwargs: Any) -> _FakeResponse:
        headers = kwargs.get("headers") or {}
        self.operation_headers.update({str(k): str(v) for k, v in headers.items()})
        return _FakeResponse({"items": [], "code": 0})


async def _no_op_validate_outbound_url(
    url: str, *, allow_private_hosts: bool = False
) -> None:
    """测试隔离:刷新用例不验 DNS,避免真解析外网域名。"""
    return None


def _near_expiry_token() -> dict[str, Any]:
    """1 分钟后过期:落在 300s 提前刷新窗口内,但尚未真正过期。"""
    return {
        "access_token": "u-old-token",
        "refresh_token": "r-old-token",
        "expires_at": int(time.time()) + 60,
        "token_type": "Bearer",
        "scope": "offline_access",
    }


def _refreshed_payload() -> dict[str, Any]:
    """飞书 v2 刷新响应(snake_case):新 access_token + 新 refresh_token。"""
    return {
        "code": 0,
        "access_token": "u-new-token",
        "refresh_token": "r-new-token",
        "expires_in": 7200,
        "token_type": "Bearer",
        "scope": "offline_access",
    }


@pytest.mark.asyncio
async def test_refresh_request_fields_and_new_token_in_header(monkeypatch):
    """临近过期触发真实刷新:请求字段按官方映射,新 access_token 注入 header。"""
    record = {
        "key": "feishu:user-oauth",
        "app_id": "cli_x",
        "app_secret": "sec",
        "extra": {oauth.USER_TOKEN_EXTRA_KEY: oauth.encrypt_user_token(_near_expiry_token())},
    }
    spec = ConnectorSpec.from_dict({"auth_kind": "feishu_user", "auth_name": "Authorization"})
    fake = _RefreshHttpClient(_refreshed_payload())
    monkeypatch.setattr(httpx, "AsyncClient", fake)

    headers, params = await custom_http._auth_parts(record, spec)

    assert len(fake.refresh_calls) == 1, "必须恰好触发一次 refresh"
    url, body = fake.refresh_calls[0]
    assert url == "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
    assert body == {
        "grant_type": "refresh_token",
        "client_id": "cli_x",
        "client_secret": "sec",
        "refresh_token": "r-old-token",
    }
    assert headers["Authorization"] == "Bearer u-new-token", "新令牌必须注入 header"
    assert params == {}


@pytest.mark.asyncio
async def test_refresh_writes_back_cipher_and_notifies(monkeypatch):
    """刷新后新密文写回记录并回调上层(变异验证:删写回或删回调即变红)。"""
    old_cipher = oauth.encrypt_user_token(_near_expiry_token())
    record = {
        "key": "feishu:user-oauth",
        "app_id": "cli_x",
        "app_secret": "sec",
        "extra": {oauth.USER_TOKEN_EXTRA_KEY: old_cipher},
    }
    spec = ConnectorSpec.from_dict({"auth_kind": "feishu_user", "auth_name": "Authorization"})
    fake = _RefreshHttpClient(_refreshed_payload())
    monkeypatch.setattr(httpx, "AsyncClient", fake)

    notified: list[str] = []
    await custom_http._auth_parts(
        record, spec, on_token_refreshed=lambda cipher: notified.append(cipher)
    )

    new_cipher = record["extra"][oauth.USER_TOKEN_EXTRA_KEY]
    assert new_cipher != old_cipher, "密文必须被替换(变异:去掉写回则此处失败)"
    assert len(notified) == 1 and notified[0] == new_cipher, "回调必须拿到同一份新密文"
    fresh = oauth.decrypt_user_token(new_cipher)
    assert fresh["access_token"] == "u-new-token"
    assert fresh["refresh_token"] == "r-new-token", "refresh_token 单次有效,必须落新值"
    assert fresh["expires_at"] > time.time(), "新过期时间必须被刷新"


@pytest.mark.asyncio
async def test_refresh_persists_to_store_via_invoke_route(monkeypatch):
    """端到端:invoke 触发刷新后新密文必须真落库,重读可解密出新令牌。"""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient as RealAsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.routers.connectors import connector_scope
    from app.services import connector_store
    from app.services.connectors import managed
    from tests._connector_fake import FakeSession

    fake_store = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake_store)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_x",
            "app_secret": "sec",
            "extra": {},
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(custom_http, "validate_outbound_url", _no_op_validate_outbound_url)

    old_cipher = oauth.encrypt_user_token(_near_expiry_token())
    stored = connector_store.save(
        "user-1",
        {
            "key": "feishu:user-oauth",
            "type": "feishu",
            "name": "飞书用户授权",
            "app_id": "",
            "app_secret": "",
            "extra": {oauth.USER_TOKEN_EXTRA_KEY: old_cipher},
            "mode": "preset",
            "spec": {
                "base_url": "https://open.feishu.cn/open-apis",
                "auth_kind": "feishu_user",
                "auth_name": "Authorization",
            },
            "operations": [
                {
                    "id": "list_items",
                    "capability": "list",
                    "method": "GET",
                    "path": "/items",
                    "response_path": "items",
                }
            ],
            "enabled": True,
            "managed": True,
            "credential_source": "platform_env",
        },
    )
    assert stored is not None

    # 先构造 ASGI 客户端:它的 AsyncClient 必须绑定真类,不受下面的替身影响
    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "user-1"

    fake_http = _RefreshHttpClient(_refreshed_payload())
    monkeypatch.setattr(httpx, "AsyncClient", fake_http)

    async with RealAsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/connectors/feishu:user-oauth/invoke",
            json={"operation_id": "list_items", "params": {}},
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True

    # 关键断言(变异:去掉路由回调/回写则此处失败):落库密文被替换且可解密
    reread = connector_store.get("user-1", "feishu:user-oauth")
    assert reread is not None
    new_cipher = reread["extra"][oauth.USER_TOKEN_EXTRA_KEY]
    assert new_cipher != old_cipher
    assert oauth.decrypt_user_token(new_cipher)["access_token"] == "u-new-token"
    assert fake_http.operation_headers.get("Authorization") == "Bearer u-new-token"


def _setup_refresh_route(monkeypatch):
    """sync/fetch 路由刷新用例的公共装配:假 store + 平台凭据 + 临期令牌记录。

    返回 (app, old_cipher, fake_http)。本函数会 monkeypatch httpx.AsyncClient,
    调用方须在调用前绑定真 AsyncClient(复用 invoke 用例的写法)。
    """
    from fastapi import FastAPI

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.routers.connectors import connector_scope
    from app.services import connector_store
    from app.services.connectors import managed
    from tests._connector_fake import FakeSession

    fake_store = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake_store)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_x",
            "app_secret": "sec",
            "extra": {},
            "source": "platform_env",
        },
    )
    monkeypatch.setattr(custom_http, "validate_outbound_url", _no_op_validate_outbound_url)

    old_cipher = oauth.encrypt_user_token(_near_expiry_token())
    stored = connector_store.save(
        "user-1",
        {
            # type 不能落 LEGACY_TYPES,否则 sync/fetch 走旧注册表而非 custom_http
            "key": "feishu:user-oauth",
            "type": "custom",
            "name": "飞书用户授权",
            "app_id": "",
            "app_secret": "",
            "extra": {oauth.USER_TOKEN_EXTRA_KEY: old_cipher},
            "mode": "custom",
            "spec": {
                "base_url": "https://open.feishu.cn/open-apis",
                "auth_kind": "feishu_user",
                "auth_name": "Authorization",
            },
            "operations": [
                {
                    "id": "list_items",
                    "capability": "list",
                    "method": "GET",
                    "path": "/items",
                    "response_path": "items",
                },
                {
                    "id": "fetch_doc",
                    "capability": "fetch",
                    "method": "GET",
                    "path": "/docs/{doc_id}",
                    "response_path": "data",
                },
            ],
            "enabled": True,
            "managed": True,
            "credential_source": "platform_env",
        },
    )
    assert stored is not None

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "user-1"

    fake_http = _RefreshHttpClient(_refreshed_payload())
    monkeypatch.setattr(httpx, "AsyncClient", fake_http)
    return app, old_cipher, fake_http


@pytest.mark.asyncio
async def test_refresh_persists_to_store_via_sync_route(monkeypatch):
    """sync 路由:custom_http 分支刷新后新密文必须真落库(变异:删回调即变红)。"""
    from httpx import ASGITransport, AsyncClient as RealAsyncClient

    from app.services import connector_store

    app, old_cipher, fake_http = _setup_refresh_route(monkeypatch)

    async with RealAsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/connectors/sync", json={"key": "feishu:user-oauth"}
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True

    reread = connector_store.get("user-1", "feishu:user-oauth")
    assert reread is not None
    new_cipher = reread["extra"][oauth.USER_TOKEN_EXTRA_KEY]
    assert new_cipher != old_cipher
    assert oauth.decrypt_user_token(new_cipher)["access_token"] == "u-new-token"
    assert len(fake_http.refresh_calls) == 1
    assert fake_http.operation_headers.get("Authorization") == "Bearer u-new-token"


@pytest.mark.asyncio
async def test_refresh_persists_to_store_via_fetch_route(monkeypatch):
    """fetch 路由:custom_http 分支刷新后新密文必须真落库(变异:删回调即变红)。"""
    from httpx import ASGITransport, AsyncClient as RealAsyncClient

    from app.services import connector_store

    app, old_cipher, fake_http = _setup_refresh_route(monkeypatch)

    async with RealAsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        resp = await client.post(
            "/api/connectors/feishu:user-oauth/fetch", json={"doc_id": "doc-1"}
        )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ok"] is True

    reread = connector_store.get("user-1", "feishu:user-oauth")
    assert reread is not None
    new_cipher = reread["extra"][oauth.USER_TOKEN_EXTRA_KEY]
    assert new_cipher != old_cipher
    assert oauth.decrypt_user_token(new_cipher)["access_token"] == "u-new-token"
    assert len(fake_http.refresh_calls) == 1
    assert fake_http.operation_headers.get("Authorization") == "Bearer u-new-token"


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
    # 用户 scope 必须进 URL,且飞书默认 offline_access 合并去重(不覆盖用户 scope)
    scopes = qs["scope"][0].split()
    assert "contact:contact" in scopes
    assert scopes.count("offline_access") == 1
    assert qs["state"] == [body["state"]]
    # state 绑定的是租户作用域,不是 oauth_scope
    oauth.verify_state(body["state"], "feishu", "tenant-A", now=None)


@pytest.mark.asyncio
async def test_feishu_authorize_defaults_offline_access_and_dedupes(monkeypatch):
    """飞书缺省 scope 必须含 offline_access(官方:否则换取响应不带 refresh_token)。

    用户显式传入的额外 scope 不得被覆盖;重复传 offline_access 也不叠加。
    """
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
            "app_id": "cli_test",
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
        default_resp = await client.get("/api/connectors/feishu/oauth/authorize")
        dup_resp = await client.get(
            "/api/connectors/feishu/oauth/authorize",
            params={"oauth_scope": "offline_access contact:contact"},
        )
    assert default_resp.status_code == 200, default_resp.text
    assert dup_resp.status_code == 200, dup_resp.text
    default_scopes = parse_qs(urlparse(default_resp.json()["url"]).query)["scope"][0].split()
    dup_scopes = parse_qs(urlparse(dup_resp.json()["url"]).query)["scope"][0].split()
    assert default_scopes == ["offline_access"], "缺省必须带 offline_access 才能换到 refresh_token"
    assert dup_scopes == ["offline_access", "contact:contact"], "用户 scope 保留且 offline_access 不重复"


@pytest.mark.asyncio
async def test_authorize_rejects_mismatched_redirect_uri(monkeypatch):
    """authorize 不接受自定义 redirect_uri:回调端硬编码,不一致会让 code 换不到 token。"""
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
            "app_id": "cli_test",
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
        bad = await client.get(
            "/api/connectors/feishu/oauth/authorize",
            params={"redirect_uri": "https://attacker.example.com/cb"},
        )
        good = await client.get(
            "/api/connectors/feishu/oauth/authorize",
            params={"redirect_uri": "https://app.example.com/callback"},
        )
    assert bad.status_code == 400, bad.text
    assert "redirect_uri" in bad.json()["error"]
    assert good.status_code == 200, good.text


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
    assert headers["x-acs-dingtalk-access-token"] == "dt-from-code"
    assert "Authorization" not in headers
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


# ---------------------------------------------------------------------------
# 按平台解析回调地址:凭据 extra → 平台 env → 通用 env → 站点默认
# 生产根因:ai-service 的 .env 未把 NEXT_PUBLIC_* 同步进 os.environ,旧实现
# 只读 _oauth_redirect_uri() → authorize 必报「未配置回调地址」。
# ---------------------------------------------------------------------------


def _clean_redirect_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in (
        "CONNECTOR_OAUTH_REDIRECT_URI",
        "FEISHU_REDIRECT_URI",
        "NEXT_PUBLIC_FEISHU_REDIRECT_URI",
        "DINGTALK_REDIRECT_URI",
        "NEXT_PUBLIC_DINGTALK_REDIRECT_URI",
    ):
        monkeypatch.delenv(name, raising=False)


def test_resolve_redirect_tenant_credential_extra_wins(monkeypatch):
    """生产钉钉租户凭据 extra.redirect_uri 必须优先 —— 无需改服务环境即可授权。"""
    from app.routers import connectors as router_mod

    _clean_redirect_env(monkeypatch)
    monkeypatch.setenv("FEISHU_REDIRECT_URI", "https://env.example.com/callback?platform=dingtalk")
    cred = {
        "app_id": "dingkey",
        "app_secret": "sec",
        "extra": {"redirect_uri": "https://aizhs.top/callback?platform=dingtalk"},
    }
    assert router_mod._resolve_oauth_redirect_uri("dingtalk", cred) == (
        "https://aizhs.top/callback?platform=dingtalk"
    )


def test_resolve_redirect_platform_env_then_generic_then_site_default(monkeypatch):
    """四级优先级逐层验证,且站点默认按平台区分(飞书/钉钉不串台)。"""
    from app.routers import connectors as router_mod

    _clean_redirect_env(monkeypatch)
    # 4) 站点默认
    assert router_mod._resolve_oauth_redirect_uri("feishu") == (
        "https://aizhs.top/callback?platform=feishu"
    )
    assert router_mod._resolve_oauth_redirect_uri("dingtalk") == (
        "https://aizhs.top/callback?platform=dingtalk"
    )
    # 3) 通用 env
    monkeypatch.setenv("CONNECTOR_OAUTH_REDIRECT_URI", "https://generic.example.com/cb")
    assert router_mod._resolve_oauth_redirect_uri("feishu") == "https://generic.example.com/cb"
    monkeypatch.delenv("CONNECTOR_OAUTH_REDIRECT_URI")
    # 2) 平台专属 env 覆盖站点默认
    monkeypatch.setenv("NEXT_PUBLIC_DINGTALK_REDIRECT_URI", "https://dt.example.com/callback?platform=dingtalk")
    assert router_mod._resolve_oauth_redirect_uri("dingtalk") == (
        "https://dt.example.com/callback?platform=dingtalk"
    )
    # 飞书不受钉钉 env 影响(平台不串台)
    assert router_mod._resolve_oauth_redirect_uri("feishu") == (
        "https://aizhs.top/callback?platform=feishu"
    )


@pytest.mark.asyncio
async def test_authorize_uses_resolved_redirect_even_without_env(monkeypatch):
    """端到端:无 env 配置时 authorize 仍产出可授权 URL(生产零配置可用)。"""
    from urllib.parse import parse_qs, urlparse

    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.routers.connectors import connector_scope
    from app.services.connectors import managed

    _clean_redirect_env(monkeypatch)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_prod",
            "app_secret": "sec",
            "source": "platform_env",
            "extra": {},
        },
    )

    app = FastAPI()
    app.include_router(router_mod.router, prefix="/api")
    app.dependency_overrides[require_request_user_id] = lambda: "user-1"
    app.dependency_overrides[connector_scope] = lambda: "tenant-A"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/connectors/feishu/oauth/authorize")
    assert resp.status_code == 200, resp.text
    qs = parse_qs(urlparse(resp.json()["url"]).query)
    assert qs["redirect_uri"] == ["https://aizhs.top/callback?platform=feishu"]
    assert "offline_access" in qs["scope"][0].split()


@pytest.mark.asyncio
async def test_callback_uses_resolved_redirect_from_credential_extra(monkeypatch):
    """回调换取 code 时用的 redirect_uri 必须与 authorize 同源(凭据 extra),否则平台拒换。"""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    from app.core.jwt_auth import require_request_user_id
    from app.routers import connectors as router_mod
    from app.routers.connectors import connector_scope
    from app.services import connector_store
    from app.services.connectors import managed
    from tests._connector_fake import FakeSession

    _clean_redirect_env(monkeypatch)
    fake = FakeSession()
    monkeypatch.setattr(connector_store, "_pg_session", lambda: fake)
    monkeypatch.setattr(
        managed,
        "credentials",
        lambda platform, scope=None: {
            "app_id": "cli_x",
            "app_secret": "sec",
            "source": "platform_env",
            "extra": {"redirect_uri": "https://aizhs.top/callback?platform=feishu"},
        },
    )

    captured: dict[str, Any] = {}

    async def fake_exchange(cfg, code, *, app_id, app_secret, redirect_uri, http_json):
        captured["redirect_uri"] = redirect_uri
        return {
            "access_token": "u-ok",
            "refresh_token": "r-ok",
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
            "/api/connectors/oauth/callback", params={"code": "c", "state": state}
        )
    assert resp.status_code == 200, resp.text
    assert captured["redirect_uri"] == "https://aizhs.top/callback?platform=feishu"
