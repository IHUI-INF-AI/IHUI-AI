# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #47 归一:引擎内置工具的能力桥 + 高危判定回查(可运行取证)。

这条测试钉的是**行为**,不是清单:
改前实测 `AgentLoopV2._is_high_risk_tool("unified_exec") is False` —— 引擎内核自带的
起 shell / 跑代码 / 写文件三条工具名不在高危名单里,于是**永不进审批门**,而同一能力
经 run_command / file_edit 进主链路时要审批。授权面随入口而变,就是 #47 的病根本身。
"""

from __future__ import annotations

import pytest

from app.services import mcp_server
from app.services.agent_engine import BUILTIN_ENGINE_TOOLS
from app.services.agent_loop_v2 import (
    _DEFAULT_HIGH_RISK_TOOLS,
    _HIGH_RISK_PREFIXES,
    AgentLoopV2,
)
from app.services.engine_tool_bridge import (
    ENGINE_TOOL_BRIDGE,
    capability_equivalent,
    dangling,
    uncovered,
)


def test_bridge_covers_every_engine_builtin() -> None:
    """新增内置名而不登记桥条目 = 授权面重新分裂,必须当场红。"""
    assert uncovered(BUILTIN_ENGINE_TOOLS) == []


def test_bridge_has_no_stale_entries() -> None:
    """清单腐烂反向锁:内置名被删/改名而桥表还挂着,同样判红。"""
    assert dangling(BUILTIN_ENGINE_TOOLS) == []


def test_declared_equivalents_actually_exist() -> None:
    """登记为「注册表有同一能力」的名字必须真在 _TOOL_HANDLERS 里(否则回查到空气)。"""
    for name, (equivalent, _reason) in ENGINE_TOOL_BRIDGE.items():
        if equivalent is None:
            continue
        assert equivalent in mcp_server._TOOL_HANDLERS, (
            f"{name} 声明等价物 {equivalent} 不在统一注册表里"
        )


def test_local_only_entries_explain_themselves() -> None:
    """无等价物时必须写清理由 —— 否则后人只能猜,而猜会把分裂读成已收口。"""
    for name, (equivalent, reason) in ENGINE_TOOL_BRIDGE.items():
        if equivalent is None:
            assert reason is not None and len(reason.strip()) >= 8, f"{name} 缺理由"
        else:
            assert reason is None, f"{name} 有等价物却填了理由(语义应为空)"


@pytest.mark.parametrize(
    "engine_name",
    ["unified_exec", "run_code", "apply_patch"],
)
def test_exec_and_write_class_builtins_are_high_risk(engine_name: str) -> None:
    """本票的行为变更本体:起 shell / 跑代码 / 写文件类内置名要进审批门。"""
    assert AgentLoopV2._is_high_risk_tool(engine_name) is True


@pytest.mark.parametrize(
    "engine_name",
    [
        "view_image",
        "spawn_subagent",
        "web_search",
        "update_plan",
        "clock_sleep",
        "clock_curr_time",
        "request_permissions",
        "new_context",
    ],
)
def test_read_and_bookkeeping_builtins_stay_low_risk(engine_name: str) -> None:
    """不得顺手把只读/记账类也升成高危 —— 那会把可用能力改成要人守着点批准。"""
    assert AgentLoopV2._is_high_risk_tool(engine_name) is False


def test_registry_tool_verdicts_are_untouched() -> None:
    """非回归:注册表 86 个工具的高危判定逐字等于「名字本身在名单里」。

    桥表唯一的注册表同名条目是 web_search(自我映射),回查它得到的还是它自己,
    所以结论不变;除此以外桥表的键都不是注册表名。
    """
    for tool in mcp_server._TOOLS:
        name = tool.name
        expected = name in _DEFAULT_HIGH_RISK_TOOLS or any(
            name.startswith(p) for p in _HIGH_RISK_PREFIXES
        )
        assert AgentLoopV2._is_high_risk_tool(name) is expected, f"注册表工具 {name} 判定被改动"


def test_only_self_mappings_may_share_a_name_with_the_registry() -> None:
    """引擎内置名若与注册表同名,必须自我映射(回查等于不回查)。

    否则改一行桥表就会改掉注册表侧的判定 —— 那是本票明确不许发生的耦合。
    """
    registry = {tool.name for tool in mcp_server._TOOLS}
    for name, (equivalent, _reason) in ENGINE_TOOL_BRIDGE.items():
        if name in registry:
            assert equivalent == name, f"{name} 与注册表同名却映射到 {equivalent}"


def test_unknown_name_does_not_gain_risk() -> None:
    """没登记的名字不得因为「查不到」而改变结论 —— 它就该原样按名字判。"""
    assert capability_equivalent("not_a_real_tool") is None
    assert AgentLoopV2._is_high_risk_tool("not_a_real_tool") is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
