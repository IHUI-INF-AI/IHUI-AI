# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.hook_engine import (
    HIGH_RISK_ACTIONS,
    HOOK_ACTION_TYPES,
    HOOK_EVENTS,
    _action_allowed,
    hook_engine,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# 鉴权 helper(P0-5:全部端点要求登录;归属隔离:非管理员只能管自己的 hook)
# ---------------------------------------------------------------------------
def _is_admin(request: Request) -> bool:
    role_id = getattr(request.state, "role_id", 0) or 0
    return int(role_id) >= 1


def _owner_filter(request: Request, principal: str | None = None) -> str | None:
    """归属分档:非管理员 → 只能访问自己的资源(owner_id == 主体);管理员 → None(全站)。

    `principal` 是端点从身份依赖(`Depends(get_current_user_id)`)拿到的**令牌主体**。
    新登记的调用一律显式传它(AGENTS §5"身份只能从承载层显式入参进来");不传时回落到
    `request.state.user_id` —— 那是本模块既有 11 处调用的形态,而回落分支之所以不构成
    fail-open,靠的是同一条链:`get_current_user_id` 在 `request.state.user_id` 为假值时
    直接抛 401(`app/core/jwt_auth.py:180-185`),所以端点体内跑到这里时它必为真值。
    这句话是**承重**的:哪天某个用 `_owner_filter` 的端点不挂身份依赖,"缺身份"就会被
    读成"管理员"(返回 None ⇒ 不过滤)。改判据的人请先看 tests/test_hooks.py::TestOwnerFilter。

    这里是路由侧唯一的归属分档实现,不要在端点里再写 `None if _is_admin(...) else ...`。
    """
    if _is_admin(request):
        return None
    return principal if principal is not None else getattr(request.state, "user_id", None)


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
    overrides: dict[str, Any] = Field(default_factory=dict)


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
    # P0-5:script/webhook 高危动作默认禁用,必须 HOOK_ALLOWED_ACTIONS 白名单显式放行
    if action.type in HIGH_RISK_ACTIONS and not _action_allowed(action.type):
        raise HTTPException(
            status_code=403,
            detail=f"高危动作 {action.type} 未启用:请在服务端配置 HOOK_ALLOWED_ACTIONS 白名单",
        )
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
async def list_hooks(
    request: Request,
    event: str | None = Query(None, description="按事件过滤"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """列出 Hook(非管理员只列自己的;可选按 event 过滤)。"""
    if event:
        _validate_event(event)
    hooks = hook_engine.list_hooks(event=event, owner_id=_owner_filter(request))
    return {"code": 0, "message": "ok", "data": {"hooks": hooks, "count": len(hooks)}}


@router.post("/hooks")
async def create_hook(
    request: Request,
    req: CreateHookRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
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
    hook = hook_engine.create_hook(payload, owner_id=user_id)
    return {"code": 0, "message": "ok", "data": hook}


@router.post("/hooks/auto-orchestrate")
async def auto_orchestrate(
    request: Request,
    body: AutoOrchestrateBody,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """智能编排:用 LLM 分析自然语言需求,生成 Hook + DAG 依赖图。"""
    try:
        data = await hook_engine.auto_orchestrate(body.requirement, body.event)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/hooks/ab-test")
async def create_ab_test(
    request: Request,
    body: CreateAbTestBody,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """创建 A/B 测试。

    属主**必须**盖成创建者(传 `user_id`,不是 `_owner_filter`):管理员建的实验归管理员
    自己,而不是落成 None(系统级、人人可管)—— 与 `instantiate_template` 同一条理由。
    """
    try:
        data = await hook_engine.create_ab_test(body.model_dump(), owner_id=user_id)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/ab-tests")
async def list_ab_tests(
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """列出 A/B 测试(非管理员只列自己的;G-258 B 组)。

    过滤写在引擎一处(`hook_engine.list_ab_tests(owner_id=…)`),不在响应侧筛 ——
    响应侧筛等于把"全量取回再藏起来"当成隔离,读日志/抓包的人仍然看得见全部。
    """
    try:
        data = await hook_engine.list_ab_tests(owner_id=_owner_filter(request, user_id))
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/templates")
async def list_hook_templates(
    request: Request,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """列出预置 Hook 模板。"""
    try:
        data = hook_engine.list_templates()
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/{hook_id}")
async def get_hook(
    request: Request,
    hook_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """获取 Hook 详情。"""
    hook = hook_engine.get_hook(hook_id, owner_id=_owner_filter(request))
    if hook is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    return {"code": 0, "message": "ok", "data": hook}


@router.patch("/hooks/{hook_id}")
async def update_hook(
    request: Request,
    hook_id: str,
    req: UpdateHookRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """更新 Hook(部分字段)。"""
    existing = hook_engine.get_hook(hook_id, owner_id=_owner_filter(request))
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
    updated = hook_engine.update_hook(hook_id, patch, owner_id=_owner_filter(request))
    return {"code": 0, "message": "ok", "data": updated}


@router.delete("/hooks/{hook_id}")
async def delete_hook(
    request: Request,
    hook_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """删除 Hook。"""
    ok = hook_engine.delete_hook(hook_id, owner_id=_owner_filter(request))
    if not ok:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    return {"code": 0, "message": "ok", "data": {"deleted": True, "id": hook_id}}


@router.post("/hooks/{hook_id}/toggle")
async def toggle_hook(
    request: Request,
    hook_id: str,
    req: ToggleHookRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """启用/禁用切换。"""
    hook = hook_engine.toggle_hook(hook_id, req.enabled, owner_id=_owner_filter(request))
    if hook is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    return {"code": 0, "message": "ok", "data": hook}


@router.post("/hooks/{hook_id}/test")
async def test_hook(
    request: Request,
    hook_id: str,
    req: TestHookRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """测试 Hook:模拟触发,返回日志(不写入持久日志)。"""
    _validate_event(req.event)
    existing = hook_engine.get_hook(hook_id, owner_id=_owner_filter(request))
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    result = await hook_engine.test_hook(hook_id, req.event, req.context)
    return {"code": 0, "message": "ok", "data": result}


@router.get("/hooks/{hook_id}/logs")
async def list_hook_logs(
    request: Request,
    hook_id: str,
    limit: int = Query(100, ge=1, le=1000, description="返回日志数"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """查询指定 Hook 的日志。"""
    existing = hook_engine.get_hook(hook_id, owner_id=_owner_filter(request))
    if existing is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    logs = hook_engine.list_logs(hook_id=hook_id, limit=limit)
    return {"code": 0, "message": "ok", "data": {"logs": logs, "count": len(logs)}}


@router.get("/hooks/logs")
async def list_all_logs(
    request: Request,
    limit: int = Query(100, ge=1, le=1000, description="返回日志数"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """查询全部 Hook 日志(最新在前)。

    批 63 / G-258:这条是 `list_logs(hook_id=None)` 的**全站档**,过去任何已登录用户
    都能读到别人 Hook 的 url/command 上下文与失败原因。归属过滤放在引擎侧一处
    (`hook_engine.list_logs(owner_id=…)`),不在响应侧筛。管理员(`_owner_filter` 返回
    None)照旧看全站 —— 那是本模块既有的分级,不是本次新开的口子。
    """
    logs = hook_engine.list_logs(hook_id=None, limit=limit, owner_id=_owner_filter(request))
    return {"code": 0, "message": "ok", "data": {"logs": logs, "count": len(logs)}}


@router.post("/hooks/emit")
async def emit_event(
    request: Request,
    req: EmitRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """内部事件触发入口(供 agent_loop / API gateway 调用)。

    body: {event: HookEvent, context: dict}
    返回: {triggered_count: int, logs: [HookLog]}

    P0-5:要求登录(agent_loop 调用带用户 JWT;无用户内部调用走进程内
    `hook_engine.emit`,不经这个 HTTP 口)。

    G-258 B 组:**触发集合按调用方主体收窄**。旧实现挑出 candidates 后逐个点火,而
    candidates 没有归属过滤 ⇒ 任何已登录用户 POST 一个事件名,就能触发别人的
    webhook(带着别人的地址与凭据往外发)或别人的 script(在别人机器上跑命令),
    而副作用与执行证据全记在受害者名下、响应还回 code=0。归属过滤住在引擎一处
    (`hook_engine.emit(owner_id=…)`),判据与 list_hooks/get_hook 同一份(`_owned_by`)。
    管理员(`_owner_filter` → None)仍可全量点火 —— 那是本模块既有分级,不是新开的口子。
    """
    _validate_event(req.event)
    logs = await hook_engine.emit(
        req.event, req.context, owner_id=_owner_filter(request, user_id)
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {"triggered_count": len(logs), "logs": logs},
    }


@router.get("/hooks/ab-test/{test_id}")
async def get_ab_test(
    request: Request,
    test_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """A/B 测试详情(含 A/B 各自 stats 对比)。

    别人的实验与"不存在"同形:引擎两种情况都返回 None,这里也就同样回 data=None ——
    分成 403/404 两种答案,这个端点就成了"别人有没有在做实验"的存在性预言机。
    """
    try:
        data = await hook_engine.get_ab_test(test_id, owner_id=_owner_filter(request, user_id))
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/hooks/ab-test/{test_id}/stop")
async def stop_ab_test(
    request: Request,
    test_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """停止 A/B 测试,设 status=stopped(只准属主;G-258 B 组)。

    同一条闸、同一个同形口径:非属主的停止动作与"这条不存在"得到**逐字相同**的响应
    (data=None),并且引擎在归属判定通过之前不会写 status、不会落盘(见
    `hook_engine.stop_ab_test` → `get_ab_test(owner_id=…)` 的取数顺序)。
    """
    try:
        data = await hook_engine.stop_ab_test(test_id, owner_id=_owner_filter(request, user_id))
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.post("/hooks/templates/{template_id}/instantiate")
async def instantiate_template(
    request: Request,
    template_id: str,
    body: InstantiateTemplateBody,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """用模板创建 Hook(overrides 覆盖 url/command 等)。

    必须把创建者写成 owner:此前 `instantiate_template` 不传 owner ⇒ 造出
    `owner_id=None` 的**系统级** Hook,对所有用户生效且人人可管(批 63 / G-258)。
    管理员经此口创建的也归他自己 —— 这里要的是"谁建的谁负责",不是"管理员建=全站生效"。
    """
    try:
        data = await hook_engine.instantiate_template(
            template_id, body.overrides, owner_id=getattr(request.state, "user_id", None)
        )
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/{hook_id}/execution-timeline")
async def execution_timeline(
    request: Request,
    hook_id: str,
    since: str | None = Query(None, description="起始时间 ISO8601"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """返回 Hook 执行时间线(Gantt 可视化数据)。只准属主读(与 :352 的 logs 同一条闸)。"""
    if hook_engine.get_hook(hook_id, owner_id=_owner_filter(request)) is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    try:
        data = await hook_engine.execution_timeline(hook_id, since)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}


@router.get("/hooks/{hook_id}/health-forecast")
async def health_forecast(
    request: Request,
    hook_id: str,
    days: int = Query(7, ge=1, le=90, description="预测天数"),
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """Hook 健康预测:LLM 分析历史日志趋势,预测未来失败率/延迟。

    它读的是**该 Hook 的全部历史日志**,因此与 execution-timeline 同一条归属闸;
    不加就得改 `_logs` 的语义 —— 拒读比漏判安全。
    """
    if hook_engine.get_hook(hook_id, owner_id=_owner_filter(request)) is None:
        raise HTTPException(status_code=404, detail=f"Hook 不存在: {hook_id}")
    try:
        data = await hook_engine.health_forecast(hook_id, days)
        return {"code": 0, "message": "success", "data": data}
    except Exception as e:
        return {"code": 500, "message": str(e), "data": None}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
