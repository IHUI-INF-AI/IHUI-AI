# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO/OIDC 集成测试(全离线:纯函数 URL 构造 + mock provider + 未配置降级)。"""

from __future__ import annotations

import pytest

from app.core.sso import (
    MockSSOProvider,
    OIDCSSOProvider,
    SSOConfigError,
    UserIdentity,
    build_oidc_authorize_url,
    list_enabled_providers,
    oidc_endpoints_from_issuer,
    parse_callback_params,
)


# ---------------- 纯函数层 ----------------


def test_oidc_endpoints_default_and_override():
    auth, token = oidc_endpoints_from_issuer("https://idp.example.com/realms/ihui/")
    assert auth == "https://idp.example.com/realms/ihui/authorize"
    assert token == "https://idp.example.com/realms/ihui/token"
    auth, token = oidc_endpoints_from_issuer(
        "https://idp.example.com",
        auth_endpoint="https://custom/auth",
        token_endpoint="https://custom/token",
    )
    assert (auth, token) == ("https://custom/auth", "https://custom/token")


def test_build_authorize_url_contains_required_params():
    url = build_oidc_authorize_url(
        issuer="https://idp.example.com",
        client_id="ihui-web",
        redirect_uri="http://localhost:8803/api/sso/callback",
        state="abc123",
        nonce="n-42",
    )
    assert url.startswith("https://idp.example.com/authorize?")
    for frag in (
        "response_type=code",
        "client_id=ihui-web",
        "state=abc123",
        "nonce=n-42",
        "scope=openid+profile+email",  # urlencode 默认用 + 编码空格
        "redirect_uri=http%3A%2F%2Flocalhost%3A8803%2Fapi%2Fsso%2Fcallback",
    ):
        assert frag in url


def test_build_authorize_url_missing_config_raises():
    with pytest.raises(SSOConfigError):
        build_oidc_authorize_url(
            client_id="c", redirect_uri="r", state="s"
        )  # issuer 与 auth_endpoint 均空


def test_build_authorize_url_endpoint_with_existing_query():
    url = build_oidc_authorize_url(
        auth_endpoint="https://idp.example.com/auth?tenant=1",
        client_id="c",
        redirect_uri="r",
        state="s",
    )
    assert "?tenant=1&response_type=code" in url


def test_parse_callback_params():
    code, state = parse_callback_params({"code": "c1", "state": "s1"})
    assert (code, state) == ("c1", "s1")
    with pytest.raises(SSOConfigError, match="缺少 code"):
        parse_callback_params({"state": "s"})
    with pytest.raises(SSOConfigError, match="access_denied"):
        parse_callback_params({"error": "access_denied"})


# ---------------- Provider 对象 ----------------


def test_mock_provider_protocol():
    p = MockSSOProvider()
    assert isinstance(p, OIDCSSOProvider) is False
    url = p.authorize_url(state="st")
    assert "state=st" in url and "code=mock-auth-code" in url


async def test_mock_exchange_returns_identity():
    p = MockSSOProvider(identity=UserIdentity(subject="s9", email="e@x.io", provider="mock"))
    ident = await p.exchange_code("any-code")
    assert ident.subject == "s9"
    assert ident.email == "e@x.io"
    with pytest.raises(SSOConfigError):
        await p.exchange_code("")


def test_oidc_provider_unconfigured_gates():
    p = OIDCSSOProvider(client_id="", issuer="", redirect_uri="")
    assert p.configured is False
    with pytest.raises(SSOConfigError):
        p.authorize_url(state="s")


def test_oidc_provider_configured_via_auth_endpoint():
    p = OIDCSSOProvider(
        auth_endpoint="https://idp.example.com/auth",
        client_id="cid",
        redirect_uri="https://app/cb",
    )
    assert p.configured is True
    url = p.authorize_url(state="zz")
    assert url.startswith("https://idp.example.com/auth?")
    assert "client_id=cid" in url


# ---------------- 环境变量骨架 / registry ----------------


def test_list_enabled_providers_defaults_to_mock(monkeypatch):
    monkeypatch.delenv("SSO_PROVIDERS", raising=False)
    names = [p.name for p in list_enabled_providers()]
    assert names == ["mock"]


def test_list_enabled_providers_lists_unconfigured_oidc(monkeypatch):
    monkeypatch.setenv("SSO_PROVIDERS", "oidc,mock")
    monkeypatch.delenv("SSO_OIDC_CLIENT_ID", raising=False)
    providers = list_enabled_providers()
    by_name = {p.name: p for p in providers}
    assert set(by_name) == {"oidc", "mock"}
    assert by_name["oidc"].configured is False  # type: ignore[attr-defined]


def test_list_enabled_providers_configured_oidc(monkeypatch):
    monkeypatch.setenv("SSO_PROVIDERS", "oidc")
    monkeypatch.setenv("SSO_OIDC_ISSUER", "https://idp.example.com")
    monkeypatch.setenv("SSO_OIDC_CLIENT_ID", "cid")
    monkeypatch.setenv("SSO_REDIRECT_URI", "https://app/cb")
    providers = list_enabled_providers()
    assert len(providers) == 1
    assert providers[0].configured is True  # type: ignore[attr-defined]


# ---------------- Router 端点(离线降级路径) ----------------


async def test_sso_providers_endpoint(client, monkeypatch):
    monkeypatch.delenv("SSO_PROVIDERS", raising=False)
    resp = await client.get("/api/sso/providers")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    names = [p["name"] for p in body["data"]["providers"]]
    assert names == ["mock"]


async def test_sso_mock_authorize_redirects(client):
    resp = await client.get("/api/sso/mock/authorize", follow_redirects=False)
    assert resp.status_code == 302
    assert "code=mock-auth-code" in resp.headers["location"]
    assert "state=" in resp.headers["location"]


async def test_sso_unknown_provider_404(client):
    resp = await client.get("/api/sso/nonexistent/authorize")
    assert resp.status_code == 404


async def test_sso_oidc_unconfigured_501(client, monkeypatch):
    monkeypatch.delenv("SSO_OIDC_ISSUER", raising=False)
    monkeypatch.delenv("SSO_OIDC_AUTH_ENDPOINT", raising=False)
    monkeypatch.delenv("SSO_OIDC_CLIENT_ID", raising=False)
    resp = await client.get("/api/sso/oidc/authorize")
    assert resp.status_code == 501


async def test_sso_post_callback_mock(client):
    resp = await client.post("/api/sso/callback", json={"provider": "mock", "code": "c1"})
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["subject"] == "mock-user-1"
    assert data["provider"] == "mock"


async def test_sso_get_callback_missing_code_400(client):
    resp = await client.get("/api/sso/callback?provider=mock")
    assert resp.status_code == 400
