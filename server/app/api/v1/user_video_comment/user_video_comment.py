"""用户视频评论"""


from fastapi import APIRouter, Body, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class UserVideoComment(TimestampMixin, Base):
    __tablename__ = "user_video_comment"
    __table_args__ = (
        Index("idx_uvc_video", "video_id"),
        Index("idx_uvc_user", "user_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    user_avatar = Column(String(500), nullable=True)
    video_id = Column(BigInteger, nullable=False)
    content = Column(Text, nullable=False)
    pid = Column(BigInteger, default=0)
    reply_user_id = Column(String(64), nullable=True)
    reply_user_name = Column(String(100), nullable=True)
    like_num = Column(Integer, default=0)
    status = Column(Integer, default=1)


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.get("/list", summary="视频评论列表")
async def list_comments(video_id: int = Query(...), page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            q = db.query(UserVideoComment).filter(
                UserVideoComment.video_id == video_id,
                UserVideoComment.status == 1,
            )
            total = q.count()
            items = q.order_by(UserVideoComment.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": c.id,
                        "user_id": c.user_id,
                        "user_name": c.user_name,
                        "user_avatar": c.user_avatar,
                        "video_id": c.video_id,
                        "content": c.content,
                        "pid": c.pid,
                        "reply_user_id": c.reply_user_id,
                        "reply_user_name": c.reply_user_name,
                        "like_num": c.like_num,
                        "create_time": c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"video comment list error: {e}")
            return error(str(e))


@router.post("", summary="发表视频评论")
async def add_comment(
    video_id: int = Query(...),
    pid: int = 0,
    reply_user_id: str | None = None,
    reply_user_name: str | None = None,
    content: str = Body(..., min_length=1),
):
    with get_session() as db:
        try:
            c = UserVideoComment(
                user_id=_uid(),
                user_name="匿名用户",
                video_id=video_id,
                content=content,
                pid=pid,
                reply_user_id=reply_user_id,
                reply_user_name=reply_user_name,
                status=1,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"video comment add error: {e}")
            return error(str(e))


@router.delete("/{cid}", summary="删除视频评论")
async def delete_comment(cid: int):
    with get_session() as db:
        try:
            c = db.query(UserVideoComment).filter(UserVideoComment.id == cid).first()
            if not c:
                return error("评论不存在", "404")
            c.status = 0
            return success()
        except Exception as e:
            logger.error(f"video comment delete error: {e}")
            return error(str(e))
