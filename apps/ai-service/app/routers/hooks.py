"""Hook 路由(8 端点)— 2026-07-22 立。

对接 hook_engine,提供 CRUD + 测试 + 日志查询 + 事件触发接口。

端点清单:
  1. GET    /hooks                 — 列出全部 Hook(可选 ?event= 过滤)
  2. POST   /hooks                 — 创建 Hook
  3. GET    /hooks/{id}            — 获取 Hook 详情
  4. PATCH  /hooks/{id}            — 更新 Hook
  5. DELETE /hooks/{id}            — 删除 Hook
  6. POST   /hooks/{id}/toggle     — 启用/禁用切换
  7. POST   /hooks/{id}/test       — 测试 Hook(模拟触发)
  8. GET    /hooks/{id}/logs       — 查询 Hook 日志(可选 ?limit=100)
  9. GET    /hooks/logs            — 查询全部 Hook 日志
  10. POST  /hooks/emit            — 内部触发事件(供 agent_loop 调用)
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..services.hook_engine import HOOK_ACTION_TYPES, HOOK_EVENTS, hook_engine

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class HookActionConfigModel(BaseModel):
    url: str | None = Field(None, description="webhook URL")
    method: str | None = Field(None, description="HTTP 方法 GET/POST/PUT")
    headers: dict[str, str] | None = Field(None, description="自定义请求头")
    body: str | None = Field(None, description="请求体模板,支持 {{event}} {{tool}} {{args}} 变量")
    command: str | None = Field(None, description="shell 命令(沙箱内执行,超时 10s)")
    channel: str | None = Field(None, description="通知渠道 toast/notification/email")
    message: str | None = Field(None, description="通知消息模板")


class HookActionModel(BaseModel):
    type: str = Field(..., description="动作类型 webhook/script/log/notify")
    config: HookActionConfigModel = Field(default_factory=HookActionConfigModel)


class CreateHookRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Hook 名称")
    description: str | None = Field(None, max_length=2000)
    event: str = Field(..., description="触发事件")
    condition: str | None = Field(None, description="JSONLogic 条件表达式")
    action: HookActionModel
    enabled: bool | None = Field(True)


class UpdateHookRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=2000)
    event: str | None = None
    condition: str | None = None
    action: HookActionModel | None = None
    enabled: bool | None = None


class ToggleHookRequest(BaseModel):
    enabled: bool


class TestHookRequest(BaseModel):
    event: str = Field(..., description="模拟触发的事件")
    context: dict[str, Any] = Field(default_factory=dict, description="模拟上下文")


class EmitRequest(BaseModel):
    """内部事件触发请求(agent_loop 调用)。"""

    event: str = Field(..., description="HookEvent")
    context: dict[str, Any] = Field(default_factory=dict)


class AutoOrchestrateBody(BaseModel):
    requirement: str = Field(...)
    event: str | None = None


class CreateAbTestBody(BaseModel):
    hook_a_id: str
    hook_b_id: str
    traffic_split: float = Field(0.5, ge=0.0, le=1.0)
    user_bucketing: str = "hash"


class InstantiateTemplateBody(BaseModel):
    overrides: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 校验 helper
# ---------------------------------------------------------------------------


def _validate_event(event: str) -> None:
    if event not in HOOK_EVENTS:
        raise HTTPException(status_code=400, detail=f"无效事件: {event},合法值: {list(HOOK_EVENTS)}")


def _validate_action_type(action_type: str) -> None:
    if action_type not in HOOK_ACTION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"无效动作类型: {action_type},合法值: {list(HOOK_ACTION_TYPES)}",
        )


def _validate_action(action: HookActionModel) -> None:
    _validate_action_type(action.type)
    # 按动作类型校验必填字段
    if action.type == "webhook" and not action.config.url:
        raise HTTPException(status_code=400, detail="webhook 动作必须提供 url")
    if action.type == "script" and not action.config.command:
        raise HTTPException(status_code=400, detail="script 动作必须提供 command")


def _to_hook_dict(hook_action: HookActionModel) -> dict[str, Any]:
    """把 Pydantic HookActionModel 转为存储 dict。"""
    return {
        "type": hook_action.type,
        "config": hook_action.config.model_dump(exclude_none=True),
    }


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.get("/hooks")
async def list_hooks(event: str | None = Query(None, description="按事件过滤")) -> dict[str, Any]:
    """列出全部 Hook(可选按 event 过滤)。"""
    if event:
        _validate_event(event)
    hooks = hook_engine.list_hooks(event=event)
    return {"code": 0, "message": "ok", "data": {"hooks": hooks, "count": len(hooks)}}


@router.post("/hooks")
async def create_hook(req: CreateHookRequest) -> dict[str, Any]:
    """创建 Hook。"""
    _validate_event(req.event)
    _validate_action(req.action)
    payload = {
        "name": req.name,
        "description": req.description,
        "event": req.event,
        "condition": req.condition,
        "action": _to_hook_dict(req.action),
        "enabled": req.enabled if req.enabled is not None else True,
    }
    hook = hook_engine.create_hook(payload)
    return {"code": 0, "message": "ok", "data": hook}


@router.post("/hooks/auto-orchestrate")
async def auto_orchestrate(body: AutoOrchestrateBody) -> dict[str, Any]:
    """智能编排:用 LLM 分析自然语言需求,生成 Hook + DAG 依赖图。"""
    try:
        data = await hook_engine.auto_orchestrate(body.requirement, body.event)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/hooks/ab-test")
async def create_ab_test(body: CreateAbTestBody) -> dict[str, Any]:
    """创建 A/B 测试。"""
    try:
        data = await hook_engine.create_ab_test(body.model_dump())
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/ab-tests")
async def list_ab_tests() -> dict[str, Any]:
    """列出所有 A/B 测试。"""
    try:
        data = await hook_engine.list_ab_tests()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/templates")
async def list_hook_templates() -> dict[str, Any]:
    """列出预置 Hook 模板。"""
    try:
        data = hook_engine.list_templates()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/{hook_id}")
async def get_hook(hook_id: str) -> dict[str, Any]:
    """获取 Hook 详情。"""
    hook = hook_engine.get_hook(hook_id)
    if hook is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    return {"code": 0, "message": "ok", "data": hook}


@router.patch("/hooks/{hook_id}")
async def update_hook(hook_id: str, req: UpdateHookRequest) -> dict[str, Any]:
    """更新 Hook(部分字段)。"""
    existing = hook_engine.get_hook(hook_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    patch: dict[str, Any] = {}
    if req.name is not None:
        patch["name"] = req.name
    if req.description is not None:
        patch["description"] = req.description
    if req.event is not None:
        _validate_event(req.event)
        patch["event"] = req.event
    if req.condition is not None:
        patch["condition"] = req.condition
    if req.action is not None:
        _validate_action(req.action)
        patch["action"] = _to_hook_dict(req.action)
    if req.enabled is not None:
        patch["enabled"] = req.enabled
    updated = hook_engine.update_hook(hook_id, patch)
    return {"code": 0, "message": "ok", "data": updated}


@router.delete("/hooks/{hook_id}")
async def delete_hook(hook_id: str) -> dict[str, Any]:
    """删除 Hook。"""
    ok = hook_engine.delete_hook(hook_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    return {"code": 0, "message": "ok", "data": {"deleted": True, "id": hook_id}}


@router.post("/hooks/{hook_id}/toggle")
async def toggle_hook(hook_id: str, req: ToggleHookRequest) -> dict[str, Any]:
    """启用/禁用切换。"""
    hook = hook_engine.toggle_hook(hook_id, req.enabled)
    if hook is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    return {"code": 0, "message": "ok", "data": hook}


@router.post("/hooks/{hook_id}/test")
async def test_hook(hook_id: str, req: TestHookRequest) -> dict[str, Any]:
    """测试 Hook:模拟触发,返回日志(不写入持久日志)。"""
    _validate_event(req.event)
    result = await hook_engine.test_hook(hook_id, req.event, req.context)
    return {"code": 0, "message": "ok", "data": result}


@router.get("/hooks/{hook_id}/logs")
async def list_hook_logs(
    hook_id: str,
    limit: int = Query(100, ge=1, le=1000, description="返回日志数"),
) -> dict[str, Any]:
    """查询指定 Hook 的日志。"""
    existing = hook_engine.get_hook(hook_id)
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    logs = hook_engine.list_logs(hook_id=hook_id, limit=limit)
    return {"code": 0, "message": "ok", "data": {"logs": logs, "count": len(logs)}}


@router.get("/hooks/logs")
async def list_all_logs(
    limit: int = Query(100, ge=1, le=1000, description="返回日志数"),
) -> dict[str, Any]:
    """查询全部 Hook 日志(最新在前)。"""
    logs = hook_engine.list_logs(hook_id=None, limit=limit)
    return {"code": 0, "message": "ok", "data": {"logs": logs, "count": len(logs)}}


@router.post("/hooks/emit")
async def emit_event(req: EmitRequest) -> dict[str, Any]:
    """内部事件触发入口(供 agent_loop / API gateway 调用)。

    body: {event: HookEvent, context: dict}
    返回: {triggered_count: int, logs: [HookLog]}
    """
    _validate_event(req.event)
    logs = await hook_engine.emit(req.event, req.context)
    return {
        "code": 0,
        "message": "ok",
        "data": {"triggered_count": len(logs), "logs": logs},
    }


@router.get("/hooks/ab-test/{test_id}")
async def get_ab_test(test_id: str) -> dict[str, Any]:
    """A/B 测试详情(含 A/B 各自 stats 对比)。"""
    try:
        data = await hook_engine.get_ab_test(test_id)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/hooks/ab-test/{test_id}/stop")
async def stop_ab_test(test_id: str) -> dict[str, Any]:
    """停止 A/B 测试,设 status=stopped。"""
    try:
        data = await hook_engine.stop_ab_test(test_id)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/hooks/templates/{template_id}/instantiate")
async def instantiate_template(
    template_id: str, body: InstantiateTemplateBody
) -> dict[str, Any]:
    """用模板创建 Hook(overrides 覆盖 url/command 等)。"""
    try:
        data = await hook_engine.instantiate_template(template_id, body.overrides)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/{hook_id}/execution-timeline")
async def execution_timeline(
    hook_id: str,
    since: str | None = Query(None, description="起始时间 ISO8601"),
) -> dict[str, Any]:
    """返回 Hook 执行时间线(Gantt 可视化数据)。"""
    try:
        data = await hook_engine.execution_timeline(hook_id, since)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/{hook_id}/health-forecast")
async def health_forecast(
    hook_id: str,
    days: int = Query(7, ge=1, le=90, description="预测天数"),
) -> dict[str, Any]:
    """Hook 健康预测:LLM 分析历史日志趋势,预测未来失败率/延迟。"""
    try:
        data = await hook_engine.health_forecast(hook_id, days)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}
