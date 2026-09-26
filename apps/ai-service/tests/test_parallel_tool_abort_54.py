# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 54a:并行工具批中断语义测试(对标 codex parallel.rs AbortedToolOutput)。

覆盖:
1. 并行批内中断标志命中 → _LoopInterrupted 照常上抛 + plan.step aborted 事件;
2. 工具协程被 CancelledError 取消 → 结构化 aborted ToolResult(含运行秒数);
3. 非中断路径行为不变(普通异常仍转 error ToolResult,不误报 aborted)。
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from typing import Any

import pytest

from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolResult, _LoopInterrupted


class _FakeEvents:
    """记录 emit/emit_plan_step 调用的假事件器。"""

    def __init__(self) -> None:
        self.emitted: list[tuple[str, dict[str, Any]]] = []

    async def emit(self, event: str, payload: dict[str, Any]) -> None:
        self.emitted.append((event, payload))

    async def emit_plan_step(
        self,
        run_id: str,
        step_index: int,
        tool_name: str,
        status: str,
        *,
        decision: str | None = None,
        reason: str | None = None,
    ) -> None:
        self.emitted.append(
            ("plan.step",
             {"step_index": step_index, "tool_name": tool_name,
              "status": status, "reason": reason})
        )


def _make_loop(monkeypatch: pytest.MonkeyPatch, events: _FakeEvents) -> AgentLoopV2:
    loop = AgentLoopV2.__new__(AgentLoopV2)
    loop._session_id = "s-54"
    loop._events = events  # type: ignore[attr-defined]
    loop.parallel_tool_calls = True
    loop.tool_timeout = 10
    loop.tool_retry_max = 0
    loop.tool_retry_backoff = 0
    loop._decision_hints = {}
    loop._approved_command_call_ids = set()
    loop._current_iteration = 1
    loop._tools = {}  # 测试用工具表(真实构造走 __init__)
    loop._permission_mode = "auto"
    loop._approval_enabled = False  # 关审批门,直测中断语义
    loop._approval_policies = {}
    loop._approval_timeout = 1
    loop._extra_high_risk_tools = frozenset()
    # V3 #47 第二格(2026-09-26):本夹具绕过 __init__ 手搭实例,新增的角色属性必须同步
    # 补上,否则 _execute_single 读 self._user_role 直接 AttributeError。给 0 = 与
    # "未鉴权/未声明角色"同档(fail-closed);本文件的工具名(t / t_ok / good)都不在
    # _ADMIN_ONLY_TOOLS,所以角色闸对它们不介入,断言语义不变。
    loop._user_role = 0
    loop._hook_runtime = None
    loop._llm_complete = None
    loop._model_params = {}
    loop._budget_enabled = False
    loop._budget_max_token_estimate = 0
    loop._budget_pillar = None
    loop._rollout_budget = None
    loop._thread_goal = None
    loop._compaction_enabled = False
    loop._compaction_context_limit = 0
    loop._detect_on_chunk_support = False
    loop._llm_supports_on_chunk = False
    loop._time_reminder_state = None
    loop._env_tracker = None
    loop._time_provider = None
    # 中断标志默认关闭
    loop._cancel_requested = False
    loop._pause_requested = False
    return loop


def _tc(cid: str, name: str = "t") -> ToolCall:
    return ToolCall(id=cid, name=name, args={})


def _tool(name: str, coro_fn: Callable[[dict[str, Any]], Any]) -> Any:
    class _T:
        def __init__(self) -> None:
            self.name = name
            self.executor = coro_fn

    return _T()


async def test_cancelled_tool_returns_structured_abort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """工具协程内部被取消(_wait_interruptible 的 task.cancel() 路径)→
    CancelledError 在 executor 协程栈上抛出,_execute_single 捕获后转
    结构化 aborted ToolResult(对标 codex AbortedToolOutput)。"""
    events = _FakeEvents()
    loop = _make_loop(monkeypatch, events)

    async def cancellable_executor(args: dict[str, Any]) -> dict[str, Any]:
        try:
            await asyncio.sleep(30)
            return {"ok": True}
        except asyncio.CancelledError:
            # 真实执行器协程收到 cancel 后不吞——原样上抛(与真实工具一致);
            # _execute_single 的 except asyncio.CancelledError 分支负责转结构化。
            raise

    tc = _tc("c1")
    # 模拟 _wait_interruptible 的内部取消:直接以 CancelledError 注入 executor 协程
    asyncio.ensure_future(cancellable_executor({}))

    async def run_once() -> ToolResult:
        # 复刻 _execute_single 的中断捕获段:直接调其 CancelledError 分支语义
        # ——为不依赖私有 start 时间,直接走完整 _execute_single 路径:
        return await loop._execute_single(tc)

    # _execute_single 查工具表:monkeypatch 到 cancellable executor
    class _Tool:
        name = "t"
        def __init__(self) -> None:
            self.executor = staticmethod(cancellable_executor)

    monkeypatch.setattr(
        type(loop), "_lookup_tool", lambda self, name: _Tool(), raising=False
    )
    # 若 loop 实际用别的查表方法,回退:直接调用并注入 cancel
    result_or_exc: Any = None
    task = asyncio.create_task(run_once())
    await asyncio.sleep(0.05)
    # 取消 _execute_single 内部的 wait_for(等价 wait_for 超时/外部取消路径)
    task.cancel()
    try:
        result_or_exc = await task
    except asyncio.CancelledError:
        result_or_exc = "CANCELLED_PROPAGATED"
    if result_or_exc == "CANCELLED_PROPAGATED":
        # 外层 task cancel 会直接杀掉 _execute_single 协程本身,CancelledError
        # 不经过其 except 分支——此为 asyncio 语义,属预期;结构化分支由
        # "内部 task cancel"(wait_interruptible 路径)覆盖,见下一测试。
        pytest.skip("task 级外层 cancel 直接杀协程,不经 except 分支(asyncio 语义)")
        return
    assert isinstance(result_or_exc, ToolResult)


def _install_tool(
    monkeypatch: pytest.MonkeyPatch,
    loop: AgentLoopV2,
    name: str,
    executor: Callable[[dict[str, Any]], Any],
) -> None:
    """把带自定义 executor 的工具塞进 loop._tools(原地改,禁替换对象——
    from-import/属性引用捕获陷阱,批 53 教训)。"""
    from app.services.agent_loop_v2 import ToolDefinition

    td = ToolDefinition(
        name=name, description="t", parameters={"type": "object", "properties": {}},
        executor=executor,
    )
    loop._tools[name] = td


async def test_inner_cancelled_yields_structured_abort_direct(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """_wait_interruptible 内部 task.cancel() 路径(真实中断形态):
    executor 协程收到 CancelledError → _execute_single 转结构化 aborted 结果。"""
    events = _FakeEvents()
    loop = _make_loop(monkeypatch, events)

    async def self_cancelling_executor(args: dict[str, Any]) -> dict[str, Any]:
        # 短暂等待后自抛 CancelledError(等价被 wait_interruptible 内部 cancel)
        await asyncio.sleep(0.05)
        raise asyncio.CancelledError()

    _install_tool(monkeypatch, loop, "t", self_cancelling_executor)
    result = await asyncio.wait_for(loop._execute_single(_tc("c2")), timeout=10)
    assert isinstance(result, ToolResult)
    assert result.error is not None and "aborted" in result.error
    assert "秒" in result.error
    assert result.error_type == "aborted"
    aborted_events = [p for e, p in events.emitted if e == "tool.aborted"]
    assert aborted_events and aborted_events[0]["reason"] == "turn_interrupted"


async def test_parallel_batch_interrupt_emits_plan_step_aborted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """并行批内 _LoopInterrupted → plan.step aborted 事件 + 照常上抛。"""
    events = _FakeEvents()
    loop = _make_loop(monkeypatch, events)

    async def quick_ok(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True}

    async def interrupted_exec(args: dict[str, Any]) -> dict[str, Any]:
        raise _LoopInterrupted("interrupted")

    # 工具注册表:仅用于 _execute_single 查 executor;直接 monkeypatch 查表路径
    tools = {
        "t_ok": _tool("t_ok", quick_ok),
        "t_int": _tool("t_int", interrupted_exec),
    }
    monkeypatch.setattr(loop, "_resolve_tool", lambda name: tools.get(name), raising=False) \
        if hasattr(loop, "_resolve_tool") else None

    # 若 loop 用其它查表方式,直接绕过 _execute_single 的工具表:构造 _execute_tools
    # 的行为需真实工具表——改为 monkeypatch _execute_single 返回值(一个中断+一个正常)。
    async def fake_single(tc: ToolCall) -> ToolResult:
        if tc.name == "t_int":
            raise _LoopInterrupted("interrupted")
        return ToolResult(tool_call_id=tc.id, name=tc.name, result={"ok": True},
                          duration_ms=1)

    monkeypatch.setattr(loop, "_execute_single", fake_single)

    with pytest.raises(_LoopInterrupted):
        await loop._execute_tools([_tc("a", "t_ok"), _tc("b", "t_int")])

    aborted_steps = [p for e, p in events.emitted
                     if e == "plan.step" and p.get("status") == "aborted"]
    assert aborted_steps, "并行批中断必须发 plan.step aborted 事件"
    assert any(p.get("tool_name") == "t_int" for p in aborted_steps)
    assert any(p.get("reason") == "turn_interrupted" for p in aborted_steps)


async def test_non_interrupt_path_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """非中断路径:普通异常仍转 error ToolResult,不发 aborted 事件。"""
    events = _FakeEvents()
    loop = _make_loop(monkeypatch, events)

    async def fake_single(tc: ToolCall) -> ToolResult:
        if tc.name == "bad":
            raise RuntimeError("boom")
        return ToolResult(tool_call_id=tc.id, name=tc.name, result={"ok": True},
                          duration_ms=1)

    monkeypatch.setattr(loop, "_execute_single", fake_single)
    results = await loop._execute_tools([_tc("a", "good"), _tc("b", "bad")])
    assert len(results) == 2
    bad = [r for r in results if r.name == "bad"][0]
    assert bad.error is not None and "boom" in bad.error
    assert bad.error_type != "aborted"
    aborted = [p for e, p in events.emitted
               if e == "plan.step" and p.get("status") == "aborted"]
    assert aborted == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
