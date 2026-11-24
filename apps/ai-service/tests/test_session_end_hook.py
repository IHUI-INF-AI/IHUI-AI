# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 会话收尾钩子测试(2026-11-21 第 33 项)
#
# 钉住四条事实:
# ① 契约(codex_hook_config_contract.HOOK_EVENTS)与 .ihui/hooks.json 一直有
#    session_end,HookKind 此前没有这一格 ⇒ 配了永远不执行;本批补齐挂载点。
# ② 钩子拿到的载荷与随后下发的 session.end 同源(success/stop_reason/iterations/
#    duration_ms),不是另算一套读数。
# ③ 收尾钩子是观察面:不许把已结束的会话复活,result 一字不改。
# ④ 钩子抛错 / 零钩子时返回值零变化(降级不阻断)。
from __future__ import annotations

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


async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    return {"content": "done", "tool_calls": None}


def _loop(rt: object | None) -> AgentLoopV2:
    async def _executor(args: dict) -> dict:
        return {"ok": True}

    return AgentLoopV2(
        _noop_llm,
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


def test_command_hook_event_maps_to_hook_kind() -> None:
    """`.ihui/hooks.json` 写 session_end 必须映射到一个真存在的 HookKind。

    这条钉的是"契约在、执行链不在"的回归口:表里少一格,配置就会被
    `install_command_hooks` 以"无挂载点"警告静默跳过。
    """
    assert _KIND_BY_EVENT["session_end"] is HookKind.SESSION_END


async def test_session_end_receives_outcome_payload() -> None:
    seen: list[dict[str, Any]] = []

    def _hook(payload: dict) -> dict:
        seen.append(dict(payload))
        return {}

    register_lifecycle_hook(HookKind.SESSION_END, _hook, name="exit-session")
    loop = _loop(build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    assert len(seen) == 1
    payload = seen[0]
    assert payload["success"] is True
    assert payload["stop_reason"] == str(result.stop_reason)
    assert payload["iterations"] == len(result.iterations)
    assert payload["duration_ms"] >= 0


async def test_session_end_does_not_change_result() -> None:
    """观察面不得复活会话:即便钩子回 decision=block,返回值也不许被改写。"""

    register_lifecycle_hook(
        HookKind.SESSION_END,
        lambda payload: {"decision": "block", "reason": "再来一轮"},
        name="exit-block",
    )
    loop = _loop(build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    assert result.stop_reason is not None
    assert str(result.final_response) == "done"


async def test_session_end_failure_isolated() -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("hook down")

    register_lifecycle_hook(HookKind.SESSION_END, _boom, name="exit-boom")
    loop = _loop(build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
