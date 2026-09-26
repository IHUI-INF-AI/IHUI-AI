# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from ..core.executor_switch import guard_loop_v2_pilot
from ..services.llm_budget_governor import llm_budget_governor
from ..services.orchestration_hub import orchestration_hub
from ..services.telemetry_service import telemetry_service

router = APIRouter()

# ---------------------------------------------------------------------------
# emit 响应面的「结论三态」(第九轮 B2,additive)
# ---------------------------------------------------------------------------
# 为什么需要三态而不是一个 bool:hub.emit() 的返回值只有 event_id,编排结论
# (degraded / non_ok_pillars)住在 hub 的内存台账 _orchestration_outcomes 里,
# 只有 hub **未启动消费循环**时 emit 才会同步跑完 _process_event 并把结论留在
# 台账尾部(见 OrchestrationHub.emit 里 `if not self._running:` 那一段)。消费
# 循环在跑时事件交给 Redis stream,本次 HTTP 调用结构上拿不到结论 —— 把"还没
# 拿到"写成 degraded=False 等于把"没判"写成"判过了",正是本仓最高频的失效型,
# 所以未结算档一律取 None(而不是 False),并由 outcome 键做区分档位。
EMIT_OUTCOME_SETTLED = "settled"  # 本次调用拿到了可关联到该事件的结论
EMIT_OUTCOME_ACCEPTED = "accepted"  # 事件已交给后台消费循环,结论稍后出现在 status
EMIT_OUTCOME_UNSETTLED = "unsettled"  # 同步路径但没拿到可关联的结论(skipped/异常/交错)


def _attempt_count(status: dict[str, object]) -> int | None:
    """读 hub status 里的编排执行次数;读不到返回 None(**不返回 0**)。

    返回 0 会把"取不到"伪装成"取到了且一次都没执行过",下游就分不出这两件事。
    bool 单独排除:Python 里 isinstance(True, int) 为真,计数键写成布尔属于形态
    漂移,不能当成合法计数。
    """
    raw = status.get("orchestration_attempts")
    if isinstance(raw, bool):
        return None
    if not isinstance(raw, int):
        return None
    return raw


def _last_orchestration(status: dict[str, object]) -> dict[str, object] | None:
    """读 status 里的 last_orchestration;形态不对返回 None(不猜、不兜空 dict)。"""
    raw = status.get("last_orchestration")
    if isinstance(raw, dict):
        return raw
    return None


def _non_ok_pillar_names(entries: object) -> list[str]:
    """把结论里的 non_ok_pillars 折成支柱名列表(去重、保序)。

    hub 侧的每条记录是 {pillar, action, status} 三字段(见 OrchestrationDecision
    .to_dict),这里只投影"哪几条支柱"这一层 —— action/status 的细粒度事实在
    /orchestration/status 与 /orchestration/decisions 上,本端点不复制第二份。
    读不出支柱名的条目跳过而非塞空串:空串在列表里会被读成"有一条但名字是空的"。
    裸字符串条目原样透传(它已经是名字了):把"hub 哪天简化成 list[str]"投影成
    空列表,会让 degraded=True 却点不出任何支柱 —— 那是"把没判写成判过了"的近亲。
    """
    if not isinstance(entries, list):
        return []
    names: list[str] = []
    for entry in entries:
        pillar = entry.get("pillar") if isinstance(entry, dict) else entry
        if isinstance(pillar, str) and pillar and pillar not in names:
            names.append(pillar)
    return names


def resolve_emit_outcome(
    status_before: dict[str, object],
    status_after: dict[str, object],
    event_type: str,
) -> tuple[str, bool | None, list[str] | None]:
    """由 emit 前后的两次 status 快照,折出"这次到底有没有真联动上"。

    判序(任何一条弱化都会把"未判定"洗成"成功"):
      1) 前置快照 running 为真 ⇒ 事件走 Redis stream 由后台消费循环处理,
         本次调用拿不到结论 ⇒ ("accepted", None, None)。
         刻意只看**前置**快照:emit 之后 running 可能恰好被人 start/stop。
      2) 两侧次数取不到 ⇒ ("unsettled", None, None) —— 尺子失灵不是通过。
      3) 后置次数未增加 ⇒ 本次 emit 没留下结论(playbook 未命中而 skipped、
         _process_event 吞异常、execute_decision 返回非 dict)⇒ ("unsettled", None, None)。
         skipped 尤其不得读成 degraded=False:那次联动**根本没发生**。
      4) 结论的 event_type 与本次请求不一致 ⇒ 台账尾部是别人的事件(并发交错),
         不能张冠李戴 ⇒ ("unsettled", None, None)。
      5) 全部成立 ⇒ ("settled", degraded, non_ok_pillars);degraded 必须是 bool,
         否则同样落 unsettled。

    已知局限(如实登记,不是待补的 bug 清单):第 3 步的"次数 +1"只能证明
    "本次调用窗口内产生了一条结论",不能证明它归属本事件 —— 并发 emit 可能
    交错。event_type 一致性是把这种交错**收窄**而非消除。真要逐事件归属,需要
    hub 侧给结论带上 event_id,而那属线程模型/数据结构的改动,不在本票范围。
    """
    if status_before.get("running") is True:
        return EMIT_OUTCOME_ACCEPTED, None, None

    before_count = _attempt_count(status_before)
    after_count = _attempt_count(status_after)
    if before_count is None or after_count is None:
        return EMIT_OUTCOME_UNSETTLED, None, None
    if after_count <= before_count:
        return EMIT_OUTCOME_UNSETTLED, None, None

    last = _last_orchestration(status_after)
    if last is None or last.get("event_type") != event_type:
        return EMIT_OUTCOME_UNSETTLED, None, None

    degraded = last.get("degraded")
    if not isinstance(degraded, bool):
        return EMIT_OUTCOME_UNSETTLED, None, None

    return EMIT_OUTCOME_SETTLED, degraded, _non_ok_pillar_names(last.get("non_ok_pillars"))


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class EmitEventBody(BaseModel):
    event_type: str = Field(..., description="事件类型")
    source_pillar: str = Field(..., description="来源支柱")
    payload: dict[str, Any] = Field(default_factory=dict)
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
    daily_token_limit: int | None = None
    daily_cost_limit_usd: float | None = None
    hourly_token_limit: int | None = None
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    auto_degrade_at: float | None = None
    hard_stop_at: float | None = None


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
    pillar: str | None = Query(None),
    event_type: str | None = Query(None),
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
    """发射事件到编排中枢。

    响应面(第九轮 B2,加性):`data` 除既有 `event_id` 外新增
      - `outcome`: "settled" | "accepted" | "unsettled"
      - `degraded`: 仅 outcome=="settled" 时为 bool,其余档位为 **null**(未知)
      - `non_ok_pillars`: 仅 outcome=="settled" 时为支柱名列表,其余为 null

    为什么要这么绕:emit 的语义是"事件已交给中枢",而**联动结论只在 hub 同步
    编排的那一档里当场可得**(消费循环未启动时)。消费循环启动后事件进 Redis
    stream 由后台处理,HTTP 这一趟拿不到它 —— 此时如实返回"未知"而不是
    degraded=false,调用方才不会被"成功"二字骗过去。

    读结论的另两个出口(未结算时**必须**去这里再查,不得在本端点猜):
      - GET /orchestration/status → last_orchestration / orchestration_degraded
      - GET /orchestration/dashboard

    ⚠️ 一处结构性限制(不是本票漏改,改了要动线程模型):`outcome="accepted"`
    也不等于"稍后一定会出结论"。消费循环只在 Redis 可用时才取事件
    (OrchestrationHub._consume_loop 的 else 分支在内存降级模式下只 sleep 空转),
    所以 Redis 不可用时该事件**永远不会**被自动编排 —— status 里的
    orchestration_attempts 不会增加,这也正是本端点把它留成未知的原因。
    """
    try:
        # D6① 收敛开关接线点(默认 legacy 直接返回,行为与改前等价;loop_v2 档
        # 在触达 hub.emit 之前 fail-fast,错误经本 handler 既有 except 转为
        # {code:500} 信封且消息含 AGENT_LOOP_V2_PILOT_NOT_WIRED)
        guard_loop_v2_pilot("routers/orchestration.emit_event")
        # get_status() 只做内存算术(读三个 deque/dict 的长度与副本),不发网络
        # 请求也不碰 Redis,故可安全地在 emit 前后各取一次快照做结论对账。
        status_before = await orchestration_hub.get_status()
        event_id = await orchestration_hub.emit(
            event_type=body.event_type,
            source_pillar=body.source_pillar,
            payload=body.payload,
            severity=body.severity,
        )
        status_after = await orchestration_hub.get_status()
        outcome, degraded, non_ok_pillars = resolve_emit_outcome(
            status_before, status_after, body.event_type
        )
        # 既有键(event_id)与信封(code/message/data)名称/类型/顺序一字未改,
        # 新增三键一律追加在 event_id 之后 —— 三条消费端都在读现有形状。
        return {
            "code": 0,
            "message": "success",
            "data": {
                "event_id": event_id,
                "outcome": outcome,
                "degraded": degraded,
                "non_ok_pillars": non_ok_pillars,
            },
        }
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
