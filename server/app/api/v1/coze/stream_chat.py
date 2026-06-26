"""Coze stream_run 聊天 -- 迁移自 coze_zhs_py/api/coze_chat.py

调用 Coze 站点 stream_run URL (https://ys63nzrb6p.coze.site/stream_run),
**不是** api.coze.cn/v1/workflow/stream_run, 二者完全不同.

通过 Socket.IO (app.api.socketio_chat.sio) 推送流式结果给客户端, 同时返回
SSE StreamingResponse. 含余额校验、扣费、会话保存.

端点 (前缀 /api/v1/coze/stream):
- POST /chat  调用 coze.site/stream_run, SSE 流式返回
"""

import asyncio
import json
import uuid
from typing import Any, Optional

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from loguru import logger
from pydantic import BaseModel, Field

from app.config import settings
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    check_user_token_sufficient,
    save_conversation_to_db,
)

router = APIRouter(prefix="/coze/stream", tags=["Coze stream_run 聊天"])

# Coze stream_run 站点 URL (与 api.coze.cn/v1/workflow/stream_run 完全不同)
COZE_STREAM_RUN_URL = getattr(settings, "COZE_STREAM_RUN_URL", None) or (
    "https://ys63nzrb6p.coze.site/stream_run"
)
# 历史项目内嵌的 stream_run JWT (exp 较长, 仅 stream_run 站点校验)
# 优先使用 settings.COZE_STREAM_RUN_TOKEN, 缺失则回退到历史内置 token
COZE_STREAM_RUN_TOKEN = getattr(settings, "COZE_STREAM_RUN_TOKEN", "") or (
    "eyJhbGciOiJSUzI1NiIsImtpZCI6ImYxYjFjNTdlLWNlZDItNGVhMC05ZmE4LWI2MjU1MTM2MzYyNyJ9."
    "eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIjVGZ1VDcWVlbWNFcXhiSlI5cFFWMjBRaWpJbExseU1oIl0s"
    "ImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzY5MTU0MDk0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NTk4MTM0MjE1MjM4Mjg3Mzg2Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NTk4NDU4OTc4MDYxNzc4OTgwIn0."
    "J88XBfet7f5stjIkWOvj2wbSg7SnAZjc84hz5ChlA3HjlKtHOC1iCGayMQ1ZwYNJQt5Z-EA-QArXvPb6MO5ZamL70Vhf9Y9KwoEodDmZLxu5K1JLdXce0pvmn5yn9ue9byXXFkrzRYpM8BCVMF77N2DYsy2pv7M-9KY9PCMAb28ZZEhn_LmeXzpnMV-_8ri0RFJhvp6Pl2V21otgAT_0KcUxD_qSowUIOkFt_6Blsv1TYB8p2YW24g95h3MxBpd0sznXXh3AlXgDAGjeHoJMbT4XEAYzc9k2TEMhVGmYFuuv_KLW4HcLXBdvHMChqzFozBSnxZ676GLI_bqzncJiDw"
)
COZE_DB_MODEL_NAME = "coze_chat"
# 单次 stream_run 调用估算成本 (元)
COZE_CHAT_YUAN_COST = 0.1


class _TextContent(BaseModel):
    text: str = Field(..., description="文本内容")


class _PromptItem(BaseModel):
    type: str = Field(..., description="类型")
    content: _TextContent = Field(..., description="内容")


class _Query(BaseModel):
    prompt: list[_PromptItem] = Field(..., description="提示列表")


class _Content(BaseModel):
    query: _Query = Field(..., description="查询内容")


class CozeStreamChatRequest(BaseModel):
    """Coze stream_run 聊天请求体."""

    content: _Content = Field(..., description="请求内容")
    type: str = Field(default="query", description="请求类型")
    session_id: Optional[str] = Field(None, description="会话ID")
    project_id: int = Field(default=7598128573479862282, description="项目ID")
    user_uuid: str = Field(..., description="用户唯一标识")
    chat_id: Optional[str] = Field(None, description="对话ID")
    bot_id: Optional[str] = Field(None, description="机器人ID (历史兼容字段)")


async def send_message_to_user_model(
    user_uuid: str,
    model_id: str,
    message: list[dict[str, Any]] | dict[str, Any],
    event_name: str = "chat_result",
    chat_id: str | None = None,
    status: str = "run",
) -> None:
    """通过 Socket.IO 推送流式消息给客户端.

    迁移自历史项目 public_socket.send_message_to_user_model, 适配当前项目的
    socketio_chat.sio. 推送失败仅记录日志, 不阻塞主流程.
    """
    try:
        from app.api.socketio_chat import sio

        payload = {
            "code": 200,
            "msg": "success",
            "data": {
                "id": str(uuid.uuid4()),
                "role": "assistant",
                "type": event_name,
                "content": message,
                "chat_id": chat_id,
                "model": model_id,
                "status": status,
                "user_uuid": user_uuid,
            },
            "event": f"chat.{event_name}",
        }
        # 推送到用户专属房间
        await sio.emit("message", payload, room=f"chat:{user_uuid}")
    except Exception as e:
        logger.debug(f"send_message_to_user_model 推送失败 user={user_uuid}: {e}")


def _extract_first_text(req: CozeStreamChatRequest) -> str:
    """从请求中提取第一个文本内容."""
    for item in req.content.query.prompt:
        if item.type == "text" and item.content.text:
            return item.content.text
    return ""


def _sse(data: dict[str, Any]) -> str:
    """格式化 SSE data 行."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/chat", summary="Coze stream_run 流式聊天 (SSE)")
async def coze_stream_chat(req: CozeStreamChatRequest):
    """调用 Coze 站点 stream_run URL, 流式返回结果 (SSE).

    流程: 余额校验 -> 推送 user 消息 -> 流式拉取 stream_run -> 推送 chat_result
    -> 扣费 -> 保存会话.
    """
    logger.info(f"收到 Coze stream_run 请求 user_uuid={req.user_uuid} chat_id={req.chat_id}")

    # 1. 余额校验 (check_user_token_sufficient 为同步函数, 用 to_thread 包装避免阻塞)
    token_check = await asyncio.to_thread(check_user_token_sufficient, req.user_uuid)
    if not token_check.get("sufficient"):
        msg = token_check.get("reason") or token_check.get("error") or "余额不足"
        logger.warning(f"Coze stream_run 余额不足: {msg} user={req.user_uuid}")
        return StreamingResponse(
            iter([_sse({"code": "403", "msg": msg, "data": None})]),
            media_type="text/event-stream",
        )

    # 2. 提取文本
    first_text = _extract_first_text(req)
    if not first_text:
        return StreamingResponse(
            iter([_sse({"code": "400", "msg": "未找到有效的文本内容", "data": None})]),
            media_type="text/event-stream",
        )

    final_chat_id = req.chat_id or str(uuid.uuid4())
    final_session_id = req.session_id or str(uuid.uuid4())

    # 3. 推送用户消息
    await send_message_to_user_model(
        user_uuid=req.user_uuid,
        model_id=COZE_DB_MODEL_NAME,
        message=[{"type": "text", "text": first_text, "role": "user"}],
        event_name="user",
        chat_id=final_chat_id,
        status="run",
    )

    request_data = {
        "content": {
            "query": {
                "prompt": [{"type": "text", "content": {"text": first_text}}]
            }
        },
        "type": req.type,
        "session_id": final_session_id,
        "project_id": req.project_id,
    }
    headers = {
        "Authorization": f"Bearer {COZE_STREAM_RUN_TOKEN}",
        "Content-Type": "application/json",
    }

    async def event_stream():
        answer_content = ""
        usage_info: dict[str, Any] | None = None
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST", COZE_STREAM_RUN_URL, json=request_data, headers=headers
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        err_msg = body.decode("utf-8", errors="ignore")[:500]
                        logger.error(f"Coze stream_run HTTP {resp.status_code}: {err_msg}")
                        yield _sse(
                            {
                                "code": str(resp.status_code),
                                "msg": f"stream_run 调用失败: {err_msg}",
                                "data": None,
                            }
                        )
                        return

                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            # 非 JSON 行作为纯文本增量
                            answer_content += line
                            yield _sse(
                                {
                                    "code": "0",
                                    "msg": "delta",
                                    "data": {"delta": line, "chat_id": final_chat_id},
                                }
                            )
                            continue

                        content = data.get("content") or {}
                        if "answer" in content and content["answer"]:
                            delta = content["answer"]
                            answer_content += delta
                            yield _sse(
                                {
                                    "code": "0",
                                    "msg": "delta",
                                    "data": {"delta": delta, "chat_id": final_chat_id},
                                }
                            )
                        if "usage" in data:
                            usage_info = data["usage"]

            # 4. 扣费
            total_tokens = 0
            if usage_info:
                total_tokens = usage_info.get("total_tokens", 0)
            else:
                total_tokens = len(first_text) + len(answer_content)
            logger.info(
                f"Coze stream_run 完成 tokens={total_tokens} user={req.user_uuid}"
            )

            token_result = await calculate_and_deduct_tokens_by_cost(
                user_uuid=req.user_uuid,
                yuan_cost=COZE_CHAT_YUAN_COST,
                service_name="Coze聊天模型",
                success=True,
            )
            deducted = (
                token_result.get("tokens_deducted", 0)
                if token_result.get("success")
                else 0
            )

            # 5. 推送最终结果
            await send_message_to_user_model(
                user_uuid=req.user_uuid,
                model_id=COZE_DB_MODEL_NAME,
                message=[{"type": "text", "text": answer_content}],
                event_name="chat_result",
                chat_id=final_chat_id,
                status="stop",
            )

            # 6. 保存会话 (同步函数, to_thread 包装)
            await asyncio.to_thread(
                save_conversation_to_db,
                user_uuid=req.user_uuid,
                model_name=COZE_DB_MODEL_NAME,
                problem=first_text,
                answer=answer_content,
                chat_id=final_chat_id,
                agent_id=COZE_DB_MODEL_NAME,
                agent_url="",
                field1=str(deducted),
            )

            yield _sse(
                {
                    "code": "0",
                    "msg": "done",
                    "data": {
                        "answer": answer_content,
                        "chat_id": final_chat_id,
                        "total_tokens": deducted,
                    },
                }
            )
        except httpx.TimeoutException:
            logger.debug(f"Coze stream_run 超时 user={req.user_uuid}")
            yield _sse({"code": "504", "msg": "stream_run 请求超时", "data": None})
        except Exception as e:
            logger.debug(f"Coze stream_run 异常 user={req.user_uuid}: {e}")
            yield _sse({"code": "500", "msg": str(e), "data": None})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
