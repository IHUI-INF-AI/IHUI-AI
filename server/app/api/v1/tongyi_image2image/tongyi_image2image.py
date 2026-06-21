"""通义图生图 - 阿里通义图像生成/编辑/风格化"""


import httpx
from fastapi import APIRouter, Body
from loguru import logger

from app.schemas.common import error, success
from app.utils.ai_keys import dashscope_key

router = APIRouter()

QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1"


@router.post("/image-to-image", summary="通义图生图")
async def image_to_image(
    model: str = Body("wanx2.1-imageedit", embed=True),
    image_url: str = Body(..., embed=True),
    prompt: str = Body(..., embed=True),
    strength: float = Body(0.8, embed=True),
    style: str | None = Body(None, embed=True),
    api_key: str | None = None,
):
    with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if dashscope_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            parameters = {"strength": strength}
            if style:
                parameters["style"] = style
            r = await client.post(
                f"{QWEN_BASE_URL}/services/aigc/image2image/image-synthesis",
                json={
                    "model": model,
                    "input": {
                        "prompt": prompt,
                        "image_url": image_url,
                    },
                    "parameters": parameters,
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"qwen image to image error: {e}")
            return error(str(e))


@router.post("/style-transfer", summary="通义风格迁移")
async def style_transfer(
    model: str = Body("wanx-style-transfer", embed=True),
    image_url: str = Body(..., embed=True),
    style_ref_url: str = Body(..., embed=True),
    api_key: str | None = None,
):
    with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if dashscope_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{QWEN_BASE_URL}/services/aigc/image-generation/style-transfer",
                json={
                    "model": model,
                    "input": {
                        "image_url": image_url,
                        "style_ref_url": style_ref_url,
                    },
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"qwen style transfer error: {e}")
            return error(str(e))


@router.post("/background-generation", summary="通义背景生成")
async def background_generation(
    model: str = Body("wanx-background-generation-v2", embed=True),
    image_url: str = Body(..., embed=True),
    prompt: str | None = Body(None, embed=True),
    api_key: str | None = None,
):
    with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if dashscope_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{QWEN_BASE_URL}/services/aigc/image-generation/background-generation",
                json={
                    "model": model,
                    "input": {
                        "image_url": image_url,
                        "prompt": prompt,
                    },
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"qwen background generation error: {e}")
            return error(str(e))


@router.post("/virtual-try-on", summary="通义虚拟试衣")
async def virtual_try_on(
    model: str = Body("wanx-virtual-try-on-v1", embed=True),
    person_image_url: str = Body(..., embed=True),
    top_garment_url: str | None = Body(None, embed=True),
    bottom_garment_url: str | None = Body(None, embed=True),
    api_key: str | None = None,
):
    with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if dashscope_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            input_data = {"person_image_url": person_image_url}
            if top_garment_url:
                input_data["top_garment_url"] = top_garment_url
            if bottom_garment_url:
                input_data["bottom_garment_url"] = bottom_garment_url
            r = await client.post(
                f"{QWEN_BASE_URL}/services/aigc/image-generation/virtual-try-on",
                json={"model": model, "input": input_data},
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"qwen virtual try on error: {e}")
            return error(str(e))


@router.get("/models", operation_id="tongyi_image2image_list_models", summary="通义图生图可用模型")
async def list_models():
    return success(
        [
            {"id": "wanx2.1-imageedit", "name": "通义万相2.1图编辑", "type": "image-to-image"},
            {"id": "wanx-style-transfer", "name": "通义风格迁移", "type": "style-transfer"},
            {"id": "wanx-background-generation-v2", "name": "通义背景生成v2", "type": "background"},
            {"id": "wanx-virtual-try-on-v1", "name": "通义虚拟试衣v1", "type": "virtual-try-on"},
        ]
    )
