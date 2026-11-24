# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815970 同型补刀(2026-10-24):hook 初始化/运行纳入 _wait_interruptible 测试。

主代码(agent_loop_v2.py):
- ``run()`` 会话初始化钩子 ``session.start`` 发射由裸 await 改为
  ``await self._wait_interruptible(self._events.session_start(...))``;
- ``_execute_single`` 生命周期钩子 ``HookRuntime.run(PRE_TOOL_USE)`` 同上。

正反成对:
- 反(取消):钩子调用进行中置 ``_cancel_requested`` ⇒ 在 ≤0.25s 轮询窗口级别
  中断(内部任务被取消、不悬挂),最终按既有 cancelled 结果面收口
  (`_LoopInterrupted` 不被钩子异常降级分支吞掉);
- 正(完成):无取消 ⇒ 包裹层原样返回钩子结果,``session.start`` 照常发出、
  工具照常执行,行为与改动前的裸 await 逐项一致。

最小 fake 驱动(不真调 LLM/外部 hook 进程),隔离夹具沿用
test_compact_is_interruptible.py 的既有写法。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from app.core.config import settings
from app.core.hook_runtime import HookKind, HookRuntime
from app.services import orchestration_hub
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition
from app.services.hook_engine import hook_engine
from app.services.memory import memory_store


@pytest.fixture(autouse=True)
def _isolate_io(monkeypatch: pytest.MonkeyPatch) -> None:
    """焊死事件面 Redis 链路(与 test_compact_is_interruptible.py 同一份夹具):
    真实连接超时(每次 2-3s)会污染"≤0.25s 轮询窗口级返回"的 elapsed 判据。"""
    monkeypatch.setattr(settings, "redis_url", "")
    monkeypatch.setattr(orchestration_hub, "_REDIS_URL", "")
    monkeypatch.setattr(memory_store, "_use_redis", False, raising=False)
    monkeypatch.setattr(memory_store, "_redis", None, raising=False)


def _messages() -> list[dict[str, Any]]:
    return [
        {"role": "system", "content": "你是天气助手。"},
        {"role": "user", "content": "北京天气"},
    ]


def _make_loop(
    llm_calls: list[int],
    *,
    hook_runtime: Any | None = None,
    executed: list[str] | None = None,
) -> AgentLoopV2:
    """最小 loop:mock LLM(第 1 次带 tool_call,第 2 次给最终回复)。"""
    executed = executed if executed is not None else []

    async def mock_llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
        llm_calls.append(len(messages))
        if len(llm_calls) == 1:
            return {
                "content": "我来查一下天气",
                "tool_calls": [
                    {"id": "c1", "name": "get_weather", "args": {"city": "北京"}}
                ],
            }
        return {"content": "北京今天晴,25度", "tool_calls": None}

    async def executor(args: dict[str, Any]) -> dict[str, Any]:
        executed.append("get_weather")
        return {"city": args["city"], "temp": 25}

    return AgentLoopV2(
        mock_llm,
        [ToolDefinition(name="get_weather", description="查询天气", parameters={}, executor=executor)],
        max_iterations=3,
        enable_checkpoint=False,
        session_id="g815970-hook-init",
        hook_runtime=hook_runtime,
    )


# =============================================================================
# 第一对:hook 初始化(session.start 发射)
# =============================================================================


async def test_cancel_during_session_start_hook_interrupts_within_poll_window(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """反例:session.start 钩子总线发射在飞时置取消 ⇒ 轮询窗口级中断,不进 LLM 轮。"""
    state: dict[str, Any] = {"entered": 0, "inner_cancelled": False}
    lag: dict[str, float] = {}
    llm_calls: list[int] = []
    loop = _make_loop(llm_calls)

    async def fake_emit(event: str, payload: dict[str, Any], owner_id: Any = None) -> None:
        if event != "session.start":
            return
        state["entered"] += 1
        # 真实形态:会话初始化钩子(如外部脚本)在飞时用户按停止
        loop._cancel_requested = True
        t_flag = time.perf_counter()
        try:
            await asyncio.sleep(3.0)  # 远大于 0.25s 轮询窗口
        except asyncio.CancelledError:
            state["inner_cancelled"] = True
            # 只量"置标志 → 内部钩子被取消"这一段:整轮墙钟含建 loop 等与本判据
            # 无关的排队时间,-n auto 满载时会放大成假红。
            lag["seconds"] = time.perf_counter() - t_flag
            raise

    monkeypatch.setattr(hook_engine, "emit", fake_emit)

    result = await loop.run(_messages())

    assert state["entered"] == 1, "session.start 钩子须确实在飞,否则本判据退化为空断言"
    assert state["inner_cancelled"] is True, "包裹层必须取消内部钩子任务(不悬挂)"
    # 中断按既有结果面收口(不新增异常出口):_LoopInterrupted 交 _run_loop 入口
    assert result.stop_reason == "cancelled"
    assert result.success is False
    assert llm_calls == [], "取消后不得再进 LLM 轮"
    # 0.25s 轮询窗口 + 调度/清理余量;裸 await 会一直等到 3s 的 sleep 跑完
    assert lag.get("seconds", float("inf")) <= 0.6, f"取消延迟过长: {lag}"


async def test_session_start_hook_completion_passthrough(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """正例:无取消 ⇒ session.start 照常发射,包裹层零加工,整轮行为不变。"""
    emitted: list[str] = []
    llm_calls: list[int] = []

    async def fake_emit(event: str, payload: dict[str, Any], owner_id: Any = None) -> None:
        if event == "session.start":
            emitted.append(str(payload.get("session_id") or ""))
            await asyncio.sleep(0)

    monkeypatch.setattr(hook_engine, "emit", fake_emit)
    loop = _make_loop(llm_calls)

    result = await loop.run(_messages())

    assert emitted == ["g815970-hook-init"]
    assert result.success is True
    assert result.final_response == "北京今天晴,25度"
    assert result.stop_reason == "completed"
    assert len(llm_calls) == 2


# =============================================================================
# 第二对:生命周期钩子运行(PRE_TOOL_USE)
# =============================================================================


async def test_cancel_during_pre_tool_hook_interrupts_within_poll_window() -> None:
    """反例:PRE_TOOL_USE 钩子运行在飞时置取消 ⇒ 中断直通,工具不执行。"""
    state: dict[str, Any] = {"entered": False, "inner_cancelled": False}
    lag: dict[str, float] = {}
    executed: list[str] = []
    llm_calls: list[int] = []
    rt = HookRuntime()
    box: dict[str, AgentLoopV2] = {}

    async def slow_hook(payload: dict[str, Any]) -> None:
        state["entered"] = True
        box["loop"]._cancel_requested = True
        t_flag = time.perf_counter()
        try:
            await asyncio.sleep(3.0)
        except asyncio.CancelledError:
            state["inner_cancelled"] = True
            # 只量"置标志 → 内部钩子被取消"这一段:整轮墙钟含建 loop/首次 LLM
            # 等与本判据无关的排队时间,-n auto 满载时会把它们放大成假红。
            lag["seconds"] = time.perf_counter() - t_flag
            raise

    rt.register(HookKind.PRE_TOOL_USE, slow_hook, name="slow", timeout=10.0)
    loop = _make_loop(llm_calls, hook_runtime=rt, executed=executed)
    box["loop"] = loop

    result = await loop.run(_messages())

    assert state["entered"] is True, "PRE_TOOL_USE 钩子须确实在飞"
    assert state["inner_cancelled"] is True, "包裹层必须取消内部钩子任务(不悬挂)"
    assert executed == [], "钩子中断 ⇒ 工具不得执行"
    assert result.stop_reason == "cancelled"
    assert result.success is False
    assert len(llm_calls) == 1, "取消发生在工具执行前,不得再发第二次 LLM"
    # 0.25s 轮询窗口 + 调度/清理余量;裸 await 会一直等到 3s 的 sleep 跑完
    assert lag.get("seconds", float("inf")) <= 0.6, f"取消延迟过长: {lag}"


async def test_pre_tool_hook_completion_passthrough() -> None:
    """正例:钩子正常返回 ⇒ 包裹层原样返回结果,工具照常执行、整轮不变。"""
    seen: list[str] = []
    executed: list[str] = []
    llm_calls: list[int] = []
    rt = HookRuntime()

    async def ok_hook(payload: dict[str, Any]) -> None:
        seen.append(str(payload.get("tool_name") or ""))

    rt.register(HookKind.PRE_TOOL_USE, ok_hook, name="ok", timeout=10.0)
    loop = _make_loop(llm_calls, hook_runtime=rt, executed=executed)

    result = await loop.run(_messages())

    assert seen == ["get_weather"]
    assert executed == ["get_weather"]
    assert result.success is True
    assert result.final_response == "北京今天晴,25度"
    assert len(llm_calls) == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
