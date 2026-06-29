"""
Tencent Hunyuan 3D API proxy route.

Provides HTTP endpoints for submitting and querying 3D model generation tasks
via the Tencent Cloud AI3D service, with token billing, file persistence,
and background task polling.

Ported from coze_zhs_py/api/tencent_hunyuan_3d.py
"""

import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Path
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
# Tencent AI3D constants
# ---------------------------------------------------------------------------
TENCENT_AI3D_ENDPOINT = "https://ai3d.tencentcloudapi.com"
TENCENT_AI3D_REGION = "ap-guangzhou"

# Task scheduler config
INITIAL_WAIT_TIME = 5 * 60  # 5 minutes first check
POLL_INTERVAL = 30  # 30s between checks
MAX_RETRIES = 20  # max retries (~10 hours)
ACTIVE_JOBS: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ViewImage(BaseModel):
    View: str = Field(..., description="视角: left / right / back")
    ImageBase64: str | None = None
    ImageUrl: str | None = None


class SubmitHunyuan3DRequest(BaseModel):
    Prompt: str | None = Field(None, description="文生3D描述,最多1024字符")
    ImageBase64: str | None = Field(None, description="输入图Base64 (<=8MB)")
    ImageUrl: str | None = Field(None, description="输入图URL (<=8MB)")
    MultiViewImages: list[ViewImage] | None = None
    ResultFormat: str | None = Field("OBJ", description="OBJ/GLB/STL/USDZ/FBX/MP4")
    EnablePBR: bool | None = Field(False)


class QueryHunyuan3DRequest(BaseModel):
    JobId: str = Field(..., description="任务ID")


# ---------------------------------------------------------------------------
# Tencent Cloud TC3 signature helper
# ---------------------------------------------------------------------------


def _build_tencent_headers(action: str, payload: str) -> dict[str, str]:
    """Build Tencent Cloud TC3-HMAC-SHA256 headers."""
    import datetime as _dt
    import hashlib
    import hmac

    service = "ai3d"
    version = "2025-05-13"
    algorithm = "TC3-HMAC-SHA256"
    timestamp = int(time.time())
    date = _dt.datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")

    http_method = "POST"
    canonical_uri = "/"
    canonical_querystring = ""
    content_type = "application/json; charset=utf-8"
    host = TENCENT_AI3D_ENDPOINT.replace("https://", "")
    canonical_headers = f"content-type:{content_type}\n" f"host:{host}\n" f"x-tc-action:{action.lower()}\n"
    signed_headers = "content-type;host;x-tc-action"
    hashed_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    canonical_request = (
        f"{http_method}\n{canonical_uri}\n{canonical_querystring}\n"
        f"{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    )

    credential_scope = f"{date}/{service}/tc3_request"
    hashed_request = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_request}"

    def _hmac_sha256(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _hmac_sha256(("TC3" + settings.TENCENT_SECRET_KEY).encode("utf-8"), date)
    secret_service = _hmac_sha256(secret_date, service)
    secret_signing = _hmac_sha256(secret_service, "tc3_request")
    signature = hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    authorization = (
        f"{algorithm} "
        f"Credential={settings.TENCENT_SECRET_ID}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, "
        f"Signature={signature}"
    )

    return {
        "Content-Type": content_type,
        "Host": host,
        "X-TC-Action": action,
        "X-TC-Version": version,
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Region": TENCENT_AI3D_REGION,
        "Authorization": authorization,
    }


async def _tencent_api_call(action: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Call a Tencent AI3D API action and return the JSON response."""
    payload_str = json.dumps(payload)
    headers = _build_tencent_headers(action, payload_str)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(TENCENT_AI3D_ENDPOINT, headers=headers, content=payload_str)
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# 3D file processing helpers
# ---------------------------------------------------------------------------


def _generate_model_filename(job_id: str, file_type: str) -> str:
    ext_map = {"obj": "zip", "glb": "glb", "stl": "stl", "usdz": "usdz", "fbx": "fbx", "mp4": "mp4"}
    ext = ext_map.get(file_type.lower(), "zip")
    return f"{job_id}_{file_type.lower()}.{ext}"


def _generate_preview_filename(job_id: str) -> str:
    return f"{job_id}_preview.png"


async def _process_3d_files(job_id: str, result_data: dict[str, Any]) -> dict[str, Any]:
    """Download 3D files from Tencent URLs and persist to our file server."""
    processed = result_data.copy()
    for file_info in processed.get("ResultFile3Ds", []):
        # Main model file
        if file_info.get("Url"):
            filename = _generate_model_filename(job_id, file_info.get("Type", "unknown"))
            file_bytes = await download_file_from_url(file_info["Url"])
            if file_bytes:
                new_url = await upload_file_to_server(file_bytes, filename)
                if new_url:
                    file_info["Url"] = new_url
                    logger.info("3D file persisted: %s -> %s", filename, new_url)

        # Preview image
        if file_info.get("PreviewImageUrl"):
            preview_fn = _generate_preview_filename(job_id)
            preview_bytes = await download_file_from_url(file_info["PreviewImageUrl"])
            if preview_bytes:
                new_url = await upload_file_to_server(preview_bytes, preview_fn)
                if new_url:
                    file_info["PreviewImageUrl"] = new_url

    return processed


# ---------------------------------------------------------------------------
# Background task polling
# ---------------------------------------------------------------------------


async def _poll_job_status(job_id: str, user_uuid: str, prompt: str, image_url: str):
    """Background: poll Tencent until job completes, then persist and record."""
    ACTIVE_JOBS[job_id] = {
        "user_uuid": user_uuid,
        "prompt": prompt,
        "image_url": image_url,
        "submit_time": datetime.now(),
        "retry_count": 0,
        "status": "PENDING",
    }

    # Wait initial period
    await asyncio.sleep(INITIAL_WAIT_TIME)

    for retry in range(1, MAX_RETRIES + 1):
        if job_id not in ACTIVE_JOBS:
            return
        ACTIVE_JOBS[job_id]["retry_count"] = retry

        try:
            result = await _tencent_api_call("QueryHunyuanTo3DJob", {"JobId": job_id})
            resp = result.get("Response", {})
            status = resp.get("Status", "UNKNOWN")
            ACTIVE_JOBS[job_id]["status"] = status

            if status == "DONE" and resp.get("ResultFile3Ds"):
                processed = await _process_3d_files(job_id, resp)

                # Build result message for conversation record
                file_urls = []
                preview_urls = []
                for f in processed.get("ResultFile3Ds", []):
                    if f.get("Url"):
                        file_urls.append(f"{f.get('Type', '')}: {f['Url']}")
                    if f.get("PreviewImageUrl"):
                        preview_urls.append(f["PreviewImageUrl"])

                result_text = "3D模型生成成功"
                agent_url = ";".join(file_urls)
                if preview_urls:
                    agent_url += "\n" + preview_urls[0]

                await save_conversation_to_db(
                    user_uuid=user_uuid,
                    model_name="腾讯混元3D",
                    problem=prompt or "",
                    answer=result_text,
                    agent_id=job_id,
                    agent_url=agent_url,
                )
                ACTIVE_JOBS.pop(job_id, None)
                return

            if status in ("FAILED", "CANCELLED"):
                error_msg = resp.get("ErrorMsg", "未知错误")
                await save_conversation_to_db(
                    user_uuid=user_uuid,
                    model_name="腾讯混元3D",
                    problem=prompt or "",
                    answer=f"3D模型生成失败: {error_msg}",
                    agent_id=job_id,
                )
                ACTIVE_JOBS.pop(job_id, None)
                return

            # Still running -- back off
        except Exception as e:
            logger.error("Poll error for job %s: %s", job_id, e)

        await asyncio.sleep(min(POLL_INTERVAL * (1.5 ** (retry - 1)), 300))

    ACTIVE_JOBS.pop(job_id, None)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.post("/hunyuan3d/submit", summary="提交混元3D任务")
async def submit_hunyuan3d(
    request: SubmitHunyuan3DRequest,
    user_uuid: str = Depends(require_login),
):
    """Submit a Hunyuan 3D model generation task (text-to-3D or image-to-3D)."""
    try:
        if not any([request.Prompt, request.ImageBase64, request.ImageUrl]):
            return error("Prompt / ImageBase64 / ImageUrl 至少提供一个", code="400")

        if request.Prompt and (request.ImageBase64 or request.ImageUrl):
            return error("Prompt 和 ImageBase64/ImageUrl 不能同时存在", code="400")

        params: dict[str, Any] = {}
        if request.Prompt:
            params["Prompt"] = request.Prompt
        if request.ImageBase64:
            params["ImageBase64"] = request.ImageBase64
        if request.ImageUrl:
            params["ImageUrl"] = request.ImageUrl
        if request.MultiViewImages:
            params["MultiViewImages"] = [
                {k: v for k, v in img.model_dump().items() if v is not None} for img in request.MultiViewImages
            ]
        if request.ResultFormat:
            params["ResultFormat"] = request.ResultFormat
        if request.EnablePBR is not None:
            params["EnablePBR"] = request.EnablePBR

        result = await _tencent_api_call("SubmitHunyuanTo3DJob", params)
        resp_data = result.get("Response", {})
        job_id = resp_data.get("JobId")

        if not job_id:
            return error(f"提交任务失败: {resp_data.get('Error', {}).get('Message', '未知错误')}")

        # Deduct tokens (2.1 yuan per call)
        deduct_result = await calculate_and_deduct_tokens_by_cost(
            user_uuid=user_uuid,
            yuan_cost=2.1,
            service_name="腾讯混元3D",
            success=True,
        )
        if deduct_result.get("success"):
            logger.info(
                "Tokens deducted: %s, balance: %s", deduct_result.get("tokens_deducted"), deduct_result.get("balance")
            )

        # Save conversation record
        await save_conversation_to_db(
            user_uuid=user_uuid,
            model_name="腾讯混元3D",
            problem=request.Prompt or "",
            answer="任务已提交,等待生成...",
            agent_id=job_id,
            user_url=request.ImageUrl,
        )

        # Schedule background polling
        asyncio.create_task(_poll_job_status(job_id, user_uuid, request.Prompt, request.ImageUrl))  # type: ignore[arg-type]  # noqa: RUF006
        logger.info("Background poll scheduled for job %s", job_id)

        return success({"JobId": job_id}, msg="任务提交成功,系统将在5分钟后开始检查任务状态")

    except httpx.HTTPStatusError as e:
        logger.error("Tencent AI3D HTTP error: %s", e)
        return error(f"腾讯云API调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Tencent AI3D submit error: %s", e)
        return error(f"提交任务失败: {e}")


@router.post("/hunyuan3d/query", summary="查询混元3D任务状态")
async def query_hunyuan3d_post(
    request: QueryHunyuan3DRequest,
    user_uuid: str = Depends(require_login),
):
    """Query the status and result of a Hunyuan 3D task via POST body."""
    try:
        result = await _tencent_api_call("QueryHunyuanTo3DJob", {"JobId": request.JobId})
        resp_data = result.get("Response", {})

        # If completed, persist files
        if resp_data.get("Status") == "DONE" and resp_data.get("ResultFile3Ds"):
            try:
                resp_data = await _process_3d_files(request.JobId, resp_data)
            except Exception as e:
                logger.error("File persistence failed for %s: %s", request.JobId, e)

        return success(resp_data)

    except httpx.HTTPStatusError as e:
        logger.error("Tencent AI3D query HTTP error: %s", e)
        return error(f"腾讯云API调用失败: {e.response.status_code}")
    except Exception as e:
        logger.error("Tencent AI3D query error: %s", e)
        return error(f"查询任务失败: {e}")


@router.get("/hunyuan3d/task/{task_id}", summary="查询混元3D任务状态")
async def query_hunyuan3d(task_id: str = Path(...), user_uuid: str = Depends(require_login)):
    """Query the status and result of a Hunyuan 3D task via path parameter."""
    return await query_hunyuan3d_post(
        QueryHunyuan3DRequest(JobId=task_id),
        user_uuid=user_uuid,
    )


@router.get("/hunyuan3d/active-jobs", summary="查看当前活跃任务")
async def get_active_jobs(user_uuid: str = Depends(require_login)):
    """View currently active polling jobs."""
    jobs_info = {}
    for jid, info in ACTIVE_JOBS.items():
        copy = info.copy()
        if "submit_time" in copy:
            copy["submit_time"] = copy["submit_time"].strftime("%Y-%m-%d %H:%M:%S")
        copy["wait_minutes"] = round((datetime.now() - info["submit_time"]).total_seconds() / 60, 1)
        jobs_info[jid] = copy

    return success({"active_count": len(ACTIVE_JOBS), "jobs": jobs_info})
