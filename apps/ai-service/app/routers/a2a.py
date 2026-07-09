"""A2A 路由(5 端点)。

Agent-to-Agent 协议的 HTTP 入口。
send_task 创建 pending 任务并异步执行,客户端轮询 status 直到 completed。
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.a2a_service import A2AAgent, a2a_server

router = APIRouter()


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
async def send_task(req: SendTaskRequest) -> dict[str, Any]:
    """发送任务(创建 pending 任务,异步执行)。

    返回的 task 状态为 pending,客户端需轮询
    GET /a2a/tasks/:task_id/status 直到 completed。
    """
    task = a2a_server.send_task(
        name=req.name,
        agent_id=req.assigned_agent_id,
        input_data=req.input,
    )
    return task.to_dict()


@router.get("/a2a/tasks/{task_id}/status")
async def get_task_status(task_id: str) -> dict[str, Any]:
    """查询任务状态。"""
    status = await a2a_server.get_task_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    return {"task_id": task_id, **status}


@router.get("/a2a/tasks/{task_id}/result")
async def get_task_result(task_id: str) -> dict[str, Any]:
    """获取任务结果。"""
    result = await a2a_server.get_task_result(task_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    return {"task_id": task_id, **result}
