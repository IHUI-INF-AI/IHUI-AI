
from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/conversations", tags=["Coze Conversations"])


class ListConvReq(BaseModel):
    bot_id: str
    user_id: str
    limit: int | None = 10
    offset: int | None = 0


class ListMsgReq(BaseModel):
    conversation_id: str
    limit: int | None = 10
    offset: int | None = 0


class FeedbackReq(BaseModel):
    message_id: str
    conversation_id: str
    feedback_type: str
    content: str | None = ""


class RetrieveReq(BaseModel):
    conversation_id: str


@router.post("")
async def list_conversations(req: ListConvReq):
    try:
        async with CozeClient() as coze:
            return await coze.list_conversations(req.bot_id, req.user_id, req.offset, req.limit)
    except Exception as e:
        logger.error("List conversations error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/messages")
async def list_messages(req: ListMsgReq):
    try:
        async with CozeClient() as coze:
            return await coze.list_messages(req.conversation_id, req.offset, req.limit)
    except Exception as e:
        logger.error("List messages error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/messages/feedback")
async def create_feedback(req: FeedbackReq):
    try:
        async with CozeClient() as coze:
            return await coze.message_feedback(
                req.message_id, req.conversation_id, req.feedback_type, req.content or ""
            )
    except Exception as e:
        logger.error("Feedback error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/retrieve")
async def retrieve_conversation(req: RetrieveReq):
    try:
        async with CozeClient() as coze:
            return await coze.retrieve_conversation(req.conversation_id)
    except Exception as e:
        logger.error("Retrieve conversation error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
