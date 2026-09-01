# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​​‌​​​‍​‌​‌​‌​‌‍​‌​​‌​​‌‍​​‌​‌‌​‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌​​‌‌‌‌​‌​‍​‌‌​‌‌​​​‌​​​‌‌‌‍​‌​​​​​‌‍​‌​​‌​​‌‍​‌‌​‌‌‌‍​‌‌​​‌‌‌​‌​​‌‌‌​‍​‌‌​​‌‌​​​‌​​‌​‌‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍​‌​‌‌​‌‌‌‍​‌​​‌‌​​‍​‌​​​​‌‌‍​‌​‌‌​‌‌‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍​‌‌‌​​‌‌‍​​‌​‌‌‌​‍​‌‌‌​‌​​‍​‌‌​‌‌‌‌‍​‌‌‌​​​​‍​‌​‌‌​‌‌‌‍​‌​‌​​​​‍​‌​‌​​‌​‍​‌​​‌‌‌‌‍​‌​‌​‌‌​‍​‌​​​‌​‌‍​‌​​‌‌‌​‍​‌​​​​​‌‍​‌​​‌‌‌​‍​‌​​​​‌‌‍​‌​​​‌​‌‍​​‌​‌‌​‌‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​⁠

"""免费 TTS 语音合成(edge-tts,零 key 零成本)。

对标 GPT-5 Voice / Gemini TTS:提供无需任何 API key 的中文/多语语音合成,
基于微软 Edge 的免费 TTS 服务(edge-tts 库)。适用于实时语音对话/朗读场景。

- 零成本:不需要 DASHSCOPE_API_KEY 等任何凭据
- 中文质量高:默认 zh-CN-XiaoxiaoNeural(晓晓),支持多种中文/英文/日语声音
- 输出 MP3 音频字节(音频/mpeg),可直接播放
- 失败降级:网络不可达时返回 503 + 明确提示(不抛 500)

用法:
    POST /voice/tts  {"text": "你好", "voice": "zh-CN-XiaoxiaoNeural", "rate": "+0%"}
    → 200 audio/mpeg 音频流
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

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


class TTSRequest(BaseModel):
    """TTS 合成请求。"""

    text: str = Field(..., description="要合成的文本(≤2000 字符)")
    voice: str = Field(default=DEFAULT_VOICE, description="声音(白名单内)")
    rate: str = Field(default="+0%", description="语速,如 +10% / -20%")


@router.post("/voice/tts")
async def synthesize_tts(req: TTSRequest) -> Response:
    """免费 TTS 合成(edge-tts,零 key)。返回 audio/mpeg 音频流。"""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="text 不能为空")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"text 超长({len(text)}>{MAX_TEXT_CHARS} 字符)",
        )
    if req.voice not in VOICE_WHITELIST:
        raise HTTPException(
            status_code=400,
            detail=f"voice 不在白名单: {req.voice}",
        )
    rate = req.rate if req.rate.startswith(("+", "-")) and req.rate.endswith("%") else "+0%"

    try:
        import edge_tts

        communicate = edge_tts.Communicate(text, voice=req.voice, rate=rate)
        chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                chunks.append(chunk["data"])
        if not chunks:
            raise RuntimeError("edge-tts 未返回音频数据")
        audio = b"".join(chunks)
        return Response(
            content=audio,
            media_type="audio/mpeg",
            headers={"X-TTS-Engine": "edge-tts", "X-TTS-Voice": req.voice},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("免费 TTS 合成失败(edge-tts): %s", e)
        raise HTTPException(
            status_code=503,
            detail=f"免费 TTS 暂不可用(edge-tts 服务不可达),请稍后重试: {e}",
        ) from None
