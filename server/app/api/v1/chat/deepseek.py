"""DeepSeek 聊天代理路由."""

import json
import time

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from loguru import logger

from app.config import settings
from app.core.tracking import (
    EVENT_CHAT_RECEIVE,
    EVENT_CHAT_SEND,
    track_event,
    track_funnel,
    track_latency,
)
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }


@router.post("/chat", summary="DeepSeek 同步聊天")
async def deepseek_chat(
    model: str = Query("deepseek-chat"),
    message: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="deepseek", model=model)
    track_funnel("chat", "send", user_id=user_uuid, channel="deepseek")
    body = {
        "model": model,
        "messages": [{"role": "user", "content": message}],
        "stream": False,
    }
    url = "https://api.deepseek.com/chat/completions"
    t0 = time.perf_counter()
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, headers=_headers(), json=body, timeout=30)
            track_event(EVENT_CHAT_RECEIVE, user_id=user_uuid, channel="deepseek", model=model)
            track_funnel("chat", "receive", user_id=user_uuid, channel="deepseek")
            track_latency(EVENT_CHAT_RECEIVE, time.perf_counter() - t0, user_id=user_uuid, channel="deepseek")
            return success(resp.json())
        except Exception as e:
            logger.error(f"DeepSeek chat error: {e}")
            track_event("chat_error", user_id=user_uuid, channel="deepseek", reason=str(e)[:120])
            return error(str(e))


@router.post("/chat/stream", summary="DeepSeek 流式聊天(SSE)")
async def deepseek_chat_stream(
    model: str = Query("deepseek-chat"),
    message: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="deepseek_stream", model=model)
    track_funnel("chat", "send", user_id=user_uuid, channel="deepseek_stream")
    body = {
        "model": model,
        "messages": [{"role": "user", "content": message}],
        "stream": True,
    }
    url = "https://api.deepseek.com/chat/completions"

    async def event_generator():
        async with httpx.AsyncClient() as client:
            try:
                async with client.stream(
                    "POST",
                    url,
                    headers=_headers(),
                    json=body,
                    timeout=60,
                ) as resp:
                    track_event(EVENT_CHAT_RECEIVE, user_id=user_uuid, channel="deepseek_stream", model=model)
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        yield f"data: {line}\n\n"
            except Exception as e:
                logger.error(f"DeepSeek stream error: {e}")
                track_event("chat_error", user_id=user_uuid, channel="deepseek_stream", reason=str(e)[:120])
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
