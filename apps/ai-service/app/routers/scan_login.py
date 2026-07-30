"""扫码登录 API 路由(2026-07-30 新增)。

端点:
- POST /publish/scan-login/start        启动扫码任务
- GET  /publish/scan-login/{task_id}/status  查询任务状态
- GET  /publish/scan-login/{task_id}/qr      获取二维码截图 PNG
- POST /publish/scan-login/{task_id}/cancel  取消任务
- GET  /publish/scan-login/platforms         列出支持的平台
"""
from __future__ import annotations

import io
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.scan_login import (
    PLATFORM_SCAN_CONFIG,
    cancel_scan_task,
    get_qr_image,
    get_task,
    list_tasks,
    start_scan_task,
)

router = APIRouter(prefix="/publish/scan-login", tags=["publish-scan-login"])


# =============================================================================
# Schema
# =============================================================================
class StartScanRequest(BaseModel):
    platform: str = Field(..., description="平台 ID,如 zhihu / bilibili / xiaohongshu")


# =============================================================================
# 端点
# =============================================================================
@router.get("/platforms")
async def list_supported_platforms() -> dict[str, Any]:
    """列出支持的扫码登录平台(供前端展示)。"""
    platforms = []
    for pid, cfg in PLATFORM_SCAN_CONFIG.items():
        platforms.append({
            "platform": pid,
            "name": cfg["name"],
            "login_url": cfg["login_url"],
            "success_cookies": cfg["success_cookies"],
        })
    return {"code": 0, "message": "ok", "data": {"platforms": platforms}}


@router.post("/start")
async def start_scan(body: StartScanRequest, request: Request) -> dict[str, Any]:
    """启动扫码登录任务。返回 task_id,前端轮询 status + qr。"""
    user_id = await get_current_user_id(request)
    try:
        task = start_scan_task(user_id=user_id, platform=body.platform)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "code": 0,
        "message": "扫码任务已启动",
        "data": {
            "task_id": task.task_id,
            "platform": task.platform,
            "status": task.status,
            "snapshot": task.snapshot(),
        },
    }


@router.get("/{task_id}/status")
async def get_task_status(task_id: str) -> dict[str, Any]:
    """查询任务状态。"""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    return {
        "code": 0,
        "message": "ok",
        "data": task.snapshot(),
    }


@router.get("/{task_id}/qr")
async def get_task_qr(task_id: str) -> Response:
    """获取二维码截图 PNG。"""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    img_bytes = get_qr_image(task_id)
    if not img_bytes:
        raise HTTPException(status_code=503, detail="二维码截图未就绪,请稍后重试")
    return Response(
        content=img_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Task-Status": task.status,
        },
    )


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str) -> dict[str, Any]:
    """取消扫码任务。"""
    task = get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    ok = cancel_scan_task(task_id)
    return {
        "code": 0 if ok else 1,
        "message": "已取消" if ok else "任务已完成,无法取消",
        "data": {"task_id": task_id, "cancelled": ok},
    }
