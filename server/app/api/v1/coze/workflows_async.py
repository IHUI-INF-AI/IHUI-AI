# Async workflow endpoints ported from P3 workflows_async.py
import json
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/workflows/async", tags=["Coze Async Workflows"])


class AsyncWorkflowReq(BaseModel):
    workflow_id: str
    user_id: str
    input_data: dict[str, Any] = Field(default_factory=dict)


class AsyncWorkflowStreamReq(BaseModel):
    workflow_id: str
    user_id: str
    input_data: dict[str, Any] = Field(default_factory=dict)
    chat_id: str | None = None


@router.post("")
async def run_workflow_async(req: AsyncWorkflowReq):
    try:
        async with CozeClient() as coze:
            body = {"workflow_id": req.workflow_id, "parameters": req.input_data}
            result = await coze._request("POST", "/v1/workflow/run", json=body)
            return result
    except Exception as e:
        logger.error("Async workflow error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


async def _async_stream_gen(coze, workflow_id, parameters):
    try:
        async with coze._client.stream(
            "POST",
            coze.base + "/v1/workflow/stream_run",
            headers={"Authorization": "Bearer " + coze.base, "Content-Type": "application/json"},
            json={"workflow_id": workflow_id, "parameters": parameters},
        ) as resp:
            async for line in resp.aiter_lines():
                if line:
                    yield "data: " + line + chr(10) + chr(10)
    except Exception as e:
        yield "data: " + json.dumps({"error": str(e)}) + chr(10) + chr(10)


@router.post("/stream")
async def stream_workflow_async(req: AsyncWorkflowStreamReq):
    async with CozeClient() as coze:
        return StreamingResponse(
            _async_stream_gen(coze, req.workflow_id, req.input_data), media_type="text/event-stream"
        )


@router.post("/chat")
async def workflow_chat(req: AsyncWorkflowStreamReq):
    try:
        async with CozeClient() as coze:
            body = {"workflow_id": req.workflow_id, "parameters": req.input_data, "chat_id": req.chat_id or ""}
            result = await coze._request("POST", "/v1/workflow/run", json=body)
            return result
    except Exception as e:
        logger.error("Workflow chat error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
