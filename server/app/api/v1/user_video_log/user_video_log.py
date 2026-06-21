"""用户视频观看日志"""


from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, Float, Index, Integer, String

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class UserVideoLog(TimestampMixin, Base):
    __tablename__ = "user_video_log"
    __table_args__ = (
        Index("idx_uvl_user", "user_id"),
        Index("idx_uvl_video", "video_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    video_id = Column(BigInteger, nullable=False)
    video_title = Column(String(200), nullable=True)
    duration = Column(Integer, default=0, comment="视频总时长(秒)")
    watched = Column(Integer, default=0, comment="已观看时长(秒)")
    progress = Column(Float, default=0, comment="观看进度0-1")
    device = Column(String(50), nullable=True)
    ip = Column(String(50), nullable=True)
    is_completed = Column(Boolean, default=False, comment="是否看完")
    is_finished = Column(Boolean, default=False, comment="是否完课")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("/record", summary="记录视频观看")
async def record_watch(
    video_id: int = Query(...),
    duration: int = 0,
    watched: int = 0,
    device: str | None = None,
    ip: str | None = None,
    is_completed: bool = False,
    is_finished: bool = False,
    video_title: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            log = UserVideoLog(
                user_id=uid,
                user_name="匿名用户",
                video_id=video_id,
                video_title=video_title,
                duration=duration,
                watched=watched,
                progress=watched / duration if duration else 0,
                device=device,
                ip=ip,
                is_completed=is_completed,
                is_finished=is_finished,
            )
            db.add(log)
            db.flush()
            return success({"id": log.id})
        except Exception as e:
            logger.error(f"video log record error: {e}")
            return error(str(e))


@router.get("/list", operation_id="user_video_log_list", summary="我的观看记录")
async def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    video_id: int | None = None,
    is_finished: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(UserVideoLog).filter(UserVideoLog.user_id == _uid())
            if video_id:
                q = q.filter(UserVideoLog.video_id == video_id)
            if is_finished is not None:
                q = q.filter(UserVideoLog.is_finished == is_finished)
            total = q.count()
            items = q.order_by(UserVideoLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "video_id": l.video_id,
                        "video_title": l.video_title,
                        "duration": l.duration,
                        "watched": l.watched,
                        "progress": l.progress,
                        "device": l.device,
                        "is_completed": l.is_completed,
                        "is_finished": l.is_finished,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"video log list error: {e}")
            return error(str(e))


@router.get("/stats", summary="观看统计")
async def stats():
    with get_session() as db:
        try:
            uid = _uid()
            total = db.query(UserVideoLog).filter(UserVideoLog.user_id == uid).count()
            finished = (
                db.query(UserVideoLog).filter(UserVideoLog.user_id == uid, UserVideoLog.is_finished).count()
            )
            total_watched = (
                db.query(_func_sum := __import__("sqlalchemy").func.sum(UserVideoLog.watched))
                .filter(UserVideoLog.user_id == uid)
                .scalar()
                or 0
            )
            return success(
                {
                    "total_videos": total,
                    "finished_videos": finished,
                    "total_watched": int(total_watched),
                }
            )
        except Exception as e:
            logger.error(f"video log stats error: {e}")
            return success({"total_videos": 0, "finished_videos": 0, "total_watched": 0})
