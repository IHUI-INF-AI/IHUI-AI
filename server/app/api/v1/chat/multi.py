"""多 AI 厂商统一聊天网关.

支持厂商:
  - zhipu      智谱 GLM-4
  - openrouter OpenRouter 聚合(Claude/GPT/Llama 等)
  - luyala     鹿雅拉语音/对话
  - n8n        N8N 工作流触发
  - bailian    阿里云百炼
  - langchain  LangChain 链式调用
  - coze_workflow  Coze 工作流
"""

import json
import time
from typing import Any

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


# ---------------------------------------------------------------------------
# 厂商端点配置
# ---------------------------------------------------------------------------

VENDOR_ENDPOINTS: dict[str, dict] = {
    "zhipu": {
        "base": "https://open.bigmodel.cn/api/paas/v4",
        "chat_path": "/chat/completions",
        "auth_header": lambda: {"Authorization": f"Bearer {settings.ZHIPU_API_KEY}"},
    },
    "openrouter": {
        "base": "https://openrouter.ai/api/v1",
        "chat_path": "/chat/completions",
        "auth_header": lambda: {"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
    },
    "luyala": {
        "base": "https://api.luyala.cn/v1",
        "chat_path": "/chat/completions",
        "auth_header": lambda: {"Authorization": f"Bearer {settings.LUYALA_API_KEY}"},
    },
    "bailian": {
        "base": "https://dashscope.aliyuncs.com/api/v1",
        "chat_path": "/services/aigc/text-generation/generation",
        "auth_header": lambda: {"Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}"},
    },
    "n8n": {
        "base": settings.N8N_BASE_URL,
        "chat_path": settings.N8N_WEBHOOK_PATH,
        "auth_header": lambda: {"X-N8N-API-KEY": settings.N8N_API_KEY} if settings.N8N_API_KEY else {},
    },
    "coze_workflow": {
        "base": settings.COZE_API_BASE,
        "chat_path": "/v1/workflow/run",
        "auth_header": lambda: {"Authorization": f"Bearer {settings.COZE_PRIVATE_KEY}"},
    },
    "langchain": {
        "base": settings.LANGCHAIN_BASE_URL,
        "chat_path": "/chat",
        "auth_header": lambda: {"Authorization": f"Bearer {settings.LANGCHAIN_API_KEY}"},
    },
}


def _build_payload(vendor: str, model: str, message: str) -> dict:
    """构造各厂商的请求体."""
    if vendor == "bailian":
        return {
            "model": model,
            "input": {"messages": [{"role": "user", "content": message}]},
            "parameters": {"result_format": "message"},
        }
    if vendor == "coze_workflow":
        return {"workflow_id": model, "parameters": {"query": message}}
    if vendor == "n8n":
        return {"query": message, "model": model}
    if vendor == "langchain":
        return {"model": model, "input": message}
    return {
        "model": model,
        "messages": [{"role": "user", "content": message}],
    }


@router.get("/vendors", summary="列出支持的 AI 厂商")
async def list_vendors(user_uuid: str = Depends(require_login)):
    return success({"vendors": list(VENDOR_ENDPOINTS.keys())})


@router.post("/{vendor}/chat", summary="多厂商同步聊天")
async def vendor_chat(
    vendor: str,
    model: str = Query(...),
    message: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, vendor=vendor, model=model)
    track_funnel("chat", "send", user_id=user_uuid, vendor=vendor)
    cfg = VENDOR_ENDPOINTS.get(vendor)
    if not cfg:
        track_event("chat_error", user_id=user_uuid, vendor=vendor, reason="unsupported_vendor")
        return error(f"不支持的厂商: {vendor}")
    url = cfg["base"] + cfg["chat_path"]
    headers = cfg["auth_header"]()
    headers["Content-Type"] = "application/json"
    body = _build_payload(vendor, model, message)
    t0 = time.perf_counter()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, headers=headers, json=body)
            track_event(EVENT_CHAT_RECEIVE, user_id=user_uuid, vendor=vendor, model=model)
            track_funnel("chat", "receive", user_id=user_uuid, vendor=vendor)
            track_latency(EVENT_CHAT_RECEIVE, time.perf_counter() - t0, user_id=user_uuid, vendor=vendor)
            return success(resp.json())
        except Exception as e:
            logger.error(f"{vendor} chat error: {e}")
            track_event("chat_error", user_id=user_uuid, vendor=vendor, reason=str(e)[:120])
            return error(str(e))


@router.post("/{vendor}/chat/stream", summary="多厂商流式聊天(SSE)")
async def vendor_chat_stream(
    vendor: str,
    model: str = Query(...),
    message: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    cfg = VENDOR_ENDPOINTS.get(vendor)
    if not cfg:
        return error(f"不支持的厂商: {vendor}")
    url = cfg["base"] + cfg["chat_path"]
    headers = cfg["auth_header"]()
    headers["Content-Type"] = "application/json"
    body = _build_payload(vendor, model, message)
    if vendor not in ("coze_workflow", "n8n"):
        body["stream"] = True

    async def event_generator():
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                async with client.stream("POST", url, headers=headers, json=body) as resp:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        yield f"data: {line}\n\n"
            except Exception as e:
                logger.error(f"{vendor} stream error: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/multi", summary="同时调用多个厂商并返回结果列表(用于对比评测)")
async def multi_vendor_chat(
    vendors: str = Query(..., description="逗号分隔的厂商列表,如 zhipu,openrouter"),
    model: str = Query("gpt-3.5-turbo"),
    message: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    vendor_list = [v.strip() for v in vendors.split(",") if v.strip()]
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, vendor="multi", vendors=",".join(vendor_list), model=model)
    track_funnel("chat", "send_multi", user_id=user_uuid, count=len(vendor_list))
    async with httpx.AsyncClient(timeout=30) as client:
        results: list[dict[str, Any]] = []
        for v in vendor_list:
            cfg = VENDOR_ENDPOINTS.get(v)
            if not cfg:
                results.append({"vendor": v, "error": "unsupported"})
                continue
            url = cfg["base"] + cfg["chat_path"]
            headers = cfg["auth_header"]()
            headers["Content-Type"] = "application/json"
            body = _build_payload(v, model, message)
            t0 = time.perf_counter()
            try:
                resp = await client.post(url, headers=headers, json=body)
                track_event(EVENT_CHAT_RECEIVE, user_id=user_uuid, vendor=v, model=model)
                track_latency(EVENT_CHAT_RECEIVE, time.perf_counter() - t0, user_id=user_uuid, vendor=v)
                results.append({"vendor": v, "ok": True, "data": resp.json()})
            except Exception as e:
                track_event("chat_error", user_id=user_uuid, vendor=v, reason=str(e)[:120])
                results.append({"vendor": v, "ok": False, "error": str(e)})
    return success({"results": results})
