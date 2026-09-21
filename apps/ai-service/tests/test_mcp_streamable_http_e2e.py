# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Streamable HTTP MCP 真网端到端验证。

用官方 mcp SDK(mcp 2.x 的 MCPServer,前身 FastMCP)在同一进程内起一个
真实的 Streamable-HTTP MCP 服务器(uvicorn 线程),再让项目传输层
MCPClient(TRANSPORT_STREAMABLE_HTTP)通过 127.0.0.1 loopback 真网连接:

- initialize → tools/list → tools/call 完整 JSON-RPC/HTTP 往返
- echo / add 两个真实工具的结果断言
- OAuth client_credentials:本地起真实 token 端点,MCP 服务器校验
  `Authorization: Bearer <token>`,验证 OAuth 令牌注入真网到达对端
- 服务器连不上 / 鉴权缺失的失败路径要有明确断言

本测试走 127.0.0.1 loopback,无需外网,CI 可运行。
"""

from __future__ import annotations

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
from starlette.responses import JSONResponse
from starlette.routing import Route

from app.services.mcp_client import (
    DEFAULT_PROTOCOL_VERSION,
    SUPPORTED_PROTOCOL_VERSIONS,
    TRANSPORT_STREAMABLE_HTTP,
    MCPClient,
    MCPClientConfig,
)
from app.services.mcp_oauth import MCPOAuthConfig

# OAuth 真网 server 期望的 Bearer 令牌(令牌端点返回,再由客户端注入请求头)
E2E_BEARER_TOKEN = "e2e-access-token-123"
E2E_EXPECTED_AUTH = f"Bearer {E2E_BEARER_TOKEN}"

DEFAULT_TIMEOUT = 10.0


def _free_port() -> int:
    """占用一个空闲端口后立即释放,供 uvicorn 复用。"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _build_server(name: str) -> MCPServer:
    """用官方 mcp SDK 构建带 echo/add 两个工具的真实 MCP 服务器。"""
    mcp = MCPServer(name)

    async def echo(text: str) -> str:
        return text

    async def add(a: int, b: int) -> int:
        return a + b

    mcp.add_tool(echo, name="echo", description="原样返回文本")
    mcp.add_tool(add, name="add", description="两个整数求和")
    return mcp


def _serve(app: Any, port: int) -> uvicorn.Server:
    """在后台线程内用 uvicorn 起真实 HTTP 服务,并等待就绪。"""
    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    for _ in range(100):
        try:
            # 任意非异常响应即代表服务已就绪(GET / 由传输层返回 404/401 均可)
            httpx.get(f"http://127.0.0.1:{port}/", timeout=0.3)
            return server
        except Exception:  # noqa: BLE001 - 就绪探测失败即连接被拒,继续重试
            time.sleep(0.05)
    raise RuntimeError(f"E2E MCP 服务器无法启动 127.0.0.1:{port}")


def _make_config(url: str, **overrides: Any) -> MCPClientConfig:
    defaults: dict[str, Any] = {
        "name": "e2e-server",
        "transport": TRANSPORT_STREAMABLE_HTTP,
        "url": url,
        "reconnect": False,
        "timeout": DEFAULT_TIMEOUT,
    }
    defaults.update(overrides)
    return MCPClientConfig(**defaults)


@pytest.fixture(scope="module")
def e2e_mcp_url() -> Any:
    """模块级:起一个真实 Streamable-HTTP MCP 服务器,返回其 /mcp 端点。"""
    port = _free_port()
    mcp = _build_server("e2e-server")
    app = mcp.streamable_http_app(streamable_http_path="/mcp")
    server = _serve(app, port)
    yield f"http://127.0.0.1:{port}/mcp"
    server.should_exit = True


async def test_e2e_transport_connect_list_call(e2e_mcp_url: str) -> None:
    """真网闭环:initialize → tools/list → tools/call(echo / add)。"""
    client = MCPClient(_make_config(e2e_mcp_url))
    try:
        assert client.is_connected() is False
        await client.connect()
        # 真网握手成功:服务器返回了 session id,并处于 JSON 单 POST 模式
        assert client.is_connected() is True
        assert client._session_id, "服务器未下发 Mcp-Session-Id"
        assert client._http_mode == "post"
        # 默认握手向后兼容:协商回 2025-03-26,且探测到真实 serverInfo/capabilities
        assert client.negotiated_protocol() == DEFAULT_PROTOCOL_VERSION
        assert client.negotiated_protocol() == "2025-03-26"
        assert client.server_info()["name"] == "e2e-server"
        assert "tools" in client.capabilities()
        assert "experimental" in client.capabilities()

        tools = await client.list_tools()
        assert {t.name for t in tools} == {"echo", "add"}
        by_name = {t.name: t for t in tools}
        assert by_name["echo"].server_name == "e2e-server"
        assert by_name["add"].input_schema is not None

        echo_resp = await client.call_tool("echo", {"text": "hi"})
        assert echo_resp["content"][0]["text"] == "hi"

        add_resp = await client.call_tool("add", {"a": 2, "b": 3})
        assert add_resp["content"][0]["text"] == "5"
        assert add_resp["structuredContent"]["result"] == 5

        assert await client.ping() is True
    finally:
        await client.disconnect()


async def test_e2e_transport_unreachable_server_fails() -> None:
    """连不上的服务器:明确断言 connect 未成功(DNS 拒绝/端口关闭)。"""
    unused = _free_port()  # 该端口此刻空闲,任何服务未在上监听 → 连接必被拒
    client = MCPClient(_make_config(f"http://127.0.0.1:{unused}/mcp", timeout=3.0))
    try:
        await client.connect()
        assert client.is_connected() is False
        # 连接失败后,请求不得被误判为成功
        tools = await client.list_tools()
        assert tools == []
    finally:
        await client.disconnect()


async def test_e2e_protocol_negotiation_to_higher_version(e2e_mcp_url: str) -> None:
    """真网:客户端推出更高受支持版本(2025-11-25),对端真实协商到该版本并探测能力。"""
    client = MCPClient(
        _make_config(e2e_mcp_url, protocol_version=SUPPORTED_PROTOCOL_VERSIONS[-1])
    )
    try:
        await client.connect()
        assert client.is_connected() is True
        # 官方 SDK 服务器在客户端打招呼 2025-11-25 时回告同版本 → 真实提高协商版本
        assert client.negotiated_protocol() == "2025-11-25"
        # 能力探测:初始化 result 的 capabilities/serverInfo 已结构化读取
        caps = client.capabilities()
        assert caps.get("tools") is not None
        assert caps.get("prompts") is not None
        assert caps.get("resources") is not None
        assert "experimental" in caps
        assert client.server_info()["name"] == "e2e-server"
        # 协商到更高版本后工具仍可正常调用(不回归)
        echo_resp = await client.call_tool("echo", {"text": "hi"})
        assert echo_resp["content"][0]["text"] == "hi"
    finally:
        await client.disconnect()


async def test_e2e_protocol_negotiation_default_still_backward(e2e_mcp_url: str) -> None:
    """真网:默认客户端(仍带 2025-03-26)连接现代对端,后端兼容路径保持有效。"""
    client = MCPClient(_make_config(e2e_mcp_url))
    try:
        await client.connect()
        assert client.is_connected() is True
        # 不断言具体协商到哪个值(mock/真实对端不同),但必须不为空、不抛异常
        assert isinstance(client.negotiated_protocol(), str)
        assert client.negotiated_protocol() != ""
    finally:
        await client.disconnect()


# =============================================================================
# OAuth 注入真网验证(本地 token 端点 + MCP 服务器强制校验 Bearer)
# =============================================================================

# 供服务器与断言共享的运行期状态
_E2E_OAUTH_STATE: dict[str, Any] = {
    "token_calls": 0,
    "last_auth": "",
    "rejected": 0,
}


def _require_auth(app: Any) -> Any:
    """ASGI 中间件:校验 `Authorization: Bearer <token>`,不符则 401 拒绝。"""

    async def dispatched(scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await app(scope, receive, send)
            return
        headers = dict(scope["headers"])
        auth = headers.get(b"authorization", b"").decode("latin-1")
        if auth != E2E_EXPECTED_AUTH:
            _E2E_OAUTH_STATE["rejected"] += 1
            resp = JSONResponse({"error": "invalid_token"})
            await resp(scope, receive, send)
            return
        _E2E_OAUTH_STATE["last_auth"] = auth
        await app(scope, receive, send)

    return dispatched


def _build_token_app() -> Starlette:
    """极简 OAuth token 端点(POST /token,支持 client_credentials)。"""

    async def token_ep(request: Request) -> JSONResponse:
        body = await request.body()
        form = dict(urllib.parse.parse_qsl(body.decode("utf-8")))
        assert form.get("grant_type") == "client_credentials", form
        _E2E_OAUTH_STATE["token_calls"] += 1
        return JSONResponse(
            {
                "access_token": E2E_BEARER_TOKEN,
                "token_type": "Bearer",
                "expires_in": 3600,
            }
        )

    return Starlette(routes=[Route("/token", endpoint=token_ep, methods=["POST"])])


@pytest.fixture(scope="module")
def e2e_oauth_servers() -> dict[str, Any]:
    """模块级:auth 强校验的真实 MCP 服务器 + 真实 token 端点。"""
    port_mcp = _free_port()
    port_token = _free_port()
    mcp = _build_server("e2e-oauth-server")
    app = _require_auth(mcp.streamable_http_app(streamable_http_path="/mcp"))
    srv_mcp = _serve(app, port_mcp)
    srv_token = _serve(_build_token_app(), port_token)
    yield {
        "mcp_url": f"http://127.0.0.1:{port_mcp}/mcp",
        "token_url": f"http://127.0.0.1:{port_token}/token",
    }
    srv_mcp.should_exit = True
    srv_token.should_exit = True


async def test_e2e_oauth_injection_reaches_server(e2e_oauth_servers: dict[str, Any]) -> None:
    """OAuth:从真实 token 端点取令牌,真网注入 MCP 请求并被服务器校验通过。"""
    oauth = MCPOAuthConfig(
        grant_type="client_credentials",
        client_id="client-1",
        client_secret="secret-1",
        token_url=e2e_oauth_servers["token_url"],
    )
    client = MCPClient(_make_config(e2e_oauth_servers["mcp_url"], oauth=oauth))
    try:
        await client.connect()
        assert client.is_connected() is True
        # 服务器确实收到了客户端注入的 Bearer(令牌端点真实取到的值)
        assert _E2E_OAUTH_STATE["last_auth"] == E2E_EXPECTED_AUTH
        assert _E2E_OAUTH_STATE["token_calls"] >= 1
        echo_resp = await client.call_tool("echo", {"text": "hi"})
        assert echo_resp["content"][0]["text"] == "hi"
    finally:
        await client.disconnect()


async def test_e2e_oauth_missing_is_rejected(e2e_oauth_servers: dict[str, Any]) -> None:
    """无 OAuth 时连接被服务器 401 拒之门内(明确断言失败路径)。"""
    client = MCPClient(_make_config(e2e_oauth_servers["mcp_url"]))
    try:
        await client.connect()
        assert client.is_connected() is False
        assert _E2E_OAUTH_STATE["rejected"] >= 1
    finally:
        await client.disconnect()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
