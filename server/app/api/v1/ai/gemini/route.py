"""
Gemini Chat API proxy route.

Uses Google Gemini (Generative Language) API for conversational AI,
with Luyala/yunwu.ai as an optional proxy provider.

Ported from coze_zhs_py/api/luyala_proxy.py (chat/completions endpoint)
"""

import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    save_conversation_to_db,
)
from app.utils.file_transfer import upload_file_to_server

logger = logging.getLogger(__name__)

router = APIRouter()

# Gemini API endpoints
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
# Proxy endpoint (yunwu.ai) -- used when GEMINI_USE_PROXY is true
Luyala_ENDPOINT = "http://yunwu.ai/v1/chat/completions"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: str = Field(..., description="角色: user / model")
    parts: list[dict[str, Any]] = Field(..., description="消息内容部件")


class GeminiChatRequest(BaseModel):
    """Direct Gemini API request model."""

    contents: list[ChatMessage] = Field(..., description="对话消息列表")
    model: str | None = Field("gemini-2.0-flash", description="模型名称")
    temperature: float | None = Field(None, description="温度参数 0-2")
    max_tokens: int | None = Field(None, description="最大输出token数")
    system_instruction: str | None = Field(None, description="系统提示词")


class GeminiProxyRequest(BaseModel):
    """Gemini via OpenAI-compatible proxy (yunwu.ai) request model.

    Mirrors the original luyala_proxy behavior.
    """

    prompt: str = Field(..., description="用户提示词")
    model: str | None = Field(None, description="模型名称 (proxy侧)")
    messages: list[dict[str, Any]] | None = Field(None, description="OpenAI格式消息列表")
    temperature: float | None = None
    max_tokens: int | None = None
    chat_id: str | None = Field(None, description="聊天ID")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/chat", summary="Gemini AI 对话 (直接API)")
async def gemini_chat(request: GeminiChatRequest, user_uuid: str = Depends(require_login)):
    """
    Send a chat request directly to Google Gemini API and return the response.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return error("Gemini API Key 未配置", code="500")

    model = request.model or "gemini-2.0-flash"
    url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={api_key}"

    contents = [msg.model_dump() for msg in request.contents]

    body: dict[str, Any] = {
        "contents": contents,
    }

    generation_config: dict[str, Any] = {}
    if request.temperature is not None:
        generation_config["temperature"] = request.temperature
    if request.max_tokens is not None:
        generation_config["maxOutputTokens"] = request.max_tokens
    if generation_config:
        body["generationConfig"] = generation_config

    if request.system_instruction:
        body["systemInstruction"] = {"parts": [{"text": request.system_instruction}]}

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=body)
            resp.raise_for_status()
            data = resp.json()

        # Extract text from Gemini response structure
        candidates = data.get("candidates", [])
        if not candidates:
            return error("Gemini 未返回有效结果")

        parts = candidates[0].get("content", {}).get("parts", [])
        reply_text = "".join(p.get("text", "") for p in parts)

        return success(
            {
                "reply": reply_text,
                "model": model,
                "raw": data,
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("Gemini API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"Gemini API 调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Gemini API error: %s", e)
        return error(f"Gemini 对话失败: {e}")


@router.post("/chat/completions", summary="Gemini AI 对话 (OpenAI兼容代理)")
async def gemini_proxy_chat(request: Request, user_uuid: str = Depends(require_login)):
    """
    Gemini via OpenAI-compatible proxy (yunwu.ai).
    Mirrors the original luyala_proxy.py /chat/completions endpoint.

    Accepts OpenAI-style messages and forwards to the proxy.
    Supports inline base64 image extraction and upload.
    """
    api_key = getattr(settings, "LUYALA_API_KEY", None) or settings.GEMINI_API_KEY
    if not api_key:
        return error("LUYALA_API_KEY / GEMINI_API_KEY 未配置", code="500")

    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        return error("无效的JSON请求体", code="400")

    # Extract custom fields
    payload.pop("user_uuid", None)
    chat_id = payload.pop("chat_id", None) or str(uuid.uuid4())

    # Build messages if only prompt provided
    if not payload.get("messages") and payload.get("prompt"):
        prompt_text = payload.pop("prompt")
        payload["messages"] = [{"role": "user", "content": prompt_text}]

    # Default model
    if not payload.get("model"):
        payload["model"] = "gemini-2.5-flash"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    logger.info("Gemini proxy request: model=%s, messages=%d", payload.get("model"), len(payload.get("messages", [])))

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(Luyala_ENDPOINT, headers=headers, json=payload)
            resp.raise_for_status()
            result = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error("Gemini proxy HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"Gemini代理调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Gemini proxy error: %s", e)
        return error(f"Gemini对话失败: {e}")

    # Extract reply text
    choices = result.get("choices", [])
    reply_text = ""
    if choices:
        reply_text = (choices[0].get("message") or {}).get("content", "") or ""

    # Check for inline base64 images and upload them
    uploaded_urls: list[str] = []
    import base64 as b64mod
    import re

    if reply_text and "data:image" in reply_text:
        pattern = re.compile(r"data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)")
        matches = list(pattern.finditer(reply_text))
        if matches:
            import asyncio

            upload_tasks = []
            for m in matches:
                mime, b64_data = m.groups()
                try:
                    blob = b64mod.b64decode(b64_data)
                    ext = (mime.split("/")[-1] or "png").lower()
                    filename = f"gemini_image_{uuid.uuid4().hex}.{ext}"
                    upload_tasks.append(upload_file_to_server(blob, filename))
                except Exception as e:
                    logger.warning("Failed to decode base64 image: %s", e)
                    upload_tasks.append(asyncio.sleep(0, result=None))

            urls = await asyncio.gather(*upload_tasks, return_exceptions=True)
            new_content = reply_text
            for i, m in enumerate(matches):
                if urls[i] and not isinstance(urls[i], Exception):
                    new_content = new_content.replace(m.group(0), urls[i])
                    uploaded_urls.append(urls[i])
            reply_text = new_content

    # Deduct tokens
    token_result = await calculate_and_deduct_tokens_by_cost(
        user_uuid=user_uuid,
        yuan_cost=0.5,
        service_name="Gemini对话",
        success=True,
    )
    tokens_deducted = token_result.get("tokens_deducted", 0)

    # Save conversation
    user_text = ""
    for msg in payload.get("messages", []):
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, str):
                user_text += content
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        user_text += item.get("text", "")

    agent_url = uploaded_urls[0] if uploaded_urls else ""
    try:
        await save_conversation_to_db(
            user_uuid=user_uuid,
            model_name="Gemini",
            problem=user_text[:2000],
            answer=reply_text or "",
            agent_id="Gemini",
            agent_url=agent_url,
            chat_id=chat_id,
            field1=str(tokens_deducted),
        )
    except Exception as e:
        logger.warning("Save conversation failed: %s", e)

    return success(
        {
            "reply": reply_text,
            "model": payload.get("model"),
            "uploaded_files": uploaded_urls,
            "tokens_deducted": tokens_deducted,
        }
    )
