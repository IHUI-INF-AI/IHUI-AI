"""豆包图片编辑 - 字节豆包(Doubao)图片编辑API代理"""


import httpx
from fastapi import APIRouter, Body
from loguru import logger

from app.schemas.common import error, success
from app.utils.ai_keys import doubao_key

router = APIRouter()

DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"


@router.post("/image-edit", operation_id="doubao_image_edit", summary="豆包图片编辑")
async def image_edit(
    model: str = Body("doubao-seededit-3-0-i2i-250628", embed=True),
    image_url: str | None = Body(None, embed=True),
    image_base64: str | None = Body(None, embed=True),
    prompt: str = Body(..., embed=True),
    seed: int = Body(-1, embed=True),
    guidance_scale: float = Body(5.0, embed=True),
    watermark: bool = Body(False, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            if not image_url and not image_base64:
                return error("请提供 image_url 或 image_base64", "400")
            if image_base64 and not image_base64.startswith("data:image"):
                image_base64 = f"data:image/jpeg;base64,{image_base64}"
            content = []
            if image_url:
                content.append({"type": "image_url", "image_url": {"url": image_url}})
            elif image_base64:
                content.append({"type": "image_url", "image_url": {"url": image_base64}})
            content.append({"type": "text", "text": prompt})
            headers = {"Content-Type": "application/json"}
            if doubao_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{DOUBAO_BASE_URL}/images/generations",
                json={
                    "model": model,
                    "image": image_url or image_base64,
                    "prompt": prompt,
                    "seed": seed,
                    "guidance_scale": guidance_scale,
                    "watermark": watermark,
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"doubao image edit error: {e}")
            return error("图片编辑服务异常,请稍后重试")


@router.post("/image-generate", summary="豆包文生图")
async def image_generate(
    model: str = Body("doubao-seedream-3-0-t2i-250415", embed=True),
    prompt: str = Body(..., embed=True),
    size: str = Body("1024x1024", embed=True),
    seed: int = Body(-1, embed=True),
    guidance_scale: float = Body(2.5, embed=True),
    watermark: bool = Body(False, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if doubao_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{DOUBAO_BASE_URL}/images/generations",
                json={
                    "model": model,
                    "prompt": prompt,
                    "size": size,
                    "seed": seed,
                    "guidance_scale": guidance_scale,
                    "watermark": watermark,
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"doubao image generate error: {e}")
            return error("图片生成服务异常,请稍后重试")


@router.get("/models", operation_id="doubao_image_edit_list_models", summary="豆包可用模型")
def list_models():
    return success(
        [
            {"id": "doubao-seededit-3-0-i2i-250628", "name": "豆包SeedEdit 3.0 (图生图)", "type": "image-edit"},
            {"id": "doubao-seedream-3-0-t2i-250415", "name": "豆包SeeDream 3.0 (文生图)", "type": "image-generate"},
            {"id": "doubao-pro", "name": "豆包Pro", "type": "chat"},
        ]
    )
