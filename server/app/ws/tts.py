"""TTS 文字转语音 WS 端点."""

import asyncio
import json
import time
import uuid
from collections.abc import Iterator

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.ws.auth_decorator import ws_require_auth
from app.ws.manager import connection_manager

router = APIRouter()


@router.websocket("/ws/tts")
@ws_require_auth
async def tts_ws(ws: WebSocket, user_uuid: str = Query(""), voice: str = Query("zh_female_01")):
    """TTS WS 端点.

    客户端发送: {"text": "你好世界"}
    服务端推送:
      {"event": "audio", "chunk": "<base64>", "idx": 0}
      {"event": "end"}
    """
    conn_id = f"tts_{user_uuid}_{uuid.uuid4().hex[:6]}"
    await connection_manager.connect(conn_id, ws, user_uuid=user_uuid)
    try:
        await ws.send_text(json.dumps({"event": "ready", "voice": voice}))
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            text = msg.get("text", "")
            if not text:
                continue
            # 模拟:按 16KB 一块切片(真实接入阿里云/腾讯云 TTS 流式协议)
            await ws.send_text(json.dumps({"event": "start", "text": text[:50], "ts": time.time()}))
            idx = 0
            for chunk in _fake_audio_chunks(text, voice):
                await ws.send_text(json.dumps({"event": "audio", "idx": idx, "chunk": chunk}))
                idx += 1
                await asyncio.sleep(0.05)
            await ws.send_text(json.dumps({"event": "end", "chunks": idx}))
    except WebSocketDisconnect:
        pass
    finally:
        await connection_manager.disconnect(conn_id)


def _fake_audio_chunks(text: str, voice: str) -> Iterator[str]:
    """生成 fake 音频块(生产应替换为真实 TTS 流)."""
    import base64

    silence_chunk = base64.b64encode(b"\x00" * 1024).decode("utf-8")
    chunk_count = max(1, len(text) // 8)
    for _ in range(chunk_count):
        yield silence_chunk
