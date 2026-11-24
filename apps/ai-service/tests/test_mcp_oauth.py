# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP OAuth 客户端单元测试(2026-09-03 立,P2)。

面向 MCP Streamable HTTP 传输的 OAuth 授权/令牌管理细粒度单测,位于 services/mcp_oauth.py:
- build_authorization_url_async:授权码流构造回调 URL + PKCE(RFC 7636)S256 challenge
- fetch_token:authorization_code / client_credentials 两种换取,失败抛 MCPOAuthError 且不误存
- _refresh:refresh_token 换新令牌;缺失时回退全量获取
- get_token:三分支(未过期复用 / 过期有 refresh 刷新 / 否则全量获取)
- inject:Bearer 注入副本;token_type 自定义;无 token 返回副本
- close:释放 httpx client 不抛异常
- 令牌隔离:refresh 新建 MCPOAuthToken 实例,不污染旧令牌

隔离策略:
- patch `httpx.AsyncClient` 构造为 Mock,__init__ 拿到假 client,不发任何真实网络请求
- 每测试为 client 注入状态/响应,断言请求体与返回令牌
"""

from __future__ import annotations

import base64
import hashlib
import time
import urllib.parse
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.mcp_oauth import (
    MCPOAuthClient,
    MCPOAuthConfig,
    MCPOAuthError,
    MCPOAuthToken,
)


def _resp(status: int = 200, payload: dict | None = None, text: str = "") -> MagicMock:
    """构造伪 httpx 响应:status_code / json() / text / raise_for_status。"""
    r = MagicMock()
    r.status_code = status
    r.json.return_value = payload if payload is not None else {}
    r.text = text
    return r


@pytest.fixture
def http() -> MagicMock:
    """伪 httpx client:get/post/aclose 均为 AsyncMock,默认 404 防误触真网。"""
    m = MagicMock()
    m.get = AsyncMock(return_value=_resp(404))
    m.post = AsyncMock(return_value=_resp(404))
    m.aclose = AsyncMock()
    return m


@pytest.fixture
def make_client(http: MagicMock):
    """在 patch 掉 httpx.AsyncClient 的前提下构造 MCPOAuthClient(默认 client_credentials)。"""

    def _make(**kw: object) -> MCPOAuthClient:
        defaults: dict[str, object] = {
            "client_id": "client-1",
            "client_secret": "secret-1",
            "grant_type": "client_credentials",
            "token_url": "http://auth/token",
            "scopes": ["read", "write"],
            "redirect_uri": "http://127.0.0.1:9999/cb",
        }
        defaults.update(kw)
        cfg = MCPOAuthConfig(**defaults)
        with patch("app.services.mcp_oauth.httpx.AsyncClient", return_value=http):
            return MCPOAuthClient(cfg)

    return _make


async def test_authorization_url_builds_with_pkce(
    make_client, http: MagicMock
) -> None:
    """授权码流:构造的跳转 URL 含 client_id/redirect_uri/scope/state 且启用 PKCE(S256)。"""
    http.get.return_value = _resp(
        200, {"authorization_endpoint": "http://auth/authorize"}
    )
    client = make_client(
        grant_type="authorization_code",
        auth_server_url="http://auth/.well-known/oauth-authorization-server",
    )
    try:
        url = await client.build_authorization_url_async()
        assert url.startswith("http://auth/authorize?")
        qs = urllib.parse.parse_qs(url.split("?", 1)[1])
        assert qs["response_type"] == ["code"]
        assert qs["client_id"] == ["client-1"]
        assert qs["redirect_uri"] == ["http://127.0.0.1:9999/cb"]
        assert qs["scope"] == ["read write"]
        assert qs["state"] and qs["state"][0]
        # PKCE 已启用
        assert qs["code_challenge"] and qs["code_challenge"][0]
        assert qs["code_challenge_method"] == ["S256"]
        assert client._code_verifier
        expect = (
            base64.urlsafe_b64encode(
                hashlib.sha256(client._code_verifier.encode("utf-8")).digest()
            )
            .rstrip(b"=")
            .decode("ascii")
        )
        assert qs["code_challenge"][0] == expect
    finally:
        await client.close()


async def test_fetch_token_success(make_client, http: MagicMock) -> None:
    """client_credentials 换取:正确字段解析并保存 token。"""
    http.post.return_value = _resp(
        200,
        {
            "access_token": "tok-1",
            "refresh_token": "refr-1",
            "token_type": "Bearer",
            "scope": "read",
            "expires_in": 3600,
        },
    )
    client = make_client()
    try:
        tok = await client.fetch_token()
    finally:
        await client.close()
    assert tok.access_token == "tok-1"
    assert tok.refresh_token == "refr-1"
    assert tok.token_type == "Bearer"
    assert tok.scope == "read"
    assert tok.expires_in == 3600
    assert tok.obtained_at > 0
    assert tok.is_expired() is False
    # 请求体:client_credentials + 携带 scope
    _, kwargs = http.post.call_args
    assert kwargs["data"]["grant_type"] == "client_credentials"
    assert kwargs["data"]["client_id"] == "client-1"
    assert kwargs["data"]["scope"] == "read write"


async def test_fetch_token_http_error_does_not_store(make_client, http) -> None:
    """非 2xx 响应:抛 MCPOAuthError,且不误存 token。"""
    http.post.return_value = _resp(
        400, {"error": "invalid_client", "error_description": "bad client"}
    )
    with patch("app.services.mcp_oauth.DEFAULT_RETRY_DELAY", 0.0):
        client = make_client()
        try:
            with pytest.raises(MCPOAuthError):
                await client.fetch_token()
        finally:
            await client.close()
    assert client._token is None
    assert client.access_token() == ""


async def test_fetch_token_network_error_does_not_store(make_client, http) -> None:
    """网络异常:重试后抛 MCPOAuthError,且不误存 token。"""
    http.post.side_effect = httpx.ConnectError("boom")
    with patch("app.services.mcp_oauth.DEFAULT_RETRY_DELAY", 0.0):
        client = make_client()
        try:
            with pytest.raises(MCPOAuthError):
                await client.fetch_token()
        finally:
            await client.close()
    assert client._token is None


async def test_refresh_uses_refresh_token(make_client, http) -> None:
    """_refresh:用 grant_type=refresh_token 换新,旧 refresh_token 带出。"""
    old = MCPOAuthToken(access_token="old", refresh_token="refr", expires_in=1)
    old.obtained_at = time.time() - 3600
    http.post.return_value = _resp(
        200, {"access_token": "new", "refresh_token": "refr2", "expires_in": 3600}
    )
    client = make_client()
    client._token = old
    try:
        tok = await client._refresh()
    finally:
        await client.close()
    assert tok.access_token == "new"
    assert tok.refresh_token == "refr2"
    assert client._token is tok
    _, kwargs = http.post.call_args
    assert kwargs["data"]["grant_type"] == "refresh_token"
    assert kwargs["data"]["refresh_token"] == "refr"


async def test_refresh_falls_back_full_fetch(make_client, http) -> None:
    """_refresh:refresh_token 缺失时回退全量 client_credentials 获取。"""
    old = MCPOAuthToken(access_token="old", refresh_token="", expires_in=1)
    old.obtained_at = time.time() - 3600
    http.post.return_value = _resp(200, {"access_token": "fresh-cc", "expires_in": 3600})
    client = make_client()
    client._token = old
    try:
        tok = await client._refresh()
    finally:
        await client.close()
    assert tok.access_token == "fresh-cc"
    _, kwargs = http.post.call_args
    assert kwargs["data"]["grant_type"] == "client_credentials"


async def test_get_token_reuses_valid(make_client, http) -> None:
    """get_token 分支①:未过期直接复用,不发任何新请求。"""
    tok = MCPOAuthToken(access_token="valid", refresh_token="r", expires_in=3600)
    client = make_client()
    client._token = tok
    try:
        got = await client.get_token()
    finally:
        await client.close()
    assert got is tok
    http.post.assert_not_called()
    http.get.assert_not_called()


async def test_get_token_refreshes_when_expired(make_client, http) -> None:
    """get_token 分支②:过期且有 refresh_token → 走刷新。"""
    old = MCPOAuthToken(access_token="old", refresh_token="r", expires_in=1)
    old.obtained_at = time.time() - 3600
    http.post.return_value = _resp(200, {"access_token": "refreshed", "expires_in": 3600})
    client = make_client()
    client._token = old
    try:
        got = await client.get_token()
    finally:
        await client.close()
    assert got.access_token == "refreshed"
    _, kwargs = http.post.call_args
    assert kwargs["data"]["grant_type"] == "refresh_token"


async def test_get_token_full_fetch_when_no_refresh(make_client, http) -> None:
    """get_token 分支③:过期且无 refresh_token → 全量获取。"""
    old = MCPOAuthToken(access_token="old", refresh_token="", expires_in=1)
    old.obtained_at = time.time() - 3600
    http.post.return_value = _resp(200, {"access_token": "fetched-cc", "expires_in": 3600})
    client = make_client()
    client._token = old
    try:
        got = await client.get_token()
    finally:
        await client.close()
    assert got.access_token == "fetched-cc"
    _, kwargs = http.post.call_args
    assert kwargs["data"]["grant_type"] == "client_credentials"


def test_inject_bearer_copy_does_not_mutate_original(make_client) -> None:
    """inject:有 token 时注入 Bearer 到返回副本,原 dict 不变。"""
    client = make_client()
    client._token = MCPOAuthToken(access_token="at", token_type="Bearer", expires_in=3600)
    orig = {"X": "1"}
    out = client.inject(orig)
    assert out is not orig
    assert out["Authorization"] == "Bearer at"
    assert out["X"] == "1"
    assert "Authorization" not in orig


def test_inject_custom_token_type(make_client) -> None:
    """inject:token_type 非 Bearer 时用自定义类型。"""
    client = make_client()
    client._token = MCPOAuthToken(access_token="at", token_type="DPoP", expires_in=3600)
    out = client.inject({})
    assert out["Authorization"] == "DPoP at"


def test_inject_no_token_returns_copy(make_client) -> None:
    """inject:无 token 时返回原 dict 副本(不含 Authorization)。"""
    client = make_client()
    client._token = None
    orig = {"X": "1"}
    out = client.inject(orig)
    assert out == {"X": "1"}
    assert out is not orig
    assert "Authorization" not in out


async def test_close_no_raise(make_client, http) -> None:
    """close:关闭底层 httpx client 不抛异常。"""
    client = make_client()
    await client.close()
    http.aclose.assert_awaited_once()
    # 二次 close 依旧安全
    await client.close()


async def test_isolated_tokens_after_refresh(make_client, http) -> None:
    """令牌隔离:refresh 返回新实例,不污染旧 access_token。"""
    tok1 = MCPOAuthToken(access_token="old", refresh_token="r", expires_in=3600)
    http.post.return_value = _resp(200, {"access_token": "new", "expires_in": 3600})
    client = make_client()
    client._token = tok1
    try:
        got = await client._refresh()
    finally:
        await client.close()
    assert got is not tok1
    assert got.access_token == "new"
    assert client._token is got
    assert tok1.access_token == "old"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
