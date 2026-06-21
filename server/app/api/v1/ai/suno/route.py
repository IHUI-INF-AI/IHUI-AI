"""
Suno Music Generation API proxy route.

Uses the Suno API (via yunwu.ai proxy) to generate music from text prompts.
Supports task creation + polling workflow.

Ported from coze_zhs_py/api/langchain_api_mini.py (suno handling)
"""

import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    save_conversation_to_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Suno uses yunwu.ai proxy endpoint (same as original project)
SUNO_API_BASE = getattr(settings, "SUNO_API_BASE", "https://api.suno.ai/v1")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class GenerateMusicRequest(BaseModel):
    prompt: str = Field(..., description="音乐描述 / 歌词提示")
    mv: str | None = Field(None, description="模型版本, e.g. v3.5, v4")
    style: str | None = Field(None, description="音乐风格, e.g. pop, rock, jazz")
    title: str | None = Field(None, description="歌曲标题")
    duration: int | None = Field(None, description="时长(秒)")
    instrumental: bool | None = Field(False, description="是否纯音乐(无人声)")


class QueryMusicRequest(BaseModel):
    task_id: str = Field(..., description="Suno任务ID")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/generate/music", summary="Suno AI 音乐生成")
async def generate_music(request: GenerateMusicRequest, user_uuid: str = Depends(require_login)):
    """
    Submit a music generation task via the Suno API.
    Returns task ID that can be polled with /query/music.

    Suno API flow (matching original langchain_api_mini.py):
    1. POST to create task -> returns task_id
    2. GET to poll task status until completed
    """
    api_key = getattr(settings, "SUNO_API_KEY", "")
    if not api_key:
        return error("Suno API Key 未配置", code="500")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    body: dict[str, Any] = {
        "prompt": request.prompt,
    }

    # Model version - from request or default
    if request.mv:
        body["mv"] = request.mv

    if request.style:
        body["style"] = request.style
    if request.title:
        body["title"] = request.title
    if request.duration:
        body["duration"] = request.duration
    if request.instrumental is not None:
        body["instrumental"] = request.instrumental

    logger.info("Suno generate request: %s", json.dumps(body, ensure_ascii=False)[:300])

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(f"{SUNO_API_BASE}/generate", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        # Suno API typically returns {"code": "success", "data": "<task_id>"}
        task_id = None
        if isinstance(data, dict):
            if data.get("code") == "success" and isinstance(data.get("data"), str):
                task_id = data["data"]
            else:
                task_id = data.get("id") or data.get("task_id") or data.get("data")

        if not task_id:
            logger.warning("Suno returned no task_id: %s", data)
            return error(f"Suno未返回任务ID: {json.dumps(data, ensure_ascii=False)[:200]}")

        # Deduct tokens
        deduct_result = await calculate_and_deduct_tokens_by_cost(
            user_uuid=user_uuid,
            yuan_cost=0.5,
            service_name="Suno音乐生成",
            success=True,
        )
        tokens_deducted = deduct_result.get("tokens_deducted", 0)

        # Save conversation
        await save_conversation_to_db(
            user_uuid=user_uuid,
            model_name="Suno",
            problem=request.prompt,
            answer=f"任务已提交: {task_id}",
            agent_id=str(task_id),
            field1=str(tokens_deducted),
        )

        return success(
            {
                "task_id": str(task_id),
                "tokens_deducted": tokens_deducted,
            },
            msg="音乐生成任务已提交",
        )

    except httpx.HTTPStatusError as e:
        logger.error("Suno API HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"Suno API 调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Suno API error: %s", e)
        return error(f"音乐生成失败: {e}")


@router.get("/query/music/{task_id}", summary="查询Suno音乐任务状态")
async def query_music(task_id: str, user_uuid: str = Depends(require_login)):
    """
    Poll the status of a Suno music generation task.

    Returns the music URLs when completed.
    """
    api_key = getattr(settings, "SUNO_API_KEY", "")
    if not api_key:
        return error("Suno API Key 未配置", code="500")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                f"{SUNO_API_BASE}/query",
                params={"id": task_id},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()

        return success(data)

    except httpx.HTTPStatusError as e:
        logger.error("Suno query HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"Suno API 查询失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Suno query error: %s", e)
        return error(f"查询音乐任务失败: {e}")
