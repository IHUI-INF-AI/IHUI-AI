# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO/OIDC 集成测试(全离线:纯函数 URL 构造 + mock provider + 未配置降级)。

AIS-043(2026-11):state 服务端一次性存储(生成登记/回调消费即删);
mock provider 仅非生产环境启用(生产缺省空清单,build_provider 拒绝构建)。
"""

from __future__ import annotations

import datetime as _dt
import time as _time

import jwt as _pyjwt
import pytest
from cryptography.hazmat.primitives import serialization as _ser
from cryptography.hazmat.primitives.asymmetric import rsa as _rsa

from app.core import sso as core_sso
from app.core.config import settings
from app.core.sso import (
    MockSSOProvider,
    OIDCSSOProvider,
    SSOConfigError,
    UserIdentity,
    build_oidc_authorize_url,
    build_provider,
    list_enabled_providers,
    new_state,
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


# ---------------- id_token 验签(SSO-P2 安全加固) ----------------


def _rsa2048():
    """生成 (私钥PEM, 公钥PEM) 用于本地签名 id_token(离线)。"""
    priv = _rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv_pem = priv.private_bytes(
        _ser.Encoding.PEM, _ser.PrivateFormat.PKCS8, _ser.NoEncryption()
    )
    pub_pem = priv.public_key().public_bytes(
        _ser.Encoding.PEM, _ser.PublicFormat.SubjectPublicKeyInfo
    )
    return priv_pem, pub_pem


def _sign(priv_pem: bytes, claims: dict, alg: str = "RS256") -> str:
    now = int(_dt.datetime.now(_dt.UTC).timestamp())
    payload = {
        "exp": now + 300,
        "nbf": now - 30,
        "iat": now,
        "iss": "https://idp.example.com",
        "aud": "ihui-web",
        "sub": "u-1",
        **claims,
    }
    return _pyjwt.encode(payload, priv_pem, algorithm=alg)


def _provider():
    return OIDCSSOProvider(
        issuer="https://idp.example.com",
        client_id="ihui-web",
        redirect_uri="https://app/cb",
        jwks_uri="https://idp.example.com/keys",
    )


def test_decode_id_token_valid_rs256():
    priv, pub = _rsa2048()
    token = _sign(priv, {"email": "a@x.io"})
    claims = _provider()._decode_id_token(
        token, signing_key=pub, client_id="ihui-web", issuer="https://idp.example.com"
    )
    assert claims["sub"] == "u-1"
    assert claims["email"] == "a@x.io"


def test_decode_id_token_rejects_forged_signature():
    priv, _pub = _rsa2048()
    _other_priv, other_pub = _rsa2048()  # 攻击者公钥 ≠ 签名者公钥
    token = _sign(priv, {})  # 用真签名者私钥签,但用 "错误" 公钥验 → 必然失败
    with pytest.raises(RuntimeError, match="验签失败"):
        _provider()._decode_id_token(
            token, signing_key=other_pub, client_id="ihui-web", issuer="https://idp.example.com"
        )


def test_decode_id_token_rejects_none_alg():
    priv, _pub = _rsa2048()
    now = int(_dt.datetime.now(_dt.UTC).timestamp())
    token = _pyjwt.encode(
        {
            "exp": now + 300,
            "nbf": now - 30,
            "iat": now,
            "iss": "https://idp.example.com",
            "aud": "ihui-web",
            "sub": "u-1",
        },
        key=None,
        algorithm="none",
    )
    with pytest.raises(RuntimeError, match="验签失败"):
        _provider()._decode_id_token(
            token, signing_key=b"whatever", client_id="ihui-web", issuer="https://idp.example.com"
        )


def test_decode_id_token_rejects_wrong_audience():
    priv, pub = _rsa2048()
    token = _sign(priv, {})
    with pytest.raises(RuntimeError, match="验签失败"):
        _provider()._decode_id_token(
            token, signing_key=pub, client_id="wrong-client", issuer="https://idp.example.com"
        )


def test_decode_id_token_rejects_wrong_issuer():
    priv, pub = _rsa2048()
    token = _sign(priv, {})
    with pytest.raises(RuntimeError, match="验签失败"):
        _provider()._decode_id_token(
            token, signing_key=pub, client_id="ihui-web", issuer="https://evil.example.com"
        )


def test_decode_id_token_rejects_nonce_mismatch():
    priv, pub = _rsa2048()
    token = _sign(priv, {"nonce": "n-abc"})
    p = _provider()
    # nonce 匹配 → 通过
    claims = p._decode_id_token(
        token, signing_key=pub,
        client_id="ihui-web", issuer="https://idp.example.com", nonce="n-abc",
    )
    assert claims["sub"] == "u-1"
    # nonce 不匹配 → 拒绝(重放防护)
    with pytest.raises(RuntimeError, match="nonce"):
        p._decode_id_token(
            token,
            signing_key=pub,
            client_id="ihui-web",
            issuer="https://idp.example.com",
            nonce="n-xyz",
        )


def test_decode_id_token_skips_nonce_when_none_supplied():
    """未绑定 nonce 时不做 nonce 强制校验(兼容无状态授权流)。"""
    priv, pub = _rsa2048()
    token = _sign(priv, {})  # token 无 nonce
    claims = _provider()._decode_id_token(
        token, signing_key=pub, client_id="ihui-web", issuer="https://idp.example.com"
    )
    assert claims["sub"] == "u-1"


# ---------------- AIS-043:state 服务端存储 / 比对 / 消费 ----------------


async def test_authorize_registers_state(client):
    """authorize 生成的 state 已在服务端登记,可被回调一次性消费。"""
    from urllib.parse import parse_qs, urlparse

    resp = await client.get("/api/sso/mock/authorize", follow_redirects=False)
    assert resp.status_code == 302
    state = parse_qs(urlparse(resp.headers["location"]).query)["state"][0]
    assert state in core_sso._states
    ok = await client.get(f"/api/sso/callback?provider=mock&code=c1&state={state}")
    assert ok.status_code == 200
    assert state not in core_sso._states  # 消费即删


async def test_callback_get_requires_state(client):
    """缺 state → 400(不再 parse 后丢弃 _state)。"""
    resp = await client.get("/api/sso/callback?provider=mock&code=c1")
    assert resp.status_code == 400
    assert "state" in resp.json()["detail"]


async def test_callback_get_rejects_forged_state(client):
    """伪造/猜测 state → 400。"""
    resp = await client.get(
        "/api/sso/callback?provider=mock&code=c1&state=attacker-guess"
    )
    assert resp.status_code == 400


async def test_callback_get_state_consumed_once(client):
    """合法 state 首次通过;消费即删 → 同一 state 重放 400(不可重放)。"""
    state = new_state()
    url = f"/api/sso/callback?provider=mock&code=c1&state={state}"
    first = await client.get(url)
    assert first.status_code == 200
    assert first.json()["data"]["subject"] == "mock-user-1"
    assert state not in core_sso._states
    replay = await client.get(url)
    assert replay.status_code == 400


async def test_callback_get_rejects_expired_state(client):
    """超过 TTL 的 state → 400。"""
    state = new_state()
    core_sso._states[state] = _time.time() - 1  # 钉成已过期
    resp = await client.get(f"/api/sso/callback?provider=mock&code=c1&state={state}")
    assert resp.status_code == 400
    assert state not in core_sso._states


async def test_post_callback_state_validated_when_supplied(client):
    """POST 携带 state → 与 GET 同规格比对+消费(重放拒);不带 state 的直连仍放行。"""
    state = new_state()
    payload = {"provider": "mock", "code": "c1", "state": state}
    ok = await client.post("/api/sso/callback", json=payload)
    assert ok.status_code == 200
    replay = await client.post("/api/sso/callback", json=payload)
    assert replay.status_code == 400
    plain = await client.post("/api/sso/callback", json={"provider": "mock", "code": "c1"})
    assert plain.status_code == 200


# ---------------- AIS-043:mock provider 仅非生产启用 ----------------


def test_list_enabled_providers_production_default_empty(monkeypatch):
    """生产缺省(无 SSO_PROVIDERS)→ 空清单,不再默认提供 mock。"""
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.delenv("SSO_PROVIDERS", raising=False)
    assert list_enabled_providers() == []


def test_list_enabled_providers_dev_default_mock(monkeypatch):
    """非生产缺省仍是 mock(开发便利不变;conftest 已钉 node_env=development)。"""
    monkeypatch.delenv("SSO_PROVIDERS", raising=False)
    assert settings.node_env != "production"
    assert [p.name for p in list_enabled_providers()] == ["mock"]


def test_build_provider_mock_refused_in_production(monkeypatch):
    """生产下构造 mock provider → SSOConfigError(直连 authorize/callback 的拦截点)。"""
    monkeypatch.setattr(settings, "node_env", "production")
    with pytest.raises(SSOConfigError, match="mock"):
        build_provider("mock")


def test_explicit_mock_provider_still_refused_in_production(monkeypatch):
    """即便显式 SSO_PROVIDERS=mock,生产同样拒绝构建(清单跳过并告警)。"""
    monkeypatch.setattr(settings, "node_env", "production")
    monkeypatch.setenv("SSO_PROVIDERS", "mock")
    with pytest.raises(SSOConfigError, match="mock"):
        build_provider("mock")
    assert list_enabled_providers() == []


async def test_mock_endpoints_refused_in_production(client, monkeypatch):
    """工单触发路径:生产下 GET /sso/mock/authorize 与
    POST /api/sso/callback {provider:mock} 均 404(不再同身份发 token)。"""
    monkeypatch.setattr(settings, "node_env", "production")
    auth = await client.get("/api/sso/mock/authorize", follow_redirects=False)
    assert auth.status_code == 404
    cb = await client.post("/api/sso/callback", json={"provider": "mock", "code": "x"})
    assert cb.status_code == 404
