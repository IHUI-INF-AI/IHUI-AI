# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:模型面新工具引擎注册接线测试 — new_context/clock_*/send_message_to_user_async/
request_user_input_async 进入 BUILTIN_ENGINE_TOOLS 并可被 builder 构造。"""

from __future__ import annotations

import asyncio

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
    """每个登记在 `BUILTIN_ENGINE_TOOLS` 的内置名都必须**真能构造出来**。

    函数名里的 "builders dict" 是历史形态。V3 #47 第一格(枚 7582cfd25b)把那张
    "内置名 -> 绑定方法"的 14 条 dict **删掉了**:它才是 `_builtin_tool_definitions`
    真正构造定义时用的键集,而 `BUILTIN_ENGINE_TOOLS` 只是名单 —— 两张表一旦分叉
    (加名字只改一处),表现不是报错而是"某个内置名永远构造不出来"。现在构造函数由
    **命名约定** `_{name}_tool` 单向推导(见 `_builtin_tool_builder` 头注)。

    所以本用例的判据从"在那段源码里找引号包着的名字"换成**真的走构造路径** ——
    这不是放宽,恰恰相反:静态找字符串在"名字写在别的函数里/写在注释里"时会给假绿,
    而逐名构造+逐名比姓名,任何一处分叉都当场现形。三条各自有牙:
      ① 构造出的定义**姓名多重集**与名单逐字相等(少一个/多一个/名字漂了都红);
      ② 每个名字解析到的构造函数就是 `_{name}_tool`(约定即唯一真相,不得再有第二张表);
      ③ 反向对照:名单里有名而没有 `_{name}_tool` 方法 ⇒ 必须 fail-fast 并点名该名字
         —— 这一条就是"尺子不是空转"的证明,摘掉它 ① ② 都可能对着一台瞎掉的尺子报绿。
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

    # ① 真构造:与生产同一入口,不做任何静态文本比对
    definitions = eng._builtin_tool_definitions(thread)
    built = [getattr(d, "name", None) for d in definitions]
    assert built == list(engine_mod.BUILTIN_ENGINE_TOOLS), (
        "构造出的内置工具集与名单分叉(少一件/多一件/姓名漂了)"
        f"\n名单={list(engine_mod.BUILTIN_ENGINE_TOOLS)}\n实得={built}"
    )

    # ② 名字→构造函数只能由约定给,不得存在第二张登记表
    for name in engine_mod.BUILTIN_ENGINE_TOOLS:
        builder = eng._builtin_tool_builder(name)
        assert getattr(builder, "__name__", "") == f"_{name}_tool", (
            f"{name!r} 的构造函数不是约定的 _{name}_tool,实得 {builder!r}"
        )

    # ③ 反向对照:有名字、没构造函数 ⇒ fail-fast 且点名
    boom = None
    try:
        eng._builtin_tool_builder("definitely_not_a_builtin_tool")
    except RuntimeError as exc:
        boom = str(exc)
    assert boom is not None, "名单与实现分叉时不 fail-fast ⇒ 本用例判的是一张空表"
    assert "definitely_not_a_builtin_tool" in boom, f"fail-fast 没点名分叉的那个名字: {boom}"


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
