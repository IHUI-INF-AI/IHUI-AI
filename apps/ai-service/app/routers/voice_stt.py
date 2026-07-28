"""Voice STT 路由 — 语音转文字(零成本本地推理版)。

POST /api/voice/stt 接收 multipart/form-data 音频文件,调用 faster-whisper 本地
CTranslate2 推理进行 STT 转写。完全免费、离线可用,不依赖任何付费 API。

2026-07-28 重构:从 litellm.atranscription(走 OpenAI Whisper 付费 API)迁移到
faster-whisper 本地推理(CTranslate2 后端,base 模型 74MB,首次下载后离线)。
- 用户硬约束:不想花一分钱
- 模型:size="base"(74MB,精度/速度平衡),compute_type="int8"(CPU 友好)
- 模型缓存:首次使用自动下载到 ~/.cache/huggingface,之后永久离线
- 线程安全:全局单例 _whisper_model,首次请求懒加载
"""

import logging
import tempfile
from threading import Lock
from typing import Any, Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# STT 默认模型名(用于响应字段,标识用的引擎)
_DEFAULT_STT_MODEL = "whisper-base-local"

# faster-whisper 模型单例(懒加载,线程安全)
# 首次请求时下载/加载模型(~74MB base 模型,CPU int8 推理)
_whisper_model: Any = None
_whisper_model_lock = __import__("threading").Lock()


class STTResponse(BaseModel):
    """STT 转写响应。"""

    text: str
    stub: bool
    model: str


def _get_whisper_model() -> Any:
    """懒加载 faster-whisper 模型单例(线程安全)。

    使用 base 模型(74MB,精度/速度平衡)+ int8 量化(CPU 友好,零 GPU 依赖)。
    首次调用时从 HuggingFace 下载模型到 ~/.cache/huggingface,之后永久离线可用。

    Returns:
        faster_whisper.WhisperModel 实例。

    Raises:
        ImportError: faster-whisper 未安装。
        RuntimeError: 模型加载失败。
    """
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    with _whisper_model_lock:
        # 双重检查锁,避免多请求时重复加载
        if _whisper_model is not None:
            return _whisper_model

        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise ImportError(
                "faster-whisper 未安装,无法进行本地 STT 转写。"
                "请运行:pip install faster-whisper"
            ) from e

        logger.info("加载 faster-whisper base 模型(int8,CPU 推理,首次会下载 ~74MB)...")
        _whisper_model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
        )
        logger.info("faster-whisper 模型加载完成")
        return _whisper_model


@router.post("/voice/stt", response_model=STTResponse)
async def voice_stt(
    file: UploadFile = File(..., description="音频文件(wav/mp3/m4a/webm 等)"),
    language: Optional[str] = Form(None, description="语言提示(如 zh/en/ja,可选)"),
) -> STTResponse:
    """接收音频文件并用 faster-whisper 本地转写为文本。

    完全免费 + 离线可用:
      - faster-whisper 基于 CTranslate2,本地 CPU 推理
      - base 模型 74MB,首次下载后永久离线
      - 无需任何 API key,零成本

    Args:
        file: 音频文件(wav/mp3/m4a/webm 等 faster-whisper 支持的格式,内部用 ffmpeg 解码)。
        language: ISO 639-1 语言代码(如 zh/en/ja),可选,提高识别准确率。

    Returns:
        STTResponse: { text, stub, model }
    """
    # 读取上传的音频字节
    audio_bytes = await file.read()
    if not audio_bytes:
        return STTResponse(text="", stub=True, model=_DEFAULT_STT_MODEL)

    # 本地 faster-whisper 推理
    suffix = _get_suffix(file.filename or "audio.wav")
    try:
        model = _get_whisper_model()

        # faster-whisper 接受文件路径或类文件对象;用 tempfile 包装便于 ffmpeg 解码
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(audio_bytes)
            tmp.flush()
            tmp.seek(0)

            # segments 是生成器,segments_iter + info
            # language=None 让模型自动检测;传 language 则强制语言
            segments, _info = model.transcribe(
                tmp.name,
                language=language,
                vad_filter=True,  # 过滤静音段,提升速度
            )
            # 拼接所有段文本
            text = "".join(segment.text for segment in segments).strip()

        return STTResponse(
            text=text,
            stub=False,
            model=_DEFAULT_STT_MODEL,
        )
    except ImportError as e:
        logger.warning("faster-whisper 未安装: %s", e)
        return STTResponse(
            text="[stub] faster-whisper 未安装,无法进行本地 STT 转写。请运行:pip install faster-whisper",
            stub=True,
            model=_DEFAULT_STT_MODEL,
        )
    except Exception as e:
        logger.warning("STT 本地转写失败: %s", e)
        # 失败时返回空文本 + stub 标记(避免 CLI 端崩溃)
        safe_msg = str(e)
        # 敏感信息脱敏(虽然本地推理不太可能含敏感信息,防御性处理)
        for key_field in ("api_key", "apikey", "authorization"):
            if key_field in safe_msg.lower():
                safe_msg = f"STT 调用失败(含敏感信息已脱敏): {type(e).__name__}"
                break
        return STTResponse(
            text=f"[STT 失败] {safe_msg}",
            stub=True,
            model=_DEFAULT_STT_MODEL,
        )


def _get_suffix(filename: str) -> str:
    """从文件名提取扩展名(含 .),默认 .wav。"""
    if "." in filename:
        ext = filename.rsplit(".", 1)[1].lower()
        # 只允许字母数字(防止路径注入)
        if ext.isalnum() and len(ext) <= 6:
            return f".{ext}"
    return ".wav"
