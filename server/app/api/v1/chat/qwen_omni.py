"""通义千问 Qwen Omni WebSocket 代理路由."""

import contextlib
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.config import settings
from app.core.tracking import EVENT_CHAT_SEND, track_event, track_funnel
from app.ws.auth_decorator import ws_require_auth

router = APIRouter()


@router.websocket("/ws/qwen-omni")
@ws_require_auth
async def qwen_omni_ws(
    websocket: WebSocket,
    user_uuid: str = "",
    model: str = Query("qwen-omni"),
    api_key: str | None = Query(None),
):
    """Qwen Omni WebSocket 实时语音/视频对话代理.

    客户端通过 WebSocket 发送音频/视频帧,代理转发到 DashScope Omni API.
    """
    await websocket.accept()
    key = api_key or settings.DASHSCOPE_API_KEY
    track_event(EVENT_CHAT_SEND, user_id="ws_anonymous", channel="qwen_omni_ws", model=model)
    track_funnel("chat", "send", user_id="ws_anonymous", channel="qwen_omni_ws")
    if not key:
        await websocket.close(code=4001, reason="Missing DASHSCOPE_API_KEY")
        return

    try:
        dashscope_ws_url = f"wss://dashscope.aliyuncs.com/api-ws/v1/realtime/" f"?model={model}"
        import websockets

        async with websockets.connect(
            dashscope_ws_url,
            additional_headers={"Authorization": f"Bearer {key}"},
        ) as ds_ws:
            # 认证握手
            await ds_ws.send(
                json.dumps(
                    {
                        "header": {"action": "session.updated"},
                        "payload": {
                            "session_configuration": {
                                "modalities": ["text", "audio"],
                                "voice": "longxiaochun",
                            }
                        },
                    }
                )
            )

            async def forward_client_to_ds():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        await ds_ws.send(data)
                except WebSocketDisconnect:
                    logger.debug("func")
                    pass
                except Exception as e:
                    logger.debug(f"Client->DS forward ended: {e}")

            async def forward_ds_to_client():
                try:
                    async for msg in ds_ws:
                        if isinstance(msg, bytes):
                            await websocket.send_bytes(msg)
                        else:
                            await websocket.send_text(msg)
                except Exception as e:
                    logger.debug(f"DS->Client forward ended: {e}")

            import asyncio

            await asyncio.gather(
                forward_client_to_ds(),
                forward_ds_to_client(),
                return_exceptions=True,
            )
    except Exception as e:
        logger.error(f"Qwen Omni WS error: {e}")
        with contextlib.suppress(Exception):
            await websocket.close(code=4002, reason=str(e))
