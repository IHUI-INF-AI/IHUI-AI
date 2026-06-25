"""Coze Bot chat routes."""


import httpx
from fastapi import APIRouter, Depends, Query

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.post("/send", summary="Send message to bot")
async def chat_with_bot(
    bot_id: str = Query(...),
    message: str = Query(...),
    conversation_id: str = Query(None),
    user_uuid: str = Depends(require_login),
):
    headers = {
        "Authorization": f"Bearer {settings.COZE_PRIVATE_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "bot_id": bot_id,
        "user_id": user_uuid,
        "additional_messages": [{"role": "user", "content": message}],
    }
    if conversation_id:
        body["conversation_id"] = conversation_id
    url = f"{settings.COZE_API_BASE}/v3/chat"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, headers=headers, json=body, timeout=30)
            data = resp.json()
            return success(data)
        except Exception as e:
            return error(f"Chat error: {e}")


@router.get("/conversations", summary="List conversations")
async def list_conversations(
    bot_id: str = Query(...),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    from app.utils.coze_compat import CozeClient

    async with CozeClient() as client:
        data = await client.list_conversations(
            bot_id=bot_id,
            user_id=user_uuid,
            page=page,
            size=size,
        )
        if data.get("code") == 0:
            return success(data.get("data", []))
        return error(data.get("msg", "Failed to list conversations"))


@router.post("/messages", summary="消息列表")
async def list_messages(
    conversation_id: str = Query(...),
    bot_id: str = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """获取指定会话的消息列表."""
    from app.utils.coze_compat import CozeClient

    try:
        async with CozeClient() as client:
            data = await client.list_messages(
                conversation_id=conversation_id,
                page=page,
                size=size,
                bot_id=bot_id or "",
            )
            if data.get("code") == 0:
                return success(data.get("data", []))
            return error(data.get("msg", "Failed to list messages"))
    except Exception as e:
        return error(f"List messages error: {e}")


@router.post("/messages/feedback", summary="消息反馈")
async def message_feedback(
    message_id: str = Query(...),
    conversation_id: str = Query(...),
    feedback_type: str = Query(..., description="like / dislike"),
    content: str = Query("", description="反馈内容"),
    user_uuid: str = Depends(require_login),
):
    """对消息进行点赞/踩反馈."""
    from app.utils.coze_compat import CozeClient

    try:
        async with CozeClient() as client:
            data = await client.message_feedback(
                message_id=message_id,
                conversation_id=conversation_id,
                feedback_type=feedback_type,
                content=content,
            )
            if data.get("code") == 0:
                return success(data.get("data"))
            return error(data.get("msg", "Feedback failed"))
    except Exception as e:
        return error(f"Feedback error: {e}")


@router.post("/retrieve", summary="检索会话")
async def retrieve_conversation(
    conversation_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """检索指定会话详情."""
    from app.utils.coze_compat import CozeClient

    try:
        async with CozeClient() as client:
            data = await client.retrieve_conversation(conversation_id=conversation_id)
            if data.get("code") == 0:
                return success(data.get("data"))
            return error(data.get("msg", "Retrieve failed"))
    except Exception as e:
        return error(f"Retrieve error: {e}")
