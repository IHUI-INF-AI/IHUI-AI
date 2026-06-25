"""用户评论日志 - 系统级评论记录"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Index, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class UserCommentLog(TimestampMixin, Base):
    __tablename__ = "user_comment_log"
    __table_args__ = (
        Index("idx_ucl_user", "user_id"),
        Index("idx_ucl_target", "target_type", "target_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    target_type = Column(String(50), nullable=False)
    target_id = Column(BigInteger, nullable=False)
    comment_id = Column(BigInteger, nullable=False)
    content = Column(Text, nullable=False)
    action = Column(String(20), default="add", comment="add/edit/delete")
    ip = Column(String(50), nullable=True)


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("/record", summary="记录评论日志")
def record_log(target_type: str = Query(...), target_id: int = Query(...),
                      comment_id: int = Query(...), content: str = Query(...),
                      action: str = "add", ip: str | None = None):
    with get_session() as db:
        try:
            log = UserCommentLog(
                user_id=_uid(), user_name="匿名用户",
                target_type=target_type, target_id=target_id,
                comment_id=comment_id, content=content,
                action=action, ip=ip,
            )
            db.add(log)
            db.flush()
            return success({"id": log.id})
        except Exception as e:
            logger.error(f"comment log error: {e}")
            return error(str(e))


@router.get("/list", operation_id="user_comment_log_list", summary="评论日志")
def list_logs(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                    user_id: str | None = None, target_type: str | None = None,
                    action: str | None = None):
    with get_session() as db:
        try:
            q = db.query(UserCommentLog)
            if user_id:
                q = q.filter(UserCommentLog.user_id == user_id)
            if target_type:
                q = q.filter(UserCommentLog.target_type == target_type)
            if action:
                q = q.filter(UserCommentLog.action == action)
            total = q.count()
            items = q.order_by(UserCommentLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": l.id, "user_id": l.user_id, "user_name": l.user_name,
                "target_type": l.target_type, "target_id": l.target_id,
                "comment_id": l.comment_id, "content": l.content[:100] if l.content else "",
                "action": l.action, "ip": l.ip,
                "create_time": l.created_at.isoformat() if l.created_at else None,
            } for l in items], total=total)
        except Exception as e:
            logger.error(f"comment log list error: {e}")
            return error(str(e))
