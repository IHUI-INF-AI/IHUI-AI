# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-064 回归:审批等待与串行工具执行必须能被 cancel/pause 打断。

修前两处都是"裸等":
- `_request_approval` 只有 `asyncio.wait_for(ev.wait(), timeout=self._approval_timeout)`
  ⇒ 用户点取消后仍要等满 N×60s 才返回,而且期间弹窗仍可被批准并执行(取消语义被架空);
- 串行分支只有 `await self._execute_single(tc)` ⇒ 单条工具卡住时 cancel/pause
  要等它自己结束才生效,与并行分支的响应性不对称。

修法统一为复用 `_wait_interruptible`(按 0.25s 轮询标志,命中即抛 `_LoopInterrupted`),
不另造第二种取消机制。本文件正反成对:

- 反(取消):等待中置 `_cancel_requested` ⇒ 在轮询窗口级别抛 `_LoopInterrupted`,
  且**不**把它当成 `approval_timeout`(两者语义不同:一个是用户取消,一个是没人应答);
- 正(应答):事件正常置位 ⇒ 原样返回决策,包裹层不改写结果;
- 正(超时):wait_for 自身超时仍映射为 `approval_timeout`(这条不能被取消逻辑吞掉)。
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from app.services import agent_loop_v2 as alv2
from app.services.agent_loop_v2 import (
    AgentLoopV2,
    ToolCall,
    ToolDefinition,
    _LoopInterrupted,
)


def _make_loop(approval_timeout: float = 30.0) -> AgentLoopV2:
    async def mock_llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
        return {"content": "ok", "tool_calls": None}

    async def _executor(args: dict[str, Any]) -> dict[str, Any]:
        return {"ok": True}

    return AgentLoopV2(
        mock_llm,
        [
            ToolDefinition(
                name="run_command",
                description="执行命令",
                parameters={"type": "object", "properties": {}},
                executor=_executor,
            )
        ],
        max_iterations=2,
        enable_checkpoint=False,
        session_id="ais064-approval-interruptible",
        approval_timeout=approval_timeout,
    )


async def _noop_emit(*_a: Any, **_k: Any) -> None:
    return None


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    """审批等待不落盘、不发 Redis:只验中断语义。"""
    from app.services import approval_persistence

    monkeypatch.setattr(approval_persistence, "check", lambda *_a, **_k: None)
    monkeypatch.setattr(approval_persistence, "grant", lambda *_a, **_k: None)


async def test_cancel_during_approval_wait_interrupts_quickly(monkeypatch):
    """取消:审批等待在轮询窗口级别中断,不当成超时。"""
    loop = _make_loop(approval_timeout=30.0)
    loop._events.emit = _noop_emit  # type: ignore[method-assign]

    tc = ToolCall(id="call_1", name="run_command", args={"command": "sleep 600"})

    async def _cancel_soon() -> None:
        await asyncio.sleep(0.05)
        loop._cancel_requested = True

    task = asyncio.create_task(_cancel_soon())
    started = time.monotonic()
    with pytest.raises(_LoopInterrupted):
        await loop._request_approval(tc)
    elapsed = time.monotonic() - started
    await task

    # 轮询窗口 0.25s + 余量;远小于 approval_timeout=30s
    assert elapsed < 3.0, f"取消后应快速返回,实测 {elapsed:.2f}s"


async def test_approval_still_returns_decision_when_user_answers():
    """正例:用户应答 ⇒ 原样返回决策(包裹层不改写结果)。"""
    loop = _make_loop(approval_timeout=5.0)
    loop._events.emit = _noop_emit  # type: ignore[method-assign]
    tc = ToolCall(id="call_2", name="run_command", args={"command": "ls"})

    async def _approve_soon() -> None:
        # 等到等待方登记出 approval_id,再按生产同一入口结算
        deadline = time.monotonic() + 3.0
        while time.monotonic() < deadline and not alv2._approval_registry:
            await asyncio.sleep(0.02)
        for _aid, entry in list(alv2._approval_registry.items()):
            entry.decision = "approve"
            entry.event.set()

    task = asyncio.create_task(_approve_soon())
    decision = await loop._request_approval(tc)
    await task
    assert decision is None, "None = 已批准,工具可继续执行"


async def test_timeout_is_still_reported_as_approval_timeout():
    """超时(没人应答)仍是本等待自己的终态,不得被取消逻辑吞掉。"""
    loop = _make_loop(approval_timeout=0.15)
    loop._events.emit = _noop_emit  # type: ignore[method-assign]
    tc = ToolCall(id="call_3", name="run_command", args={"command": "ls"})

    decision = await loop._request_approval(tc)
    assert decision == "approval_timeout"


def test_serial_branch_is_wrapped_by_interruptible():
    """串行分支必须把 `_execute_single` 包进 `_wait_interruptible`。

    为什么用源码形状而不是跑行为:`_execute_single` 内部自身带超时/错误处理,
    会把执行期的取消信号吸收成 ToolResult(那是工具层的既定语义)。本票要钉的是
    **调度层**——串行批不再裸等单条工具,而是与并行分支/长 LLM 调用同一条中断链。
    行为面已由上面三条(审批等待的取消/应答/超时)覆盖。
    """
    import inspect

    src = inspect.getsource(alv2.AgentLoopV2)
    serial_call = "result = await self._wait_interruptible(self._execute_single(tc))"
    assert serial_call in src, "串行分支必须包 _wait_interruptible(AIS-064)"
    # 反例:串行批**主路径**(20 空格缩进那层)不得再有裸 await。
    # 12 空格那处是 checkpoint 续跑的单调用重放(语义不同,不在本票射程)。
    bare = [ln for ln in src.splitlines()
            if ln == "                    result = await self._execute_single(tc)"]
    assert bare == [], "串行批主路径不得裸 await 工具执行(AIS-064)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
