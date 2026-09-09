# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""媒体任务统一管理 HTTP 路由(ai-service,内网,2026-09-09 立)。

对话内媒体工具(video/music/tts/image/改图)任务统一持久化在 media_tasks 表
(见 app.services.media_tasks),此处提供对外管理出口:
- GET  /api/media/tasks                列表(kind/status/user_uuid 过滤)
- GET  /api/media/tasks/{task_id}      详情(库内 + 在途任务实时向 token6688 探测)
- POST /api/media/tasks/{task_id}/cancel  取消在途任务(provider 取消 + 置 cancelled)

与 /api/video/tasks 并存:video_generation_tasks 是 REST 视频任务队列(worker 消费),
media_tasks 是对话内 MCP 媒体调用记录。
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from ..services.media_tasks import (
    clear_media_tasks,
    delete_media_task,
    get_media_task,
    handle_media_callback,
    query_media_tasks,
    update_media_task,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/media/tasks/callback")
async def media_tasks_callback(request: Request) -> dict[str, Any]:
    """token6688 官方终态 webhook → media_tasks 实时回写(对话内媒体任务自动收尾)。

    与 /api/video/token6688-callback 同验签协议(X-TokenGo-Signature=sha256+HMAC)。
    快照形状同 GET /v1/tasks/{task_id};终态(成功带产物 URL/失败)落库,
    中间态快照忽略。401=验签失败;200 ok=false=解析失败/快照缺 task_id(幂等确认)。
    """
    body = await request.body()
    secret = os.environ.get("TOKEN6688_CALLBACK_SECRET", "").strip()
    if secret:
        sig = request.headers.get("X-TokenGo-Signature", "").strip()
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), body, hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            logger.warning("[media_tasks] 回调验签失败: sig=%r", sig[:24])
            raise HTTPException(status_code=401, detail="签名校验失败")
    else:
        logger.warning("[media_tasks] 回调未配置 TOKEN6688_CALLBACK_SECRET,跳过验签(建议配置)")
    event = request.headers.get("X-TokenGo-Event", "")
    try:
        snapshot = json.loads(body or b"{}")
        if not isinstance(snapshot, dict):
            raise ValueError("回调体非 JSON 对象")
    except ValueError as e:
        logger.warning("[media_tasks] 回调体解析失败: %s", e)
        return {"ok": False, "error": f"回调体解析失败: {e}"}
    result = await handle_media_callback(snapshot)
    logger.info(
        "[media_tasks] 回调处理: event=%s ok=%s matched=%s ignored=%s",
        event, result.get("ok"), result.get("matched"), result.get("ignored"),
    )
    return result


@router.post("/media/upload")
async def media_upload(
    file: UploadFile | None = File(default=None, description="本地文件(multipart,≤50MB)"),
    url: str | None = Form(default=None, description="远程 http(s) URL(SSRF 校验后拉取)"),
    purpose: str | None = Form(default=None, description="官方用途语义(如 voice/assistants)"),
) -> dict[str, Any]:
    """上传文件换 token6688 24h 公网 URL(视频参考素材/声纹/改图输入,2026-09-09)。

    file 与 url 二选一;成功返回 {file_url, filename, size}。
    """
    if file is None and not url:
        raise HTTPException(status_code=400, detail="file 与 url 必须二选一")
    from ..core.config import settings
    from ..providers.base_provider import ProviderError
    from ..providers.token6688_provider import Token6688Provider

    cfg = settings.get_provider_config("token6688")
    if not cfg.api_key:
        raise HTTPException(
            status_code=503,
            detail="token6688 未配置:请在 .env 设置 TOKEN6688_API_KEY 或 LLM_PROVIDERS.token6688.api_key",
        )
    provider = Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base)
    try:
        if file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="上传文件为空")
            if len(data) > 50 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="文件超过 50MB 上限")
            filename = file.filename or "file.bin"
            upload_url = await provider.upload_file(data, filename, purpose=purpose)
            return {"ok": True, "data": {"file_url": upload_url, "filename": filename, "size": len(data)}}
        from .screenshot_service import _validate_url_ssrf

        ok_ssrf, reason = _validate_url_ssrf(url or "")
        if not ok_ssrf:
            raise HTTPException(status_code=400, detail=f"URL 不允许访问: {reason}")
        import httpx

        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as _c:
                _r = await _c.get(url or "")
                _r.raise_for_status()
                data = _r.content
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"拉取远程文件失败: {e}") from e
        if len(data) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="远程文件超过 50MB 上限")
        filename = (url or "").rsplit("/", 1)[-1][:200] or "file.bin"
        upload_url = await provider.upload_file(data, filename, purpose=purpose)
        return {"ok": True, "data": {"file_url": upload_url, "filename": filename, "size": len(data)}}
    except ProviderError as e:
        raise HTTPException(status_code=e.status_code or 502, detail=str(e)) from None
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("[media] 上传失败: %s", e)
        raise HTTPException(status_code=500, detail=f"上传异常: {e}") from e


@router.get("/media/tasks")
async def media_task_list(
    kind: str | None = None,
    status: str | None = None,
    user_uuid: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    """媒体任务列表:kind/status 支持逗号分隔多值(video/music/tts/image;processing/succeeded/failed/cancelled)。"""
    try:
        data = await query_media_tasks(
            kind=kind, status=status, user_uuid=user_uuid, limit=limit, offset=offset,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 列表查询失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务查询异常: {e}") from e
    return {"ok": True, "data": data}


@router.get("/media/tasks/{task_id}")
async def media_task_detail(task_id: str) -> dict[str, Any]:
    """媒体任务详情:库内记录;在途(processing)且 provider=token6688 时实时探测最新状态。"""
    row = await get_media_task(task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    if (
        row.get("status") in ("processing", "accepted", "submitted")
        and row.get("task_id")
        and row.get("provider") == "token6688"
    ):
        try:
            from ..core.config import settings
            from ..providers.token6688_provider import Token6688Provider

            cfg = settings.get_provider_config("token6688")
            if cfg.api_key:
                st = await Token6688Provider(api_key=cfg.api_key, api_base=cfg.api_base).get_task_status(
                    str(row["task_id"])
                )
                if isinstance(st, dict) and st.get("status"):
                    row["live_status"] = st.get("status")
                    if st.get("video_url"):
                        # 2026-09-09 修复:探测到成片 URL 必须连产物一起落库,
                        # 否则页面刷新后 media-tasks 列表/详情读库仍无 result → 任务中心不可播放。
                        # 按 kind 映射产物字段(image_url/audio_url/video_url),与回调/轮询一致。
                        from ..services.media_tasks import _kind_url_field

                        field = _kind_url_field(str(row.get("kind") or ""))
                        merged = {**(row.get("result") or {}), field: st["video_url"]}
                        row["result"] = merged
                        await update_media_task(
                            str(row["task_id"]),
                            status="succeeded",
                            result=merged,
                        )
                    elif st.get("failed"):
                        await update_media_task(str(row["task_id"]), status="failed")
        except Exception as e:  # noqa: BLE001
            logger.warning("[media_tasks] 实时探测失败(降级返回库内数据): %s", e)
    return {"ok": True, "data": row}


@router.delete("/media/tasks")
async def media_task_clear(
    kind: str | None = None,
    status: str | None = None,
    before: str | None = None,
) -> dict[str, Any]:
    """批量清理已终态媒体任务记录(2026-09-09 F1)。

    只删 succeeded/failed/cancelled;在途任务(processing 等)一律保留,防收尾通道
    回写失败而任务消失。kind/status 逗号分隔多值;before=ISO 时间截点只删更早。
    """
    try:
        result = await clear_media_tasks(kind=kind, status=status, before=before)
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 批量清理失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务清理异常: {e}") from e
    return {"ok": True, "data": result}


@router.delete("/media/tasks/{task_id}")
async def media_task_delete(task_id: str) -> dict[str, Any]:
    """删除单条媒体任务记录(2026-09-09 F1;仅删本地记录,长任务应先取消再删)。"""
    try:
        deleted = await delete_media_task(task_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 单条删除失败: %s", e)
        raise HTTPException(status_code=500, detail=f"媒体任务删除异常: {e}") from e
    if not deleted:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    return {"ok": True, "data": {"task_id": task_id, "deleted": True}}


@router.post("/media/tasks/{task_id}/cancel")
async def media_task_cancel(task_id: str) -> dict[str, Any]:
    """取消在途媒体任务:优先调 token6688 取消端点,成功/不支持均如实返回并置 cancelled。"""
    row = await get_media_task(task_id)
    if row is None:
        raise HTTPException(status_code=404, detail="媒体任务不存在")
    provider = str(row.get("provider") or "token6688")
    remote_id = str(row.get("task_id") or "").strip()
    cancel_result: dict[str, Any] = {"provider": provider, "task_id": remote_id or task_id}
    if provider == "token6688" and remote_id:
        try:
            from ..core.config import settings
            from ..providers.base_provider import ProviderError
            from ..providers.token6688_provider import Token6688Provider

            cfg = settings.get_provider_config("token6688")
            if not cfg.api_key:
                cancel_result["error"] = "token6688 未配置(TOKEN6688_API_KEY),无法取消远端任务"
            else:
                r = await Token6688Provider(
                    api_key=cfg.api_key, api_base=cfg.api_base
                ).cancel_task(remote_id)
                cancel_result.update(r or {})
        except ProviderError as e:
            cancel_result["error"] = str(e)
        except Exception as e:  # noqa: BLE001
            logger.warning("[media_tasks] 取消远端任务异常: %s", e)
            cancel_result["error"] = f"取消远端任务异常: {e}"
    else:
        cancel_result["error"] = f"provider={provider} 不支持远端取消,仅本地置 cancelled"
    try:
        await update_media_task(remote_id or task_id, status="cancelled")
    except Exception as e:  # noqa: BLE001
        logger.warning("[media_tasks] 取消后更新状态失败: %s", e)
    return {"ok": True, "data": cancel_result}
