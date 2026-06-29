"""客服系统 WebSocket 端点.

前端 useCustomerServiceWebSocket.ts 连接 /customer-service/chat?token=&conversationId=
本端点提供实时消息推送、输入状态、已读回执等功能.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.ws.auth_decorator import ws_require_auth

router = APIRouter()


class CustomerServiceConnectionManager:
    """客服 WebSocket 连接管理器.

    管理按 conversationId 分组的 WebSocket 连接,
    支持向同一会话的所有连接广播消息.
    """

    def __init__(self) -> None:
        # conversationId -> set of WebSocket
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, conversation_id: str) -> None:
        await websocket.accept()
        if conversation_id not in self._connections:
            self._connections[conversation_id] = set()
        self._connections[conversation_id].add(websocket)
        logger.info(f"CS WS connected: conv={conversation_id}, total={len(self._connections[conversation_id])}")

    def disconnect(self, websocket: WebSocket, conversation_id: str) -> None:
        if conversation_id in self._connections:
            self._connections[conversation_id].discard(websocket)
            if not self._connections[conversation_id]:
                del self._connections[conversation_id]
        logger.debug(f"CS WS disconnected: conv={conversation_id}")

    async def broadcast(self, conversation_id: str, message: dict[str, Any]) -> None:
        """向同一会话的所有连接广播消息."""
        if conversation_id not in self._connections:
            return
        text = json.dumps(message, ensure_ascii=False, default=str)
        stale: list[WebSocket] = []
        for ws in self._connections[conversation_id]:
            try:
                await ws.send_text(text)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._connections[conversation_id].discard(ws)


cs_ws_manager = CustomerServiceConnectionManager()


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _make_staff_reply(conv_id: str, content: str | None = None) -> dict[str, Any]:
    """生成客服自动回复."""
    replies = [
        "您好,您的留言我们已收到,客服将尽快回复.如需紧急帮助请前往「工单」提交问题.",
        "感谢您的反馈,我们会尽快处理.您也可以先查看「常见问题」获取自助解答.",
        "已记录您的问题,工作时间内我们会优先回复.",
    ]
    import random

    return {
        "id": f"{conv_id}_staff_{uuid.uuid4().hex[:8]}",
        "type": "text",
        "content": content or random.choice(replies),
        "senderId": "customer-service-staff",
        "senderName": "智汇客服",
        "status": "sent",
        "createTime": _now_iso(),
    }


@router.websocket("/chat")
@ws_require_auth
async def customer_service_chat_ws(
    websocket: WebSocket,
    user_uuid: str = "",
    conversationId: str = Query("new"),
):
    """客服实时聊天 WebSocket 端点.

    前端连接: /customer-service/chat?token=<jwt>&conversationId=<conv_id>

    消息协议:
      客户端发送: {"type": "customer_service_message", "data": {"content": "...", "type": "text"}}
      服务端推送: {"type": "customer_service_message", "data": {msg_obj}}
                   {"type": "customer_service_typing", "data": {"userId": "...", "isTyping": true}}
                   {"type": "customer_service_read", "data": {"messageIds": [...]}}
                   {"type": "customer_service_conversation_id", "data": {"conversationId": "..."}}
    """
    conv_id = conversationId if conversationId and conversationId != "new" else str(uuid.uuid4())

    await cs_ws_manager.connect(websocket, conv_id)

    # 推送会话 ID
    await websocket.send_text(
        json.dumps(
            {"type": "customer_service_conversation_id", "data": {"conversationId": conv_id}},
            ensure_ascii=False,
        )
    )

    # 注入到 customer_service_routes 的推送回调
    from app.api.v1.customer_service.customer_service_routes import (
        set_push_to_ws_callback,
    )

    async def push_callback(conv: str, msg: dict) -> None:
        await cs_ws_manager.broadcast(conv, {"type": "customer_service_message", "data": msg})

    set_push_to_ws_callback(push_callback)

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps({"type": "error", "data": {"message": "Invalid JSON"}}, ensure_ascii=False)
                )
                continue

            msg_type = msg.get("type", "")
            data = msg.get("data", {})

            if msg_type == "customer_service_message":
                # 用户发送消息 → 广播给会话内所有连接 + 自动回复
                user_msg = {
                    "id": f"{conv_id}_{uuid.uuid4().hex[:12]}",
                    "type": data.get("type", "text"),
                    "content": data.get("content", ""),
                    "senderId": user_uuid or "user",
                    "senderName": "用户",
                    "status": "sent",
                    "createTime": _now_iso(),
                }
                await cs_ws_manager.broadcast(conv_id, {"type": "customer_service_message", "data": user_msg})

                # 模拟客服回复 (延迟 600ms)
                await asyncio.sleep(0.6)
                staff_msg = _make_staff_reply(conv_id)
                await cs_ws_manager.broadcast(conv_id, {"type": "customer_service_message", "data": staff_msg})

            elif msg_type == "customer_service_typing":
                # 输入状态广播
                await cs_ws_manager.broadcast(
                    conv_id,
                    {"type": "customer_service_typing", "data": {"userId": user_uuid, "isTyping": data.get("isTyping", False)}},
                )

            elif msg_type == "customer_service_read":
                # 已读回执广播
                await cs_ws_manager.broadcast(
                    conv_id,
                    {"type": "customer_service_read", "data": {"messageIds": data.get("messageIds", [])}},
                )

    except WebSocketDisconnect:
        cs_ws_manager.disconnect(websocket, conv_id)
        logger.debug(f"CS WS client disconnected: conv={conv_id}")
    except Exception as e:
        logger.error(f"CS WS error: {e}")
        cs_ws_manager.disconnect(websocket, conv_id)
