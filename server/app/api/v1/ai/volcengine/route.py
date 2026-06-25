"""
Volcengine (Volcano Engine) visual proxy routes.

Covers:
  - POST /jimeng/image   -> JiMeng 4.0 text-to-image (CVSync2Async)
  - POST /jimeng/generate -> JiMeng 3.1 generation
  - POST /visual/{req_key} -> Generic Volcengine visual proxy (CVSync2Async async submit+poll)
  - POST /jimeng4/process -> JiMeng 4.0 CVProcess direct proxy
  - GET  /ping            -> Health check
"""

import asyncio
import datetime
import hashlib
import hmac
import json
import logging
import uuid as _uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.common import success
from app.security import require_login
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    save_conversation_to_db,
)
from app.utils.file_transfer import download_file_from_url, upload_file_to_server

logger = logging.getLogger(__name__)
router = APIRouter()


# =========================================================================
# Volcengine V4 Signature
# =========================================================================


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret_key: str, date_stamp: str, region: str, service: str) -> bytes:
    k_date = _sign(secret_key.encode("utf-8"), date_stamp)
    k_region = _sign(k_date, region)
    k_service = _sign(k_region, service)
    return _sign(k_service, "request")


class VolcengineSigner:
    """HMAC-SHA256 V4 request signer for Volcengine Visual API."""

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


def _get_signer() -> VolcengineSigner:
    ak = settings.DOUBAO_JM_API_KEY
    sk = settings.DOUBAO_JM_SECRET_KEY
    if not ak or not sk:
        raise HTTPException(status_code=500, detail="Volcengine API keys not configured")
    return VolcengineSigner(ak, sk)


# =========================================================================
# Shared async polling helper
# =========================================================================


async def _poll_async_task(
    signer: VolcengineSigner,
    req_key: str,
    task_id: str,
    max_polls: int = 60,
    interval: float = 5.0,
) -> dict:
    """Poll CVSync2AsyncGetResult until done or timeout."""
    poll_params = {"Action": "CVSync2AsyncGetResult", "Version": "2022-08-31"}
    poll_body = {"req_key": req_key, "task_id": task_id}
    for _i in range(max_polls):
        await asyncio.sleep(interval)
        url, headers, body = signer.sign_request(poll_params, poll_body)
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, headers=headers, content=body)
        resp.raise_for_status()
        data = resp.json()
        if data.get("data", {}).get("status") == "done":
            return data
    raise HTTPException(status_code=408, detail="Async task poll timed out")


# =========================================================================
# Pydantic models
# =========================================================================


class CustomParameter(BaseModel):
    """Custom parameter model for visual generation."""

    name: str = Field(..., description="Parameter name")
    desc: str = Field(..., description="Parameter description")
    value: Any = Field(..., description="Parameter value")


class Jimeng4ImageRequest(BaseModel):
    """JiMeng 4.0 text-to-image request (mirrors official API fields)."""

    prompt: str = Field(..., max_length=800, description="Generation prompt")
    image_urls: list[str] | None = Field(None, description="Reference images (0-10)")
    size: int | None = Field(None, description="Total pixel area [1024*1024, 4096*4096]")
    width: int | None = Field(None, description="Image width (use with height)")
    height: int | None = Field(None, description="Image height (use with width)")
    seed: int | None = Field(None, description="Random seed, default -1")
    scale: float | None = Field(None, description="Text influence [0,1], default 0.5")
    force_single: bool | None = Field(None, description="Force single image")
    min_ratio: float | None = Field(None, description="Min width/height ratio")
    max_ratio: float | None = Field(None, description="Max width/height ratio")
    return_url: bool | None = Field(None, description="Return image URLs (24h validity)")

    model_config = {"extra": "allow"}


class Jimeng31Request(BaseModel):
    """JiMeng 3.1 generation request."""

    prompt: str = Field(..., description="Generation prompt")


class VisualGenericRequest(BaseModel):
    """Generic visual proxy request body -- supports async submit+poll with token deduction."""

    prompt: str = Field(..., max_length=800, description="Generation prompt")
    images: list[str] | None = Field(None, description="Image URLs for i2v tasks")
    user_uuid: str = Field(..., description="User UUID")
    chat_id: str | None = Field(None, description="Chat context ID")
    first: bool = Field(True, description="Whether first-frame generation")
    zidingyican: list[CustomParameter] = Field(default_factory=list, description="Custom parameters")

    model_config = {"extra": "allow"}


class Jimeng4ProcessRequest(BaseModel):
    """JiMeng 4.0 CVProcess direct proxy request."""

    req_key: str
    model_config = {"extra": "allow"}


JIMENGYUNJING_DB_NAME = "volcengine-t2v-recamera"


# =========================================================================
# Routes
# =========================================================================


@router.get("/ping", summary="Health check")
async def ping():
    return success({"ok": True, "module": "volcengine"})


@router.post("/jimeng/image", summary="JiMeng 4.0 text-to-image (async)")
async def jimeng4_image(request: Jimeng4ImageRequest, _: str = Depends(require_login)):
    """
    Submit a JiMeng 4.0 image generation task via CVSync2Async,
    poll until complete, and return image URLs / base64 data.
    """
    signer = _get_signer()
    req_key = "jimeng_t2i_v40"

    # Build request body, excluding None values
    body = request.model_dump(exclude_none=True)
    body["req_key"] = req_key

    submit_params = {"Action": "CVSync2AsyncSubmitTask", "Version": "2022-08-31"}
    try:
        url, headers, payload = signer.sign_request(submit_params, body)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, content=payload)
        resp.raise_for_status()
        resp_data = resp.json()

        task_id = resp_data.get("data", {}).get("task_id")
        if not task_id:
            raise HTTPException(status_code=500, detail="No task_id returned from submission")

        logger.info("JiMeng4 image task submitted: %s", task_id)

        # Poll
        final = await _poll_async_task(signer, req_key, task_id)
        data_block = final.get("data", {})

        # Collect image URLs (prefer url, fallback to base64)
        image_urls: list[str] = []
        if isinstance(data_block.get("image_urls"), list):
            image_urls = data_block["image_urls"]
        elif isinstance(data_block.get("image_url"), str):
            image_urls = [data_block["image_url"]]

        # Handle base64 binary data if present
        bin_b64 = data_block.get("binary_data_base64")
        if bin_b64 and not image_urls:

            b64_list = bin_b64 if isinstance(bin_b64, list) else [bin_b64]
            for item in b64_list:
                if isinstance(item, (str, bytes, bytearray)) and item:
                    raw = item if isinstance(item, str) else item.decode("utf-8", errors="ignore")
                    if not raw.startswith("data:"):
                        raw = f"data:image/png;base64,{raw}"
                    image_urls.append(raw)

        return success(
            {
                "image_urls": image_urls,
                "request_id": resp_data.get("request_id"),
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("JiMeng4 image HTTP error: %s - %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail="上游服务异常") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error("JiMeng4 image error: %s", e)
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/jimeng/generate", summary="JiMeng 3.1 generation")
async def jimeng31_generate(request: Jimeng31Request, _: str = Depends(require_login)):
    """
    Proxy a JiMeng 3.1 generation request via CVProcess.
    """
    signer = _get_signer()
    req_key = "jimeng_t2i_v31"

    body: dict[str, Any] = {
        "req_key": req_key,
        "prompt": request.prompt,
    }

    query_params = {"Action": "CVProcess", "Version": "2022-08-31"}
    try:
        url, headers, payload = signer.sign_request(query_params, body)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, content=payload)
        resp.raise_for_status()
        data = resp.json()

        # Replace & with & for readability
        try:
            data_str = json.dumps(data, ensure_ascii=False).replace("\\u0026", "&")
            data = json.loads(data_str)
        except Exception:
            logger.debug("func")
            pass

        return success(data)

    except httpx.HTTPStatusError as e:
        logger.error("JiMeng31 HTTP error: %s - %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail="上游服务异常") from e
    except Exception as e:
        logger.error("JiMeng31 error: %s", e)
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/visual/{req_key}", summary="火山视觉通用代理 (CVSync2Async async submit+poll)")
async def visual_proxy(req_key: str, request: VisualGenericRequest, _: str = Depends(require_login)):
    """
    Submit a Volcengine visual task (text-to-video, image-to-video, etc.)
    via CVSync2Async, poll until complete, persist the resulting video,
    deduct tokens, and return the video URL.

    Mirrors the original volcengine_visual_proxy.py /visual/{req_key} endpoint.
    """
    # 1. Parse custom parameters
    params: dict = {}
    if request.zidingyican:
        for p in request.zidingyican:
            if isinstance(p.value, list) and p.value:
                params[p.name] = p.value[0]
            else:
                params[p.name] = p.value

    frames = params.get("frames", 5)
    # Convert seconds to frames
    if frames == 5:
        frames = 121
    elif frames == 10:
        frames = 241
    else:
        frames = 121

    # 2. Build signer
    signer = _get_signer()

    # 3. Build submit body
    submit_body: dict[str, Any] = request.model_dump(
        exclude={"user_uuid", "chat_id", "zidingyican", "images"},
        exclude_none=True,
    )
    submit_body.update(params)
    submit_body["frames"] = frames
    submit_body["image_urls"] = request.images
    submit_body["req_key"] = req_key

    seed_val = params.get("seed")
    if seed_val is not None:
        try:
            submit_body["seed"] = int(seed_val)
        except (ValueError, TypeError):
            submit_body["seed"] = seed_val
    else:
        submit_body["seed"] = None

    submit_body["aspect_ratio"] = params.get("aspect_ratio")

    logger.info(
        "Visual proxy submit body for req_key=%s: %s", req_key, json.dumps(submit_body, ensure_ascii=False, default=str)
    )

    submit_params = {"Action": "CVSync2AsyncSubmitTask", "Version": "2022-08-31"}

    try:
        # 4. Submit async task
        url, headers, payload = signer.sign_request(submit_params, submit_body)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, content=payload)
        resp.raise_for_status()
        resp_data = resp.json()

        task_id = resp_data.get("data", {}).get("task_id")
        if not task_id:
            logger.error("Visual submit failed, no task_id. Response: %s", resp_data)
            raise HTTPException(status_code=500, detail="Failed to submit visual task")

        logger.info("Visual task submitted: %s (req_key=%s)", task_id, req_key)

        # 5. Poll for result
        final = await _poll_async_task(signer, req_key, task_id)
        data_block = final.get("data", {})

        # 6. Extract and persist video
        original_video_url = data_block.get("video_url", "")
        persistent_url = original_video_url
        video_ratio = "unknown"

        if original_video_url:
            video_content = await download_file_from_url(original_video_url)
            if video_content:
                fname = f"volcengine_t2v_{task_id}.mp4"
                new_url = await upload_file_to_server(video_content, fname)
                if new_url:
                    persistent_url = new_url
                    logger.info("Video persisted: %s", persistent_url)
                else:
                    logger.warning("Video upload failed, using original URL")
            else:
                logger.warning("Video download failed, using original URL")

        # 7. Deduct tokens
        yuan_cost = round(0.4 * (frames / 24.2), 2)
        token_result = await calculate_and_deduct_tokens_by_cost(
            user_uuid=request.user_uuid,
            yuan_cost=yuan_cost,
            service_name="即梦文生视频",
            success=True,
        )
        deducted_tokens = token_result.get("tokens_deducted", 0) if token_result.get("success") else 0

        # 8. Save conversation
        final_chat_id = request.chat_id or str(_uuid.uuid4())
        try:
            await save_conversation_to_db(
                user_uuid=request.user_uuid,
                model_name=JIMENGYUNJING_DB_NAME,
                agent_id=JIMENGYUNJING_DB_NAME,
                problem=request.prompt,
                answer="视频已生成",
                agent_url=persistent_url,
                chat_id=final_chat_id,
                field1=str(deducted_tokens),
                video_ratio=video_ratio,
            )
        except Exception as e:
            logger.error("Failed to save visual conversation: %s", e)

        return success(
            {
                "video_url": persistent_url,
                "total_tokens": deducted_tokens,
                "video_ratio": video_ratio,
            }
        )

    except httpx.HTTPStatusError as e:
        logger.error("Volcengine visual HTTP error: %s - %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail="上游服务异常") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Visual proxy error for req_key=%s: %s", req_key, e)
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e


@router.post("/jimeng4/process", summary="即梦4.0 CVProcess 通用转发")
async def jimeng4_process(body: Jimeng4ProcessRequest, _: str = Depends(require_login)):
    """
    JiMeng 4.0 CVProcess generic proxy.
    Forwards the body (with arbitrary extra fields) via CVProcess to Volcengine.
    Mirrors the original volcengine_visual_proxy.py /jimeng4/process endpoint.
    """
    signer = _get_signer()
    query_params = {"Action": "CVProcess", "Version": "2022-08-31"}
    request_body: dict[str, Any] = body.model_dump()

    try:
        url, headers, payload = signer.sign_request(query_params, request_body)
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, headers=headers, content=payload)
        resp.raise_for_status()
        data = resp.json()

        # Replace & with & for readability
        try:
            data_str = json.dumps(data, ensure_ascii=False).replace("\\u0026", "&")
            data = json.loads(data_str)
        except Exception:
            logger.debug("func")
            pass

        return success(data)

    except httpx.HTTPStatusError as e:
        logger.error("JiMeng4 CVProcess HTTP error: %s - %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail="上游服务异常") from e
    except Exception as e:
        logger.error("JiMeng4 CVProcess error: %s", e)
        raise HTTPException(status_code=500, detail="服务内部错误,请稍后重试") from e
