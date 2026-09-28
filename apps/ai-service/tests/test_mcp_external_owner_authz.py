# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部 MCP Server 的属主隔离测试(2026-09-28 起,G-371;2026-09-29 补第二层)。

覆盖的是三件事,顺序不能换:
1. 可见集 = 自己注册的 + 部署级的 —— 别人的用户级不列出来;
2. 越权改/注销必须**留下 403 且副作用为零**(只断言状态码会放过"先注销再抛错");
3. 正向对照:同主体注册/注销照旧可用,否则本票只是把功能改坏了。

第二层(2026-09-29,只读审计量到"清单窄了而详情/工具/调用三支还宽着"):
4. `GET .../servers/{name}/capabilities` 对别人的 server 必须与"没这条"**同模板**
   (状态码 + 字段集 + 文案模板三条一致;回显请求里的 id 不算泄露,见 `_same_template`);
5. `GET /mcp/external/tools` 的枚举与 server 清单共用同一份 `is_visible` —— 工具名与
   input_schema 本身就是那台 server 的配置内容;
6. `POST /mcp/external/tools/call` 越权时**那台 client 一次都没被调用**(用 spy 断言),
   且回包与"没这台 server"同模板。

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


def _same_template(payload: object, name: str) -> object:
    """把响应里**调用方自己提交的那段名字**归一掉,只比模板。

    判"越权与不存在同形"不能要求逐字节相等:回显请求里的 id 不构成泄露(那本来就是
    调用方写的),把它算成差异会让判据退化成"不许引用输入"。真正要判的是这三件事 ——
    状态码、字段集合、文案模板。能问出"这条 id 真不真"的形态(403 vs 404、多一个 owner
    字段、文案带出注册者)都逃不掉。
    """
    if isinstance(payload, str):
        return payload.replace(name, "<NAME>")
    if isinstance(payload, dict):
        return {k: _same_template(v, name) for k, v in payload.items()}
    if isinstance(payload, list):
        return [_same_template(v, name) for v in payload]
    return payload


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


# ---------------------------------------------------------------------------
# 第二层:同一份可见集判据必须覆盖"能力/工具清单/工具调用"三支(2026-09-29 追加)
# 起因是只读审计量到这三端点仍不收身份 —— 清单端点窄了而这三支宽着,
# 等于"看不见那台 server"只是修辞:工具名/input_schema 就是配置内容,
# 而 tools/call 会拿别人的 env/凭据起进程。
# ---------------------------------------------------------------------------


async def test_capabilities_detail_is_shaped_like_missing_for_foreign_server(
    manager: MCPClientManager,
):
    a, b = await _clients(manager)
    async with a, b:
        await a.post("/api/mcp/external/servers", json=_BODY)

        foreign = await b.get("/api/mcp/external/servers/svr1/capabilities")
        missing = await b.get("/api/mcp/external/servers/no-such-svr/capabilities")
        # 同形判据:状态码一致 + 字段集一致 + 文案归一后一致。
        # 刻意**不**要求响应体逐字相等 —— 回显调用方自己提交的那段名字不构成泄露
        # (它本来就来自请求),把它禁掉等于要求服务端不引用输入。判的是"能不能从差异里
        # 问出这条 id 真不真":403 vs 404、多一个字段、文案里带出注册者,都逃不过这三条。
        assert foreign.status_code == 404
        assert missing.status_code == 404
        assert set(foreign.json()) == set(missing.json())
        assert _same_template(foreign.json(), "svr1") == _same_template(missing.json(), "no-such-svr")

        own = await a.get("/api/mcp/external/servers/svr1/capabilities")
        assert own.status_code == 200, own.text
        assert own.json()["name"] == "svr1"


async def test_tools_call_on_foreign_server_never_reaches_the_client(
    manager: MCPClientManager,
):
    """越权调用必须**没真的打到那台 server**(只断错误码会放过"先调用再报错")。"""
    a, b = await _clients(manager)
    async with a, b:
        await a.post("/api/mcp/external/servers", json=_BODY)
        reached: list[str] = []

        async def _spy(*_args, **_kwargs):
            reached.append("called")
            return {"ok": True, "content": []}

        manager.get_client("svr1").call_tool = _spy  # type: ignore[method-assign]

        payload = {"server": "svr1", "tool": "t", "arguments": {}}
        foreign = await b.post("/api/mcp/external/tools/call", json=payload)
        missing = await b.post(
            "/api/mcp/external/tools/call",
            json={**payload, "server": "no-such-svr"},
        )
        assert foreign.status_code == missing.status_code
        assert set(foreign.json()) == set(missing.json())
        assert _same_template(foreign.json(), "svr1") == _same_template(
            missing.json(), "no-such-svr"
        )  # 与"没这台 server"同一模板
        assert reached == []  # 副作用没发生


async def test_tool_enumeration_follows_the_same_visibility_predicate():
    """工具枚举与 server 清单共用 `is_visible`:别人的 server 不得贡献工具名。"""
    from app.services.mcp_client import MCPClientManager as _M
    from app.services.mcp_client import MCPClientTool

    manager = _M()
    manager.register(_cfg("mine"), owner_user_id=USER_A)
    manager.register(_cfg("theirs"), owner_user_id=USER_B)
    manager.register(_cfg("shared"))  # 部署级:两个人都看得见

    for name in ("mine", "theirs", "shared"):
        client = manager.get_client(name)

        async def _tools(_n=name):
            return [MCPClientTool(name=f"t_{_n}", description="d", input_schema={}, server_name=_n)]

        client.is_connected = lambda: True  # type: ignore[method-assign]
        client.list_tools = _tools  # type: ignore[method-assign]

    seen_a = sorted(t.server_name for t in await manager.list_available_tools_async(USER_A))
    seen_b = sorted(t.server_name for t in await manager.list_available_tools_async(USER_B))
    assert seen_a == ["mine", "shared"]
    assert seen_b == ["shared", "theirs"]
    # 收窄后的空主体那一支:看得到部署级,看不到任何人的 —— 这是 fail-closed 的正确形态,
    # 也是 `engine._default_tool_lister` 在作用域没绑上时的兜底答案。
    seen_none = sorted(t.server_name for t in await manager.list_available_tools_async(""))
    assert seen_none == ["shared"]
    # G-371 格①(2026-09-29,机主拍"隔离"):曾经"看得见全部"的那一支(_unscoped)已被**删除**,
    # 装配链与端点现在共用同一个带主体的出口。这条断言防的是有人把"按主体收窄"当性能优化,
    # 再"顺手加回一个不设限的快速版本"。
    assert not hasattr(manager, "list_available_tools_unscoped"), (
        "不判属主的枚举出口被加了回来 —— 工具名/描述/入参格式本身就是配置内容"
    )

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
