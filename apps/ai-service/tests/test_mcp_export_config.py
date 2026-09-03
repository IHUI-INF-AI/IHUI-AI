# test_mcp_export_config.py - tests for app/routers/mcp_export_config.py.
# (c) 2026 IHUI AI. Apache-2.0. ASCII-only per project constraint.

"""Tests for the read-only MCP export access-config endpoints.

The router is mounted on an isolated FastAPI app (no main.py) and the
get_current_user_id dependency is overridden to a stub user.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import mcp_export_config
from app.services import mcp_export


@pytest.fixture
async def ac() -> AsyncClient:
    app = FastAPI()
    app.include_router(mcp_export_config.router)
    app.dependency_overrides[get_current_user_id] = lambda: "test-user"
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client


async def test_config_stdio_fragment(ac: AsyncClient) -> None:
    res = await ac.get("/api/mcp-export/config", params={"transport": "stdio"})
    body = res.json()
    assert res.status_code == 200
    assert body["code"] == 0
    entry = body["data"]["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]
    assert entry["command"]  # non-empty
    assert entry["args"] == ["-m", mcp_export.MCP_EXPORT_RUN_MODULE]


async def test_config_sse_url(ac: AsyncClient) -> None:
    res = await ac.get(
        "/api/mcp-export/config",
        params={"transport": "sse", "base_url": "http://127.0.0.1:8000"},
    )
    body = res.json()
    assert body["code"] == 0
    url = body["data"]["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]["url"]
    assert url == (
        "http://127.0.0.1:8000"
        + mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_SSE
    )


async def test_config_streamable_http_url(ac: AsyncClient) -> None:
    res = await ac.get(
        "/api/mcp-export/config",
        params={"transport": "streamable-http", "base_url": "https://mcp.example.com"},
    )
    body = res.json()
    assert body["code"] == 0
    url = body["data"]["mcpServers"][mcp_export.MCP_SERVER_CLIENT_NAME]["url"]
    assert url == (
        "https://mcp.example.com"
        + mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_STREAMABLE
    )


async def test_config_invalid_transport_rejected(ac: AsyncClient) -> None:
    res = await ac.get("/api/mcp-export/config", params={"transport": "udp"})
    body = res.json()
    assert body["code"] == 400
    assert body["data"] is None


async def test_normalize_url_loopback_sse(ac: AsyncClient) -> None:
    res = await ac.get(
        "/api/mcp-export/normalize-url",
        params={"scheme": "https", "host": "127.0.0.1", "port": "8443", "transport": "sse"},
    )
    body = res.json()
    assert res.status_code == 200
    assert body["code"] == 0
    assert body["data"]["url"] == (
        "https://127.0.0.1:8443" + mcp_export.MCP_EXPORT_PREFIX + mcp_export.ENDPOINT_SSE
    )


async def test_normalize_url_rejects_unknown_host(ac: AsyncClient) -> None:
    res = await ac.get(
        "/api/mcp-export/normalize-url",
        params={"host": "evil.example.com"},
    )
    body = res.json()
    assert body["code"] == 403
    assert body["data"] is None


async def test_normalize_url_rejects_wildcard_host(ac: AsyncClient) -> None:
    for host in ("0.0.0.0", "*"):
        res = await ac.get(
            "/api/mcp-export/normalize-url", params={"host": host}
        )
        assert res.json()["code"] == 403


async def test_normalize_url_rejects_stdio_transport(ac: AsyncClient) -> None:
    res = await ac.get(
        "/api/mcp-export/normalize-url",
        params={"host": "127.0.0.1", "transport": "stdio"},
    )
    body = res.json()
    assert body["code"] == 400
    assert body["data"] is None