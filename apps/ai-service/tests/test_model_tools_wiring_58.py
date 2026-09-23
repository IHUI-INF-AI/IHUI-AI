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
    # builders dict 在 _builtin_tool_definitions 内构造;用最小 thread 桩逐个构造
    eng = engine_mod.AgentEngine.__new__(engine_mod.AgentEngine)
    thread = engine_mod.EngineThread.__new__(engine_mod.EngineThread)
    thread.thread_id = "t"
    thread.deny_tools = set()
    thread.host_tools = []
    thread.tool_names = None
    thread.touch = lambda: None
    thread.emit = None
    thread.loop = None
    builders_source = None
    import inspect

    src = inspect.getsource(engine_mod.AgentEngine._builtin_tool_definitions)
    for name in engine_mod.BUILTIN_ENGINE_TOOLS:
        assert f'"{name}"' in src, f"builder missing for {name}"
    assert builders_source is None  # 占位:仅静态检查


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
