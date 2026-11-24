# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具面能力门(缺口表 #7)接线锁。

钉住的五条性质(逐条对应派单书要求的 ①–⑤):
  ① 默认档零扰动 —— 未设任何 env 时,列表面可见集与 `_TOOLS` **逐字同序同集**(反向对照);
  ② 关掉一枚能力键 ⇒ 该族工具从列表消失,且**其它工具一条不少**;
  ③ 被隐藏的工具被直接调用 ⇒ 具名拒绝(CAPABILITY_DISABLED + 缺哪个键 + 下一步),
     且**零副作用**(真实 handler 一次都没被调用);
  ④ 声明表的键必须全部在能力台账在册(单源,§0.6;新增键须按既有 entry 形状登记);
  ⑤ 列表面与执行面用的是**同一把尺**(逐工具双向等价 + 源码层禁第二处读 env)。

不连生产库/Redis(测试隔离铁律):只用 `_TOOLS` 静态清单与 spy handler。
"""

from __future__ import annotations

import ast
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.core.capability_matrix import CAPABILITY_MATRIX
from app.services import tool_surface as ts
from app.services.mcp_server import _TOOLS, MCPServer, MCPTool
from app.services.tool_surface import (
    PRODUCT_FORM_CAPABILITY_OVERRIDES,
    TOOL_CAPABILITY_REQUIREMENTS,
    TOOL_FAMILY_CAPABILITY_REQUIREMENTS,
)


def declared_capability_keys() -> set[str]:
    """三张声明表里出现的全部能力键(测试④的输入面;不另抄一份清单)。"""
    keys: set[str] = set()
    for group in (
        TOOL_CAPABILITY_REQUIREMENTS.values(),
        TOOL_FAMILY_CAPABILITY_REQUIREMENTS.values(),
    ):
        for key_tuple in group:
            keys.update(key_tuple)
    for overrides in PRODUCT_FORM_CAPABILITY_OVERRIDES.values():
        keys.update(overrides)
    keys.add(ts.PRODUCT_FORM_CAPABILITY_KEY)
    return keys


@pytest.fixture(autouse=True)
def _default_env_isolation(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """每个用例起手把**声明表涉及的 env** 全清掉 ⇒ 度量的是"未设任何 env"那一档。

    本机 `.env` 里 `UI_ACTION_TOOLS`/`APP_UI_TOOLS` 确有登记(conftest 会 load_dotenv),
    所以"默认档"必须由用例显式清键得到,不能靠机器现状 —— 否则零扰动断言测的是本机配置。
    """
    for key in declared_capability_keys():
        entry = ts.matrix_entry_of(key)
        assert entry is not None, f"能力键 {key} 不在台账,零扰动档无法构造"
        monkeypatch.delenv(entry["env"], raising=False)
    yield


# ── ① 默认档零扰动(反向对照)──────────────────────────────────────────────


def test_default_surface_is_verbatim_identical_to_tools_registry() -> None:
    names = [t.name for t in _TOOLS]
    visible = ts.visible_tool_names(_TOOLS)
    assert visible == names, "默认档列表面必须与 _TOOLS 逐字同序同集(零扰动)"
    assert len(visible) == len(names)


def test_default_surface_hides_nothing_even_for_declared_families() -> None:
    """族前缀在默认档一律不命中:命中即说明某枚在册键的 default 被改成了关(零扰动前提坏)。"""
    for family, family_keys in TOOL_FAMILY_CAPABILITY_REQUIREMENTS.items():
        sample = [t.name for t in _TOOLS if t.name.startswith(family)]
        for tool_name in sample:
            assert not ts.is_tool_hidden(tool_name), f"{tool_name} 在默认档被隐藏"
        # 静态族(computer_)必须真枚举到候选;枚举到 0 不记绿(§0.3)。
        if family == "computer_":
            assert sample, "computer_ 族在 _TOOLS 里枚举到 0 枚 —— 族前缀声明已腐烂"
            assert family_keys, "族前缀声明本身不得为空(空声明等于没声明)"


# ── ② 关一键 ⇒ 该族消失且其它一条不少 ─────────────────────────────────────


def test_disabling_one_key_drops_exactly_that_family_and_keeps_everything_else(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "false")
    names = [t.name for t in _TOOLS]
    hidden = [n for n in names if n.startswith("computer_")]
    assert hidden, "夹具前提:computer_ 族必须有静态工具"
    visible = ts.visible_tool_names(_TOOLS)
    assert set(hidden).isdisjoint(visible)
    assert visible == [n for n in names if n not in set(hidden)], "其它工具一条不许少"
    # 反向对照:同一把尺在执行面也判同一批(见测试⑤的逐工具等价)。
    for tool_name in hidden:
        assert ts.capability_denial(tool_name) is not None


@pytest.mark.parametrize(
    ("tool_name", "env", "capability_key"),
    [
        ("browser_page_click", "PAGE_CONTROL_TOOLS", "page_control_tools"),
        ("web_ui_click", "UI_ACTION_TOOLS", "ui_action_tools"),
        ("mobile_ui_click", "APP_UI_TOOLS", "app_ui_tools"),
        ("taro_ui_navigate", "APP_UI_TOOLS", "app_ui_tools"),
    ],
)
def test_dynamic_family_rules_apply_to_registered_names(
    monkeypatch: pytest.MonkeyPatch, tool_name: str, env: str, capability_key: str
) -> None:
    """动态注册族(page_control/ui_action 桥接件)在 import 期不在 `_TOOLS`,
    故按**合成清单**验族规则:关该键 ⇒ 该枚隐;开该键 ⇒ 该枚在。"""
    monkeypatch.setenv(env, "false")
    tools = [MCPTool(name=tool_name, description="d", input_schema={"type": "object"})]
    assert ts.filter_visible_tools(tools) == []
    assert ts.required_capabilities_of(tool_name) == (capability_key,)

    monkeypatch.setenv(env, "true")
    assert [t.name for t in ts.filter_visible_tools(tools)] == [tool_name]
    assert ts.capability_denial(tool_name) is None


def test_unjudged_capability_never_hides(monkeypatch: pytest.MonkeyPatch) -> None:
    """取值非布尔形态(含未判定串)⇒ unjudged ⇒ **不隐藏**:没判绝不写成判过(§0.3)。"""
    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "(未判定: 读不到)")
    assert ts.capability_state("computer_automation") == "unjudged"
    assert ts.visible_tool_names(_TOOLS) == [t.name for t in _TOOLS]
    assert ts.capability_denial("computer_screenshot_screen") is None


# ── ③ 被隐藏工具直接调用 ⇒ 具名拒绝且零副作用 ────────────────────────────


@pytest.mark.asyncio
async def test_hidden_tool_call_is_named_denial_with_zero_side_effects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "false")
    calls: list[dict[str, object]] = []

    async def spy(arguments: dict[str, object]) -> dict[str, object]:
        calls.append(arguments)  # 真实执行分支的哨兵:进了这里就是副作用
        return {"ok": True, "tool": "computer_screenshot_screen"}

    result = await ts.guarded_dispatch(
        "computer_screenshot_screen", {"x": 1}, spy
    )
    assert calls == [], "被隐藏的工具绝不能触到真实 handler"
    assert result["ok"] is False
    assert result["errorCode"] == ts.CAPABILITY_DISABLED
    assert result["missingCapability"] == "computer_automation"
    error = str(result["error"])
    assert not error.startswith("未知工具"), "具名拒绝不得伪装成未知工具(前缀判:拒绝体刻意解释了「这不是未知工具」)"
    assert "MCP_COMPUTER_TOOLS_ENABLED" in error, "拒绝体必须点名缺哪个 env(下一步)"


@pytest.mark.asyncio
async def test_enabled_tool_still_dispatches(monkeypatch: pytest.MonkeyPatch) -> None:
    """正向对照:同一 handler 在能力开时照常执行(证明③的拒绝不是因为夹具坏了)。"""
    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "true")
    seen: list[dict[str, object]] = []

    async def handler(arguments: dict[str, object]) -> dict[str, object]:
        seen.append(arguments)
        return {"ok": True}

    result = await ts.guarded_dispatch("computer_screenshot_screen", {"x": 1}, handler)
    assert seen == [{"x": 1}]
    assert result == {"ok": True}


# ── ④ 声明表的键与能力台账单源一致 ────────────────────────────────────────


REQUIRED_MATRIX_FIELDS = {"key", "env", "default", "category", "owner_module", "doc_ref", "reason_if_off"}


def test_every_declared_capability_key_is_registered_in_matrix() -> None:
    matrix_keys = {e["key"] for e in CAPABILITY_MATRIX}
    missing = declared_capability_keys() - matrix_keys
    assert not missing, f"声明表引用了台账外的能力键: {sorted(missing)}"


def test_new_tool_surface_keys_are_registered_with_existing_entry_shape() -> None:
    """本票新增的两枚必须走既有 entry 形状,且布尔那枚默认**开**(默认档零扰动的前提)。"""
    by_key = {e["key"]: e for e in CAPABILITY_MATRIX}
    for key in (
        ts.COMPUTER_AUTOMATION_CAPABILITY_KEY,
        ts.PRODUCT_FORM_CAPABILITY_KEY,
    ):
        entry = by_key.get(key)
        assert entry, f"能力键 {key} 未登记进 capability_matrix.py"
        assert not (REQUIRED_MATRIX_FIELDS - set(entry)), f"{key} 条目字段残缺"
        assert entry["owner_module"].startswith("app.")
        assert entry["doc_ref"].startswith("app/")

    computer = by_key[ts.COMPUTER_AUTOMATION_CAPABILITY_KEY]
    assert computer["default"] == "true", "桌面自动化族必须默认开,否则默认档就动了可见集"
    form = by_key[ts.PRODUCT_FORM_CAPABILITY_KEY]
    assert form["default"] == ts.DEFAULT_PRODUCT_FORM, (
        "台账 default 与 tool_surface.DEFAULT_PRODUCT_FORM 必须逐字相同(两处一份必然漂移)"
    )


def test_env_literals_of_new_keys_live_in_app_source() -> None:
    """J1「幽灵条目」的存续前提:env 字面量必须真出现在 app/ 源码里(不是只在台账自说自话)。"""
    src = Path(ts.__file__).read_text(encoding="utf-8")
    assert f'"{ts.COMPUTER_AUTOMATION_ENV}"' in src
    assert f'"{ts.PRODUCT_FORM_ENV}"' in src


# ── ⑤ 列表面与执行面同一把尺 ──────────────────────────────────────────────


@pytest.mark.parametrize(
    ("env_name", "env_value"),
    [
        ("MCP_COMPUTER_TOOLS_ENABLED", "false"),
        ("PAGE_CONTROL_TOOLS", "false"),
        ("MCP_TOOL_SURFACE_PRODUCT_FORM", "web"),
        ("MCP_TOOL_SURFACE_PRODUCT_FORM", "cli"),
        ("MCP_TOOL_SURFACE_PRODUCT_FORM", "不存在形态"),
    ],
)
def test_list_surface_and_call_surface_agree_per_tool(
    monkeypatch: pytest.MonkeyPatch, env_name: str, env_value: str
) -> None:
    """逐工具双向等价:列表面隐藏的 ⇔ 执行面具名拒绝的,一个都不能差。

    两处分叉的失效型正是本票要消灭的(列表里有、调用被拒 = 骗模型;列表里没有、
    调用却放行 = 隐藏形同虚设)。
    """
    monkeypatch.setenv(env_name, env_value)
    for tool_name in [t.name for t in _TOOLS]:
        hidden = ts.is_tool_hidden(tool_name)
        denied = ts.capability_denial(tool_name) is not None
        assert hidden == denied, f"{tool_name}: 列表面判 {hidden} 而执行面判 {denied}(两把尺)"


def test_surfaces_resolve_through_the_same_single_ruler() -> None:
    """源码层锁:本模块**结构上读不到 env**(不 import os)⇒ 取数只剩台账一条通道;
    两把尺的分叉(一处读 env、一处读台账)在 AST 层即不可能,而不是靠注释自觉。"""
    source = Path(ts.__file__).read_text(encoding="utf-8")
    imported: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
    assert not any(name == "os" or name.startswith("os.") for name in imported), (
        f"tool_surface 出现了 env 读取通道(os 导入:{sorted(imported)})—— 与台账并列为第二把尺"
    )
    assert "current_for_entry" in source, "取数必须走台账 current_for_entry(单源)"

    # 行为层对照:同一枚键在两处投影下取值一致(投影只读状态,不自算)。
    state = ts.capability_state(ts.COMPUTER_AUTOMATION_CAPABILITY_KEY)
    assert state == ts.capability_state(ts.COMPUTER_AUTOMATION_CAPABILITY_KEY)


def test_product_form_axis_is_inert_when_form_undeclared() -> None:
    """形态取值不在覆盖表键集 ⇒ 该轴整体不生效(宁多给可见,不静默少给能力)。"""
    unknown = "totally-unknown-form"
    assert unknown not in PRODUCT_FORM_CAPABILITY_OVERRIDES
    assert ts.capability_state(
        ts.COMPUTER_AUTOMATION_CAPABILITY_KEY, product_form=(unknown, False)
    ) == "enabled"


def test_product_form_overrides_hide_declared_families(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """形态轴:web 宿主没有桌面自动化通道 ⇒ computer_ 族整族隐藏,其余一条不少。"""
    monkeypatch.setenv("MCP_TOOL_SURFACE_PRODUCT_FORM", "web")
    names = [t.name for t in _TOOLS]
    visible = ts.visible_tool_names(_TOOLS)
    hidden = [n for n in names if n not in set(visible)]
    assert hidden and all(n.startswith("computer_") for n in hidden)
    assert ts.resolve_product_form() == ("web", True)
    denial = ts.capability_denial("computer_screenshot_screen")
    assert denial is not None and "产品形态 web" in str(denial["error"])


# ── ⑥ 接线锁:模块判据真装到了 MCPServer 的两条面上(造好没装车 = 没有)──────
# 前五组钉的是判据本身;这一组钉的是"它被谁调用"。少了这组,把 tool_surface 删掉、
# 或把 list_tools/call_tool 的接线回退,前面 20 例照样全绿 —— 那正是本仓最贵的假绿型。


def test_mcp_server_list_tools_is_wired_to_the_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    server = MCPServer()
    baseline = [t.name for t in server.list_tools()]
    assert baseline == [t.name for t in _TOOLS], (
        "接线后默认档列表面仍须与 _TOOLS 逐字同序同集(零扰动是接线的前提,不是追加条件)"
    )

    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "false")
    visible = [t.name for t in server.list_tools()]
    expected = [n for n in baseline if not n.startswith("computer_")]
    assert visible == expected, "接线后关键:该族必须从服务端清单消失,其余一条不少"


@pytest.mark.asyncio
async def test_mcp_server_call_tool_is_wired_to_the_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """真调 `MCPServer.call_tool`(不经 guarded_dispatch):接线点必须在执行链之前。"""
    from app.services import mcp_server as mcp_mod

    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "false")
    hits: list[str] = []

    async def spy(arguments: dict[str, object]) -> dict[str, object]:
        hits.append("hit")
        return {"ok": True}

    monkeypatch.setitem(mcp_mod._TOOL_HANDLERS, "computer_screenshot_screen", spy)
    result = await MCPServer().call_tool("computer_screenshot_screen", {}, user_role=1)
    assert hits == [], "被能力门摘掉的工具绝不能触到真实 handler"
    assert result["errorCode"] == ts.CAPABILITY_DISABLED
    assert not str(result["error"]).startswith("未知工具"), "能力拒绝不得与未知工具同形"

    # 正向对照:同一枚 handler 在能力开时照常执行(证明上面的拒绝不是因为夹具坏了)。
    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "true")
    ok = await MCPServer().call_tool("computer_screenshot_screen", {}, user_role=1)
    assert ok == {"ok": True}
    assert hits == ["hit"]


@pytest.mark.asyncio
async def test_get_tool_schema_face_agrees_with_the_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """反查面(get_tool_schema)与列表面同尺:被摘掉的工具不得交回"看起来能调"的 schema。"""
    from app.services import mcp_server as mcp_mod

    target = "computer_screenshot_screen"
    if target not in mcp_mod.list_deferred_tool_names():
        pytest.skip(f"{target} 未登记进 deferral 注册表 —— 反查面夹具不成立(不记绿)")

    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "false")
    denied = await mcp_mod._tool_get_tool_schema({"name": target})
    assert denied["ok"] is False
    assert denied["schema"] is None
    assert denied["errorCode"] == ts.CAPABILITY_DISABLED

    monkeypatch.setenv("MCP_COMPUTER_TOOLS_ENABLED", "true")
    allowed = await mcp_mod._tool_get_tool_schema({"name": target})
    assert allowed["ok"] is True and allowed["schema"] is not None

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
