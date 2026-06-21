# Coze workflow endpoints ported from P3 coze_workflow.py + workflows.py
import json
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import text

from app.database import get_session
from app.utils.ai_helpers import bearer_headers
from app.utils.coze_compat import CozeClient, get_coze_jwt_access_token

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
            body = {"workflow_id": req.workflow_id, "parameters": req.parameters or {}}
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
    try:
        with get_session() as db:
            result = db.execute(text("SELECT id, source, type FROM zhs_ai_model_info WHERE is_del = 0"))
            models = [{"id": r[0], "model_name": r[1], "type": r[2]} for r in result.fetchall()]
        access_token = await get_coze_jwt_access_token()
        url = "https://api.coze.cn/v1/workflow/run"
        payload = {
            "workflow_id": "7575433446743375907",
            "parameters": {"input": models, "content": req.content},
        }
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                url,
                headers=bearer_headers(access_token),
                json=payload,
            )
        if resp.status_code == 200:
            data = resp.json()
            output = data.get("data", "")
            if isinstance(output, str):
                try:
                    inner = json.loads(output)
                    if isinstance(inner, dict):
                        output = inner.get("output", output)
                except Exception:
                    logger.warning("Caught unexpected exception")
            return {"success": True, "data": output}
        return {"success": False, "error": "Status: " + str(resp.status_code)}
    except Exception as e:
        logger.error("Search model workflow error: " + str(e))
        return {"success": False, "error": str(e)}
