"""DeepSeek WebSocket 代理路由.

参照 zhipu.py 模式, 提供 WebSocket 实时对话代理.
后端通过 WebSocket 接收用户消息, 转发到 DeepSeek API (SSE 流式),
将 SSE 响应逐行推送给客户端 WebSocket.

2026-06-29: 新增 WS 端点, 对齐前端 vite.config.ts 代理重写 /cozeZhsApi/ws/chatdeepseek/stream -> /api/v1/chat/ws/deepseek
"""

from __future__ import annotations

import contextlib
import json

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.config import settings
from app.ws.auth_decorator import ws_require_auth

router = APIRouter()

_DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"


def _headers(api_key: str | None) -> dict[str, str]:
    key = api_key or settings.DEEPSEEK_API_KEY
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


@router.websocket("/ws/deepseek")
@ws_require_auth
async def deepseek_ws(
    websocket: WebSocket,
    user_uuid: str = "",
    model: str = Query("deepseek-chat"),
    api_key: str | None = Query(None),
):
    """DeepSeek WebSocket 实时对话代理.

    客户端通过 WebSocket 发送文本消息, 代理转发到 DeepSeek API (SSE 流式).
    与 zhipu.py 的区别: DeepSeek 上游是 HTTP SSE (非原生 WebSocket),
    本端点接收 WS 消息后发起 HTTP SSE 请求, 逐行转发回 WS 客户端.
    """
    await websocket.accept()
    key = api_key or settings.DEEPSEEK_API_KEY
    if not key:
        await websocket.close(code=4001, reason="Missing DEEPSEEK_API_KEY")
        return

    try:
        while True:
            # 接收客户端消息
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw) if isinstance(raw, str) else raw
            except json.JSONDecodeError:
                msg = {"content": raw}

            # 构造 DeepSeek 请求体
            if isinstance(msg, dict) and "messages" in msg:
                body = msg
                body.setdefault("model", model)
                body["stream"] = True
            else:
                content = msg.get("content", raw) if isinstance(msg, dict) else str(msg)
                body = {
                    "model": model,
                    "messages": [{"role": "user", "content": content}],
                    "stream": True,
                }

            # 发起 SSE 请求并逐行转发
            async with httpx.AsyncClient() as client:
                try:
                    async with client.stream(
                        "POST",
                        _DEEPSEEK_URL,
                        headers=_headers(api_key),
                        json=body,
                        timeout=60,
                    ) as resp:
                        if resp.status_code != 200:
                            err_text = await resp.aread()
                            await websocket.send_text(
                                json.dumps(
                                    {"type": "error", "data": {"message": f"DeepSeek API error: {resp.status_code}", "detail": err_text.decode(errors='replace')[:200]}}
                                )
                            )
                            continue

                        async for line in resp.aiter_lines():
                            if not line:
                                continue
                            # 转发 SSE 行
                            await websocket.send_text(line)
                except httpx.ConnectError as e:
                    logger.error(f"DeepSeek WS connect error: {e}")
                    await websocket.send_text(
                        json.dumps({"type": "error", "data": {"message": f"连接 DeepSeek API 失败: {e}"}})
                    )
                except httpx.ReadTimeout:
                    logger.warning("DeepSeek WS read timeout")
                    await websocket.send_text(
                        json.dumps({"type": "error", "data": {"message": "DeepSeek API 响应超时"}})
                    )

    except WebSocketDisconnect:
        logger.debug(f"DeepSeek WS client disconnected: user={user_uuid}")
    except Exception as e:
        logger.error(f"DeepSeek WS error: {e}")
        with contextlib.suppress(Exception):
            await websocket.close(code=4002, reason=str(e))
