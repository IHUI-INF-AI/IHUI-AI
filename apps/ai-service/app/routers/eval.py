"""评估/评测路由。

提供数据集管理(CRUD)和自动化评估运行端点。
注册前缀: /api/v1/ai/eval
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.eval_service import eval_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ai/eval", tags=["eval"])


# ---------------------------------------------------------------------------
# 请求/响应模型
# ---------------------------------------------------------------------------


class CreateDatasetRequest(BaseModel):
    """创建数据集请求。"""

    name: str = Field(..., description="数据集名称,唯一标识")
    items: list[dict[str, Any]] = Field(default_factory=list, description="数据条目列表")
    description: str = Field("", description="数据集描述")


class EvalItemRequest(BaseModel):
    """评估数据集条目。"""

    input: str
    expected_output: str = ""


class RunEvalRequest(BaseModel):
    """创建评估运行请求。"""

    dataset_name: str = Field(..., description="数据集名称")
    model: str = Field(..., description="评估使用的模型")
    prompt_name: str = Field(..., description="评估使用的 prompt 名称")


class CompareRunsRequest(BaseModel):
    """对比评估运行请求。"""

    run_ids: list[str] = Field(..., description="要对比的运行 ID 列表")


# ---------------------------------------------------------------------------
# 数据集端点
# ---------------------------------------------------------------------------


@router.get("/datasets")
async def list_datasets() -> dict[str, Any]:
    """列出所有评估数据集。"""
    datasets = eval_service.list_datasets()
    return {"code": 0, "message": "success", "data": datasets}


@router.post("/datasets", status_code=201)
async def create_dataset(req: CreateDatasetRequest) -> dict[str, Any]:
    """创建评估数据集。"""
    try:
        result = eval_service.create_dataset(
            name=req.name,
            items=req.items,
            description=req.description,
        )
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/datasets/{name}")
async def get_dataset(name: str) -> dict[str, Any]:
    """获取数据集详情。"""
    dataset = eval_service.get_dataset(name)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集不存在: {name}")
    return {"code": 0, "message": "success", "data": dataset}


@router.delete("/datasets/{name}")
async def delete_dataset(name: str) -> dict[str, Any]:
    """删除数据集。"""
    ok = eval_service.delete_dataset(name)
    if not ok:
        raise HTTPException(status_code=404, detail=f"数据集不存在: {name}")
    return {"code": 0, "message": "success", "data": {"deleted": True}}


# ---------------------------------------------------------------------------
# 评估运行端点
# ---------------------------------------------------------------------------


@router.post("/runs", status_code=201)
async def create_eval_run(req: RunEvalRequest) -> dict[str, Any]:
    """创建评估运行(对数据集中的每个 item 执行 LLM 调用)。"""
    try:
        # 使用 stub LLM 完成函数(仅返回输入内容,后续可替换为真实 LLM)
        async def _stub_llm(messages: list[dict[str, Any]], tools: Any = None) -> dict[str, Any]:
            content = messages[-1].get("content", "") if messages else ""
            return {"content": f"stub response for: {content[:50]}", "tool_calls": None}

        run = await eval_service.run_eval(
            dataset_name=req.dataset_name,
            model=req.model,
            prompt_name=req.prompt_name,
            llm_complete_fn=_stub_llm,
        )
        return {
            "code": 0,
            "message": "success",
            "data": {
                "id": run.id,
                "dataset_name": run.dataset_name,
                "model": run.model,
                "prompt_name": run.prompt_name,
                "avg_score": run.avg_score,
                "total_duration_ms": run.total_duration_ms,
                "created_at": run.created_at,
                "results": [
                    {
                        "input": r.input,
                        "expected_output": r.expected_output,
                        "actual_output": r.actual_output,
                        "score": r.score,
                        "duration_ms": r.duration_ms,
                        "error": r.error,
                    }
                    for r in run.results
                ],
            },
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/runs")
async def list_eval_runs() -> dict[str, Any]:
    """列出所有评估运行。"""
    runs = eval_service.list_runs()
    return {"code": 0, "message": "success", "data": runs}


@router.get("/runs/{run_id}")
async def get_eval_run(run_id: str) -> dict[str, Any]:
    """获取评估运行详情。"""
    run = eval_service.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"评估运行不存在: {run_id}")
    return {
        "code": 0,
        "message": "success",
        "data": {
            "id": run.id,
            "dataset_name": run.dataset_name,
            "model": run.model,
            "prompt_name": run.prompt_name,
            "avg_score": run.avg_score,
            "total_duration_ms": run.total_duration_ms,
            "created_at": run.created_at,
            "results": [
                {
                    "input": r.input,
                    "expected_output": r.expected_output,
                    "actual_output": r.actual_output,
                    "score": r.score,
                    "duration_ms": r.duration_ms,
                    "error": r.error,
                }
                for r in run.results
            ],
        },
    }


@router.post("/compare")
async def compare_eval_runs(req: CompareRunsRequest) -> dict[str, Any]:
    """对比多次评估运行的结果。"""
    result = eval_service.compare_runs(req.run_ids)
    return {"code": 0, "message": "success", "data": result}