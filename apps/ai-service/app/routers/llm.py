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
import logging
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.llm_gateway import llm_gateway
from ..core.context_compaction import compress_messages_if_needed
from ..services.project_memory import build_system_prompt

router = APIRouter()
logger = logging.getLogger(__name__)

# 持有待完成的回调 task 引用,防止 CPython GC 回收未持有的 task
_pending_callbacks: set[asyncio.Task] = set()

# 默认模型清单 JSON 文件路径(运行时按需加载,修改无需重启)
_DEFAULT_MODELS_FILE = Path(__file__).resolve().parent.parent / "data" / "default_models.json"


def _inject_workspace_memory(
    messages: list[dict[str, Any]], workspace_path: str | None
) -> list[dict[str, Any]]:
    """将工作区项目记忆(CLAUDE.md/AGENTS.md/.ihui/memory.md)注入为 system message。

    行为(参考 Claude Code CLAUDE.md 机制):
    - workspace_path 为 None 或路径无项目记忆文件 → 原样返回 messages
    - messages[0].role == 'system' → 把项目记忆追加到现有 system content 后面
    - messages 无 system → 在开头插入新 system message

    Args:
        messages: 原始消息列表
        workspace_path: 工作区路径(None 时跳过注入)

    Returns:
        注入项目记忆后的新消息列表(不修改原列表)
    """
    if not workspace_path:
        return messages
    memory_content = build_system_prompt(workspace_path=workspace_path)
    # 项目记忆服务返回的内容已包含默认 system prompt 前缀,直接拼接即可
    if not memory_content:
        return messages
    new_messages = list(messages)
    if new_messages and new_messages[0].get("role") == "system":
        existing = new_messages[0].get("content", "")
        # 避免重复注入(同一 workspace_path 已注入过则跳过)
        marker = f"<!-- workspace:{workspace_path} -->"
        if marker in str(existing):
            return messages
        merged = f"{existing}\n\n{marker}\n{memory_content}" if existing else memory_content
        new_messages[0] = {**new_messages[0], "content": merged}
    else:
        new_messages.insert(0, {"role": "system", "content": memory_content})
    return new_messages


def _load_default_models() -> list[dict[str, Any]]:
    """从 data/default_models.json 加载默认模型清单,按 id 去重。

    文件不存在或解析失败时返回内置最小兜底列表(避免启动失败)。
    """
    fallback_minimal = [
        {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai", "context_length": 128000, "input_price": 2.5},
        {"id": "gpt-4o-mini", "name": "GPT-4o mini", "provider": "openai", "context_length": 128000, "input_price": 0.15},
    ]
    try:
        if not _DEFAULT_MODELS_FILE.exists():
            logger.warning("Default models file not found: %s, using minimal fallback", _DEFAULT_MODELS_FILE)
            return fallback_minimal
        raw = _DEFAULT_MODELS_FILE.read_text(encoding="utf-8")
        data = json.loads(raw)
        models = data.get("models", [])
        if not isinstance(models, list) or not models:
            return fallback_minimal
        # 按 id 去重(保留首次出现)
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for m in models:
            if not isinstance(m, dict):
                continue
            mid = m.get("id")
            if not mid or mid in seen:
                continue
            seen.add(mid)
            unique.append(m)
        return unique
    except Exception as e:
        logger.exception("Failed to load default models from %s: %s", _DEFAULT_MODELS_FILE, e)
        return fallback_minimal


class LLMCompleteRequest(BaseModel):
    """LLM 调用请求。"""

    messages: list[dict[str, Any]] = Field(..., description="OpenAI 格式消息列表")
    model: str | None = Field(None, description="模型名称,为空使用默认")
    # function calling(OpenAI tools 格式,透传给 LiteLLM 或厂商原生 API)
    tools: list[dict[str, Any]] | None = Field(None, description="OpenAI 格式 tools 定义")
    tool_choice: str | dict[str, Any] | None = Field(
        None, description="工具选择策略: auto/none/required 或 {type:'function',function:{name:'xxx'}}"
    )
    temperature: float | None = Field(None, description="采样温度")
    max_tokens: int | None = Field(None, description="最大生成 token 数")
    # Phase 3 集成字段(可选)
    metadata: dict[str, Any] | None = Field(
        None, description="调用方元数据(conversation_id/message_id/user_id 等),原样透传到 done 事件"
    )
    callback_url: str | None = Field(
        None, description="推理完成后回调该 URL(POST 完整结果),默认由 api_service_url 构造"
    )
    # 当前绑定的本地工作区路径,用于注入 CLAUDE.md/AGENTS.md 项目记忆作为 system prompt
    workspace_path: str | None = Field(
        None, description="工作区路径,自动加载并注入项目记忆文件(CLAUDE.md/AGENTS.md/.ihui/memory.md)"
    )
    # 模型上下文窗口大小(tokens),达 88% 阈值自动压缩(跨端统一,Python 端兜底)
    context_limit: int | None = Field(
        None, description="模型上下文窗口大小(tokens),达 88% 阈值自动压缩。0 或 None = 不压缩"
    )


@router.post("/llm/complete")
async def llm_complete(req: LLMCompleteRequest) -> dict[str, Any]:
    """直接调用 LLM 完成对话(支持 function calling)。"""
    owner_uuid = (req.metadata or {}).get("userId")
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(req.messages, req.workspace_path)
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    if req.context_limit and req.context_limit > 0:
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)
        if compaction_info["compressed"]:
            logger.info(
                "Context auto-compressed (Python fallback): %d → %d tokens, removed %d msgs",
                compaction_info["original_tokens"],
                compaction_info["compressed_tokens"],
                compaction_info["removed_count"],
            )
    # 构造透传 kwargs(只透传非 None 的字段)
    kwargs: dict[str, Any] = {}
    if req.tools is not None:
        kwargs["tools"] = req.tools
    if req.tool_choice is not None:
        kwargs["tool_choice"] = req.tool_choice
    if req.temperature is not None:
        kwargs["temperature"] = req.temperature
    if req.max_tokens is not None:
        kwargs["max_tokens"] = req.max_tokens
    result = await llm_gateway.complete(messages, model=req.model, owner_uuid=owner_uuid, **kwargs)
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

    从 data/default_models.json 加载(支持热更新,无需重启),按 id 去重。
    stub 模式下返回默认列表。
    前端 /models 页面通过 API 代理调用此端点获取动态模型清单。
    """
    default_models = _load_default_models()
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
    # 工作区上下文注入:若 workspace_path 提供且存在 CLAUDE.md/AGENTS.md,合并到 system message
    messages = _inject_workspace_memory(req.messages, req.workspace_path)
    # 跨端统一 88% 阈值自动压缩(Python 端兜底,API 层未压缩时由本层保护)
    compaction_info: dict[str, Any] | None = None
    if req.context_limit and req.context_limit > 0:
        messages, compaction_info = compress_messages_if_needed(messages, req.context_limit)

    async def gen():
        try:
            # 若发生压缩,通过 SSE 首事件通知调用方(对标 API 层的 compaction 事件)
            if compaction_info and compaction_info.get("compressed"):
                yield f"data: {json.dumps({'compaction': {'triggered': True, 'tokensBefore': compaction_info['original_tokens'], 'tokensAfter': compaction_info['compressed_tokens'], 'removedCount': compaction_info['removed_count'], 'usageRatio': compaction_info['usage_ratio']}}, ensure_ascii=False)}\n\n"
            async for event in llm_gateway.astream(messages, model=req.model, owner_uuid=owner_uuid):
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
