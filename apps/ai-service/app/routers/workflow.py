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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.workflow_engine import workflow_engine

router = APIRouter()


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
async def list_workflows() -> dict[str, Any]:
    """列出所有工作流。"""
    wfs = workflow_engine.list_workflows()
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.workflow_to_dict(w) for w in wfs]},
    }


@router.post("/workflows", status_code=201)
async def create_workflow(body: CreateWorkflowBody) -> dict[str, Any]:
    """创建新工作流。"""
    wf = workflow_engine.create_workflow(
        name=body.name,
        description=body.description,
        triggerType=body.triggerType,
        steps=body.steps,
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
async def list_instances(workflow_id: str | None = None) -> dict[str, Any]:
    """列出实例(可选按 workflowId 筛选)。"""
    instances = workflow_engine.list_instances(workflow_id=workflow_id)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.instance_to_dict(i) for i in instances]},
    }


@router.get("/workflows/instances/{instance_id}")
async def get_instance(instance_id: str) -> dict[str, Any]:
    """获取单个实例详情。"""
    inst = workflow_engine.get_instance(instance_id)
    if not inst:
        raise HTTPException(status_code=404, detail=f"instance not found: {instance_id}")
    return {
        "code": 0,
        "message": "success",
        "data": {"instance": workflow_engine.instance_to_dict(inst)},
    }


@router.get("/workflows/instances/{instance_id}/tasks")
async def get_instance_tasks(instance_id: str) -> dict[str, Any]:
    """获取实例的任务列表。"""
    tasks = workflow_engine.get_instance_tasks(instance_id)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.task_to_dict(t) for t in tasks]},
    }


@router.get("/workflows/instances/{instance_id}/logs")
async def get_instance_logs(instance_id: str) -> dict[str, Any]:
    """获取实例的日志列表。"""
    logs = workflow_engine.get_instance_logs(instance_id)
    return {
        "code": 0,
        "message": "success",
        "data": {"list": [workflow_engine.log_to_dict(l) for l in logs]},
    }


@router.post("/workflows/instances/{instance_id}/cancel")
async def cancel_instance(instance_id: str) -> dict[str, Any]:
    """取消运行中的实例。"""
    ok = await workflow_engine.cancel_instance(instance_id)
    if not ok:
        raise HTTPException(status_code=400, detail="无法取消(实例不存在或状态不允许取消)")
    return {"code": 0, "message": "success", "data": None}


@router.post("/workflows/instances/{instance_id}/retry")
async def retry_instance(instance_id: str) -> dict[str, Any]:
    """重试失败的实例。"""
    inst = await workflow_engine.retry_instance(instance_id)
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
async def get_workflow(workflow_id: str) -> dict[str, Any]:
    """获取单个工作流详情。"""
    wf = workflow_engine.get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail=f"workflow not found: {workflow_id}")
    return {
        "code": 0,
        "message": "success",
        "data": {"workflow": workflow_engine.workflow_to_dict(wf)},
    }


@router.put("/workflows/{workflow_id}")
async def update_workflow(workflow_id: str, body: UpdateWorkflowBody) -> dict[str, Any]:
    """更新工作流。"""
    wf = workflow_engine.update_workflow(
        workflow_id=workflow_id,
        name=body.name,
        description=body.description,
        triggerType=body.triggerType,
        steps=body.steps,
        isActive=body.isActive,
    )
    if not wf:
        raise HTTPException(status_code=404, detail=f"workflow not found: {workflow_id}")
    return {
        "code": 0,
        "message": "success",
        "data": workflow_engine.workflow_to_dict(wf),
    }


@router.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str) -> dict[str, Any]:
    """删除工作流。"""
    ok = workflow_engine.delete_workflow(workflow_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"workflow not found: {workflow_id}")
    return {"code": 0, "message": "success", "data": None}


@router.post("/workflows/{workflow_id}/trigger")
async def trigger_workflow(
    workflow_id: str,
    body: TriggerWorkflowBody | None = None,
) -> dict[str, Any]:
    """触发工作流执行。"""
    inst = await workflow_engine.trigger_workflow(
        workflow_id,
        input_data=(body.input if body else {}),
    )
    if not inst:
        raise HTTPException(status_code=400, detail="无法触发工作流(可能已禁用或正在运行)")
    return {
        "code": 0,
        "message": "success",
        "data": workflow_engine.instance_to_dict(inst),
    }