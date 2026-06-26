"""WebSocket 实时语音识别 -- 迁移自 coze_zhs_py/api/websocket_audio.py

提供两个 WebSocket 端点:
- /cozeZhsApi/ws/audio/speech/{client_id}        实时语音识别
- /cozeZhsApi/ws/audio/transcriptions/{client_id} 实时语音转录

客户端通过二进制帧发送音频分片, 服务端累积达到阈值后调用 DashScope ASR
(paraformer-v2) 返回中间识别结果; 客户端发送 {"command":"end"} 触发最终识别
并关闭连接. 复用 audio/route.py 的 DashScope HTTP ASR 能力 (项目当前未接入
阿里云 NLS WebSocket 实时流, 此实现以累积分片 + HTTP ASR 兜底).
"""

import asyncio
import base64
import json
from typing import Any

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger

from app.config import settings

router = APIRouter(prefix="/cozeZhsApi/ws/audio", tags=["WebSocket 实时语音"])

# DashScope 基础 URL (兼容 settings.DASHSCOPE_BASE_URL 缺失场景)
DASHSCOPE_BASE = getattr(settings, "DASHSCOPE_BASE_URL", None) or "https://dashscope.aliyuncs.com/api/v1"

# 触发中间识别的音频累积阈值 (字节): 32KB 约对应 1s 16kHz 16bit PCM
ASR_CHUNK_THRESHOLD = 32 * 1024
# 单次 ASR 请求超时 (秒)
ASR_REQUEST_TIMEOUT = 60.0


class ConnectionManager:
    """WebSocket 连接管理器, 使用 asyncio.Lock 防并发冲突."""

    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_id: str) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str) -> None:
        self.active_connections.pop(client_id, None)

    async def send_message(self, message: dict[str, Any], client_id: str) -> None:
        ws = self.active_connections.get(client_id)
        if ws is None:
            return
        try:
            await ws.send_text(json.dumps(message, ensure_ascii=False))
        except Exception as e:
            logger.debug(f"WebSocket send_message 失败 client={client_id}: {e}")

    async def send_binary(self, data: bytes, client_id: str) -> None:
        ws = self.active_connections.get(client_id)
        if ws is None:
            return
        try:
            await ws.send_bytes(data)
        except Exception as e:
            logger.debug(f"WebSocket send_binary 失败 client={client_id}: {e}")


manager = ConnectionManager()


def _ds_headers(async_mode: bool = False) -> dict:
    """DashScope 鉴权头."""
    h = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    if async_mode:
        h["X-DashScope-Async"] = "enable"
    return h


async def _recognize_chunk(audio_bytes: bytes, language: str | None, base_url: str) -> dict[str, Any]:
    """调用 DashScope paraformer-v2 识别一段音频字节, 返回 {text, raw}."""
    if not audio_bytes:
        return {"text": "", "raw": {}}
    try:
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        payload: dict[str, Any] = {
            "model": "paraformer-v2",
            "input": {
                "file_urls": [f"data:audio/wav;base64,{audio_b64}"],
            },
            "parameters": {"sample_rate": 16000},
        }
        if language:
            payload["parameters"]["language_hints"] = [language]

        url = f"{base_url}/services/audio/asr/transcription"
        async with httpx.AsyncClient(timeout=ASR_REQUEST_TIMEOUT) as client:
            resp = await client.post(url, headers=_ds_headers(async_mode=True), json=payload)
            data = resp.json()

        text = ""
        output = data.get("output", {}) if isinstance(data, dict) else {}
        results = output.get("results", []) or []
        for r in results:
            text += r.get("transcription_text", "")
        return {"text": text, "raw": data}
    except Exception as e:
        logger.debug(f"_recognize_chunk 异常: {e}")
        return {"text": "", "raw": {}, "error": str(e)}


async def _run_ws_session(
    websocket: WebSocket,
    client_id: str,
    language: str | None,
    base_url_override: str | None,
    save_path: str | None,
    event_prefix: str,
) -> None:
    """WebSocket 语音会话通用逻辑.

    event_prefix: "speech_recognize" / "transcription"
    """
    base_url = base_url_override or DASHSCOPE_BASE
    await manager.connect(websocket, client_id)
    logger.info(f"WebSocket /{event_prefix} 连接建立 client_id={client_id} language={language}")

    audio_buffer = bytearray()
    save_fp = None
    if save_path:
        try:
            save_fp = open(save_path, "wb")
        except Exception as e:
            logger.debug(f"打开 save_path 失败: {e}")

    try:
        await manager.send_message(
            {
                "type": "system",
                "event": "connected",
                "content": "WebSocket 语音连接已建立",
                "language": language,
            },
            client_id,
        )

        while True:
            data = await websocket.receive()

            if "bytes" in data and data["bytes"] is not None:
                chunk = data["bytes"]
                audio_buffer.extend(chunk)
                if save_fp:
                    try:
                        save_fp.write(chunk)
                    except Exception as e:
                        logger.debug(f"写入 save_path 失败: {e}")

                # 累积达到阈值, 触发中间识别
                if len(audio_buffer) >= ASR_CHUNK_THRESHOLD:
                    result = await _recognize_chunk(bytes(audio_buffer), language, base_url)
                    await manager.send_message(
                        {
                            "type": f"{event_prefix}_interim",
                            "content": result.get("text", ""),
                            "buffer_size": len(audio_buffer),
                        },
                        client_id,
                    )

            elif "text" in data and data["text"] is not None:
                try:
                    msg = json.loads(data["text"])
                except json.JSONDecodeError:
                    await manager.send_message(
                        {"type": "error", "content": "无效的 JSON 格式"},
                        client_id,
                    )
                    continue

                cmd = msg.get("command") if isinstance(msg, dict) else None
                if cmd in ("end", "close"):
                    result = await _recognize_chunk(bytes(audio_buffer), language, base_url)
                    await manager.send_message(
                        {
                            "type": f"{event_prefix}_final",
                            "content": result.get("text", ""),
                            "buffer_size": len(audio_buffer),
                        },
                        client_id,
                    )
                    await manager.send_message(
                        {"type": "system", "content": "连接已主动关闭"},
                        client_id,
                    )
                    break

    except WebSocketDisconnect:
        logger.info(f"WebSocket /{event_prefix} 客户端断开 client_id={client_id}")
    except Exception as e:
        logger.debug(f"WebSocket /{event_prefix} 异常 client_id={client_id}: {e}")
        try:
            await manager.send_message(
                {"type": "error", "content": f"发生错误: {e}"},
                client_id,
            )
        except Exception:
            pass
    finally:
        manager.disconnect(client_id)
        if save_fp:
            try:
                save_fp.close()
            except Exception:
                pass


@router.websocket("/speech/{client_id}")
async def websocket_speech(
    websocket: WebSocket,
    client_id: str,
    language: str | None = Query("zh-CN"),
    token: str | None = Query(None),
    base_url: str | None = Query(None),
    save_path: str | None = Query(None),
):
    """WebSocket 实时语音识别端点.

    客户端通过二进制帧发送音频分片, 服务端累积达到阈值后调用 DashScope ASR
    返回中间识别结果; 客户端发送 {"command":"end"} 触发最终识别并关闭连接.

    查询参数:
    - language: 识别语言 (默认 zh-CN)
    - token:    鉴权令牌 (历史兼容, 当前实现统一走 settings.DASHSCOPE_API_KEY)
    - base_url: DashScope 基础 URL (可选覆盖)
    - save_path: 音频保存路径 (可选)
    """
    await _run_ws_session(websocket, client_id, language, base_url, save_path, "speech_recognize")


@router.websocket("/transcriptions/{client_id}")
async def websocket_transcriptions(
    websocket: WebSocket,
    client_id: str,
    language: str | None = Query("zh-CN"),
    token: str | None = Query(None),
    base_url: str | None = Query(None),
    save_path: str | None = Query(None),
):
    """WebSocket 实时语音转录端点.

    行为与 /speech 一致, 事件类型使用 transcription_* 前缀以区分.

    查询参数:
    - language: 转录语言 (默认 zh-CN)
    - token:    鉴权令牌 (历史兼容)
    - base_url: DashScope 基础 URL (可选覆盖)
    - save_path: 音频保存路径 (可选)
    """
    await _run_ws_session(
        websocket, client_id, language, base_url, save_path, "transcription"
    )
