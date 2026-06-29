"""
Sora 2 Video Generation API proxy route.

Provides endpoints for submitting video generation tasks and querying
their status. Uses yunwu.ai / Luyala proxy as the upstream provider.

Ported from coze_zhs_py/api/luyala_proxy.py (video/create endpoint)
"""

import asyncio
import json
import logging
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Path
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

# Upstream video generation endpoint (yunwu.ai proxy for Sora2/Veo)
SORA2_CREATE_URL = getattr(settings, "SORA2_CREATE_URL", "http://yunwu.ai/v1/video/create")
SORA2_QUERY_URL = getattr(settings, "SORA2_QUERY_URL", "http://yunwu.ai/v1/video/query")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class GenerateVideoRequest(BaseModel):
    prompt: str = Field(..., description="视频描述提示")
    images: list[str] | None = Field(None, description="参考图片URL列表 (图生视频)")
    model: str | None = Field("veo3.1", description="模型名称")
    aspect_ratio: str | None = Field("9:16", description="宽高比")
    enhance_prompt: bool | None = Field(True, description="是否增强提示词")
    enable_upsample: bool | None = Field(True, description="是否启用上采样")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/generate/video", summary="Sora2/Veo AI 视频生成")
async def generate_video(request: GenerateVideoRequest, user_uuid: str = Depends(require_login)):
    """
    Submit a video generation task via the yunwu.ai proxy.

    Flow (matching original luyala_proxy.py):
    1. POST to create video task -> returns task id
    2. Sync poll for up to 5 minutes (30 x 10s)
    3. If not done, return pending + continue background poll for 10 minutes
    """
    api_key = getattr(settings, "LUYALA_API_KEY", "")
    if not api_key:
        return error("LUYALA API Key 未配置", code="500")

    headers = {
        "Accept": "application/json",
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    upstream_body: dict[str, Any] = {
        "model": request.model or "veo3.1",
        "prompt": request.prompt,
        "aspect_ratio": request.aspect_ratio or "9:16",
        "enhance_prompt": request.enhance_prompt if request.enhance_prompt is not None else True,
        "enable_upsample": request.enable_upsample if request.enable_upsample is not None else True,
    }
    if request.images:
        upstream_body["images"] = request.images

    logger.info("Sora2 video create request: %s", json.dumps(upstream_body, ensure_ascii=False)[:300])

    # Step 1: Create task
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(SORA2_CREATE_URL, headers=headers, json=upstream_body)
            resp.raise_for_status()
            create_data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.error("Sora2 create HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"创建视频任务失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Sora2 create error: %s", e)
        return error(f"创建视频任务失败: {e}")

    task_id = create_data.get("id")
    if resp.status_code != 200 or not task_id:
        logger.error("Sora2 create failed: status=%s, data=%s", resp.status_code, create_data)
        return error(f"创建视频任务失败: {json.dumps(create_data, ensure_ascii=False)[:200]}")

    logger.info("Sora2 task created: %s", task_id)

    # Step 2: Sync polling (up to 5 minutes, every 10 seconds)
    max_sync_checks = 30
    poll_interval = 10

    async with httpx.AsyncClient(timeout=60) as client:
        for _ in range(max_sync_checks):
            try:
                r = await client.get(SORA2_QUERY_URL, params={"id": task_id}, headers=headers)
                data = r.json()
            except Exception:
                await asyncio.sleep(poll_interval)
                continue

            status = (data.get("status") or (data.get("detail") or {}).get("status") or "").lower()
            final_url = data.get("video_url") or (data.get("detail") or {}).get("video_url")

            if status == "completed":
                if isinstance(final_url, str) and final_url.startswith("http"):
                    # Persist video to our file server
                    persisted_url = await upload_file_to_server(final_url, f"sora2_video_{uuid.uuid4().hex}.mp4")
                    final_url = persisted_url or final_url

                    # Analyze video ratio from URL hints
                    video_ratio = "unknown"
                    for ratio in ("16:9", "9:16", "1:1"):
                        if ratio in str(final_url):
                            video_ratio = ratio
                            break

                    # Deduct tokens (1.5 yuan)
                    deduct_result = await calculate_and_deduct_tokens_by_cost(
                        user_uuid=user_uuid,
                        yuan_cost=1.5,
                        service_name="Sora2视频生成",
                        success=True,
                    )
                    tokens_deducted = deduct_result.get("tokens_deducted", 0)

                    # Save conversation
                    await save_conversation_to_db(
                        user_uuid=user_uuid,
                        model_name="sora2",
                        problem=request.prompt,
                        answer=str(final_url),
                        agent_id=str(task_id),
                        agent_url=str(final_url),
                        field1=str(tokens_deducted),
                        video_ratio=video_ratio,
                    )

                    return success(
                        {
                            "video_url": final_url,
                            "video_ratio": video_ratio,
                            "tokens_deducted": tokens_deducted,
                        },
                        msg="视频生成完成",
                    )

                # Completed but no URL
                return error("任务完成但未获取到有效视频URL")

            if status in ("failed", "error"):
                error_msg = data.get("error") or data.get("detail", {}).get("error", "未知错误")
                return error(f"视频生成失败: {error_msg}")

            await asyncio.sleep(poll_interval)

    # Step 3: Still not done after 5 min -> schedule background poll
    async def _background_follow_up():
        """Continue polling in background for up to 10 more minutes."""
        extra_checks = 60
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                for _ in range(extra_checks):
                    try:
                        r = await client.get(SORA2_QUERY_URL, params={"id": task_id}, headers=headers)
                        data = r.json()
                    except Exception:
                        await asyncio.sleep(poll_interval)
                        continue

                    status = (data.get("status") or (data.get("detail") or {}).get("status") or "").lower()
                    final_url = data.get("video_url") or (data.get("detail") or {}).get("video_url")

                    if status == "completed" and isinstance(final_url, str) and final_url.startswith("http"):
                        persisted_url = await upload_file_to_server(final_url, f"sora2_video_{uuid.uuid4().hex}.mp4")
                        final_url = persisted_url or final_url

                        deduct_result = await calculate_and_deduct_tokens_by_cost(
                            user_uuid=user_uuid,
                            yuan_cost=1.5,
                            service_name="Sora2视频生成",
                            success=True,
                        )
                        tokens_deducted = deduct_result.get("tokens_deducted", 0)

                        video_ratio = "unknown"
                        for ratio in ("16:9", "9:16", "1:1"):
                            if ratio in str(final_url):
                                video_ratio = ratio
                                break

                        await save_conversation_to_db(
                            user_uuid=user_uuid,
                            model_name="sora2",
                            problem=request.prompt,
                            answer=str(final_url),
                            agent_id=str(task_id),
                            agent_url=str(final_url),
                            field1=str(tokens_deducted),
                            video_ratio=video_ratio,
                        )
                        logger.info("Background poll completed for task %s", task_id)
                        return

                    if status in ("failed", "error"):
                        logger.warning("Background poll: task %s failed", task_id)
                        return

                    await asyncio.sleep(poll_interval)
        except Exception as e:
            logger.error("Background poll error: %s", e)

    asyncio.create_task(_background_follow_up())  # noqa: RUF006

    # Return pending response immediately
    return success(
        {
            "task_id": str(task_id),
            "status": "pending",
            "msg": "任务执行中,请稍后查询结果",
        },
        msg="视频生成任务已提交,执行中",
    )


@router.get("/video/{task_id}", summary="查询Sora2视频生成任务状态")
async def query_video(task_id: str = Path(...), user_uuid: str = Depends(require_login)):
    """Query the status and result of a Sora 2 video generation task."""
    api_key = getattr(settings, "LUYALA_API_KEY", "")
    if not api_key:
        return error("LUYALA API Key 未配置", code="500")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(SORA2_QUERY_URL, params={"id": task_id}, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # If completed and has video_url, persist it
        status = (data.get("status") or "").lower()
        final_url = data.get("video_url") or (data.get("detail") or {}).get("video_url")
        if status == "completed" and isinstance(final_url, str) and final_url.startswith("http"):
            persisted_url = await upload_file_to_server(final_url, f"sora2_video_{uuid.uuid4().hex}.mp4")
            if persisted_url:
                data["persisted_url"] = persisted_url

        return success(data)

    except httpx.HTTPStatusError as e:
        logger.error("Sora2 query HTTP error: %s %s", e.response.status_code, e.response.text[:500])
        return error(f"Sora2 API 查询失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Sora2 query error: %s", e)
        return error(f"查询视频任务失败: {e}")
