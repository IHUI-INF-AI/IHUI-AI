"""orchestration 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

覆盖策略:mock 掉 orchestration_hub / llm_budget_governor / telemetry_service 三个单例,
直接调用端点 async 函数测响应包装逻辑 + 错误分支;参数校验用 mini ASGI app 走真实路由。
"""

from __future__ import annotations

import types

import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import FastAPI

from app.routers import orchestration
from app.routers.orchestration import (
    BudgetConfigUpdateBody,
    CheckBudgetBody,
    EmitEventBody,
    RecordUsageBody,
    check_budget,
    emit_event,
    get_cost_breakdown,
    get_decisions,
    get_event_stats,
    get_events,
    get_hub_dashboard,
    get_hub_status,
    get_metrics,
    get_pillar_budget,
    get_playbooks,
    get_recent_traces,
    get_telemetry_dashboard,
    get_telemetry_health,
    get_trace_detail,
    get_budget_summary,
    get_budget_trend,
    record_budget_usage,
    reset_pillar_degradation,
    toggle_playbook,
    update_budget_config,
)


def _async_ret(value):
    async def _f(*a, **k):
        return value

    return _f


def _async_raise(exc):
    async def _f(*a, **k):
        raise exc

    return _f


@pytest.fixture(autouse=True)
def _mock_services(monkeypatch):
    """默认 mock 三个 service 单例(返回假数据)。"""
    hub = types.SimpleNamespace(
        get_status=_async_ret({"status": "ok"}),
        get_dashboard=_async_ret({"dashboard": 1}),
        get_event_feed=_async_ret({"events": []}),
        emit=_async_ret("evt-1"),
        event_bus=types.SimpleNamespace(get_event_stats=_async_ret({"stats": 1})),
        decision_engine=types.SimpleNamespace(
            get_playbooks=_async_ret([{"id": "p1"}]),
            enable_playbook=_async_ret(True),
            get_decision_history=_async_ret([{"id": "d1"}]),
        ),
    )
    gov = types.SimpleNamespace(
        record_usage=_async_ret(types.SimpleNamespace(pillar="rag", model="gpt")),
        check_budget=_async_ret(types.SimpleNamespace(allowed=True)),
        get_usage_summary=_async_ret({"total": 1}),
        get_usage_trend=_async_ret([{"day": "d1"}]),
        get_pillar_budget=_async_ret({"pillar": "rag"}),
        reset_degradation=_async_ret(True),
        update_config=_async_ret(types.SimpleNamespace(daily_token_limit=100)),
        get_cost_breakdown=_async_ret({"costs": []}),
    )
    tele = types.SimpleNamespace(
        get_metrics=_async_ret({"metrics": []}),
        get_pillar_health=_async_ret({"health": {}}),
        get_dashboard=_async_ret({"dash": {}}),
        get_recent_traces=_async_ret([{"trace_id": "t1"}]),
        get_trace=_async_ret({"spans": []}),
    )
    monkeypatch.setattr(orchestration, "orchestration_hub", hub)
    monkeypatch.setattr(orchestration, "llm_budget_governor", gov)
    monkeypatch.setattr(orchestration, "telemetry_service", tele)
    return hub, gov, tele


# =============================================================================
# 编排中枢端点:成功路径
# =============================================================================


async def test_get_hub_status_success(_mock_services):
    resp = await get_hub_status()
    assert resp == {"code": 0, "message": "success", "data": {"status": "ok"}}


async def test_get_hub_dashboard_success(_mock_services):
    resp = await get_hub_dashboard()
    assert resp["code"] == 0
    assert resp["data"] == {"dashboard": 1}


async def test_get_events_passes_filters(_mock_services):
    hub, _, _ = _mock_services
    seen = {}

    async def _fake_feed(**kw):
        seen.update(kw)
        return {"events": [1]}

    hub.get_event_feed = _fake_feed
    resp = await get_events(limit=10, pillar="rag", event_type="task.done")
    assert resp["code"] == 0
    assert seen == {"limit": 10, "pillar": "rag", "event_type": "task.done"}


async def test_emit_event_success(_mock_services):
    hub, _, _ = _mock_services
    seen = {}

    async def _fake_emit(**kw):
        seen.update(kw)
        return "evt-9"

    hub.emit = _fake_emit
    body = EmitEventBody(
        event_type="task.done", source_pillar="rag", payload={"n": 1}, severity="warning"
    )
    resp = await emit_event(body)
    assert resp == {"code": 0, "message": "success", "data": {"event_id": "evt-9"}}
    assert seen == {
        "event_type": "task.done",
        "source_pillar": "rag",
        "payload": {"n": 1},
        "severity": "warning",
    }


async def test_get_event_stats_passes_window(_mock_services):
    hub, _, _ = _mock_services
    seen = {}

    async def _fake_stats(**kw):
        seen.update(kw)
        return {"stats": 3}

    hub.event_bus.get_event_stats = _fake_stats
    resp = await get_event_stats(window_hours=48)
    assert resp["code"] == 0
    assert seen == {"window_hours": 48}


async def test_get_playbooks_success(_mock_services):
    resp = await get_playbooks()
    assert resp["code"] == 0
    assert resp["data"] == [{"id": "p1"}]


async def test_toggle_playbook_passes_args(_mock_services):
    hub, _, _ = _mock_services
    seen = {}

    async def _fake_enable(*a, **k):
        seen["args"] = a
        return False

    hub.decision_engine.enable_playbook = _fake_enable
    resp = await toggle_playbook("pb-1", types.SimpleNamespace(enabled=True))
    assert resp["data"] == {"success": False}
    assert seen["args"] == ("pb-1", True)


async def test_get_decisions_passes_limit(_mock_services):
    hub, _, _ = _mock_services
    seen = {}

    async def _fake_hist(**kw):
        seen.update(kw)
        return [{"id": "d2"}]

    hub.decision_engine.get_decision_history = _fake_hist
    resp = await get_decisions(limit=20)
    assert resp["code"] == 0
    assert seen == {"limit": 20}


# =============================================================================
# 编排中枢端点:错误分支(service 抛异常 → code=500)
# =============================================================================


async def test_get_hub_status_service_error(_mock_services):
    hub, _, _ = _mock_services
    hub.get_status = _async_raise(RuntimeError("hub down"))
    resp = await get_hub_status()
    assert resp == {"code": 500, "message": "hub down", "data": None}


async def test_get_events_service_error(_mock_services):
    hub, _, _ = _mock_services
    hub.get_event_feed = _async_raise(ValueError("bad filter"))
    resp = await get_events()
    assert resp["code"] == 500
    assert resp["message"] == "bad filter"
    assert resp["data"] is None


async def test_emit_event_service_error(_mock_services):
    hub, _, _ = _mock_services
    hub.emit = _async_raise(Exception("emit failed"))
    resp = await emit_event(EmitEventBody(event_type="x", source_pillar="y"))
    assert resp["code"] == 500
    assert resp["data"] is None


async def test_toggle_playbook_service_error(_mock_services):
    hub, _, _ = _mock_services
    hub.decision_engine.enable_playbook = _async_raise(Exception("boom"))
    resp = await toggle_playbook("pb", types.SimpleNamespace(enabled=True))
    assert resp["code"] == 500


# =============================================================================
# 预算治理端点
# =============================================================================


async def test_record_budget_usage_passes_args(_mock_services):
    _, gov, _ = _mock_services
    seen = {}

    async def _fake_record(**kw):
        seen.update(kw)
        return types.SimpleNamespace(pillar="rag", model="gpt", tokens=1)

    gov.record_usage = _fake_record
    body = RecordUsageBody(
        pillar="rag", model="gpt-4", input_tokens=100, output_tokens=50, action="chat", request_id="r1"
    )
    resp = await record_budget_usage(body)
    assert resp["code"] == 0
    assert resp["data"] == {"pillar": "rag", "model": "gpt", "tokens": 1}
    assert seen["pillar"] == "rag"
    assert seen["input_tokens"] == 100
    assert seen["output_tokens"] == 50
    assert seen["action"] == "chat"
    assert seen["request_id"] == "r1"


async def test_record_budget_usage_service_error(_mock_services):
    _, gov, _ = _mock_services
    gov.record_usage = _async_raise(Exception("record fail"))
    resp = await record_budget_usage(RecordUsageBody(pillar="rag", model="m"))
    assert resp["code"] == 500


async def test_check_budget_success(_mock_services):
    resp = await check_budget(CheckBudgetBody(pillar="rag", estimated_tokens=100))
    assert resp["code"] == 0
    assert resp["data"] == {"allowed": True}


async def test_check_budget_service_error(_mock_services):
    _, gov, _ = _mock_services
    gov.check_budget = _async_raise(Exception("check fail"))
    resp = await check_budget(CheckBudgetBody(pillar="rag"))
    assert resp["code"] == 500


async def test_budget_summary_trend_pillar_reset(_mock_services):
    _, gov, _ = _mock_services
    assert (await get_budget_summary(period="week"))["code"] == 0
    assert (await get_budget_trend(days=14))["code"] == 0
    assert (await get_pillar_budget(pillar="rag"))["data"] == {"pillar": "rag"}
    assert (await reset_pillar_degradation(pillar="rag"))["data"] == {"success": True}
    assert (await get_cost_breakdown(period="month"))["code"] == 0


async def test_update_budget_config_filters_none_fields(_mock_services):
    """PATCH config:None 字段必须被过滤,不传给 update_config。"""
    _, gov, _ = _mock_services
    captured = {}

    async def _fake_update(cfg):
        captured["cfg"] = cfg
        return types.SimpleNamespace(daily_token_limit=100)

    gov.update_config = _fake_update
    body = BudgetConfigUpdateBody(
        daily_token_limit=100,
        hourly_token_limit=None,  # None → 过滤
        warning_threshold=None,  # None → 过滤
        critical_threshold=0.9,
    )
    resp = await update_budget_config(body)
    assert resp["code"] == 0
    assert captured["cfg"] == {"daily_token_limit": 100, "critical_threshold": 0.9}


async def test_update_budget_config_all_none_sends_empty(_mock_services):
    _, gov, _ = _mock_services
    captured = {}

    async def _fake_update(cfg):
        captured["cfg"] = cfg
        return types.SimpleNamespace(daily_token_limit=100)

    gov.update_config = _fake_update
    resp = await update_budget_config(BudgetConfigUpdateBody())
    assert resp["code"] == 0
    assert captured["cfg"] == {}


# =============================================================================
# 遥测端点
# =============================================================================


async def test_get_metrics_json_success(_mock_services):
    resp = await get_metrics(format="json")
    assert resp == {"code": 0, "message": "success", "data": {"metrics": []}}


async def test_get_metrics_prometheus_returns_raw_text(_mock_services):
    """format=prometheus → 直接返回 Prometheus 文本(非包装结构)。"""
    _, _, tele = _mock_services
    tele.get_metrics = _async_ret("# HELP http_requests_total\n# TYPE http_requests_total counter")
    resp = await get_metrics(format="prometheus")
    assert resp == "# HELP http_requests_total\n# TYPE http_requests_total counter"


async def test_get_metrics_prometheus_service_error(_mock_services):
    _, _, tele = _mock_services
    tele.get_metrics = _async_raise(Exception("metrics fail"))
    resp = await get_metrics(format="prometheus")
    assert resp == {"code": 500, "message": "metrics fail", "data": None}


async def test_telemetry_health_dashboard_traces(_mock_services):
    _, _, tele = _mock_services
    assert (await get_telemetry_health())["code"] == 0
    assert (await get_telemetry_dashboard())["code"] == 0
    resp = await get_recent_traces(limit=10)
    assert resp["data"] == [{"trace_id": "t1"}]
    assert (await get_trace_detail(trace_id="t1"))["data"] == {"spans": []}


# =============================================================================
# 参数校验(走真实路由,FastAPI Query ge/le + Body 校验)
# =============================================================================


@pytest.fixture
def _mini_client(_mock_services):
    """只挂 orchestration router 的 mini ASGI app。"""
    app = FastAPI()
    app.include_router(orchestration.router)
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


async def test_get_events_limit_validation(_mini_client):
    async with _mini_client as ac:
        assert (await ac.get("/orchestration/events", params={"limit": 0})).status_code == 422
        assert (await ac.get("/orchestration/events", params={"limit": 501})).status_code == 422
        assert (await ac.get("/orchestration/events", params={"limit": "abc"})).status_code == 422
        assert (await ac.get("/orchestration/events", params={"limit": 100})).status_code == 200


async def test_get_event_stats_window_validation(_mini_client):
    async with _mini_client as ac:
        assert (await ac.get("/orchestration/events/stats", params={"window_hours": 0})).status_code == 422
        assert (await ac.get("/orchestration/events/stats", params={"window_hours": 169})).status_code == 422
        assert (await ac.get("/orchestration/events/stats", params={"window_hours": 24})).status_code == 200


async def test_get_decisions_limit_validation(_mini_client):
    async with _mini_client as ac:
        assert (await ac.get("/orchestration/decisions", params={"limit": 0})).status_code == 422
        assert (await ac.get("/orchestration/decisions", params={"limit": 50})).status_code == 200


async def test_get_budget_trend_days_validation(_mini_client):
    async with _mini_client as ac:
        assert (await ac.get("/orchestration/budget/trend", params={"days": 0})).status_code == 422
        assert (await ac.get("/orchestration/budget/trend", params={"days": 91})).status_code == 422
        assert (await ac.get("/orchestration/budget/trend", params={"days": 7})).status_code == 200


async def test_record_usage_negative_tokens_validation(_mini_client):
    """Body 校验:input_tokens ge=0。"""
    async with _mini_client as ac:
        resp = await ac.post(
            "/orchestration/budget/record",
            json={"pillar": "rag", "model": "gpt", "input_tokens": -1},
        )
        assert resp.status_code == 422
        resp = await ac.post(
            "/orchestration/budget/record",
            json={"pillar": "rag", "model": "gpt", "input_tokens": 0, "output_tokens": 10},
        )
        assert resp.status_code == 200


async def test_emit_event_required_fields_validation(_mini_client):
    """Body 校验:event_type/source_pillar 必填。"""
    async with _mini_client as ac:
        assert (await ac.post("/orchestration/events/emit", json={"source_pillar": "rag"})).status_code == 422
        assert (await ac.post("/orchestration/events/emit", json={"event_type": "x"})).status_code == 422
        assert (
            await ac.post(
                "/orchestration/events/emit",
                json={"event_type": "x", "source_pillar": "rag", "severity": "critical"},
            )
        ).status_code == 200
