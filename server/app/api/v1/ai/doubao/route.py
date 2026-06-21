"""Doubao (Volcengine) AI proxy routes -- chat, video, image generation/editing."""

import asyncio
import base64
import datetime
import hashlib
import hmac
import json
import logging
import time
import uuid as _uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    save_conversation_to_db,
)
from app.utils.file_transfer import download_file_from_url, upload_file_to_server

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DOUBAO_SEEDANCE_MODEL = "doubao-seedance-1-5-pro-251215"
DOUBAO_SEEDANCE_DB_NAME = "doubao-seedance"
DOUBAO_SEEDREAM_QUERY_MODEL = "doubao-seedream-4-5-251128"
DOUBAO_SEEDREAM_DB_MODEL = "doubao-seedream-4.0"
DOUBAO_SUBMIT_URL = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"
_V3_BASE = "https://ark.cn-beijing.volces.com/api/v3"
POLL_INTERVAL = 3  # seconds between polls
POLL_TIMEOUT = 300  # 5 minutes max


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class VideoGenerateRequest(BaseModel):
    """Request body for doubao video generation."""

    prompt: str = Field(..., description="Text prompt for video generation")
    images: list = Field(default_factory=list, description="Reference image URLs")
    user_uuid: str = Field(..., description="User UUID (passed by client)")
    chat_id: str | None = Field(None, description="Chat context ID")
    # Custom parameters (zidingyican array format)
    zidingyican: list | None = Field(None, description="Custom parameter list")


class CustomParameter(BaseModel):
    """Custom parameter model for image/video generation."""

    name: str = Field(..., description="Parameter name")
    desc: str = Field(..., description="Parameter description")
    value: Any = Field(..., description="Parameter value")


class DoubaoImageRequest(BaseModel):
    """Request body for doubao image generation (jimeng_t2i_v40 via Volcengine signed API)."""

    prompt: str
    user_uuid: str
    chat_id: str | None = None
    zidingyican: list[CustomParameter] = Field(default_factory=list, description="Custom parameters")


class SeedreamImageRequest(BaseModel):
    """Request body for Seedream image generation (via Doubao Bearer token API)."""

    prompt: str = Field(..., description="Generation prompt, supports Chinese/English")
    user_uuid: str = Field(..., description="User UUID")
    chat_id: str | None = Field(None, description="Chat context ID")
    images: str | None = Field(None, description="Image URL or Base64 for image-to-image")
    zidingyican: list[CustomParameter] = Field(default_factory=list, description="Custom parameters")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
async def _poll_task(task_id: str, headers: dict) -> dict:
    """Poll Doubao generation task until succeeded / failed / timed-out."""
    url = f"https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{task_id}"
    deadline = time.time() + POLL_TIMEOUT
    async with httpx.AsyncClient(timeout=60.0) as client:
        while time.time() < deadline:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            status = data.get("status")
            if status == "succeeded":
                return data
            if status in ("failed", "cancelled"):
                raise HTTPException(status_code=500, detail=f"Video generation failed (status={status})")
            await asyncio.sleep(POLL_INTERVAL)
    raise HTTPException(status_code=408, detail="Video generation poll timed out")


def _build_video_payload(req: VideoGenerateRequest) -> dict:
    """Build the submission payload from request, handling zidingyican params."""
    content = [{"type": "text", "text": req.prompt}]
    for img in req.images:
        content.append({"type": "image_url", "image_url": {"url": img}})

    payload = {
        "model": DOUBAO_SEEDANCE_MODEL,
        "content": content,
    }

    if not req.zidingyican:
        return payload

    prompt_params: list[str] = []
    for param in req.zidingyican:
        name = param.get("name")
        value = param.get("value")
        if name is None or value is None or value == "" or value == []:
            continue
        if name == "first_frame" and value:
            content.insert(
                1,
                {
                    "type": "image_url",
                    "image_url": {"url": value},
                    "role": "first_frame",
                },
            )
        elif name == "last_frame" and value:
            insert_idx = 2 if len(content) > 1 else len(content)
            content.insert(
                insert_idx,
                {
                    "type": "image_url",
                    "image_url": {"url": value},
                    "role": "last_frame",
                },
            )
        elif name in ("duration", "camerafixed", "watermark"):
            if isinstance(value, bool):
                prompt_params.append(f"--{name} {str(value).lower()}")
            else:
                prompt_params.append(f"--{name} {value}")
        else:
            payload[name] = value

    if prompt_params:
        content[0]["text"] = f"{req.prompt} {' '.join(prompt_params)}"
    return payload


# ---------------------------------------------------------------------------
# Volcengine V4 HMAC signer (for CVSync2Async APIs)
# ---------------------------------------------------------------------------
def _hmac_sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str, service: str) -> bytes:
    k_date = _hmac_sign(secret_key.encode("utf-8"), date_stamp)
    k_region = _hmac_sign(k_date, region)
    k_service = _hmac_sign(k_region, service)
    return _hmac_sign(k_service, "request")


class VolcengineSigner:
    """HMAC-SHA256 V4 signer for Volcengine Visual (CV) API."""

    SERVICE = "cv"
    REGION = "cn-north-1"
    HOST = "visual.volcengineapi.com"
    ENDPOINT = "https://visual.volcengineapi.com"

    def __init__(self, access_key: str, secret_key: str):
        if not access_key or not secret_key:
            raise ValueError("Access key and secret key must be provided.")
        self.access_key = access_key
        self.secret_key = secret_key

    def sign_request(self, query_params: dict[str, str], request_body: dict[str, Any]) -> tuple[str, dict, str]:
        t = datetime.datetime.now(datetime.UTC)
        ts = t.strftime("%Y%m%dT%H%M%SZ")
        datestamp = t.strftime("%Y%m%d")

        canonical_qs = "&".join(f"{k}={v}" for k, v in sorted(query_params.items()))
        payload_str = json.dumps(request_body, separators=("", ":"))
        payload_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

        signed_headers = "content-type;host;x-content-sha256;x-date"
        canonical_headers = (
            f"content-type:application/json\n"
            f"host:{self.HOST}\n"
            f"x-content-sha256:{payload_hash}\n"
            f"x-date:{ts}\n"
        )
        canonical_request = f"POST\n/\n{canonical_qs}\n" f"{canonical_headers}\n{signed_headers}\n{payload_hash}"
        algorithm = "HMAC-SHA256"
        credential_scope = f"{datestamp}/{self.REGION}/{self.SERVICE}/request"
        string_to_sign = (
            f"{algorithm}\n{ts}\n{credential_scope}\n"
            f"{hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()}"
        )
        signing_key = _signing_key(self.secret_key, datestamp, self.REGION, self.SERVICE)
        signature = hmac.new(signing_key, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

        authorization = (
            f"{algorithm} Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        headers = {
            "X-Date": ts,
            "Authorization": authorization,
            "X-Content-Sha256": payload_hash,
            "Content-Type": "application/json",
        }
        url = f"{self.ENDPOINT}?{canonical_qs}"
        return url, headers, payload_str


# ---------------------------------------------------------------------------
# Existing chat endpoints
# ---------------------------------------------------------------------------
@router.post("/chat", summary="Doubao chat completion")
async def doubao_chat(
    message: str = Query(...),
    model: str = Query("doubao-pro-32k"),
    user_uuid: str = Depends(require_login),
):
    headers = {
        "Authorization": f"Bearer {settings.DOUBAO_API_KEY}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [{"role": "user", "content": message}],
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(settings.DOUBAO_MODEL_URL, headers=headers, json=body, timeout=30)
            data = resp.json()
            choices = data.get("choices", [])
            reply = choices[0]["message"]["content"] if choices else ""
            return success({"reply": reply, "model": model})
        except Exception as e:
            return error(f"Doubao error: {e}")


@router.post("/chat/stream", summary="Doubao streaming chat")
async def doubao_stream(
    message: str = Query(...),
    model: str = Query("doubao-pro-32k"),
    user_uuid: str = Depends(require_login),
):
    headers = {"Authorization": f"Bearer {settings.DOUBAO_API_KEY}", "Content-Type": "application/json"}
    body = {"model": model, "messages": [{"role": "user", "content": message}], "stream": True}

    async def generate():
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", settings.DOUBAO_MODEL_URL, headers=headers, json=body, timeout=60) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        yield f"{line}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# NEW: Video generation (async submit + poll)
# ---------------------------------------------------------------------------
@router.post("/video/generate", summary="豆包视频生成 (Seedance, async)")
async def doubao_video_generate(request: VideoGenerateRequest):
    """
    Submit a Doubao Seedance video-generation task, poll until complete,
    persist the resulting video, deduct tokens, and return the video URL.

    Mirrors the original doubao_video_proxy.py /video-generation endpoint.
    """
    # 1. Auth headers
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.DOUBAO_API_KEY}",
    }

    # 2. Build payload
    payload = _build_video_payload(request)
    logger.info("Doubao video submit payload: %s", json.dumps(payload, ensure_ascii=False))

    try:
        # 3. Submit task
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(DOUBAO_SUBMIT_URL, json=payload, headers=headers)
            resp.raise_for_status()
            task_data = resp.json()

        task_id = task_data.get("id")
        if not task_id:
            raise HTTPException(status_code=500, detail="Failed to obtain task ID from Doubao API")

        logger.info("Doubao video task submitted: %s", task_id)

        # 4. Poll for result
        result = await _poll_task(task_id, headers)
        video_url = result.get("content", {}).get("video_url")
        if not video_url:
            raise HTTPException(status_code=500, detail="Completed task has no video_url")

        logger.info("Video generation completed: %s", video_url[:100])

        # 5. Download and persist video
        video_content = await download_file_from_url(video_url)
        if not video_content:
            raise HTTPException(status_code=500, detail="Failed to download video from source URL")

        filename = f"doubao_video_{_uuid.uuid4().hex}.mp4"
        persistent_url = await upload_file_to_server(video_content, filename)
        if not persistent_url:
            raise HTTPException(status_code=500, detail="Failed to upload video to persistent storage")

        # 6. Deduct tokens
        yuan_cost = 0.5
        deduction = await calculate_and_deduct_tokens_by_cost(
            user_uuid=request.user_uuid,
            yuan_cost=yuan_cost,
            service_name="豆包图生视频",
            success=True,
        )
        deducted_tokens = deduction.get("tokens_deducted", 0) if deduction.get("success") else 0

        # 7. Save conversation
        final_chat_id = request.chat_id or str(_uuid.uuid4())
        try:
            await save_conversation_to_db(
                user_uuid=request.user_uuid,
                model_name=DOUBAO_SEEDANCE_DB_NAME,
                agent_id=DOUBAO_SEEDANCE_DB_NAME,
                problem=request.prompt,
                answer="视频已生成",
                agent_url=persistent_url,
                chat_id=final_chat_id,
                field1=str(deducted_tokens),
            )
        except Exception as e:
            logger.error("Failed to save video conversation: %s", e)

        return success(
            {
                "video_url": persistent_url,
                "task_id": task_id,
                "total_tokens": deducted_tokens,
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("Doubao video HTTP error: %s", e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text) from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Doubao video error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


# ---------------------------------------------------------------------------
# NEW: Image generation / editing
# ---------------------------------------------------------------------------
def _doubao_image_headers() -> dict:
    """JSON auth header for Doubao image APIs."""
    return {
        "Authorization": f"Bearer {settings.DOUBAO_API_KEY}",
        "Content-Type": "application/json",
    }


@router.post("/image/generate", summary="豆包图片生成 (即梦 jimeng_t2i_v40)")
async def doubao_image_generate(request: DoubaoImageRequest):
    """
    Submit a JiMeng text-to-image task via Volcengine CVSync2Async API,
    poll until complete, persist the image, deduct tokens, and return the URL.

    Uses Volcengine V4 HMAC signing with DOUBAO_JM_API_KEY / DOUBAO_JM_SECRET_KEY.
    """
    # 1. Parse custom parameters
    params: dict = {}
    if request.zidingyican:
        for p in request.zidingyican:
            if isinstance(p.value, list) and p.value:
                params[p.name] = p.value[0]
            else:
                params[p.name] = p.value

    size_param = params.get("size", "1024*1024")
    if isinstance(size_param, dict):
        size_str = str(size_param.get("value", size_param.get("default", "1024*1024")))
    else:
        size_str = str(size_param)

    watermark = params.get("watermark", True)

    width, height = 1024, 1024
    try:
        w_str, h_str = size_str.replace("x", "*").split("*")
        if w_str.strip().isdigit() and h_str.strip().isdigit():
            width, height = int(w_str), int(h_str)
    except (ValueError, IndexError, AttributeError):
        logger.warning("Could not parse size string '%s', using default 1024x1024", size_str)

    # 2. Build signer
    ak = settings.DOUBAO_JM_API_KEY
    sk = settings.DOUBAO_JM_SECRET_KEY
    if not ak or not sk:
        raise HTTPException(
            status_code=500, detail="Volcengine API keys not configured (DOUBAO_JM_API_KEY / DOUBAO_JM_SECRET_KEY)"
        )

    signer = VolcengineSigner(ak, sk)
    req_key = "jimeng_t2i_v40"

    # 3. Submit async task
    submit_body: dict[str, Any] = {
        "req_key": req_key,
        "prompt": request.prompt,
        "size": width * height,
        "width": width,
        "height": height,
        "response_format": "url",
        "seed": -1,
        "n": 1,
        "add_watermark": watermark,
    }
    submit_params = {"Action": "CVSync2AsyncSubmitTask", "Version": "2022-08-31"}

    try:
        url, headers, payload = signer.sign_request(submit_params, submit_body)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, content=payload)
        resp.raise_for_status()
        resp_data = resp.json()

        task_id = resp_data.get("data", {}).get("task_id")
        if not task_id:
            logger.error("Image submit failed, no task_id. Response: %s", resp_data)
            raise HTTPException(status_code=500, detail="Failed to submit image generation task")

        logger.info("Image task submitted: %s", task_id)

        # 4. Poll for result
        poll_params = {"Action": "CVSync2AsyncGetResult", "Version": "2022-08-31"}
        poll_body = {"req_key": req_key, "task_id": task_id}
        final_data = None

        for _i in range(60):
            await asyncio.sleep(5)
            poll_url, poll_headers, poll_payload = signer.sign_request(poll_params, poll_body)
            async with httpx.AsyncClient(timeout=60) as client:
                poll_resp = await client.post(poll_url, headers=poll_headers, content=poll_payload)
            poll_resp.raise_for_status()
            poll_data = poll_resp.json()
            if poll_data.get("data", {}).get("status") == "done":
                final_data = poll_data
                break

        if not final_data:
            raise HTTPException(status_code=408, detail="Image generation timed out")

        # 5. Extract image content (prefer base64, fallback to URL)
        result_data = final_data.get("data", {})
        image_content: bytes | None = None

        base64_list = result_data.get("binary_data_base64", [])
        if base64_list:
            try:
                image_content = base64.b64decode(base64_list[0])
            except Exception as e:
                logger.error("Base64 decode failed: %s", e)
                raise HTTPException(status_code=500, detail="Invalid base64 image data returned") from e
        else:
            image_urls = result_data.get("result", {}).get("image_urls", [])
            if image_urls:
                image_content = await download_file_from_url(image_urls[0])

        if not image_content:
            raise HTTPException(status_code=500, detail="Task completed but no image content obtained")

        # 6. Persist image
        filename = f"volc_cv_t2i_{_uuid.uuid4().hex}.jpg"
        persistent_url = await upload_file_to_server(image_content, filename)
        if not persistent_url:
            raise HTTPException(status_code=500, detail="Failed to persist generated image")

        # 7. Deduct tokens
        yuan_cost = 0.2
        deduction = await calculate_and_deduct_tokens_by_cost(
            user_uuid=request.user_uuid,
            yuan_cost=yuan_cost,
            service_name="火山CV文生图",
            success=True,
        )
        total_tokens = deduction.get("tokens_deducted", 0) if deduction.get("success") else 0

        # 8. Save conversation
        try:
            answer_content = f"图像生成完成,图片链接:{persistent_url}"
            await save_conversation_to_db(
                user_uuid=request.user_uuid,
                agent_id=DOUBAO_SEEDREAM_DB_MODEL,
                model_name=DOUBAO_SEEDREAM_DB_MODEL,
                problem=request.prompt,
                answer=answer_content,
                chat_id=request.chat_id,
                agent_url=persistent_url,
                user_url="",
                cost_info={
                    "yuan_cost": yuan_cost,
                    "tokens": total_tokens,
                    "base_tokens_per_yuan": deduction.get("base_tokens_per_yuan"),
                    "multiplier": deduction.get("multiplier"),
                },
            )
        except Exception as e:
            logger.error("Failed to save conversation: %s", e)

        return success(
            {
                "image_url": persistent_url,
                "total_tokens": total_tokens,
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("Volcengine API HTTP error: %s - %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail=f"Upstream error: {e.response.text}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Image generation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/image/seedream", summary="Seedream 图片生成")
async def doubao_seedream(request: SeedreamImageRequest):
    """
    Call Doubao Seedream model for image generation via /v3/images/generations
    with Bearer token auth.  Mirrors the original doubao_image_proxy.py
    /doubao-seedream-generation endpoint.
    """
    # 1. Parse custom parameters
    params: dict = {}
    if request.zidingyican:
        for p in request.zidingyican:
            if isinstance(p.value, list) and p.value:
                params[p.name] = p.value[0]
            else:
                params[p.name] = p.value

    model = DOUBAO_SEEDREAM_QUERY_MODEL
    prompt = request.prompt
    image = request.images
    size = params.get("size", "2K")
    seed = params.get("seed", -1)
    sequential_image_generation = params.get("sequential_image_generation", "disabled")
    stream = params.get("stream", False)
    response_format = params.get("response_format", "url")
    watermark = params.get("watermark", True)

    # 2. Build payload
    payload: dict[str, Any] = {
        "model": model,
        "prompt": prompt,
        "response_format": response_format,
        "watermark": watermark,
    }
    if image:
        payload["image"] = image
    if size:
        payload["size"] = size
    if seed != -1:
        payload["seed"] = seed
    if sequential_image_generation != "disabled":
        payload["sequential_image_generation"] = sequential_image_generation
        seq_options = params.get("sequential_image_generation_options")
        if seq_options:
            payload["sequential_image_generation_options"] = seq_options
    if stream:
        payload["stream"] = stream
    optimize_opts = params.get("optimize_prompt_options")
    if optimize_opts:
        payload["optimize_prompt_options"] = optimize_opts

    logger.info("Seedream request payload: %s", json.dumps(payload, ensure_ascii=False))

    # 3. Call API
    headers = _doubao_image_headers()
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(settings.DOUBAO_IMAGE_API_URL, headers=headers, json=payload)
        resp.raise_for_status()
        resp_data = resp.json()

        if "data" not in resp_data or not resp_data["data"]:
            raise HTTPException(status_code=500, detail="Seedream returned no image data")

        # 4. Process returned images
        images: list[str] = []
        for item in resp_data["data"]:
            if response_format == "url":
                image_url = item.get("url")
                if image_url:
                    persistent_url = await upload_file_to_server(image_url, "")
                    if persistent_url:
                        images.append(persistent_url)
            elif response_format == "b64_json":
                b64_data = item.get("b64_json")
                if b64_data:
                    try:
                        image_content = base64.b64decode(b64_data)
                        fname = f"seedream_{_uuid.uuid4().hex}.jpg"
                        persistent_url = await upload_file_to_server(image_content, fname)
                        if persistent_url:
                            images.append(persistent_url)
                    except Exception as e:
                        logger.error("Base64 decode failed: %s", e)

        if not images:
            raise HTTPException(status_code=500, detail="Image processing failed, no valid images")

        # 5. Deduct tokens
        image_count = len(images)
        yuan_cost = 0.25 * image_count
        deduction = await calculate_and_deduct_tokens_by_cost(
            user_uuid=request.user_uuid,
            yuan_cost=yuan_cost,
            service_name="豆包Seedream图像生成",
            success=True,
        )
        total_tokens = deduction.get("tokens_deducted", 0) if deduction.get("success") else 0

        # 6. Save conversation
        try:
            answer_content = f"图像生成完成,共生成{len(images)}张图片,图片链接:{', '.join(images)}"
            agent_url = ", ".join(images)
            user_image_url = request.images if request.images else ""
            await save_conversation_to_db(
                user_uuid=request.user_uuid,
                agent_id=DOUBAO_SEEDREAM_DB_MODEL,
                model_name=DOUBAO_SEEDREAM_DB_MODEL,
                problem=request.prompt,
                answer=answer_content,
                chat_id=request.chat_id,
                agent_url=agent_url,
                user_url=user_image_url,
                cost_info={
                    "yuan_cost": yuan_cost,
                    "tokens": total_tokens,
                    "base_tokens_per_yuan": deduction.get("base_tokens_per_yuan"),
                    "multiplier": deduction.get("multiplier"),
                },
            )
        except Exception as e:
            logger.error("Failed to save conversation: %s", e)

        return success(
            {
                "image_url": images,
                "count": len(images),
                "total_tokens": total_tokens,
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("Seedream HTTP error: %s - %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail=f"Upstream error: {e.response.text}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Seedream error: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/image/edit", summary="豆包图片编辑")
async def doubao_image_edit(
    prompt: str = Form(..., description="编辑指令 prompt"),
    image: UploadFile = File(..., description="待编辑的原始图片"),
    mask: UploadFile = File(None, description="遮罩图片(可选),标记需要编辑的区域"),
    model: str = Form(
        "doubao-seedream-3-0-i2i-250415",
        description="图片编辑模型名称",
    ),
    size: str = Form("1024x1024", description="输出图片尺寸"),
    n: int = Form(1, ge=1, le=10, description="生成数量"),
    strength: float = Form(0.8, ge=0.0, le=1.0, description="编辑强度,0-1"),
    response_format: str = Form("url", description="返回格式: url / b64_json"),
    user_uuid: str = Depends(require_login),
):
    """调用豆包图片编辑 API(/v3/images/edits)."""
    url = f"{_V3_BASE}/images/edits"

    image_bytes = await image.read()
    mask_bytes = await mask.read() if mask else None

    form_data = {
        "prompt": prompt,
        "model": model,
        "size": size,
        "n": str(n),
        "strength": str(strength),
        "response_format": response_format,
    }
    files = {
        "image": (image.filename, image_bytes, image.content_type or "image/png"),
    }
    if mask_bytes:
        files["mask"] = (mask.filename, mask_bytes, mask.content_type or "image/png")

    auth_headers = {"Authorization": f"Bearer {settings.DOUBAO_API_KEY}"}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                url,
                headers=auth_headers,
                data=form_data,
                files=files,
                timeout=120,
            )
            data = resp.json()
            if resp.status_code != 200:
                logger.error("Doubao image edit failed: %s", data)
                return error(
                    data.get("error", {}).get("message", "图片编辑失败"),
                    code=str(resp.status_code),
                )
            return success(data)
        except Exception as e:
            logger.error("Doubao image edit error: %s", e)
            return error(f"图片编辑失败: {e}")
