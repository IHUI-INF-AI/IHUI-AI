"""DashScope (Tongyi Qianwen) AI proxy routes -- chat, audio, vision, video, image."""

import asyncio
import logging
import uuid as _uuid_mod
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    check_user_token_sufficient,
    save_conversation_to_db,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# ---------------------------------------------------------------------------
# Request models for image endpoints
# ---------------------------------------------------------------------------


class ImageGenerateBody(BaseModel):
    """Image generation request body."""

    prompt: str = Field(..., description="Text prompt for image generation")
    negative_prompt: str | None = Field(None, description="Negative prompt")
    size: str | None = Field("1024*1024", description="Image size, e.g. 1024*1024")
    n: int | None = Field(1, description="Number of images to generate")
    style: str | None = Field(None, description="Style preset")
    sync: bool = Field(False, description="If true, poll until the task completes and return image URLs directly")
    zidingyican: list[dict[str, Any]] | None = Field(None, description="Extra custom parameters as name/value pairs")


class ImageEditBody(BaseModel):
    """Image edit request body (standard, with optional mask)."""

    base_image_url: str = Field(..., description="URL of the base image to edit")
    mask_image_url: str | None = Field(None, description="URL of the mask image (white = area to edit)")
    prompt: str = Field(..., description="Editing instruction")
    model: str = Field("wanx-v1", description="Model name, e.g. wanx-v1, wanx2.1-image-edit")


class SimpleEditBody(BaseModel):
    """Simple image editing (background removal, etc.)."""

    images: str = Field(..., description="Image URL")
    prompt: str = Field(..., description="Editing instruction / operation")
    model: str = Field("qwen-image-edit", description="Model name")
    negative_prompt: str = Field(default="", description="Negative prompt")
    prompt_extend: bool = Field(default=True, description="Whether to extend the prompt")
    watermark: bool = Field(default=False, description="Whether to add watermark")
    sync: bool = Field(False, description="If true, wait for completion and return image URL")


class ImageToImageBody(BaseModel):
    """Image-to-image transformation request body."""

    input_image_url: str = Field(..., description="URL of the input image")
    prompt: str = Field(..., description="Text prompt guiding the transformation")
    model: str = Field("wanx-v1", description="Model name")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _ds_headers(async_mode: bool = False) -> dict:
    """DashScope authorization headers."""
    h = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    if async_mode:
        h["X-DashScope-Async"] = "enable"
    return h


async def _query_task(task_id: str, client: httpx.AsyncClient) -> dict:
    """Query a DashScope async task and return the JSON body."""
    resp = await client.get(
        f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}",
        headers=_ds_headers(),
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


@router.post("/chat", summary="DashScope chat completion")
async def dashscope_chat(
    message: str = Query(...),
    model: str = Query("qwen-turbo"),
    user_uuid: str = Depends(require_login),
):
    headers = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "input": {"messages": [{"role": "user", "content": message}]},
    }
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, headers=headers, json=body, timeout=30)
            data = resp.json()
            output = data.get("output", {})
            text = output.get("text", "")
            return success({"reply": text, "model": model})
        except Exception as e:
            return error(f"DashScope error: {e}")


@router.post("/chat/stream", summary="DashScope streaming chat")
async def dashscope_stream(
    message: str = Query(...),
    model: str = Query("qwen-turbo"),
    user_uuid: str = Depends(require_login),
):
    headers = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-SSE": "enable",
    }
    body = {
        "model": model,
        "input": {"messages": [{"role": "user", "content": message}]},
    }
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"

    async def generate():
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, headers=headers, json=body, timeout=60) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        yield f"data: {line}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# 1. POST /image/generate/{model}  -- async image generation
# ---------------------------------------------------------------------------


@router.post("/image/generate/{model}", summary="DashScope image generation")
async def image_generate(
    model: str,
    body: ImageGenerateBody,
    user_uuid: str = Depends(require_login),
):
    """Submit an async text-to-image task.

    When *sync=false* (default) only ``task_id`` is returned; poll with
    ``GET /image/task/{task_id}``.
    When *sync=true* the endpoint polls until the task finishes and returns
    the image URL(s) directly.
    """
    params: dict[str, Any] = {}
    if body.size:
        params["size"] = body.size
    if body.n:
        params["n"] = body.n
    if body.style:
        params["style"] = body.style
    if body.zidingyican:
        for p in body.zidingyican:
            params[p["name"]] = p["value"]

    # wan2.5-t2i-preview uses a slightly different input structure
    if model == "wan2.5-t2i-preview":
        payload: dict[str, Any] = {
            "model": model,
            "input": {
                "prompt": body.prompt,
                "negative_prompt": params.pop("negative_prompt", body.negative_prompt or ""),
            },
            "parameters": params,
        }
    else:
        payload = {
            "model": model,
            "input": {"prompt": body.prompt},
            "parameters": params,
        }
        if body.negative_prompt:
            payload["input"]["negative_prompt"] = body.negative_prompt

    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, headers=_ds_headers(async_mode=True), json=payload)
            data = resp.json()
            task_id = data.get("output", {}).get("task_id")
            if not task_id:
                return error(data.get("message", "Failed to create task"), code=str(resp.status_code))

            # --- Async-only mode: return task_id immediately ---
            if not body.sync:
                return success({"task_id": task_id, "model": model})

            # --- Sync polling mode: wait for result ---
            max_wait, poll_interval = 300, 3
            start = asyncio.get_event_loop().time()

            while asyncio.get_event_loop().time() - start < max_wait:
                await asyncio.sleep(poll_interval)
                try:
                    task_data = await _query_task(task_id, client)
                except Exception:
                    continue

                output = task_data.get("output", {})
                status = output.get("task_status", "UNKNOWN")

                if status == "SUCCEEDED":
                    results = output.get("results", [])
                    image_urls = [r.get("url") for r in results if r.get("url")]
                    return success(
                        {
                            "task_id": task_id,
                            "model": model,
                            "status": "SUCCEEDED",
                            "image_urls": image_urls,
                            "actual_prompt": results[0].get("actual_prompt") if results else None,
                        }
                    )
                elif status == "FAILED":
                    return error(f"Image generation failed: {output.get('message', 'Unknown error')}")
                # else PENDING / RUNNING -> keep polling

            # timeout
            return error(
                f"Image generation timed out after {max_wait}s; task_id={task_id} may still be running", code="408"
            )
        except Exception as e:
            logger.exception("image_generate error")
            return error(f"Image generation failed: {e}")


# ---------------------------------------------------------------------------
# 2. GET /image/task/{task_id}  -- poll async task
# ---------------------------------------------------------------------------


@router.get("/image/task/{task_id}", summary="Query image generation task status")
async def image_task_status(
    task_id: str,
    user_uuid: str = Depends(require_login),
):
    """Poll a DashScope async task; returns status and image URLs when SUCCEEDED."""
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            data = await _query_task(task_id, client)
            output = data.get("output", {})
            status = output.get("task_status", "UNKNOWN")

            result: dict[str, Any] = {
                "task_id": task_id,
                "status": status,
            }

            if status == "SUCCEEDED":
                results = output.get("results", [])
                result["image_urls"] = [r.get("url") for r in results if r.get("url")]
                result["actual_prompt"] = results[0].get("actual_prompt") if results else None
                result["submit_time"] = output.get("submit_time", "")
                result["end_time"] = output.get("end_time", "")
                result["task_metrics"] = output.get("task_metrics", {})
            elif status == "FAILED":
                result["message"] = output.get("message", "Unknown error")
                result["code"] = output.get("code", "")
            elif status in ("PENDING", "RUNNING"):
                result["message"] = f"Task is {status.lower()}, please poll again later"

            result["request_id"] = data.get("request_id", "")
            return success(result)
        except Exception as e:
            logger.exception("image_task_status error")
            return error(f"Task query failed: {e}")


# ---------------------------------------------------------------------------
# 3. POST /image/edit  -- standard edit with optional mask
# ---------------------------------------------------------------------------


@router.post("/image/edit", summary="DashScope image editing (standard)")
async def image_edit(
    body: ImageEditBody,
    user_uuid: str = Depends(require_login),
):
    """Edit an image using a mask and prompt.  Returns task_id for async models.

    For synchronous models (e.g. wan2.1-image-edit) the result image URL is
    returned directly.
    """
    content_parts: list[dict] = [{"image": body.base_image_url}]
    if body.mask_image_url:
        content_parts.append({"image": body.mask_image_url})
    content_parts.append({"text": body.prompt})

    payload = {
        "model": body.model,
        "input": {"messages": [{"role": "user", "content": content_parts}]},
        "parameters": {},
    }
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis"

    max_retries = 3
    last_error = None

    for attempt in range(1, max_retries + 1):
        async with httpx.AsyncClient(timeout=30) as client:
            try:
                resp = await client.post(url, headers=_ds_headers(async_mode=True), json=payload)
                data = resp.json()

                if resp.status_code != 200:
                    # 4xx client errors: do not retry
                    if 400 <= resp.status_code < 500:
                        return error(
                            data.get("message", f"Image edit failed ({resp.status_code})"), code=str(resp.status_code)
                        )
                    last_error = f"HTTP {resp.status_code}: {data.get('message', resp.text)}"
                    logger.warning("image_edit attempt %d/%d failed: %s", attempt, max_retries, last_error)
                    if attempt < max_retries:
                        await asyncio.sleep(attempt)
                        continue
                    return error(last_error)

                task_id = data.get("output", {}).get("task_id")
                if task_id:
                    return success({"task_id": task_id, "model": body.model})

                # synchronous result -- check both formats
                output = data.get("output", {})
                # choices format (qwen-image-edit, wan2.5-t2i-preview)
                choices = output.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", [])
                    for item in content:
                        if isinstance(item, dict) and "image" in item:
                            return success({"image_url": item["image"], "model": body.model})

                # results format (older models)
                results = output.get("results", [])
                if results and results[0].get("url"):
                    return success({"image_url": results[0]["url"], "model": body.model})

                return error(data.get("message", "Image edit failed"), code=str(resp.status_code))

            except httpx.TimeoutException:
                last_error = "Request timeout"
                logger.warning("image_edit attempt %d/%d timeout", attempt, max_retries)
                if attempt < max_retries:
                    await asyncio.sleep(attempt)
            except Exception as e:
                logger.exception("image_edit error (attempt %d)", attempt)
                return error(f"Image edit failed: {e}")

    return error(f"Image edit failed after {max_retries} retries: {last_error}")


# ---------------------------------------------------------------------------
# 4. POST /image/edit/simple  -- simple edit (background removal, etc.)
# ---------------------------------------------------------------------------


@router.post("/image/edit/simple", summary="Simple DashScope image editing")
async def image_edit_simple(
    body: SimpleEditBody,
    user_uuid: str = Depends(require_login),
):
    """Simple image editing using qwen-image-edit model (background removal, style transfer, etc.)."""
    params: dict[str, Any] = {}
    if body.negative_prompt:
        params["negative_prompt"] = body.negative_prompt
    params["prompt_extend"] = body.prompt_extend
    params["watermark"] = body.watermark

    payload = {
        "model": body.model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"image": body.images},
                        {"text": body.prompt},
                    ],
                }
            ]
        },
        "parameters": params,
    }
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis"

    max_retries = 3
    last_error = None

    for attempt in range(1, max_retries + 1):
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                resp = await client.post(url, headers=_ds_headers(), json=payload)
                data = resp.json()

                if resp.status_code != 200:
                    if 400 <= resp.status_code < 500:
                        return error(
                            data.get("message", f"Simple image edit failed ({resp.status_code})"),
                            code=str(resp.status_code),
                        )
                    last_error = f"HTTP {resp.status_code}: {data.get('message', resp.text)}"
                    logger.warning("image_edit_simple attempt %d/%d failed: %s", attempt, max_retries, last_error)
                    if attempt < max_retries:
                        await asyncio.sleep(attempt)
                        continue
                    return error(last_error)

                output = data.get("output", {})

                # If async (task_id returned), check sync flag
                task_id = output.get("task_id")
                if task_id and not body.sync:
                    return success({"task_id": task_id, "model": body.model})
                if task_id and body.sync:
                    # poll until done
                    max_wait, poll_interval = 300, 3
                    start = asyncio.get_event_loop().time()
                    while asyncio.get_event_loop().time() - start < max_wait:
                        await asyncio.sleep(poll_interval)
                        try:
                            task_data = await _query_task(task_id, client)
                        except Exception:
                            continue
                        task_output = task_data.get("output", {})
                        st = task_output.get("task_status", "")
                        if st == "SUCCEEDED":
                            results = task_output.get("results", [])
                            urls = [r.get("url") for r in results if r.get("url")]
                            return success(
                                {"task_id": task_id, "model": body.model, "status": "SUCCEEDED", "image_urls": urls}
                            )
                        elif st == "FAILED":
                            return error(f"Image edit failed: {task_output.get('message', 'Unknown')}")
                    return error(f"Image edit timed out; task_id={task_id}", code="408")

                # synchronous response
                # qwen-image-edit returns choices format
                choices = output.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", [])
                    for item in content:
                        if isinstance(item, dict) and "image" in item:
                            return success({"image_url": item["image"], "model": body.model})

                # older models return results format
                results = output.get("results", [])
                if results and results[0].get("url"):
                    return success({"image_url": results[0]["url"], "model": body.model})

                return error(data.get("message", "Image edit failed"), code=str(resp.status_code))

            except httpx.TimeoutException:
                last_error = "Request timeout"
                logger.warning("image_edit_simple attempt %d/%d timeout", attempt, max_retries)
                if attempt < max_retries:
                    await asyncio.sleep(attempt)
            except Exception as e:
                logger.exception("image_edit_simple error (attempt %d)", attempt)
                return error(f"Simple image edit failed: {e}")

    return error(f"Simple image edit failed after {max_retries} retries: {last_error}")


# ---------------------------------------------------------------------------
# 5. POST /image-to-image  -- image-to-image transformation
# ---------------------------------------------------------------------------


@router.post("/image-to-image", summary="DashScope image-to-image")
async def image_to_image(
    body: ImageToImageBody,
    user_uuid: str = Depends(require_login),
):
    """Transform an image guided by a text prompt. Returns task_id for async models."""
    payload = {
        "model": body.model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"image": body.input_image_url},
                        {"text": body.prompt},
                    ],
                }
            ]
        },
        "parameters": {},
    }
    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis"

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, headers=_ds_headers(async_mode=True), json=payload)
            data = resp.json()
            task_id = data.get("output", {}).get("task_id")
            if task_id:
                return success({"task_id": task_id, "model": body.model})
            # synchronous
            results = data.get("output", {}).get("results", [])
            if results:
                return success({"image_url": results[0].get("url"), "model": body.model})
            return error(data.get("message", "Image-to-image failed"), code=str(resp.status_code))
        except Exception as e:
            logger.exception("image_to_image error")
            return error(f"Image-to-image failed: {e}")


# ===========================================================================
# Audio -- Speech Recognition  (POST /audio/recognize, GET /audio/models)
# ===========================================================================

SUPPORTED_ASR_MODELS = {
    "qwen3-asr-flash": {
        "name": "通义千问语音识别-极速版",
        "description": "高精度语音识别模型,支持多种语言",
    },
    "qwen3-asr": {
        "name": "通义千问语音识别-标准版",
        "description": "标准语音识别模型,适合一般场景",
    },
}


class AudioRecognizeRequest(BaseModel):
    """Audio recognition request body."""

    audio_url: str = Field(..., description="音频文件URL")
    model: str = Field(default="qwen3-asr-flash", description="语音识别模型名称")
    language: str | None = Field(None, description="音频语言代码,如 zh / en;留空自动检测")
    enable_lid: bool = Field(True, description="启用语言检测")
    enable_itn: bool = Field(False, description="启用逆文本标准化")
    system_prompt: str = Field("", description="系统提示词")
    user_uuid: str | None = Field(None, description="用户UUID(兼容字段)")
    user_id: str | None = Field(None, description="用户ID(兼容字段)")
    chat_id: str | None = Field(None, description="对话ID")
    conversation_id: str | None = Field(None, description="对话ID(兼容字段)")
    asr_options: dict | None = Field(None, description="ASR选项(兼容字段,优先于 enable_lid/enable_itn/language)")

    @field_validator("model")
    @classmethod
    def validate_model(cls, v):
        if v not in SUPPORTED_ASR_MODELS:
            raise ValueError(f"不支持的模型: {v},支持的模型: {list(SUPPORTED_ASR_MODELS.keys())}")
        return v

    @field_validator("audio_url")
    @classmethod
    def validate_audio_url(cls, v):
        if not v.startswith(("http://", "https://")):
            raise ValueError("音频URL必须以http://或https://开头")
        return v

    def get_effective_user_uuid(self, fallback: str) -> str:
        """Return user_uuid from body or from the JWT-based fallback."""
        return self.user_uuid or self.user_id or fallback

    def get_effective_chat_id(self) -> str:
        return self.chat_id or self.conversation_id or ""

    def build_asr_options(self) -> dict:
        """Build asr_options, preferring the explicit dict when present."""
        if self.asr_options:
            opts: dict = {}
            opts["enable_lid"] = self.asr_options.get("enable_lid", self.enable_lid)
            opts["enable_itn"] = self.asr_options.get("enable_itn", self.enable_itn)
            lang = self.language or self.asr_options.get("language")
            if lang:
                opts["language"] = lang
            return opts
        opts = {"enable_lid": self.enable_lid, "enable_itn": self.enable_itn}
        if self.language:
            opts["language"] = self.language
        return opts


# ---------------------------------------------------------------------------
# Audio cost calculation helpers
# ---------------------------------------------------------------------------


def _get_audio_duration(audio_url: str) -> float | None:
    """Download audio and return duration in seconds via librosa (best-effort)."""
    try:
        import os
        import tempfile

        import librosa

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            tmp_path = tmp.name
        try:
            resp = httpx.get(audio_url, timeout=30, follow_redirects=True)
            resp.raise_for_status()
            with open(tmp_path, "wb") as f:
                f.write(resp.content)
            duration = librosa.get_duration(path=tmp_path)
            logger.info("Audio duration: %.2f s", duration)
            return duration
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
    except ImportError:
        logger.warning("librosa not installed; using default cost")
    except Exception as e:
        logger.warning("Failed to get audio duration: %s", e)
    return None


def _calculate_audio_cost(duration: float | None) -> float:
    """Calculate cost in yuan based on audio duration."""
    if duration is None or duration <= 0:
        return 0.00022
    rate = 0.00001  # yuan per second
    return round(max(duration * rate, 0.00022), 6)


@router.post("/audio/recognize", summary="Audio speech recognition")
async def audio_recognize(
    body: AudioRecognizeRequest,
    user_uuid: str = Depends(require_login),
):
    """Recognise speech in audio via DashScope MultiModalConversation ASR.

    Uses the DashScope multi-modal-generation HTTP endpoint.
    Includes token balance check, cost deduction, and conversation recording.
    """
    # Resolve effective user UUID (body fields can override JWT-derived value)
    eff_user_uuid = body.get_effective_user_uuid(user_uuid)
    chat_id = body.get_effective_chat_id() or str(_uuid_mod.uuid4())

    # --- Token balance check ---
    logger.info("[Audio ASR] Checking token balance for user=%s", eff_user_uuid)
    token_check = await check_user_token_sufficient(eff_user_uuid)
    if not token_check.get("sufficient"):
        return error(token_check.get("reason", "余额不足"), "403")

    # --- Validation ---
    if body.model not in SUPPORTED_ASR_MODELS:
        return error(f"不支持的模型: {body.model},可选: {list(SUPPORTED_ASR_MODELS.keys())}", "400")
    if not body.audio_url.startswith(("http://", "https://")):
        return error("audio_url 必须以 http:// 或 https:// 开头", "400")

    asr_options = body.build_asr_options()

    payload = {
        "model": body.model,
        "input": {
            "messages": [
                {
                    "role": "system",
                    "content": [{"text": body.system_prompt}] if body.system_prompt else [{"text": ""}],
                },
                {
                    "role": "user",
                    "content": [{"audio": body.audio_url}],
                },
            ],
        },
        "parameters": {
            "asr_options": asr_options,
        },
    }

    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=_ds_headers(), json=payload)
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", data.get("request_id", "音频识别请求失败"))
            logger.error("DashScope ASR error: %s", msg)
            return error(f"音频识别失败: {msg}")

        output = data.get("output", {})
        choices = output.get("choices", [])
        transcription = ""
        if choices:
            content_list = choices[0].get("message", {}).get("content", [])
            for item in content_list:
                if "text" in item:
                    transcription += item["text"]

        logger.info("[Audio ASR] Recognition succeeded, transcription length=%d", len(transcription))

        # --- Deduct tokens based on audio duration ---
        audio_duration = _get_audio_duration(body.audio_url)
        audio_cost = _calculate_audio_cost(audio_duration)
        logger.info("[Audio ASR] Audio duration=%.2f s, cost=%.6f yuan", audio_duration or 0, audio_cost)

        deducted_tokens = 0
        token_result = await calculate_and_deduct_tokens_by_cost(
            user_uuid=eff_user_uuid,
            yuan_cost=audio_cost,
            service_name="DashScope音频识别",
            success=True,
        )
        if token_result.get("success"):
            deducted_tokens = token_result.get("tokens_deducted", 0)
            logger.info("[Audio ASR] Token deducted: %d, new_balance=%s", deducted_tokens, token_result.get("balance"))
        else:
            logger.warning("[Audio ASR] Token deduction failed: %s", token_result.get("reason"))

        # --- Save conversation to DB ---
        try:
            await save_conversation_to_db(
                user_uuid=eff_user_uuid,
                model_name=body.model,
                problem=f"音频识别: {body.audio_url}",
                answer=transcription,
                chat_id=chat_id,
                agent_id=body.model,
                field1=str(deducted_tokens),
                summary=None,
            )
            logger.info("[Audio ASR] Conversation saved for user=%s", eff_user_uuid)
        except Exception as e:
            logger.warning("[Audio ASR] Failed to save conversation: %s", e)

        return success(
            {
                "transcription": transcription,
                "model": body.model,
                "language_detected": asr_options.get("language"),
                "audio_url": body.audio_url,
                "request_id": data.get("request_id", ""),
                "usage": data.get("usage", {}),
                "token_deduction": {
                    "tokens_deducted": deducted_tokens,
                    "yuan_cost": audio_cost,
                    "audio_duration": audio_duration,
                    "balance": token_result.get("balance"),
                },
            }
        )
    except Exception as e:
        logger.exception("Audio recognise error")
        return error(f"音频识别异常: {e}")


@router.get("/audio/models", summary="List supported ASR models")
async def audio_models():
    """Return the list of supported audio recognition models."""
    return success(
        {
            "models": [
                {"id": mid, "name": info["name"], "description": info["description"]}
                for mid, info in SUPPORTED_ASR_MODELS.items()
            ]
        }
    )


# ===========================================================================
# Vision -- Multi-modal Chat  (POST /vision/chat)
# ===========================================================================


class VisionImageInfo(BaseModel):
    """Single image entry for vision chat."""

    image_url: str = Field(..., description="图片URL")
    width: int | None = None
    height: int | None = None


class VisionChatRequest(BaseModel):
    """Vision multi-modal chat request body."""

    images: list[VisionImageInfo] = Field(..., description="图片列表,至少一张")
    prompt: str = Field(..., description="文本提示词")
    model: str = Field(default="qwen-vl-plus", description="视觉模型名称")
    max_tokens: int = Field(default=1500, description="最大生成token数")


@router.post("/vision/chat", summary="Vision multi-modal chat")
async def vision_chat(
    body: VisionChatRequest,
    user_uuid: str = Depends(require_login),
):
    """Chat with images + text via DashScope MultiModalConversation.

    Supports models like ``qwen-vl-plus``, ``qwen-vl-max``, ``qwen-vl-plus-latest``.
    """
    if not body.images:
        return error("请至少上传一张图片", "400")

    # Build content array: images first, then the text prompt
    content = []
    for img in body.images:
        content.append({"image": img.image_url})
    content.append({"text": body.prompt})

    payload = {
        "model": body.model,
        "input": {
            "messages": [
                {
                    "role": "user",
                    "content": content,
                },
            ],
        },
        "parameters": {
            "max_tokens": body.max_tokens,
        },
    }

    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=_ds_headers(), json=payload)
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", "视觉模型请求失败")
            logger.error("DashScope Vision error: %s", msg)
            return error(f"视觉对话失败: {msg}")

        output = data.get("output", {})
        choices = output.get("choices", [])
        answer = ""
        if choices:
            content_list = choices[0].get("message", {}).get("content", [])
            for item in content_list:
                if "text" in item:
                    answer += item["text"]

        return success(
            {
                "answer": answer,
                "model": body.model,
                "image_count": len(body.images),
                "request_id": data.get("request_id", ""),
                "usage": data.get("usage", {}),
            }
        )
    except Exception as e:
        logger.exception("Vision chat error")
        return error(f"视觉对话异常: {e}")


# ===========================================================================
# Video -- Synthesis  (POST /video/synthesis, GET /video/tasks/{task_id})
# ===========================================================================


class VideoSynthesisRequest(BaseModel):
    """Video synthesis request body (async task)."""

    prompt: str = Field(..., description="视频生成文本提示")
    image_url: str | None = Field(None, description="图生视频的图片URL;留空则文生视频")
    audio_url: str | None = Field(None, description="音频URL,用于音频驱动视频")
    model: str = Field(default="wan2.1-t2v-turbo", description="视频合成模型")
    duration: int = Field(default=5, ge=1, le=10, description="视频时长(秒)")
    resolution: str = Field(default="1280*720", description="视频分辨率,如 1280*720")
    zidingyican: list[dict[str, Any]] | None = Field(None, description="Extra custom parameters as name/value pairs")


# High-resolution list (costs 1 yuan/sec vs 0.6)
_HIGH_RESOLUTIONS = {
    "1248*1632",
    "1632*1248",
    "1440*1440",
    "1080*1920",
    "1920*1080",
}


def _video_token_cost(width: int, height: int, duration: int) -> float:
    """Estimate the video generation cost in yuan."""
    resolution = f"{width}*{height}"
    yuan_per_sec = 1.0 if resolution in _HIGH_RESOLUTIONS else 0.6
    return yuan_per_sec * duration


def _pick_video_model(image_url: str | None, model: str) -> str:
    """If image_url is provided and model looks like t2v, switch to i2v variant."""
    if image_url and "t2v" in model:
        return model.replace("t2v", "i2v")
    return model


@router.post("/video/synthesis", summary="Submit video synthesis task")
async def video_synthesis(
    body: VideoSynthesisRequest,
    user_uuid: str = Depends(require_login),
):
    """Submit an async video generation task to DashScope.

    Uses the ``video_generation`` HTTP endpoint with ``X-DashScope-Async``.
    Returns a ``task_id``; poll with ``GET /video/tasks/{task_id}``.
    """
    model = _pick_video_model(body.image_url, body.model)

    # merge custom parameters from zidingyican
    params: dict[str, Any] = {
        "duration": body.duration,
        "resolution": body.resolution,
    }
    if body.zidingyican:
        for p in body.zidingyican:
            params[p["name"]] = p["value"]

    api_input: dict = {"prompt": body.prompt}
    if body.image_url:
        api_input["img_url"] = body.image_url
    if body.audio_url:
        api_input["audio_url"] = body.audio_url

    payload = {
        "model": model,
        "input": api_input,
        "parameters": params,
    }

    url = "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=_ds_headers(async_mode=True), json=payload)
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", "视频任务提交失败")
            logger.error("DashScope Video submit error: %s", msg)
            return error(f"视频合成提交失败: {msg}")

        output = data.get("output", {})
        task_id = output.get("task_id", "")

        # Estimate cost for informational purposes
        resolution_parts = body.resolution.split("*")
        width = int(resolution_parts[0]) if len(resolution_parts) == 2 else 1280
        height = int(resolution_parts[1]) if len(resolution_parts) == 2 else 720
        est_cost = _video_token_cost(width, height, body.duration)

        return success(
            {
                "task_id": task_id,
                "task_status": output.get("task_status", ""),
                "model": model,
                "request_id": data.get("request_id", ""),
                "estimated_cost_yuan": round(est_cost, 2),
            }
        )
    except Exception as e:
        logger.exception("Video synthesis submit error")
        return error(f"视频合成异常: {e}")


@router.get("/video/tasks/{task_id}", summary="Query video synthesis task status")
async def video_task_status(
    task_id: str,
    user_uuid: str = Depends(require_login),
):
    """Query the status / result of an async video synthesis task."""
    url = f"https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=_ds_headers())
            data = resp.json()

        if resp.status_code != 200:
            msg = data.get("message", "查询任务失败")
            return error(f"视频任务查询失败: {msg}")

        output = data.get("output", {})
        return success(
            {
                "task_id": task_id,
                "task_status": output.get("task_status", ""),
                "video_url": output.get("video_url", ""),
                "submit_time": output.get("submit_time", ""),
                "end_time": output.get("end_time", ""),
                "task_metrics": output.get("task_metrics", {}),
                "request_id": data.get("request_id", ""),
            }
        )
    except Exception as e:
        logger.exception("Video task query error")
        return error(f"视频任务查询异常: {e}")
