# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""图片编辑 HTTP 路由(ai-service,内网)。

- POST /api/image/edits   TokenGo /v1/images/edits(OpenAI Images edits 同构,
                          multipart:待编辑图必传 + 可选 mask;同步 40-50s)
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile, Form

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/image/edits")
async def image_edits(
    image: UploadFile = File(..., description="待编辑图(png/jpeg/webp,≤25MiB)"),
    prompt: str = Form(..., description="编辑指令(改什么)"),
    mask: UploadFile | None = File(default=None, description="可选遮罩(透明区域=重绘区)"),
    model: str | None = Form(default=None, description="图片模型(默认 gpt-image-2)"),
    n: int = Form(default=1, ge=1, le=50, description="生成数量(官方 count 1~50)"),
    size: str | None = Form(default=None, description="像素串(与 aspect_ratio 二选一,兼容老 API)"),
    aspect_ratio: str | None = Form(default=None, description="比例(官方 12 枚举,如 16:9)"),
    quality: str | None = Form(default=None, description="auto/high/medium/low"),
    output_format: str | None = Form(default=None, description="png/jpeg"),
) -> dict[str, Any]:
    """图片编辑(multipart 直通 TokenGo /v1/images/edits;200+body.error 已在 provider 层检查)。"""
    from ..providers.base_provider import ProviderError
    from ..core.config import settings
    from ..providers.token6688_provider import Token6688Provider

    cfg = settings.get_provider_config("token6688")
    if not cfg.api_key:
        raise HTTPException(
            status_code=503,
            detail="token6688 未配置:请在 .env 设置 TOKEN6688_API_KEY 或 LLM_PROVIDERS.token6688.api_key",
        )
    provider = Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base)
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="待编辑图为空")
    mask_bytes = await mask.read() if mask else None
    extra: dict[str, str] = {}
    if aspect_ratio:
        extra["aspect_ratio"] = aspect_ratio
    if quality:
        extra["quality"] = quality
    if output_format:
        extra["output_format"] = output_format
    try:
        return await provider.images_edits(
            prompt, image_bytes, image.filename or "image.png",
            model=model, mask_bytes=mask_bytes or None,
            n=n, size=size, **extra,
        )
    except ProviderError as e:
        logger.warning("token6688 图片编辑失败: %s", e)
        raise HTTPException(status_code=e.status_code or 502, detail=str(e)) from None
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"图片编辑异常: {e}") from e
