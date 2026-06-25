# Chat audio endpoints ported from P3 chat_audio.py
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/chat-audio", tags=["Coze Chat Audio"])


class SimpleAudioReq(BaseModel):
    bot_id: str
    conversation_id: str | None = None
    audio_data: str
    voice_id: str | None = None


class OneToOneAudioReq(BaseModel):
    bot_id: str
    user_id: str
    conversation_id: str | None = None
    audio_data: str
    voice_id: str | None = None


class PluginAudioReq(BaseModel):
    bot_id: str
    conversation_id: str | None = None
    plugin_id: str
    audio_data: str


@router.post("/simple")
async def simple_audio_chat(req: SimpleAudioReq):
    try:
        async with CozeClient() as coze:
            payload = {
                "bot_id": req.bot_id,
                "additional_messages": [{"role": "user", "content": req.audio_data, "content_type": "audio"}],
            }
            if req.conversation_id:
                payload["conversation_id"] = req.conversation_id
            result = await coze.chat(payload)
            return result
    except Exception as e:
        logger.error("Simple audio chat error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


async def _audio_stream_gen(coze, payload):
    try:
        async with coze.chat_stream(payload) as resp:
            async for line in resp.aiter_lines():
                if line:
                    yield "data: " + line + chr(10) + chr(10)
    except Exception as e:
        yield "data: " + json.dumps({"error": str(e)}) + chr(10) + chr(10)


@router.post("/one-to-one")
async def one_to_one_audio(req: OneToOneAudioReq):
    async with CozeClient() as coze:
        payload = {
            "bot_id": req.bot_id,
            "user_id": req.user_id,
            "additional_messages": [{"role": "user", "content": req.audio_data, "content_type": "audio"}],
            "stream": True,
        }
        if req.conversation_id:
            payload["conversation_id"] = req.conversation_id
        return StreamingResponse(_audio_stream_gen(coze, payload), media_type="text/event-stream")


@router.post("/plugin")
async def plugin_audio_chat(req: PluginAudioReq):
    try:
        async with CozeClient() as coze:
            payload = {
                "bot_id": req.bot_id,
                "plugin_id": req.plugin_id,
                "additional_messages": [{"role": "user", "content": req.audio_data, "content_type": "audio"}],
            }
            if req.conversation_id:
                payload["conversation_id"] = req.conversation_id
            result = await coze.chat(payload)
            return result
    except Exception as e:
        logger.error("Plugin audio error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
