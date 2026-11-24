# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作流路由(2026-08-09 新增,Phase 2:可视化工作流编辑器)。

端点清单:
  GET    /api/workflows              — 列表
  POST   /api/workflows              — 创建
  GET    /api/workflows/instances    — 实例列表
  GET    /api/workflows/instances/{id} — 实例详情
  GET    /api/workflows/instances/{id}/tasks — 实例任务列表
  GET    /api/workflows/instances/{id}/logs  — 实例日志列表
  POST   /api/workflows/instances/{id}/cancel — 取消实例
  POST   /api/workflows/instances/{id}/retry  — 重试实例
  GET    /api/workflows/{id}         — 详情
  PUT    /api/workflows/{id}         — 更新
  DELETE /api/workflows/{id}         — 删除
  POST   /api/workflows/{id}/trigger — 触发执行

注意:静态路由(/workflows/instances/*)必须在参数化路由(/workflows/{workflow_id})之前定义,
否则 FastAPI 会把 "instances" 匹配为 workflow_id 路径参数。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id
from ..services.workflow_engine import resolve_caller, workflow_engine

router = APIRouter()


async def caller_principal(request: Request) -> str | None:
    """端点级身份注入:令牌主体 → 引擎的 principal;开发降级身份归一为 None。

    身份**只能由承载层显式传进来**(AGENTS §5「认证不等于授权」):本族端点的请求体里
    从来没有 userId 字段,引擎也只收承载层给的 principal —— 所以"自报身份赢过令牌主体"
    这一型在这条链上结构上不可能发生。生产侧(jwt_secret 非空)取不到主体一律 401,
    命中 JWT 白名单也漏不出去;开发降级由 resolve_caller 归一成"无从对账"而非假主体。
    """
    return resolve_caller(await require_request_user_id(request))


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class CreateWorkflowBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    triggerType: str = "manual"
    steps: list[dict[str, Any]] = Field(default_factory=list)


class UpdateWorkflowBody(BaseModel):
    name: str | None = None
    description: str | None = None
    triggerType: str | None = None
    steps: list[dict[str, Any]] | None = None
    isActive: bool | None = None


class TriggerWorkflowBody(BaseModel):
    input: dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# 工作流 CRUD(静态路由,不含路径参数)
# ---------------------------------------------------------------------------


@router.get("/workflows")
async def list_workflows(principal: str | None = Depends(caller_principal)) -> dict[str, Any]:
    """列出调用方可见的工作流(无身份通道时等于全部,逐字保持改动前行为)。"""
    wfs = workflow_engine.list_workflows(principal)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.workflow_to_dict(w) for w in wfs]},
    }


@router.post("/workflows", status_code=201)
async def create_workflow(
    body: CreateWorkflowBody,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """创建新工作流(属主取令牌主体,不取请求体自报字段)。"""
    wf = workflow_engine.create_workflow(
        name=body.name,
        description=body.description,
        triggerType=body.triggerType,
        steps=body.steps,
        owner=principal,
    )
    return {
        "code": 0,
        "message": "success",
        "data": workflow_engine.workflow_to_dict(wf),
    }


# ---------------------------------------------------------------------------
# 实例管理(静态路由,必须在 {workflow_id} 参数化路由之前定义)
# ---------------------------------------------------------------------------


@router.get("/workflows/instances")
async def list_instances(
    workflow_id: str | None = None,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """列出实例(可选按 workflowId 筛选;只列调用方自己可见的)。"""
    instances = workflow_engine.list_instances(workflow_id=workflow_id, principal=principal)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.instance_to_dict(i) for i in instances]},
    }


@router.get("/workflows/instances/{instance_id}")
async def get_instance(
    instance_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """获取单个实例详情。别人的实例与不存在的实例**同码同消息形状**(不给存在性 oracle)。"""
    inst = workflow_engine.get_instance(instance_id, principal)
    if not inst:
        raise HTTPException(status_code=404, detail=f"instance not found: {instance_id}")
    return {
        "code": 0,
        "message": "success",
        "data": {"instance": workflow_engine.instance_to_dict(inst)},
    }


@router.get("/workflows/instances/{instance_id}/tasks")
async def get_instance_tasks(
    instance_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """获取实例的任务列表(非本人可见 ⇒ 空列表,与"该实例没有任务"同形)。"""
    tasks = workflow_engine.get_instance_tasks(instance_id, principal)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.task_to_dict(t) for t in tasks]},
    }


@router.get("/workflows/instances/{instance_id}/logs")
async def get_instance_logs(
    instance_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """获取实例的日志列表(非本人可见 ⇒ 空列表,同上)。"""
    logs = workflow_engine.get_instance_logs(instance_id, principal)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.log_to_dict(l) for l in logs]},
    }


@router.post("/workflows/instances/{instance_id}/cancel")
async def cancel_instance(
    instance_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """取消运行中的实例(属主闸在状态判定之前;别人的实例一律"无法取消"且无副作用)。"""
    ok = await workflow_engine.cancel_instance(instance_id, principal)
    if not ok:
        raise HTTPException(status_code=400, detail="无法取消(实例不存在或状态不允许取消)")
    return {"code": 0, "message": "success", "data": None}


@router.post("/workflows/instances/{instance_id}/retry")
async def retry_instance(
    instance_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """重试失败的实例(新实例的属主是当前调用者)。"""
    inst = await workflow_engine.retry_instance(instance_id, principal)
    if not inst:
        raise HTTPException(status_code=400, detail="无法重试(实例不存在或状态不允许重试)")
    return {
        "code": 0,
        "message": "success",
        "data": workflow_engine.instance_to_dict(inst),
    }


# ---------------------------------------------------------------------------
# 工作流详情/操作(参数化路由,含 {workflow_id} 路径参数)
# ---------------------------------------------------------------------------


@router.get("/workflows/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """获取单个工作流详情(别人的与不存在的同码同消息形状)。"""
    wf = workflow_engine.get_workflow(workflow_id, principal)
    if not wf:
        raise HTTPException(status_code=404, detail=f"workflow not found: {workflow_id}")
    return {
        "code": 0,
        "message": "success",
        "data": {"workflow": workflow_engine.workflow_to_dict(wf)},
    }


@router.put("/workflows/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    body: UpdateWorkflowBody,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """更新工作流(非属主不写任何字段,响应与"不存在"同形)。"""
    wf = workflow_engine.update_workflow(
        workflow_id=workflow_id,
        name=body.name,
        description=body.description,
        triggerType=body.triggerType,
        steps=body.steps,
        isActive=body.isActive,
        principal=principal,
    )
    if not wf:
        raise HTTPException(status_code=404, detail=f"workflow not found: {workflow_id}")
    return {
        "code": 0,
        "message": "success",
        "data": workflow_engine.workflow_to_dict(wf),
    }


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """删除工作流(非属主的那一行**没有被删**,与"不存在"同形)。"""
    ok = workflow_engine.delete_workflow(workflow_id, principal)
    if not ok:
        raise HTTPException(status_code=404, detail=f"workflow not found: {workflow_id}")
    return {"code": 0, "message": "success", "data": None}


@router.post("/workflows/{workflow_id}/trigger")
async def trigger_workflow(
    workflow_id: str,
    body: TriggerWorkflowBody | None = None,
    principal: str | None = Depends(caller_principal),
) -> dict[str, Any]:
    """触发工作流执行(属主闸先于禁用/运行中判定:非属主不起后台 task、不建实例)。"""
    inst = await workflow_engine.trigger_workflow(
        workflow_id,
        input_data=(body.input if body else {}),
        principal=principal,
    )
    if not inst:
        raise HTTPException(status_code=400, detail="无法触发工作流(可能已禁用或正在运行)")
    return {
        "code": 0,
        "message": "success",
        "data": workflow_engine.instance_to_dict(inst),
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
