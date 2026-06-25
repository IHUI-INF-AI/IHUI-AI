"""排行榜"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Integer, String, Text, func

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class RankingList(TimestampMixin, Base):
    """排行榜榜单"""

    __tablename__ = "ranking_list"
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(20), default="agent", comment="agent/user/course/point")
    period = Column(String(20), default="day", comment="day/week/month/all")
    status = Column(Integer, default=1)


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _get_user_score(db, period: str) -> list:
    """获取用户积分排行(模拟实现)"""
    cutoff = None
    now = utcnow()
    if period == "day":
        cutoff = now - timedelta(days=1)
    elif period == "week":
        cutoff = now - timedelta(weeks=1)
    elif period == "month":
        cutoff = now - timedelta(days=30)

    from app.models.point_models import PointLog

    q = db.query(
        PointLog.user_id,
        PointLog.user_name,
        func.sum(PointLog.point).label("score"),
    ).filter(PointLog.type == "add")
    if cutoff:
        q = q.filter(PointLog.created_at >= cutoff)
    q = q.group_by(PointLog.user_id, PointLog.user_name)
    q = q.order_by(func.sum(PointLog.point).desc())
    return q.limit(100).all()


@router.get("/list", summary="排行榜列表")
async def list_rankings():
    with get_session() as db:
        try:
            items = db.query(RankingList).filter(RankingList.status == 1).all()
            return success(
                [
                    {
                        "id": r.id,
                        "name": r.name,
                        "code": r.code,
                        "type": r.type,
                        "period": r.period,
                        "description": r.description,
                    }
                    for r in items
                ]
            )
        except Exception as e:
            logger.error(f"ranking list error: {e}")
            return error(str(e))


@router.get("/user", summary="用户积分排行榜")
async def user_ranking(period: str = "all", limit: int = Query(50, ge=1, le=200)):
    with get_session() as db:
        try:
            from app.models.point_models import PointAccount

            if period == "all":
                items = db.query(PointAccount).order_by(PointAccount.total_point.desc()).limit(limit).all()
                return success(
                    [
                        {
                            "rank": i + 1,
                            "user_id": a.user_id,
                            "user_name": a.user_name,
                            "score": a.total_point,
                            "level": a.level,
                        }
                        for i, a in enumerate(items)
                    ]
                )
            items = _get_user_score(db, period)
            return success(
                [
                    {
                        "rank": i + 1,
                        "user_id": u.user_id,
                        "user_name": u.user_name or "",
                        "score": u.score or 0,
                    }
                    for i, u in enumerate(items)
                ]
            )
        except Exception as e:
            logger.error(f"user ranking error: {e}")
            return error(str(e))


@router.get("/agent", summary="Agent排行榜")
async def agent_ranking(period: str = "all", limit: int = Query(50, ge=1, le=200)):
    with get_session() as db:
        try:
            from app.models.agent_models import Agent
            from app.models.agents_models_legacy import Agent as _A

            items = db.query(_A).order_by(_A.heat.desc()).limit(limit).all() if db.query(_A).first() is not None else []
            return success(
                [
                    {
                        "rank": i + 1,
                        "agent_id": a.id if hasattr(a, "id") else a.agent_id,
                        "name": a.name if hasattr(a, "name") else "",
                        "heat": a.heat if hasattr(a, "heat") else 0,
                    }
                    for i, a in enumerate(items)
                ]
            )
        except Exception as e:
            try:
                items = db.query(Agent).order_by(Agent.heat.desc()).limit(limit).all()
                return success(
                    [
                        {
                            "rank": i + 1,
                            "agent_id": a.id,
                            "name": a.name,
                            "heat": getattr(a, "heat", 0),
                        }
                        for i, a in enumerate(items)
                    ]
                )
            except Exception as e2:
                logger.error(f"agent ranking error: {e}, {e2}")
                return success([])


@router.get("/course", summary="课程排行榜")
async def course_ranking(limit: int = Query(50, ge=1, le=200)):
    with get_session() as db:
        try:
            from app.models.course_models import ZhsCourse

            items = db.query(ZhsCourse).order_by(ZhsCourse.view_num.desc()).limit(limit).all()
            return success(
                [
                    {
                        "rank": i + 1,
                        "course_id": c.id,
                        "title": c.title,
                        "view_num": getattr(c, "view_num", 0),
                        "student_num": getattr(c, "student_num", 0),
                    }
                    for i, c in enumerate(items)
                ]
            )
        except Exception as e:
            logger.error(f"course ranking error: {e}")
            return success([])


@router.post("", summary="创建榜单")
async def create_ranking(
    name: str = Query(...),
    code: str = Query(...),
    type: str = "agent",
    period: str = "day",
    description: str | None = None,
):
    with get_session() as db:
        try:
            r = RankingList(name=name, code=code, type=type, period=period, description=description, status=1)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"ranking create error: {e}")
            return error(str(e))
