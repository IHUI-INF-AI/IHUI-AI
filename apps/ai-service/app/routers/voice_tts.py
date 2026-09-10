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
    POST /voice/tts  {"text": "你好", "engine": "token6688", "voice": "alloy"}
    → 200 audio/mpeg(Token6688 网关,单 key;声纹可传声纹库 voice_id)
    GET  /voice/voices              → token6688 声纹库列表(voice-clone 用)
    POST /voice/voices (multipart)  → 上传参考音频建声纹(异步任务,轮询至终态)
    GET  /voice/voices/{voice_id}   → 单声纹详情(克隆状态确认)
    POST /voice/tts-async           → 异步 TTS 提交(≤5000 字符)→ task_id
    GET  /voice/tts-async/{task_id} → 异步 TTS 取件(audio_url=公网语音直链)
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from ..providers.token6688_provider import Token6688Provider

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
    voice: str = Field(default=DEFAULT_VOICE, description="声音(白名单内;token6688 引擎可为官方音色或声纹库 voice_id)")
    rate: str = Field(default="+0%", description="语速,如 +10% / -20%(仅 edge 引擎)")
    engine: str = Field(default="edge", description="TTS 引擎: edge(零成本) / token6688(聚合网关,单 key)")


def _require_admin(request: Request) -> None:
    """声纹库删除守卫:共享资源破坏性操作仅限 admin(roleId>=1)(2026-09-09 P1)。

    JWT 中间件已把 roleId 注入 request.state(阈值与 AGENTS.md §5、admin/layout
    的 roleId>=1 一致);测试可通过 app.dependency_overrides 覆盖本依赖。
    """
    role_id = getattr(request.state, "role_id", 0) or 0
    if int(role_id) < 1:
        raise HTTPException(status_code=403, detail="声纹库删除仅限管理员操作")


def _token6688_provider() -> Token6688Provider:
    """按配置构造 Token6688Provider;未配 key 时 503 如实提示。"""
    from ..core.config import settings
    from ..providers.token6688_provider import Token6688Provider

    cfg = settings.get_provider_config("token6688")
    if not cfg.api_key:
        raise HTTPException(
            status_code=503,
            detail="token6688 未配置:请在 .env 设置 TOKEN6688_API_KEY 或 LLM_PROVIDERS.token6688.api_key",
        )
    return Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base)


async def _tts_via_token6688(text: str, voice: str) -> tuple[bytes, str]:
    """Token6688 网关 TTS(POST /v1/audio/speech,OpenAI 官方同构)。"""
    from ..providers.base_provider import ProviderError

    try:
        return await _token6688_provider().tts(text, voice=voice)
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 TTS 合成失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 TTS 失败: {e}") from None


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
    rate = req.rate if req.rate.startswith(("+", "-")) and req.rate.endswith("%") else "+0%"

    # 2026-09-08:Token6688 聚合网关引擎(单 key 全模态;voice 白名单校验仅限 edge 引擎)
    if req.engine == "token6688":
        audio, content_type = await _tts_via_token6688(text, req.voice)
        return Response(
            content=audio,
            media_type=content_type or "audio/mpeg",
            headers={"X-TTS-Engine": "token6688", "X-TTS-Voice": req.voice},
        )
    if req.engine != "edge":
        raise HTTPException(status_code=400, detail=f"未知 engine: {req.engine}(允许 edge/token6688)")
    if req.voice not in VOICE_WHITELIST:
        raise HTTPException(
            status_code=400,
            detail=f"voice 不在白名单: {req.voice}",
        )

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


@router.get("/voice/voices")
async def list_voices() -> dict[str, Any]:
    """Token6688 声纹库列表(GET /v1/audio/voices;voice-clone 前置)。"""
    from ..providers.base_provider import ProviderError

    try:
        voices = await _token6688_provider().list_voices()
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 声纹列表失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 声纹列表失败: {e}") from None
    return {"voices": voices, "count": len(voices)}


@router.post("/voice/voices")
async def upload_voice(file: UploadFile = File(..., description="参考音频(wav/mp3,建议 10~30s 干声)")) -> dict[str, Any]:
    """上传参考音频到 Token6688 声纹库(POST /v1/audio/voices,异步任务轮询至终态)。

    成功后声纹进入 /voice/voices 列表,TTS 传其 voice_id 即可克隆音色。
    """
    from ..providers.base_provider import ProviderError

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="参考音频为空")
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="参考音频超 50MB 上限")
    try:
        result = await _token6688_provider().upload_voice(data, file.filename or "ref.wav")
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 声纹上传失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 声纹上传失败: {e}") from None
    return result


@router.get("/voice/voices/{voice_id}")
async def get_voice(voice_id: str) -> dict[str, Any]:
    """查询单一声纹(GET /v1/audio/voices/{voice_id};确认克隆状态/音色详情)。"""
    from ..providers.base_provider import ProviderError

    try:
        return await _token6688_provider().get_voice(voice_id)
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 声纹查询失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 声纹查询失败: {e}") from None


@router.delete("/voice/voices/{voice_id}")
async def delete_voice(
    voice_id: str,
    _admin: None = Depends(_require_admin),
) -> dict[str, Any]:
    """删除克隆声纹(DELETE /v1/audio/voices/{voice_id};声纹库生命周期收口,2026-09-09 E4)。

    2026-09-09 P1 收敛:声纹库是平台共享资源(单一 token6688 账号,无归属概念),
    删除影响所有用户,故仅限 admin(roleId>=1)执行,与 AGENTS.md §5 / admin
    layout 的阈值一致;列表/上传/试听对所有登录用户开放。
    删除后该 voice_id 不可再用于克隆 TTS;失败如实返回原因不抛。
    """
    from ..providers.base_provider import ProviderError

    try:
        result = await _token6688_provider().delete_voice(voice_id)
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 声纹删除失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 声纹删除失败: {e}") from None
    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=f"token6688 声纹删除失败(status={result.get('status')}): {result.get('error') or '未知'}",
        )
    return result


class AsyncTTSRequest(BaseModel):
    """异步声纹 TTS 请求(长文本/免长连接场景;产物为 TokenGo CDN 公网 URL)。"""

    text: str = Field(..., min_length=1, max_length=5000, description="要合成的文本(≤5000 字符)")
    voice: str = Field("alloy", description="官方音色或声纹库 voice_id")
    model: str | None = Field(None, description="可选,TTS 模型(默认 tts-1-hd)")
    speed: float = Field(1.0, description="语速倍率 0.25~4.0")


@router.post("/voice/tts-async")
async def tts_async(req: AsyncTTSRequest) -> dict[str, Any]:
    """异步 TTS 提交(POST /v1/audio/speech/async)→ 立即返回 task_id。

    与同步 POST /voice/tts(返回音频字节)不同:本端点提交即返回,产物是公网
    语音 URL;用 GET /voice/tts-async/{task_id} 查询取件。
    """
    from ..providers.base_provider import ProviderError

    try:
        return await _token6688_provider().tts_async(
            req.text, model=req.model, voice=req.voice, speed=req.speed, wait=False,
        )
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 异步 TTS 提交失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 异步 TTS 提交失败: {e}") from None


@router.get("/voice/tts-async/{task_id}")
async def tts_async_status(task_id: str) -> dict[str, Any]:
    """异步 TTS 取件(GET /v1/tasks/{task_id};completed 后 audio_url 为公网语音直链)。"""
    from ..providers.base_provider import ProviderError

    try:
        st = await _token6688_provider().get_task_status(task_id)
    except HTTPException:
        raise
    except ProviderError as e:
        logger.warning("token6688 异步 TTS 查询失败: %s", e)
        raise HTTPException(status_code=502, detail=f"token6688 异步 TTS 查询失败: {e}") from None
    return {
        "task_id": task_id,
        "status": st.get("status"),
        "ok": st.get("ok"),
        "failed": st.get("failed"),
        "audio_url": st.get("video_url"),  # get_task_status 归一化字段名,即 output_url
        "error": st.get("error"),
        "error_class": st.get("error_class"),
    }
