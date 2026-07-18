"""Voice STT 路由 — 语音转文字。

POST /api/voice/stt 接收 multipart/form-data 音频文件,调用 LiteLLM 的 transcription
能力进行 STT 转写;无 API key 时降级 stub 模式返回模拟文本。

灵感来源:参考行业 Agent 框架的 voice input 转写能力(用户口述 → 转文本)。
简化策略:
  - 复用 LLMGateway._is_stub_mode() 判断降级
  - stub 模式返回固定提示文本(便于本地开发与测试)
  - 真实模式调用 litellm.atranscription(model="whisper-1", file=..., language=...)
"""

import logging
import tempfile
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel

from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

router = APIRouter()

# STT 默认模型(OpenAI Whisper 兼容)
_DEFAULT_STT_MODEL = "whisper-1"


class STTResponse(BaseModel):
    """STT 转写响应。"""

    text: str
    stub: bool
    model: str


@router.post("/voice/stt", response_model=STTResponse)
async def voice_stt(
    file: UploadFile = File(..., description="音频文件(wav/mp3/m4a/webm 等)"),
    language: Optional[str] = Form(None, description="语言提示(如 zh/en/ja,可选)"),
) -> STTResponse:
    """接收音频文件并转写为文本。

    stub 模式(未配置任何 .env API key):
      返回固定模拟文本,便于本地开发与测试。

    真实模式:
      调用 litellm.atranscription(model="whisper-1", file=..., language=...)
      LiteLLM 内部按 OPENAI_API_KEY 路由到 OpenAI Whisper API。

    Args:
        file: 音频文件(wav/mp3/m4a/webm 等 LiteLLM 支持的格式)。
        language: ISO 639-1 语言代码(如 zh/en/ja),可选,提高识别准确率。

    Returns:
        STTResponse: { text, stub, model }
    """
    # 读取上传的音频字节
    audio_bytes = await file.read()
    if not audio_bytes:
        return STTResponse(text="", stub=True, model=_DEFAULT_STT_MODEL)

    # stub 模式:返回固定模拟文本(便于本地开发与测试)
    if llm_gateway._is_stub_mode():
        lang_hint = f"(language={language})" if language else ""
        return STTResponse(
            text=(
                "[stub] Voice STT 未配置 API key,返回模拟文本。"
                f"音频大小 {len(audio_bytes)} 字节{lang_hint}。"
            ),
            stub=True,
            model=_DEFAULT_STT_MODEL,
        )

    # 真实模式:调用 litellm.atranscription
    # LiteLLM transcription 接口要求 file 参数为类文件对象(含 .name 属性)
    # 用 tempfile 包装成可读对象,后缀用原始文件名扩展名(便于格式识别)
    suffix = _get_suffix(file.filename or "audio.wav")
    try:
        import litellm

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
            tmp.write(audio_bytes)
            tmp.flush()
            tmp.seek(0)
            # litellm.atranscription 需要 file 参数为 tuple (filename, fileobj)
            call_kwargs: dict = {
                "model": _DEFAULT_STT_MODEL,
                "file": (file.filename or "audio.wav", tmp),
            }
            if language:
                call_kwargs["language"] = language
            response = await litellm.atranscription(**call_kwargs)
            text = getattr(response, "text", "") or ""
            return STTResponse(text=text, stub=False, model=_DEFAULT_STT_MODEL)
    except ImportError:
        logger.warning("litellm 未安装,降级 stub 模式")
        return STTResponse(
            text="[stub] litellm 未安装,无法进行真实 STT 转写。",
            stub=True,
            model=_DEFAULT_STT_MODEL,
        )
    except Exception as e:
        logger.warning("STT 转写失败: %s", e)
        # 失败时返回空文本 + stub 标记(避免 CLI 端崩溃)
        safe_msg = str(e)
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
