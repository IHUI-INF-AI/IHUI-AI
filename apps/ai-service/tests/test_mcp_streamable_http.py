# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Streamable HTTP 传输 + OAuth 集成测试(本地 mock MCP server)。

用线程内 ThreadingHTTPServer 起一个最小 mock MCP 服务器:
- POST /mcp:处理 initialize / tools/list / tools/call / ping,返回固定 JSON
  或 SSE(随 MockState.mode 切换 "post" / "stream" 两种模式)
- POST /token:OAuth client_credentials / refresh_token 握手
- GET /metadata:OAuth authorization server metadata 发现
- 可选 require_auth:校验 `Authorization: Bearer <token>`

覆盖场景:
1. 单 POST 模式握手成功 + tools/list + call_tool + Mcp-Session-Id 回传
2. SSE 流模式(响应为 text/event-stream)
3. Authorization 头带上 Bearer token(OAuth 集成)
4. OAuth token 过期后自动刷新(refresh_token)
5. OAuth metadata 发现(token_endpoint 从 /metadata 解析)
6. 未知 transport 报错(is_connected() False)
"""

from __future__ import annotations

import json
import threading
import urllib.parse
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import pytest

from app.services.mcp_client import (
    TRANSPORT_STREAMABLE_HTTP,
    MCPClient,
    MCPClientConfig,
)
from app.services.mcp_oauth import MCPOAuthClient, MCPOAuthConfig, MCPOAuthToken


@dataclass
class MockState:
    """mock 服务器共享状态 + 请求计数(供断言)。"""

    mode: str = "post"  # "post" | "stream"
    require_auth: bool = False
    expected_token: str = ""
    expires_in: int = 3600
    base_url: str = ""
    token_calls: int = 0
    refresh_calls: int = 0
    session_id: str = "sess-demo-0001"


def _make_handler(state: MockState) -> type[BaseHTTPRequestHandler]:
    """根据 state 生成 handler 类(闭包捕获共享状态)。"""

    class _Handler(BaseHTTPRequestHandler):
        server_version = "MockMCP/1.0"

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - 屏蔽访问日志
            return

        # type ignore: BaseHTTPRequestHandler 未声明属性,实为 wfile 提供 write
        def _reply(
            self, code: int, ctype: str, body: bytes, extra: dict[str, str] | None = None
        ) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Mcp-Session-Id", state.session_id)
            for key, value in (extra or {}).items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(body)

        def _read_body(self) -> bytes:
            length = int(self.headers.get("Content-Length") or 0)
            return self.rfile.read(length) if length else b""

        def _mcp_result(self, method: str) -> dict[str, Any]:
            if method == "initialize":
                return {
                    "protocolVersion": "2025-03-26",
                    "capabilities": {},
                    "serverInfo": {"name": "mock-mcp", "version": "1.0.0"},
                }
            if method == "tools/list":
                return {
                    "tools": [
                        {
                            "name": "mock_add",
                            "description": "求和",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "a": {"type": "number"},
                                    "b": {"type": "number"},
                                },
                            },
                        }
                    ]
                }
            if method == "tools/call":
                return {"content": [{"type": "text", "text": "result-6"}]}
            return {}

        def do_GET(self) -> None:  # noqa: N802 - 标准库回调命名
            # 供 OAuth metadata 发现(GET)
            if self.path.startswith("/metadata"):
                md = {
                    "issuer": state.base_url,
                    "token_endpoint": state.base_url + "/token",
                    "authorization_endpoint": state.base_url + "/authorize",
                }
                self._reply(200, "application/json", json.dumps(md).encode("utf-8"))
                return
            # stream 模式的 GET SSE 长连接:发一个 keepalive 注释后结束
            self._reply(200, "text/event-stream", b": keepalive\n\n")

        def do_POST(self) -> None:  # noqa: N802 - 标准库回调命名
            body = self._read_body()
            # --- OAuth 端点 ---
            if self.path.startswith("/token"):
                state.token_calls += 1
                form = dict(urllib.parse.parse_qsl(body.decode("utf-8")))
                if form.get("grant_type") == "refresh_token":
                    state.refresh_calls += 1
                    payload = {
                        "access_token": "refreshed-token-Z",
                        "refresh_token": "refreshed-refresh-Z",
                        "expires_in": state.expires_in,
                        "token_type": "Bearer",
                    }
                else:
                    payload = {
                        "access_token": "access-token-X",
                        "refresh_token": "refresh-token-X",
                        "expires_in": state.expires_in,
                        "token_type": "Bearer",
                    }
                self._reply(200, "application/json", json.dumps(payload).encode("utf-8"))
                return
            if self.path.startswith("/metadata"):
                md = {
                    "issuer": state.base_url,
                    "token_endpoint": state.base_url + "/token",
                    "authorization_endpoint": state.base_url + "/authorize",
                }
                self._reply(200, "application/json", json.dumps(md).encode("utf-8"))
                return

            # --- MCP 端点(其余路径均视为 MCP) ---
            if state.require_auth:
                auth = self.headers.get("Authorization", "")
                expected = f"Bearer {state.expected_token}"
                if auth != expected:
                    self._reply(
                        401, "application/json", json.dumps({"error": "invalid_token"}).encode()
                    )
                    return
            try:
                req = json.loads(body)
            except Exception:  # noqa: BLE001 - 非法请求体按空 method 处理
                req = {}
            method = req.get("method", "")
            rid = req.get("id")
            msg: dict[str, Any] = {"jsonrpc": "2.0", "id": rid, "result": self._mcp_result(method)}
            if state.mode == "stream":
                sse = f"event: message\ndata: {json.dumps(msg)}\n\n".encode()
                self._reply(200, "text/event-stream", sse)
            else:
                self._reply(200, "application/json", json.dumps(msg).encode("utf-8"))

    return _Handler


@pytest.fixture
def mock_servers():
    """按需启动 mock 服务器的工厂 fixture;teardown 时统一关闭。"""
    servers: list[ThreadingHTTPServer] = []

    def start(state: MockState) -> MockState:
        handler = _make_handler(state)
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        state.base_url = f"http://127.0.0.1:{httpd.server_address[1]}"
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        servers.append(httpd)
        return state

    yield start
    for httpd in servers:
        httpd.shutdown()
        httpd.server_close()


def _config(mcp_url: str, **overrides: Any) -> MCPClientConfig:
    """构造 streamable_http 客户端配置(默认不开重连,避免后台任务干扰断言)。"""
    defaults: dict[str, Any] = {
        "name": "mock-server",
        "transport": TRANSPORT_STREAMABLE_HTTP,
        "url": mcp_url,
        "reconnect": False,
        "timeout": 10.0,
    }
    defaults.update(overrides)
    return MCPClientConfig(**defaults)


def _new_client(config: MCPClientConfig) -> MCPClient:
    return MCPClient(config)


async def _disconnect(client: MCPClient) -> None:
    await client.disconnect()


async def test_single_post_mode_handshake_tools_call(mock_servers) -> None:
    """单 POST 模式:握手成功、tools/list、call_tool、Mcp-Session-Id 回传。"""
    state = MockState(mode="post")
    mock_servers(state)
    client = _new_client(_config(state.base_url + "/mcp"))
    try:
        assert client.is_connected() is False
        await client.connect()
        assert client.is_connected() is True
        # 握手后存下 server 下发的 session id
        assert client._session_id == state.session_id
        tools = await client.list_tools()
        assert [t.name for t in tools] == ["mock_add"]
        assert [t.server_name for t in tools] == ["mock-server"]
        result = await client.call_tool("mock_add", {"a": 1, "b": 2})
        assert result["content"][0]["text"] == "result-6"
        assert await client.ping() is True
    finally:
        await _disconnect(client)


async def test_sse_stream_mode_handshake(mock_servers) -> None:
    """SSE 流模式:响应为 text/event-stream 时自动进入 stream 模式并正常工作。"""
    state = MockState(mode="stream")
    mock_servers(state)
    client = _new_client(_config(state.base_url + "/mcp"))
    try:
        await client.connect()
        assert client.is_connected() is True
        assert client._http_mode == "stream"
        tools = await client.list_tools()
        assert [t.name for t in tools] == ["mock_add"]
        result = await client.call_tool("mock_add", {"a": 3, "b": 4})
        assert result["content"][0]["text"] == "result-6"
    finally:
        await _disconnect(client)


async def test_authorization_header_with_bearer_token(mock_servers) -> None:
    """OAuth 集成:connect 先取 token,再把 Bearer 带上(server 校验到)。"""
    state = MockState(mode="post", require_auth=True, expected_token="access-token-X")
    mock_servers(state)
    oauth = MCPOAuthConfig(
        grant_type="client_credentials",
        client_id="client-1",
        client_secret="secret-1",
        token_url=state.base_url + "/token",
    )
    config = _config(state.base_url + "/mcp", oauth=oauth)
    client = _new_client(config)
    try:
        await client.connect()
        assert client.is_connected() is True
        # access_token 就是 mock 返回的 access-token-X
        assert client._http_headers.get("Authorization") == "Bearer access-token-X"
        assert state.token_calls >= 1
        tools = await client.list_tools()
        assert [t.name for t in tools] == ["mock_add"]
    finally:
        await _disconnect(client)


async def test_oauth_token_refresh(mock_servers) -> None:
    """OAuth refresh:token 过期(expires_in 极小》带 skew)后自动走 refresh_token。"""
    state = MockState(mode="post", require_auth=False)
    # expires_in=1 + TOKEN_EXPIRY_SKEW=60 → 立即视为过期,触发刷新链路
    state.expires_in = 1
    mock_servers(state)
    oauth = MCPOAuthClient(
        MCPOAuthConfig(
            grant_type="client_credentials",
            client_id="client-1",
            client_secret="secret-1",
            token_url=state.base_url + "/token",
        )
    )
    try:
        token1 = await oauth.get_token()
        assert token1.access_token == "access-token-X"
        assert state.token_calls == 1
        # 再次获取:token 已过期但带 refresh_token → 触发刷新而非重新 client_credentials
        token2 = await oauth.get_token()
        assert state.refresh_calls == 1
        assert token2.access_token == "refreshed-token-Z"
        # 刷新一次后再取:token 仍过期(expires_in=1》skew),再次刷新,值保持一致
        token3 = await oauth.get_token()
        assert state.refresh_calls == 2
        assert token3.access_token == "refreshed-token-Z"
    finally:
        await oauth.close()


async def test_oauth_metadata_discovery(mock_servers) -> None:
    """OAuth 发现:未给 token_url 时从 auth_server_url(/metadata)解析 token_endpoint。"""
    state = MockState(mode="post", require_auth=True, expected_token="access-token-X")
    mock_servers(state)
    oauth = MCPOAuthConfig(
        grant_type="client_credentials",
        client_id="client-1",
        client_secret="secret-1",
        auth_server_url=state.base_url + "/metadata",
    )
    config = _config(state.base_url + "/mcp", oauth=oauth)
    client = _new_client(config)
    try:
        await client.connect()
        assert client.is_connected() is True
        assert client._http_headers.get("Authorization") == "Bearer access-token-X"
        tools = await client.list_tools()
        assert [t.name for t in tools] == ["mock_add"]
    finally:
        await _disconnect(client)


def test_oauth_inject_and_persistence(tmp_path) -> None:
    """OAuth inject()+token 持久化后重启可恢复。"""
    token = MCPOAuthToken(
        access_token="mem-token", refresh_token="mem-refresh", expires_in=3600
    )
    headers = token.__class__.__name__  # 占位避免未用;真正用 inject 测试
    assert "MCPOAuthToken" in headers

    from app.services.mcp_oauth import _persist_token

    config = MCPOAuthConfig(
        grant_type="client_credentials",
        client_id="client-1",
        client_secret="secret-1",
        persist_path=str(tmp_path / "oauth.json"),
    )
    _persist_token(config, token)

    from app.services.mcp_oauth import _load_persisted_token

    restored = _load_persisted_token(config)
    assert restored is not None
    assert restored.access_token == "mem-token"
    assert restored.refresh_token == "mem-refresh"

    # inject():直接构造带 bearer 头
    oauth = MCPOAuthClient(config)
    oauth._token = token
    injected = oauth.inject({"X-Custom": "1"})
    assert injected["Authorization"] == "Bearer mem-token"
    assert injected["X-Custom"] == "1"
    assert oauth.access_token() == "mem-token"


async def test_unknown_transport_not_connected() -> None:
    """未知 transport:connect 后 is_connected() 应为 False(不抛异常)。"""
    config = MCPClientConfig(name="bad", transport="warp", url="http://x", reconnect=False)
    client = _new_client(config)
    try:
        await client.connect()
        assert client.is_connected() is False
    finally:
        await _disconnect(client)


async def test_oauth_authorization_code_requires_populated_code() -> None:
    """authorization_code 流:未注入 code 时 fetch_token 抛 MCPOAuthError。"""
    from app.services.mcp_oauth import MCPOAuthError

    oauth = MCPOAuthClient(
        MCPOAuthConfig(
            grant_type="authorization_code",
            client_id="client-1",
            client_secret="secret-1",
            token_url="http://unused/token",
        )
    )
    try:
        with pytest.raises(MCPOAuthError):
            await oauth.fetch_token()
    finally:
        await oauth.close()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
