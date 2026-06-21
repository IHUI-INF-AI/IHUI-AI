"""
Bailian (Alibaba Cloud DashScope Application) Chat API proxy route.

Uses the DashScope Application API for Bailian application conversations.
Supports both HTTP non-streaming and WebSocket streaming modes.

Ported from coze_zhs_py/api/bailian_app_ws.py
"""

import contextlib
import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login

logger = logging.getLogger(__name__)

router = APIRouter()

BAILIAN_API_BASE = "https://dashscope.aliyuncs.com/api/v1"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class BailianChatRequest(BaseModel):
    prompt: str = Field(..., description="用户输入")
    app_id: str | None = Field(None, description="百炼应用ID, 默认从配置读取")
    session_id: str | None = Field(None, description="会话ID, 用于多轮对话")
    stream: bool | None = Field(False, description="是否流式返回")


# ---------------------------------------------------------------------------
# DashScope Application call helper
# ---------------------------------------------------------------------------


async def _call_bailian_http(
    prompt: str,
    app_id: str,
    api_key: str,
    session_id: str | None = None,
    stream: bool = False,
) -> dict[str, Any]:
    """Call Bailian application via HTTP REST API."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body: dict[str, Any] = {
        "model": app_id,
        "input": {
            "prompt": prompt,
        },
        "parameters": {
            "incremental_output": True,
        },
    }

    if session_id:
        body["input"]["session_id"] = session_id

    if stream:
        body["stream"] = True
        headers["X-DashScope-SSE"] = "enable"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{BAILIAN_API_BASE}/services/aigc/text-generation/generation",
            headers=headers,
            json=body,
        )
        resp.raise_for_status()

        if stream:
            # Return SSE lines
            chunks = []
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw:
                    continue
                try:
                    obj = json.loads(raw)
                    output = obj.get("output", {})
                    text_chunk = output.get("text", "")
                    if text_chunk:
                        chunks.append(text_chunk)
                except json.JSONDecodeError:
                    chunks.append(raw)

            return {
                "text": "".join(chunks),
                "session_id": session_id,
                "chunks": chunks,
            }
        else:
            data = resp.json()
            output = data.get("output", {})
            return {
                "text": output.get("text", ""),
                "session_id": output.get("session_id") or session_id,
                "usage": data.get("usage", {}),
                "request_id": data.get("request_id", ""),
            }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/chat", summary="百炼应用对话")
async def bailian_chat(request: BailianChatRequest, user_uuid: str = Depends(require_login)):
    """
    Send a chat request to a Bailian (DashScope) application via HTTP.
    """
    api_key = settings.DASHSCOPE_API_KEY
    if not api_key:
        return error("DashScope API Key 未配置", code="500")

    app_id = request.app_id or settings.BAILIAN_APP_ID
    if not app_id:
        return error("百炼应用ID 未配置", code="400")

    try:
        result = await _call_bailian_http(
            prompt=request.prompt,
            app_id=app_id,
            api_key=api_key,
            session_id=request.session_id,
            stream=request.stream or False,
        )

        return success(
            {
                "reply": result.get("text", ""),
                "session_id": result.get("session_id"),
                "app_id": app_id,
                "usage": result.get("usage", {}),
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("Bailian API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"百炼API调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Bailian API error: %s", e)
        return error(f"百炼对话失败: {e}")


@router.websocket("/ws")
async def bailian_app_ws(websocket: WebSocket):
    """
    WebSocket streaming endpoint for Bailian application.
    Accepts JSON with {app_id, prompt} and streams back response chunks.

    Ported from coze_zhs_py/api/bailian_app_ws.py
    """
    await websocket.accept()
    try:
        # Receive and validate request
        json_data = await websocket.receive_json()

        app_id = json_data.get("app_id") or settings.BAILIAN_APP_ID
        prompt = json_data.get("prompt", "")
        session_id = json_data.get("session_id")

        if not app_id:
            await websocket.send_json({"event": "error", "message": "缺少 app_id 参数"})
            return
        if not prompt:
            await websocket.send_json({"event": "error", "message": "缺少 prompt 参数"})
            return

        api_key = settings.DASHSCOPE_API_KEY
        if not api_key:
            await websocket.send_json({"event": "error", "message": "DashScope API Key 未配置"})
            return

        logger.info("Bailian WS request: app_id=%s", app_id)

        # Call Bailian with stream=True
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "X-DashScope-SSE": "enable",
        }

        body: dict[str, Any] = {
            "model": app_id,
            "input": {
                "prompt": prompt,
            },
            "parameters": {
                "incremental_output": True,
            },
            "stream": True,
        }
        if session_id:
            body["input"]["session_id"] = session_id

        full_text = ""
        async with httpx.AsyncClient(timeout=120) as client, client.stream(
            "POST",
            f"{BAILIAN_API_BASE}/services/aigc/text-generation/generation",
            headers=headers,
            json=body,
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw:
                    continue
                try:
                    obj = json.loads(raw)
                    output = obj.get("output", {})
                    _ = output.get("finish_reason", "")

                    if "text" in output:
                        chunk = output["text"]
                        full_text += chunk
                        await websocket.send_json(
                            {
                                "event": "chunk",
                                "data": chunk,
                            }
                        )

                    # Check for session_id in output
                    if output.get("session_id"):
                        session_id = output["session_id"]

                    # Check for errors
                    if output.get("finish_reason") == "error":
                        error_msg = output.get("text", "未知错误")
                        await websocket.send_json(
                            {
                                "event": "error",
                                "message": error_msg,
                            }
                        )
                        return

                except json.JSONDecodeError:
                    # Some lines may be status messages
                    pass

        await websocket.send_json(
            {
                "event": "completed",
                "message": "流式响应完成",
                "full_text": full_text,
                "session_id": session_id,
            }
        )

    except WebSocketDisconnect:
        logger.info("Bailian WebSocket disconnected")
    except Exception as e:
        logger.error("Bailian WS error: %s", e)
        with contextlib.suppress(Exception):
            await websocket.send_json({"event": "error", "message": str(e)})
    finally:
        try:
            await websocket.close()
        except Exception:
            logger.debug("func")
            pass
