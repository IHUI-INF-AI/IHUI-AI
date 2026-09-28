# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 MCP Server 的属主隔离测试(2026-09-28,G-371 第二半)。

覆盖的是三件事,顺序不能换:
1. 可见集 = 自己注册的 + 部署级的 —— 别人的用户级不列出来;
2. 越权改/注销必须**留下 403 且副作用为零**(只断言状态码会放过"先注销再抛错");
3. 正向对照:同主体注册/注销照旧可用,否则本票只是把功能改坏了。

两个 app 共用同一个 manager 实例:否则"B 看不见"只是因为换了对象,什么也没证明。
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import require_request_user_id
from app.routers import mcp as mcp_router
from app.services.mcp_client import MCPClientManager

USER_A = "user-a"
USER_B = "user-b"


def _app_for(manager: MCPClientManager, owner: str) -> FastAPI:
    app = FastAPI()
    app.include_router(mcp_router.router, prefix="/api")
    mcp_router.get_mcp_client_manager = lambda: manager  # type: ignore[method-assign]
    app.dependency_overrides[require_request_user_id] = lambda: owner
    return app


@pytest.fixture
def manager() -> MCPClientManager:
    return MCPClientManager()


async def _clients(manager: MCPClientManager):
    a = AsyncClient(transport=ASGITransport(app=_app_for(manager, USER_A)), base_url="http://test")
    b = AsyncClient(transport=ASGITransport(app=_app_for(manager, USER_B)), base_url="http://test")
    return a, b


_BODY = {"name": "svr1", "transport": "stdio", "command": "echo"}


async def test_cross_owner_cannot_see_or_mutate(manager: MCPClientManager):
    a, b = await _clients(manager)
    async with a, b:
        reg = await a.post("/api/mcp/external/servers", json=_BODY)
        assert reg.status_code in (200, 201), reg.text

        listed_b = await b.get("/api/mcp/external/servers")
        assert listed_b.status_code == 200
        assert [s["name"] for s in listed_b.json()["servers"]] == []

        # 越权注销/连接:403(不是伪装 404 —— 它本来就在列表语义里"存在",装没这条会与列表自相矛盾)
        dele = await b.delete("/api/mcp/external/servers/svr1")
        assert dele.status_code == 403, dele.text
        conn = await b.post("/api/mcp/external/servers/svr1/connect")
        assert conn.status_code == 403, conn.text
        # 副作用必须没发生:A 的那条还在、仍可被 A 自己注销
        assert manager.get_client("svr1") is not None
        assert manager.owner_of("svr1") == USER_A

        # 正向对照:同名重复注册被挡,且不覆盖 A 的配置
        dup = await b.post("/api/mcp/external/servers", json={**_BODY, "command": "rm"})
        assert dup.status_code == 409, dup.text
        assert manager.get_client("svr1").config.command == "echo"

        own = await a.delete("/api/mcp/external/servers/svr1")
        assert own.status_code == 200, own.text
        assert manager.get_client("svr1") is None


async def test_deployment_level_server_is_visible_but_immutable(manager: MCPClientManager):
    """部署级(main.py 启动时注册,owner 为空串):谁都能看见,谁都注销不了。"""
    manager.register(_cfg("platform-svr"))
    a, b = await _clients(manager)
    async with a, b:
        for cli in (a, b):
            res = await cli.get("/api/mcp/external/servers")
            assert [s["name"] for s in res.json()["servers"]] == ["platform-svr"]
        for cli in (a, b):
            assert (await cli.delete("/api/mcp/external/servers/platform-svr")).status_code == 403
            assert (await cli.post("/api/mcp/external/servers/platform-svr/connect")).status_code == 403
        assert manager.get_client("platform-svr") is not None


def _cfg(name: str):
    from app.services.mcp_client import MCPClientConfig

    return MCPClientConfig(name=name, transport="stdio", command="echo")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
