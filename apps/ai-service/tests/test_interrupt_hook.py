# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 取消/中断钩子测试(2026-11-21 第 35 项)
#
# 钉住四条事实:
# ① 契约(codex_hook_config_contract.HOOK_EVENTS)一直有 interrupt,HookKind 此前
#    没有这一格 ⇒ 配了永远不执行;本批挂到 AgentLoopV2.cancel。
# ② 钩子拿到的是取消现场(reason=user_cancel / iteration / has_messages)。
# ③ 钩子抛错不得让取消失败(取消是用户最高优先级操作)。
# ④ 钩子慢/超时时取消照常完成(硬上限存在,外部脚本拖不住停止按钮)。
from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from app.core.command_hooks import _KIND_BY_EVENT
from app.core.hook_runtime import (
    HookKind,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
    register_lifecycle_hook,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolDefinition

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _clean_registry():  # noqa: ANN201 - 测试夹具
    clear_lifecycle_hook_registry()
    yield
    clear_lifecycle_hook_registry()


def _loop(llm, rt: object | None) -> AgentLoopV2:
    async def _executor(args: dict) -> dict:
        return {"ok": True}

    return AgentLoopV2(
        llm,
        [
            ToolDefinition(
                name="demo",
                description="demo",
                parameters={"type": "object"},
                executor=_executor,
            )
        ],
        enable_checkpoint=False,
        approval_enabled=False,
        chain="main",
        hook_runtime=rt,  # type: ignore[arg-type]
    )


async def _slow_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    await asyncio.sleep(0.6)
    return {"content": "done", "tool_calls": None}


def test_interrupt_event_maps_to_hook_kind() -> None:
    assert _KIND_BY_EVENT["interrupt"] is HookKind.INTERRUPT


async def test_interrupt_hook_sees_cancel_context() -> None:
    seen: list[dict[str, Any]] = []
    register_lifecycle_hook(
        HookKind.INTERRUPT, lambda p: seen.append(dict(p)) or {}, name="kill"
    )
    loop = _loop(_slow_llm, build_registered_hook_runtime())
    task = asyncio.create_task(loop.run([{"role": "user", "content": "long task"}]))
    await asyncio.sleep(0.15)
    await loop.cancel()
    result = await task

    assert result.success is False or str(result.stop_reason) != ""
    assert len(seen) == 1
    assert seen[0]["reason"] == "user_cancel"
    assert seen[0]["has_messages"] is True


async def test_interrupt_hook_failure_does_not_block_cancel() -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("hook down")

    register_lifecycle_hook(HookKind.INTERRUPT, _boom, name="kill-boom")
    loop = _loop(_slow_llm, build_registered_hook_runtime())
    task = asyncio.create_task(loop.run([{"role": "user", "content": "long task"}]))
    await asyncio.sleep(0.15)
    # 不抛异常本身就是断言:取消入口不允许被钩子异常打断
    await loop.cancel()
    await task


async def test_slow_interrupt_hook_cannot_stall_cancel() -> None:
    def _slow(payload: dict) -> dict:
        time.sleep(3)
        return {}

    register_lifecycle_hook(HookKind.INTERRUPT, _slow, name="kill-slow", timeout=0.5)
    loop = _loop(_slow_llm, build_registered_hook_runtime())
    task = asyncio.create_task(loop.run([{"role": "user", "content": "long task"}]))
    await asyncio.sleep(0.15)
    started = time.monotonic()
    await loop.cancel()
    elapsed = time.monotonic() - started
    await task

    assert elapsed < 4.0  # 钩子自身 3s,但取消动作有上限,不允许被无限拖延
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
