# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""V3 #47 末格取证:JSON-RPC 面「只留协议适配层」的定义面收口。

前三格把名单(J12)、授权解析(J13)、处置结论(J14)归了一,但 RPC 面(agent_engine)
仍逐条**自带工具定义**。15 处命中(`"name": "` / ``def _*_tool(`` 形态,HEAD 现读)按票面
三分类,本文件用**生产入口现场证明**,不读注释:

- **正当协议面(不删)**:`_build_host_tool_definitions` / `_call_host_tool` 把**客户端
  tools/register 注册**的 HostToolSpec 转成循环定义并发起 tool/execute 往返 —— name 非
  字面量、数据来自连接,这正是"协议 ↔ 内部调用"适配层本体(§7:一刀切会把功能删没)。
  `local` 档 8 个(elicitation/approval 往返、线程态计划、时钟、上下文标志位)注册表
  确实没有等价物,定义住引擎侧就是唯一真相 —— 已在处置表带理由登记。
- **map 档 5 个**(unified_exec/run_code/apply_patch/view_image/spawn_subagent):
  名字与授权经 resolve_engine_tool 归口注册表,执行体因线程/会话耦合(持久 shell、
  code-mode 常驻 cell、V4A 补丁、引擎线程树)保留引擎侧 —— 移植会掉能力,处置表如实
  登记,本票不翻案。
- **port 档 1 个(web_search,唯一与注册表同名的内置)**:此前引擎面手抄 name +
  description,承载层合并时遮蔽注册表条目,注册表那条 MCPTool 定义退化成死元数据 ——
  这就是票面"RPC 面自带工具定义"的残留。本票把它的定义改由唯一出口
  `engine_tool_bridge.port_tool_definition` **现读唯一注册表**;parameters 保留协议
  wire 形状(camelCase maxResults + allowedDomains),属适配层。

测试隔离(§5):全程不触 DB / Redis。对 `_TOOLS` 的"改定义"只在测试进程内换列表对象、
退出即还原;不 import 任何会连库的路径(mcp_server 的导入方为既有测试同形态)。
"""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from typing import Any

import pytest

from app.services import agent_engine as engine_mod
from app.services import mcp_server
from app.services.engine_tool_bridge import (
    ENGINE_TOOL_BRIDGE,
    execution_mode,
    port_tool_definition,
    registry_definition,
)

BUILTINS: tuple[str, ...] = engine_mod.BUILTIN_ENGINE_TOOLS
PORT_NAMES: tuple[str, ...] = tuple(
    n for n, (_eq, _reason, mode) in ENGINE_TOOL_BRIDGE.items() if mode == "port"
)


def _thread() -> engine_mod.EngineThread:
    """够构造期使用的最小引擎线程(定义构造不触达网络/DB)。"""
    return engine_mod.EngineThread(
        thread_id="t-v47",
        session_id="s-v47",
        model=None,
        permission_mode="default",
        max_iterations=1,
        tool_names=None,
        workspace=None,
        user_id=None,
        conversation_id=None,
        messages=[],
    )


def _engine() -> engine_mod.AgentEngine:
    return engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)


def _patched_web_search_description(description: str) -> Any:
    """临时把唯一注册表里 web_search 的 MCPTool 定义换成探针版本(进程内,还原由调用方负责)。"""
    original = mcp_server._TOOLS
    idx = next(
        i for i, tool in enumerate(original) if getattr(tool, "name", "") == "web_search"
    )
    probe = SimpleNamespace(
        name="web_search",
        description=description,
        input_schema=getattr(original[idx], "input_schema", {}),
    )
    mcp_server._TOOLS = [t if i != idx else probe for i, t in enumerate(original)]
    return original


# ---------------------------------------------------------------------------
# 定义唯一来源:port 工具的 name/description 派生自注册表,不是引擎面抄写
# ---------------------------------------------------------------------------


def test_registry_definition_reads_the_single_registry() -> None:
    tool = registry_definition("web_search")
    assert tool is not None
    assert tool.name == "web_search"
    assert tool.description == next(
        t.description for t in mcp_server._TOOLS if getattr(t, "name", "") == "web_search"
    )


def test_port_definition_flows_from_registry_not_from_a_copy() -> None:
    """改注册表那一份,重建的定义必须跟着变;若是手抄,这里不会变 —— 派生 vs 复制的分界。"""
    eng = _engine()
    original = _patched_web_search_description("V47-探针-定义唯一来源")
    try:
        tool = eng._web_search_tool(_thread())
    finally:
        mcp_server._TOOLS = original
    assert tool.name == "web_search"
    assert tool.description == "V47-探针-定义唯一来源"
    # 协议 wire 形状保留:camelCase + 协议专有过滤位仍在(适配层没被顺手删,§7)
    props = tool.parameters.get("properties", {})
    assert "maxResults" in props and "allowedDomains" in props
    assert tool.parameters.get("required") == ["query"]


def test_builtin_definitions_all_still_buildable() -> None:
    """§7 三问的回归钉:本格只改定义来源,不掉能力 —— 14 个内置名仍全部可构造,
    port 那一个的定义描述与注册表逐字同,其余 13 个定义名与内置名一一对应。"""
    eng = _engine()
    defs = eng._builtin_tool_definitions(_thread())
    assert [getattr(d, "name", "") for d in defs] == list(BUILTINS)
    registry_web = registry_definition("web_search")
    web = next(d for d in defs if d.name == "web_search")
    assert web.description == str(registry_web.description)
    assert len(PORT_NAMES) == 1 and PORT_NAMES[0] == "web_search"


# ---------------------------------------------------------------------------
# 唯一出口 fail-fast:不许被拿去给 map/local 洗白
# ---------------------------------------------------------------------------


def test_port_exit_refuses_non_port_and_unregistered_names() -> None:
    for bad in ("view_image", "update_plan", "no_such_builtin"):  # map / local / 未登记
        with pytest.raises(RuntimeError):
            port_tool_definition(bad, parameters={}, executor=lambda _a: None)


def test_port_exit_refuses_when_equivalent_gone_from_registry() -> None:
    """等价物从注册表消失(改名/摘线)时出口必须炸,而不是发一份悬空定义。"""
    original = mcp_server._TOOLS
    mcp_server._TOOLS = [
        t for t in original if getattr(t, "name", "") != "web_search"
    ]
    try:
        with pytest.raises(RuntimeError):
            port_tool_definition("web_search", parameters={}, executor=lambda _a: None)
    finally:
        mcp_server._TOOLS = original


# ---------------------------------------------------------------------------
# 协议面(正当,不得被"归一"误删)的结构事实:出口调用在位 + 其余处置不变
# ---------------------------------------------------------------------------


def test_port_builder_goes_through_the_exit_and_map_local_keep_theirs() -> None:
    """port 构造函数走出口(不含内联 ToolDefinition 构造);map/local 的定义仍住
    引擎面(那是它们的唯一真相)。与本票守门 J15 同一事实的 Python 侧行为载体:
    构造函数是否可用(`_builtin_tool_builder` 命名约定)在此一并钉住。"""
    eng = _engine()
    for name in BUILTINS:
        builder = eng._builtin_tool_builder(name)
        assert callable(builder)
    src = inspect.getsource(engine_mod.AgentEngine._web_search_tool)
    assert "port_tool_definition(" in src
    assert "ToolDefinition(" not in src  # 内联定义回潮即红(与 J15 同一事实)
    for name in BUILTINS:
        if execution_mode(name) == "port":
            continue
        assert execution_mode(name) in ("map", "local")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
