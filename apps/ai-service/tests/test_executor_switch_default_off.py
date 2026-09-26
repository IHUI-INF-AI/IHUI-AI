# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D6① 编排栈收敛开关 —— 默认 off + 反向对照(证明开关不是恒假摆设)。

测试隔离(AGENTS §5):全程零 PG(8810)/零 Redis(8811)/零 LLM/零 HTTP ——
需要触达外部的默认路径一律 monkeypatch 成 mock,fail-fast 路径在触达前就抛。
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.core import executor_switch as es
from app.core.executor_switch import (
    DEFAULT_MODE,
    EXECUTOR_ENV,
    LoopV2ConvergencePilotError,
    PILOT_ERROR_MARKER,
    SESSIONS_ENV,
    TENANTS_ENV,
    guard_loop_v2_pilot,
    parse_allowlist,
    parse_convergence_mode,
    resolve_convergence_mode,
)

_ALL_KEYS = (EXECUTOR_ENV, SESSIONS_ENV, TENANTS_ENV)


@pytest.fixture(autouse=True)
def _no_convergence_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """用例体内先于一切断言清场:三键都不在环境里(防宿主 .env/并行用例泄漏)。"""
    for key in _ALL_KEYS:
        monkeypatch.delenv(key, raising=False)


# ---------------------------------------------------------------------------
# 1) 纯函数层:默认档 = legacy(现状行为),未识别值宁回退不误切
# ---------------------------------------------------------------------------


class TestPureResolve:
    def test_missing_env_is_legacy(self) -> None:
        assert resolve_convergence_mode({}) == DEFAULT_MODE == "legacy"

    def test_parse_mode_recognizes_aliases_and_is_case_insensitive(self) -> None:
        assert parse_convergence_mode("LOOP_V2") == "loop_v2"
        assert parse_convergence_mode(" v2 ") == "loop_v2"
        assert parse_convergence_mode("agent_loop_v2") == "loop_v2"

    def test_parse_mode_rejects_unknown_values(self) -> None:
        for raw in ("", " ", None, "langgraph", "enforce", "loopv2", "true"):
            assert parse_convergence_mode(raw) == "legacy", raw

    def test_allowlist_parse_drops_blanks(self) -> None:
        assert parse_allowlist(" a, ,b,,a ") == frozenset({"a", "b"})
        assert parse_allowlist(None) == frozenset()


class TestDefaultOff:
    def test_guard_silent_by_default(self) -> None:
        assert es.get_convergence_mode() == "legacy"
        guard_loop_v2_pilot("any.surface")  # 不抛 = 默认档零侵入
        assert es.is_loop_v2_convergence_enabled() is False

    def test_legacy_explicit_also_silent(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(EXECUTOR_ENV, "legacy")
        guard_loop_v2_pilot("any.surface")


# ---------------------------------------------------------------------------
# 2) 反向对照:显式设成新执行器档 ⇒ 必须走到新分支(开关有牙,不是摆设)
# ---------------------------------------------------------------------------


class TestReverseControlOnNewBranch:
    def test_global_env_on_raises_pilot_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            guard_loop_v2_pilot("unit.surface")
        assert PILOT_ERROR_MARKER in str(ei.value)
        assert ei.value.surface == "unit.surface"
        assert ei.value.decided_mode == "loop_v2"

    def test_session_allowlist_hit_enables_without_global(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(SESSIONS_ENV, "s-1, s-2")
        # 命中会话 → loop_v2 判定(即便全局档是 legacy)
        with pytest.raises(LoopV2ConvergencePilotError):
            guard_loop_v2_pilot("unit.surface", session_id="s-1")
        # 未命中会话 → 仍 legacy
        guard_loop_v2_pilot("unit.surface", session_id="s-9")

    def test_tenant_allowlist_hit_enables(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv(TENANTS_ENV, "t-a")
        assert resolve_convergence_mode(
            {TENANTS_ENV: "t-a"}, tenant_id="t-a"
        ) == "loop_v2"
        assert resolve_convergence_mode(
            {TENANTS_ENV: "t-a"}, tenant_id="t-b"
        ) == "legacy"


# ---------------------------------------------------------------------------
# 3) 接线面:四个入口的判定真的在场(默认档行为不变 + 开档 fail-fast)
# ---------------------------------------------------------------------------


class TestWiredSurfaceAgentOrchestrator:
    def test_enabled_fail_fast_before_llm(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.services import agent_orchestrator as ao

        # 若守卫不在 LLM 之前,这步会触达真实网关;置一个必炸哨兵即可反证。
        def _boom(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("收敛档必须 fail-fast 于 LLM 之前")

        monkeypatch.setattr(ao.llm_gateway, "chat", _boom, raising=False)
        monkeypatch.setattr(ao.llm_gateway, "create", _boom, raising=False)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(ao.agent_orchestrator.invoke("coder", "hello"))
        assert ei.value.surface == "agent_orchestrator._run_agent"


class TestWiredSurfaceHub:
    def test_enabled_subagent_action_raises(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.services.orchestration_hub import PillarEvent, orchestration_hub

        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        event = PillarEvent(
            event_type="hook.emitted",
            source_pillar="hook",
            timestamp="2026-09-26T00:00:00+00:00",
            payload={},
        )
        with pytest.raises(LoopV2ConvergencePilotError) as ei:
            asyncio.run(
                orchestration_hub.decision_engine._call_pillar_action(
                    "subagent", "dispatch", {}, event
                )
            )
        assert "subagent" in ei.value.surface


class TestWiredSurfaceRouters:
    def test_orchestration_emit_disabled_default_path_unchanged(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.routers import orchestration as r_orch

        emit_spy = AsyncMock(return_value="evt-1")
        monkeypatch.setattr(r_orch.orchestration_hub, "emit", emit_spy)
        body = r_orch.EmitEventBody(event_type="hook.emitted", source_pillar="hook")
        res = asyncio.run(r_orch.emit_event(body))
        assert res["code"] == 0
        # 原写法 `res["data"] == {"event_id": "evt-1"}` 把整个 data 形状钉死了。
        # 第九轮 B2 往 data 面加性接入 outcome/degraded/non_ok_pillars(三态判据在
        # tests/test_orchestration_emit_outcome.py),本用例判的是"默认档没被开关
        # 改动 + 真的透传到了 hub.emit",所以钉既有键与调用事实即可,不钉整字典。
        assert res["data"]["event_id"] == "evt-1"
        emit_spy.assert_awaited_once()

    def test_orchestration_emit_enabled_fails_before_hub(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.routers import orchestration as r_orch

        def _boom(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("收敛档必须在触达 hub.emit 之前 fail-fast")

        monkeypatch.setattr(r_orch.orchestration_hub, "emit", _boom)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        body = r_orch.EmitEventBody(event_type="hook.emitted", source_pillar="hook")
        res = asyncio.run(r_orch.emit_event(body))
        # 既有 handler 的 except 信封:错误可见(code=500)且带稳定标记
        assert res["code"] == 500
        assert PILOT_ERROR_MARKER in res["message"]

    def test_team_round_disabled_default_path_unchanged(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.routers import team_orchestration as r_teams

        sentinel = type("R", (), {"to_dict": lambda self: {"ok": 1}})()
        run_spy = AsyncMock(return_value=sentinel)
        monkeypatch.setattr(r_teams.team_orchestrator, "run_round", run_spy)
        body = r_teams.TeamRoundBody(
            objective="o",
            tasks=[r_teams.TeamTask(name="coder", task="t")],
        )
        res = asyncio.run(r_teams.run_team_round(body))
        assert res["code"] == 0
        assert res["data"] == {"ok": 1}
        run_spy.assert_awaited_once()

    def test_team_round_enabled_fails_before_fanout(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from app.routers import team_orchestration as r_teams

        def _boom(*_a: Any, **_k: Any) -> Any:
            raise AssertionError("收敛档必须在 fan-out 之前 fail-fast")

        monkeypatch.setattr(r_teams.team_orchestrator, "run_round", _boom)
        monkeypatch.setenv(EXECUTOR_ENV, "loop_v2")
        body = r_teams.TeamRoundBody(
            objective="o",
            tasks=[r_teams.TeamTask(name="coder", task="t")],
        )
        res = asyncio.run(r_teams.run_team_round(body))
        assert res["code"] == 500
        assert PILOT_ERROR_MARKER in res["message"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
