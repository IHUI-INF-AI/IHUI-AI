"""DAG 执行 + Worker Pool 任务管理 API(2026-07-22 立,挂载在 /api 前缀)。

对齐 packages/types/src/agent-runtime.ts L1232-1447 多 Agent 并行执行契约。
跨端共享:ai-service(本路由)+ cli(子进程并行)+ api(Kanban API)+ web(工作台 UI)。

端点:
- POST /api/dag/execute            提交 DAG 执行(nodes + edges + initial_context)→ executionId
- GET  /api/dag/execute/{execId}   查询 DAG 执行状态(ParallelExecutionResult)
- POST /api/dag/tasks              提交单个 KanbanTask 到 WorkerPool
- GET  /api/dag/tasks/{taskId}     查询任务状态
- GET  /api/dag/tasks              列出所有任务(支持 status 过滤)

响应统一 {code, message, data} 格式(code=0 成功,500 失败)。
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from ..services.dag_scheduler import (
    DAGNode,
    DAGScheduler,
    KanbanTask,
    ParallelExecutionResult,
    WorkerPool,
    WorkerPoolConfig,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# 请求模型(camelCase alias 对齐 TS 契约)
# ---------------------------------------------------------------------------


class KanbanTaskCreate(BaseModel):
    """提交 KanbanTask 请求(对齐 agent-runtime.ts KanbanTask)。"""

    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = None
    agent_id: str = Field(..., alias="agentId")
    name: str
    description: Optional[str] = None
    priority: int = 0
    payload: dict = Field(default_factory=dict)
    scheduled_at: Optional[str] = Field(None, alias="scheduledAt")
    dependencies: list[str] = Field(default_factory=list)
    created_by: Optional[str] = Field(None, alias="createdBy")


class DAGNodeSpec(BaseModel):
    """DAG 节点规格(JSON 可序列化,executor 用默认回显实现)。"""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    dependencies: list[str] = Field(default_factory=list)
    max_retries: int = Field(3, alias="maxRetries")
    timeout: float = 300.0


class DAGExecuteRequest(BaseModel):
    """DAG 执行请求。"""

    model_config = ConfigDict(populate_by_name=True)

    nodes: list[DAGNodeSpec]
    edges: list[dict] = Field(default_factory=list)  # 保留字段,实际依赖由 node.dependencies 表达
    initial_context: dict = Field(default_factory=dict, alias="initialContext")


# ---------------------------------------------------------------------------
# 全局单例(进程级 WorkerPool + DAG 执行结果缓存)
# ---------------------------------------------------------------------------


_pool: Optional[WorkerPool] = None
_executions: dict[str, dict] = {}


def _get_pool() -> WorkerPool:
    """获取全局 WorkerPool 单例,首次调用惰性创建(不自动 start,由首个写操作触发)。"""
    global _pool
    if _pool is None or _pool._shutdown:
        _pool = WorkerPool(WorkerPoolConfig())
    return _pool


async def _ensure_pool_started() -> WorkerPool:
    pool = _get_pool()
    await pool.start()
    return pool


# ---------------------------------------------------------------------------
# DAG 执行端点
# ---------------------------------------------------------------------------


async def _default_node_executor(context: dict) -> dict:
    """DAG 节点默认 executor:回显 context keys(无业务 executor 时兜底)。"""
    return {"executed": True, "contextKeys": list(context.keys())}


@router.post("/dag/execute")
async def execute_dag(req: DAGExecuteRequest):
    """提交 DAG 执行,返回 executionId。

    节点 executor 用默认回显实现(真实业务应通过 WorkerPool + executor_factory 注册)。
    """
    scheduler = DAGScheduler()
    try:
        for node_spec in req.nodes:
            scheduler.add_node(
                DAGNode(
                    id=node_spec.id,
                    name=node_spec.name,
                    executor=_default_node_executor,
                    dependencies=node_spec.dependencies,
                    max_retries=node_spec.max_retries,
                    timeout=node_spec.timeout,
                )
            )
        result = await scheduler.execute(req.initial_context)
    except Exception as e:  # noqa: BLE001
        return {"code": 500, "message": f"DAG 执行失败: {e}", "data": None}

    execution_id = str(uuid.uuid4())
    task_results = {
        nid: KanbanTask(
            id=nid,
            agent_id="dag",
            name=node.name,
            status="done" if nr.status == "success" else ("blocked" if nr.status == "failed" else "todo"),
            result=nr.output,
            error_message=nr.error,
        ).to_camel_dict()
        for nid, node, nr in (
            (nid, scheduler.nodes[nid], result.node_results[nid]) for nid in result.node_results
        )
    }
    parallel = ParallelExecutionResult(
        execution_id=execution_id,
        status=result.status if result.status != "partial" else "partial",
        task_results={},  # 用 camel dict 直接存,避免二次转换
        total_duration_ms=result.total_duration_ms,
        worker_count=1,
        trace=result.trace,
    )
    payload = parallel.to_camel_dict()
    payload["taskResults"] = task_results
    _executions[execution_id] = payload
    return {"code": 0, "message": "ok", "data": {"executionId": execution_id, "status": result.status}}


@router.get("/dag/execute/{execution_id}")
async def get_execution(execution_id: str):
    """查询 DAG 执行状态。"""
    data = _executions.get(execution_id)
    if data is None:
        raise HTTPException(status_code=404, detail="executionId 不存在")
    return {"code": 0, "message": "ok", "data": data}


# ---------------------------------------------------------------------------
# Worker Pool 任务管理端点
# ---------------------------------------------------------------------------


@router.post("/dag/tasks")
async def submit_task(task_in: KanbanTaskCreate):
    """提交单个 KanbanTask 到 WorkerPool。"""
    pool = await _ensure_pool_started()
    task = KanbanTask(
        id=task_in.id or str(uuid.uuid4()),
        agent_id=task_in.agent_id,
        name=task_in.name,
        description=task_in.description,
        priority=task_in.priority,
        payload=task_in.payload,
        scheduled_at=task_in.scheduled_at,
        dependencies=list(task_in.dependencies),
        created_by=task_in.created_by,
    )
    try:
        task_id = await pool.submit(task)
    except RuntimeError as e:
        return {"code": 500, "message": str(e), "data": None}
    return {"code": 0, "message": "ok", "data": {"taskId": task_id, "task": task.to_camel_dict()}}


@router.get("/dag/tasks/{task_id}")
async def get_task(task_id: str):
    """查询任务状态。"""
    pool = _get_pool()
    task = await pool.get_status(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"code": 0, "message": "ok", "data": task.to_camel_dict()}


@router.get("/dag/tasks")
async def list_tasks(status: Optional[str] = Query(default=None, description="按状态过滤")):
    """列出所有任务(支持 status 过滤)。"""
    pool = _get_pool()
    tasks = pool.list_tasks(status=status)
    return {
        "code": 0,
        "message": "ok",
        "data": [t.to_camel_dict() for t in tasks],
        "total": len(tasks),
    }


@router.get("/dag/workers")
async def list_workers():
    """列出所有 worker 状态(辅助端点)。"""
    pool = _get_pool()
    return {
        "code": 0,
        "message": "ok",
        "data": [w.to_camel_dict() for w in pool.get_workers_state()],
    }
