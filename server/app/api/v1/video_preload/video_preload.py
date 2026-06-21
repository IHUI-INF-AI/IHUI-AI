"""视频预读 - 视频时间段预加载"""


from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, Index, Integer, String

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class VideoPreload(TimestampMixin, Base):
    """视频预读记录"""

    __tablename__ = "video_preload"
    __table_args__ = (
        Index("idx_vp_user", "user_id"),
        Index("idx_vp_video", "video_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    video_id = Column(BigInteger, nullable=False)
    video_url = Column(String(500), nullable=True)
    start_time = Column(Integer, default=0, comment="开始时间(秒)")
    end_time = Column(Integer, default=0, comment="结束时间(秒)")
    preload_size = Column(Integer, default=0, comment="预读大小(KB)")
    completed = Column(Boolean, default=False, comment="是否完成")
    is_chunked = Column(Boolean, default=True, comment="是否分片")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("", summary="创建预读任务")
async def create_preload(
    video_id: int = Query(...),
    start_time: int = 0,
    end_time: int = 0,
    is_chunked: bool = True,
    video_url: str | None = None,
):
    with get_session() as db:
        try:
            p = VideoPreload(
                user_id=_uid(),
                video_id=video_id,
                video_url=video_url,
                start_time=start_time,
                end_time=end_time,
                is_chunked=is_chunked,
                preload_size=(end_time - start_time) * 128,
            )
            db.add(p)
            db.flush()
            return success(
                {
                    "id": p.id,
                    "preload_size": p.preload_size,
                    "is_chunked": is_chunked,
                }
            )
        except Exception as e:
            logger.error(f"video preload create error: {e}")
            return error(str(e))


@router.get("/list", summary="我的预读任务")
async def list_preloads(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), video_id: int | None = None
):
    with get_session() as db:
        try:
            q = db.query(VideoPreload).filter(VideoPreload.user_id == _uid())
            if video_id:
                q = q.filter(VideoPreload.video_id == video_id)
            total = q.count()
            items = q.order_by(VideoPreload.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": p.id,
                        "video_id": p.video_id,
                        "start_time": p.start_time,
                        "end_time": p.end_time,
                        "preload_size": p.preload_size,
                        "completed": p.completed,
                        "is_chunked": p.is_chunked,
                        "create_time": p.created_at.isoformat() if p.created_at else None,
                    }
                    for p in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"video preload list error: {e}")
            return error(str(e))


@router.put("/{pid}/complete", summary="标记完成")
async def mark_complete(pid: int):
    with get_session() as db:
        try:
            p = db.query(VideoPreload).filter(VideoPreload.id == pid, VideoPreload.user_id == _uid()).first()
            if not p:
                return error("预读任务不存在", "404")
            p.completed = True
            return success()
        except Exception as e:
            logger.error(f"video preload complete error: {e}")
            return error(str(e))


@router.delete("/{pid}", summary="删除预读任务")
async def delete_preload(pid: int):
    with get_session() as db:
        try:
            p = db.query(VideoPreload).filter(VideoPreload.id == pid, VideoPreload.user_id == _uid()).first()
            if not p:
                return error("预读任务不存在", "404")
            db.delete(p)
            return success()
        except Exception as e:
            logger.error(f"video preload delete error: {e}")
            return error(str(e))
