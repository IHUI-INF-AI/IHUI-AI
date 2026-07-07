"""访问统计模块路由 - 迁移自旧 Java Spring Boot visit-tracking-service (2026-07-06).

包含: 访问概览/每日PV/每日UV/IP城市统计/保存访问记录.
UV 基于会话ID(session_id)去重, 无 session_id 时回退到 IP 去重.
visit_date 为字符串日期(YYYY-MM-DD), 支持区间字符串比较.
"""
import datetime as dt

from fastapi import APIRouter, Body, Query
from loguru import logger
from sqlalchemy import distinct, func

from app.database import get_session
from app.models.edu_platform_models_ext import EduVisitLog
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _visit_to_dict(v: EduVisitLog) -> dict:
    return {
        "id": v.id,
        "member_id": v.member_id,
        "ip": v.ip,
        "city": v.city,
        "url": v.url,
        "referer": v.referer,
        "user_agent": v.user_agent,
        "session_id": v.session_id,
        "visit_date": v.visit_date,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


def _date_range_filter(q, start_time: str | None, end_time: str | None):
    """按 visit_date 字符串区间过滤.

    支持 YYYY-MM-DD 或完整时间字符串(取前10位参与比较).
    """
    if start_time:
        q = q.filter(EduVisitLog.visit_date >= start_time[:10])
    if end_time:
        q = q.filter(EduVisitLog.visit_date <= end_time[:10])
    return q


# ---------------------------------------------------------------------------
# 访问统计
# ---------------------------------------------------------------------------


@router.get("/visit-log/summary", summary="访问概览")
async def visit_log_summary(
    startTime: str | None = Query(None, description="开始时间 YYYY-MM-DD"),
    endTime: str | None = Query(None, description="结束时间 YYYY-MM-DD"),
):
    with get_session() as db:
        try:
            q = db.query(EduVisitLog)
            q = _date_range_filter(q, startTime, endTime)
            pv = q.count()
            # UV: 优先按 session_id 去重, 回退到 ip
            uv = q.with_entities(
                func.count(distinct(func.coalesce(EduVisitLog.session_id, EduVisitLog.ip)))
            ).scalar() or 0
            ip_count = q.with_entities(func.count(distinct(EduVisitLog.ip))).scalar() or 0
            member_count = (
                q.with_entities(func.count(distinct(EduVisitLog.member_id)))
                .filter(EduVisitLog.member_id.isnot(None))
                .scalar()
                or 0
            )
            return success(
                {
                    "pv": pv,
                    "uv": uv,
                    "ip_count": ip_count,
                    "member_count": member_count,
                    "start_time": startTime,
                    "end_time": endTime,
                }
            )
        except Exception as e:
            logger.error(f"[edu visit] summary error: {e}")
            return error(str(e))


@router.get("/visit-log/day/pv/list", summary="每日PV列表")
async def visit_log_day_pv_list(
    startTime: str | None = Query(None, description="开始时间 YYYY-MM-DD"),
    endTime: str | None = Query(None, description="结束时间 YYYY-MM-DD"),
):
    with get_session() as db:
        try:
            q = db.query(
                EduVisitLog.visit_date,
                func.count(EduVisitLog.id).label("pv"),
            )
            q = _date_range_filter(q, startTime, endTime)
            q = q.filter(EduVisitLog.visit_date.isnot(None))
            rows = q.group_by(EduVisitLog.visit_date).order_by(EduVisitLog.visit_date.asc()).all()
            return success(
                [
                    {"visit_date": r.visit_date, "pv": r.pv}
                    for r in rows
                ]
            )
        except Exception as e:
            logger.error(f"[edu visit] day pv list error: {e}")
            return error(str(e))


@router.get("/visit-log/day/uv/list", summary="每日UV列表")
async def visit_log_day_uv_list(
    startTime: str | None = Query(None, description="开始时间 YYYY-MM-DD"),
    endTime: str | None = Query(None, description="结束时间 YYYY-MM-DD"),
):
    with get_session() as db:
        try:
            q = db.query(
                EduVisitLog.visit_date,
                func.count(
                    distinct(func.coalesce(EduVisitLog.session_id, EduVisitLog.ip))
                ).label("uv"),
            )
            q = _date_range_filter(q, startTime, endTime)
            q = q.filter(EduVisitLog.visit_date.isnot(None))
            rows = q.group_by(EduVisitLog.visit_date).order_by(EduVisitLog.visit_date.asc()).all()
            return success(
                [
                    {"visit_date": r.visit_date, "uv": r.uv}
                    for r in rows
                ]
            )
        except Exception as e:
            logger.error(f"[edu visit] day uv list error: {e}")
            return error(str(e))


@router.get("/visit-log/ip-city/summary/list", summary="IP城市统计列表")
async def visit_log_ip_city_summary_list(
    startTime: str | None = Query(None, description="开始时间 YYYY-MM-DD"),
    endTime: str | None = Query(None, description="结束时间 YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            base = db.query(EduVisitLog)
            base = _date_range_filter(base, startTime, endTime)

            # 总分组数
            total = (
                base.with_entities(
                    func.count(distinct(func.concat(EduVisitLog.ip, "_", EduVisitLog.city)))
                ).scalar()
                or 0
            )

            # 分页查询分组统计
            q = db.query(
                EduVisitLog.ip,
                EduVisitLog.city,
                func.count(EduVisitLog.id).label("pv"),
                func.count(
                    distinct(func.coalesce(EduVisitLog.session_id, EduVisitLog.ip))
                ).label("uv"),
            )
            q = _date_range_filter(q, startTime, endTime)
            q = q.group_by(EduVisitLog.ip, EduVisitLog.city).order_by(func.count(EduVisitLog.id).desc())
            rows = q.offset((page - 1) * limit).limit(limit).all()

            return success(
                [
                    {
                        "ip": r.ip,
                        "city": r.city,
                        "pv": r.pv,
                        "uv": r.uv,
                    }
                    for r in rows
                ],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu visit] ip city summary list error: {e}")
            return error(str(e))


@router.post("/public-api/visit-log", summary="保存访问记录")
async def save_visit_log(data: dict = Body(..., description="访问记录数据")):
    with get_session() as db:
        try:
            # 兼容 {"data": {...}} 与平铺两种结构
            payload = data.get("data") if isinstance(data.get("data"), dict) else data
            visit_date = payload.get("visit_date")
            if not visit_date:
                visit_date = dt.datetime.now().strftime("%Y-%m-%d")
            v = EduVisitLog(
                member_id=payload.get("member_id"),
                ip=payload.get("ip"),
                city=payload.get("city"),
                url=payload.get("url"),
                referer=payload.get("referer"),
                user_agent=payload.get("user_agent"),
                session_id=payload.get("session_id"),
                visit_date=visit_date[:10] if visit_date else None,
            )
            db.add(v)
            db.flush()
            return success(_visit_to_dict(v))
        except Exception as e:
            logger.error(f"[edu visit] save visit log error: {e}")
            return error(str(e))
