# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 模型请求前后钩子测试(2026-11-21 第 34 项)
#
# 钉住四条事实:
# ① `.ihui/hooks.json` 的 pre_model_request / post_model_request 事件此前没有
#    HookKind ⇒ 配了永远不执行;本批接进 _llm_call_with_retry 的请求前/返回点。
# ② 请求前钩子只点火**一次**(重试不重复点火),载荷给出本轮消息数/工具数。
# ③ 请求后钩子读到的 content_length / tool_call_count 来自真实返回值。
# ④ 钩子抛错 / 零钩子时,模型调用结果逐字不变(降级不阻断)。
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


def _make_llm(calls: list[dict[str, Any]]):
    async def _llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
        calls.append({"messages": messages, "tools": tools, "kwargs": kwargs})
        if len(calls) == 1:
            return {"content": "first", "tool_calls": None}
        return {"content": "done", "tool_calls": None}

    return _llm


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


def test_model_request_events_map_to_hook_kinds() -> None:
    assert _KIND_BY_EVENT["pre_model_request"] is HookKind.PRE_MODEL_REQUEST
    assert _KIND_BY_EVENT["post_model_request"] is HookKind.POST_MODEL_REQUEST


async def test_model_request_hooks_fire_with_payload() -> None:
    pre: list[dict[str, Any]] = []
    post: list[dict[str, Any]] = []
    register_lifecycle_hook(
        HookKind.PRE_MODEL_REQUEST, lambda p: pre.append(dict(p)) or {}, name="pre-model"
    )
    register_lifecycle_hook(
        HookKind.POST_MODEL_REQUEST, lambda p: post.append(dict(p)) or {}, name="post-model"
    )
    calls: list[dict[str, Any]] = []
    loop = _loop(_make_llm(calls), build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    # 零工具调用 ⇒ 主循环只发一次模型请求:前后钩子各点火一次(不是"重试也点")。
    assert len(pre) == 1
    assert len(post) == 1
    assert pre[0]["message_count"] >= 1
    assert pre[0]["iteration"] == 1  # iteration 从 1 起数(与主循环计数同源)
    assert post[0]["content_length"] == len("first")
    assert post[0]["iteration"] == 1


async def test_model_request_hook_failure_does_not_change_result() -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("hook down")

    register_lifecycle_hook(HookKind.PRE_MODEL_REQUEST, _boom, name="pre-boom")
    register_lifecycle_hook(HookKind.POST_MODEL_REQUEST, _boom, name="post-boom")
    calls: list[dict[str, Any]] = []
    loop = _loop(_make_llm(calls), build_registered_hook_runtime())
    result = await loop.run([{"role": "user", "content": "hi"}])

    assert result.success
    assert str(result.final_response) == "first"  # 钩子抛错不改写产出


async def test_model_request_context_injection_reaches_messages() -> None:
    register_lifecycle_hook(
        HookKind.PRE_MODEL_REQUEST,
        lambda p: {"additional_context": "模型请求前提醒:优先用既有实现"},
        name="pre-context",
    )
    calls: list[dict[str, Any]] = []
    loop = _loop(_make_llm(calls), build_registered_hook_runtime())
    await loop.run([{"role": "user", "content": "hi"}])

    texts: list[str] = []
    for m in calls[0]["messages"]:
        if m.get("role") != "developer":
            continue
        content = m.get("content")
        if isinstance(content, list):
            texts.extend(c.get("text", "") for c in content if isinstance(c, dict))
    assert "模型请求前提醒:优先用既有实现" in texts
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
