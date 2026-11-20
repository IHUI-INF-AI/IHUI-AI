# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# Hook 运行事件进 SSE 通道测试(2026-11-20 第 26 项)
#
# 钉住三条事实:
# ① 前置钩子(含 deny 路径)运行后,逐钩子结果经 `hook.run` 事件下发,
#    前端不必再翻服务端日志才知道"哪个钩子拦了";
# ② 零钩子 ⇒ 零事件(不往时间线里塞空表噪声);
# ③ 后置钩子(产出改写)同样下发,且归属信息(tool_name/tool_call_id)在位。
#
# 测试隔离:不连 PG/Redis;捕获层只替 `HookEngine.emit`,不触真实 SSE 网关。
from __future__ import annotations

from typing import Any

import pytest

import app.services.agent_loop_v2 as alv2_mod
from app.core.hook_runtime import (
    HookKind,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
    register_lifecycle_hook,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition, ToolResult
from app.services.hook_engine import HookEngine

pytestmark = pytest.mark.anyio


@pytest.fixture(autouse=True)
def _clean_registry():  # noqa: ANN201 - 测试夹具
    clear_lifecycle_hook_registry()
    yield
    clear_lifecycle_hook_registry()


def _capture(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, dict[str, Any]]]:
    seen: list[tuple[str, dict[str, Any]]] = []

    def _fake_publish(self: HookEngine, event: str, payload: dict[str, Any]) -> None:
        seen.append((event, dict(payload)))

    # 观察事实走 publish_observation(不进 HOOK_EVENTS 白名单,不点火用户钩子)
    monkeypatch.setattr(HookEngine, "publish_observation", _fake_publish)
    return seen


async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    return {"content": "done", "tool_calls": None}


def _make_tool(name: str, executed: list[str]) -> ToolDefinition:
    async def executor(args: dict) -> dict:
        executed.append(name)
        return {"ok": True, "tool": name}

    return ToolDefinition(
        name=name,
        description="demo tool",
        parameters={"type": "object"},
        executor=executor,
    )


def _loop(rt: object | None, executed: list[str], *, approval: bool = False) -> AgentLoopV2:
    return AgentLoopV2(
        _noop_llm,
        [_make_tool("demo", executed)],
        enable_checkpoint=False,
        approval_enabled=approval,
        chain="main",
        hook_runtime=rt,  # type: ignore[arg-type]
    )


async def test_pre_tool_deny_emits_hook_run_event(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _capture(monkeypatch)
    executed: list[str] = []
    register_lifecycle_hook(
        HookKind.PRE_TOOL_USE,
        lambda payload: {"decision": "deny", "reason": "策略禁止"},
        name="sse-deny",
    )
    loop = _loop(build_registered_hook_runtime(), executed)
    tr = await loop._execute_single(ToolCall(id="c1", name="demo", args={}))

    assert tr.error_type == "hook_denied"
    assert executed == []  # deny 生效,副作用零发生
    hook_events = [p for e, p in seen if e == "hook.run"]
    assert len(hook_events) == 1  # deny 路径同样要看得见
    payload = hook_events[0]
    assert payload["tool_name"] == "demo"
    assert payload["tool_call_id"] == "c1"
    assert [h["name"] for h in payload["hooks"]] == ["sse-deny"]
    assert payload["hooks"][0]["status"] == "ok"


async def test_zero_hooks_emit_no_hook_run_event(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _capture(monkeypatch)
    executed: list[str] = []
    loop = _loop(None, executed)
    tr = await loop._execute_single(ToolCall(id="c2", name="demo", args={}))

    assert tr.error is None
    assert executed == ["demo"]
    assert [e for e, _ in seen if e == "hook.run"] == []


async def test_post_tool_hook_emits_hook_run_event(monkeypatch: pytest.MonkeyPatch) -> None:
    seen = _capture(monkeypatch)
    _stub_ok: list[str] = []

    def _rewrite(payload: dict) -> dict:
        return {"updated_output": {"rewritten": True}}

    register_lifecycle_hook(HookKind.POST_TOOL_USE, _rewrite, name="sse-rewrite")
    rt = build_registered_hook_runtime()
    loop = _loop(rt, _stub_ok)
    tr = await loop._run_post_tool_hooks(
        ToolCall(id="c3", name="demo", args={}),
        ToolResult(tool_call_id="c3", name="demo", result={"raw": 1}),
    )
    assert tr.result == {"rewritten": True}

    hook_events = [p for e, p in seen if e == "hook.run"]
    assert len(hook_events) == 1
    assert hook_events[0]["tool_call_id"] == "c3"
    assert [h["name"] for h in hook_events[0]["hooks"]] == ["sse-rewrite"]
    # 事件形状与 HookRunEvent.as_dict 同源(不是另抄一份键名)
    assert set(hook_events[0]["hooks"][0]) <= {"name", "kind", "status", "durationMs", "error"}


def test_emit_hook_run_is_fail_open(monkeypatch: pytest.MonkeyPatch) -> None:
    """钩子结果下行失败绝不许把主链路带崩(与既有 emit 同一降级语义)。"""

    def _boom(self: HookEngine, event: str, payload: dict[str, Any]) -> None:
        raise RuntimeError("sse down")

    monkeypatch.setattr(HookEngine, "publish_observation", _boom)

    async def _run() -> None:
        stream = alv2_mod.AgentEventStream()
        await stream.emit_hook_run("s", [{"name": "h", "kind": "pre_tool_use", "status": "ok"}])

    import asyncio

    asyncio.run(_run())  # 不抛即通过
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
