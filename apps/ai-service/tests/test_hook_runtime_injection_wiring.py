# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# HookRuntime 工厂注入接线测试(2026-11-01 接线批)
#
# 钉住两条事实:
# ① 接前(历史现状):AgentLoopV2 构造参数 hook_runtime 缺省 None ⇒
#    self._hook_runtime 恒 None ⇒ PRE_TOOL_USE deny 判据面虽在、拦截从不生效;
# ② 接后(本批):三处生产构造入口(agents._new_v2_loop / engine 主循环工厂 /
#    agent_plan._execute_plan)统一经 core.hook_runtime.build_registered_hook_runtime
#    注入一个**非空 runtime**;登记表(register_lifecycle_hook)里的 deny 钩子
#    经该出口确实拦下一枚工具(执行器零调用)。
# 测试隔离:不连 PG/Redis;路由模块函数经 monkeypatch 替身,不落库、不打网关。
from __future__ import annotations

import inspect
from types import SimpleNamespace
from typing import Any

import pytest

import app.routers.agent_plan as agent_plan_mod
import app.routers.agents as agents_mod
import app.routers.engine as engine_mod
import app.services.agent_loop_v2 as alv2_mod
from app.core.hook_runtime import (
    HookKind,
    HookRuntime,
    build_registered_hook_runtime,
    clear_lifecycle_hook_registry,
    lifecycle_hook_registry_size,
    register_lifecycle_hook,
)
from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolDefinition


@pytest.fixture(autouse=True)
def _clean_registry():  # noqa: ANN201 - 测试夹具
    """登记表是进程级模块态:前后各清一次,保证跑两次同结果(测试隔离铁律)。"""
    clear_lifecycle_hook_registry()
    yield
    clear_lifecycle_hook_registry()


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


async def _noop_llm(messages, tools, **kwargs):  # noqa: ANN001, ANN002, ANN003, ANN202
    return {"content": "done", "tool_calls": None}


# ---------------------------------------------------------------------------
# 1. 登记表 → runtime 形状
# ---------------------------------------------------------------------------
def test_empty_registry_builds_runtime_without_hooks() -> None:
    rt = build_registered_hook_runtime()
    assert isinstance(rt, HookRuntime)
    assert rt.hooks_for(HookKind.PRE_TOOL_USE) == []
    assert lifecycle_hook_registry_size() == 0


def test_registry_roundtrip_registers_hooks_into_runtime() -> None:
    def _h(payload: dict) -> None:
        return None

    register_lifecycle_hook(HookKind.PRE_TOOL_USE, _h, name="policy-a")
    register_lifecycle_hook(HookKind.STOP, _h)
    rt = build_registered_hook_runtime()
    assert rt.hooks_for(HookKind.PRE_TOOL_USE) == ["policy-a"]
    assert rt.hooks_for(HookKind.STOP) == ["_h"]  # name 缺省取 __name__
    # 登记表不被 build 消费掉:同一张表可再构造(每请求一个 runtime 的生产形态)
    rt2 = build_registered_hook_runtime()
    assert rt2.hooks_for(HookKind.PRE_TOOL_USE) == ["policy-a"]


# ---------------------------------------------------------------------------
# 2. 接前形态:构造缺省 hook_runtime=None ⇒ 拦截不生效(回归红线)
# ---------------------------------------------------------------------------
async def test_default_construction_hook_runtime_none_and_tool_runs() -> None:
    executed: list[str] = []
    loop = AgentLoopV2(
        _noop_llm,
        [_make_tool("demo", executed)],
        enable_checkpoint=False,
        approval_enabled=False,
        chain="main",
    )
    assert loop._hook_runtime is None
    tr = await loop._execute_single(ToolCall(id="c0", name="demo", args={}))
    assert tr.error is None
    assert executed == ["demo"]


# ---------------------------------------------------------------------------
# 3. 接后形态:登记表里的 deny 钩子经 build_registered_hook_runtime 真拦工具
# ---------------------------------------------------------------------------
async def test_registered_deny_hook_blocks_tool_via_runtime() -> None:
    executed: list[str] = []

    def _deny(payload: dict) -> dict:
        assert payload["tool_name"] == "demo"
        return {"decision": "deny", "reason": "接线批策略禁止"}

    register_lifecycle_hook(HookKind.PRE_TOOL_USE, _deny, name="wiring-deny")
    rt = build_registered_hook_runtime()
    assert "wiring-deny" in rt.hooks_for(HookKind.PRE_TOOL_USE)

    loop = AgentLoopV2(
        _noop_llm,
        [_make_tool("demo", executed)],
        enable_checkpoint=False,
        approval_enabled=False,
        chain="main",
        hook_runtime=rt,
    )
    tr = await loop._execute_single(ToolCall(id="c1", name="demo", args={}))
    assert tr.error_type == "hook_denied"
    assert tr.result == {"blocked": True, "reason": "接线批策略禁止"}
    assert executed == []  # 副作用零发生(越权断言)


# ---------------------------------------------------------------------------
# 4. 三处生产构造入口确实传入非空 runtime(动态捕获 + 静态源锁)
# ---------------------------------------------------------------------------
class _CapturingLoop:
    """AgentLoopV2 替身:只捕获构造 kwargs,不做任何 IO。"""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.kwargs = kwargs


@pytest.fixture()
def _stub_loop(monkeypatch: pytest.MonkeyPatch) -> list[_CapturingLoop]:
    made: list[_CapturingLoop] = []

    class _Stub(_CapturingLoop):
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, **kwargs)
            made.append(self)

    # agents._new_v2_loop / engine._factory 都是**函数内 import**
    # (from ..services.agent_loop_v2 import AgentLoopV2)⇒ 调用期从模块属性取,
    # patch 源模块即可命中;agent_plan 是模块顶 import,patch 它自己的命名。
    monkeypatch.setattr(alv2_mod, "AgentLoopV2", _Stub)
    monkeypatch.setattr(agent_plan_mod, "AgentLoopV2", _Stub)
    return made


async def test_new_v2_loop_injects_runtime_from_registry(
    monkeypatch: pytest.MonkeyPatch, _stub_loop: list[_CapturingLoop]
) -> None:
    async def _fake_tools(*a: Any, **kw: Any) -> list[ToolDefinition]:
        return []

    monkeypatch.setattr(agents_mod, "_build_loop_v2_tools", _fake_tools)
    monkeypatch.setattr(
        "app.core.model_context_window.resolve_with_env_priority", lambda m: 0
    )
    register_lifecycle_hook(
        HookKind.PRE_TOOL_USE, lambda payload: None, name="factory-probe"
    )

    await agents_mod._new_v2_loop(
        model=None,
        tools=None,
        max_iterations=None,
        session_id=None,
        current_user="u1",
        user_role=0,
    )
    assert len(_stub_loop) == 1
    rt = _stub_loop[0].kwargs["hook_runtime"]
    assert isinstance(rt, HookRuntime)
    assert "factory-probe" in rt.hooks_for(HookKind.PRE_TOOL_USE)


async def test_engine_factory_injects_runtime(
    monkeypatch: pytest.MonkeyPatch, _stub_loop: list[_CapturingLoop]
) -> None:
    async def _fake_tools(*a: Any, **kw: Any) -> list[ToolDefinition]:
        return []

    monkeypatch.setattr(agents_mod, "_build_loop_v2_tools", _fake_tools)
    register_lifecycle_hook(
        HookKind.PRE_TOOL_USE, lambda payload: None, name="engine-probe"
    )

    factory = engine_mod._make_loop_factory()
    await factory({"session_id": "s1", "role_id": 0, "user_id": "u1"}, [])
    assert len(_stub_loop) == 1
    rt = _stub_loop[0].kwargs["hook_runtime"]
    assert isinstance(rt, HookRuntime)
    assert "engine-probe" in rt.hooks_for(HookKind.PRE_TOOL_USE)


async def test_agent_plan_execute_plan_injects_runtime(
    monkeypatch: pytest.MonkeyPatch, _stub_loop: list[_CapturingLoop]
) -> None:
    async def _fake_run(self: Any, messages: list) -> Any:
        return SimpleNamespace(
            success=True, final_response="ok", stop_reason="completed", error=None,
            iterations=[],
        )

    _CapturingLoop.run = _fake_run  # 替身补 run,避免真循环
    monkeypatch.setattr(agent_plan_mod, "_build_readonly_tools", lambda names: [])
    monkeypatch.setattr(agent_plan_mod.plan_store, "save", lambda rec: None)
    register_lifecycle_hook(
        HookKind.PRE_TOOL_USE, lambda payload: None, name="plan-probe"
    )

    rec = SimpleNamespace(
        plan_id="p1", status="approved", result=None, updated_at="",
        plan_md="# plan", goal="g",
    )
    out = await agent_plan_mod._execute_plan(rec, frozenset())
    assert out["status"] == "done"
    assert len(_stub_loop) == 1
    rt = _stub_loop[0].kwargs["hook_runtime"]
    assert isinstance(rt, HookRuntime)
    assert "plan-probe" in rt.hooks_for(HookKind.PRE_TOOL_USE)


# ---------------------------------------------------------------------------
# 5. 静态源锁:三处构造点都经同一出口取 runtime(§0.6 单一真相源)
# ---------------------------------------------------------------------------
def test_all_three_construction_sites_use_single_outlet() -> None:
    import app.routers.agents as _a
    import app.routers.engine as _e
    import app.routers.agent_plan as _p

    for mod in (_a, _e, _p):
        src = inspect.getsource(mod)
        assert "build_registered_hook_runtime()" in src, mod.__name__
        assert "from ..core.hook_runtime import build_registered_hook_runtime" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
