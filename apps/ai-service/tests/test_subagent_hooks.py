# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 子代理派发面钩子测试(2026-11-21 第 36 项)
#
# 钉住五条事实:
# ① 契约(codex_hook_config_contract.HOOK_EVENTS)一直有 subagent_start/stop,
#    HookKind 此前没有这两格 ⇒ 配了永远不执行;本批挂到 mcp_server 派发链。
# ② start 钩子的 additionalContext 真的进到子任务正文(单/并行/后台三种模式)。
# ③ stop 钩子拿到的是定型后的结果(ok / needs_help / iterations / duration_ms)。
# ④ 钩子抛错/零钩子时派发返回值逐字不变。
# ⑤ resident 前缀段不被注入污染(前缀缓存按字节命中)。
from __future__ import annotations

from typing import Any

import pytest

from app.core.command_hooks import _KIND_BY_EVENT
from app.core.hook_runtime import (
    HookKind,
    clear_lifecycle_hook_registry,
    register_lifecycle_hook,
)
from app.services import mcp_server
from app.services.agent_orchestrator import AgentStepResult

pytestmark = pytest.mark.anyio


class _FakeOrchestrator:
    def __init__(self, invoke_impl=None, parallel_impl=None):  # noqa: ANN001
        self.invoke_calls: list[dict[str, Any]] = []
        self.parallel_calls: list[dict[str, Any]] = []
        self._invoke_impl = invoke_impl
        self._parallel_impl = parallel_impl

    async def invoke(self, agent_name, user_input, session_id=None, model_override=None):  # noqa: ANN001, ANN202
        self.invoke_calls.append(
            {"agent_name": agent_name, "user_input": user_input, "session_id": session_id}
        )
        if self._invoke_impl is not None:
            return self._invoke_impl(agent_name, user_input, session_id)
        return AgentStepResult(
            agent_name=agent_name,
            input=user_input,
            output=f"ok-{agent_name}",
            status="completed",
            duration_ms=1.0,
        )

    async def invoke_parallel(self, tasks, max_concurrency=5, **kwargs):  # noqa: ANN001, ANN202
        self.parallel_calls.append({"tasks": tasks, "max_concurrency": max_concurrency})
        if self._parallel_impl is not None:
            return self._parallel_impl(tasks, max_concurrency)
        results = [
            {
                "name": t["name"],
                "task": t["task"],
                "status": "completed",
                "output": f"done-{t['name']}",
                "error": None,
                "duration_ms": 1.0,
            }
            for t in tasks
        ]
        return {
            "ok": True,
            "total": len(results),
            "succeeded": len(results),
            "failed": 0,
            "results": results,
        }


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch):  # noqa: ANN201
    clear_lifecycle_hook_registry()
    monkeypatch.setattr(mcp_server, "_SUBAGENT_HOOK_RUNTIME", None)
    yield
    clear_lifecycle_hook_registry()
    monkeypatch.setattr(mcp_server, "_SUBAGENT_HOOK_RUNTIME", None)


def _wire(monkeypatch: pytest.MonkeyPatch, fake: _FakeOrchestrator) -> None:
    monkeypatch.setattr(mcp_server, "_get_orchestrator", lambda: fake)


def test_subagent_events_map_to_hook_kinds() -> None:
    assert _KIND_BY_EVENT["subagent_start"] is HookKind.SUBAGENT_START
    assert _KIND_BY_EVENT["subagent_stop"] is HookKind.SUBAGENT_STOP


async def test_single_dispatch_injects_context_and_fires_stop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    starts: list[dict[str, Any]] = []
    stops: list[dict[str, Any]] = []
    register_lifecycle_hook(
        HookKind.SUBAGENT_START,
        lambda p: starts.append(dict(p)) or {"additional_context": "策略:只改后端,不动前端"},
        name="sg-start",
    )
    register_lifecycle_hook(
        HookKind.SUBAGENT_STOP, lambda p: stops.append(dict(p)) or {}, name="sg-stop"
    )
    fake = _FakeOrchestrator()
    _wire(monkeypatch, fake)

    out = await mcp_server._tool_dispatch_subagent({"name": "backend", "task": "修 bug"})

    assert out["ok"] is True
    assert len(starts) == 1 and starts[0]["agent_name"] == "backend"
    assert len(stops) == 1 and stops[0]["ok"] is True
    # 注入真的进了子任务正文
    assert "策略:只改后端,不动前端" in fake.invoke_calls[0]["user_input"]


async def test_parallel_dispatch_fires_per_task_hooks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    starts: list[dict[str, Any]] = []
    stops: list[dict[str, Any]] = []
    register_lifecycle_hook(
        HookKind.SUBAGENT_START,
        lambda p: starts.append(dict(p)) or {"additional_context": "并行约束:不共享写"},
        name="sg-start-p",
    )
    register_lifecycle_hook(
        HookKind.SUBAGENT_STOP, lambda p: stops.append(dict(p)) or {}, name="sg-stop-p"
    )
    fake = _FakeOrchestrator()
    _wire(monkeypatch, fake)

    out = await mcp_server._tool_dispatch_subagent(
        {"tasks": [{"name": "a", "task": "t1"}, {"name": "b", "task": "t2"}]}
    )

    assert out["ok"] is True
    assert [s["agent_name"] for s in starts] == ["a", "b"]
    assert [s["agent_name"] for s in stops] == ["a", "b"]
    assert all("并行约束:不共享写" in t["task"] for t in fake.parallel_calls[0]["tasks"])


async def test_hook_failure_does_not_change_dispatch_result(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _boom(payload: dict) -> dict:
        raise RuntimeError("hook down")

    register_lifecycle_hook(HookKind.SUBAGENT_START, _boom, name="sg-boom")
    register_lifecycle_hook(HookKind.SUBAGENT_STOP, _boom, name="sg-boom2")
    fake = _FakeOrchestrator()
    _wire(monkeypatch, fake)

    out = await mcp_server._tool_dispatch_subagent({"name": "backend", "task": "修 bug"})

    assert out["ok"] is True
    assert fake.invoke_calls[0]["user_input"] == "修 bug"  # 失败钩子不注入空串前缀


async def test_zero_hooks_leave_task_verbatim(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeOrchestrator()
    _wire(monkeypatch, fake)

    await mcp_server._tool_dispatch_subagent({"name": "backend", "task": "修 bug"})

    assert fake.invoke_calls[0]["user_input"] == "修 bug"


async def test_subagent_hook_run_is_visible_on_sse(monkeypatch: pytest.MonkeyPatch) -> None:
    """子代理钩子也必须走同一条 hook.run 观察通道(第 37 项)。

    此前 12 个挂载点都能在面板看见,唯独子代理派发面的钩子失败/超时无影无踪。
    """
    from app.services.hook_engine import hook_engine

    seen: list[tuple[str, dict[str, Any]]] = []

    def _fake_publish(event: str, payload: dict[str, Any]) -> None:
        seen.append((event, dict(payload)))

    monkeypatch.setattr(hook_engine, "publish_observation", _fake_publish)
    register_lifecycle_hook(
        HookKind.SUBAGENT_START, lambda p: {"additional_context": "x"}, name="sg-visible"
    )
    fake = _FakeOrchestrator()
    _wire(monkeypatch, fake)

    await mcp_server._tool_dispatch_subagent(
        {"name": "backend", "task": "修 bug", "session_id": "s-1"}
    )

    names = [
        h["name"]
        for e, p in seen
        if e == "hook.run"
        for h in p.get("hooks", [])
    ]
    assert "sg-visible" in names
    assert all(p.get("session_id") == "s-1" for e, p in seen if e == "hook.run")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
