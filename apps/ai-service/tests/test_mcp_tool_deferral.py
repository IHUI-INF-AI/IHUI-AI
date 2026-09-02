"""MCP 工具定义 deferral(瘦身)与 list_changed 动态刷新测试(2026-09-02 立)。

覆盖:
- deferral 开启:ToolDefinition 描述 ≤80 字符、parameters 为占位;get_tool_schema 强制完整;
- deferral 关闭:行为与历史一致(完整 description + 完整 parameters);
- get_tool_schema 返回完整 schema(内置工具来源 + register_external_tool 外部来源);
- list_changed 通知自增 toolsVersion,tools/list 响应附带 toolsVersion;未知通知返回空 result;
- _shorten_description 边界(空串 / 纯 markdown / 超长 / 正常多行)。
"""

import os
from typing import Any

import pytest

from app.routers import agents as agents_router
from app.routers import mcp_official
from app.services import mcp_server as mcp_module
from app.services.mcp_server import mcp_server as mcp_instance


# ---------------------------------------------------------------------------
# 1. deferral 开启:短描述 + 占位参数
# ---------------------------------------------------------------------------


def test_deferral_on_shortens_description_and_placeholder_params(monkeypatch: Any) -> None:
    monkeypatch.setenv("TOOL_DEFERRAL", "on")
    tools = agents_router._build_loop_v2_tools(None)
    assert tools, "deferral 开启时应至少包含工具"

    # get_tool_schema 必须被强制纳入(否则模型无法反查完整参数)
    assert any(t.name == "get_tool_schema" for t in tools)

    for t in tools:
        if t.name == "get_tool_schema":
            # 自身保持完整 schema,不得被 deferral 精简
            assert t.parameters != {"type": "object"}
            assert "properties" in t.parameters
            continue
        # 精简后描述必须 ≤80 字符
        assert len(t.description) <= 80, f"{t.name} 描述超 80 字符: {t.description!r}"
        # 参数必须为最小占位
        assert t.parameters == {"type": "object"}, t.name


# ---------------------------------------------------------------------------
# 2. deferral 关闭:行为与历史完全一致
# ---------------------------------------------------------------------------


def test_deferral_off_keeps_full_definition(monkeypatch: Any) -> None:
    monkeypatch.setenv("TOOL_DEFERRAL", "off")
    tools = agents_router._build_loop_v2_tools(None)
    by_name = {t.name: t for t in tools}
    src = {mt.name: mt for mt in mcp_instance.list_tools()}

    assert "search_codebase" in by_name
    td = by_name["search_codebase"]
    # 完整描述应与源工具定义一致(未被精简)
    assert td.description == src["search_codebase"].description
    # 完整参数应与源 input_schema 一致(而非占位 {"type": "object"})
    assert td.parameters == src["search_codebase"].input_schema


# ---------------------------------------------------------------------------
# 3. get_tool_schema 返回完整 schema(两来源)
# ---------------------------------------------------------------------------


async def test_get_tool_schema_builtin(monkeypatch: Any) -> None:
    res = await mcp_instance.call_tool("get_tool_schema", {"name": "search_codebase"})
    assert res.get("ok") is True
    schema = res["schema"]
    assert schema["name"] == "search_codebase"
    assert "properties" in schema["input_schema"]


async def test_get_tool_schema_external(monkeypatch: Any) -> None:
    ext = mcp_module.MCPTool(
        name="mcp:test__widget",
        description="外部工具示例:返回一个 widget 摘要。",
        input_schema={
            "type": "object",
            "properties": {"id": {"type": "string", "description": "widget id"}},
            "required": ["id"],
        },
    )

    async def _h(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True, "widget": args.get("id")}

    assert mcp_module.register_external_tool(ext, _h) is True
    try:
        # 注册表应已覆盖外部来源
        assert "mcp:test__widget" in mcp_module.list_deferred_tool_names()
        res = await mcp_instance.call_tool("get_tool_schema", {"name": "mcp:test__widget"})
        assert res.get("ok") is True
        assert res["schema"]["input_schema"]["properties"]["id"]["type"] == "string"
    finally:
        mcp_module.unregister_external_tools(["mcp:test__widget"])
    # 卸载后注册表应同步清理
    assert "mcp:test__widget" not in mcp_module.list_deferred_tool_names()


async def test_get_tool_schema_unknown(monkeypatch: Any) -> None:
    res = await mcp_instance.call_tool("get_tool_schema", {"name": "no_such_tool_xyz"})
    assert res.get("ok") is False
    assert "available" in res


# ---------------------------------------------------------------------------
# 4. list_changed → toolsVersion 自增 + tools/list 附带版本
# ---------------------------------------------------------------------------


def test_list_changed_bumps_tools_version() -> None:
    before = mcp_official.get_tools_version()
    r = mcp_official._handle_notification("notifications/tools/list_changed")
    assert r == {}
    assert mcp_official.get_tools_version() == before + 1


def test_tools_list_includes_tools_version() -> None:
    res = mcp_official._handle_tools_list()
    assert "toolsVersion" in res
    assert isinstance(res["toolsVersion"], int)
    # 兼容既有计数断言(工具数仍 ≥ 48)
    assert len(res["tools"]) >= 48


def test_unknown_notification_returns_empty_result() -> None:
    before = mcp_official.get_tools_version()
    r = mcp_official._handle_notification("notifications/bogus")
    assert r == {}
    # 未知通知不 bump 版本号
    assert mcp_official.get_tools_version() == before


# ---------------------------------------------------------------------------
# 5. _shorten_description 边界
# ---------------------------------------------------------------------------


def test_shorten_empty() -> None:
    s = agents_router._shorten_description("", limit=80)
    assert s != ""
    assert len(s) <= 80


def test_shorten_pure_markdown() -> None:
    s = agents_router._shorten_description("### **bold** `code`", limit=80)
    assert "**" not in s and "`" not in s
    assert len(s) <= 80
    # 纯符号(无语义文本)应回退为占位而非空串
    s2 = agents_router._shorten_description("###", limit=80)
    assert s2 != ""


def test_shorten_overlong() -> None:
    long = "x" * 200
    s = agents_router._shorten_description(long, limit=80)
    assert len(s) <= 80
    assert s.endswith("…")


def test_shorten_multiline() -> None:
    s = agents_router._shorten_description("第一行有效描述。\n第二行冗余细节。", limit=80)
    assert "第二行" not in s
    assert len(s) <= 80


def test_shorten_respects_limit() -> None:
    s = agents_router._shorten_description("简短描述", limit=4)
    assert len(s) <= 4
