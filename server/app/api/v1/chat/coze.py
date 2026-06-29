"""Coze chat routes (sync + streaming + workflow)."""

import json
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Query, UploadFile
from fastapi import File as FastAPIFile
from fastapi.responses import StreamingResponse
from loguru import logger

from app.config import settings
from app.core.tracking import (
    EVENT_CHAT_RECEIVE,
    EVENT_CHAT_SEND,
    track_event,
    track_funnel,
)
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_service import deduct_user_token

router = APIRouter()


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.COZE_PRIVATE_KEY}",
        "Content-Type": "application/json",
    }


@router.post("/message", summary="Send chat message via Coze (sync)")
async def send_message(
    bot_id: str = Query(...),
    message: str = Query(...),
    conversation_id: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="coze", bot_id=bot_id)
    track_funnel("chat", "send", user_id=user_uuid, channel="coze")
    body = {
        "bot_id": bot_id,
        "user_id": user_uuid,
        "additional_messages": [{"role": "user", "content": message, "content_type": "text"}],
    }
    if conversation_id:
        body["conversation_id"] = conversation_id
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v3/chat",
                headers=_headers(),
                json=body,
                timeout=30,
            )
            track_event(EVENT_CHAT_RECEIVE, user_id=user_uuid, channel="coze", bot_id=bot_id)
            track_funnel("chat", "receive", user_id=user_uuid, channel="coze")
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze chat error: {e}")
            track_event("chat_error", user_id=user_uuid, channel="coze", reason=str(e)[:120])
            return error(f"Chat error: {e}")


@router.post("/message/stream", summary="Send chat message via Coze (SSE stream)")
async def send_message_stream(
    bot_id: str = Query(...),
    message: str = Query(...),
    conversation_id: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    """流式聊天:通过 SSE 把 Coze 增量事件转发给前端."""

    async def event_generator():
        body = {
            "bot_id": bot_id,
            "user_id": user_uuid,
            "additional_messages": [{"role": "user", "content": message, "content_type": "text"}],
            "stream": True,
        }
        if conversation_id:
            body["conversation_id"] = conversation_id
        try:
            async with httpx.AsyncClient() as client, client.stream(
                "POST",
                f"{settings.COZE_API_BASE}/v3/chat",
                headers=_headers(),
                json=body,
                timeout=60,
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    yield f"data: {line}\n\n"
        except Exception as e:
            logger.error(f"Coze stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/conversation/create", summary="Create Coze conversation")
async def create_conversation(
    bot_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v1/conversation/create",
                headers=_headers(),
                json={"bot_id": bot_id, "user_id": user_uuid},
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze conversation create error: {e}")
            return error(str(e))


@router.post("/workflow/run", summary="Run Coze workflow (sync)")
async def run_workflow(
    workflow_id: str = Query(...),
    parameters: str = Query("{}", description="JSON 字符串"),
    user_uuid: str = Depends(require_login),
):
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="coze_workflow", workflow_id=workflow_id)
    track_funnel("chat", "send", user_id=user_uuid, channel="coze_workflow")
    try:
        params = json.loads(parameters) if parameters else {}
    except json.JSONDecodeError:
        return error("parameters 必须是合法 JSON 字符串")
    body = {"workflow_id": workflow_id, "parameters": params}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v1/workflow/run",
                headers=_headers(),
                json=body,
                timeout=60,
            )
            track_event(EVENT_CHAT_RECEIVE, user_id=user_uuid, channel="coze_workflow", workflow_id=workflow_id)
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze workflow run error: {e}")
            track_event("chat_error", user_id=user_uuid, channel="coze_workflow", reason=str(e)[:120])
            return error(str(e))


@router.post("/workflow/run/stream", summary="Run Coze workflow (stream)")
async def run_workflow_stream(
    workflow_id: str = Query(...),
    parameters: str = Query("{}"),
    user_uuid: str = Depends(require_login),
):
    try:
        params = json.loads(parameters) if parameters else {}
    except json.JSONDecodeError:
        return error("parameters 必须是合法 JSON 字符串")

    async def event_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    f"{settings.COZE_API_BASE}/v1/workflow/run",
                    headers=_headers(),
                    json={"workflow_id": workflow_id, "parameters": params},
                    timeout=120,
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        yield f"data: {line}\n\n"
            except Exception as e:
                logger.error(f"Coze workflow stream error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/workflow/run/resume", summary="Resume interrupted Coze workflow")
async def resume_workflow(
    workflow_id: str = Query(...),
    event_id: str = Query(...),
    resume_data: str = Query("{}", description="JSON string"),
    interrupt_type: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """恢复被中断的工作流."""
    body = {
        "workflow_id": workflow_id,
        "event_id": event_id,
        "resume_data": resume_data,
        "interrupt_type": interrupt_type,
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v1/workflow/run/resume",
                headers=_headers(),
                json=body,
                timeout=120,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze workflow resume error: {e}")
            return error(str(e))


@router.post("/workflow/run/resume/stream", summary="Resume interrupted Coze workflow (stream)")
async def resume_workflow_stream(
    workflow_id: str = Query(...),
    event_id: str = Query(...),
    resume_data: str = Query("{}", description="JSON string"),
    interrupt_type: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """流式恢复被中断的工作流."""

    async def event_generator():
        body = {
            "workflow_id": workflow_id,
            "event_id": event_id,
            "resume_data": resume_data,
            "interrupt_type": interrupt_type,
        }
        try:
            async with httpx.AsyncClient() as client, client.stream(
                "POST",
                f"{settings.COZE_API_BASE}/v1/workflow/run/resume",
                headers=_headers(),
                json=body,
                timeout=120,
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    yield f"data: {line}\n\n"
        except Exception as e:
            logger.error(f"Coze workflow resume stream error: {e}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/workflow/run/history", summary="Get Coze workflow run history")
async def workflow_history(
    workflow_id: str = Query(...),
    execute_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """获取工作流执行历史."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.COZE_API_BASE}/v1/workflow/run/history",
                headers=_headers(),
                params={"workflow_id": workflow_id, "execute_id": execute_id},
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze workflow history error: {e}")
            return error(str(e))


@router.post("/datasets/create", summary="Create Coze dataset")
async def create_dataset(
    name: str = Query(...),
    space_id: str = Query("", description="Workspace ID, defaults to configured account"),
    user_uuid: str = Depends(require_login),
):
    """创建数据集."""
    body = {"name": name, "space_id": space_id or settings.COZE_ACCOUNT_ID}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v1/datasets/create",
                headers=_headers(),
                json=body,
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze dataset create error: {e}")
            return error(str(e))


@router.post("/datasets/list", summary="List Coze datasets")
async def list_datasets(
    space_id: str = Query("", description="Workspace ID"),
    page: int = Query(1),
    size: int = Query(20),
    user_uuid: str = Depends(require_login),
):
    """获取数据集列表."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.COZE_API_BASE}/v1/datasets/list",
                headers=_headers(),
                params={"space_id": space_id or settings.COZE_ACCOUNT_ID, "page_index": page, "page_size": size},
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze dataset list error: {e}")
            return error(str(e))


@router.post("/documents/list", summary="List Coze dataset documents")
async def list_documents(
    dataset_id: str = Query(...),
    page: int = Query(1),
    size: int = Query(20),
    user_uuid: str = Depends(require_login),
):
    """获取数据集下的文档列表."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.COZE_API_BASE}/v1/datasets/documents/list",
                headers=_headers(),
                params={"dataset_id": dataset_id, "page_index": page, "page_size": size},
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze document list error: {e}")
            return error(str(e))


@router.post("/conversations/list", summary="List Coze conversations")
async def list_conversations(
    bot_id: str = Query(...),
    user_id: str = Query(...),
    page: int = Query(1),
    size: int = Query(20),
    user_uuid: str = Depends(require_login),
):
    """获取对话列表."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.COZE_API_BASE}/v1/conversation/list",
                headers=_headers(),
                params={"bot_id": bot_id, "user_id": user_id, "page_index": page, "page_size": size},
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze conversation list error: {e}")
            return error(str(e))


@router.post("/conversations/retrieve", summary="Retrieve Coze conversation")
async def retrieve_conversation(
    conversation_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """获取对话详情."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.COZE_API_BASE}/v1/conversation/retrieve",
                headers=_headers(),
                params={"conversation_id": conversation_id},
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze conversation retrieve error: {e}")
            return error(str(e))


@router.post("/messages/list", summary="List Coze conversation messages")
async def list_messages(
    conversation_id: str = Query(...),
    bot_id: str = Query(""),
    page: int = Query(1),
    size: int = Query(20),
    user_uuid: str = Depends(require_login),
):
    """获取对话消息列表."""
    params: dict[str, Any] = {"conversation_id": conversation_id, "page_index": page, "page_size": size}
    if bot_id:
        params["bot_id"] = bot_id
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{settings.COZE_API_BASE}/v1/conversation/message/list",
                headers=_headers(),
                params=params,
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze message list error: {e}")
            return error(str(e))


@router.post("/messages/feedback", summary="Coze message feedback")
async def message_feedback(
    message_id: str = Query(...),
    conversation_id: str = Query(...),
    feedback_type: str = Query(..., description="like / dislike"),
    content: str = Query(""),
    user_uuid: str = Depends(require_login),
):
    """消息反馈(点赞/点踩)."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v1/conversation/message/feedback",
                headers=_headers(),
                json={
                    "message_id": message_id,
                    "conversation_id": conversation_id,
                    "feedback_type": feedback_type,
                    "content": content,
                },
                timeout=15,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze message feedback error: {e}")
            return error(str(e))


@router.post("/documents/upload", summary="Upload document to Coze dataset (multipart)")
async def upload_document(
    dataset_id: str = Query(...),
    document_name: str = Query(...),
    upload: UploadFile = FastAPIFile(...),
    user_uuid: str = Depends(require_login),
):
    """上传文档到数据集(multipart/form-data)."""
    file_bytes = await upload.read()
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v1/datasets/documents/upload",
                headers={"Authorization": f"Bearer {settings.COZE_PRIVATE_KEY}"},
                data={"dataset_id": dataset_id, "document_name": document_name, "document_source": "0"},
                files={"file": (upload.filename or document_name, file_bytes)},
                timeout=60,
            )
            return success(resp.json())
        except Exception as e:
            logger.error(f"Coze document upload error: {e}")
            return error(str(e))


@router.post("/chat-with-billing", summary="Chat with token billing")
async def chat_with_billing(
    bot_id: str = Query(...),
    message: str = Query(...),
    cost_tokens: int = Query(100, description="本次聊天扣减 token 数"),
    user_uuid: str = Depends(require_login),
):
    """带计费的聊天:先扣 token,再转发到 Coze."""
    bill = deduct_user_token(user_uuid, cost_tokens, bot_id=bot_id)
    if not bill["success"]:
        return error(f"余额不足: {bill.get('reason')}")
    body = {
        "bot_id": bot_id,
        "user_id": user_uuid,
        "additional_messages": [{"role": "user", "content": message, "content_type": "text"}],
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{settings.COZE_API_BASE}/v3/chat",
                headers=_headers(),
                json=body,
                timeout=30,
            )
            return success(
                {
                    "coze_response": resp.json(),
                    "billing": {"cost": cost_tokens, "remaining": bill.get("remaining", 0)},
                }
            )
        except Exception as e:
            logger.error(f"Coze chat-with-billing error: {e}")
            return error(str(e))
