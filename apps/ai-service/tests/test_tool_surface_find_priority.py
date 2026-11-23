# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`find_` 语义族进优先档(P0-8 遗留③收口,2026-11-23)。

背景:`find_import_edges` 的名字不含 `read`/`search`/`list_` 任何一族,
`tight` 档裁剪时排在队尾 —— 而它是代码索引的检索入口,和 `list_` 同属
"先看再改"的第一步。修法按**语义族**补前缀(不按单个工具名特判),所以测试
也要钉在两个面:表数据面(每档都有该族)、行为面(真工具在压力下仍可见)。

钉住的性质:
  ① 在册两表的**五档**全部含 `find_` —— 缺一档就等于该模式下偷偷藏掉检索入口;
  ② 真 `_TOOLS` 在 `tight`/build 档(28 枚上限)下,`find_import_edges` 与
     `list_symbol_definitions` 都可见 —— 上限真的在挤,断言才有意义;
  ③ 反向牙:同一批工具里一个既不在优先族也不在必付格的工具,在同样压力下
     被裁掉 —— 防"其实没挤,断言天然成立"的假绿。

不连生产库/Redis(测试隔离铁律):只用静态清单。
"""

from __future__ import annotations

import pytest

from app.services import mcp_server as mcp_mod
from app.services import tool_surface_budget as tsb
from app.services.tool_surface_budget import BUDGET_TABLES, RoundContext

FIND_FAMILY = "find_"
TIER_NAMES = ("build", "spec", "plan", "review", "ask")


def _visible_names(visible: object) -> list[str]:
    return [t.name for t in visible]  # type: ignore[attr-defined]


@pytest.mark.parametrize("table_name", ["lean", "tight"])
def test_find_family_registered_in_every_tier(table_name: str) -> None:
    """① 两表五档都登记 `find_`;缺档即该模式下检索入口可被裁掉。"""
    table = BUDGET_TABLES[table_name]
    assert [t.name for t in table.tiers] == list(TIER_NAMES)
    for tier in table.tiers:
        assert FIND_FAMILY in tier.priority_prefixes, f"{table_name}/{tier.name} 缺 find_ 族"


def test_find_tools_survive_tight_pressure() -> None:
    """② 真工具集在 28 枚上限下,索引检索入口仍可见。"""
    context = RoundContext(session_mode="build")
    visible = tsb.apply_tool_surface_budget(
        mcp_mod._TOOLS, context=context, table_name="tight"
    )
    names = _visible_names(visible)
    assert "find_import_edges" in names
    assert "list_symbol_definitions" in names
    # 上限确实在起作用(否则本用例是空断言)
    assert len(names) <= 28


def test_neutral_tool_gets_cut_under_same_pressure() -> None:
    """③ 反向牙:同压力下非优先族工具被裁,证明"优先"不是天然成立。"""
    context = RoundContext(session_mode="build")
    visible = tsb.apply_tool_surface_budget(
        mcp_mod._TOOLS, context=context, table_name="tight"
    )
    names = _visible_names(visible)
    cut = [t.name for t in mcp_mod._TOOLS if t.name not in names]
    assert cut, "没有任何工具被裁 ⇒ 上限没生效,①②的断言不成立"
    # 被裁的不能是优先族(优先族若被裁,说明前缀根本没进判定)
    for name in cut:
        assert not name.startswith(FIND_FAMILY), f"{name} 属优先族却被裁"


def test_find_prefix_is_semantic_family_not_tool_specific() -> None:
    """④ 族级而非单名:虚构的 `find_*` 也进优先档(新工具不必再改这一层)。"""
    context = RoundContext(session_mode="build")
    fake = mcp_mod.MCPTool(
        name="find_anything_else",
        description="d",
        input_schema={"type": "object", "properties": {}},
    )
    tools = (fake, *[mcp_mod.MCPTool(name=f"zzz_{i:02d}", description="d",
                                     input_schema={"type": "object", "properties": {}})
                     for i in range(34)])
    visible = tsb.apply_tool_surface_budget(tools, context=context, table_name="tight")
    names = _visible_names(visible)
    assert "find_anything_else" in names
    assert len(names) <= 28
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
