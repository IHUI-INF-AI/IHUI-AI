"""Agent 流式响应 WS 端点 - 把 Coze/AI 模型流式 token 推到前端."""

import json
import time
import uuid

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.config import settings
from app.ws.auth_decorator import ws_require_auth
from app.ws.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/agent/stream")
@ws_require_auth
async def agent_stream(ws: WebSocket, user_uuid: str = Query(""), bot_id: str = Query("default")):
    """Agent 流式聊天: 接收用户文本 → 调用 Coze 流式 → 实时下发 delta.

    客户端只需发送: {"text": "你好"}
    服务端推送事件:
      {"event": "start"}      开始
      {"event": "delta", "text": "..."}  增量
      {"event": "done"}       结束
    """
    conn_id = f"agent_{user_uuid}_{uuid.uuid4().hex[:6]}"
    await connection_manager.connect(conn_id, ws, user_uuid=user_uuid)
    try:
        await ws.send_text(json.dumps({"event": "ready", "bot_id": bot_id}))
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            text = msg.get("text", "")
            if not text:
                continue
            await ws.send_text(json.dumps({"event": "start", "ts": time.time()}))
            headers = {"Authorization": f"Bearer {settings.COZE_PRIVATE_KEY}", "Content-Type": "application/json"}
            body = {
                "bot_id": bot_id,
                "user_id": user_uuid,
                "additional_messages": [{"role": "user", "content": text, "content_type": "text"}],
                "stream": True,
            }
            try:
                async with httpx.AsyncClient(timeout=60) as client, client.stream(
                    "POST",
                    f"{settings.COZE_API_BASE}/v3/chat",
                    headers=headers,
                    json=body,
                ) as resp:
                    async for line in resp.aiter_lines():
                        if not line:
                            continue
                        await ws.send_text(json.dumps({"event": "delta", "raw": line}))
            except Exception as e:
                logger.error(f"Agent stream error: {e}")
                await ws.send_text(json.dumps({"event": "error", "msg": str(e)}))
            finally:
                await ws.send_text(json.dumps({"event": "done"}))
    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(conn_id)
