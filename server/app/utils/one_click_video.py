"""One-click video generation utility.

2026-06-29: 接入真实视频生成管线.
优先使用豆包 Seedance (文本生视频), 降级到 Sora2/Veo.
通过 HTTP 调用本服务已有的 /api/v1/ai/doubao/video/generate 或 /api/v1/ai/sora2/generate/video 端点.
"""

from __future__ import annotations

from typing import Any

import httpx
from loguru import logger

# 本服务内部 API 基址 (同进程 HTTP 调用)
_INTERNAL_BASE = "http://127.0.0.1:8000"


async def generate_video_from_text(
    text: str,
    options: dict[str, Any] | None = None,
    user_uuid: str = "",
    api_token: str = "",
) -> dict[str, Any]:
    """一键文本生成视频.

    优先调用豆包 Seedance 文生视频管线, 降级到 Sora2/Veo.
    两个管线均已在 server/app/api/v1/ai/ 下实现完整流程 (提交+轮询+下载+持久化).

    Args:
        text: source text for video generation.
        options: optional generation options (resolution, duration, voice, model, etc.).
        user_uuid: user UUID for token deduction.
        api_token: JWT token for internal API auth.

    Returns:
        dict with status (success/error), video_url, and metadata.
    """
    opts = options or {}
    if not text or not text.strip():
        return {"status": "error", "message": "text 不能为空"}

    headers = {"Content-Type": "application/json"}
    if api_token:
        headers["Authorization"] = f"Bearer {api_token}"

    # 优先使用豆包 Seedance
    try:
        result = await _try_doubao_seedance(text, opts, user_uuid, headers)
        if result.get("status") == "success":
            return result
        logger.info(f"Doubao Seedance failed, falling back to Sora2: {result.get('message')}")
    except Exception as e:
        logger.warning(f"Doubao Seedance error, falling back to Sora2: {e}")

    # 降级到 Sora2/Veo
    try:
        result = await _try_sora2(text, opts, user_uuid, headers)
        if result.get("status") == "success":
            return result
        return result
    except Exception as e:
        logger.error(f"Sora2 video generation error: {e}")
        return {"status": "error", "message": str(e), "text": text, "options": opts}


async def _try_doubao_seedance(
    text: str, opts: dict, user_uuid: str, headers: dict
) -> dict[str, Any]:
    """调用豆包 Seedance 文生视频."""
    payload = {
        "prompt": text,
        "model": opts.get("model", "doubao-seedance-1-0-pro"),
        "resolution": opts.get("resolution", "1080p"),
        "duration": opts.get("duration", 5),
        "user_uuid": user_uuid,
    }
    url = f"{_INTERNAL_BASE}/api/v1/ai/doubao/video/generate"
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(url, json=payload, headers=headers)
        data = resp.json()

    if resp.status_code == 200 and data.get("code") in (0, "0", 200):
        video_url = data.get("data", {}).get("video_url") if isinstance(data.get("data"), dict) else None
        return {
            "status": "success",
            "video_url": video_url or data.get("data"),
            "provider": "doubao_seedance",
            "raw_response": data,
        }
    return {
        "status": "error",
        "message": data.get("msg") or data.get("detail") or "Doubao Seedance API error",
        "code": resp.status_code,
        "raw_response": data,
    }


async def _try_sora2(
    text: str, opts: dict, user_uuid: str, headers: dict
) -> dict[str, Any]:
    """调用 Sora2/Veo 视频生成."""
    payload = {
        "prompt": text,
        "model": opts.get("model", "veo3.1"),
        "aspect_ratio": opts.get("aspect_ratio", "9:16"),
    }
    url = f"{_INTERNAL_BASE}/api/v1/ai/sora2/generate/video"
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(url, json=payload, headers=headers)
        data = resp.json()

    if resp.status_code == 200 and data.get("code") in (0, "0", 200):
        video_url = None
        if isinstance(data.get("data"), dict):
            video_url = data["data"].get("video_url") or data["data"].get("url")
        elif isinstance(data.get("data"), str):
            video_url = data["data"]
        return {
            "status": "success",
            "video_url": video_url,
            "provider": "sora2_veo",
            "raw_response": data,
        }
    return {
        "status": "error",
        "message": data.get("msg") or data.get("detail") or "Sora2 API error",
        "code": resp.status_code,
        "raw_response": data,
    }
