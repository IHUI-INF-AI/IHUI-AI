# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""G1 —— 收敛开关命中 loop_v2 时必须**真跑** AgentLoopV2,而不是抛占位错误。

配套审计:docs/d6-convergence-audit-2026-09-27.md 的 G1 条。

三件事各有一组用例,缺一不可:
1. **默认档一字未改** —— legacy 路径既不调适配器也不 import 适配器所在模块
   (``test_default_mode_does_not_even_import_the_adapter``);
2. **开关有牙** —— 四个接线点已全部登记为消费者,所以"源码仍只调裸守卫"这一形态
   (同一枚提交只做了一半)必须被点名;未登记 surface 更是零执行地拒绝
   (``TestEveryWiredSurfaceStillRefusesTheBareGuard``,含"适配器零调用"的副作用反证);
3. **登记过的接线点真的执行 v2** —— 不是把空调用喂给 mock,而是造一个真
   ``AgentLoopV2`` + 真 ``ToolDefinition``,断言工具执行器被调用、输出来自循环
   (``TestRegisteredSurfaceReallyRunsLoopV2``,其中 ``test_real_loop_executes_tool``
   是本票的阳性对照:摘掉适配器它就必红)。

本票(2026-09-27 续票)新增两件事,都是量出来的病灶而不是假想:
4. **零双重执行**(``TestNoDoubleExecutionAtEachSite``)—— 四个站点逐一断言:档位
   命中 loop_v2 时,该站**旧路径的那个执行入口**(``llm_gateway.complete`` /
   ``httpx.AsyncClient`` / ``orchestration_hub.emit`` / ``team_orchestrator.run_round``)
   一次都没被调用;而拿到 handoff 的站点必须立即返回原有形状。
5. **v2 交接窗口内的 L4 后置自评被关掉**(``TestMetaEvalSuppressionOnHandoff``)——
   ``AgentLoopV2.run()`` 收尾无条件下发一次 ``meta_learner.evaluate_and_record``,
   它用真实 llm_gateway 再发一趟 LLM 并经 KeyPoolSelector → ``get_shared_pool``
   触生产 PG(同一份代码两次跑出 0/3 次触碰,非确定性)。默认档(legacy)不受任何
   影响;v2 档现在由 ``take_loop_v2_handoff`` 在交接窗口内罩住它,并把"关没关上、
   吃掉了几个"挂在 handoff 上可判(``ORCHESTRATION_CONVERGENCE_META_EVAL=keep`` 可放回)。

外加两把防"清单腐烂"的对账(本仓最高频失效型 = 登记表与源码分叉):
- 登记表 ↔ 源码双向(``TestRegistryMatchesRealSource``:登记未消费=红、消费未登记=红)
- 身份只能由承载层显式入参透传(``TestPrincipalPassthrough``,§5 认证不等于授权)

测试隔离(AGENTS §5):全程零 PG(8810)/零 Redis(8811)/零 LLM/零 HTTP ——
共享连接池被换成"被调用即红"的哨兵,并断言它一次都没被触碰。
"""

from __future__ import annotations

import asyncio
import re
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
# 2) 反向对照:开关有牙 —— 只做一半(登记了却仍调裸守卫)与未登记都显式拒绝,
#    且**一行执行都没发生**
# ---------------------------------------------------------------------------


class TestEveryWiredSurfaceStillRefusesTheBareGuard:
    @pytest.mark.parametrize("surface", list(REAL_SURFACES.values()))
    def test_every_registered_surface_guard_call_is_loud(self, surface: str) -> None:
        """四个 surface 现已全部登记为消费者 ⇒ 裸守卫的报错必须点名"只做了一半"。

        断言方向与本文件的历史版本相反(那时四条都未登记,报的是"未登记"),
        但**牙齿没被卸掉**:档位命中 v2 而接线点仍走裸守卫 = 同一枚提交只做了一半,
        必须抛且把原因写进消息,绝不能静默让旧循环再跑一遍。
        """
        assert surface in es.HANDOFF_CONSUMER_SURFACES, f"{surface} 应从登记表里消失了"
        with pytest.MonkeyPatch.context() as mp:
            mp.setenv(EXECUTOR_ENV, "loop_v2")
            with pytest.raises(LoopV2ConvergencePilotError) as ei:
                guard_loop_v2_pilot(surface)
        assert PILOT_ERROR_MARKER in str(ei.value)
        assert "只做了一半" in str(ei.value), "登记的 surface 调裸守卫 ⇒ 必须点名半接线"
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
    """登记表 ↔ 源码**双向**对账(2026-09-27 续票把方向反过来,但双向性一字未减)。

    历史版本判的是"四个 surface 仍在调裸守卫 + 不许出现 take_loop_v2_handoff"。
    现在四站都已改成消费返回值,那两条断言若原样留下就是把本票的交付判成回归 ——
    所以判据反过来:**每个 surface 必须既在登记表里、又在源码里被真的消费**。
    两个方向各自判红:登记未消费(半接线,旧路径仍会跑)/ 消费未登记
    (底座会因"未登记"抛错,而源码以为已经交给 v2 了)。
    """

    @staticmethod
    def _handoff_surfaces_in(text: str) -> set[str]:
        """源码里被 ``await take_loop_v2_handoff("<surface>"…)`` 消费的 surface 集合。

        允许实参换行(``take_loop_v2_handoff(\n    "x",``)—— 真仓四站里三站就是这个形状,
        只认同行形态的判据会把自己产出的形态看成"没人消费",那是恒红门。
        """
        # ``\s`` 本身就吃换行与缩进,所以一条正则覆盖两种书写形态;
        # 拆成两条再求并集会把两个 list 用 ``|`` 相连(TypeError),反而让判据彻底失效。
        return set(re.findall(r"take_loop_v2_handoff\(\s*\"([^\"]+)\"", text))

    @staticmethod
    def _guard_surfaces_in(text: str) -> set[str]:
        return set(re.findall(r"guard_loop_v2_pilot\(\s*\"([^\"]+)\"", text))

    def test_every_real_surface_consumes_the_handoff(self) -> None:
        for rel, surface in REAL_SURFACES.items():
            text = (_SERVICE_ROOT / rel).read_text(encoding="utf-8")
            assert surface in self._handoff_surfaces_in(text), (
                f"{rel} 没有以 take_loop_v2_handoff(\"{surface}\") 消费返回值 —— "
                "登记表说它已交给收敛执行器,源码却不认(半接线 = 旧路径仍会跑)"
            )
            assert surface in es.HANDOFF_CONSUMER_SURFACES, (
                f"{rel} 已在消费 handoff 却未登记进 HANDOFF_CONSUMER_SURFACES —— "
                "底座会对它抛\"未登记\",一次也不会执行"
            )

    def test_registry_is_bidirectionally_consistent_with_sources(self) -> None:
        """登记的 surface 必须真的在源码里被消费;消费了却没登记 ⇒ 同样判红。"""
        consumers: set[str] = set()
        for rel in REAL_SURFACES:
            text = (_SERVICE_ROOT / rel).read_text(encoding="utf-8")
            consumers |= self._handoff_surfaces_in(text)
        registered = set(es.HANDOFF_CONSUMER_SURFACES)
        assert registered == consumers, (
            f"登记表与源码分叉:登记未消费={sorted(registered - consumers)} "
            f"消费未登记={sorted(consumers - registered)}"
        )

    def test_defensive_guard_call_is_still_wired_at_every_surface(self) -> None:
        """每站仍保留一次裸守卫调用 —— 它是"日后有人摘登记而不改源码"时的兜底。

        摘掉它不会让本票任何一条测试变红,但会把一个安全属性变成散文:登记表
        收缩后该站会静默走旧路径(而不是 fail-fast)。所以这一条是**结构锁**,
        不是历史残留。
        """
        for rel, surface in REAL_SURFACES.items():
            text = (_SERVICE_ROOT / rel).read_text(encoding="utf-8")
            assert surface in self._guard_surfaces_in(text), (
                f"{rel} 的兜底 guard_loop_v2_pilot(\"{surface}\") 被摘线"
            )

    # --- 判据自身的正反对照(否则"扫到 0"与"扫到全部"在账面上长得一样)-------

    def test_detector_has_teeth_on_constructed_sources(self) -> None:
        same_line = 'await take_loop_v2_handoff("a.b", agent_name=n)'
        wrapped = 'await take_loop_v2_handoff(\n                "c.d",\n                agent_name=n,\n            )'
        bare_only = 'guard_loop_v2_pilot("e.f")'
        assert self._handoff_surfaces_in(same_line) == {"a.b"}
        assert self._handoff_surfaces_in(wrapped) == {"c.d"}, "换行实参必须被认成消费"
        assert self._handoff_surfaces_in(bare_only) == set(), "裸守卫不得被当成消费"
        assert self._guard_surfaces_in(bare_only) == {"e.f"}
        # 登记未消费那一维真有牙:把源码换成"只调裸守卫"时双向对账必须报差集
        assert {"e.f"} - self._handoff_surfaces_in(bare_only) == {"e.f"}


# ---------------------------------------------------------------------------
# 5b) 零双重执行:每站点在 loop_v2 档都必须让**旧路径的执行入口**一次也不被调用
# ---------------------------------------------------------------------------


def _fake_handoff(surface: str) -> es.LoopV2Handoff:
    return es.LoopV2Handoff(
        surface=surface,
        decided_mode="loop_v2",
        engine="agent_loop_v2",
        step_result=_ok_reply()["step_result"],
        stop_reason="completed",
    )


class TestNoDoubleExecutionAtEachSite:
    def test_orchestrator_run_agent_returns_v2_and_never_calls_legacy_llm(
        self,
        monkeypatch: pytest.MonkeyPatch,
        _no_shared_db_pool: list[Any],
    ) -> None:
        """站点 1:命中 v2 ⇒ 返回 v2 的 AgentStepResult,旧循环的 complete 零调用。"""
        from app.core import llm_gateway as lgm
        from app.services.agent_orchestrator import AgentDefinition, AgentStepResult
        from app.services.agent_orchestrator import agent_orchestrator as orch

        calls: list[Any] = []

        async def _never(*_a: Any, **_k: Any) -> Any:
            calls.append("complete")
            raise AssertionError("命中 v2 后旧 _run_agent 循环不得再跑(双重执行)")

        monkeypatch.setattr(lgm.llm_gateway, "complete", _never)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        stub = _StubAdapter(reply=_ok_reply())
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: stub)

        agent = AgentDefinition(
            name="coder", description="d", system_prompt="你是一个写代码的助手",
            tools=["get_weather"], model="unit-test-model", max_iterations=3,
        )
        out = asyncio.run(
            orch._run_agent(agent, "写一个 hello", None, None)

        )
        assert isinstance(out, AgentStepResult)
        assert out.status == "completed" and out.output == "done"
        assert calls == [], "llm_gateway.complete 被调用 = 旧路径又跑了一遍"
        assert stub.calls[0]["agent_name"] == "coder"
        assert stub.calls[0]["system_prompt"] == "你是一个写代码的助手"
        assert stub.calls[0]["max_iterations"] == 3
        assert _no_shared_db_pool == []

    def test_hub_subagent_action_returns_pillar_shape_without_http(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """站点 2:playbook 声明了投影 ⇒ 走 v2 并返回本站原有形状,httpx 零调用。"""
        import httpx

        from app.services.orchestration_hub import PillarCallStatus, PillarEvent
        from app.services.orchestration_hub import orchestration_hub as hub

        def _boom_client(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("命中 v2 后不得再发 HTTP 派发(双重执行)")

        monkeypatch.setattr(httpx, "AsyncClient", _boom_client)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: _StubAdapter(reply=_ok_reply()))
        event = PillarEvent(
            event_type="spec.approved", source_pillar="spec", timestamp="t", payload={}
        )
        out = asyncio.run(
            hub.decision_engine._call_pillar_action(
                "subagent",
                "dispatch_implementation",
                {"agent_name": "coder", "system_prompt": "sp", "task": "实现它"},
                event,
            )
        )
        assert out["status"] == PillarCallStatus.OK
        assert out["success"] is True and out["response"] == "done"
        assert out["engine"] == "agent_loop_v2" and out["url"] == ""
        assert _no_shared_db_pool == []

    def test_hub_subagent_without_projection_refuses_without_http(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """生产现状(五条 playbook 都没声明投影):v2 档必须抛,且 HTTP 一行没发。"""
        import httpx

        from app.services.orchestration_hub import PillarEvent
        from app.services.orchestration_hub import orchestration_hub as hub

        def _boom_client(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("缺投影时既不该发 HTTP,也不该跑一个空循环")

        monkeypatch.setattr(httpx, "AsyncClient", _boom_client)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        event = PillarEvent(
            event_type="terminal.command_failed", source_pillar="terminal", timestamp="t", payload={}
        )
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(
                hub.decision_engine._call_pillar_action(
                    "subagent", "dispatch_diagnostic", {"priority": "normal"}, event
                )
            )
        assert PILOT_ERROR_MARKER in str(ei.value)
        assert "投影入参" in str(ei.value)
        assert _no_shared_db_pool == []

    def test_emit_event_refuses_before_touching_the_hub(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """站点 3:v2 档既不 emit 也不静默成功 —— 既有 except 把 marker 带回 500 信封。"""
        from app.routers import orchestration as orch_router

        emitted: list[Any] = []

        async def _spy_emit(**kw: Any) -> str:
            emitted.append(kw)
            return "evt-should-not-happen"

        monkeypatch.setattr(orch_router.orchestration_hub, "emit", _spy_emit)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        body = orch_router.EmitEventBody(event_type="spec.approved", source_pillar="spec")
        res = asyncio.run(orch_router.emit_event(body))
        assert res["code"] == 500
        assert PILOT_ERROR_MARKER in res["message"]
        assert emitted == [], "emit 被调用 = v2 档仍跑了旧路径"
        assert _no_shared_db_pool == []

    def test_emit_event_never_drops_a_handoff_silently(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """不可达分支的活牙:真拿到 handoff 却没形状可放 ⇒ 大声失败,绝不静默再 emit。"""
        from app.routers import orchestration as orch_router

        emitted: list[Any] = []

        async def _spy_emit(**kw: Any) -> str:
            emitted.append(kw)
            return "evt-should-not-happen"

        async def _fake_take(_surface: str, **_kw: Any) -> es.LoopV2Handoff:
            return _fake_handoff("routers/orchestration.emit_event")

        monkeypatch.setattr(orch_router.orchestration_hub, "emit", _spy_emit)
        monkeypatch.setattr(orch_router, "take_loop_v2_handoff", _fake_take)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        body = orch_router.EmitEventBody(event_type="spec.approved", source_pillar="spec")
        res = asyncio.run(orch_router.emit_event(body))
        assert res["code"] == 500
        assert "拒绝静默丢弃" in res["message"]
        assert emitted == []

    def test_team_round_refuses_before_any_fan_out(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """站点 4:v2 档在任何 fan-out 之前拒绝(team_orchestrator 零调用)。"""
        from app.routers import team_orchestration as team_router

        runs: list[Any] = []

        async def _spy_run_round(*_a: Any, **kw: Any) -> Any:
            runs.append(kw)
            raise AssertionError("命中 v2 后不得再跑旧 fan-out(双重执行)")

        monkeypatch.setattr(team_router.team_orchestrator, "run_round", _spy_run_round)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        body = team_router.TeamRoundBody(
            objective="做点事", tasks=[{"name": "coder", "task": "写代码"}]
        )
        res = asyncio.run(team_router.run_team_round(body))
        assert res["code"] == 500 and PILOT_ERROR_MARKER in res["message"]
        assert runs == []
        assert _no_shared_db_pool == []

    def test_team_round_never_drops_a_handoff_silently(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        from app.routers import team_orchestration as team_router

        runs: list[Any] = []

        async def _spy_run_round(*_a: Any, **kw: Any) -> Any:
            runs.append(kw)
            raise AssertionError("拿到 handoff 后不得再跑旧 fan-out")

        async def _fake_take(_surface: str, **_kw: Any) -> es.LoopV2Handoff:
            return _fake_handoff("routers/team_orchestration.run_team_round")

        monkeypatch.setattr(team_router.team_orchestrator, "run_round", _spy_run_round)
        monkeypatch.setattr(team_router, "take_loop_v2_handoff", _fake_take)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        body = team_router.TeamRoundBody(
            objective="做点事", tasks=[{"name": "coder", "task": "写代码"}]
        )
        res = asyncio.run(team_router.run_team_round(body))
        assert res["code"] == 500 and "拒绝静默丢弃" in res["message"]
        assert runs == []

    @pytest.mark.parametrize(
        ("site", "surface"),
        [
            ("hub", "orchestration_hub._call_pillar_action[subagent]"),
            ("emit", "routers/orchestration.emit_event"),
            ("team", "routers/team_orchestration.run_team_round"),
        ],
    )
    def test_legacy_default_still_walks_the_old_path(
        self, site: str, surface: str, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """默认档逐字不变的**正面**证据:不设 env 时该站的旧入口照旧被触达一次。

        只在 v2 侧断言"旧入口没被调用"是不够的 —— 那种尺子对"把旧路径整个删掉"
        同样报绿。正反两向各钉一次,才叫"默认档一字未改"。
        """
        assert surface in REAL_SURFACES.values()
        if site == "hub":
            import httpx

            from app.services.orchestration_hub import (
                PillarCallStatus,
                PillarEvent,
            )
            from app.services.orchestration_hub import (
                orchestration_hub as hub,
            )

            posted: list[Any] = []

            class _Resp:
                status_code = 200
                text = "ok"

            class _Client:
                def __init__(self, *_a: Any, **_k: Any) -> None:
                    pass

                async def __aenter__(self) -> _Client:
                    return self

                async def __aexit__(self, *_a: Any) -> None:
                    return None

                async def post(self, url: Any, **kw: Any) -> _Resp:
                    posted.append((url, kw))
                    return _Resp()

            monkeypatch.setattr(httpx, "AsyncClient", _Client)
            ev = PillarEvent(
                event_type="spec.approved", source_pillar="spec", timestamp="t", payload={}
            )
            out = asyncio.run(
                hub.decision_engine._call_pillar_action(
                    "subagent", "dispatch_implementation", {"from_spec": True}, ev
                )
            )
            assert out["status"] == PillarCallStatus.OK and out["success"] is True
            assert len(posted) == 1, "legacy 档必须照旧发这次 HTTP 派发"
        elif site == "emit":
            from app.routers import orchestration as orch_router

            seen: list[Any] = []

            async def _emit(**kw: Any) -> str:
                seen.append(kw)
                return "evt-1"

            monkeypatch.setattr(orch_router.orchestration_hub, "emit", _emit)
            body = orch_router.EmitEventBody(event_type="spec.approved", source_pillar="spec")
            res = asyncio.run(orch_router.emit_event(body))
            assert res["code"] == 0 and res["data"]["event_id"] == "evt-1"
            assert len(seen) == 1, "legacy 档必须照旧 emit(默认档一字未改)"
        else:
            from app.routers import team_orchestration as team_router

            seen_run: list[Any] = []

            async def _run_round(*_a: Any, **kw: Any) -> Any:
                seen_run.append(kw)

                class _R:
                    def to_dict(self) -> dict[str, Any]:
                        return {"round_id": "r-1"}

                return _R()

            monkeypatch.setattr(team_router.team_orchestrator, "run_round", _run_round)
            body = team_router.TeamRoundBody(objective="o", tasks=[{"name": "coder", "task": "t"}])
            res = asyncio.run(team_router.run_team_round(body))
            assert res["code"] == 0 and res["data"] == {"round_id": "r-1"}
            assert len(seen_run) == 1, "legacy 档必须照旧 fan-out"

    def test_legacy_default_orchestrator_still_runs_its_own_loop(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """站点 1 的正面控制:不设 env 时旧 ReAct 循环照旧跑完(一字未改)。"""
        from app.core import llm_gateway as lgm
        from app.services import agent_orchestrator as ao

        seen: list[Any] = []

        async def _complete(messages: list[dict[str, Any]], **kw: Any) -> dict[str, Any]:
            seen.append(kw.get("model"))
            return {"content": "旧路径的答案", "tool_calls": None}

        async def _add(*_a: Any, **_k: Any) -> None:
            return None

        async def _get(*_a: Any, **_k: Any) -> list[dict[str, Any]]:
            return []

        monkeypatch.setattr(lgm.llm_gateway, "complete", _complete)
        monkeypatch.setattr(ao.memory_store, "add", _add)
        monkeypatch.setattr(ao.memory_store, "get", _get)
        agent = ao.AgentDefinition(
            name="coder", description="d", system_prompt="sp", tools=[], model="m-1",
            max_iterations=2,
        )
        out = asyncio.run(ao.agent_orchestrator._run_agent(agent, "问题", None, None))
        assert out.status == "completed" and out.output == "旧路径的答案"
        assert seen == ["m-1"], "legacy 档必须照旧调 llm_gateway.complete"


# ---------------------------------------------------------------------------
# 5c) v2 交接窗口内的 L4 后置自评:默认档不受影响,v2 档被显式关掉且可判
# ---------------------------------------------------------------------------


class TestMetaEvalSuppressionOnHandoff:
    def test_wanted_is_a_three_state_pure_function(self) -> None:
        assert es.meta_eval_suppression_wanted({})[0] is True
        assert es.meta_eval_suppression_wanted({es.META_EVAL_ENV: "keep"})[0] is False
        # 未识别值按默认处理,但**原因里必须点名**它没读懂(不得静默当成 keep)
        wants, why = es.meta_eval_suppression_wanted({es.META_EVAL_ENV: "yes-please"})
        assert wants is True and "未识别" in why

    def test_suppressed_while_the_adapter_runs_and_restored_after(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """适配器体内调用自评 ⇒ 被吃掉并计数;窗口外原函数必须在位。"""
        from app.services.meta_learner import meta_learner

        seen: dict[str, Any] = {}

        async def _real_eval(**kw: Any) -> None:
            seen["kw"] = kw

        monkeypatch.setattr(meta_learner, "evaluate_and_record", _real_eval)
        original = meta_learner.evaluate_and_record

        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.meta"}))

        async def _adapter_that_self_evaluates(**_kw: Any) -> dict[str, Any]:
            # 复刻 AgentLoopV2.run() 收尾那一手:窗口内派发 ⇒ 必须被罩住
            await meta_learner.evaluate_and_record(task_result={}, task_input="x", skill_name="s")
            return _ok_reply()

        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: _adapter_that_self_evaluates)
        handoff = asyncio.run(take_loop_v2_handoff("probe.meta", **_adapter_kwargs()))
        assert handoff is not None
        assert handoff.meta_eval.active is True, "抑制出口没装上 = v2 档仍在计费"
        assert handoff.meta_eval.swallowed == 1
        assert seen == {}, "真实自评被调用了 —— 那次 LLM 计费与落库又回来了"
        assert meta_learner.evaluate_and_record is original, "窗口结束必须还原,不得波及主链"
        assert _no_shared_db_pool == []

    def test_keep_opt_out_restores_the_billing_call(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """显式 keep ⇒ 不装抑制出口(运维要放回计费调用的唯一出路,且必须留痕)。"""
        from app.services.meta_learner import meta_learner

        called: list[Any] = []

        async def _real_eval(**kw: Any) -> None:
            called.append(kw)

        monkeypatch.setattr(meta_learner, "evaluate_and_record", _real_eval)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        monkeypatch.setenv(es.META_EVAL_ENV, "keep")
        monkeypatch.setattr(es, "HANDOFF_CONSUMER_SURFACES", frozenset({"probe.meta"}))

        async def _adapter(**_kw: Any) -> dict[str, Any]:
            await meta_learner.evaluate_and_record(task_result={}, task_input="x", skill_name="s")
            return _ok_reply()

        monkeypatch.setattr(es, "_resolve_loop_v2_adapter", lambda: _adapter)
        handoff = asyncio.run(take_loop_v2_handoff("probe.meta", **_adapter_kwargs()))
        assert handoff is not None
        assert handoff.meta_eval.active is False
        assert len(called) == 1, "设了 keep 却仍被抑制 = 开关是假的"

    def test_default_mode_never_touches_the_meta_gate(
        self, monkeypatch: pytest.MonkeyPatch, _no_shared_db_pool: list[Any]
    ) -> None:
        """legacy 档一行都不该装这道闸门 —— 默认档不受影响必须是可判的事实。"""

        def _boom(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("默认档不得进入 v2 交接窗口(不得替换进程级单例)")

        monkeypatch.setattr(es, "_meta_eval_gate", _boom)
        assert asyncio.run(take_loop_v2_handoff("probe.meta", **_adapter_kwargs())) is None


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
