"""用户模型聊天 - 用户直接使用AI模型对话"""


import httpx
from fastapi import APIRouter, Body
from loguru import logger

from app.models.context_models import UserAgentImage  # noqa
from app.schemas.common import error, success
from app.utils.ai_keys import openai_key

router = APIRouter()


@router.post("/chat", operation_id="user_model_chat_chat", summary="AI模型对话")
async def chat(
    model: str = Body("gpt-4o-mini", embed=True),
    messages: list = Body(..., embed=True),
    temperature: float = Body(0.7, embed=True),
    max_tokens: int = Body(2048, embed=True),
    stream: bool = Body(False, embed=True),
    api_key: str | None = None,
    api_base: str | None = None,
):
    """用户直接调用AI模型对话(不绑定Agent)"""
    base = api_base or "https://api.openai.com/v1"
    with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if openai_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{base}/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": stream,
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"model chat error: {e}")
            return error(str(e))


@router.post("/image", summary="AI模型生图")
async def image(
    model: str = Body("dall-e-3", embed=True),
    prompt: str = Body(..., embed=True),
    size: str = Body("1024x1024", embed=True),
    n: int = Body(1, embed=True),
    api_key: str | None = None,
    api_base: str | None = None,
):
    base = api_base or "https://api.openai.com/v1"
    with httpx.AsyncClient(timeout=120) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if openai_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{base}/images/generations",
                json={"model": model, "prompt": prompt, "size": size, "n": n},
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"model image error: {e}")
            return error(str(e))


@router.get("/list", summary="可用模型列表")
async def list_models():
    """获取支持的AI模型列表"""
    return success(
        {
            "openai": [
                {"id": "gpt-4o", "name": "GPT-4o", "type": "chat"},
                {"id": "gpt-4o-mini", "name": "GPT-4o mini", "type": "chat"},
                {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "type": "chat"},
                {"id": "dall-e-3", "name": "DALL-E 3", "type": "image"},
            ],
            "anthropic": [
                {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "type": "chat"},
                {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "type": "chat"},
            ],
            "baidu": [
                {"id": "ernie-4.0", "name": "文心一言4.0", "type": "chat"},
                {"id": "ernie-3.5", "name": "文心一言3.5", "type": "chat"},
            ],
            "alibaba": [
                {"id": "qwen-max", "name": "通义千问Max", "type": "chat"},
                {"id": "qwen-plus", "name": "通义千问Plus", "type": "chat"},
            ],
            "bytedance": [
                {"id": "doubao-pro", "name": "豆包Pro", "type": "chat"},
            ],
        }
    )
