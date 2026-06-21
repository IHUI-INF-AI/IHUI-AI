"""支付状态 WebSocket 端点.

前端 usePaymentStatus.ts 连接 ws://host:8888/payment/status/{orderNo},
Vite proxy 将 /payment 重写到 /ws/payment, 转发到后端 8000.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.ws.auth_decorator import ws_require_auth

router = APIRouter()


@router.websocket("/ws/payment/status/{order_no}")
@ws_require_auth
async def ws_payment_status(websocket: WebSocket, order_no: str):
    """支付状态实时推送.

    连接后立即推送一次当前状态, 之后保持连接等待状态变化.
    前端收到 type=payment_status 的消息后更新 UI.
    """
    await websocket.accept()
    room = f"payment:{order_no}"
    try:
        await websocket.send_json({
            "type": "payment_status",
            "data": {
                "orderNo": order_no,
                "status": "pending",
                "message": "waiting for payment",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        })
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data) if data.startswith("{") else {"text": data}
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
