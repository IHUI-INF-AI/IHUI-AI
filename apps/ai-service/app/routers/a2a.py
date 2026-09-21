# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""A2A 路由(5 端点 + 收权)。

Agent-to-Agent 协议的 HTTP 入口。
send_task 创建 pending 任务并异步执行,客户端轮询 status 直到 completed。

O11 收权(2026-09-20):
- 任务面(`/a2a/tasks*`)显式解析 Principal(IHUI JWT 或内网 X-IHUI-Principal),
  并按能力目录要求 scope:建单 `agents:call`、读取 `agents:read`;
- 建单时把调用者 `principal.sub` 写为任务归属(响应体形状不变,归属只进持久化);
- 读取他人任务 → 403(裁决见 `a2a_service.can_access_task`)。
- agent 注册/列表两端(`POST /a2a/agents/register`、`GET /a2a/agents`)路径与响应
  形状**保持原样**,向后兼容;对外发现能力由 `/.well-known/agent.json`
  (见 routers/agent_wellknown.py)以新增端点承载,不改动上述任何既有契约。
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..services.a2a_service import A2AAgent, A2ATask, a2a_server, can_access_task
from ..services.agent_card import SCOPE_TASK_CALL, SCOPE_TASK_READ
from ..services.capability_gate import (
    Principal,
    PrincipalAuthError,
    ScopeDeniedError,
    enforce_scope,
    resolve_principal,
)

router = APIRouter()


async def require_a2a_principal(request: Request) -> Principal:
    """FastAPI 依赖:解析 A2A 调用主体,凭据缺失/无效 → 401。

    复用 MCP 侧同一个能力闸(`capability_gate.resolve_principal`),不另起一套凭据
    解析:优先取中间件已注入的 request.state.principal,否则从请求头解析
    (JWT / 内网 X-IHUI-Principal)。生产环境无凭据必 401,本机开发走既有回退主体。
    """
    try:
        return await resolve_principal(request)
    except PrincipalAuthError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)


A2APrincipal = Annotated[Principal, Depends(require_a2a_principal)]


def _require_task(task_id: str, task: A2ATask | None, principal: Principal) -> A2ATask:
    """任务存在性 + 归属裁决:不存在 404,越权 403(不泄露对方任务是否存在之外的信息)。"""
    if task is None:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    if not can_access_task(task, principal):
        raise HTTPException(status_code=403, detail=f"无权访问任务: {task_id}")
    return task


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class RegisterAgentRequest(BaseModel):
    """注册 agent 请求。"""

    id: str = Field(..., description="agent 唯一 ID")
    name: str = Field(..., description="agent 名称")
    description: str = Field("", description="agent 描述")
    capabilities: list[str] = Field(default_factory=list, description="能力列表")
    endpoint: str = Field("", description="agent 端点地址")


class SendTaskRequest(BaseModel):
    """发送任务请求。"""

    name: str = Field(..., description="任务名称")
    description: str = Field("", description="任务描述")
    input: dict[str, Any] = Field(default_factory=dict, description="任务输入")
    assigned_agent_id: str = Field("", description="指派的 agent ID")


# ---------------------------------------------------------------------------
# 端点
# ---------------------------------------------------------------------------


@router.post("/a2a/agents/register")
async def register_agent(req: RegisterAgentRequest) -> dict[str, Any]:
    """注册一个 agent。"""
    agent = A2AAgent(
        agent_id=req.id,
        name=req.name,
        capabilities=req.capabilities,
        endpoint=req.endpoint,
        description=req.description,
    )
    saved = a2a_server.register_agent(agent)
    return saved.to_dict()


@router.get("/a2a/agents")
async def list_agents() -> dict[str, Any]:
    """列出所有已注册 agent。"""
    agents = [a.to_dict() for a in a2a_server.list_agents()]
    return {"agents": agents, "count": len(agents)}


@router.post("/a2a/tasks")
async def send_task(
    req: SendTaskRequest,
    principal: A2APrincipal,
) -> dict[str, Any]:
    """发送任务(创建 pending 任务,异步执行)。

    返回的 task 状态为 pending,客户端需轮询
    GET /a2a/tasks/:task_id/status 直到 completed。

    O11:需要 `agents:call` scope;任务归属记为 `principal.sub`(响应形状不变)。
    """
    try:
        enforce_scope(principal, SCOPE_TASK_CALL, resource_label="A2A 任务创建")
    except ScopeDeniedError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    task = a2a_server.send_task(
        name=req.name,
        agent_id=req.assigned_agent_id,
        input_data=req.input,
        owner_id=principal.sub,
    )
    return task.to_dict()


@router.get("/a2a/tasks/{task_id}/status")
async def get_task_status(
    task_id: str,
    principal: A2APrincipal,
) -> dict[str, Any]:
    """查询任务状态(需 `agents:read` scope + 任务归属匹配,否则 403)。"""
    try:
        enforce_scope(principal, SCOPE_TASK_READ, resource_label="A2A 任务状态")
    except ScopeDeniedError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    task = _require_task(task_id, await a2a_server.get_task(task_id), principal)
    return {"task_id": task_id, **task.status_dict()}


@router.get("/a2a/tasks/{task_id}/result")
async def get_task_result(
    task_id: str,
    principal: A2APrincipal,
) -> dict[str, Any]:
    """获取任务结果(需 `agents:read` scope + 任务归属匹配,否则 403)。"""
    try:
        enforce_scope(principal, SCOPE_TASK_READ, resource_label="A2A 任务结果")
    except ScopeDeniedError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message)
    task = _require_task(task_id, await a2a_server.get_task(task_id), principal)
    return {"task_id": task_id, **task.result_dict()}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
