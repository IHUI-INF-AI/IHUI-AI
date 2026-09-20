# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""api_tools_bridge.py(OpenAPI → MCP 工具桥接)单元测试。

覆盖策略:纯转换逻辑直测;出站 HTTP 一律在 httpx.AsyncClient.request 层拦截
(与 test_conversation.py 同一手法),不触达真实 apps/api / PostgreSQL / Redis。
注册进全局工具表的用例在夹具里按 api_ 前缀清理,防止污染同进程其他用例。
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services import api_tools_bridge as bridge

_USER = "00000000-0000-4000-8000-00000000000a"

_SPEC: dict[str, Any] = {
    "paths": {
        "/orders": {
            "get": {
                "operationId": "listOrders",
                "summary": "列出订单",
                "tags": ["Orders"],
                "parameters": [
                    {"name": "page", "in": "query", "schema": {"type": "integer"}},
                    {"name": "keyword", "in": "query", "required": True, "schema": {"type": "string"}},
                    {"name": "x-trace", "in": "header", "schema": {"type": "string"}},
                ],
            },
            "post": {
                "operationId": "createOrder",
                "summary": "创建订单",
                "requestBody": {
                    "required": True,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {"sku": {"type": "string"}, "qty": {"type": "integer"}},
                                "required": ["sku"],
                            }
                        }
                    },
                },
            },
        },
        "/orders/{orderId}": {
            "delete": {
                "operationId": "deleteOrder",
                "summary": "删除订单",
                "parameters": [{"name": "orderId", "in": "path", "required": True, "schema": {"type": "string"}}],
            }
        },
        "/orders/batch": {
            "post": {
                "operationId": "batchOrder",
                "summary": "批量下单",
                "requestBody": {
                    "content": {"application/json": {"schema": {"type": "array", "items": {"type": "string"}}}}
                },
            }
        },
        "/docs/json": {"get": {"operationId": "getSpec", "summary": "内部文档"}},
        "/internal/secret": {"get": {"operationId": "getSecret", "summary": "内部端点"}},
        "/ws/notifications": {"get": {"operationId": "wsNotif", "summary": "WS"}},
    }
}


class _FakeResp:
    """最小 httpx 响应替身:status_code / raise_for_status / text / json。"""

    def __init__(self, payload: Any = None, text: str = "", status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = text if text else ("" if payload is None else str(payload))

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)  # type: ignore[arg-type]

    def json(self) -> Any:
        if self._payload is None:
            raise ValueError("no json")
        return self._payload


@pytest.fixture(autouse=True)
def _clean_registry() -> Any:
    """每个用例后清空 api_ 前缀外部工具与侧表,防污染全局工具注册表。"""
    yield
    bridge.unregister_external_tool_by_prefix("api_")
    bridge._API_TOOL_INDEX.clear()
    bridge.clear_spec_cache()


@pytest.fixture
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_INTERNAL_BASE_URL", "http://api.test:8802")
    monkeypatch.setenv("AI_CALLBACK_SECRET", "unit-test-secret")


@pytest.fixture
def captured(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """拦截 httpx 出站请求,返回捕获列表;响应由 resp 工厂决定。"""
    calls: list[dict[str, Any]] = []

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _FakeResp:
        calls.append({"method": method, "url": str(url), **kwargs})
        return _FakeResp(payload={"ok": 1}, text='{"ok": 1}')

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    return calls


# ---------------------------------------------------------------------------
# 纯转换逻辑
# ---------------------------------------------------------------------------

def test_sanitize_tool_name_prefix_and_length() -> None:
    assert bridge._sanitize_tool_name("listOrders") == "api_listorders"
    assert bridge._sanitize_tool_name("get /v1/chat/{id}") == "api_get_v1_chat_id"
    assert bridge._sanitize_tool_name("!!!").startswith("api_")
    assert len(bridge._sanitize_tool_name("a" * 200)) <= 64


def test_build_input_schema_merges_and_drops_header(_env: None) -> None:
    op = _SPEC["paths"]["/orders"]["get"]
    schema = bridge._build_input_schema(op)
    props = schema["properties"]
    assert set(props) == {"page", "keyword"}
    # header/cookie 型参数不得暴露给 LLM(防越权头注入)
    assert "x-trace" not in props
    assert schema["required"] == ["keyword"]
    assert "additionalProperties" not in schema


def test_build_input_schema_object_body_merged() -> None:
    op = _SPEC["paths"]["/orders"]["post"]
    schema = bridge._build_input_schema(op)
    assert set(schema["properties"]) == {"sku", "qty"}
    assert schema["required"] == ["sku"]


def test_build_input_schema_non_object_body_as_body_param() -> None:
    op = _SPEC["paths"]["/orders/batch"]["post"]
    schema = bridge._build_input_schema(op)
    assert "body" in schema["properties"]
    assert schema["properties"]["body"]["type"] == "array"


def test_iter_operations_excludes_default_prefixes(_env: None) -> None:
    ops = bridge._iter_operations(_SPEC)
    paths = {p for _, p, _ in ops}
    assert "/docs/json" not in paths
    assert "/internal/secret" not in paths
    assert "/ws/notifications" not in paths
    assert "/orders" in paths


def test_iter_operations_respects_api_tools_max(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_TOOLS_MAX", "2")
    ops = bridge._iter_operations(_SPEC)
    assert len(ops) == 2


def test_iter_operations_caps_after_method_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """上限必须在方法过滤之后(回归:曾在过滤前截断,read/all 模式静默丢端点)。

    排除后 spec 顺序为 [GET /orders, POST /orders, DELETE /orders/{id}, POST /orders/batch];
    旧实现 max=1 先截断成 [GET /orders] 再筛 POST → 0 条;新实现先筛后截 → 1 条 POST。
    """
    monkeypatch.setenv("API_TOOLS_MAX", "1")
    ops = bridge._iter_operations(_SPEC, {"POST"})
    assert [m for m, _, _ in ops] == ["POST"]
    assert ops[0][1] == "/orders"
    # cap=False 取全量,供侧表覆盖被上限截断的长尾端点
    assert len(bridge._iter_operations(_SPEC, {"POST"}, cap=False)) == 2


def test_spec_to_tools_marks_write_operations() -> None:
    tools = bridge.spec_to_tools(_SPEC)
    by_name = {t.name: t for t in tools}
    assert "api_listorders" in by_name
    assert "[API GET /orders]" in by_name["api_listorders"].description
    assert "写操作" not in by_name["api_listorders"].description
    assert "⚠写操作" in by_name["api_deleteorder"].description


# ---------------------------------------------------------------------------
# 端点 handler
# ---------------------------------------------------------------------------

async def test_handler_requires_user_id(_env: None, captured: list[dict[str, Any]]) -> None:
    handler = bridge.make_api_handler("GET", "/orders")
    out = await handler({"keyword": "k"})
    assert out["ok"] is False
    assert out["errorCode"] == "PERMISSION_DENIED"
    assert captured == []


async def test_write_handler_denied_for_non_admin(_env: None, captured: list[dict[str, Any]]) -> None:
    handler = bridge.make_api_handler("POST", "/orders")
    out = await handler({"__user_id": _USER, "__user_role": 0, "sku": "A"})
    assert out["ok"] is False
    assert out["errorCode"] == "PERMISSION_DENIED"
    # 闸门必须在发请求之前(不能先打后端再拒)
    assert captured == []


async def test_write_handler_allowed_for_admin(_env: None, captured: list[dict[str, Any]]) -> None:
    handler = bridge.make_api_handler("POST", "/orders")
    out = await handler({"__user_id": _USER, "__user_role": 1, "sku": "A", "qty": 2})
    assert out["ok"] is True
    req = captured[0]
    assert req["method"] == "POST"
    assert req["url"] == "http://api.test:8802/orders"
    assert req["json"] == {"sku": "A", "qty": 2}
    assert req["headers"]["x-user-id"] == _USER
    assert req["headers"]["x-internal-service-token"] == "unit-test-secret"


async def test_get_handler_uses_query_and_drops_internal(_env: None, captured: list[dict[str, Any]]) -> None:
    handler = bridge.make_api_handler("GET", "/orders")
    await handler({"__user_id": _USER, "__user_role": 0, "__session_id": "s1", "keyword": "手机", "page": 3})
    req = captured[0]
    assert req["params"] == {"keyword": "手机", "page": 3}
    assert "__user_id" not in req["params"]


async def test_handler_path_param_encoded(_env: None, captured: list[dict[str, Any]]) -> None:
    handler = bridge.make_api_handler("DELETE", "/orders/{orderId}")
    out = await handler({"__user_id": _USER, "__user_role": 1, "orderId": "a/b ?x"})
    assert out["ok"] is True
    # 路径参数必须 URL 编码,防路径穿越
    assert captured[0]["url"].endswith("/orders/a%2Fb%20%3Fx")


async def test_handler_missing_path_param(_env: None, captured: list[dict[str, Any]]) -> None:
    handler = bridge.make_api_handler("DELETE", "/orders/{orderId}")
    out = await handler({"__user_id": _USER, "__user_role": 1})
    assert out["errorCode"] == "MISSING_PATH_PARAM"
    assert captured == []


async def test_handler_truncates_large_response(_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _FakeResp:
        return _FakeResp(text="x" * 9000)

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    handler = bridge.make_api_handler("GET", "/orders")
    out = await handler({"__user_id": _USER, "keyword": "k"})
    assert out["truncated"] is True
    assert len(out["data"]) == 4000


async def test_handler_network_error_normalized(_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(self: Any, method: str, url: str, **kwargs: Any) -> Any:
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(httpx.AsyncClient, "request", boom)
    handler = bridge.make_api_handler("GET", "/orders")
    out = await handler({"__user_id": _USER, "keyword": "k"})
    assert out["ok"] is False
    assert out["errorCode"] == "API_BRIDGE_ERROR"


# ---------------------------------------------------------------------------
# 稳定入口工具:先搜后调
# ---------------------------------------------------------------------------

def _seed_index() -> None:
    bridge._API_TOOL_INDEX.clear()
    bridge._API_TOOL_INDEX.update(
        {
            "api_listorders": {"method": "GET", "path": "/orders", "summary": "列出订单"},
            "api_listusers": {"method": "GET", "path": "/users", "summary": "用户列表"},
            "api_createorder": {"method": "POST", "path": "/orders", "summary": "创建订单"},
        }
    )


async def test_search_scores_and_filters_method() -> None:
    _seed_index()
    out = await bridge._search_endpoint_tools({"query": "订单"})
    assert out["ok"] is True
    # 同分时按 name 升序稳定输出,只断言命中集合不锁顺序
    assert {"api_listorders", "api_createorder"} <= {e["name"] for e in out["endpoints"]}
    assert out["endpoints"][0]["summary"], "命中项应带摘要供模型判断"
    only_post = await bridge._search_endpoint_tools({"query": "订单", "method": "POST"})
    assert [e["name"] for e in only_post["endpoints"]] == ["api_createorder"]
    assert (await bridge._search_endpoint_tools({"query": "zzz-not-exist"}))["count"] == 0


async def test_handler_is_awaitable_via_call_tool() -> None:
    """回归:search handler 曾写成同步函数,call_tool 会 await 它 → 'dict can't be awaited'。"""
    from app.services.mcp_server import mcp_server

    _seed_index()
    for tool, handler in bridge._entry_tools():
        bridge.register_external_tool(tool, handler)
    out = await mcp_server.call_tool("api_endpoints_search", {"query": "订单"})
    assert out["ok"] is True, out
    assert out["count"] == 2


async def test_search_empty_query_lists_and_clamps_limit() -> None:
    _seed_index()
    out = await bridge._search_endpoint_tools({"query": "", "limit": 999})
    assert out["count"] == 3
    assert out["total"] == 3
    assert "api_endpoint_call" in out["hint"]


async def test_call_entry_rejects_non_api_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_index()

    async def spy_call_tool(name: str, args: Any, **kw: Any) -> dict[str, Any]:
        raise AssertionError(f"不应委派到 {name}")

    monkeypatch.setattr(bridge.mcp_server, "call_tool", spy_call_tool)
    out = await bridge._call_endpoint_tool({"name": "run_command", "arguments": {}})
    assert out["ok"] is False
    assert out["errorCode"] == "UNKNOWN_API_TOOL"


async def test_call_entry_delegates_with_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_index()
    # 已注册工具走 call_tool(复用全局超时/截断/权限矩阵),故先真实注册进 _TOOL_HANDLERS
    bridge.register_external_tool(
        bridge.MCPTool(name="api_listorders", description="d", input_schema={}),
        lambda args: {},
    )
    seen: dict[str, Any] = {}

    async def spy_call_tool(name: str, args: Any, **kw: Any) -> dict[str, Any]:
        seen["name"] = name
        seen["args"] = args
        seen.update(kw)
        return {"ok": True, "data": {"list": []}}

    monkeypatch.setattr(bridge.mcp_server, "call_tool", spy_call_tool)
    out = await bridge._call_endpoint_tool(
        {
            "name": "api_listorders",
            "arguments": {"keyword": "手机"},
            "__user_id": _USER,
            "__user_role": 1,
            "__session_id": "s1",
        }
    )
    assert out["ok"] is True
    assert seen["name"] == "api_listorders"
    assert seen["args"] == {"keyword": "手机"}
    assert seen["user_id"] == _USER
    assert seen["user_role"] == 1


async def test_call_entry_requires_name_and_object_arguments(monkeypatch: pytest.MonkeyPatch) -> None:
    _seed_index()
    assert (await bridge._call_endpoint_tool({}))["errorCode"] == "INVALID_ARGS"
    assert (await bridge._call_endpoint_tool({"name": "api_listorders", "arguments": "x"}))["errorCode"] == "INVALID_ARGS"


# ---------------------------------------------------------------------------
# 注册入口
# ---------------------------------------------------------------------------

async def test_setup_off_unregisters_existing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_TOOLS_MODE", "off")
    tool = bridge.MCPTool(name="api_leftover", description="d", input_schema={})
    bridge.register_external_tool(tool, lambda args: {})
    assert await bridge.setup_api_tools_bridge() == 0
    assert "api_leftover" not in {t.name for t in bridge.mcp_server.list_tools()}


async def test_setup_read_mode_registers_get_and_entry_tools(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("API_TOOLS_MODE", "read")

    async def fake_spec(force: bool = False) -> dict[str, Any]:
        return _SPEC

    monkeypatch.setattr(bridge, "fetch_openapi_spec", fake_spec)
    count = await bridge.setup_api_tools_bridge()
    names = {t.name for t in bridge.mcp_server.list_tools()}
    assert "api_listorders" in names
    # read 模式下写端点不注册,但入口工具必须在
    assert "api_createorder" not in names
    assert {"api_endpoints_search", "api_endpoint_call"} <= names
    assert count == 3
    assert bridge._API_TOOL_INDEX["api_listorders"]["path"] == "/orders"


async def test_setup_all_mode_registers_writes(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_TOOLS_MODE", "all")

    async def fake_spec(force: bool = False) -> dict[str, Any]:
        return _SPEC

    monkeypatch.setattr(bridge, "fetch_openapi_spec", fake_spec)
    await bridge.setup_api_tools_bridge()
    names = {t.name for t in bridge.mcp_server.list_tools()}
    assert {"api_createorder", "api_deleteorder"} <= names


async def test_long_tail_endpoint_callable_despite_cap(
    monkeypatch: pytest.MonkeyPatch, captured: list[dict[str, Any]]
) -> None:
    """API_TOOLS_MAX 只约束"进工具表的条数",不削弱可调用面(实测 spec 有 4471 端点)。"""
    monkeypatch.setenv("API_TOOLS_MODE", "all")
    monkeypatch.setenv("API_TOOLS_MAX", "1")

    async def fake_spec(force: bool = False) -> dict[str, Any]:
        return _SPEC

    monkeypatch.setattr(bridge, "fetch_openapi_spec", fake_spec)
    await bridge.setup_api_tools_bridge()
    names = {t.name for t in bridge.mcp_server.list_tools()}
    assert "api_listorders" in names
    assert "api_batchorder" not in names  # 被上限截断,未注册
    assert "api_batchorder" in bridge._API_TOOL_INDEX  # 侧表仍全量覆盖
    out = await bridge._call_endpoint_tool(
        {
            "name": "api_batchorder",
            "arguments": {"body": ["a"]},
            "__user_id": _USER,
            "__user_role": 1,
        }
    )
    assert out["ok"] is True, out
    assert captured[-1]["url"].endswith("/orders/batch")
    # 身份字段以注入值为准:模型在 arguments 里伪造 __user_role 不生效
    forged = await bridge._call_endpoint_tool(
        {
            "name": "api_batchorder",
            "arguments": {"__user_role": 9, "body": ["a"]},
            "__user_id": _USER,
            "__user_role": 0,
        }
    )
    assert forged["errorCode"] == "PERMISSION_DENIED", forged


async def test_setup_degrades_when_spec_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_TOOLS_MODE", "read")

    async def boom(force: bool = False) -> dict[str, Any]:
        raise httpx.ConnectError("api down")

    monkeypatch.setattr(bridge, "fetch_openapi_spec", boom)
    assert await bridge.setup_api_tools_bridge() == 0


async def test_fetch_spec_cached_and_force_refetch(monkeypatch: pytest.MonkeyPatch) -> None:
    hits: list[str] = []

    async def fake_request(self: Any, method: str, url: str, **kwargs: Any) -> _FakeResp:
        hits.append(str(url))
        return _FakeResp(payload={"paths": {}}, text="{}")

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_request)
    await bridge.fetch_openapi_spec()
    await bridge.fetch_openapi_spec()
    assert len(hits) == 1
    await bridge.fetch_openapi_spec(force=True)
    assert len(hits) == 2


def test_internal_headers_omit_missing_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AI_CALLBACK_SECRET", raising=False)
    monkeypatch.delenv("INTERNAL_SERVICE_TOKEN", raising=False)
    assert bridge.internal_headers(_USER) == {"x-user-id": _USER}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
