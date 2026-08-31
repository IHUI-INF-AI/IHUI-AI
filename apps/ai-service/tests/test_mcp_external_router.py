# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 MCP Server 管理端点单元测试(2026-08-30 立)。

覆盖:
- GET  /api/mcp/external/servers       列出已注册外部服务器(含连接状态)
- POST /api/mcp/external/servers       注册 + 连接(校验缺失字段 400 / 重复 409)
- DELETE /api/mcp/external/servers/{name} 注销
- POST /api/mcp/external/servers/{name}/connect 重连
- GET  /api/mcp/external/tools         列出已连接服务器的工具
- POST /api/mcp/external/tools/call    调用外部工具(未注册 server 返回错误)

隔离策略:每个测试用独立 FastAPI app + 独立 MCPClientManager fixture,
monkeypatch routers.mcp.get_mcp_client_manager 返回该 manager,避免共享单例污染。
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.routers import mcp as mcp_router
from app.services.mcp_client import MCPClientConfig, MCPClientManager


# =============================================================================
# fixtures
# =============================================================================


@pytest.fixture
def manager() -> MCPClientManager:
    """每个测试独立的 MCPClientManager。"""
    return MCPClientManager()


@pytest.fixture
def api_client(monkeypatch, manager: MCPClientManager):
    """只挂载 mcp 路由的 FastAPI app,替换 get_mcp_client_manager 返回隔离 manager。"""
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    monkeypatch.setattr(mcp_router, "get_mcp_client_manager", lambda: manager)
    return app


@pytest.fixture
async def ac(api_client):
    """httpx 异步客户端。"""
    async with AsyncClient(
        transport=ASGITransport(app=api_client), base_url="http://test"
    ) as client:
        yield client


# =============================================================================
# 工具函数
# =============================================================================


def _fake_connect_set_connected(monkeypatch) -> None:
    """mock MCPClient.connect 为直接置 connected,避免真实拉起子进程/网络。"""

    async def _fake_connect(self) -> None:
        self._connected = True

    monkeypatch.setattr("app.services.mcp_client.MCPClient.connect", _fake_connect)


# =============================================================================
# GET /mcp/external/servers
# =============================================================================


@pytest.mark.asyncio
async def test_list_external_servers_empty(ac):
    """无注册服务器时返回空列表。"""
    res = await ac.get("/api/mcp/external/servers")
    assert res.status_code == 200
    body = res.json()
    assert body["servers"] == []
    assert body["count"] == 0


@pytest.mark.asyncio
async def test_list_external_servers_with_status(ac, manager, monkeypatch):
    """已注册服务器返回连接状态。"""
    _fake_connect_set_connected(monkeypatch)
    res = await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "stdio", "command": "echo"},
    )
    assert res.status_code == 201

    res = await ac.get("/api/mcp/external/servers")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 1
    assert body["servers"][0]["name"] == "svr1"
    assert body["servers"][0]["connected"] is True
    assert "env" not in body["servers"][0]


# =============================================================================
# POST /mcp/external/servers(注册 + 连接)
# =============================================================================


@pytest.mark.asyncio
async def test_register_missing_name(ac):
    """缺失 name 返回 400 错误。"""
    res = await ac.post("/api/mcp/external/servers", json={"transport": "stdio"})
    assert res.status_code == 400
    assert "name" in res.json()["error"]


@pytest.mark.asyncio
async def test_register_missing_transport(ac):
    """缺失 transport 返回 400 错误。"""
    res = await ac.post("/api/mcp/external/servers", json={"name": "svr1"})
    assert res.status_code == 400
    assert "transport" in res.json()["error"]


@pytest.mark.asyncio
async def test_register_invalid_transport(ac):
    """非法 transport 返回 400 错误。"""
    res = await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "http"},
    )
    assert res.status_code == 400
    assert "transport" in res.json()["error"]


@pytest.mark.asyncio
async def test_register_stdio_missing_command(ac):
    """stdio 模式缺少 command 返回 400 错误。"""
    res = await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "stdio"},
    )
    assert res.status_code == 400
    assert "command" in res.json()["error"]


@pytest.mark.asyncio
async def test_register_sse_missing_url(ac):
    """sse 模式缺少 url 返回 400 错误。"""
    res = await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "sse"},
    )
    assert res.status_code == 400
    assert "url" in res.json()["error"]


@pytest.mark.asyncio
async def test_register_success(ac, monkeypatch):
    """注册成功返回 201 与服务器信息。"""
    _fake_connect_set_connected(monkeypatch)
    res = await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "stdio", "command": "echo", "args": ["-c"]},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "svr1"
    assert body["transport"] == "stdio"
    assert body["connected"] is True
    assert body["args"] == ["-c"]


@pytest.mark.asyncio
async def test_register_duplicate_returns_409(ac, monkeypatch):
    """重复注册同一 name 返回 409。"""
    _fake_connect_set_connected(monkeypatch)
    payload = {"name": "svr1", "transport": "stdio", "command": "echo"}
    res1 = await ac.post("/api/mcp/external/servers", json=payload)
    assert res1.status_code == 201

    res2 = await ac.post("/api/mcp/external/servers", json=payload)
    assert res2.status_code == 409
    assert "已存在" in res2.json()["error"]


# =============================================================================
# DELETE /mcp/external/servers/{name}
# =============================================================================


@pytest.mark.asyncio
async def test_delete_unknown_server_404(ac):
    """注销不存在的 server 返回 404。"""
    res = await ac.delete("/api/mcp/external/servers/nope")
    assert res.status_code == 404
    assert "不存在" in res.json()["error"]


@pytest.mark.asyncio
async def test_delete_known_server(ac, monkeypatch):
    """注销已注册 server 成功。"""
    _fake_connect_set_connected(monkeypatch)
    await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "stdio", "command": "echo"},
    )
    res = await ac.delete("/api/mcp/external/servers/svr1")
    assert res.status_code == 200
    body = res.json()
    assert body["deleted"] == "svr1"
    assert body["ok"] is True


# =============================================================================
# POST /mcp/external/servers/{name}/connect
# =============================================================================


@pytest.mark.asyncio
async def test_connect_unknown_server_404(ac):
    """重连不存在的 server 返回 404。"""
    res = await ac.post("/api/mcp/external/servers/nope/connect")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_connect_known_server(ac, monkeypatch):
    """重连已注册 server 成功并返回连接状态。"""
    _fake_connect_set_connected(monkeypatch)
    await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "stdio", "command": "echo"},
    )
    res = await ac.post("/api/mcp/external/servers/svr1/connect")
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "svr1"
    assert body["connected"] is True


# =============================================================================
# GET /mcp/external/tools
# =============================================================================


@pytest.mark.asyncio
async def test_list_external_tools_empty(ac):
    """无已连接服务器时工具列表为空且不抛异常。"""
    res = await ac.get("/api/mcp/external/tools")
    assert res.status_code == 200
    body = res.json()
    assert body["tools"] == []
    assert body["count"] == 0


# =============================================================================
# POST /mcp/external/tools/call
# =============================================================================


@pytest.mark.asyncio
async def test_call_external_tool_unknown_server(ac):
    """调用未注册 server 的工具返回错误(非 500)。"""
    res = await ac.post(
        "/api/mcp/external/tools/call",
        json={"server": "no_such_server", "tool": "t", "arguments": {}},
    )
    assert res.status_code == 400
    assert "未知" in res.json()["error"]


@pytest.mark.asyncio
async def test_call_external_tool_not_connected(ac, manager):
    """调用已注册但未连接的 server 返回错误(非 500)。"""
    manager.register(
        MCPClientConfig(name="svr1", transport="stdio", command="echo")
    )
    res = await ac.post(
        "/api/mcp/external/tools/call",
        json={"server": "svr1", "tool": "t", "arguments": {}},
    )
    assert res.status_code == 400
    assert "未连接" in res.json()["error"]


@pytest.mark.asyncio
async def test_call_external_tool_success(ac, monkeypatch):
    """调用已连接 server 的工具成功。"""
    _fake_connect_set_connected(monkeypatch)

    async def _fake_call_tool(self, name, arguments):
        return {"content": [{"type": "text", "text": "ok"}]}

    monkeypatch.setattr("app.services.mcp_client.MCPClient.call_tool", _fake_call_tool)

    await ac.post(
        "/api/mcp/external/servers",
        json={"name": "svr1", "transport": "stdio", "command": "echo"},
    )
    res = await ac.post(
        "/api/mcp/external/tools/call",
        json={"server": "svr1", "tool": "my_tool", "arguments": {"x": 1}},
    )
    assert res.status_code == 200
    assert res.json()["content"][0]["text"] == "ok"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
