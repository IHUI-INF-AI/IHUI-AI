# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""G1 —— 收敛开关命中 loop_v2 时必须**真跑** AgentLoopV2,而不是抛占位错误。

配套审计:docs/d6-convergence-audit-2026-09-27.md 的 G1 条。

三件事各有一组用例,缺一不可:
1. **默认档一字未改** —— legacy 路径既不调适配器也不 import 适配器所在模块
   (``test_default_mode_does_not_even_import_the_adapter``);
2. **未迁移的接线点仍然抛错** —— 四个现存 surface 都是"裸语句 + 靠抛错中断旧循环"
   的形状,守卫不抛 = 旧路径紧接着再跑一遍(双重执行),所以这一族**必须**继续抛
   (``TestUnmigratedSurfacesStillRefuse``,含"适配器零调用"的副作用反证);
3. **登记过的接线点真的执行 v2** —— 不是把空调用喂给 mock,而是造一个真
   ``AgentLoopV2`` + 真 ``ToolDefinition``,断言工具执行器被调用、输出来自循环
   (``TestRegisteredSurfaceReallyRunsLoopV2``,其中 ``test_real_loop_executes_tool``
   是本票的阳性对照:摘掉适配器它就必红)。

外加两把防"清单腐烂"的对账(本仓最高频失效型 = 登记表与源码分叉):
- 登记表 ↔ 源码双向(``TestRegistryMatchesRealSource``)
- 身份只能由承载层显式入参透传(``TestPrincipalPassthrough``,§5 认证不等于授权)

测试隔离(AGENTS §5):全程零 PG(8810)/零 Redis(8811)/零 LLM/零 HTTP ——
共享连接池被换成"被调用即红"的哨兵,并断言它一次都没被触碰。
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest

from app.core import executor_switch as es
from app.core.executor_switch import (
    EXECUTOR_ENV,
    LOOP_V2_ADAPTER_FUNC,
    LOOP_V2_ADAPTER_MODULE,
    PILOT_ERROR_MARKER,
    SESSIONS_ENV,
    TENANTS_ENV,
    LoopV2ConvergencePilotError,
    guard_loop_v2_pilot,
    take_loop_v2_handoff,
)

_ALL_KEYS = (EXECUTOR_ENV, SESSIONS_ENV, TENANTS_ENV)

#: 四个真实接线点的 surface 字面量(与各自源码里的字符串逐字同形)。
REAL_SURFACES: dict[str, str] = {
    "app/services/agent_orchestrator.py": "agent_orchestrator._run_agent",
    "app/services/orchestration_hub.py": "orchestration_hub._call_pillar_action[subagent]",
    "app/routers/orchestration.py": "routers/orchestration.emit_event",
    "app/routers/team_orchestration.py": "routers/team_orchestration.run_team_round",
}

_SERVICE_ROOT = Path(__file__).resolve().parents[1]  # apps/ai-service


@pytest.fixture(autouse=True)
def _no_convergence_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """用例体内先于一切断言清场:三键都不在环境里(防宿主 .env / 并行用例泄漏)。"""
    for key in _ALL_KEYS:
        monkeypatch.delenv(key, raising=False)


@pytest.fixture(autouse=True)
def _no_shared_db_pool(monkeypatch: pytest.MonkeyPatch) -> list[Any]:
    """§5 测试隔离铁律:共享连接池一旦被触碰即红,并记录触碰次数。"""
    touches: list[str] = []

    def _boom(*_a: Any, **_k: Any) -> None:
        touches.append("get_shared_pool")
        raise AssertionError("测试禁止对生产 PostgreSQL/Redis 产生任何副作用")

    import app.core.db_pool as db_pool

    monkeypatch.setattr(db_pool, "get_shared_pool", _boom, raising=False)
    return touches


@pytest.fixture(autouse=True)
def _no_post_run_self_eval(monkeypatch: pytest.MonkeyPatch) -> None:
    """掐掉 AgentLoopV2 的 L4 后置自评出口(§5 隔离,不是本票的行为改动)。

    实测原因(本票第一次跑就撞到的非确定性):``run()`` 在 completed/error/
    max_iterations 三种终态后**无条件** fire-and-forget
    ``meta_learner.evaluate_and_record``,而它会用**真实 llm_gateway** 再发一趟
    LLM 请求并走 KeyPoolSelector → ``get_shared_pool``(生产 PG)。这条出口是
    v2 主链(agents.py 的 execute/stream)本来就有的,**不是收敛链新增的副作用**;
    但它是否被调度取决于 asyncio.run 收尾时机 —— 同一个用例两次跑出 0 次与
    3 次触碰两种结果(实测),所以测试必须显式关掉它,而不是"看运气绿"。
    关掉之后 ``_no_shared_db_pool`` 仍是活的哨兵:任何**其它**路径碰连接池照红。
    """
    from app.services.meta_learner import meta_learner

    async def _noop(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(meta_learner, "evaluate_and_record", _noop)


def _adapter_kwargs(**overrides: Any) -> dict[str, Any]:
    """一份合法投影入参(名字/提示词都非空,否则会撞上"缺投影入参"那一档)。"""
    base: dict[str, Any] = {
        "agent_name": "coder",
        "system_prompt": "你是一个写代码的助手",
        "user_input": "写一个 hello",
        "tool_names": ["get_weather"],
        "model": "unit-test-model",
        "max_iterations": 3,
    }
    base.update(overrides)
    return base


class _StubAdapter:
    """替身适配器:记录被调用事实与收到的入参,返回可控形状。"""

    def __init__(self, reply: dict[str, Any] | None = None, exc: Exception | None = None):
        self.calls: list[dict[str, Any]] = []
        self.reply = reply
        self.exc = exc

    async def __call__(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)
        if self.exc is not None:
            raise self.exc
        assert self.reply is not None, "用例未给 reply"
        return self.reply


def _ok_reply(**diagnostics: Any) -> dict[str, Any]:
    return {
        "step_result": {
            "agent_name": "coder",
            "input": "写一个 hello",
            "output": "done",
            "status": "completed",
            "duration_ms": 12.5,
            "iterations": 2,
            "tool_calls": [{"tool": "get_weather", "arguments": {"city": "北京"}, "ok": True}],
            "error": None,
        },
        "diagnostics": {"engine": "agent_loop_v2", **diagnostics},
    }


# ---------------------------------------------------------------------------
# 1) 默认档:一个字都没变,连适配器所在模块都不该被 import
# ---------------------------------------------------------------------------


class TestDefaultModeUnchanged:
    def test_handoff_returns_none_without_touching_adapter(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        def _never(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("默认档(legacy)不得 import 收敛执行器模块")

        monkeypatch.setattr(es, "import_module", _never)
        assert (
            asyncio.run(take_loop_v2_handoff("unit.surface", **_adapter_kwargs())) is None
        )
        assert _no_shared_db_pool == []

    def test_guard_silent_by_default(self) -> None:
        guard_loop_v2_pilot("unit.surface")
        assert es.get_convergence_mode() == "legacy"

    def test_legacy_explicit_still_none(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(EXECUTOR_ENV, "legacy")
        stub = _StubAdapter()
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        assert asyncio.run(take_loop_v2_handoff("unit.surface", **_adapter_kwargs())) is None
        assert stub.calls == []


# ---------------------------------------------------------------------------
# 2) 反向对照:开关有牙 —— 未迁移的接线点仍然显式拒绝,且**一行执行都没发生**
# ---------------------------------------------------------------------------


class TestUnmigratedSurfacesStillRefuse:
    @pytest.mark.parametrize("surface", list(REAL_SURFACES.values()))
    def test_guard_raises_for_every_real_surface(self, surface: str) -> None:
        assert surface not in es.HANDOFF_CONSUMER_SURFACES
        with pytest.MonkeyPatch.context() as mp:
            mp.setenv(EXECUTOR_ENV, "loop_v2")
            with pytest.raises(LoopV2ConvergencePilotError) as ei:
                guard_loop_v2_pilot(surface)
        assert PILOT_ERROR_MARKER in str(ei.value)
        assert ei.value.surface == surface
        assert ei.value.decided_mode == "loop_v2"

    def test_take_handoff_raises_and_executes_nothing(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """越权/副作用口径:判拒绝时**必须**断言适配器零调用,不能只看它抛了什么。"""
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        stub = _StubAdapter(reply=_ok_reply())
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(take_loop_v2_handoff("unit.surface", **_adapter_kwargs()))
        assert PILOT_ERROR_MARKER in str(ei.value)
        assert stub.calls == [], "未登记 surface 不得触达执行器"
        assert _no_shared_db_pool == []

    def test_registered_surface_calling_bare_guard_is_named(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """登记表说"这处已消费 handoff"而源码还在调裸守卫 ⇒ 报错必须点名。"""
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"half.done"}))
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            guard_loop_v2_pilot("half.done")
        assert "只做了一半" in str(ei.value)

    def test_session_allowlist_hit_also_refuses_unmigrated(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(SESSIONS_ENV, "s-1")
        with pytest.raises(LoopV2ConvergencePilotError):
            asyncio.run(
                take_loop_v2_handoff("unit.surface", session_id="s-1", **_adapter_kwargs())
            )
        # 未命中会话 → 仍是 None(默认档语义未被动)
        assert (
            asyncio.run(take_loop_v2_handoff("unit.surface", session_id="s-9", **_adapter_kwargs()))
            is None
        )
        monkeypatch.setenv(TENANTS_ENV, "t-a")
        with pytest.raises(LoopV2ConvergencePilotError):
            asyncio.run(
                take_loop_v2_handoff("unit.surface", tenant_id="t-a", **_adapter_kwargs())
            )


# ---------------------------------------------------------------------------
# 3) 迁移后的接线点:命中 loop_v2 就真的走 v2 执行器
# ---------------------------------------------------------------------------


class TestRegisteredSurfaceReallyRunsLoopV2:
    def test_handoff_consumable_by_agent_step_result(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """step_result 的键集合必须让调用方能 ``AgentStepResult(**step_result)``。

        多一个键、少一个键都会在接线那一行 TypeError —— 而接线点不在本票文件清单里,
        所以这条只能在这里钉:形状不对时接线方拿到的不是"能跑",是运行时炸。
        """
        from app.services.agent_orchestrator import AgentStepResult

        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.surface"}))
        stub = _StubAdapter(reply=_ok_reply(stop_reason="completed", total_tokens_used=7))
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        handoff = asyncio.run(take_loop_v2_handoff("probe.surface", **_adapter_kwargs()))
        assert handoff is not None
        assert handoff.engine == "agent_loop_v2"
        assert handoff.stop_reason == "completed"
        assert handoff.total_tokens_used == 7
        step = AgentStepResult(**handoff.step_result)
        assert step.status == "completed" and step.output == "done"
        assert step.tool_calls == [
            {"tool": "get_weather", "arguments": {"city": "北京"}, "ok": True}
        ]

    def test_real_loop_executes_tool(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """本票的阳性对照:不 stub 适配器,真构造 AgentLoopV2 并真跑一次工具。

        摘掉 run_converged_agent(或把它内部的装配改坏)→ 本用例必红。
        """
        from app.services import agent_loop_v2 as alv2
        from app.services.agent_loop_v2 import ToolDefinition

        executed: list[dict[str, Any]] = []

        async def _tool_executor(args: dict[str, Any]) -> dict[str, Any]:
            executed.append(args)
            return {"city": args.get("city"), "weather": "晴"}

        async def _fake_build(tool_names: list[str] | None, user_role: int = 0) -> list[Any]:
            assert tool_names == ["get_weather"]
            assert user_role == 0, "缺省角色必须 fail-closed 到 0,不得被放宽"
            return [
                ToolDefinition(
                    name="get_weather",
                    description="查询天气",
                    parameters={"type": "object", "properties": {"city": {"type": "string"}}},
                    executor=_tool_executor,
                )
            ]

        state = {"turn": 0}

        async def _fake_llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
            state["turn"] += 1
            assert messages[0]["role"] == "system"
            assert messages[0]["content"] == "你是一个写代码的助手"
            if state["turn"] == 1:
                return {
                    "content": "先查天气",
                    "tool_calls": [{"id": "c1", "name": "get_weather", "args": {"city": "北京"}}],
                }
            return {"content": "北京晴,任务完成", "tool_calls": None}

        import app.routers.agents as agents_router

        monkeypatch.setattr(agents_router, "_build_loop_v2_tools", _fake_build)
        monkeypatch.setattr(agents_router, "_make_loop_v2_llm", lambda _m: _fake_llm)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.real"}))

        handoff = asyncio.run(
            take_loop_v2_handoff("probe.real", session_id="g1-probe", **_adapter_kwargs())
        )
        assert handoff is not None, "登记过的 surface 必须拿到 handoff 而不是 None"
        assert executed == [{"city": "北京"}], "工具必须被真执行一次"
        assert handoff.step_result["status"] == "completed"
        assert handoff.step_result["output"] == "北京晴,任务完成"
        assert handoff.step_result["iterations"] == 2
        assert handoff.step_result["tool_calls"] == [
            {"tool": "get_weather", "arguments": {"city": "北京"}, "ok": True}
        ]
        assert handoff.engine == "agent_loop_v2"
        assert _no_shared_db_pool == [], "收敛链不得触碰生产共享连接池"
        assert alv2.run_converged_agent is not None

    def test_progress_events_use_legacy_vocabulary(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.routers import agents as agents_router
        from app.services.agent_loop_v2 import ToolDefinition

        async def _noop_build(tool_names: list[str] | None, user_role: int = 0) -> list[Any]:
            return [
                ToolDefinition(name="get_weather", description="d", parameters={}, executor=None)
            ]

        async def _llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
            return {"content": "只有最终回复", "tool_calls": None}

        events: list[dict[str, Any]] = []
        monkeypatch.setattr(agents_router, "_build_loop_v2_tools", _noop_build)
        monkeypatch.setattr(agents_router, "_make_loop_v2_llm", lambda _m: _llm)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.progress"}))
        asyncio.run(
            take_loop_v2_handoff(
                "probe.progress",
                progress_callback=lambda e: events.append(e),
                **_adapter_kwargs(tool_names=["get_weather"]),
            )
        )
        assert events and events[-1]["phase"] == "output_ready"
        assert all("phase" in e for e in events)

    def test_empty_final_response_is_not_reported_as_completed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """循环 success 但正文为空 ⇒ 不得回 status=completed(那才是"把没做成写成做过了")。"""
        from app.routers import agents as agents_router

        async def _llm(messages: list[dict[str, Any]], tools: list[Any]) -> dict[str, Any]:
            return {"content": "", "tool_calls": None}

        async def _empty_build(tool_names: list[str] | None, user_role: int = 0) -> list[Any]:
            return []

        monkeypatch.setattr(agents_router, "_build_loop_v2_tools", _empty_build)
        monkeypatch.setattr(agents_router, "_make_loop_v2_llm", lambda _m: _llm)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.empty"}))
        handoff = asyncio.run(take_loop_v2_handoff("probe.empty", **_adapter_kwargs()))
        assert handoff is not None
        assert handoff.step_result["status"] == "failed"
        assert handoff.step_result["error"]


# ---------------------------------------------------------------------------
# 4) 出口本身坏掉时的三档显式失败(绝不"看起来跑了")
# ---------------------------------------------------------------------------


class TestAdapterFailureModes:
    def _enable(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.surface"}))

    def test_missing_projection_input_refuses_to_run(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        self._enable(monkeypatch)
        stub = _StubAdapter(reply=_ok_reply())
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(
                take_loop_v2_handoff("probe.surface", **_adapter_kwargs(system_prompt="   "))
            )
        assert "投影入参" in str(ei.value)
        assert stub.calls == []

    def test_malformed_adapter_reply_is_named(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._enable(monkeypatch)
        stub = _StubAdapter(reply={"unexpected": 1})
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(take_loop_v2_handoff("probe.surface", **_adapter_kwargs()))
        assert "step_result" in str(ei.value)

    def test_adapter_function_absent_raises_not_silently_legacy(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """适配器被摘线(函数没了)必须是显式失败,而不是回退旧路径。"""
        self._enable(monkeypatch)
        monkeypatch.setattr(es, "LOOP_V2_ADAPTER_FUNC", "no_such_adapter_xyz")
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(take_loop_v2_handoff("probe.surface", **_adapter_kwargs()))
        assert "不在位" in str(ei.value)
        assert "no_such_adapter_xyz" in str(ei.value)

    def test_adapter_landing_point_is_the_declared_one(self) -> None:
        """落点字符串与现实必须一致:改了函数名而字符串没改 = 一台永远抛"不在位"的尺子。"""
        module = __import__(LOOP_V2_ADAPTER_MODULE, fromlist=["*"])
        assert callable(getattr(module, LOOP_V2_ADAPTER_FUNC, None)), (
            f"{LOOP_V2_ADAPTER_MODULE}.{LOOP_V2_ADAPTER_FUNC} 不在位"
        )


# ---------------------------------------------------------------------------
# 5) 登记表 ↔ 源码双向对账(防清单腐烂,也防"登记了但没人消费")
# ---------------------------------------------------------------------------


class TestRegistryMatchesRealSource:
    def test_every_real_surface_still_calls_the_bare_guard(self) -> None:
        for rel, surface in REAL_SURFACES.items():
            text = (_SERVICE_ROOT / rel).read_text(encoding="utf-8")
            assert f'guard_loop_v2_pilot("{surface}"' in text, f"{rel} 的守卫调用已被摘线"
            assert "take_loop_v2_handoff" not in text, (
                f"{rel} 已开始消费 handoff —— 请把该 surface 登记进 "
                "HANDOFF_CONSUMER_SURFACES,否则本票的'零迁移'前提失效"
            )

    def test_registry_is_bidirectionally_consistent_with_sources(self) -> None:
        """登记的 surface 必须真的在源码里被消费;消费了却没登记 ⇒ 同样判红。"""
        consumers: set[str] = set()
        for rel in REAL_SURFACES:
            text = (_SERVICE_ROOT / rel).read_text(encoding="utf-8")
            for surface in REAL_SURFACES.values():
                if f'take_loop_v2_handoff(\n            "{surface}"' in text or (
                    f'take_loop_v2_handoff("{surface}"' in text
                ):
                    consumers.add(surface)
        registered = set(es.HANDOFF_CONSUMER_SURFACES)
        assert registered == consumers, (
            f"登记表与源码分叉:登记未消费={sorted(registered - consumers)} "
            f"消费未登记={sorted(consumers - registered)}"
        )


# ---------------------------------------------------------------------------
# 6) 身份只能由承载层显式入参透传(§5 认证不等于授权)
# ---------------------------------------------------------------------------


class TestPrincipalPassthrough:
    def test_user_id_and_role_are_forwarded_verbatim(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.identity"}))
        stub = _StubAdapter(reply=_ok_reply())
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        asyncio.run(
            take_loop_v2_handoff(
                "probe.identity",
                user_id="u-7",
                user_role=1,
                permission_mode="plan",
                **_adapter_kwargs(),
            )
        )
        assert len(stub.calls) == 1
        got = stub.calls[0]
        assert got["user_id"] == "u-7"
        assert got["user_role"] == 1
        assert got["permission_mode"] == "plan", "权限档不得被收敛层放宽或改写"

    def test_defaults_are_fail_closed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.identity"}))
        stub = _StubAdapter(reply=_ok_reply())
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)
        asyncio.run(take_loop_v2_handoff("probe.identity", **_adapter_kwargs()))
        assert stub.calls[0]["user_role"] == 0, "缺省角色必须是最严的 0"

    def test_adapter_does_not_lookup_principal_from_store(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """适配器不得"按 session_id 反查属主":一旦那么写,判据就退化成受害者自己。"""
        from app.services import agent_loop_v2 as alv2

        src = Path(alv2.run_converged_agent.__code__.co_filename).read_text(encoding="utf-8")
        body = src.split("async def run_converged_agent", 1)[1].split("\n\n\n", 1)[0]
        for forbidden in ("load_thread", "get_thread", "store.threads", "SELECT ", "session.get"):
            assert forbidden not in body, f"适配器出现了按记录反查身份的路径:{forbidden}"
        assert "user_role=user_role" in body and "user_id=user_id" in body


# ---------------------------------------------------------------------------
# 7) 投影纯函数:逐轮 trace → 旧形状 tool_calls
# ---------------------------------------------------------------------------


class TestToolCallProjection:
    def test_pairs_results_by_id_and_marks_failure(self) -> None:
        from app.services.agent_loop_v2 import (
            AgentLoopResult,
            LoopIteration,
            ToolCall,
            ToolResult,
            _project_loop_iterations,
        )

        ok = ToolResult(tool_call_id="c1", name="get_weather", result={"ok": True})
        bad = ToolResult(tool_call_id="c2", name="run_command", result=None, error="boom")
        loop_iter = LoopIteration(
            iteration=1, tool_calls=[ToolCall(id="c1", name="get_weather", args={"city": "x"}),
                                     ToolCall(id="c2", name="run_command", args={"cmd": "ls"})],
            tool_results=[ok, bad],
        )
        result = AgentLoopResult(
            success=True,
            final_response="x",
            iterations=[loop_iter],
            total_duration_ms=1.0,
            total_tokens_used=0,
            stop_reason="completed",
        )
        assert _project_loop_iterations(result) == [
            {"tool": "get_weather", "arguments": {"city": "x"}, "ok": True},
            {"tool": "run_command", "arguments": {"cmd": "ls"}, "ok": False},
        ]

    def test_unmatched_call_is_not_marked_ok(self) -> None:
        from app.services.agent_loop_v2 import (
            AgentLoopResult,
            LoopIteration,
            ToolCall,
            _project_loop_iterations,
        )

        loop_iter = LoopIteration(
            iteration=1,
            tool_calls=[ToolCall(id="cX", name="t", args={})],
            tool_results=[],
        )
        result = AgentLoopResult(
            success=True,
            final_response="",
            iterations=[loop_iter],
            total_duration_ms=0.0,
            total_tokens_used=0,
            stop_reason="error",
        )
        assert _project_loop_iterations(result) == [{"tool": "t", "arguments": {}, "ok": False}]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
