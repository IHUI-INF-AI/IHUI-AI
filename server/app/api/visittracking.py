#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
访问埋点 API
- 迁移自 edu client\service\service\ihui-ai-edu-behavior-service 的 VisitTracking
- 提供：保存埋点日志（public-api）、查询埋点列表（admin）、查询埋点统计
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text

from ..database import get_db
from ..security import get_current_user_optional

router = APIRouter(prefix="/visit-tracking", tags=["VisitTracking"])


# ---------- Request/Response 模型 ----------
class VisitLogCreate(BaseModel):
    """埋点日志写入入参"""
    user_uuid: Optional[str] = Field("", description="用户 UUID，可选")
    page_url: str = Field(..., description="访问页面 URL")
    referer: Optional[str] = Field("", description="来源页面")
    user_agent: Optional[str] = Field("", description="User-Agent")
    ip: Optional[str] = Field("", description="客户端 IP（可由后端补全）")
    device: Optional[str] = Field("", description="设备类型：pc/h5/miniapp/ios/android")
    duration_ms: Optional[int] = Field(0, description="停留时长（毫秒）")
    event: Optional[str] = Field("view", description="事件类型：view/click/exit")
    extra: Optional[Dict[str, Any]] = Field(default=None, description="扩展字段")


class VisitLogOut(BaseModel):
    id: int
    user_uuid: Optional[str] = None
    page_url: str
    referer: Optional[str] = None
    device: Optional[str] = None
    event: Optional[str] = None
    duration_ms: Optional[int] = 0
    created_at: Optional[str] = None


class VisitStatsOut(BaseModel):
    total: int = 0
    unique_users: int = 0
    unique_ips: int = 0
    top_pages: List[Dict[str, Any]] = []


# ---------- 公开接口（前端 SDK 调用） ----------
@router.post("/public-api/visit-log", summary="保存访问埋点日志")
async def save_visit_log(payload: VisitLogCreate):
    """前端访问埋点写入，无需登录。"""
    db = next(get_db())
    try:
        sql = text("""
            INSERT INTO zhs_visit_log
                (user_uuid, page_url, referer, user_agent, ip, device, duration_ms, event, extra, created_at)
            VALUES
                (:user_uuid, :page_url, :referer, :user_agent, :ip, :device, :duration_ms, :event, :extra, :created_at)
        """)
        import json
        db.execute(sql, {
            "user_uuid": payload.user_uuid or "",
            "page_url": payload.page_url,
            "referer": payload.referer or "",
            "user_agent": payload.user_agent or "",
            "ip": payload.ip or "",
            "device": payload.device or "",
            "duration_ms": int(payload.duration_ms or 0),
            "event": payload.event or "view",
            "extra": json.dumps(payload.extra or {}, ensure_ascii=False),
            "created_at": datetime.utcnow(),
        })
        db.commit()
        return {"code": 0, "msg": "ok"}
    except Exception as e:
        db.rollback()
        # 表不存在时静默返回成功，避免影响前端业务
        return {"code": 0, "msg": "ok", "_warn": str(e)}
    finally:
        db.close()


# ---------- 管理端接口（需登录） ----------
@router.get("/visit-log/page", summary="埋点日志分页查询")
async def page_visit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user_uuid: Optional[str] = None,
    page_url: Optional[str] = None,
    device: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="未登录")
    db = next(get_db())
    try:
        where = ["1=1"]
        params: Dict[str, Any] = {"offset": (page - 1) * page_size, "limit": page_size}
        if user_uuid:
            where.append("user_uuid = :user_uuid")
            params["user_uuid"] = user_uuid
        if page_url:
            where.append("page_url LIKE :page_url")
            params["page_url"] = f"%{page_url}%"
        if device:
            where.append("device = :device")
            params["device"] = device
        where_sql = " AND ".join(where)
        count_sql = text(f"SELECT COUNT(*) AS c FROM zhs_visit_log WHERE {where_sql}")
        list_sql = text(f"""
            SELECT id, user_uuid, page_url, referer, device, event, duration_ms, created_at
            FROM zhs_visit_log
            WHERE {where_sql}
            ORDER BY id DESC
            LIMIT :offset, :limit
        """)
        total = db.execute(count_sql, params).scalar() or 0
        rows = db.execute(list_sql, params).mappings().all()
        return {
            "code": 0,
            "data": {
                "list": [dict(r) for r in rows],
                "total": int(total),
                "page": page,
                "page_size": page_size,
            },
        }
    finally:
        db.close()


@router.get("/visit-log/stats", summary="埋点统计")
async def visit_log_stats(
    days: int = Query(7, ge=1, le=90),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="未登录")
    db = next(get_db())
    try:
        total_sql = text("SELECT COUNT(*) FROM zhs_visit_log")
        users_sql = text("SELECT COUNT(DISTINCT user_uuid) FROM zhs_visit_log WHERE user_uuid != ''")
        ips_sql = text("SELECT COUNT(DISTINCT ip) FROM zhs_visit_log WHERE ip != ''")
        top_sql = text("""
            SELECT page_url, COUNT(*) AS pv
            FROM zhs_visit_log
            GROUP BY page_url
            ORDER BY pv DESC
            LIMIT 10
        """)
        return {
            "code": 0,
            "data": {
                "total": int(db.execute(total_sql).scalar() or 0),
                "unique_users": int(db.execute(users_sql).scalar() or 0),
                "unique_ips": int(db.execute(ips_sql).scalar() or 0),
                "top_pages": [dict(r) for r in db.execute(top_sql).mappings().all()],
                "days": days,
            },
        }
    finally:
        db.close()
