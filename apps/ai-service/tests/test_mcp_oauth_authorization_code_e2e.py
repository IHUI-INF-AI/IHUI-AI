# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP OAuth 授权码全流程(authorization_code + PKCE + 回调)真网 E2E。

对标 H2 硬性指标:MCP 远程 Streamable HTTP + OAuth 授权码全流程(含回调)。

本地起三件真实设施(全部 127.0.0.1 loopback,CI 可跑,无需外网):
1. 授权服务器(Starlette + uvicorn):
   - GET /metadata:RFC 8414 authorization server metadata
     (authorization_endpoint + token_endpoint)
   - GET /authorize:校验 response_type/client_id/PKCE(S256) 后签发授权码,
     302 重定向回 redirect_uri?code=...&state=...(模拟用户浏览器授权跳转)
   - POST /token:校验授权码一次性有效 + PKCE code_verifier 的 S256 派生
     与授权请求中的 code_challenge 一致,通过才发 access_token
2. 强校验 Bearer 的真实 MCP 服务器(官方 mcp SDK MCPServer + ASGI 中间件)

被测链路(全部真网 HTTP,无 mock):
  build_authorization_url_async() 构造授权 URL(含 PKCE)
  → httpx 模拟用户访问授权 URL,解析 302 回调拿 code + state
  → set_authorization_code(code) 注入
  → get_token() 携 code_verifier 换 access_token(PKCE 真实校验)
  → MCPClient(Streamable HTTP)连接,Bearer 真网注入并被服务器校验通过
  → initialize → tools/list → tools/call 全链路断言
"""

from __future__ import annotations

import base64
import hashlib
import socket
import threading
import time
import urllib.parse
from typing import Any

import httpx
import pytest
import uvicorn
from mcp.server.mcpserver import MCPServer
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, RedirectResponse
from starlette.routing import Route

from app.services.mcp_client import (
    TRANSPORT_STREAMABLE_HTTP,
    MCPClient,
    MCPClientConfig,
)
from app.services.mcp_oauth import (
    MCPOAuthClient,
    MCPOAuthConfig,
    MCPOAuthToken,
)

DEFAULT_TIMEOUT = 10.0

# 授权服务器/资源服务器共享的期望值
E2E_CLIENT_ID = "e2e-authcode-client"
E2E_CLIENT_SECRET = "e2e-authcode-secret"
E2E_REDIRECT_URI = "http://127.0.0.1:7777/callback"  # 本测试不真实监听,只解析 302
E2E_BEARER_TOKEN = "authcode-access-token-xyz"
E2E_EXPECTED_AUTH = f"Bearer {E2E_BEARER_TOKEN}"

# 授权服务器运行期状态(签发的授权码 + 审计计数)
_AUTHZ_STATE: dict[str, Any] = {
    # code -> {"challenge": str, "used": bool}
    "codes": {},
    "authorize_calls": 0,
    "token_ok_calls": 0,
    "token_rejected": 0,
    "last_form": {},
}

# 资源服务器(MCP)运行期状态
_MCP_AUTH_STATE: dict[str, Any] = {
    "last_auth": "",
    "rejected": 0,
}


def _free_port() -> int:
    """占用一个空闲端口后立即释放,供 uvicorn 复用。"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _serve(app: Any, port: int) -> uvicorn.Server:
    """在后台线程内用 uvicorn 起真实 HTTP 服务,并等待就绪。"""
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(100):
        try:
            httpx.get(f"http://127.0.0.1:{port}/", timeout=0.3)
            return server
        except Exception:  # noqa: BLE001 - 就绪探测失败即连接被拒,继续重试
            time.sleep(0.05)
    raise RuntimeError(f"E2E 授权服务器无法启动 127.0.0.1:{port}")


def _build_mcp_server(name: str) -> MCPServer:
    """用官方 mcp SDK 构建带 echo/add 两个工具的真实 MCP 服务器。"""
    mcp = MCPServer(name)

    async def echo(text: str) -> str:
        return text

    async def add(a: int, b: int) -> int:
        return a + b

    mcp.add_tool(echo, name="echo", description="原样返回文本")
    mcp.add_tool(add, name="add", description="两个整数求和")
    return mcp


def _require_bearer(app: Any) -> Any:
    """ASGI 中间件:校验 `Authorization: Bearer <token>`,不符则 401 拒绝。"""

    async def dispatched(scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        auth = headers.get(b"authorization", b"").decode("latin-1")
        if auth != E2E_EXPECTED_AUTH:
            _MCP_AUTH_STATE["rejected"] += 1
            resp = JSONResponse({"error": "invalid_token"})
            await resp(scope, receive, send)
            return
        _MCP_AUTH_STATE["last_auth"] = auth
        await app(scope, receive, send)

    return dispatched


def _build_authorization_server_app() -> Starlette:
    """极简但真实的授权服务器:metadata / authorize / token 三端点。"""

    async def metadata_ep(request: Request) -> JSONResponse:
        base = str(request.base_url).rstrip("/")
        return JSONResponse(
            {
                "issuer": base,
                "authorization_endpoint": f"{base}/authorize",
                "token_endpoint": f"{base}/token",
                "grant_types_supported": [
                    "authorization_code",
                    "refresh_token",
                    "client_credentials",
                ],
                "code_challenge_methods_supported": ["S256"],
            }
        )

    async def authorize_ep(request: Request) -> RedirectResponse:
        q = dict(request.query_params)
        _AUTHZ_STATE["authorize_calls"] += 1
        # 授权端点契约校验(不满足即 400,模拟真实 AS 的拒绝行为)
        if q.get("response_type") != "code":
            return JSONResponse({"error": "unsupported_response_type"}, status_code=400)
        if q.get("client_id") != E2E_CLIENT_ID:
            return JSONResponse({"error": "unauthorized_client"}, status_code=400)
        challenge = q.get("code_challenge", "")
        if not challenge or q.get("code_challenge_method") != "S256":
            return JSONResponse({"error": "invalid_request"}, status_code=400)
        # 签发一次性授权码,绑定 PKCE challenge(资源端换 token 时校验)
        code = f"code-{_AUTHZ_STATE['authorize_calls']}-{int(time.time() * 1000)}"
        _AUTHZ_STATE["codes"][code] = {"challenge": challenge, "used": False}
        redirect = q.get("redirect_uri", E2E_REDIRECT_URI)
        sep = "&" if "?" in redirect else "?"
        quoted_code = urllib.parse.quote(code)
        quoted_state = urllib.parse.quote(q.get("state", ""))
        location = f"{redirect}{sep}code={quoted_code}&state={quoted_state}"
        return RedirectResponse(location, status_code=302)

    async def token_ep(request: Request) -> JSONResponse:
        body = await request.body()
        form = dict(urllib.parse.parse_qsl(body.decode("utf-8")))
        _AUTHZ_STATE["last_form"] = form

        def reject(error: str) -> JSONResponse:
            _AUTHZ_STATE["token_rejected"] += 1
            return JSONResponse({"error": error}, status_code=400)

        if form.get("grant_type") != "authorization_code":
            return reject("unsupported_grant_type")
        if form.get("client_id") != E2E_CLIENT_ID or form.get(
            "client_secret"
        ) != E2E_CLIENT_SECRET:
            return reject("invalid_client")
        code = form.get("code", "")
        entry = _AUTHZ_STATE["codes"].get(code)
        if entry is None:
            return reject("invalid_grant")
        if entry["used"]:
            return reject("invalid_grant")  # 授权码一次性
        verifier = form.get("code_verifier", "")
        if not verifier:
            return reject("invalid_request")  # 必须携带 PKCE
        digest = hashlib.sha256(verifier.encode("utf-8")).digest()
        derived = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
        if derived != entry["challenge"]:
            return reject("invalid_grant")  # PKCE 校验失败
        if form.get("redirect_uri") != E2E_REDIRECT_URI:
            return reject("invalid_grant")
        # 全部通过:作废授权码并发令牌
        entry["used"] = True
        _AUTHZ_STATE["token_ok_calls"] += 1
        return JSONResponse(
            {
                "access_token": E2E_BEARER_TOKEN,
                "refresh_token": "authcode-refresh-token-xyz",
                "token_type": "Bearer",
                "expires_in": 3600,
                "scope": "mcp:read mcp:call",
            }
        )

    return Starlette(
        routes=[
            Route("/metadata", endpoint=metadata_ep, methods=["GET"]),
            Route("/authorize", endpoint=authorize_ep, methods=["GET"]),
            Route("/token", endpoint=token_ep, methods=["POST"]),
        ]
    )


@pytest.fixture(scope="module")
def e2e_authcode_servers() -> dict[str, Any]:
    """模块级:授权服务器 + 强校验 Bearer 的 MCP 服务器(真实 HTTP)。"""
    port_authz = _free_port()
    port_mcp = _free_port()
    srv_authz = _serve(_build_authorization_server_app(), port_authz)
    mcp = _build_mcp_server("e2e-authcode-server")
    srv_mcp = _serve(
        _require_bearer(mcp.streamable_http_app(streamable_http_path="/mcp")), port_mcp
    )
    yield {
        "metadata_url": f"http://127.0.0.1:{port_authz}/metadata",
        "authorize_url": f"http://127.0.0.1:{port_authz}/authorize",
        "token_url": f"http://127.0.0.1:{port_authz}/token",
        "mcp_url": f"http://127.0.0.1:{port_mcp}/mcp",
    }
    srv_authz.should_exit = True
    srv_mcp.should_exit = True


def _make_config(url: str, **overrides: Any) -> MCPClientConfig:
    defaults: dict[str, Any] = {
        "name": "e2e-authcode-server",
        "transport": TRANSPORT_STREAMABLE_HTTP,
        "url": url,
        "reconnect": False,
        "timeout": DEFAULT_TIMEOUT,
    }
    defaults.update(overrides)
    return MCPClientConfig(**defaults)


def _make_oauth_client(servers: dict[str, Any]) -> MCPOAuthClient:
    return MCPOAuthClient(
        MCPOAuthConfig(
            grant_type="authorization_code",
            client_id=E2E_CLIENT_ID,
            client_secret=E2E_CLIENT_SECRET,
            auth_server_url=servers["metadata_url"],
            scopes=["mcp:read", "mcp:call"],
            redirect_uri=E2E_REDIRECT_URI,
        )
    )


async def _complete_user_consent(
    servers: dict[str, Any], oauth: MCPOAuthClient
) -> str:
    """模拟用户授权:访问授权 URL → 解析 302 回调 → 返回授权码。"""
    auth_url = await oauth.build_authorization_url_async()
    parsed = urllib.parse.urlparse(auth_url)
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == servers["authorize_url"]
    resp = httpx.get(auth_url, follow_redirects=False, timeout=DEFAULT_TIMEOUT)
    assert resp.status_code == 302, resp.text
    location = resp.headers["location"]
    callback = urllib.parse.urlparse(location)
    q = dict(urllib.parse.parse_qsl(callback.query))
    # 回调地址与 state 防伪必须原样回传
    assert f"{callback.scheme}://{callback.netloc}{callback.path}" == E2E_REDIRECT_URI
    assert q["state"] == oauth._state
    return q["code"]


async def test_e2e_authorization_code_full_flow(
    e2e_authcode_servers: dict[str, Any],
) -> None:
    """授权码全流程真网闭环:授权 URL(含 PKCE)→ 用户授权回调 → 换 token → Bearer 注入 MCP。"""
    servers = e2e_authcode_servers
    oauth = _make_oauth_client(servers)
    mcp_client: MCPClient | None = None
    try:
        # 1. 构造授权 URL:metadata 真网发现 + PKCE(S256)参数完整
        auth_url = await oauth.build_authorization_url_async()
        q = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(auth_url).query))
        assert q["response_type"] == "code"
        assert q["client_id"] == E2E_CLIENT_ID
        assert q["redirect_uri"] == E2E_REDIRECT_URI
        assert q["scope"] == "mcp:read mcp:call"
        assert q["code_challenge_method"] == "S256"
        assert len(q["code_challenge"]) >= 43  # S256 派生为 43 字符 base64url

        # 2. 模拟用户访问授权 URL → 302 回调携带 code + state
        code = await _complete_user_consent(servers, oauth)
        assert code, "回调未携带授权码"

        # 3. 注入授权码,真网换取 access_token(PKCE verifier 真实回传并被校验)
        oauth.set_authorization_code(code)
        token = await oauth.get_token()
        assert isinstance(token, MCPOAuthToken)
        assert token.access_token == E2E_BEARER_TOKEN
        assert token.refresh_token == "authcode-refresh-token-xyz"
        assert _AUTHZ_STATE["token_ok_calls"] >= 1
        # token 端点收到的表单契约:授权码 + PKCE verifier + redirect_uri
        sent = _AUTHZ_STATE["last_form"]
        assert sent["grant_type"] == "authorization_code"
        assert sent["code"] == code
        assert sent["code_verifier"] == oauth._code_verifier
        assert sent["redirect_uri"] == E2E_REDIRECT_URI

        # 4. Bearer 注入 MCP(Streamable HTTP 真网),服务器强校验通过
        mcp_client = MCPClient(_make_config(servers["mcp_url"], oauth=oauth))
        await mcp_client.connect()
        assert mcp_client.is_connected() is True
        assert _MCP_AUTH_STATE["last_auth"] == E2E_EXPECTED_AUTH

        tools = await mcp_client.list_tools()
        assert {t.name for t in tools} == {"echo", "add"}

        echo_resp = await mcp_client.call_tool("echo", {"text": "hi"})
        assert echo_resp["content"][0]["text"] == "hi"

        add_resp = await mcp_client.call_tool("add", {"a": 2, "b": 3})
        assert add_resp["content"][0]["text"] == "5"
    finally:
        if mcp_client is not None:
            await mcp_client.disconnect()
        await oauth.close()


async def test_e2e_pkce_wrong_verifier_rejected(
    e2e_authcode_servers: dict[str, Any],
) -> None:
    """负向:授权码绑定 PKCE,错误的 code_verifier 换 token 被 400 拒绝。"""
    servers = e2e_authcode_servers
    oauth = _make_oauth_client(servers)
    try:
        code = await _complete_user_consent(servers, oauth)
        resp = httpx.post(
            servers["token_url"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": E2E_REDIRECT_URI,
                "client_id": E2E_CLIENT_ID,
                "client_secret": E2E_CLIENT_SECRET,
                "code_verifier": "tampered-verifier-not-the-original",
            },
            timeout=DEFAULT_TIMEOUT,
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_grant"
        assert _AUTHZ_STATE["token_rejected"] >= 1
    finally:
        await oauth.close()


async def test_e2e_authorization_code_single_use(
    e2e_authcode_servers: dict[str, Any],
) -> None:
    """负向:授权码一次性,换过 token 后重放同一 code 被拒。"""
    servers = e2e_authcode_servers
    oauth = _make_oauth_client(servers)
    try:
        code = await _complete_user_consent(servers, oauth)
        oauth.set_authorization_code(code)
        first = await oauth.get_token()
        assert first.access_token == E2E_BEARER_TOKEN
        # 重放同一授权码:新客户端实例携带旧 code 直接打 token 端点
        resp = httpx.post(
            servers["token_url"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": E2E_REDIRECT_URI,
                "client_id": E2E_CLIENT_ID,
                "client_secret": E2E_CLIENT_SECRET,
                "code_verifier": oauth._code_verifier,
            },
            timeout=DEFAULT_TIMEOUT,
        )
        assert resp.status_code == 400
        assert resp.json()["error"] == "invalid_grant"
    finally:
        await oauth.close()


async def test_e2e_no_oauth_mcp_rejected(e2e_authcode_servers: dict[str, Any]) -> None:
    """负向:无 OAuth 凭据的 MCP 连接被资源服务器 401 拒绝。"""
    client = MCPClient(_make_config(e2e_authcode_servers["mcp_url"]))
    try:
        await client.connect()
        assert client.is_connected() is False
        assert _MCP_AUTH_STATE["rejected"] >= 1
    finally:
        await client.disconnect()
