"""跨支柱编排中枢路由 — 事件总线 + 联合决策 + 预算治理 + 统一遥测。

端点清单:
  编排中枢(7):
    1. GET    /orchestration/status           — 中枢状态
    2. GET    /orchestration/dashboard        — 编排仪表盘
    3. GET    /orchestration/events            — 事件流(?limit=&pillar=&event_type=)
    4. POST   /orchestration/events/emit      — 发射事件
    5. GET    /orchestration/events/stats      — 事件统计(?window_hours=24)
    6. GET    /orchestration/playbooks         — 列出所有 playbook
    7. POST   /orchestration/playbooks/:id/toggle — 启用/禁用 playbook
    8. GET    /orchestration/decisions         — 决策历史(?limit=50)

  LLM 预算治理(7):
    9. POST   /orchestration/budget/record     — 记录用量
   10. POST   /orchestration/budget/check       — 检查预算
   11. GET    /orchestration/budget/summary     — 用量汇总(?period=today)
   12. GET    /orchestration/budget/trend       — 用量趋势(?days=7)
   13. GET    /orchestration/budget/pillar/:pillar — 支柱预算
   14. POST   /orchestration/budget/pillar/:pillar/reset — 重置降级
   15. PATCH  /orchestration/budget/config     — 更新配置
   16. GET    /orchestration/budget/cost-breakdown — 成本分解

  统一遥测(5):
   17. GET    /orchestration/telemetry/metrics  — 所有 metrics(?format=json|prometheus)
   18. GET    /orchestration/telemetry/health   — 各支柱健康
   19. GET    /orchestration/telemetry/dashboard — 遥测仪表盘
   20. GET    /orchestration/telemetry/traces   — 最近 traces(?limit=20)
   21. GET    /orchestration/telemetry/traces/:trace_id — trace 详情

注册到 main.py:app.include_router(orchestration.router, prefix="/api", tags=["orchestration"])
"""

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..services.orchestration_hub import orchestration_hub
from ..services.llm_budget_governor import llm_budget_governor
from ..services.telemetry_service import telemetry_service

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class EmitEventBody(BaseModel):
    event_type: str = Field(..., description="事件类型")
    source_pillar: str = Field(..., description="来源支柱")
    payload: dict = Field(default_factory=dict)
    severity: str = Field("info", description="info/warning/critical")


class TogglePlaybookBody(BaseModel):
    enabled: bool


class RecordUsageBody(BaseModel):
    pillar: str
    model: str
    input_tokens: int = Field(0, ge=0)
    output_tokens: int = Field(0, ge=0)
    action: str = ""
    request_id: str = ""


class CheckBudgetBody(BaseModel):
    pillar: str
    estimated_tokens: int = Field(0, ge=0)


class BudgetConfigUpdateBody(BaseModel):
    daily_token_limit: Optional[int] = None
    daily_cost_limit_usd: Optional[float] = None
    hourly_token_limit: Optional[int] = None
    warning_threshold: Optional[float] = None
    critical_threshold: Optional[float] = None
    auto_degrade_at: Optional[float] = None
    hard_stop_at: Optional[float] = None


# ---------------------------------------------------------------------------
# 编排中枢端点
# ---------------------------------------------------------------------------


@router.get("/orchestration/status")
async def get_hub_status() -> dict[str, Any]:
    """中枢运行状态。"""
    try:
        data = await orchestration_hub.get_status()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/dashboard")
async def get_hub_dashboard() -> dict[str, Any]:
    """编排仪表盘。"""
    try:
        data = await orchestration_hub.get_dashboard()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/events")
async def get_events(
    limit: int = Query(50, ge=1, le=500),
    pillar: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
) -> dict[str, Any]:
    """事件流(供前端实时展示)。"""
    try:
        data = await orchestration_hub.get_event_feed(
            limit=limit, pillar=pillar, event_type=event_type
        )
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/events/emit")
async def emit_event(body: EmitEventBody) -> dict[str, Any]:
    """发射事件到编排中枢。"""
    try:
        event_id = await orchestration_hub.emit(
            event_type=body.event_type,
            source_pillar=body.source_pillar,
            payload=body.payload,
            severity=body.severity,
        )
        return {"code": 0, "message": "success", "data": {"event_id": event_id}}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/events/stats")
async def get_event_stats(
    window_hours: int = Query(24, ge=1, le=168),
) -> dict[str, Any]:
    """事件统计。"""
    try:
        data = await orchestration_hub.event_bus.get_event_stats(
            window_hours=window_hours
        )
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/playbooks")
async def get_playbooks() -> dict[str, Any]:
    """列出所有预置联动 playbook。"""
    try:
        data = await orchestration_hub.decision_engine.get_playbooks()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/playbooks/{playbook_id}/toggle")
async def toggle_playbook(playbook_id: str, body: TogglePlaybookBody) -> dict[str, Any]:
    """启用/禁用 playbook。"""
    try:
        success = await orchestration_hub.decision_engine.enable_playbook(
            playbook_id, body.enabled
        )
        return {"code": 0, "message": "success", "data": {"success": success}}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/decisions")
async def get_decisions(
    limit: int = Query(50, ge=1, le=500),
) -> dict[str, Any]:
    """决策历史。"""
    try:
        data = await orchestration_hub.decision_engine.get_decision_history(limit=limit)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


# ---------------------------------------------------------------------------
# LLM 预算治理端点
# ---------------------------------------------------------------------------


@router.post("/orchestration/budget/record")
async def record_budget_usage(body: RecordUsageBody) -> dict[str, Any]:
    """记录一次 LLM 调用用量。"""
    try:
        record = await llm_budget_governor.record_usage(
            pillar=body.pillar,
            model=body.model,
            input_tokens=body.input_tokens,
            output_tokens=body.output_tokens,
            action=body.action,
            request_id=body.request_id,
        )
        return {"code": 0, "message": "success", "data": record.__dict__}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/budget/check")
async def check_budget(body: CheckBudgetBody) -> dict[str, Any]:
    """检查预算是否允许调用。"""
    try:
        result = await llm_budget_governor.check_budget(
            pillar=body.pillar,
            estimated_tokens=body.estimated_tokens,
        )
        return {"code": 0, "message": "success", "data": result.__dict__}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/budget/summary")
async def get_budget_summary(
    period: str = Query("today"),
) -> dict[str, Any]:
    """用量汇总。"""
    try:
        data = await llm_budget_governor.get_usage_summary(period=period)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/budget/trend")
async def get_budget_trend(
    days: int = Query(7, ge=1, le=90),
) -> dict[str, Any]:
    """用量趋势。"""
    try:
        data = await llm_budget_governor.get_usage_trend(days=days)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/budget/pillar/{pillar}")
async def get_pillar_budget(pillar: str) -> dict[str, Any]:
    """单支柱预算详情。"""
    try:
        data = await llm_budget_governor.get_pillar_budget(pillar=pillar)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/orchestration/budget/pillar/{pillar}/reset")
async def reset_pillar_degradation(pillar: str) -> dict[str, Any]:
    """重置支柱降级状态。"""
    try:
        success = await llm_budget_governor.reset_degradation(pillar=pillar)
        return {"code": 0, "message": "success", "data": {"success": success}}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.patch("/orchestration/budget/config")
async def update_budget_config(body: BudgetConfigUpdateBody) -> dict[str, Any]:
    """更新预算配置。"""
    try:
        # 过滤 None 字段
        config_update = {k: v for k, v in body.model_dump().items() if v is not None}
        config = await llm_budget_governor.update_config(config_update)
        return {"code": 0, "message": "success", "data": config.__dict__}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/budget/cost-breakdown")
async def get_cost_breakdown(
    period: str = Query("today"),
) -> dict[str, Any]:
    """成本分解。"""
    try:
        data = await llm_budget_governor.get_cost_breakdown(period=period)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


# ---------------------------------------------------------------------------
# 统一遥测端点
# ---------------------------------------------------------------------------


@router.get("/orchestration/telemetry/metrics")
async def get_metrics(
    format: str = Query("json"),
) -> dict[str, Any] | str:
    """所有 metrics(json 或 prometheus 格式)。"""
    try:
        if format == "prometheus":
            text = await telemetry_service.get_metrics(format="prometheus")
            return text  # 直接返回文本(Prometheus 抓取格式)
        data = await telemetry_service.get_metrics(format="json")
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/telemetry/health")
async def get_telemetry_health() -> dict[str, Any]:
    """各支柱健康状态。"""
    try:
        data = await telemetry_service.get_pillar_health()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/telemetry/dashboard")
async def get_telemetry_dashboard() -> dict[str, Any]:
    """遥测仪表盘。"""
    try:
        data = await telemetry_service.get_dashboard()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/telemetry/traces")
async def get_recent_traces(
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    """最近 trace 列表。"""
    try:
        data = await telemetry_service.get_recent_traces(limit=limit)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/orchestration/telemetry/traces/{trace_id}")
async def get_trace_detail(trace_id: str) -> dict[str, Any]:
    """获取 trace 的所有 span。"""
    try:
        data = await telemetry_service.get_trace(trace_id=trace_id)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}
