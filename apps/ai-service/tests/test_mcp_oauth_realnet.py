# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""公网 MCP OAuth 真网测试(Linear MCP,https://mcp.linear.app)。

三层真网覆盖,逐层递进:
  1. test_realnet_metadata_discovery —— RFC 8414 真实发现(始终跑,只读)
  2. test_realnet_authorize_accepts_pkce —— 真实 /authorize 受理 PKCE 参数(始终跑,只读)
  3. test_realnet_dcr —— 真实动态客户端注册(RUN_MCP_REALNET=1 才跑,避免注册表滥用)
  4. test_realnet_mcp_full_chain_with_persisted_token —— 持久化 token 全链
     (需要先跑 scripts/mcp_oauth_realnet_e2e.py 完成人工授权;无 token 时 skip)
"""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

import pytest

from app.services.mcp_client import MCPClient, MCPClientConfig
from app.services.mcp_oauth import MCPOAuthClient, MCPOAuthConfig

LINEAR_BASE = "https://mcp.linear.app"
METADATA_URL = f"{LINEAR_BASE}/.well-known/oauth-authorization-server"
MCP_URL = f"{LINEAR_BASE}/mcp"
PERSIST_PATH = Path(__file__).resolve().parents[1] / ".mcp-linear-token.json"
REALNET = os.environ.get("RUN_MCP_REALNET") == "1"


def test_realnet_metadata_discovery() -> None:
    """真实 RFC 8414 发现:MCPOAuthClient 从真实端点解析出 authorize/token 端点。"""
    oauth = MCPOAuthClient(
        MCPOAuthConfig(
            grant_type="authorization_code",
            client_id="discovery-probe",
            auth_server_url=METADATA_URL,
        )
    )
    import asyncio

    async def _resolve() -> tuple[str, str]:
        auth_url = await oauth._resolve_authorization_url()  # noqa: SLF001
        token_url = await oauth._resolve_token_url()  # noqa: SLF001
        return auth_url, token_url

    auth_url, token_url = asyncio.run(_resolve())
    assert auth_url.startswith("https://")
    assert "authorize" in auth_url
    assert token_url.startswith("https://")
    assert "token" in token_url


def test_realnet_authorize_accepts_pkce() -> None:
    """真实 /authorize 端点对合法 PKCE 参数返回 200(拒绝态由本地 e2e 覆盖)。"""
    url = (
        f"{LINEAR_BASE}/authorize?response_type=code&client_id=x8zglnvuliStFZce"
        "&redirect_uri=http%3A%2F%2Flocalhost%3A9919%2Fcallback&scope=read+openid"
        "&state=realnet-test&code_challenge=Q2BZZ2Y4FjbRJX-ocCN2B8ZapjmMYXAUYJ460Fy9cdE"
        "&code_challenge_method=S256"
    )
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        assert resp.status == 200


@pytest.mark.skipif(not REALNET, reason="真网 DCR 仅在 RUN_MCP_REALNET=1 时执行(避免注册表滥用)")
def test_realnet_dcr() -> None:
    """真实动态客户端注册(RFC 7591):POST /register 返回新 client_id。"""
    body = json.dumps(
        {
            "client_name": "IHUI-AI realnet test",
            "redirect_uris": ["http://localhost:9919/callback"],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
            "scope": "read openid",
        }
    ).encode()
    req = urllib.request.Request(
        f"{LINEAR_BASE}/register",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    assert data.get("client_id"), f"DCR 未返回 client_id: {data}"


@pytest.mark.skipif(
    not PERSIST_PATH.exists(),
    reason=f"无持久化 token({PERSIST_PATH.name});先跑 scripts/mcp_oauth_realnet_e2e.py 完成人工授权",
)
def test_realnet_mcp_full_chain_with_persisted_token() -> None:
    """持久化 token → 真网 MCP streamable 全链:initialize + tools/list。"""
    import asyncio

    oauth = MCPOAuthClient(
        MCPOAuthConfig(
            grant_type="authorization_code",
            client_id="x8zglnvuliStFZce",
            auth_server_url=METADATA_URL,
            scopes=["read", "openid"],
            redirect_uri="http://localhost:9919/callback",
            persist_path=str(PERSIST_PATH),
        )
    )
    client = MCPClient(
        MCPClientConfig(
            name="linear-realnet-persisted",
            transport="streamable-http",
            url=MCP_URL,
            oauth=oauth,
            timeout=60.0,
        )
    )

    async def _run() -> list[object]:
        await client.connect()
        try:
            return await client.list_tools()
        finally:
            await client.disconnect()

    tools = asyncio.run(_run())
    assert len(tools) > 0, "真网 MCP 未返回任何工具"


def test_canonical_auth_scheme() -> None:
    """Bearer scheme 规范化回归:上游小写 bearer 必须规范为标准 Bearer(Linear 真网 401 根因)。"""
    from app.services.mcp_client import _canonical_auth_scheme

    assert _canonical_auth_scheme("bearer") == "Bearer"
    assert _canonical_auth_scheme("Bearer") == "Bearer"
    assert _canonical_auth_scheme("BEARER") == "Bearer"
    assert _canonical_auth_scheme(None) == "Bearer"
    assert _canonical_auth_scheme("") == "Bearer"
    assert _canonical_auth_scheme("  ") == "Bearer"
    assert _canonical_auth_scheme("DPoP") == "DPoP"
