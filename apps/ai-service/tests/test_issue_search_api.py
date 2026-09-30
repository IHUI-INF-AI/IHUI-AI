# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# D179 会话 Issue 绑定流 —— MCP Issue 搜索端点测试。
#
# 隔离策略(AGENTS §5 测试隔离铁律):不连生产库/Redis/真实 MCP —— 全部经
# monkeypatch 替换 app.routers.issue_search.get_mcp_client_manager 为进程内
# MagicMock;每测新建独立 FastAPI app 只挂本 router,身份用 dependency_overrides
# 覆盖 get_current_user_id(未覆盖的那条专测 401)。
#
# 覆盖:provider 未配置(configured:false + 空 items)/ GitHub content 帧归一 /
# Linear structuredContent 归一 / 20 条截断 / 工具调用失败不炸端点 / 无搜索工具 /
# 非法 provider 422 / 未认证 401 / 身份只取承载层(caller_user_id 断言)。

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import issue_search as issue_search_router


def _make_manager(*, registered: list[dict] | None = None, call_result=None, tools=None):
    """构造可注入的假 MCPClientManager(全程无真实出站连接)。"""
    from types import SimpleNamespace

    manager = MagicMock()
    manager.list_registered.return_value = registered or []
    client = MagicMock()
    client.is_connected.return_value = True
    if tools is None:
        client.list_tools = AsyncMock(return_value=[])
    else:
        # SimpleNamespace 而非 MagicMock(name=…):构造器 name 进的是 repr,`.name` 会变成子 mock
        client.list_tools = AsyncMock(
            return_value=[SimpleNamespace(name=n) for n in tools]
        )
    registered_names = {entry.get("name") for entry in (registered or [])}
    manager.get_client.side_effect = lambda name: client if name in registered_names else None
    # 与真 manager 同源:is_visible 与 list_registered 出自同一张属主判据
    manager.is_visible.side_effect = lambda name, _uid: name in registered_names
    manager.call_external_tool = AsyncMock(return_value=call_result)
    return manager, client


@pytest.fixture
def api(monkeypatch):
    """App with injectable manager + mutable current-user uid. Returns (app, state)."""
    app = FastAPI()
    app.include_router(issue_search_router.router, prefix="/api")
    state = {"uid": "alice", "manager": None}

    async def _fake_current_user_id() -> str:
        return state["uid"]

    app.dependency_overrides[get_current_user_id] = _fake_current_user_id
    original = issue_search_router.get_mcp_client_manager

    def _factory():
        if state["manager"] is not None:
            return state["manager"]
        return original()

    monkeypatch.setattr(issue_search_router, "get_mcp_client_manager", _factory)
    return app, state


@pytest.fixture
async def client(api):
    app, _state = api
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_unconfigured_provider_returns_empty_items(api, client):
    """provider 无任何可见注册 server → 200 + configured:false + 空 items(不报错炸掉)。"""
    app, state = api
    state["manager"], _ = _make_manager(registered=[])
    res = await client.post("/api/agent/issues/search", json={"provider": "linear", "query": "bug"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["configured"] is False
    assert data["serverName"] is None
    assert data["items"] == []
    assert data["error"] is None


@pytest.mark.asyncio
async def test_github_search_content_frame_normalized(api, client):
    """GitHub server-github search_issues 经 MCP content JSON 文本帧 → 规范化条目。"""
    app, state = api
    mcp_result = {
        "content": [
            {
                "type": "text",
                "text": json.dumps(
                    {
                        "total_count": 2,
                        "items": [
                            {
                                "id": 1001,
                                "number": 42,
                                "title": "登录页样式漂移",
                                "html_url": "https://github.com/org/repo/issues/42",
                                "state": "open",
                            },
                            {
                                "id": 1002,
                                "number": 43,
                                "title": "API 超时",
                                "html_url": "https://github.com/org/repo/issues/43",
                            },
                        ],
                    }
                ),
            }
        ]
    }
    state["manager"], client_mock = _make_manager(
        registered=[{"name": "mcp:github", "connected": True}],
        call_result=mcp_result,
        tools=["search_issues", "create_issue"],
    )
    res = await client.post(
        "/api/agent/issues/search", json={"provider": "github", "query": "样式漂移"}
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["configured"] is True
    assert data["serverName"] == "mcp:github"
    assert data["error"] is None
    assert data["items"] == [
        {
            "id": "1001",
            "title": "登录页样式漂移",
            "url": "https://github.com/org/repo/issues/42",
            "provider": "github",
        },
        {
            "id": "1002",
            "title": "API 超时",
            "url": "https://github.com/org/repo/issues/43",
            "provider": "github",
        },
    ]
    # 身份纪律:调用外部工具必须带承载层身份,且只发搜索工具名
    call_kwargs = client_mock.list_tools.await_args
    assert call_kwargs is not None
    tool_call = state["manager"].call_external_tool.await_args
    assert tool_call.args[0] == "mcp:github"
    assert tool_call.args[1] == "search_issues"
    assert tool_call.args[2] == {"query": "样式漂移"}
    assert tool_call.kwargs["caller_user_id"] == "alice"


@pytest.mark.asyncio
async def test_linear_search_structured_content_normalized(api, client):
    """Linear 形态(identifier/title/url)经 structuredContent → 归一,provider 打 linear 标。"""
    app, state = api
    mcp_result = {
        "structuredContent": {
            "issues": [
                {
                    "identifier": "LIN-7",
                    "id": "uuid-internal-7",
                    "title": "Linear 看板同步失败",
                    "url": "https://linear.app/team/issue/LIN-7",
                }
            ]
        }
    }
    state["manager"], _ = _make_manager(
        registered=[{"name": "linear-mcp", "connected": True}],
        call_result=mcp_result,
        tools=["search_issues"],
    )
    res = await client.post(
        "/api/agent/issues/search", json={"provider": "linear", "query": "同步"}
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["serverName"] == "linear-mcp"
    assert data["items"] == [
        {
            "id": "LIN-7",
            "title": "Linear 看板同步失败",
            "url": "https://linear.app/team/issue/LIN-7",
            "provider": "linear",
        }
    ]


@pytest.mark.asyncio
async def test_items_truncated_to_max(api, client):
    """超过 20 条按 MAX_ITEMS 截断(不把整页回灌给前端)。"""
    app, state = api
    items = [
        {"id": i, "number": i, "title": f"issue-{i}", "html_url": f"https://x/{i}"}
        for i in range(25)
    ]
    state["manager"], _ = _make_manager(
        registered=[{"name": "mcp:github", "connected": True}],
        call_result={"content": [{"type": "text", "text": json.dumps({"items": items})}]},
        tools=["search_issues"],
    )
    res = await client.post("/api/agent/issues/search", json={"provider": "github", "query": "q"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data["items"]) == issue_search_router.MAX_ITEMS == 20


@pytest.mark.asyncio
async def test_tool_call_failure_does_not_raise(api, client):
    """call_external_tool 返回 {ok:False} → 200 + items:[] + error 带原因(configured 仍 true)。"""
    app, state = api
    state["manager"], _ = _make_manager(
        registered=[{"name": "mcp:github", "connected": False}],
        call_result={"ok": False, "error": "MCP Server 未连接: mcp:github"},
        tools=["search_issues"],
    )
    res = await client.post("/api/agent/issues/search", json={"provider": "github", "query": "q"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["configured"] is True
    assert data["items"] == []
    assert "未连接" in (data["error"] or "")


@pytest.mark.asyncio
async def test_no_search_tool_returns_error_note(api, client):
    """已配置但 server 没有 issue 搜索工具 → 200 + items:[] + error 点名,不炸。"""
    app, state = api
    state["manager"], _ = _make_manager(
        registered=[{"name": "mcp:github", "connected": True}],
        call_result={"content": []},
        tools=["list_files"],
    )
    res = await client.post("/api/agent/issues/search", json={"provider": "github", "query": "q"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["items"] == []
    assert data["error"] is not None
    assert "搜索工具" in data["error"]


@pytest.mark.asyncio
async def test_invalid_provider_rejected(api, client):
    """provider 白名单外的值 → 422(pydantic Literal),不进 MCP 通道。"""
    app, state = api
    state["manager"], _ = _make_manager(registered=[])
    res = await client.post("/api/agent/issues/search", json={"provider": "jira", "query": "q"})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_unauthenticated_rejected(api):
    """未覆盖身份依赖(无 JWT 中间件)→ 401,不进搜索。"""
    app, state = api
    state["manager"], _ = _make_manager(registered=[])
    bare = FastAPI()
    bare.include_router(issue_search_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=bare), base_url="http://test") as c:
        res = await c.post(
            "/api/agent/issues/search", json={"provider": "github", "query": "q"}
        )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_visibility_isolation_between_users(api, client):
    """别人的 server 不可见 → 等价于未配置(get_client 有但 is_visible 拒 ⇒ 不解析,不泄露存在性)。"""
    app, state = api
    manager, _ = _make_manager(
        registered=[{"name": "mcp:github", "connected": True}],
        call_result={"content": []},
        tools=["search_issues"],
    )
    # bob 注册的 server 真实存在(get_client 仍答得出),但 alice 的可见判据拒之门外
    manager.list_registered.return_value = []
    manager.is_visible.side_effect = lambda _name, _uid: False
    state["manager"] = manager
    res = await client.post("/api/agent/issues/search", json={"provider": "github", "query": "q"})
    assert res.status_code == 200
    assert res.json()["data"]["configured"] is False
    state["manager"].call_external_tool.assert_not_awaited()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
