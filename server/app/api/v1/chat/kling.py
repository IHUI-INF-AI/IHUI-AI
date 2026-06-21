"""Kling AI proxy routes -- face identification, lip-sync video, text-to-video, text-to-image, task polling."""

import asyncio
import uuid as _uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field

from app.config import settings
from app.core.tracking import (
    EVENT_CHAT_SEND,
    track_event,
    track_funnel,
)
from app.schemas.common import error, success
from app.security import require_login
from app.services.token_utils_service import (
    calculate_and_deduct_tokens_by_cost,
    check_user_token_sufficient,
    encode_jwt_token,
    save_conversation_to_db,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Kling API base URLs (Beijing node)
# ---------------------------------------------------------------------------
KLING_BASE_URL = "https://api-beijing.klingai.com"
KLING_IDENTIFY_ENDPOINT = f"{KLING_BASE_URL}/v1/videos/identify-face"
KLING_LIPSYNC_CREATE_ENDPOINT = f"{KLING_BASE_URL}/v1/videos/advanced-lip-sync"
KLING_LIPSYNC_QUERY_BASE = f"{KLING_BASE_URL}/v1/videos/advanced-lip-sync"
KLING_T2V_ENDPOINT = f"{KLING_BASE_URL}/v1/videos/text2video"
KLING_I2V_ENDPOINT = f"{KLING_BASE_URL}/v1/videos/image2video"
KLING_T2I_ENDPOINT = f"{KLING_BASE_URL}/v1/images/generations"


# ---------------------------------------------------------------------------
# Auth helper -- JWT (required by Kling developer API)
# ---------------------------------------------------------------------------


def _kling_jwt_headers() -> dict:
    """Return Authorization headers using Kling JWT."""
    try:
        jwt_token = encode_jwt_token()
    except Exception as e:
        logger.error(f"Failed to generate Kling JWT: {e}")
        raise HTTPException(status_code=500, detail="Kling JWT generation failed") from e
    return {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _trunc(text: str, limit: int = 2000) -> str:
    if text is None:
        return ""
    s = text if isinstance(text, str) else str(text)
    return s if len(s) <= limit else s[:limit] + "...<TRUNCATED>"


def _token_preview(tok: str) -> str:
    if not tok or not isinstance(tok, str):
        return "<none>"
    return tok[:8] + "..." + tok[-6:] if len(tok) > 16 else tok


# ---------------------------------------------------------------------------
# Video persistence helper (download -> re-upload -> deduct -> record)
# ---------------------------------------------------------------------------


async def _download_file(url: str) -> bytes | None:
    """Download a file from URL and return bytes."""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
    except Exception as e:
        logger.error(f"Download file failed: {e}")
        return None


async def _upload_file_to_server(file_bytes: bytes, filename: str) -> str | None:
    """Upload file bytes to the platform file server and return the URL."""
    import io

    try:
        upload_url = getattr(settings, "FILE_SERVER_URL", None) or "https://api.zhihuishou.com/upload"
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                upload_url,
                files={"file": (filename, io.BytesIO(file_bytes), "video/mp4")},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("url") or data.get("data", {}).get("url")
    except Exception as e:
        logger.error(f"Upload file failed: {e}")
    return None


async def _persist_and_record_video(
    user_uuid: str,
    prompt: str,
    chat_id: str,
    model_name: str,
    video_url: str,
) -> dict[str, Any] | None:
    """Download video, analyse ratio, re-upload, deduct tokens, save conversation."""
    try:
        file_bytes = await _download_file(video_url)
        if not file_bytes:
            return None

        # Analyse video ratio using cv2 if available
        video_ratio = "unknown"
        try:
            import math
            import os
            import tempfile

            import cv2

            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tf:
                tf.write(file_bytes)
                temp_path = tf.name
            cap = cv2.VideoCapture(temp_path)
            if cap.isOpened():
                w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                cap.release()
                if w > 0 and h > 0:
                    g = math.gcd(w, h)
                    video_ratio = f"{w // g}:{h // g}"
            os.remove(temp_path)
        except Exception as e:
            logger.warning(f"Video ratio analysis failed: {e}")

        filename = f"kling_video_{_uuid.uuid4().hex}.mp4"
        new_url = await _upload_file_to_server(file_bytes, filename)
        if not (isinstance(new_url, str) and new_url.startswith("http")):
            return None

        token_result = await calculate_and_deduct_tokens_by_cost(
            user_uuid=user_uuid,
            yuan_cost=1.50,
            service_name="Kling视频生成",
            success=True,
        )

        await save_conversation_to_db(
            user_uuid=user_uuid,
            model_name=model_name,
            problem=prompt,
            answer=new_url,
            chat_id=chat_id,
            agent_id=model_name,
            agent_url=new_url,
            field1=str(token_result.get("tokens_deducted", 0)),
            video_ratio=video_ratio,
            summary=None,
        )

        return {
            "url": new_url,
            "ratio": video_ratio,
            "tokens": token_result.get("tokens_deducted", 0),
        }
    except Exception as e:
        logger.error(f"Persist and record video failed: {e}")
        return None


# ===========================================================================
# 1. POST /video/identify  -- face identification in video
# ===========================================================================


@router.post("/video/identify", summary="Kling face identification")
async def kling_video_identify(request: Request):
    """Proxy face identification: POST /v1/videos/identify-face.

    Body: { user_uuid, video_id | video_url (XOR) }
    Returns session_id and face_data for lip-sync creation.
    """
    payload = await request.json()
    user_uuid = payload.get("user_uuid")
    video_id = payload.get("video_id")
    video_url = payload.get("video_url")

    if not user_uuid:
        return error("user_uuid is required", "400")
    if bool(video_id) == bool(video_url):
        return error("video_id and video_url must be XOR: provide exactly one", "400")

    token_check = await check_user_token_sufficient(user_uuid)
    if not token_check.get("sufficient"):
        return error(token_check.get("reason", "insufficient balance"), "403")

    headers = _kling_jwt_headers()
    body = {"video_id": video_id} if video_id else {"video_url": video_url}

    logger.info(f"[Kling Identify] POST {KLING_IDENTIFY_ENDPOINT}, body={body}")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(KLING_IDENTIFY_ENDPOINT, headers=headers, json=body)
    logger.info(f"[Kling Identify] status={resp.status_code}, text={_trunc(resp.text)}")

    data = resp.json()
    if resp.status_code != 200 or data.get("code") != 0:
        return error(data.get("message", "identify failed"), str(data.get("code", resp.status_code)))

    return success(data.get("data", {}))


# ===========================================================================
# 2. POST /video/lip-sync  -- create lip-sync task with auto-polling
# ===========================================================================


class LipSyncBody(BaseModel):
    """Lip-sync creation request body."""

    user_uuid: str = Field(...)
    session_id: str | None = Field(None, description="From /video/identify; if absent, video_id/video_url required")
    video_id: str | None = None
    video_url: str | None = None
    face_choose: Any = Field(..., description="Object or list with face_id, audio_id|sound_file, timing fields")
    external_task_id: str | None = None
    callback_url: str | None = None
    chat_id: str = ""


@router.post("/video/lip-sync", summary="Kling lip-sync video creation")
async def kling_lip_sync(body: LipSyncBody):
    """Create an advanced-lip-sync task.  Polls synchronously up to 5 min,
    then falls back to background polling.  Returns the final video URL
    when available, or a pending task reference.
    """
    user_uuid = body.user_uuid

    # Balance check
    token_check = await check_user_token_sufficient(user_uuid)
    if not token_check.get("sufficient"):
        return error(token_check.get("reason", "insufficient balance"), "403")

    headers = _kling_jwt_headers()

    # --- Auto-identify if session_id is missing ---
    session_id = body.session_id
    face_data: list = []
    if not session_id:
        if bool(body.video_id) == bool(body.video_url):
            return error("session_id missing; provide exactly one of video_id / video_url", "400")
        identify_body = {"video_id": body.video_id} if body.video_id else {"video_url": body.video_url}
        async with httpx.AsyncClient(timeout=120.0) as client:
            id_resp = await client.post(KLING_IDENTIFY_ENDPOINT, headers=headers, json=identify_body)
        try:
            id_data = id_resp.json()
        except Exception:
            return error(f"identify-face invalid json: {id_resp.text}", "502")
        if id_resp.status_code != 200 or id_data.get("code") != 0:
            return error(id_data.get("message", "identify failed"), str(id_data.get("code", id_resp.status_code)))
        session_id = (id_data.get("data") or {}).get("session_id")
        face_data = (id_data.get("data") or {}).get("face_data") or []
        if not session_id:
            return error("identify-face missing session_id", "500")

    # --- Normalise face_choose ---
    fc = body.face_choose
    if isinstance(fc, dict):
        face_choose_arr = [fc]
    elif isinstance(fc, list) and fc:
        face_choose_arr = fc[:1]
    else:
        return error("face_choose must be object or non-empty array", "400")

    fc_item = dict(face_choose_arr[0])

    # Validate XOR audio_id / sound_file
    audio_id_in = fc_item.get("audio_id")
    sound_file_in = fc_item.get("sound_file")
    if bool(audio_id_in) == bool(sound_file_in):
        return error("face_choose.audio_id and face_choose.sound_file must be XOR", "400")

    # Required timing fields
    for fld in ("sound_start_time", "sound_end_time", "sound_insert_time"):
        if fld not in fc_item:
            return error(f"face_choose.{fld} is required (ms)", "400")

    # Auto-pick face_id if missing
    if not fc_item.get("face_id") and face_data:
        try:
            sst = int(fc_item["sound_start_time"])
            set_ = int(fc_item["sound_end_time"])
            sit = int(fc_item["sound_insert_time"])
            audio_dur = set_ - sst
            a_end = sit + max(0, audio_dur)
            best, best_overlap = None, -1
            for f in face_data:
                st = int(f.get("start_time", 0))
                ed = int(f.get("end_time", 0))
                overlap = min(ed, a_end) - max(st, sit)
                if overlap >= 2000 and overlap > best_overlap:
                    best, best_overlap = f, overlap
            if best and best.get("face_id"):
                fc_item["face_id"] = str(best["face_id"])
            elif face_data and face_data[0].get("face_id"):
                fc_item["face_id"] = str(face_data[0]["face_id"])
        except Exception:
            logger.warning("Unexpected error in line 307")
            pass

    # Volume defaults
    for vk in ("sound_volume", "original_audio_volume"):
        if vk not in fc_item:
            fc_item[vk] = 1.0
        else:
            fc_item[vk] = max(0, min(2, float(fc_item[vk])))

    # Rebuild normalised face_choose
    face_choose_arr = [
        {
            "face_id": fc_item["face_id"],
            **({"audio_id": audio_id_in} if audio_id_in else {}),
            **({"sound_file": sound_file_in} if sound_file_in else {}),
            "sound_start_time": int(fc_item["sound_start_time"]),
            "sound_end_time": int(fc_item["sound_end_time"]),
            "sound_insert_time": int(fc_item["sound_insert_time"]),
            "sound_volume": fc_item["sound_volume"],
            "original_audio_volume": fc_item["original_audio_volume"],
        }
    ]

    create_body: dict[str, Any] = {
        "session_id": session_id,
        "face_choose": face_choose_arr,
    }
    if body.external_task_id:
        create_body["external_task_id"] = body.external_task_id
    if body.callback_url:
        create_body["callback_url"] = body.callback_url

    # --- Create task ---
    logger.info(f"[Kling LipSync] POST {KLING_LIPSYNC_CREATE_ENDPOINT}")
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(KLING_LIPSYNC_CREATE_ENDPOINT, headers=headers, json=create_body)
    try:
        create_data = resp.json()
    except Exception:
        return error(f"upstream invalid json: {resp.text}", "502")
    if resp.status_code != 200 or create_data.get("code") != 0:
        return error(create_data.get("message", "create failed"), str(create_data.get("code", resp.status_code)))

    task_id = (create_data.get("data") or {}).get("task_id")
    if not task_id:
        return error("upstream missing data.task_id", "500")

    # --- Sync poll (up to 5 min) ---
    async def _query_task(client: httpx.AsyncClient) -> dict:
        r = await client.get(f"{KLING_LIPSYNC_QUERY_BASE}/{task_id}", headers=headers)
        try:
            return r.json()
        except Exception:
            return {}

    max_sync_checks, poll_interval = 30, 10

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for _ in range(max_sync_checks):
                q = await _query_task(client)
                data = (q or {}).get("data") or {}
                status = str(data.get("task_status", "")).lower()
                if status == "succeed":
                    videos = (data.get("task_result") or {}).get("videos") or []
                    if videos and isinstance(videos, list):
                        final_url = (videos[0] or {}).get("url")
                        if isinstance(final_url, str) and final_url.startswith("http"):
                            result = await _persist_and_record_video(
                                user_uuid=user_uuid,
                                prompt=f"Kling lip-sync: session={session_id}, face={face_choose_arr[0].get('face_id')}",
                                chat_id=body.chat_id,
                                model_name="kling-advanced-lip-sync",
                                video_url=final_url,
                            )
                            if result:
                                return success(
                                    {
                                        "video_url": result["url"],
                                        "total_tokens": result["tokens"],
                                        "video_ratio": result["ratio"],
                                    }
                                )
                            return error("任务完成但未获取到有效视频URL", "500")
                if status in ("failed", "error"):
                    return error(data.get("task_status_msg", "任务失败"), "500")
                await asyncio.sleep(poll_interval)
    except Exception as e:
        logger.warning(f"[Kling LipSync] sync polling error: {e}")

    # --- Background follow-up ---
    async def _background_poll():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for _ in range(60):
                    q = await _query_task(client)
                    data = (q or {}).get("data") or {}
                    status = str(data.get("task_status", "")).lower()
                    if status == "succeed":
                        videos = (data.get("task_result") or {}).get("videos") or []
                        if videos and isinstance(videos, list):
                            final_url = (videos[0] or {}).get("url")
                            if isinstance(final_url, str) and final_url.startswith("http"):
                                await _persist_and_record_video(
                                    user_uuid=user_uuid,
                                    prompt=f"Kling lip-sync: session={session_id}",
                                    chat_id=body.chat_id,
                                    model_name="kling-advanced-lip-sync",
                                    video_url=final_url,
                                )
                        break
                    if status in ("failed", "error"):
                        break
                    await asyncio.sleep(poll_interval)
        except Exception as e:
            logger.warning(f"[Kling LipSync] background polling error: {e}")

    asyncio.create_task(_background_poll())

    return success(
        {
            "task_id": task_id,
            "status": "pending",
            "message": "任务执行中,后台将继续轮询",
        }
    )


# ===========================================================================
# 3. POST /video/lip-sync/one-shot  -- auto identify + create + poll
# ===========================================================================


class LipSyncOneShotBody(BaseModel):
    """One-shot lip-sync: auto identify + create + poll."""

    user_uuid: str
    video_id: str | None = None
    video_url: str | None = None
    face_id: str | None = None
    audio_id: str | None = None
    sound_file: str | None = None
    sound_start_time: int
    sound_end_time: int
    sound_insert_time: int
    sound_volume: float = 1.0
    original_audio_volume: float = 1.0
    external_task_id: str | None = None
    callback_url: str | None = None
    chat_id: str = ""


@router.post("/video/lip-sync/one-shot", summary="Kling one-shot lip-sync")
async def kling_lip_sync_one_shot(body: LipSyncOneShotBody):
    """End-to-end: face identification -> create lip-sync task -> sync poll -> persist/charge -> return result."""
    if bool(body.audio_id) == bool(body.sound_file):
        return error("audio_id and sound_file must be XOR", "400")

    token_check = await check_user_token_sufficient(body.user_uuid)
    if not token_check.get("sufficient"):
        return error(token_check.get("reason", "insufficient balance"), "403")

    headers = _kling_jwt_headers()

    # Step 1: identify
    identify_body: dict[str, Any] = {}
    if body.video_id:
        identify_body["video_id"] = body.video_id
    elif body.video_url:
        identify_body["video_url"] = body.video_url
    else:
        return error("video_id or video_url is required", "400")

    async with httpx.AsyncClient(timeout=120.0) as client:
        id_resp = await client.post(KLING_IDENTIFY_ENDPOINT, headers=headers, json=identify_body)
    try:
        id_data = id_resp.json()
    except Exception:
        return error(f"identify-face invalid json: {id_resp.text}", "502")
    if id_resp.status_code != 200 or id_data.get("code") != 0:
        return error(id_data.get("message", "identify failed"), str(id_data.get("code", id_resp.status_code)))

    data_block = id_data.get("data") or {}
    session_id = data_block.get("session_id")
    face_data = data_block.get("face_data") or []
    if not session_id:
        return error("identify-face missing session_id", "500")
    if not face_data and not body.face_id:
        return error("no face detected and no face_id provided", "400")

    # Step 2: pick face_id
    chosen_face_id = body.face_id
    if not chosen_face_id:
        try:
            audio_dur = body.sound_end_time - body.sound_start_time
            a_end = body.sound_insert_time + max(0, audio_dur)
            best, best_overlap = None, -1
            for f in face_data:
                st = int(f.get("start_time", 0))
                ed = int(f.get("end_time", 0))
                overlap = min(ed, a_end) - max(st, body.sound_insert_time)
                if overlap >= 2000 and overlap > best_overlap:
                    best, best_overlap = f, overlap
            if best and best.get("face_id"):
                chosen_face_id = str(best["face_id"])
            elif face_data and face_data[0].get("face_id"):
                chosen_face_id = str(face_data[0]["face_id"])
        except Exception:
            logger.warning("Unexpected error in line 507")
            pass
    if not chosen_face_id:
        return error("failed to pick a valid face_id", "400")

    # Step 3: create task
    face_choose = {
        "face_id": chosen_face_id,
        "sound_start_time": body.sound_start_time,
        "sound_end_time": body.sound_end_time,
        "sound_insert_time": body.sound_insert_time,
        "sound_volume": max(0, min(2, body.sound_volume)),
        "original_audio_volume": max(0, min(2, body.original_audio_volume)),
    }
    if body.audio_id:
        face_choose["audio_id"] = body.audio_id
    else:
        face_choose["sound_file"] = body.sound_file

    create_body: dict[str, Any] = {
        "session_id": session_id,
        "face_choose": [face_choose],
    }
    if body.external_task_id:
        create_body["external_task_id"] = body.external_task_id
    if body.callback_url:
        create_body["callback_url"] = body.callback_url

    async with httpx.AsyncClient(timeout=120.0) as client:
        cr_resp = await client.post(KLING_LIPSYNC_CREATE_ENDPOINT, headers=headers, json=create_body)
    try:
        cr_data = cr_resp.json()
    except Exception:
        return error(f"create invalid json: {cr_resp.text}", "502")
    if cr_resp.status_code != 200 or cr_data.get("code") != 0:
        return error(cr_data.get("message", "create failed"), str(cr_data.get("code", cr_resp.status_code)))

    task_id = (cr_data.get("data") or {}).get("task_id")
    if not task_id:
        return error("create response missing data.task_id", "500")

    # Step 4: sync poll
    async def _query(client: httpx.AsyncClient) -> dict:
        r = await client.get(f"{KLING_LIPSYNC_QUERY_BASE}/{task_id}", headers=headers)
        try:
            return r.json()
        except Exception:
            return {}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            for _ in range(30):
                q = await _query(client)
                d = (q or {}).get("data") or {}
                st = str(d.get("task_status", "")).lower()
                if st == "succeed":
                    videos = (d.get("task_result") or {}).get("videos") or []
                    if videos and isinstance(videos, list):
                        final_url = (videos[0] or {}).get("url")
                        if isinstance(final_url, str) and final_url.startswith("http"):
                            result = await _persist_and_record_video(
                                user_uuid=body.user_uuid,
                                prompt=f"Kling lip-sync one-shot: session={session_id}, face={chosen_face_id}",
                                chat_id=body.chat_id,
                                model_name="kling-advanced-lip-sync",
                                video_url=final_url,
                            )
                            if result:
                                return success(
                                    {
                                        "video_url": result["url"],
                                        "total_tokens": result["tokens"],
                                        "video_ratio": result["ratio"],
                                    }
                                )
                            return error("任务完成但未获取到有效视频URL", "500")
                if st in ("failed", "error"):
                    return error(d.get("task_status_msg", "任务失败"), "500")
                await asyncio.sleep(10)
    except Exception as e:
        logger.warning(f"[Kling OneShot] sync polling error: {e}")

    # Background follow-up
    async def _bg():
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                for _ in range(60):
                    q = await _query(client)
                    d = (q or {}).get("data") or {}
                    st = str(d.get("task_status", "")).lower()
                    if st == "succeed":
                        videos = (d.get("task_result") or {}).get("videos") or []
                        if videos and isinstance(videos, list):
                            fu = (videos[0] or {}).get("url")
                            if isinstance(fu, str) and fu.startswith("http"):
                                await _persist_and_record_video(
                                    user_uuid=body.user_uuid,
                                    prompt=f"Kling lip-sync one-shot: session={session_id}",
                                    chat_id=body.chat_id,
                                    model_name="kling-advanced-lip-sync",
                                    video_url=fu,
                                )
                        break
                    if st in ("failed", "error"):
                        break
                    await asyncio.sleep(10)
        except Exception as e:
            logger.warning(f"[Kling OneShot] background polling error: {e}")

    asyncio.create_task(_bg())

    return success({"task_id": task_id, "status": "pending", "message": "任务执行中"})


# ===========================================================================
# 4. POST /video/generate  -- text-to-video (async)
# ===========================================================================


class VideoGenerateBody(BaseModel):
    """Text-to-video generation request body."""

    prompt: str
    model_name: str = "kling-v1"
    duration: str = "5"
    mode: str = "std"
    aspect_ratio: str = "16:9"
    cfg_scale: float = 0.5
    negative_prompt: str | None = None
    camera_control: dict[str, Any] | None = None


@router.post("/video/generate", summary="Kling text-to-video generation")
async def kling_video_generate(
    body: VideoGenerateBody,
    user_uuid: str = Depends(require_login),
):
    """Submit a text-to-video task via Kling API.  Returns task_id for polling."""
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="kling_t2v", model=body.model_name)
    track_funnel("chat", "send", user_id=user_uuid, channel="kling_t2v")
    headers = _kling_jwt_headers()
    payload: dict[str, Any] = {
        "model_name": body.model_name,
        "prompt": body.prompt,
        "duration": body.duration,
        "mode": body.mode,
        "aspect_ratio": body.aspect_ratio,
        "cfg_scale": body.cfg_scale,
    }
    if body.negative_prompt:
        payload["negative_prompt"] = body.negative_prompt
    if body.camera_control:
        payload["camera_control"] = body.camera_control

    logger.info(f"[Kling T2V] POST {KLING_T2V_ENDPOINT}")
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(KLING_T2V_ENDPOINT, headers=headers, json=payload)
            data = resp.json()
            if resp.status_code == 200 and data.get("code") == 0:
                return success(data.get("data", {}))
            return error(data.get("message", "video generation failed"), str(data.get("code", resp.status_code)))
        except Exception as e:
            logger.error(f"Kling video generate error: {e}")
            return error(str(e))


# ===========================================================================
# 5. POST /video/image-to-video  -- image-to-video (async)
# ===========================================================================


class ImageToVideoBody(BaseModel):
    """Image-to-video generation request body."""

    model_name: str = "kling-v1"
    image: str = Field(..., description="Image URL or base64")
    prompt: str | None = None
    negative_prompt: str | None = None
    duration: str = "5"
    mode: str = "std"
    cfg_scale: float = 0.5


@router.post("/video/image-to-video", summary="Kling image-to-video generation")
async def kling_image_to_video(
    body: ImageToVideoBody,
    user_uuid: str = Depends(require_login),
):
    """Submit an image-to-video task.  Returns task_id for polling."""
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="kling_i2v", model=body.model_name)
    track_funnel("chat", "send", user_id=user_uuid, channel="kling_i2v")
    headers = _kling_jwt_headers()
    payload: dict[str, Any] = {
        "model_name": body.model_name,
        "image": body.image,
        "duration": body.duration,
        "mode": body.mode,
        "cfg_scale": body.cfg_scale,
    }
    if body.prompt:
        payload["prompt"] = body.prompt
    if body.negative_prompt:
        payload["negative_prompt"] = body.negative_prompt

    logger.info(f"[Kling I2V] POST {KLING_I2V_ENDPOINT}")
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(KLING_I2V_ENDPOINT, headers=headers, json=payload)
            data = resp.json()
            if resp.status_code == 200 and data.get("code") == 0:
                return success(data.get("data", {}))
            return error(data.get("message", "image-to-video failed"), str(data.get("code", resp.status_code)))
        except Exception as e:
            logger.error(f"Kling image-to-video error: {e}")
            return error(str(e))


# ===========================================================================
# 6. POST /image/generate  -- text-to-image
# ===========================================================================


class ImageGenerateBody(BaseModel):
    """Text-to-image generation request body."""

    prompt: str
    model_name: str = "kling-v1"
    n: int = 1
    aspect_ratio: str = "1:1"
    negative_prompt: str | None = None


@router.post("/image/generate", summary="Kling text-to-image generation")
async def kling_image_generate(
    body: ImageGenerateBody,
    user_uuid: str = Depends(require_login),
):
    """Submit a text-to-image task.  Returns task_id for polling."""
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="kling_t2i", model=body.model_name)
    track_funnel("chat", "send", user_id=user_uuid, channel="kling_t2i")
    headers = _kling_jwt_headers()
    payload: dict[str, Any] = {
        "model_name": body.model_name,
        "prompt": body.prompt,
        "n": body.n,
        "aspect_ratio": body.aspect_ratio,
    }
    if body.negative_prompt:
        payload["negative_prompt"] = body.negative_prompt

    logger.info(f"[Kling T2I] POST {KLING_T2I_ENDPOINT}")
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(KLING_T2I_ENDPOINT, headers=headers, json=payload)
            data = resp.json()
            if resp.status_code == 200 and data.get("code") == 0:
                return success(data.get("data", {}))
            return error(data.get("message", "image generation failed"), str(data.get("code", resp.status_code)))
        except Exception as e:
            logger.error(f"Kling image generate error: {e}")
            return error(str(e))


# ===========================================================================
# 7. GET /task/{task_id}  -- query task status (video or image)
# ===========================================================================


@router.get("/task/{task_id}", summary="Query Kling task status")
async def kling_query_task(
    task_id: str,
    task_type: str = "video",
    user_uuid: str = Depends(require_login),
):
    """Query status of a Kling async task.

    task_type: ``video`` (text2video / image2video), ``image`` (text2image),
    or ``lip-sync`` (advanced-lip-sync).
    """
    track_event(EVENT_CHAT_SEND, user_id=user_uuid, channel="kling_query", task_type=task_type)
    track_funnel("chat", "send", user_id=user_uuid, channel="kling_query")
    if task_type == "video":
        url = f"{KLING_T2V_ENDPOINT}/{task_id}"
    elif task_type == "image":
        url = f"{KLING_T2I_ENDPOINT}/{task_id}"
    elif task_type == "lip-sync":
        url = f"{KLING_LIPSYNC_QUERY_BASE}/{task_id}"
    else:
        return error(f"unsupported task_type: {task_type}", "400")

    headers = _kling_jwt_headers()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url, headers=headers)
            data = resp.json()
            if resp.status_code == 200 and data.get("code") == 0:
                return success(data.get("data", {}))
            return error(data.get("message", "query failed"), str(data.get("code", resp.status_code)))
        except Exception as e:
            logger.error(f"Kling query error: {e}")
            return error(str(e))
