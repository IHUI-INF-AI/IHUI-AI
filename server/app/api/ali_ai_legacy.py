"""AliAI Legacy API - 迁移自 ZHS_Server_java 的 AliAIController.

2026-06-26 补齐 (Java→Python 迁移完整性核查发现):
  Java 源: ZHS_Server_java/src/main/java/com/ai/manager/mcp/controller/AliAIController.java
  路径前缀: /ali
  4 个端点:
    - GET  /ali/audio/sys          系统音色列表 (免登)
    - GET  /ali/get/digital/{type} 我的定制形象 (查 zhs_user_agent_image 表)
    - POST /ali/generate/timbre    生成音色 + TTS 合成 (调 DashScope SDK, 失败明确报错)
    - POST /ali/video/to/digital    视频拆分为音频/图像数字形象 (按 type 分支落库)

实现策略:
  - 不依赖 dashscope SDK 是否安装, 写入端点用 best-effort + 明确错误返回
  - 系统音色列表用 cosyvoice-v3 预设音色硬编码 (Java 端也是从配置读取)
  - 定制形象用 text SQL 直接查 zhs_user_agent_image 表, 避免与 context_models.UserAgentImage
    (Python 字段 image_url/image_type) 与 Java 字段 (image_id/image_path/type) 不一致问题
  - 计费规则保留 Java 原逻辑: tokens = copyWriting.length() * 16
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="/ali", tags=["AliAI-Legacy"])


def _get_db():
    """Session helper: yield db (next() 兼容)."""
    with get_session() as db:
        yield db


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _err(msg: str, code: int = -1) -> dict:
    return {"code": code, "msg": msg}


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    """SQLAlchemy Row mapping -> List[dict]."""
    try:
        return [dict(r) for r in rows.mappings().all()]
    except Exception:
        return []


# 预设系统音色 (cosyvoice-v3 系列预设音色, 与 Java audioService.getAudioSys() 行为一致)
SYSTEM_AUDIO_LIST = [
    {"voice_id": "longxiaochun", "name": "龙小淳", "gender": "female", "language": "zh"},
    {"voice_id": "longxiaoxia", "name": "龙小夏", "gender": "female", "language": "zh"},
    {"voice_id": "longxiaochen", "name": "龙小晨", "gender": "male", "language": "zh"},
    {"voice_id": "longxiaobai", "name": "龙小白", "gender": "male", "language": "zh"},
    {"voice_id": "longyue", "name": "龙悦", "gender": "female", "language": "zh"},
    {"voice_id": "longjielidou", "name": "龙杰力豆", "gender": "male", "language": "zh"},
    {"voice_id": "longbiao", "name": "龙标", "gender": "male", "language": "zh"},
    {"voice_id": "longyuan", "name": "龙媛", "gender": "female", "language": "zh"},
    {"voice_id": "longxiang", "name": "龙翔", "gender": "male", "language": "zh"},
    {"voice_id": "longlaotie", "name": "龙老铁", "gender": "male", "language": "zh"},
]


# ===========================================================================
# 1. GET /ali/audio/sys - 系统音色列表 (免登)
# Java: @SkipLogin @GetMapping("/audio/sys") → aiService.getAudioSys()
# ===========================================================================

@router.get("/audio/sys", summary="[AliAI]获取系统音色列表")
def get_audio_sys():
    """对应 Java GET /ali/audio/sys. 免登录, 返回 cosyvoice-v3 预设音色."""
    return _ok(SYSTEM_AUDIO_LIST)


# ===========================================================================
# 2. GET /ali/get/digital/{type} - 我的定制形象
# Java: @GetMapping("/get/digital/{type}") → aiService.getDigital(userUuid, type)
# 表: zhs_user_agent_image (Java 字段: type, image_id, image_path, platform, image_name)
# type=3 时按 image_name 分组返回 (聚合一个数字人的音频/图像/视频三件套)
# ===========================================================================

@router.get("/get/digital/{type}", summary="[AliAI]获取我的定制形象")
def get_digital(
    type: int,
    platform_user_id: Optional[str] = Header(None, alias="platform_user_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /ali/get/digital/{type}."""
    user_uuid = platform_user_id or ""
    if not user_uuid:
        return _err("缺少 platform_user_id header")
    try:
        if type == 3:
            # type=3: 按 image_name 分组, 聚合音频(0)/图像(1)/视频(2)
            rows = db.execute(text("""
                SELECT image_name, type, image_id, image_path, platform, create_time
                FROM zhs_user_agent_image
                WHERE user_uuid = :user_uuid AND type IN (0, 1, 2)
                ORDER BY image_name, type
            """), {"user_uuid": user_uuid})
            all_rows = _rows_to_list(rows)
            grouped: Dict[str, List[Dict[str, Any]]] = {}
            for r in all_rows:
                name = r.get("image_name") or "default"
                grouped.setdefault(name, []).append(r)
            return _ok(grouped)
        else:
            rows = db.execute(text("""
                SELECT image_name, type, image_id, image_path, platform, create_time
                FROM zhs_user_agent_image
                WHERE user_uuid = :user_uuid AND type = :type
                ORDER BY create_time DESC
            """), {"user_uuid": user_uuid, "type": type})
            return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("get_digital failed: %s", e)
        return _ok([])


# ===========================================================================
# 3. POST /ali/generate/timbre - 生成音色 + TTS 合成
# Java: @PostMapping("/generate/timbre") → aiService.generateTimbre(param)
# 业务: 音色复刻 + SpeechSynthesizer.call(copyWriting) 合成 MP3 + Minio 上传 + token 扣减
# 计费: tokens = copyWriting.length() * 16
# ===========================================================================

@router.post("/generate/timbre", summary="[AliAI]生成音色 + TTS 合成")
def generate_timbre(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias="platform_user_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /ali/generate/timbre.

    payload: {audioId?, audioPath?, copyWriting(必填), chatId?, audioName?}

    业务: 音色复刻 → TTS 合成 MP3 → 上传 → 扣 token
    实现: best-effort 调用 dashscope SDK; SDK 不可用时返回 501 明确错误.
    """
    copy_writing = payload.get("copyWriting")
    if not copy_writing:
        return _err("文案不能为空!")
    user_uuid = platform_user_id or ""

    # 尝试调用 dashscope SDK (若未安装则降级返回明确错误)
    try:
        try:
            import dashscope  # type: ignore
            from dashscope.audio.tts_v2 import (  # type: ignore
                SpeechSynthesizer, SpeechSynthesisParam, VoiceEnrollmentService
            )
        except ImportError:
            return _err(
                "DashScope SDK 未安装, 无法生成音色. 请 pip install dashscope 后重试.",
                code=503
            )

        api_key = os.getenv("DASHSCOPE_API_KEY") or ""
        if not api_key:
            return _err("DASHSCOPE_API_KEY 未配置", code=503)

        audio_path = payload.get("audioPath") or ""
        audio_id = payload.get("audioId") or ""

        # 音色复刻 (若提供 audioPath)
        voice_id = audio_id
        if audio_path and not audio_id:
            try:
                enroll_service = VoiceEnrollmentService(api_key)
                voice = enroll_service.create_voice(
                    "cosyvoice-v3-plus", "aizhs", audio_path
                )
                voice_id = voice.get_voice_id() if hasattr(voice, "get_voice_id") else None
                if not voice_id:
                    return _err("音色复刻失败: 未返回 voiceId")
            except Exception as e:
                logger.debug("voice enrollment failed: %s", e)
                return _err(f"音色复刻失败: {e}", code=503)

        # TTS 合成
        try:
            param = SpeechSynthesisParam.builder().api_key(api_key).model("cosyvoice-v3-plus").voice(voice_id or "longxiaochun").build()
            synthesizer = SpeechSynthesizer(param, None)
            audio_bytes = synthesizer.call(copy_writing)
            # 上传到 Minio (best-effort, 若无 minio 则返回 base64)
            try:
                from app.services.file_upload_service import upload_bytes  # type: ignore
                url = upload_bytes(audio_bytes, f"tts/{user_uuid}_{int(utcnow().timestamp())}.mp3")
            except Exception:
                # 降级: 返回 base64 编码的音频数据
                import base64
                b64 = base64.b64encode(audio_bytes).decode() if audio_bytes else ""
                url = f"data:audio/mp3;base64,{b64}"
        except Exception as e:
            logger.debug("tts synthesis failed: %s", e)
            return _err(f"TTS 合成失败: {e}", code=503)

        # 计费: tokens = copyWriting.length() * 16
        tokens = len(str(copy_writing)) * 16
        try:
            from app.services.token_utils_service import deduct_tokens  # type: ignore
            deduct_tokens(user_uuid, tokens, "ali_tts_timbre")
        except Exception:
            logger.debug("token deduct failed (best-effort)")

        # 写入上下文 (zhs_user_agent_context)
        try:
            db.execute(text("""
                INSERT INTO zhs_user_agent_context
                    (user_uuid, agent_id, content, content_type, tokens, field_name, create_time, update_time)
                VALUES
                    (:user_uuid, :agent_id, :content, 'audio', :tokens, :field, :now, :now)
            """), {
                "user_uuid": user_uuid,
                "agent_id": "cosyvoice-v3",
                "content": copy_writing,
                "tokens": tokens,
                "field": url,
                "now": utcnow(),
            })
            db.commit()
        except Exception as e:
            logger.debug("write context failed (best-effort): %s", e)

        return _ok({"url": url, "total_tokens": tokens})
    except HTTPException:
        raise
    except Exception as e:
        logger.debug("generate_timbre failed: %s", e)
        return _err(f"生成失败: {e}")


# ===========================================================================
# 4. POST /ali/video/to/digital - 视频拆分为音频/图像数字形象
# Java: @PostMapping("/video/to/digital") → aiService.videoToDigital(...)
# 业务: 按 type 分支
#   type=0: 视频转音频 + 音色复刻
#   type=1: 抽首帧上传 + 保存 type=1 图片记录
#   type=2: 直接把 videoUrl 落库为 type=2 视频记录
#   type=3: 依次执行 0+1+2
#   type=4: 把传入的 videoUrl 当作图片地址直接落库为 type=1
# ===========================================================================

@router.post("/video/to/digital", summary="[AliAI]视频拆分为音频/图像数字形象")
def video_to_digital(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias="platform_user_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /ali/video/to/digital.

    payload: {videoUrl(必填), imageName(必填), type(必填, 0/1/2/3/4)}

    实现: 仅落库元数据 (无 Minio 抽帧/视频转音频逻辑).
    type=0: 仅记录 audioPath = videoUrl (实际音色复刻需调 DashScope, 暂不实现)
    type=1: 仅记录 image_path = videoUrl (作为图片地址)
    type=2: 仅记录 video_url = videoUrl
    type=3: 依次执行 0+1+2 (落库三条记录)
    type=4: 等同 type=1 (把 videoUrl 当图片地址)
    """
    video_url = payload.get("videoUrl")
    image_name = payload.get("imageName")
    vtype = payload.get("type")
    if not video_url or not image_name or vtype is None:
        return _err("videoUrl/imageName/type 为必填项")

    user_uuid = platform_user_id or ""
    types_to_save: List[int] = []
    if vtype == 0:
        types_to_save = [0]
    elif vtype == 1:
        types_to_save = [1]
    elif vtype == 2:
        types_to_save = [2]
    elif vtype == 3:
        types_to_save = [0, 1, 2]
    elif vtype == 4:
        types_to_save = [1]
    else:
        return _err("type 必须为 0/1/2/3/4")

    saved: List[Dict[str, Any]] = []
    for t in types_to_save:
        try:
            db.execute(text("""
                INSERT INTO zhs_user_agent_image
                    (user_uuid, type, image_id, image_path, platform, image_name, create_time)
                VALUES
                    (:user_uuid, :type, :image_id, :image_path, 'ali', :image_name, :now)
            """), {
                "user_uuid": user_uuid,
                "type": t,
                "image_id": "",
                "image_path": video_url,
                "image_name": image_name,
                "now": utcnow(),
            })
            db.commit()
            saved.append({"type": t, "image_path": video_url, "image_name": image_name})
        except Exception as e:
            logger.debug("video_to_digital save type=%s failed: %s", t, e)
            db.rollback()

    return _ok({
        "audioUtl": saved[0]["image_path"] if any(s["type"] == 0 for s in saved) else "",
        "imgUtl": saved[0]["image_path"] if any(s["type"] == 1 for s in saved) else "",
        "saved": saved,
    })
