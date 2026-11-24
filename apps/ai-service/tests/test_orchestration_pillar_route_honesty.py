# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""pillar 编排调用的「诚实性」对账测试(第九轮 B1 的实现票)。

被审事实:`_PILLAR_API_PATHS` 声明的 6 条 `/api/<pillar>/orchestrate` 端点在
`apps/api` 侧**一条都不存在**(全仓 `apps/api/src/**/*.ts` 里 `orchestrate` 只命中
`/hooks/auto-orchestrate`,那是另一条路由)。改前的代码把 404 折成一个
`success: False` 布尔位,聚合层只在内存统计里记一笔 `partially_failed`,
**返回值形状与对外状态都不体现**"这次联动没成功" —— 即"调用不存在的端点却
对外声称联动成功"。

本文件钉的是那一条判据,不测功能是否接通(未接通,也不由本票接通):
  A. 每条 pillar 调用的结果必须带**封闭集**状态(常量集合,不得自由字符串);
  B. 任一条非 ok ⇒ 聚合结论必须显式 `degraded=True` 并点名是哪几条;
  C. 判据**不在日志里**:把 logger 整个换掉,degraded 仍必须为真;
  D. 404 / 连接失败 / 未配置,任何一档都不得被读成成功。

强制内存模式:patch 模块级 `_REDIS_URL=""` 让 `_ensure_redis` 立即返回 None;
httpx 用假客户端替换,**不发任何真实网络请求、不派生子进程**(AGENTS.md §5 测试隔离铁律)。
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from app.services import orchestration_hub as oh_module
from app.services.orchestration_hub import (
    BASE_URL_SOURCE_FALLBACK,
    BASE_URL_SOURCE_SETTINGS,
    PILLAR_CALL_STATUSES,
    JointDecisionEngine,
    OrchestrationDecision,
    OrchestrationHub,
    PillarCallStatus,
    PillarEvent,
    is_pillar_call_ok,
    pillar_call_status_of,
)

# =============================================================================
# fixture:强制内存模式(与 tests/test_orchestration_hub.py 同口径)
# =============================================================================


@pytest.fixture(autouse=True)
def _force_memory_mode(monkeypatch: pytest.MonkeyPatch):
    """Redis 关掉、settings 默认置空(= api_service_url 未配置的现状)。"""
    monkeypatch.setattr(oh_module, "_REDIS_URL", "")
    monkeypatch.setattr(oh_module, "_settings", None)
    yield


def _make_event(event_type: str = "terminal.command_failed") -> PillarEvent:
    return PillarEvent(
        event_type=event_type,
        source_pillar="terminal",
        timestamp=datetime.now(UTC).isoformat(),
        payload={},
    )


def _decision(actions: list[dict[str, Any]]) -> OrchestrationDecision:
    """直接构造决策(不依赖 playbook 内容,避免 playbook 演进把本测试带偏)。"""
    return OrchestrationDecision(
        decision_id="d-test",
        trigger_event=_make_event(),
        playbook_id="unit",
        actions=actions,
        status="pending",
    )


def _act(pillar: str, action: str = "x") -> dict[str, Any]:
    return {"pillar": pillar, "action": action, "params": {}}


def _patch_http(responder):
    """把 httpx.AsyncClient 换成假客户端。

    responder(url) 返回 (status_code, text);返回 Exception 实例则抛出该异常
    (模拟连接失败/超时)。按 URL 分派,因此一条决策里多条 pillar 可各自不同结果。
    """

    class _FakeClient:
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

        async def __aenter__(self) -> _FakeClient:
            return self

        async def __aexit__(self, *exc: Any) -> None:
            return None

        async def post(self, url: str, json: Any = None, **kwargs: Any) -> Any:
            outcome = responder(url)
            if isinstance(outcome, Exception):
                raise outcome
            code, text = outcome
            resp = MagicMock()
            resp.status_code = code
            resp.text = text
            return resp

    return patch("httpx.AsyncClient", _FakeClient)


def _always(status_code: int, text: str = ""):
    return _patch_http(lambda url: (status_code, text))


# =============================================================================
# A. 封闭状态集本身
# =============================================================================


class TestClosedStatusSet:
    """状态词表必须是封闭集:未知取值一律归非 ok,绝不"认不出来就当成功"。"""

    def test_status_set_is_exact_and_closed(self):
        assert frozenset(
            {
                "ok",
                "http_404",
                "http_5xx",
                "http_4xx_other",
                "transport_error",
                "not_configured",
                "unreported",
            }
        ) == PILLAR_CALL_STATUSES

    def test_base_url_source_set_is_closed(self):
        # base_url 的来历同样是封闭二值:下游只能据此判"配过 / 用了兜底"
        assert frozenset({"settings", "fallback"}) == oh_module.BASE_URL_SOURCES
        assert (BASE_URL_SOURCE_SETTINGS, BASE_URL_SOURCE_FALLBACK) == ("settings", "fallback")

    def test_only_ok_status_counts_as_success(self):
        # 封闭集里除 ok 之外**每一条**都必须判非成功(含"没配路径"这一档)
        for status in PILLAR_CALL_STATUSES:
            result = {"status": status, "success": True}  # 故意把 success 位造假
            if status == PillarCallStatus.OK:
                assert is_pillar_call_ok(result) is True
            else:
                assert is_pillar_call_ok(result) is False, f"{status} 被判成成功"

    def test_unknown_status_string_is_unreported_not_ok(self):
        for bogus in ("success", "OK", "200", "", "ok "):
            assert pillar_call_status_of({"status": bogus, "success": True}) == (
                PillarCallStatus.UNREPORTED
            )

    def test_legacy_result_without_status_falls_back_to_success_bit(self):
        # 改前的结果形态没有 status 键:True→ok,False→unreported(**按非 ok 处理**)
        assert pillar_call_status_of({"success": True}) == PillarCallStatus.OK
        assert pillar_call_status_of({"success": False, "error": "x"}) == (
            PillarCallStatus.UNREPORTED
        )
        # 空结果既不是成功也不是失败记录 ⇒ 必须落非 ok,不得静默算通过
        assert pillar_call_status_of({}) == PillarCallStatus.UNREPORTED


class TestHttpStatusClassification:
    def test_2xx_and_3xx_are_ok(self):
        for code in (200, 201, 204, 399):
            assert oh_module.classify_http_status_code(code) == PillarCallStatus.OK

    def test_404_is_its_own_status(self):
        # 404 必须单列:它是"端点根本不存在"的那一种,和一般 4xx 不是一回事
        assert oh_module.classify_http_status_code(404) == PillarCallStatus.HTTP_404

    def test_5xx_single_status(self):
        for code in (500, 502, 503):
            assert oh_module.classify_http_status_code(code) == PillarCallStatus.HTTP_5XX

    def test_other_4xx(self):
        for code in (400, 403, 422):
            assert oh_module.classify_http_status_code(code) == (
                PillarCallStatus.HTTP_4XX_OTHER
            )


# =============================================================================
# B. 单条调用必须带封闭状态并随返回值上抛
# =============================================================================


class TestCallPillarActionHonesty:
    async def test_404_reports_http_404_and_not_success(self):
        engine = JointDecisionEngine()
        evt = _make_event()
        with _always(404, "Not Found"):
            result = await engine._call_pillar_action("rules", "auto_generate", {}, evt)
        assert result["status"] == PillarCallStatus.HTTP_404
        assert result["success"] is False
        assert is_pillar_call_ok(result) is False
        assert result["url"].endswith("/api/rules/orchestrate")

    async def test_200_reports_ok(self):
        engine = JointDecisionEngine()
        with _always(200, '{"ok":true}'):
            result = await engine._call_pillar_action("rules", "a", {}, _make_event())
        assert result["status"] == PillarCallStatus.OK
        assert result["success"] is True

    async def test_connection_error_reports_transport_error(self):
        engine = JointDecisionEngine()
        with _patch_http(lambda url: ConnectionError("connection refused")):
            result = await engine._call_pillar_action("hook", "emit", {}, _make_event())
        assert result["status"] == PillarCallStatus.TRANSPORT_ERROR
        assert result["success"] is False
        assert "connection refused" in result["error"]  # 错误细节保留,不吞

    async def test_unknown_pillar_is_not_configured_and_makes_no_request(self):
        engine = JointDecisionEngine()
        calls: list[str] = []
        with _patch_http(lambda url: calls.append(url) or (200, "")):
            result = await engine._call_pillar_action(
                "no_such_pillar", "a", {}, _make_event()
            )
        assert result["status"] == PillarCallStatus.NOT_CONFIGURED
        assert "未知支柱" in result["error"]
        assert calls == []  # 没有声明路径就不该发出请求

    async def test_base_url_source_is_reported_for_both_arms(self):
        engine = JointDecisionEngine()
        # 未配置 ⇒ fallback(现状:_settings 被 autouse fixture 置为 None)
        with _always(200):
            r1 = await engine._call_pillar_action("rules", "a", {}, _make_event())
        assert r1["base_url_source"] == BASE_URL_SOURCE_FALLBACK

        fake_settings = MagicMock()
        fake_settings.api_service_url = "http://api.internal:8802"
        with patch.object(oh_module, "_settings", fake_settings), _always(200):
            r2 = await engine._call_pillar_action("rules", "a", {}, _make_event())
        assert r2["base_url_source"] == BASE_URL_SOURCE_SETTINGS
        assert r2["url"].startswith("http://api.internal:8802/api/rules/orchestrate")

    async def test_every_branch_returns_a_status_in_the_closed_set(self):
        engine = JointDecisionEngine()
        results: list[dict[str, Any]] = []
        with _always(500):
            results.append(await engine._call_pillar_action("rules", "a", {}, _make_event()))
        with _patch_http(lambda url: TimeoutError("slow")):
            results.append(await engine._call_pillar_action("spec", "a", {}, _make_event()))
        with _always(403):
            results.append(await engine._call_pillar_action("context", "a", {}, _make_event()))
        results.append(
            await engine._call_pillar_action("ghost", "a", {}, _make_event())
        )
        assert len(results) == 4
        for r in results:
            assert isinstance(r.get("status"), str), f"结果没带状态: {r}"
            assert r["status"] in PILLAR_CALL_STATUSES


# =============================================================================
# C. 聚合结论:非 ok ⇒ 必须 degraded + 点名(四态各一条形状断言)
# =============================================================================


class TestAggregateConclusionShape:
    """四态全覆盖:全 ok / 单条 404 / 单条 transport_error / base_url 未配置。

    每条都断言**聚合结论的形状**(status / degraded / non_ok_pillars /
    base_url_configured),不允许只断言"没抛异常"。
    """

    async def test_state1_all_ok_completed_not_degraded(self):
        engine = JointDecisionEngine()
        with _always(200, "ok"):
            out = await engine.execute_decision(
                _decision([_act("context"), _act("rules")])
            )
        assert out["status"] == "completed"
        assert out["degraded"] is False
        assert out["non_ok_pillars"] == []
        # 全部成功但用的是兜底地址 ⇒ base_url_configured 仍须如实为 False
        assert out["base_url_configured"] is False
        assert [r["status"] for r in out["results"]] == ["ok", "ok"]

    async def test_state2_single_404_degraded_and_named(self):
        engine = JointDecisionEngine()
        def responder(url: str):
            return (404, "Not Found") if "/api/rules/" in url else (200, "ok")

        with _patch_http(responder):
            out = await engine.execute_decision(
                _decision([_act("context", "refresh_index"), _act("rules", "auto_generate")])
            )
        assert out["degraded"] is True
        assert out["status"] != "completed", "单条 404 绝不能被聚合成 completed"
        assert out["status"] == "partially_failed"
        assert out["non_ok_pillars"] == [
            {"pillar": "rules", "action": "auto_generate", "status": "http_404"}
        ]

    async def test_state3_single_transport_error_degraded_and_named(self):
        engine = JointDecisionEngine()
        def responder(url: str):
            # 注意:hook 支柱声明的路径是复数 /api/hooks/orchestrate
            if "/api/hooks/" in url:
                return ConnectionError("ECONNREFUSED")
            return (200, "ok")

        with _patch_http(responder):
            out = await engine.execute_decision(
                _decision([_act("context"), _act("hook", "emit")])
            )
        assert out["degraded"] is True
        assert out["status"] == "partially_failed"
        assert out["non_ok_pillars"] == [
            {"pillar": "hook", "action": "emit", "status": "transport_error"}
        ]

    async def test_state4_base_url_not_configured_is_surfaced(self):
        """本仓现状:api_service_url 未配置 ⇒ 打的是代码兜底的 localhost:8802。"""
        engine = JointDecisionEngine()
        base_url, source = oh_module._resolve_api_base_url()
        assert source == BASE_URL_SOURCE_FALLBACK
        assert base_url == "http://localhost:8802"

        with _always(200):
            out = await engine.execute_decision(_decision([_act("context")]))
        assert out["base_url_configured"] is False, "兜底地址必须被点名"
        assert all(r["base_url_source"] == BASE_URL_SOURCE_FALLBACK for r in out["results"])

        # 配置之后 ⇒ True
        fake_settings = MagicMock()
        fake_settings.api_service_url = "http://api.internal:8802"
        with patch.object(oh_module, "_settings", fake_settings), _always(200):
            out2 = await engine.execute_decision(_decision([_act("context")]))
        assert out2["base_url_configured"] is True

    async def test_real_world_today_all_four_pillars_404_is_failed_not_completed(self):
        """本仓今天的真实形状:6 条 pillar 端点都不存在 ⇒ 全 404。"""
        engine = JointDecisionEngine()
        with _always(404, "Not Found"):
            out = await engine.execute_decision(
                _decision([_act("context"), _act("hook"), _act("rules")])
            )
        assert out["status"] == "failed"
        assert out["degraded"] is True
        assert {i["status"] for i in out["non_ok_pillars"]} == {"http_404"}
        assert len(out["non_ok_pillars"]) == 3
        assert out["base_url_configured"] is False

    async def test_skipped_decision_is_not_marked_degraded(self):
        engine = JointDecisionEngine()
        decision = _decision([])
        out = await engine.execute_decision(decision)
        assert out["status"] == "skipped"
        assert out["degraded"] is False
        assert out["non_ok_pillars"] == []


# =============================================================================
# D. 判据不得只在日志里(变异对照的机器化版本)
# =============================================================================


class TestJudgementIsNotInTheLog:
    async def test_degraded_survives_when_logger_is_replaced(self):
        """把 logger 整个换成哑对象,degraded 仍须为真。

        这条就是"把非 ok 即 degraded 改回只记日志"的变异杀手:那种改法日志行为
        没变、判据没了,而本用例当场变红。
        """
        engine = JointDecisionEngine()
        with patch.object(oh_module, "logger", MagicMock()), _always(404):
            out = await engine.execute_decision(_decision([_act("rules")]))
        assert out["degraded"] is True
        assert out["non_ok_pillars"][0]["status"] == "http_404"

    async def test_exception_inside_call_still_produces_a_status(self):
        """_call_pillar_action 被换成抛异常 ⇒ 兜底结果也必须带封闭状态。"""
        engine = JointDecisionEngine()

        async def boom(*args: Any, **kwargs: Any):
            raise RuntimeError("unexpected")

        with patch.object(engine, "_call_pillar_action", boom):
            out = await engine.execute_decision(_decision([_act("rules")]))
        assert out["degraded"] is True
        assert out["status"] == "failed"
        assert out["results"][0]["status"] == PillarCallStatus.UNREPORTED
        assert "unexpected" in out["results"][0]["error"]

    def test_to_dict_carries_the_honesty_fields(self):
        d = _decision([_act("rules")]).to_dict()
        for key in ("degraded", "non_ok_pillars", "base_url_configured"):
            assert key in d, f"to_dict 丢了 {key} ⇒ 决策历史/Redis 记录里看不到降级"
        assert d["degraded"] is False
        assert d["non_ok_pillars"] == []
        assert d["base_url_configured"] is True


# =============================================================================
# E. 上抛到中枢状态:emit 之后状态面看得见降级次数
# =============================================================================


class TestHubSurfacesOutcome:
    async def test_status_initial_has_zero_attempts(self):
        hub = OrchestrationHub()
        status = await hub.get_status()
        assert status["orchestration_attempts"] == 0
        assert status["orchestration_degraded"] == 0
        assert status["last_orchestration"] is None
        # 既有契约键不得丢
        for key in ("running", "event_count", "decision_count", "playbook_states", "redis_mode"):
            assert key in status

    async def test_emit_records_degraded_outcome_in_status(self):
        hub = OrchestrationHub()
        with _always(404, "Not Found"):
            await hub.emit("rules.violated", "rules", {})  # playbook: hook+subagent+context
        status = await hub.get_status()
        assert status["orchestration_attempts"] == 1
        assert status["orchestration_degraded"] == 1
        last = status["last_orchestration"]
        assert last["degraded"] is True
        assert last["status"] in {"partially_failed", "failed"}
        assert last["non_ok_pillars"], "点名清单不得为空"
        assert all(i["status"] in PILLAR_CALL_STATUSES for i in last["non_ok_pillars"])

    async def test_skipped_event_does_not_count_as_attempt(self):
        hub = OrchestrationHub()
        await hub.emit("no.such.event", "rules", {})
        status = await hub.get_status()
        assert status["orchestration_attempts"] == 0

    async def test_decision_history_record_keeps_degraded(self):
        """决策历史(内存/Redis 落盘面)也必须带 degraded,否则历史页看不到。"""
        engine = JointDecisionEngine()
        with _always(404):
            await engine.execute_decision(_decision([_act("rules")]))
        assert len(engine._memory_decisions) == 1
        assert engine._memory_decisions[0]["degraded"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
