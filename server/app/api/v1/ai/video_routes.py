"""AI Video generation routes.

Exposes POST /generate endpoint for one-click text-to-video generation.
2026-06-29: 已接入真实视频生成管线 (豆包 Seedance + Sora2/Veo 降级).
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, Field

from app.schemas.common import ErrorCode, error, success
from app.security import require_login
from app.utils.one_click_video import generate_video_from_text

logger = logging.getLogger("video_routes")

router = APIRouter(prefix="/video", tags=["AI Video"])


class VideoGenerateRequest(BaseModel):
    """一键视频生成请求体."""

    text: str = Field(..., description="用于生成视频的源文本")
    options: dict[str, Any] | None = Field(
        None, description="可选生成参数: resolution / duration / voice / model 等"
    )


@router.post("/generate", summary="一键文本生成视频")
async def generate_video(
    body: VideoGenerateRequest,
    user_uuid: str = Depends(require_login),
    authorization: str = Header(None),
):
    """一键文本生成视频.

    调用 generate_video_from_text, 优先使用豆包 Seedance 文生视频,
    降级到 Sora2/Veo. 两个管线均包含提交+轮询+下载+持久化全流程.
    """
    try:
        if not body.text or not body.text.strip():
            return error("text 不能为空", ErrorCode.PARAM_MISSING)

        # 提取 JWT token 用于内部 API 调用
        api_token = ""
        if authorization and authorization.startswith("Bearer "):
            api_token = authorization[7:]

        result = await generate_video_from_text(
            text=body.text,
            options=body.options,
            user_uuid=user_uuid,
            api_token=api_token,
        )

        if isinstance(result, dict) and result.get("status") == "success":
            return success(result)
        else:
            return error(
                result.get("message", "视频生成失败"),
                ErrorCode.INTERNAL_ERROR,
            )

    except Exception as e:
        logger.exception("Video generate error")
        return error(f"视频生成异常: {e}", ErrorCode.INTERNAL_ERROR)
