# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:模型面新工具引擎注册接线测试 — new_context/clock_*/send_message_to_user_async/
request_user_input_async 进入 BUILTIN_ENGINE_TOOLS 并可被 builder 构造。"""

from __future__ import annotations

import asyncio

import pytest

from app.services import agent_engine as engine_mod


def test_new_tools_registered_in_builtin_list() -> None:
    for name in (
        "new_context",
        "clock_sleep",
        "clock_curr_time",
        "send_message_to_user_async",
        "request_user_input_async",
    ):
        assert name in engine_mod.BUILTIN_ENGINE_TOOLS, name


def test_builders_dict_has_all_builtin_names() -> None:
    """每个内置名都必须能构造出工具定义(V3 #47 第一格后改判"由名单单向推导")。

    改前这条测试是**静态**读 `_builtin_tool_definitions` 的源码,要求里面出现
    `"<name>"` 字面量 —— 那等于把"第二份硬编码名单"当规格钉死了。现在名单只有一处
    (`BUILTIN_ENGINE_TOOLS`),构造按命名约定 `_<name>_tool` 取,所以本条改为量行为:
    逐个内置名必须拿到可调用 builder,且构造出的 ToolDefinition 名字与内置名一致。
    """
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.thread_id = "t"
    thread.deny_tools = set()
    thread.host_tools = []
    thread.tool_names = None
    thread.touch = lambda: None
    thread.emit = None
    thread.loop = None
    defs = eng._builtin_tool_definitions(thread)
    built = sorted(getattr(d, "name", "") for d in defs)
    assert built == sorted(engine_mod.BUILTIN_ENGINE_TOOLS), (
        "内置名单与构造出的工具定义不再同形"
    )


def test_builtin_name_without_builder_fails_loud() -> None:
    """名单里有、实现没有 ⇒ 必须当场喊,而不是静默缺一件能力(或运行时 KeyError)。"""
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    with pytest.raises(RuntimeError, match="名单与实现分叉"):
        eng._builtin_tool_builder("definitely_not_an_engine_tool")


def test_second_hardcoded_builtin_name_list_does_not_come_back() -> None:
    """反向回归锁:「内置名 -> self 的绑定方法」那张 dict 不得再出现。

    它是 #47 第一格要消除的第二份真相 —— 名单改一处、构造表改另一处,就会出现
    "某个内置名永远构造不出来"而任何门禁都不红。判据走 **AST** 而不是正则扫源码:
    本文件与 agent_engine 的说明文字里都写过那个形态,按文本判就会把"解释自己的散文"
    判成违规(守门 131 的注释假阳同型),而散文改了判据就跟着漂。
    """
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(engine_mod))
    builtin = set(engine_mod.BUILTIN_ENGINE_TOOLS)
    offenders: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Dict):
            continue
        for key, value in zip(node.keys, node.values, strict=False):
            if not (isinstance(key, ast.Constant) and isinstance(key.value, str)):
                continue
            if key.value not in builtin:
                continue
            if isinstance(value, ast.Attribute) and isinstance(value.value, ast.Name):
                if value.value.id == "self":
                    offenders.append(key.value)
    assert offenders == [], f"这些内置名又被抄进第二份字面量名单: {sorted(set(offenders))}"
    # 阳性对照:判据必须看得见被审形态 —— 现场造一份给它,必须报出来。
    probe = ast.parse('x = {"update_plan": self._update_plan_tool}')
    found = []
    for node in ast.walk(probe):
        if isinstance(node, ast.Dict):
            for key, value in zip(node.keys, node.values, strict=False):
                if (
                    isinstance(key, ast.Constant)
                    and key.value in builtin
                    and isinstance(value, ast.Attribute)
                    and isinstance(value.value, ast.Name)
                    and value.value.id == "self"
                ):
                    found.append(key.value)
    assert found == ["update_plan"], "判据失去识别力(等于没有这条锁)"


def test_new_context_exec_sets_flag() -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None

    class _Loop:
        pass

    loop = _Loop()
    thread.loop = loop
    tool = eng._new_context_tool(thread)
    result = asyncio.run(tool.executor({}))
    assert result == {"status": "context_window_requested"}
    assert getattr(loop, "_new_context_window_requested", False) is True


def test_clock_curr_time_shape() -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    tool = eng._clock_curr_time_tool(thread)
    result = asyncio.run(tool.executor({}))
    assert result["timezone"] == "UTC"
    assert result["current_time"].endswith(" UTC")
    assert len(result["current_time"]) == len("YYYY-MM-DD HH:MM:SS UTC")


def test_clock_sleep_validates() -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    thread.loop = None
    tool = eng._clock_sleep_tool(thread)
    bad = asyncio.run(tool.executor({"duration_ms": 0}))
    assert "error" in bad
    ok = asyncio.run(tool.executor({"duration_ms": 10}))
    assert ok["interrupted"] is False and ok["slept_ms"] >= 10


def test_send_message_async_empty_rejected() -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    thread.thread_id = "t1"
    thread.emit = None
    tool = eng._send_message_to_user_async_tool(thread)
    out = asyncio.run(tool.executor({"message": "   "}))
    assert "error" in out


def test_send_message_async_delivers() -> None:
    import asyncio as aio

    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    thread.thread_id = "t1"
    sent: list[dict] = []

    async def _emit(ev: dict) -> None:
        sent.append(ev)

    thread.emit = _emit
    tool = eng._send_message_to_user_async_tool(thread)
    out = aio.run(tool.executor({"message": "blocker!"}))
    assert out == {"accepted": True}
    assert sent and sent[0]["method"] == "user_message_async"
    assert sent[0]["params"]["message"] == "blocker!"


def test_request_user_input_async_validation() -> None:
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    thread.thread_id = "t1"
    thread.emit = None
    tool = eng._request_user_input_async_tool(thread)
    assert "error" in asyncio.run(tool.executor({"questions": []}))
    assert (
        "error"
        in asyncio.run(tool.executor({"questions": [{"title": ""}]}))
    )
    assert (
        "error"
        in asyncio.run(
            tool.executor({"questions": [{"title": "a"}, {"title": "a"}]})
        )
    )


def test_request_user_input_async_accepts_options() -> None:
    import asyncio as aio

    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.touch = lambda: None
    thread.thread_id = "t1"
    thread.emit = None
    tool = eng._request_user_input_async_tool(thread)
    out = aio.run(
        tool.executor(
            {"questions": [{"title": "pick", "options": ["one", "two"]}]}
        )
    )
    assert out["accepted"] is True
    assert out["questions"][0]["options"] == ["one", "two"]
