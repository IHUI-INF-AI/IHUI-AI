"""智谱 Zhipu AI WebSocket 代理路由."""

import contextlib
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.config import settings
from app.ws.auth_decorator import ws_require_auth

router = APIRouter()


@router.websocket("/ws/zhipu")
@ws_require_auth
async def zhipu_ws(
    websocket: WebSocket,
    user_uuid: str = "",
    model: str = Query("glm-4"),
    api_key: str | None = Query(None),
):
    """智谱 GLM-4 WebSocket 实时对话代理.

    客户端通过 WebSocket 发送文本消息,代理转发到智谱 AI ChatGLM API.
    """
    await websocket.accept()
    key = api_key or settings.ZHIPU_API_KEY
    if not key:
        await websocket.close(code=4001, reason="Missing ZHIPU_API_KEY")
        return

    try:
        import websockets

        ws_url = "wss://open.bigmodel.cn/api/paas/v4/chat/completions"
        async with websockets.connect(
            ws_url,
            additional_headers={
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
            },
        ) as ds_ws:
            # 发送初始配置
            await ds_ws.send(
                json.dumps(
                    {
                        "model": model,
                        "stream": True,
                    }
                )
            )

            async def forward_client_to_ds():
                try:
                    while True:
                        data = await websocket.receive_text()
                        msg = json.loads(data) if isinstance(data, str) else data
                        if isinstance(msg, dict) and "messages" not in msg:
                            msg = {
                                "model": model,
                                "messages": [{"role": "user", "content": msg.get("content", data)}],
                                "stream": True,
                            }
                        await ds_ws.send(json.dumps(msg) if isinstance(msg, dict) else msg)
                except WebSocketDisconnect:
                    logger.debug("func")
                    pass
                except Exception as e:
                    logger.debug(f"Client->Zhipu forward ended: {e}")

            async def forward_ds_to_client():
                try:
                    async for msg in ds_ws:
                        await websocket.send_text(msg if isinstance(msg, str) else msg.decode())
                except Exception as e:
                    logger.debug(f"Zhipu->Client forward ended: {e}")

            import asyncio

            await asyncio.gather(
                forward_client_to_ds(),
                forward_ds_to_client(),
                return_exceptions=True,
            )
    except Exception as e:
        logger.error(f"Zhipu WS error: {e}")
        with contextlib.suppress(Exception):
            await websocket.close(code=4002, reason=str(e))
