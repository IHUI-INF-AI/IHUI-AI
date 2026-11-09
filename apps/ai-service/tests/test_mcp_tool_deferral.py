# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 工具定义 deferral(瘦身)与 list_changed 动态刷新测试(2026-09-02 立)。

覆盖:
- deferral 开启:ToolDefinition 描述压缩到一行、内置工具 parameters 原样保留、
  api_* 长尾保留键名/类型/required 只删字段 description;get_tool_schema 强制完整;
- deferral 关闭:行为与历史一致(完整 description + 完整 parameters);
- get_tool_schema 返回完整 schema(内置工具来源 + register_external_tool 外部来源);
- list_changed 通知自增 toolsVersion,tools/list 响应附带 toolsVersion;未知通知返回空 result;
- _shorten_description 边界(空串 / 纯 markdown / 超长 / 正常多行)。
"""

import asyncio
import json
from typing import Any

import pytest

from app.routers import agents as agents_router
from app.routers import mcp_official
from app.services import mcp_server as mcp_module
from app.services.mcp_server import mcp_server as mcp_instance

# ---------------------------------------------------------------------------
# 1. deferral 开启:描述压缩 + 分层参数(内置保留 / api_* 只删字段描述)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_deferral_on_compresses_description_and_keeps_builtin_params(
    monkeypatch: Any,
) -> None:
    """deferral 开启:描述压到一行,内置工具 parameters 原样保留。

    旧版本此例钉的是 `parameters == {"type": "object"}` —— 那正是病灶本身(模型看不见
    `command` 就会判"没有这个工具"),所以本例随 2026-11-09 的修复**改判据而不是删例**。
    """
    monkeypatch.setenv("TOOL_DEFERRAL", "on")
    tools = await agents_router._build_loop_v2_tools(None)
    assert tools, "deferral 开启时应至少包含工具"

    # get_tool_schema 必须被强制纳入(否则模型无法反查完整参数)
    assert any(t.name == "get_tool_schema" for t in tools)

    src = {mt.name: mt for mt in mcp_instance.list_tools()}
    for t in tools:
        if t.name == "get_tool_schema":
            # 自身保持完整 schema,不得被 deferral 精简
            assert t.parameters != {"type": "object"}
            assert "properties" in t.parameters
            continue
        # 精简后描述必须非空且 ≤ 上限(一行,不整段展开)
        assert 0 < len(t.description) <= agents_router._TOOL_DEFERRAL_DESC_LIMIT, (
            t.name
        )
        # 内置工具参数必须原样保留 —— 病灶就是"模型看不到 command 参数"
        if t.name in src:
            assert t.parameters == src[t.name].input_schema, t.name


# ---------------------------------------------------------------------------
# 2. deferral 关闭:行为与历史完全一致
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_deferral_off_keeps_full_definition(monkeypatch: Any) -> None:
    monkeypatch.setenv("TOOL_DEFERRAL", "off")
    tools = await agents_router._build_loop_v2_tools(None)
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
    r = asyncio.run(mcp_official._handle_notification("notifications/tools/list_changed"))
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
    r = asyncio.run(mcp_official._handle_notification("notifications/bogus"))
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


def test_shorten_keeps_underscore_identifiers() -> None:
    """下划线不得再被当 markdown 强调符号吃掉(工具名/常量名靠它才读得出)。"""
    s = agents_router._shorten_description(
        "用 run_command 执行命令,并发写会返回 CONCURRENT_MODIFICATION。", limit=120
    )
    assert "run_command" in s
    assert "CONCURRENT_MODIFICATION" in s


def test_deferral_api_params_keep_shape_and_drop_only_descriptions() -> None:
    """api_* 长尾:properties/required/type 全留,只删 description 文本。"""
    schema = {
        "type": "object",
        "description": "顶层描述也应删除",
        "properties": {
            "id": {"type": "string", "description": "path 参数 id"},
            "nested": {
                "type": "object",
                "properties": {
                    "flag": {"type": "boolean", "description": "嵌套字段说明"}
                },
            },
            "tags": {
                "type": "array",
                "items": {"type": "string", "description": "标签"},
            },
        },
        "required": ["id"],
    }
    out = agents_router._deferral_tool_parameters("api_demo_endpoint", schema)
    assert out["type"] == "object"
    assert out["required"] == ["id"]
    assert set(out["properties"]) == {"id", "nested", "tags"}
    assert out["properties"]["id"] == {"type": "string"}
    assert out["properties"]["nested"]["properties"]["flag"] == {"type": "boolean"}
    assert out["properties"]["tags"]["items"] == {"type": "string"}
    # 不得出现"有 required 却没有对应 properties"的畸形形状
    assert set(out["required"]) <= set(out["properties"])
    assert "description" not in json.dumps(out, ensure_ascii=False, default=str)
    # 源对象不得被就地改坏(递归删除必须走副本)
    assert schema["properties"]["id"]["description"] == "path 参数 id"


def test_deferral_builtin_params_returned_identity() -> None:
    """内置/桥接工具:同一个对象原样返回,不做任何拷贝或裁剪。"""
    schema = {
        "type": "object",
        "properties": {"command": {"type": "string", "description": "shell 命令"}},
        "required": ["command"],
    }
    assert agents_router._deferral_tool_parameters("run_command", schema) is schema
    assert agents_router._deferral_tool_parameters("write_file", None) == {
        "type": "object",
        "properties": {},
    }


def test_deferral_description_takes_first_line() -> None:
    desc = agents_router._deferral_tool_description("第一行摘要\n第二行细节")
    assert desc == "第一行摘要"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
