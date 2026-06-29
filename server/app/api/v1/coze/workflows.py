# Coze workflow endpoints ported from P3 coze_workflow.py + workflows.py
import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient
from app.utils.coze_workflow import run_model_search_workflow

router = APIRouter(prefix="/workflows", tags=["Coze Workflows"])


class WorkflowRunReq(BaseModel):
    workflow_id: str
    parameters: dict[str, Any] | None = None
    is_async: bool = False


class WorkflowRunHistoryReq(BaseModel):
    workflow_id: str
    execute_id: str


class WorkflowNodeExecuteReq(BaseModel):
    workflow_id: str
    execute_id: str
    node_execute_uuid: str


class WorkflowResumeReq(BaseModel):
    workflow_id: str
    event_id: str
    resume_data: str
    interrupt_type: str


class ModelSearchReq(BaseModel):
    user_uuid: str
    content: str


@router.post("/runs")
async def create_workflow_run(req: WorkflowRunReq):
    try:
        async with CozeClient() as coze:
            body: dict[str, Any] = {"workflow_id": req.workflow_id, "parameters": req.parameters or {}}
            if req.is_async:
                body["is_async"] = True
            return await coze._request("POST", "/v1/workflow/run", json=body)
    except Exception as e:
        logger.error("Workflow run error: " + str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _workflow_stream_gen(coze, workflow_id, parameters=None):
    try:
        async with coze.chat_stream({"workflow_id": workflow_id, "parameters": parameters or {}}) as resp:
            async for line in resp.aiter_lines():
                if line:
                    yield "data: " + line + chr(10) + chr(10)
    except Exception as e:
        yield "data: " + json.dumps({"error": str(e)}) + chr(10) + chr(10)


@router.post("/runs/stream")
async def stream_workflow(req: WorkflowRunReq):
    async with CozeClient() as coze:
        return StreamingResponse(
            _workflow_stream_gen(coze, req.workflow_id, req.parameters),
            media_type="text/event-stream",
        )


@router.post("/runs/resume")
async def resume_workflow(req: WorkflowResumeReq):
    params = {
        "event_id": req.event_id,
        "resume_data": req.resume_data,
        "interrupt_type": req.interrupt_type,
    }
    async with CozeClient() as coze:
        return StreamingResponse(
            _workflow_stream_gen(coze, req.workflow_id, params),
            media_type="text/event-stream",
        )


@router.post("/runs/history")
async def get_run_history(req: WorkflowRunHistoryReq):
    try:
        async with CozeClient() as coze:
            return await coze._request(
                "GET",
                "/v1/workflow/run_histories",
                params={"workflow_id": req.workflow_id, "execute_id": req.execute_id},
            )
    except Exception as e:
        logger.error("Workflow history error: " + str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/runs/execute-nodes")
async def get_node_history(req: WorkflowNodeExecuteReq):
    try:
        async with CozeClient() as coze:
            return await coze._request(
                "GET",
                "/v1/workflow/run_histories/execute_nodes",
                params={
                    "workflow_id": req.workflow_id,
                    "execute_id": req.execute_id,
                    "node_execute_uuid": req.node_execute_uuid,
                },
            )
    except Exception as e:
        logger.error("Node history error: " + str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/search/model/workflow/run")
async def search_model_workflow(req: ModelSearchReq):
    """运行 Coze 模型搜索工作流.

    委托 app.utils.coze_workflow.run_model_search_workflow 执行:
    查询 zhs_ai_model_info 模型列表 -> 获取 Coze 访问令牌 -> 调用工作流 ->
    解包嵌套 data.data.output. 保留原有请求/响应模型与错误处理.
    """
    try:
        if not req.content:
            return {"success": False, "error": "content 不能为空"}
        return await run_model_search_workflow(req.content)
    except Exception as e:
        logger.error("Search model workflow error: " + str(e))
        return {"success": False, "error": str(e)}
