# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""ai_service_bridge.py(本服务自身 OpenAPI → MCP 工具桥接)单元测试。

覆盖策略:纯转换逻辑(排除面/命名/上限/schema)直测;出站走**进程内 ASGI**
(与 conftest 的 client fixture 同手法),不触达网络端口。真实调用只挑零副作用的
只读端点(health / mcp skills),写操作只断言权限闸短路,不真改状态。
注册进全局工具表的用例在夹具里按 ais_ 前缀清理,防污染同进程其他用例。
"""

from __future__ import annotations

from typing import Any

import pytest

from app.services import ai_service_bridge as bridge

_SPEC: dict[str, Any] = {
    "paths": {
        "/api/llm/models": {
            "get": {"operationId": "list_models", "summary": "List Models"}
        },
        # 自指递归面:LLM 对话入口,默认必须被排除
        "/api/llm/complete": {
            "post": {"operationId": "llm_complete", "summary": "触发 AI 对话"}
        },
        "/api/langgraph/run": {
            "post": {"operationId": "lg_run", "summary": "LangGraph 执行"}
        },
        "/api/skills/{name}": {
            "get": {
                "operationId": "get_skill",
                "summary": "读技能",
                "parameters": [
                    {"name": "name", "in": "path", "required": True, "schema": {"type": "string"}},
                    {"name": "x-trace", "in": "header", "schema": {"type": "string"}},
                ],
            }
        },
        "/api/orders": {
            "post": {
                "operationId": "create_order",
                "summary": "创建订单",
                "requestBody": {
                    "content": {"application/json": {"schema": {"type": "object", "properties": {"sku": {"type": "string"}}}}}
                },
            }
        },
        "/docs/json": {"get": {"operationId": "get_spec", "summary": "文档"}},
        "/internal/secret": {"get": {"operationId": "get_secret", "summary": "内部"}},
    }
}


@pytest.fixture(autouse=True)
def _clean_registry() -> Any:
    """每个用例后清空 ais_ 前缀外部工具与侧表,防污染全局工具注册表。"""
    yield
    bridge.unregister_ai_service_bridge()


def _reset_app_holder() -> None:
    bridge._APP_HOLDER.clear()


# ---------------------------------------------------------------------------
# 纯逻辑:排除面
# ---------------------------------------------------------------------------

def test_excluded_self_recursive_llm_routes() -> None:
    """自指递归面默认排除:模型不能再调一次完整对话(防嵌套/token 失控)。"""
    assert bridge._is_excluded("/api/llm/complete")
    assert bridge._is_excluded("/api/llm/complete/stream")
    assert bridge._is_excluded("/api/langgraph/run")
    # 只读能力面不排除
    assert not bridge._is_excluded("/api/llm/models")


def test_excluded_default_prefixes(monkeypatch: pytest.MonkeyPatch) -> None:
    """docs/internal 排除(复用 api_tools_bridge 的规则,单一真相源)。"""
    monkeypatch.delenv("AIS_TOOLS_ALLOW_LLM_ROUTES", raising=False)
    assert bridge._is_excluded("/docs/json")
    assert bridge._is_excluded("/internal/secret")


def test_llm_routes_can_be_explicitly_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    """显式放开自指递归面(须自担风险),仅该开关生效。"""
    monkeypatch.setenv("AIS_TOOLS_ALLOW_LLM_ROUTES", "1")
    assert not bridge._is_excluded("/api/llm/complete")


# ---------------------------------------------------------------------------
# 纯逻辑:命名 / schema / 上限
# ---------------------------------------------------------------------------

def test_self_tool_name_uses_ais_prefix() -> None:
    assert bridge._self_tool_name("GET", "/api/llm/models", {"operationId": "list_models"}) == "ais_list_models"
    assert bridge._self_tool_name("POST", "/api/orders", {}).startswith("ais_")


def test_iter_self_operations_excludes_and_orders(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AIS_TOOLS_ALLOW_LLM_ROUTES", raising=False)
    ops = bridge._iter_self_operations(_SPEC)
    paths = {p for _, p, _ in ops}
    assert "/api/llm/complete" not in paths
    assert "/api/langgraph/run" not in paths
    assert "/docs/json" not in paths
    assert "/internal/secret" not in paths
    assert "/api/llm/models" in paths
    assert "/api/skills/{name}" in paths


def test_iter_self_operations_caps_after_method_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """上限在方法过滤之后:read 模式不被截断成"前 N 个里恰好是 GET"。"""
    monkeypatch.setenv("API_TOOLS_MAX", "1")
    ops = bridge._iter_self_operations(_SPEC, {"GET"})
    assert [m for m, _, _ in ops] == ["GET"]
    # cap=False 供侧表覆盖被上限截断的长尾
    assert len(bridge._iter_self_operations(_SPEC, {"GET"}, cap=False)) == 2


def test_schema_drops_header_and_marks_path_required() -> None:
    op = _SPEC["paths"]["/api/skills/{name}"]["get"]
    schema = bridge._build_input_schema(op)  # 复用 api_tools_bridge,零重写
    assert set(schema["properties"]) == {"name"}
    assert schema["required"] == ["name"]


# ---------------------------------------------------------------------------
# 端点 handler:权限闸 / 路径参数
# ---------------------------------------------------------------------------

def _app() -> Any:
    """惰性取全局 app 并喂进桥接的 app 句柄(复用 conftest 的 _get_app 语义)。"""
    from app.main import fastapi_app

    bridge._APP_HOLDER["app"] = fastapi_app
    return fastapi_app


@pytest.mark.asyncio
async def test_write_requires_admin_role() -> None:
    """写操作 role<1 直接 PERMISSION_DENIED,不发起调用(fail-closed)。"""
    _app()
    handler = bridge.make_ais_handler("POST", "/api/orders")
    result = await handler({"__user_id": "u1", "__user_role": 0, "sku": "x"})
    assert result["ok"] is False
    assert result["errorCode"] == "PERMISSION_DENIED"


@pytest.mark.asyncio
async def test_missing_path_param_named_error() -> None:
    """path 参数缺失给具名回执,不把模板原样发出去。"""
    _app()
    handler = bridge.make_ais_handler("GET", "/api/skills/{name}")
    result = await handler({"__user_id": "u1", "__user_role": 0})
    assert result["ok"] is False
    assert result["errorCode"] == "MISSING_PATH_PARAM"


# ---------------------------------------------------------------------------
# 真实只读端点:进程内 ASGI 自调用打通
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_real_readonly_endpoint_via_inprocess_asgi() -> None:
    """挑零副作用只读端点(/api/mcp/skills 空列表)实测进程内调用,含 path 参数。"""
    _app()
    handler = bridge.make_ais_handler("GET", "/api/mcp/skills/{name}")
    result = await handler({"__user_id": "u1", "__user_role": 0, "name": "nonexistent-skill"})
    # 端点存在且走通了(无论业务上 200 还是 404,都证明 ASGI 自调用打通、身份已签)
    assert "status" in result
    assert result.get("errorCode") in (None, "AIS_BRIDGE_ERROR")


# ---------------------------------------------------------------------------
# 入口工具:先搜后调
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_search_domain_listing_and_filter() -> None:
    """空查询列域清单;按 domain 下钻;domain+query 组合过滤。

    682 条端点对模型偏多,域浏览是先浏览全局能力分布再下钻的入口(2026-11-13 增量)。
    """
    _app()
    bridge._AIS_TOOL_INDEX.clear()
    bridge._AIS_TOOL_INDEX["ais_read_card"] = {
        "method": "GET", "path": "/api/knowledge/cards", "summary": "读卡片", "domain": "knowledge",
    }
    bridge._AIS_TOOL_INDEX["ais_compile"] = {
        "method": "POST", "path": "/api/knowledge/compile", "summary": "编译", "domain": "knowledge",
    }
    bridge._AIS_TOOL_INDEX["ais_list_models"] = {
        "method": "GET", "path": "/api/llm/models", "summary": "列模型", "domain": "llm",
    }
    # 空查询 → 域清单模式
    listing = await bridge._ais_search({"__user_id": "u1"})
    assert listing["mode"] == "domains"
    assert listing["total"] == 3
    doms = {d["domain"]: d["endpoints"] for d in listing["domains"]}
    assert doms == {"knowledge": 2, "llm": 1}
    # 按 domain 下钻
    drill = await bridge._ais_search({"__user_id": "u1", "domain": "knowledge"})
    assert drill["mode"] == "endpoints"
    assert drill["count"] == 2
    assert all(e["domain"] == "knowledge" for e in drill["endpoints"])
    # domain + query 组合:knowledge 域里搜不到 llm 的工具
    combo = await bridge._ais_search({"__user_id": "u1", "domain": "knowledge", "query": "卡片"})
    assert combo["count"] == 1
    assert combo["endpoints"][0]["name"] == "ais_read_card"
    # 隔离:清侧表防污染后续用例
    bridge._AIS_TOOL_INDEX.clear()


@pytest.mark.asyncio
async def test_search_and_call_entry_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    """ais_endpoints_search → ais_endpoint_call 全链;越权 name 被拒。"""
    _app()
    bridge._AIS_TOOL_INDEX["ais_get_skill"] = {"method": "GET", "path": "/api/mcp/skills/{name}", "summary": "读技能"}
    found = await bridge._ais_search({"__user_id": "u1", "query": "skill"})
    assert found["ok"] is True
    assert any(e["name"] == "ais_get_skill" for e in found["endpoints"])
    called = await bridge._ais_call(
        {"__user_id": "u1", "__user_role": 0, "name": "ais_get_skill", "arguments": {"name": "x"}}
    )
    assert called["tool"] == "ais_get_skill"
    assert "status" in called
    # 非 ais_ 前缀一律拒绝 —— 否则等于把 run_command 暴露给字符串参数
    blocked = await bridge._ais_call({"__user_id": "u1", "name": "run_command", "arguments": {}})
    assert blocked["ok"] is False
    assert blocked["errorCode"] == "UNKNOWN_AIS_TOOL"


@pytest.mark.asyncio
async def test_setup_off_mode_registers_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    """API_TOOLS_MODE=off 时本桥不注册任何端点工具(与 api 桥同族开关)。"""
    monkeypatch.setenv("API_TOOLS_MODE", "off")
    _app()
    n = await bridge.setup_ai_service_bridge()
    assert n == 0
    assert len(bridge._AIS_TOOL_INDEX) == 0


@pytest.mark.asyncio
async def test_setup_registers_and_populates_index(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认档注册非零端点工具,且侧表覆盖 ≥ 工具表(API_TOOLS_MAX 截断长尾)。"""
    monkeypatch.setenv("API_TOOLS_MAX", "5")
    _app()
    n = await bridge.setup_ai_service_bridge()
    assert n > 0
    # 工具表(注册数)= 端点工具 + 2 个入口;侧表可覆盖更长的尾
    assert len(bridge._AIS_TOOL_INDEX) >= n - 2

@pytest.mark.asyncio
async def test_search_entry_points_to_the_other_bridge(monkeypatch: pytest.MonkeyPatch) -> None:
    """搜索入口的描述必须给模型指路到 api_* 族(2026-11-13 立)。

    立因(实测发现):本桥只覆盖 ai-service 自身(653 端点),而业务域接口(人事/电商/内容/订单)
    在 apps/api,属 api_* 族。两族描述各自只讲自己那一半、却都长得像"全项目接口目录" ——
    模型在本桥搜不到时会断言"项目没有这个接口"。这不是模型能力问题,是工具描述漏了它该知道的事实。

    这条锁钉的是"引路文案在位":文案被删/被改短到提不出 api_list_endpoints 时,这里会红。
    """
    _app()
    # `_entry_tools()` 返回 [(MCPTool, handler), …];MCPTool 不可哈希 ⇒ 按 .name 找,不建 dict
    search = next(tool for tool, _ in bridge._entry_tools() if tool.name == "ais_endpoints_search")
    desc = search.description
    assert "api_list_endpoints" in desc, "搜索入口必须点名另一族桥的入口工具名"
    assert "apps/api" in desc, "必须说清另一半在哪个后端"
    # 反向提示同样重要:不能只说"还有别的",要说清"搜不到该怎么办"
    assert "不要断言" in desc
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
