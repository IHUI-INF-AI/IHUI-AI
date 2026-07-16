"""LLM 路由(2 端点)。

提供 LLM 直接调用接口,以及 SSE 流式调用接口(原生 token 级流式)。

集成设计(2026-07-09 Phase 3):
- 请求可选携带 metadata(dict)和 callback_url(str)
- metadata 透传到 done 事件,用于调用方关联会话/消息
- 若提供 callback_url,推理完成后异步 POST 完整结果到该 URL
- callback_url 默认值由 config.api_service_url 构造(如 http://api:8080/api/ai/callback)
"""

import asyncio
import json
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

router = APIRouter()

# 持有待完成的回调 task 引用,防止 CPython GC 回收未持有的 task
_pending_callbacks: set[asyncio.Task] = set()


class LLMCompleteRequest(BaseModel):
    """LLM 调用请求。"""

    messages: list[dict[str, Any]] = Field(..., description="OpenAI 格式消息列表")
    model: str | None = Field(None, description="模型名称,为空使用默认")
    # Phase 3 集成字段(可选)
    metadata: dict[str, Any] | None = Field(
        None, description="调用方元数据(conversation_id/message_id/user_id 等),原样透传到 done 事件"
    )
    callback_url: str | None = Field(
        None, description="推理完成后回调该 URL(POST 完整结果),默认由 api_service_url 构造"
    )


@router.post("/llm/complete")
async def llm_complete(req: LLMCompleteRequest) -> dict[str, Any]:
    """直接调用 LLM 完成对话。"""
    owner_uuid = (req.metadata or {}).get("userId")
    result = await llm_gateway.complete(req.messages, model=req.model, owner_uuid=owner_uuid)
    # 透传 metadata
    if req.metadata:
        result["metadata"] = req.metadata
    # 异步回调(仅当 metadata 含关联键时才触发,避免无谓网络开销)
    # 错误响应(error: True)不回调,避免把错误文本当作 AI 回复持久化
    has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
    if has_association and not result.get("error"):
        url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
        task = asyncio.create_task(_fire_callback(url, result, req.metadata))
        _pending_callbacks.add(task)
        task.add_done_callback(_pending_callbacks.discard)
    return result


@router.get("/llm/models")
async def list_models() -> dict[str, Any]:
    """返回可用模型列表。

    从配置的 LiteLLM 模型派生,stub 模式下返回默认列表。
    前端 /models 页面通过 API 代理调用此端点获取动态模型清单。
    """
    default_models = [
        # 用户 plan 套餐(已配置,优先使用)
        {"id": "stepfun/step-3.7-flash", "name": "Step 3.7 Flash (StepFun)", "provider": "meta", "context_length": 128000, "input_price": 0},
        {"id": "stepfun/step-3.5-flash", "name": "Step 3.5 Flash (StepFun)", "provider": "meta", "context_length": 128000, "input_price": 0},
        {"id": "stepfun/step-router-v1", "name": "Step Router v1 (StepFun 智能路由)", "provider": "meta", "context_length": 128000, "input_price": 0},
        {"id": "agnes/gpt-4o", "name": "GPT-4o (Agnes Plan)", "provider": "openai", "context_length": 128000, "input_price": 0},
        # 免费 provider(备选,需自行注册 key)
        {"id": "groq/llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Groq 免费)", "provider": "meta", "context_length": 128000, "input_price": 0},
        {"id": "gemini/gemini-1.5-flash", "name": "Gemini 1.5 Flash (免费)", "provider": "google", "context_length": 1000000, "input_price": 0},
        {"id": "openrouter/auto", "name": "OpenRouter Auto (免费路由)", "provider": "meta", "context_length": 128000, "input_price": 0},
        # 付费 provider(需付费 key)
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "context_length": 128000, "input_price": 2.5},
        {"id": "gpt-4o-mini", "name": "GPT-4o mini", "provider": "openai", "context_length": 128000, "input_price": 0.15},
        {"id": "claude-3-5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "anthropic", "context_length": 200000, "input_price": 3},
    ]
    return {
        "models": default_models,
        "default": settings.litellm_model,
        "stub_mode": llm_gateway._is_stub_mode(),
    }


@router.post("/llm/complete/stream")
async def complete_stream(req: LLMCompleteRequest) -> StreamingResponse:
    """流式 LLM 调用(原生 token 级流式 + SSE event 字段 + 心跳保活)。

    事件类型:
    - event: chunk  — 逐 token 内容 {"content": "..."}
    - event: done   — 完成 {"model": ..., "usage": ..., "stub": bool, "metadata": {...}}
    - event: error  — 错误 {"message": "..."}
    """

    accumulated: dict[str, Any] = {"content": "", "reasoning": "", "model": req.model, "usage": None, "stub": False}
    owner_uuid = (req.metadata or {}).get("userId")

    async def gen():
        try:
            async for event in llm_gateway.astream(req.messages, model=req.model, owner_uuid=owner_uuid):
                event_type = event.get("type", "message")
                # 累积内容用于回调
                if event_type in ("chunk", "message"):
                    accumulated["content"] += event.get("content", "")
                elif event_type == "reasoning":
                    accumulated["reasoning"] += event.get("content", "")
                elif event_type == "done":
                    accumulated["model"] = event.get("model", req.model)
                    accumulated["usage"] = event.get("usage")
                    accumulated["stub"] = event.get("stub", False)
                    # 在 done 事件中透传 metadata
                    if req.metadata:
                        event["metadata"] = req.metadata
                yield f"event: {event_type}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            err = {"type": "error", "message": str(e)}
            yield f"event: error\ndata: {json.dumps(err, ensure_ascii=False)}\n\n"
            return

        # 流结束后异步回调(仅当 metadata 含关联键且无错误时)
        has_association = req.metadata and req.metadata.get("conversationId") and req.metadata.get("userId")
        if has_association and not accumulated.get("error"):
            url = req.callback_url or f"{settings.api_service_url}/api/ai/callback"
            task = asyncio.create_task(_fire_callback(url, accumulated, req.metadata))
            _pending_callbacks.add(task)
            task.add_done_callback(_pending_callbacks.discard)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲,确保实时流式
        },
    )


async def _fire_callback(url: str, payload: dict[str, Any], metadata: dict[str, Any] | None) -> None:
    """异步 POST 推理结果到 callback_url。

    失败静默(只记日志),不阻塞主流程。
    由 API 侧的 /api/ai/callback 端点接收并入队 aiCallback 处理。

    健壮性:
    - 若配置 ai_callback_secret,携带 X-Internal-Secret 头(与后端共享密钥校验)
    - 对 5xx / 网络错误重试 2 次(指数退避 0.5s → 1s),4xx 不重试(请求本身有问题)
    """
    import asyncio
    import logging

    logger = logging.getLogger(__name__)
    body = {
        "content": payload.get("content", ""),
        "model": payload.get("model"),
        "usage": payload.get("usage"),
        "stub": payload.get("stub", False),
        "metadata": metadata or {},
    }
    if payload.get("reasoning"):
        body["reasoning"] = payload["reasoning"]
    headers: dict[str, str] = {}
    if settings.ai_callback_secret:
        headers["X-Internal-Secret"] = settings.ai_callback_secret

    max_attempts = 3  # 首次 + 2 次重试
    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=body, headers=headers)
                if resp.status_code < 500:
                    # 2xx 成功 / 4xx 客户端错误(请求本身有问题,不重试)
                    if resp.status_code >= 400:
                        logger.warning(
                            "LLM callback to %s failed: %s %s",
                            url,
                            resp.status_code,
                            resp.text[:200],
                        )
                    return
                # 5xx 服务端错误,可重试
                if attempt < max_attempts - 1:
                    await asyncio.sleep(0.5 * (2 ** attempt))
                    continue
                logger.warning(
                    "LLM callback to %s failed after %d attempts: %s %s",
                    url,
                    max_attempts,
                    resp.status_code,
                    resp.text[:200],
                )
        except Exception as e:
            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            logger.warning("LLM callback to %s error after %d attempts: %s", url, max_attempts, e)
