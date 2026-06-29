"""通义图像编辑 - 阿里通义图片编辑API代理"""


import httpx
from fastapi import APIRouter, Body
from loguru import logger

from app.schemas.common import error, success
from app.utils.ai_keys import dashscope_key

router = APIRouter()

QWEN_BASE_URL = "https://dashscope.aliyuncs.com/api/v1"


@router.post("/image-edit", operation_id="tongyi_image_edit", summary="通义图像编辑")
async def image_edit(
    model: str = Body("qwen-image-edit", embed=True),
    image_url: str | None = Body(None, embed=True),
    image_base64: str | None = Body(None, embed=True),
    prompt: str = Body(..., embed=True),
    negative_prompt: str | None = Body(None, embed=True),
    n: int = Body(1, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            if not image_url and not image_base64:
                return error("请提供 image_url 或 image_base64", "400")
            image_input = image_url or image_base64
            if image_base64 and not image_base64.startswith("data:image"):
                image_input = f"data:image/jpeg;base64,{image_base64}"
            headers = {"Content-Type": "application/json"}
            if dashscope_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{QWEN_BASE_URL}/services/aigc/image-generation/generation",
                json={
                    "model": model,
                    "input": {
                        "prompt": prompt,
                        "negative_prompt": negative_prompt,
                        "image_url": image_input,
                    },
                    "parameters": {"n": n},
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"qwen image edit error: {e}")
            return error(str(e))


@router.post("/text-to-image", summary="通义文生图")
async def text_to_image(
    model: str = Body("qwen-image", embed=True),
    prompt: str = Body(..., embed=True),
    negative_prompt: str | None = Body(None, embed=True),
    size: str = Body("1024*1024", embed=True),
    n: int = Body(1, embed=True),
    style: str | None = Body(None, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if dashscope_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            parameters = {"size": size, "n": n}
            if style:
                parameters["style"] = style
            r = await client.post(
                f"{QWEN_BASE_URL}/services/aigc/text2image/image-synthesis",
                json={
                    "model": model,
                    "input": {
                        "prompt": prompt,
                        "negative_prompt": negative_prompt,
                    },
                    "parameters": parameters,
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"qwen text to image error: {e}")
            return error(str(e))


@router.get("/models", operation_id="tongyi_image_edit_list_models", summary="通义可用模型")
async def list_models():
    return success(
        [
            {"id": "qwen-image", "name": "通义千问文生图", "type": "text-to-image"},
            {"id": "qwen-image-edit", "name": "通义千问图编辑", "type": "image-edit"},
            {"id": "wanx-v1", "name": "通义万相v1", "type": "text-to-image"},
            {"id": "wanx2.1-t2i-turbo", "name": "通义万相2.1加速版", "type": "text-to-image"},
        ]
    )
