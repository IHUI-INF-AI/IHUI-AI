"""日程管理"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class Schedule(TimestampMixin, Base):
    __tablename__ = "schedule"
    __table_args__ = (
        Index("idx_schedule_user", "user_id"),
        Index("idx_schedule_time", "start_time"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    all_day = Column(Boolean, default=False)
    type = Column(String(20), default="personal", comment="personal/work/course/meeting")
    color = Column(String(20), nullable=True)
    remind_before = Column(Integer, default=0, comment="提前提醒分钟")
    location = Column(String(200), nullable=True)
    ref_id = Column(String(64), nullable=True, comment="关联业务ID")
    ref_type = Column(String(50), nullable=True)
    status = Column(Integer, default=1, comment="0=取消 1=正常 2=完成")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.get("/list", summary="我的日程")
def list_schedules(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Schedule).filter(Schedule.user_id == _uid())
            if type:
                q = q.filter(Schedule.type == type)
            if start_date:
                q = q.filter(Schedule.start_time >= start_date)
            if end_date:
                q = q.filter(Schedule.start_time <= end_date)
            total = q.count()
            items = q.order_by(Schedule.start_time.asc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": s.id,
                        "title": s.title,
                        "description": s.description,
                        "start_time": s.start_time.isoformat() if s.start_time else None,
                        "end_time": s.end_time.isoformat() if s.end_time else None,
                        "all_day": s.all_day,
                        "type": s.type,
                        "color": s.color,
                        "remind_before": s.remind_before,
                        "location": s.location,
                        "ref_id": s.ref_id,
                        "ref_type": s.ref_type,
                        "status": s.status,
                    }
                    for s in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"schedule list error: {e}")
            return error(str(e))


@router.post("", summary="创建日程")
def create_schedule(
    title: str = Query(..., min_length=1),
    description: str | None = None,
    start_time: datetime = Query(...),
    end_time: datetime | None = None,
    all_day: bool = False,
    type: str = "personal",
    color: str | None = None,
    remind_before: int = 0,
    location: str | None = None,
    ref_id: str | None = None,
    ref_type: str | None = None,
):
    with get_session() as db:
        try:
            s = Schedule(
                user_id=_uid(),
                title=title,
                description=description,
                start_time=start_time,
                end_time=end_time,
                all_day=all_day,
                type=type,
                color=color,
                remind_before=remind_before,
                location=location,
                ref_id=ref_id,
                ref_type=ref_type,
                status=1,
            )
            db.add(s)
            db.flush()
            return success({"id": s.id})
        except Exception as e:
            logger.error(f"schedule create error: {e}")
            return error(str(e))


@router.put("/{sid}", summary="修改日程")
def update_schedule(
    sid: int,
    title: str | None = None,
    description: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    status: int | None = None,
    color: str | None = None,
):
    with get_session() as db:
        try:
            s = db.query(Schedule).filter(Schedule.id == sid, Schedule.user_id == _uid()).first()
            if not s:
                return error("日程不存在", "404")
            if title:
                s.title = title
            if description is not None:
                s.description = description
            if start_time:
                s.start_time = start_time
            if end_time:
                s.end_time = end_time
            if status is not None:
                s.status = status
            if color:
                s.color = color
            return success()
        except Exception as e:
            logger.error(f"schedule update error: {e}")
            return error(str(e))


@router.delete("/{sid}", summary="删除日程")
def delete_schedule(sid: int):
    with get_session() as db:
        try:
            s = db.query(Schedule).filter(Schedule.id == sid, Schedule.user_id == _uid()).first()
            if not s:
                return error("日程不存在", "404")
            db.delete(s)
            return success()
        except Exception as e:
            logger.error(f"schedule delete error: {e}")
            return error(str(e))
