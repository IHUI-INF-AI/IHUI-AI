"""露雅拉代理 (外部AI API代理)"""


import httpx
from fastapi import APIRouter, Body
from loguru import logger

from app.schemas.common import error, success
from app.utils.ai_keys import luyala_key

router = APIRouter()

LUYALA_BASE_URL = "https://api.luyala.com/v1"


@router.post("/chat", operation_id="luyala_chat", summary="露雅拉对话")
async def chat(
    messages: list = Body(..., embed=True),
    model: str = Body("luyala-pro", embed=True),
    temperature: float = Body(0.7, embed=True),
    max_tokens: int = Body(2048, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if luyala_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{LUYALA_BASE_URL}/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"luyala chat error: {e}")
            return error(str(e))


@router.post("/completion", operation_id="luyala_completion", summary="露雅拉文本补全")
async def completion(
    prompt: str = Body(..., embed=True),
    model: str = Body("luyala-pro", embed=True),
    max_tokens: int = Body(1024, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if luyala_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{LUYALA_BASE_URL}/completions",
                json={"model": model, "prompt": prompt, "max_tokens": max_tokens},
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"luyala completion error: {e}")
            return error(str(e))


@router.post("/embeddings", operation_id="luyala_embeddings", summary="露雅拉Embedding")
async def embeddings(
    input_text: str = Body(..., embed=True),
    model: str = Body("luyala-embed", embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if luyala_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{LUYALA_BASE_URL}/embeddings",
                json={"model": model, "input": input_text},
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"luyala embeddings error: {e}")
            return error(str(e))


@router.get("/models", operation_id="luyala_models", summary="可用模型列表")
async def models():
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{LUYALA_BASE_URL}/models")
            return success(r.json())
    except Exception:
        return success(
            {
                "models": [
                    {"id": "luyala-pro", "name": "露雅拉Pro"},
                    {"id": "luyala-turbo", "name": "露雅拉Turbo"},
                    {"id": "luyala-embed", "name": "露雅拉Embed"},
                ]
            }
        )
