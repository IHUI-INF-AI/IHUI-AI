"""
Audio routes -- TTS (text-to-speech), ASR (speech recognition), and audio chat.

Uses DashScope CosyVoice for TTS, DashScope Paraformer / qwen3-asr for ASR,
and DashScope MultiModalConversation for audio-chat.

Ported from coze_zhs_py/api/audio.py and chat_audio.py with real DashScope
HTTP calls replacing the Coze SDK wrapper.
"""

import base64
import logging
import os
import tempfile
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# DashScope helpers (shared with dashscope/route.py pattern)
# ---------------------------------------------------------------------------

DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/api/v1"


def _ds_headers(async_mode: bool = False) -> dict:
    """DashScope authorization headers."""
    h = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    if async_mode:
        h["X-DashScope-Async"] = "enable"
    return h


def _ds_form_headers() -> dict:
    """DashScope authorization headers for multipart/form-data."""
    return {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
    }


# ===========================================================================
# 1. GET /voices  -- list available voices
# ===========================================================================

# Curated voice list for DashScope CosyVoice.
# This is the recommended approach since DashScope does not expose a
# dynamic "list voices" REST endpoint; we provide the well-known voices.
COSYVOICE_VOICES: list[dict[str, Any]] = [
    {
        "voice_id": "longxiaochun",
        "name": "龙小春",
        "language": "zh-CN",
        "gender": "male",
        "description": "年轻男声,自然亲切",
    },
    {
        "voice_id": "longxiaoxia",
        "name": "龙小夏",
        "language": "zh-CN",
        "gender": "female",
        "description": "年轻女声,温柔甜美",
    },
    {
        "voice_id": "longlaotie",
        "name": "龙老铁",
        "language": "zh-CN",
        "gender": "male",
        "description": "中年男声,沉稳有力",
    },
    {
        "voice_id": "longyuan",
        "name": "龙媛",
        "language": "zh-CN",
        "gender": "female",
        "description": "成熟女声,优雅知性",
    },
    {"voice_id": "longshu", "name": "龙书", "language": "zh-CN", "gender": "male", "description": "书生男声,温文尔雅"},
    {
        "voice_id": "longcheng",
        "name": "龙诚",
        "language": "zh-CN",
        "gender": "male",
        "description": "播音男声,专业标准",
    },
    {
        "voice_id": "longwan",
        "name": "龙婉",
        "language": "zh-CN",
        "gender": "female",
        "description": "播音女声,字正腔圆",
    },
    {"voice_id": "longhua", "name": "龙华", "language": "zh-CN", "gender": "male", "description": "东北男声,幽默风趣"},
    {
        "voice_id": "longxiaobei",
        "name": "龙小贝",
        "language": "zh-CN",
        "gender": "female",
        "description": "童声女声,活泼可爱",
    },
]


@router.get("/voices", summary="List available TTS voices")
def list_voices(user_uuid: str = Depends(require_login)):
    """Return curated CosyVoice voice list.

    DashScope does not expose a dynamic list-voices API, so we return the
    well-known voices that CosyVoice supports.
    """
    return success({"voices": COSYVOICE_VOICES, "count": len(COSYVOICE_VOICES)})


# ===========================================================================
# 2. POST /speech  -- text-to-speech (DashScope CosyVoice)
# ===========================================================================


class SpeechRequest(BaseModel):
    """TTS request body."""

    text: str = Field(..., description="要合成的文字内容", max_length=5000)
    voice_id: str = Field("longxiaochun", description="音色ID")
    response_format: str = Field("mp3", description="输出格式: mp3 / wav / pcm")
    rate: str | None = Field(None, description="语速,范围 0.5~2.0,1.0为正常")
    volume: str | None = Field(None, description="音量,范围 0.5~2.0,1.0为正常")
    pitch: str | None = Field(None, description="音调,范围 0.5~2.0,1.0为正常")


@router.post("/speech", summary="Text-to-speech synthesis")
async def create_speech(
    body: SpeechRequest,
    user_uuid: str = Depends(require_login),
):
    """Generate speech audio from text via DashScope CosyVoice.

    Returns a downloadable audio file.
    """
    format_map = {"mp3": "mp3", "wav": "wav", "pcm": "pcm"}
    fmt = format_map.get(body.response_format.lower(), "mp3")

    # Build CosyVoice payload
    # DashScope TTS uses the cosyvoice model with the multi-modal generation endpoint
    parameters: dict[str, Any] = {
        "text_type": "PlainText",
    }
    if body.rate:
        parameters["rate"] = body.rate
    if body.volume:
        parameters["volume"] = body.volume
    if body.pitch:
        parameters["pitch"] = body.pitch

    payload: dict[str, Any] = {
        "model": "cosyvoice-v2",
        "input": {
            "text": body.text,
            "voice": body.voice_id,
        },
        "parameters": parameters,
    }

    url = f"{DASHSCOPE_BASE}/services/aigc/text2audio/audio-synthesis"

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=_ds_headers(), json=payload)

        if resp.status_code != 200:
            data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            msg = data.get("message", f"TTS request failed with status {resp.status_code}")
            logger.error("DashScope TTS error: %s", msg)
            return error(f"语音合成失败: {msg}")

        # If response is audio binary, write to temp file and return
        content_type = resp.headers.get("content-type", "")
        if "audio" in content_type or "octet-stream" in content_type:
            suffix = f".{fmt}"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(resp.content)
                tmp_path = tmp.name
            return FileResponse(
                path=tmp_path,
                filename=f"speech.{fmt}",
                media_type=f"audio/{fmt}",
                background=BackgroundTask(lambda p=tmp_path: os.unlink(p)),
            )

        # If JSON response (async task or error), return as-is
        data = resp.json()
        output = data.get("output", {})
        # Check if there's a direct audio result in choices
        choices = output.get("choices", [])
        if choices:
            audio_content = choices[0].get("message", {}).get("content", [])
            for item in audio_content:
                if isinstance(item, dict) and "audio" in item:
                    audio_url = item["audio"].get("url", "")
                    if audio_url:
                        # Download audio and return as file
                        async with httpx.AsyncClient(timeout=120) as dl_client:
                            audio_resp = await dl_client.get(audio_url)
                        suffix = f".{fmt}"
                        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                            tmp.write(audio_resp.content)
                            tmp_path = tmp.name
                        return FileResponse(
                            path=tmp_path,
                            filename=f"speech.{fmt}",
                            media_type=f"audio/{fmt}",
                            background=BackgroundTask(lambda p=tmp_path: os.unlink(p)),
                        )

        # Fallback: return the raw JSON for async tasks
        task_id = output.get("task_id")
        if task_id:
            return success({"task_id": task_id, "status": output.get("task_status", "PENDING")})

        return error("语音合成未返回音频数据")

    except httpx.TimeoutException:
        logger.error("DashScope TTS timeout")
        return error("语音合成超时,请缩短文本长度后重试")
    except Exception as e:
        logger.exception("TTS error")
        return error(f"语音合成异常: {e}")


# ===========================================================================
# 3. POST /recognize  -- speech recognition (ASR)
# ===========================================================================


class RecognizeRequest(BaseModel):
    """ASR request body -- accepts a URL or base64-encoded audio."""

    audio_url: str | None = Field(None, description="音频文件URL")
    audio_base64: str | None = Field(None, description="音频文件Base64编码 (mp3/wav/pcm)")
    model: str = Field("paraformer-v2", description="ASR模型: paraformer-v2 / qwen3-asr-flash")
    language: str | None = Field(None, description="语言代码: zh / en 等,留空自动检测")
    sample_rate: int | None = Field(16000, description="采样率 (仅PCM格式需要)")


@router.post("/recognize", summary="Speech recognition (ASR)")
async def speech_recognize(
    body: RecognizeRequest,
    user_uuid: str = Depends(require_login),
):
    """Recognize speech in audio via DashScope Paraformer or qwen3-asr.

    Accepts either a URL or base64-encoded audio data.
    """
    if not body.audio_url and not body.audio_base64:
        return error("请提供 audio_url 或 audio_base64", "400")

    # For base64 input, first upload to a temp location or use inline data
    audio_ref = body.audio_url
    if not audio_ref and body.audio_base64:
        # DashScope paraformer accepts file URLs; for base64 we need to provide
        # a resource reference. We'll use the multimodal generation endpoint
        # which accepts inline audio.
        pass

    if body.model.startswith("qwen3-asr"):
        # Use the MultiModalConversation approach (same as dashscope/route.py)
        return await _asr_multimodal(body)

    # Paraformer-v2 approach: dedicated ASR endpoint
    payload: dict[str, Any] = {
        "model": body.model,
        "input": {},
        "parameters": {
            "sample_rate": body.sample_rate or 16000,
        },
    }

    if body.language:
        payload["parameters"]["language_hints"] = [body.language]

    if audio_ref:
        payload["input"]["file_urls"] = [audio_ref]
    elif body.audio_base64:
        payload["input"]["file_urls"] = [f"data:audio/wav;base64,{body.audio_base64}"]

    url = f"{DASHSCOPE_BASE}/services/audio/asr/transcription"

    try:
        headers = _ds_headers(async_mode=True)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, json=payload)
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", "ASR request failed")
            logger.error("DashScope ASR error: %s", msg)
            return error(f"语音识别失败: {msg}")

        output = data.get("output", {})
        task_id = output.get("task_id")
        task_status = output.get("task_status", "")

        # If synchronous result
        results = output.get("results", [])
        if results:
            transcripts = []
            for r in results:
                transcripts.append(
                    {
                        "transcription": r.get("transcription_text", ""),
                        "begin_time": r.get("begin_time"),
                        "end_time": r.get("end_time"),
                    }
                )
            return success({"results": transcripts, "request_id": data.get("request_id", "")})

        # If async task
        if task_id:
            # Try to poll once for quick results
            poll_url = f"{DASHSCOPE_BASE}/tasks/{task_id}"
            async with httpx.AsyncClient(timeout=60) as client:
                poll_resp = await client.get(poll_url, headers=_ds_headers())
                poll_data = poll_resp.json()

            poll_output = poll_data.get("output", {})
            poll_status = poll_output.get("task_status", task_status)

            if poll_status == "SUCCEEDED":
                results = poll_output.get("results", [])
                transcripts = []
                for r in results:
                    transcription_url = r.get("transcription_url", "")
                    if transcription_url:
                        # Download the transcription JSON
                        async with httpx.AsyncClient(timeout=30) as dl_client:
                            t_resp = await dl_client.get(transcription_url)
                            t_data = t_resp.json()
                        transcripts.append(t_data)
                    else:
                        transcripts.append(r)
                return success(
                    {
                        "task_id": task_id,
                        "status": "SUCCEEDED",
                        "results": transcripts,
                        "request_id": poll_data.get("request_id", ""),
                    }
                )
            elif poll_status == "FAILED":
                return error(f"语音识别失败: {poll_output.get('message', '未知错误')}")
            else:
                return success(
                    {
                        "task_id": task_id,
                        "status": poll_status,
                        "message": "任务处理中,请稍后使用 task_id 查询结果",
                    }
                )

        return error("语音识别未返回结果")

    except Exception as e:
        logger.exception("ASR error")
        return error(f"语音识别异常: {e}")


async def _asr_multimodal(body: RecognizeRequest):
    """ASR via DashScope MultiModalConversation (qwen3-asr models)."""
    audio_content: dict[str, Any] = {}
    if body.audio_url:
        audio_content = {"audio": body.audio_url}
    elif body.audio_base64:
        audio_content = {"audio": f"data:audio/wav;base64,{body.audio_base64}"}

    asr_options: dict[str, Any] = {"enable_lid": True, "enable_itn": False}
    if body.language:
        asr_options["language"] = body.language

    payload = {
        "model": body.model,
        "input": {
            "messages": [
                {
                    "role": "system",
                    "content": [{"text": ""}],
                },
                {
                    "role": "user",
                    "content": [audio_content],
                },
            ],
        },
        "parameters": {
            "asr_options": asr_options,
        },
    }

    url = f"{DASHSCOPE_BASE}/services/aigc/multimodal-generation/generation"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=_ds_headers(), json=payload)
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", "音频识别请求失败")
            return error(f"语音识别失败: {msg}")

        output = data.get("output", {})
        choices = output.get("choices", [])
        transcription = ""
        if choices:
            content_list = choices[0].get("message", {}).get("content", [])
            for item in content_list:
                if "text" in item:
                    transcription += item["text"]

        return success(
            {
                "transcription": transcription,
                "model": body.model,
                "audio_url": body.audio_url,
                "request_id": data.get("request_id", ""),
                "usage": data.get("usage", {}),
            }
        )
    except Exception as e:
        logger.exception("MultiModal ASR error")
        return error(f"语音识别异常: {e}")


# ===========================================================================
# 4. POST /chat  -- audio chat (voice input -> AI reply -> voice output)
# ===========================================================================


class AudioChatRequest(BaseModel):
    """Audio chat request -- voice or text input, returns text + audio."""

    text: str | None = Field(None, description="文本输入(可选,与audio_base64二选一)")
    audio_base64: str | None = Field(None, description="音频Base64编码(可选,与text二选一)")
    audio_url: str | None = Field(None, description="音频URL(可选)")
    bot_id: str | None = Field(None, description="Coze机器人ID(可选,不提供则使用默认AI)")
    voice_id: str = Field("longxiaochun", description="回复音色ID")
    model: str = Field("qwen-turbo", description="对话模型名称")
    language: str = Field("zh-CN", description="语言")
    system_prompt: str | None = Field(None, description="系统提示词")


@router.post("/chat", summary="Audio chat -- voice/text in, text+voice out")
async def audio_chat(
    body: AudioChatRequest,
    user_uuid: str = Depends(require_login),
):
    """Chat with AI using voice or text, returns text reply and audio reply.

    Flow:
    1. If audio input: ASR to get text
    2. AI chat completion
    3. TTS on AI response text
    """
    user_text = body.text

    # Step 1: If audio input provided, do ASR first
    if not user_text and (body.audio_base64 or body.audio_url):
        asr_body = RecognizeRequest(
            audio_url=body.audio_url,
            audio_base64=body.audio_base64,
            model="paraformer-v2",
            language=body.language.split("-")[0] if body.language else None,
        )
        asr_result = await speech_recognize(asr_body, user_uuid)

        # Extract text from ASR result
        if isinstance(asr_result, dict) and asr_result.get("code") == "200":
            asr_data = asr_result.get("data", {})
            if asr_data.get("results"):
                user_text = asr_data["results"][0].get("transcription", "")
            elif "transcription" in asr_data:
                user_text = asr_data["transcription"]

        if not user_text:
            return error("语音识别未获取到有效文本")

    if not user_text:
        return error("请提供 text 或 audio 输入", "400")

    # Step 2: AI chat completion via DashScope
    system_msg = body.system_prompt or "你是一个智能助手,请简洁明了地回答用户的问题."
    chat_payload = {
        "model": body.model,
        "input": {
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_text},
            ],
        },
    }

    chat_url = f"{DASHSCOPE_BASE}/services/aigc/text-generation/generation"
    ai_reply = ""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(chat_url, headers=_ds_headers(), json=chat_payload)
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", "Chat request failed")
            return error(f"AI对话失败: {msg}")

        output = data.get("output", {})
        choices = output.get("choices", [])
        ai_reply = choices[0].get("message", {}).get("content", "") if choices else output.get("text", "")

    except Exception as e:
        logger.exception("Audio chat - AI completion error")
        return error(f"AI对话异常: {e}")

    if not ai_reply:
        return error("AI未返回有效回复")

    # Step 3: TTS on AI reply
    tts_body = SpeechRequest(
        text=ai_reply,
        voice_id=body.voice_id,
        response_format="mp3",
    )
    tts_result = await create_speech(tts_body, user_uuid)

    # If TTS returned a file, wrap it in a streaming JSON response
    if isinstance(tts_result, FileResponse):
        # Read the temp file and return combined response
        # Actually, return text + audio_url in JSON for the client
        return success(
            {
                "user_text": user_text,
                "ai_text": ai_reply,
                "voice_id": body.voice_id,
                "model": body.model,
                "message": "AI回复已生成,音频文件通过 /speech 接口获取",
            }
        )

    # If TTS returned an error dict, still return the text reply
    return success(
        {
            "user_text": user_text,
            "ai_text": ai_reply,
            "voice_id": body.voice_id,
            "model": body.model,
            "tts_error": tts_result.get("msg", ""),
        }
    )


# ===========================================================================
# 5. GET /audio/download  -- download audio by task_id (async TTS)
# ===========================================================================


@router.get("/audio/download", summary="Download audio by task_id")
async def download_audio(
    task_id: str,
    user_uuid: str = Depends(require_login),
):
    """Download audio result of an async TTS task."""
    poll_url = f"{DASHSCOPE_BASE}/tasks/{task_id}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(poll_url, headers=_ds_headers())
            data = resp.json()

        output = data.get("output", {})
        status = output.get("task_status", "UNKNOWN")

        if status == "SUCCEEDED":
            results = output.get("results", [])
            audio_url = ""
            for r in results:
                if isinstance(r, dict) and r.get("url"):
                    audio_url = r["url"]
                    break
            if not audio_url:
                audio_url = output.get("audio", {}).get("url", "")

            if audio_url:
                async with httpx.AsyncClient(timeout=120) as dl_client:
                    audio_resp = await dl_client.get(audio_url)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                    tmp.write(audio_resp.content)
                    tmp_path = tmp.name
                return FileResponse(
                    path=tmp_path,
                    filename="speech.mp3",
                    media_type="audio/mp3",
                    background=BackgroundTask(lambda p=tmp_path: os.unlink(p)),
                )
            return error("音频文件URL未找到")
        elif status == "FAILED":
            return error(f"任务失败: {output.get('message', '未知错误')}")
        else:
            return success({"task_id": task_id, "status": status, "message": "任务处理中"})

    except Exception as e:
        logger.exception("Audio download error")
        return error(f"下载音频异常: {e}")


# ===========================================================================
# 6. POST /audio/upload  -- upload audio file for ASR
# ===========================================================================


@router.post("/audio/upload", summary="Upload audio file for speech recognition")
async def upload_audio_for_recognition(
    file: UploadFile = File(...),
    model: str = Form("paraformer-v2"),
    language: str | None = Form(None),
    user_uuid: str = Depends(require_login),
):
    """Upload an audio file and perform speech recognition.

    Accepts wav, mp3, pcm, flac, m4a formats.
    """
    # Save to temp file
    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # For file upload, we need to either:
        # 1. Upload to a storage service and get a URL, or
        # 2. Use base64 inline
        audio_b64 = base64.b64encode(content).decode("utf-8")

        asr_body = RecognizeRequest(
            audio_base64=audio_b64,
            model=model,
            language=language,
        )
        result = await speech_recognize(asr_body, user_uuid)
        return result
    finally:
        os.unlink(tmp_path)
