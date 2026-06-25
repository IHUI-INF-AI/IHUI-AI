"""访问追踪 - 用户行为追踪与统计"""

from datetime import date

from fastapi import APIRouter, Query
from loguru import logger

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.visit_models import VisitLog, VisitPage, VisitSource, VisitStats
from app.schemas.common import error, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("/track", summary="记录访问")
def track(
    path: str = Query(..., min_length=1),
    method: str | None = None,
    query_params: str | None = None,
    referer: str | None = None,
    user_agent: str | None = None,
    ip: str | None = None,
    device: str | None = None,
    os: str | None = None,
    browser: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    duration: int = 0,
    source: str | None = None,
    session_id: str | None = None,
    user_id: str | None = None,
):
    with get_session() as db:
        try:
            uid = user_id or _uid()
            v = VisitLog(
                user_id=uid,
                user_name="匿名用户",
                session_id=session_id,
                path=path,
                method=method,
                query_params=query_params,
                referer=referer,
                user_agent=user_agent,
                ip=ip,
                device=device,
                os=os,
                browser=browser,
                target_type=target_type,
                target_id=target_id,
                duration=duration,
                source=source,
            )
            db.add(v)
            db.flush()
            today = date.today().isoformat()
            stats = (
                db.query(VisitStats)
                .filter(
                    VisitStats.stat_date == today,
                    VisitStats.stat_type == "daily",
                    VisitStats.target_type == target_type,
                    VisitStats.target_id == target_id,
                )
                .first()
            )
            if stats:
                stats.pv = (stats.pv or 0) + 1
            else:
                stats = VisitStats(
                    stat_date=today,
                    stat_type="daily",
                    target_type=target_type,
                    target_id=target_id,
                    pv=1,
                    uv=1,
                )
                db.add(stats)
            return success({"id": v.id})
        except Exception as e:
            logger.error(f"visit track error: {e}")
            return error(str(e))


@router.get("/log/list", summary="访问日志")
def log_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_id: str | None = None,
    path: str | None = None,
    target_type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(VisitLog)
            if user_id:
                q = q.filter(VisitLog.user_id == user_id)
            if path:
                q = q.filter(VisitLog.path.like(f"%{path}%"))
            if target_type:
                q = q.filter(VisitLog.target_type == target_type)
            if start_date:
                q = q.filter(VisitLog.created_at >= start_date)
            if end_date:
                q = q.filter(VisitLog.created_at <= end_date + " 23:59:59")
            total = q.count()
            items = q.order_by(VisitLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": v.id,
                        "user_id": v.user_id,
                        "user_name": v.user_name,
                        "path": v.path,
                        "method": v.method,
                        "ip": v.ip,
                        "device": v.device,
                        "os": v.os,
                        "browser": v.browser,
                        "target_type": v.target_type,
                        "target_id": v.target_id,
                        "duration": v.duration,
                        "source": v.source,
                        "create_time": v.created_at.isoformat() if v.created_at else None,
                    }
                    for v in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"visit log error: {e}")
            return error(str(e))


@router.get("/stats/daily", operation_id="visit_daily_stats", summary="每日访问统计")
def daily_stats(
    start_date: str | None = None, end_date: str | None = None, target_type: str | None = None
):
    with get_session() as db:
        try:
            q = db.query(VisitStats).filter(VisitStats.stat_type == "daily")
            if start_date:
                q = q.filter(VisitStats.stat_date >= start_date)
            if end_date:
                q = q.filter(VisitStats.stat_date <= end_date)
            if target_type:
                q = q.filter(VisitStats.target_type == target_type)
            items = q.order_by(VisitStats.stat_date.asc()).all()
            return success(
                [
                    {
                        "stat_date": s.stat_date,
                        "target_type": s.target_type,
                        "target_id": s.target_id,
                        "pv": s.pv,
                        "uv": s.uv,
                        "ip_count": s.ip_count,
                        "new_user": s.new_user,
                        "avg_duration": s.avg_duration,
                        "bounce_rate": s.bounce_rate,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"visit daily stats error: {e}")
            return error(str(e))


@router.get("/stats/today", summary="今日实时统计")
def today_stats():
    with get_session() as db:
        try:
            today = date.today().isoformat()
            items = (
                db.query(VisitStats)
                .filter(
                    VisitStats.stat_date == today,
                    VisitStats.stat_type == "daily",
                )
                .all()
            )
            total_pv = sum(s.pv or 0 for s in items)
            total_uv = sum(s.uv or 0 for s in items)
            return success(
                {
                    "stat_date": today,
                    "total_pv": total_pv,
                    "total_uv": total_uv,
                    "target_stats": [
                        {
                            "target_type": s.target_type,
                            "target_id": s.target_id,
                            "pv": s.pv,
                            "uv": s.uv,
                        }
                        for s in items
                    ],
                }
            )
        except Exception as e:
            logger.error(f"visit today stats error: {e}")
            return error(str(e))


@router.get("/stats/source", summary="来源统计")
def source_stats(start_date: str | None = None, end_date: str | None = None):
    with get_session() as db:
        try:
            q = db.query(VisitSource)
            if start_date:
                q = q.filter(VisitSource.stat_date >= start_date)
            if end_date:
                q = q.filter(VisitSource.stat_date <= end_date)
            items = q.order_by(VisitSource.stat_date.desc()).all()
            return success(
                [
                    {
                        "stat_date": s.stat_date,
                        "source": s.source,
                        "visit_count": s.visit_count,
                    }
                    for s in items
                ]
            )
        except Exception as e:
            logger.error(f"visit source stats error: {e}")
            return error(str(e))


@router.get("/stats/page", summary="页面统计")
def page_stats(
    start_date: str | None = None, end_date: str | None = None, limit: int = Query(50, ge=1, le=200)
):
    with get_session() as db:
        try:
            q = db.query(VisitPage)
            if start_date:
                q = q.filter(VisitPage.stat_date >= start_date)
            if end_date:
                q = q.filter(VisitPage.stat_date <= end_date)
            items = q.order_by(VisitPage.visit_count.desc()).limit(limit).all()
            return success(
                [
                    {
                        "stat_date": p.stat_date,
                        "path": p.path,
                        "visit_count": p.visit_count,
                        "uv": p.uv,
                        "avg_duration": p.avg_duration,
                    }
                    for p in items
                ]
            )
        except Exception as e:
            logger.error(f"visit page stats error: {e}")
            return error(str(e))


@router.post("/source/record", summary="记录来源")
def record_source(source: str = Query(...), stat_date: str | None = None):
    with get_session() as db:
        try:
            d = stat_date or date.today().isoformat()
            r = db.query(VisitSource).filter(VisitSource.stat_date == d, VisitSource.source == source).first()
            if r:
                r.visit_count = (r.visit_count or 0) + 1
            else:
                db.add(VisitSource(stat_date=d, source=source, visit_count=1))
            return success()
        except Exception as e:
            logger.error(f"visit source record error: {e}")
            return error(str(e))


@router.post("/page/record", summary="记录页面访问")
def record_page(path: str = Query(...), stat_date: str | None = None, duration: int = 0):
    with get_session() as db:
        try:
            d = stat_date or date.today().isoformat()
            r = db.query(VisitPage).filter(VisitPage.stat_date == d, VisitPage.path == path).first()
            if r:
                r.visit_count = (r.visit_count or 0) + 1
                if r.uv:
                    r.uv += 1
                else:
                    r.uv = 1
                r.avg_duration = (
                    int(((r.avg_duration or 0) * (r.visit_count - 1) + duration) / r.visit_count)
                    if r.visit_count
                    else duration
                )
            else:
                db.add(VisitPage(stat_date=d, path=path, visit_count=1, uv=1, avg_duration=duration))
            return success()
        except Exception as e:
            logger.error(f"visit page record error: {e}")
            return error(str(e))
