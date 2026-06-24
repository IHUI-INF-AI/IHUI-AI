"""edu_visit_tracking service - Visit tracking (migrated from ihui-ai-edu-visit-tracking-service)."""

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session
from app.models.edu_models import EduVisitLog
from app.services.edu_base import paginate


def log_visit(
    db: Session, path: str, method: str, status_code: int, duration_ms: int,
    user_id: Optional[int] = None, ip: Optional[str] = None,
    user_agent: Optional[str] = None, referrer: Optional[str] = None,
) -> EduVisitLog:
    """Log a single visit."""
    v = EduVisitLog(
        user_id=user_id, ip=ip, path=path, method=method,
        status_code=status_code, user_agent=user_agent,
        referrer=referrer, duration_ms=duration_ms,
    )
    db.add(v)
    db.flush()
    db.refresh(v)
    return v


def get_daily_visits(db: Session, days: int = 30) -> List[dict]:
    """Aggregate daily visit counts for the past N days."""
    from datetime import timedelta
    since = datetime.now(timezone.utc) - timedelta(days=days)
    rows = db.execute(
        select(
            func.date(EduVisitLog.created_at).label("day"),
            func.count(EduVisitLog.id).label("count"),
        ).where(EduVisitLog.created_at >= since)
        .group_by(func.date(EduVisitLog.created_at))
        .order_by("day")
    ).all()
    return [{"day": str(r.day), "count": r.count} for r in rows]


def get_path_stats(db: Session, limit: int = 20) -> List[dict]:
    """Get most-visited paths."""
    rows = db.execute(
        select(
            EduVisitLog.path,
            func.count(EduVisitLog.id).label("count"),
            func.avg(EduVisitLog.duration_ms).label("avg_duration_ms"),
        ).group_by(EduVisitLog.path)
        .order_by(desc(func.count(EduVisitLog.id)))
        .limit(limit)
    ).all()
    return [{"path": r.path, "count": r.count, "avg_duration_ms": float(r.avg_duration_ms or 0)} for r in rows]
