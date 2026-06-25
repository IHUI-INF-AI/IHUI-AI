# Audio/voice management endpoints ported from P3 audio.py

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel

from app.utils.coze_compat import CozeClient

router = APIRouter(prefix="/audio", tags=["Coze Audio"])


class VoiceListReq(BaseModel):
    filter_type: str | None = None


class SpeechReq(BaseModel):
    input: str
    voice_id: str
    response_format: str | None = "mp3"
    speed: float | None = 1.0


class ChatAudioReq(BaseModel):
    bot_id: str
    conversation_id: str | None = None
    audio_data: str


class VoiceprintCreateReq(BaseModel):
    name: str
    description: str | None = None
    audio_data: str | None = None


class VoiceprintUpdateReq(BaseModel):
    voiceprint_id: str
    name: str | None = None
    description: str | None = None


class VoiceprintDeleteReq(BaseModel):
    voiceprint_id: str


@router.get("/voices")
async def list_voices(filter_type: str | None = None):
    try:
        async with CozeClient() as coze:
            params = {}
            if filter_type:
                params["filter_type"] = filter_type
            return await coze._request("GET", "/v1/audio/voices", params=params)
    except Exception as e:
        logger.error("List voices error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/speech")
async def create_speech(req: SpeechReq):
    try:
        async with CozeClient() as coze:
            body = {
                "input": req.input,
                "voice_id": req.voice_id,
                "response_format": req.response_format,
                "speed": req.speed,
            }
            return await coze._request("POST", "/v1/audio/speech", json=body)
    except Exception as e:
        logger.error("Create speech error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/chat-audio")
async def chat_audio(req: ChatAudioReq):
    try:
        async with CozeClient() as coze:
            payload = {
                "bot_id": req.bot_id,
                "additional_messages": [{"role": "user", "content": req.audio_data, "content_type": "audio"}],
            }
            if req.conversation_id:
                payload["conversation_id"] = req.conversation_id
            return await coze.chat(payload)
    except Exception as e:
        logger.error("Chat audio error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.get("/voiceprints")
async def list_voiceprints():
    try:
        async with CozeClient() as coze:
            return await coze._request("GET", "/v1/audio/voiceprints")
    except Exception as e:
        logger.error("List voiceprints error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/voiceprints")
async def create_voiceprint(req: VoiceprintCreateReq):
    try:
        async with CozeClient() as coze:
            body = {"name": req.name}
            if req.description:
                body["description"] = req.description
            if req.audio_data:
                body["audio_data"] = req.audio_data
            return await coze._request("POST", "/v1/audio/voiceprints", json=body)
    except Exception as e:
        logger.error("Create voiceprint error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.put("/voiceprints")
async def update_voiceprint(req: VoiceprintUpdateReq):
    try:
        async with CozeClient() as coze:
            body = {"voiceprint_id": req.voiceprint_id}
            if req.name:
                body["name"] = req.name
            if req.description:
                body["description"] = req.description
            return await coze._request("PUT", "/v1/audio/voiceprints", json=body)
    except Exception as e:
        logger.error("Update voiceprint error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.delete("/voiceprints")
async def delete_voiceprint(req: VoiceprintDeleteReq):
    try:
        async with CozeClient() as coze:
            return await coze._request("DELETE", "/v1/audio/voiceprints", json={"voiceprint_id": req.voiceprint_id})
    except Exception as e:
        logger.error("Delete voiceprint error: " + str(e))
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
