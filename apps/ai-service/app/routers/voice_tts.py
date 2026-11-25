# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""免费 TTS 语音合成(edge-tts,零 key 零成本)。

- 零成本:不需要任何厂商凭据
- 中文质量高:默认 zh-CN-XiaoxiaoNeural(晓晓),支持多种中文/英文/日语声音
- 输出 MP3 音频字节(音频/mpeg),可直接播放
- 失败降级:网络不可达时返回 503 + 明确提示(不抛 500)
- 声纹克隆/异步 TTS 入口保留但已停用，统一返回 503。

用法:
    POST /voice/tts  {"text": "你好", "voice": "zh-CN-XiaoxiaoNeural", "rate": "+0%"}
    → 200 audio/mpeg 音频流
    POST /voice/tts/stream {"text": "第一句。第二句。"}
    → 200 application/x-ndjson:policy(打断判据)→ segment × N → done(逐段流式)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from ..core.jwt_auth import require_request_user_id

logger = logging.getLogger(__name__)

router = APIRouter()

# 常用声音白名单(edge-tts 官方 voices 子集,防滥用任意 voice 参数)
VOICE_WHITELIST: set[str] = {
    # 中文
    "zh-CN-XiaoxiaoNeural",  # 晓晓(女,默认)
    "zh-CN-YunxiNeural",     # 云希(男)
    "zh-CN-YunyangNeural",   # 云扬(新闻男)
    "zh-CN-liaoning-XiaobeiNeural",  # 辽宁小北(东北话)
    "zh-CN-shaanxi-XiaoniNeural",    # 陕西小妮
    "zh-TW-HsiaoChenNeural",  # 台湾晓臻
    "zh-HK-HiuMaanNeural",    # 香港晓曼
    # 英文
    "en-US-AriaNeural",
    "en-US-GuyNeural",
    "en-GB-SoniaNeural",
    # 日/韩
    "ja-JP-NanamiNeural",
    "ko-KR-SunHiNeural",
}

DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
MAX_TEXT_CHARS = 2000  # 单次合成长度上限(防滥用)
VOICE_CLONE_UNAVAILABLE = "声纹克隆供应商已下线，当前不可用"
ASYNC_TTS_UNAVAILABLE = "异步语音供应商已下线，当前不可用"


class TTSRequest(BaseModel):
    """TTS 合成请求。"""

    text: str = Field(..., description="要合成的文本(≤2000 字符)")
    voice: str = Field(default=DEFAULT_VOICE, description="声音(白名单内)")
    rate: str = Field(default="+0%", description="语速,如 +10% / -20%")
    engine: str = Field(default="edge", description="TTS 引擎(仅 edge)")


class TTSStreamRequest(BaseModel):
    """逐段流式合成请求(barge-in 用;仅 edge 免费引擎)。"""

    text: str = Field(..., description="要合成的文本(≤2000 字符,按句读切段)")
    voice: str = Field(default=DEFAULT_VOICE, description="声音(白名单内)")
    rate: str = Field(default="+0%", description="语速,如 +10% / -20%")


def _require_admin(request: Request) -> None:
    """声纹库删除守卫:共享资源破坏性操作仅限 admin(roleId>=1)。"""
    role_id = getattr(request.state, "role_id", 0) or 0
    if int(role_id) < 1:
        raise HTTPException(status_code=403, detail="声纹库删除仅限管理员操作")


def _ndjson(event: dict[str, Any]) -> str:
    """一行 NDJSON;中文不转义(客户端直接按 UTF-8 解析)。"""
    return json.dumps(event, ensure_ascii=False) + "\n"


@router.post("/voice/tts")
async def synthesize_tts(
    req: TTSRequest,
    _user_id: str = Depends(require_request_user_id),
) -> Response:
    """免费 TTS 合成(edge-tts,零 key)。返回 audio/mpeg 音频流。"""
    if req.engine != "edge":
        raise HTTPException(status_code=400, detail="当前仅支持 edge 引擎")
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"text 超长({len(text)}>{MAX_TEXT_CHARS} 字符)",
        )
    rate = req.rate if req.rate.startswith(("+", "-")) and req.rate.endswith("%") else "+0%"
    if req.voice not in VOICE_WHITELIST:
        raise HTTPException(status_code=400, detail=f"voice 不在白名单: {req.voice}")
    try:
        from ..providers.free_voice_provider import FreeVoiceProvider, VoiceProviderError

        audio, content_type = await FreeVoiceProvider().tts(text, voice=req.voice, rate=rate)
        return Response(
            content=audio,
            media_type=content_type or "audio/mpeg",
            headers={"X-TTS-Engine": "edge-tts", "X-TTS-Voice": req.voice},
        )
    except VoiceProviderError as e:
        status = e.status_code if e.status_code == 400 else 503
        logger.warning("免费 TTS 合成失败(edge-tts): %s", e)
        raise HTTPException(status_code=status, detail=str(e)) from None


@router.post("/voice/tts/stream")
async def synthesize_tts_stream(req: TTSStreamRequest) -> StreamingResponse:
    """逐段流式 TTS(NDJSON):policy → segment × N → done。"""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"text 超长({len(text)}>{MAX_TEXT_CHARS} 字符)",
        )
    if req.voice not in VOICE_WHITELIST:
        raise HTTPException(status_code=400, detail=f"voice 不在白名单: {req.voice}")
    rate = req.rate if req.rate.startswith(("+", "-")) and req.rate.endswith("%") else "+0%"

    from ..core.voice_barge_in import policy_payload, split_speech_segments

    segments = split_speech_segments(text)
    policy = policy_payload()

    async def _events() -> AsyncIterator[str]:
        yield _ndjson(policy)
        from ..providers.free_voice_provider import FreeVoiceProvider, VoiceProviderError

        provider = FreeVoiceProvider()
        emitted = 0
        for index, segment in enumerate(segments):
            try:
                audio, content_type = await provider.tts(
                    segment, voice=req.voice, rate=rate,
                )
            except asyncio.CancelledError:
                raise
            except VoiceProviderError as e:
                yield _ndjson({
                    "type": "error",
                    "stage": "tts",
                    "index": index,
                    "status": e.status_code,
                    "message": str(e),
                })
                return
            yield _ndjson({
                "type": "segment",
                "index": index,
                "total": len(segments),
                "text": segment,
                "contentType": content_type or "audio/mpeg",
                "audioBase64": base64.b64encode(audio).decode("ascii"),
            })
            emitted += 1
        yield _ndjson({"type": "done", "segments": emitted})

    return StreamingResponse(
        _events(),
        media_type="application/x-ndjson",
        headers={
            "X-TTS-Engine": "edge-tts",
            "X-TTS-Voice": req.voice,
            "X-Barge-In-Policy": policy["policy"],
            "Cache-Control": "no-store",
        },
    )


@router.get("/voice/voices")
async def list_voices() -> dict[str, Any]:
    """声纹库列表入口已停用。"""
    raise HTTPException(status_code=503, detail=VOICE_CLONE_UNAVAILABLE)


@router.post("/voice/voices")
async def upload_voice(
    file: UploadFile = File(..., description="参考音频(wav/mp3,建议 10~30s 干声)"),
) -> dict[str, Any]:
    """声纹上传入口已停用。"""
    raise HTTPException(status_code=503, detail=VOICE_CLONE_UNAVAILABLE)


@router.get("/voice/voices/{voice_id}")
async def get_voice(voice_id: str) -> dict[str, Any]:
    """单声纹查询入口已停用。"""
    raise HTTPException(status_code=503, detail=VOICE_CLONE_UNAVAILABLE)


@router.delete("/voice/voices/{voice_id}")
async def delete_voice(
    voice_id: str,
    _admin: None = Depends(_require_admin),
) -> dict[str, Any]:
    """声纹删除入口已停用。"""
    raise HTTPException(status_code=503, detail=VOICE_CLONE_UNAVAILABLE)


class AsyncTTSRequest(BaseModel):
    """异步语音请求(入口保留,当前不可用)。"""

    text: str = Field(..., min_length=1, max_length=5000, description="要合成的文本(≤5000 字符)")
    voice: str = Field("alloy", description="声音")
    model: str | None = Field(None, description="可选模型")
    speed: float = Field(1.0, description="语速倍率 0.25~4.0")


@router.post("/voice/tts-async")
async def tts_async(req: AsyncTTSRequest) -> dict[str, Any]:
    """异步 TTS 入口已停用。"""
    raise HTTPException(status_code=503, detail=ASYNC_TTS_UNAVAILABLE)


@router.get("/voice/tts-async/{task_id}")
async def tts_async_status(task_id: str) -> dict[str, Any]:
    """异步 TTS 查询入口已停用。"""
    raise HTTPException(status_code=503, detail=ASYNC_TTS_UNAVAILABLE)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
