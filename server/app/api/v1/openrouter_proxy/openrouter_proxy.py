"""OpenRouter代理 - 第三方AI模型路由代理"""


import httpx
from fastapi import APIRouter, Body
from loguru import logger

from app.schemas.common import error, success
from app.utils.ai_keys import openrouter_key

router = APIRouter()

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


@router.post("/chat", operation_id="openrouter_chat", summary="OpenRouter对话")
async def chat(
    messages: list = Body(..., embed=True),
    model: str = Body("openai/gpt-4o-mini", embed=True),
    temperature: float = Body(0.7, embed=True),
    max_tokens: int = Body(2048, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if openrouter_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            else:
                headers["HTTP-Referer"] = "https://ihui-ai.com"
                headers["X-Title"] = "ihui-ai-edu"
            r = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
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
            logger.error(f"openrouter chat error: {e}")
            return error(str(e))


@router.post("/completion", operation_id="openrouter_completion", summary="OpenRouter文本补全")
async def completion(
    prompt: str = Body(..., embed=True),
    model: str = Body("openai/gpt-3.5-turbo-instruct", embed=True),
    max_tokens: int = Body(1024, embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if openrouter_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{OPENROUTER_BASE_URL}/completions",
                json={"model": model, "prompt": prompt, "max_tokens": max_tokens},
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"openrouter completion error: {e}")
            return error(str(e))


@router.get("/models", operation_id="openrouter_models", summary="可用模型列表")
async def models():
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{OPENROUTER_BASE_URL}/models")
            return success(r.json())
    except Exception:
        return success(
            {
                "data": [
                    {"id": "openai/gpt-4o", "name": "GPT-4o"},
                    {"id": "openai/gpt-4o-mini", "name": "GPT-4o mini"},
                    {"id": "openai/gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
                    {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet"},
                    {"id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5"},
                ]
            }
        )


@router.post("/embeddings", operation_id="openrouter_embeddings", summary="OpenRouter Embeddings")
async def embeddings(
    input_text: str = Body(..., embed=True),
    model: str = Body("openai/text-embedding-3-small", embed=True),
    api_key: str | None = None,
):
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            headers = {"Content-Type": "application/json"}
            if openrouter_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.post(
                f"{OPENROUTER_BASE_URL}/embeddings",
                json={"model": model, "input": input_text},
                headers=headers,
            )
            return success(r.json())
        except Exception as e:
            logger.error(f"openrouter embeddings error: {e}")
            return error(str(e))


@router.get("/credits", summary="账户额度")
async def credits(api_key: str = ""):
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            headers = {}
            if openrouter_key(api_key):
                headers["Authorization"] = f"Bearer {api_key}"
            r = await client.get(f"{OPENROUTER_BASE_URL}/credits", headers=headers)
            return success(r.json())
        except Exception:
            return success({"data": {"total_credits": 0, "total_usage": 0}})
