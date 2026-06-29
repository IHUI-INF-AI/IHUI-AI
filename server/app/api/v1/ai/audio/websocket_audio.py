"""
WebSocket real-time audio recognition endpoint.

Ported from historical project:
  - H:/历史项目存档/ljd-交接文件/coze_zhs_py/api/websocket_audio.py

Historical note: the original WebSocket audio endpoint returned a
"功能暂不可用，请使用HTTP API" notice because the real-time Coze audio SDK
was not integrated. This port preserves that behavior honestly rather than
fabricating a non-functional ASR pipeline. Binary audio frames are acknowledged
but not transcribed; clients should use the HTTP /recognize endpoint instead.
"""

from __future__ import annotations

import json
import logging
import uuid
from enum import StrEnum
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

logger = logging.getLogger("websocket_audio")

router = APIRouter(prefix="/ws/audio", tags=["WebSocket音频"])


class WebSocketAudioEventType(StrEnum):
    """WebSocket audio event types (ported from historical websocket_audio.py)."""

    WEBSOCKET_CONNECTED = "websocket_connected"
    WEBSOCKET_CLOSED = "websocket_closed"
    WEBSOCKET_ERROR = "websocket_error"
    SPEECH_RECOGNIZE_FINAL = "speech_recognize_final"
    SPEECH_RECOGNIZE_INTERIM = "speech_recognize_interim"


class WebSocketSpeechType(StrEnum):
    """WebSocket speech payload types."""

    TEXT = "text"
    AUDIO = "audio"


class ConnectionManager:
    """WebSocket connection manager (ported from historical websocket_audio.py)."""

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str) -> None:
        """Remove a WebSocket connection."""
        self.active_connections.pop(client_id, None)

    async def send_message(self, message: dict[str, Any], client_id: str) -> None:
        """Send a JSON text message to a specific client."""
        ws = self.active_connections.get(client_id)
        if ws is not None:
            await ws.send_text(json.dumps(message, ensure_ascii=False))

    async def send_binary(self, data: bytes, client_id: str) -> None:
        """Send binary data to a specific client."""
        ws = self.active_connections.get(client_id)
        if ws is not None:
            await ws.send_bytes(data)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a JSON message to all connected clients."""
        for ws in self.active_connections.values():
            await ws.send_text(json.dumps(message, ensure_ascii=False))


# Singleton connection manager
manager = ConnectionManager()


@router.websocket("/realtime")
async def websocket_audio_realtime(
    websocket: WebSocket,
    language: str | None = Query("zh-CN"),
    token: str | None = Query(None),
    save_path: str | None = Query(None),
) -> None:
    """实时音频识别 WebSocket 端点 (/ws/audio/realtime).

    接受客户端二进制音频分片并返回识别事件。历史项目中该端点未接入真实
    ASR 管线，仅回执"暂不可用"提示，客户端应改用 HTTP /recognize 接口。

    Query params:
        language: recognition language (default zh-CN).
        token: optional client token, reused as client_id.
        save_path: optional audio save path (reserved).
    """
    client_id = token or uuid.uuid4().hex
    await manager.connect(websocket, client_id)

    try:
        # Notify client the connection is established.
        await manager.send_message(
            {
                "type": WebSocketAudioEventType.WEBSOCKET_CONNECTED.value,
                "content": "WebSocket连接已建立，实时语音识别功能暂不可用，请使用HTTP /recognize 接口",
            },
            client_id,
        )

        while True:
            try:
                data = await websocket.receive()

                # Binary audio frame received; acknowledge without transcription.
                if "bytes" in data:
                    await manager.send_message(
                        {
                            "type": WebSocketAudioEventType.WEBSOCKET_ERROR.value,
                            "content": "实时语音识别功能暂不可用，请使用HTTP /recognize 接口",
                        },
                        client_id,
                    )
                # Text message (control command).
                elif "text" in data:
                    try:
                        message_data = json.loads(data["text"])
                    except json.JSONDecodeError:
                        await manager.send_message(
                            {"type": "error", "content": "无效的JSON格式"}, client_id
                        )
                        continue

                    if message_data.get("command") in ("end", "close"):
                        await manager.send_message(
                            {"type": "system", "content": "连接已主动关闭"}, client_id
                        )
                        break
            except WebSocketDisconnect:
                break
            except Exception as e:
                await manager.send_message(
                    {"type": "error", "content": f"处理消息出错: {e}"}, client_id
                )
                continue
    except WebSocketDisconnect:
        logger.info("客户端 %s 已断开连接", client_id)
    except Exception as e:
        await manager.send_message({"type": "error", "content": f"发生错误: {e}"}, client_id)
        logger.error("[WebSocketAudio] error: %s", e)
    finally:
        manager.disconnect(client_id)
