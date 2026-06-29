"""真实 TTS WebSocket(对接 qwen3-tts-flash-realtime SDK).

迁移自 ZHS_Server_java/mcp/websocket/TtsWebSocket.java.
使用 DashScope SDK 流式合成 TTS,PCM 转 WAV 并上传 MinIO.
"""

import asyncio
import contextlib
import io
import json
import time
import wave
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

router = APIRouter()

SAMPLE_RATE = 24000
SAMPLE_WIDTH = 2
CHANNELS = 1


def _pcm_to_wav(pcm_data: bytes) -> bytes:
    """将 PCM 数据打包成 WAV 格式."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm_data)
    return buf.getvalue()


async def _send(websocket: WebSocket, payload: dict[str, Any]) -> None:
    with contextlib.suppress(Exception):
        await websocket.send_text(json.dumps(payload, ensure_ascii=False))


async def _stream_synthesize(text: str, voice: str = "Cherry", model: str = "qwen3-tts-flash-realtime") -> bytes:
    """调用 qwen3-tts-flash-realtime SDK 合成 TTS, 返回完整 PCM 字节流."""
    try:
        from dashscope.audio.tts import SpeechSynthesizer
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: SpeechSynthesizer.call(
                model=model,
                text=text,
                voice=voice,
                format="pcm",
                sample_rate=SAMPLE_RATE,
            ),
        )
        if result and result.get_audio_data():
            return result.get_audio_data()
    except ImportError:
        logger.warning("dashscope SDK 未安装, 使用本地 wav 占位")
    except Exception as e:
        logger.error(f"TTS 合成失败: {e}")
    return b""


@router.websocket("/ws/tts/stream")
async def tts_stream_ws(websocket: WebSocket):
    """TTS 实时合成 WebSocket 端点.

    流程:客户端发送 {"action":"synthesize","text":"...","voice":"Cherry","model":"qwen3-tts-flash-realtime"}
         服务端合成完成后推送 {"event":"audio.chunk", "data":"<base64>"} 多帧
         末尾推送 {"event":"audio.done","url":"<wav_url>"}
    """
    await websocket.accept()
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=180)
            except TimeoutError:
                break
            except WebSocketDisconnect:
                break
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await _send(websocket, {"code": 400, "event": "error", "message": "JSON 格式错误"})
                continue
            action = message.get("action")
            if action == "synthesize":
                text = message.get("text", "")
                voice = message.get("voice", "Cherry")
                model = message.get("model", "qwen3-tts-flash-realtime")
                if not text:
                    await _send(websocket, {"code": 400, "event": "error", "message": "缺少 text"})
                    continue
                await _send(websocket, {"code": 0, "event": "task.start", "timestamp": int(time.time() * 1000)})
                pcm_data = await _stream_synthesize(text, voice, model)
                if not pcm_data:
                    await _send(websocket, {"code": 500, "event": "task.error", "message": "TTS 合成失败"})
                    continue
                chunk_size = 8192
                for i in range(0, len(pcm_data), chunk_size):
                    chunk = pcm_data[i:i + chunk_size]
                    import base64
                    await _send(websocket, {
                        "code": 0,
                        "event": "audio.chunk",
                        "data": base64.b64encode(chunk).decode("ascii"),
                        "format": "pcm",
                        "sample_rate": SAMPLE_RATE,
                    })
                wav_data = _pcm_to_wav(pcm_data)
                try:
                    from app.utils.minio_util import upload_bytes
                    url = await upload_bytes(wav_data, f"tts_{int(time.time())}.wav", "audio/wav")
                except Exception:
                    url = ""
                await _send(websocket, {"code": 0, "event": "audio.done", "url": url, "size": len(pcm_data)})
            elif action == "ping":
                await _send(websocket, {"code": 0, "event": "pong", "timestamp": int(time.time() * 1000)})
            else:
                await _send(websocket, {"code": 400, "event": "error", "message": f"未知 action: {action}"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"TTS WebSocket 异常: {e}")
    finally:
        with contextlib.suppress(Exception):
            await websocket.close()
