"""Agent上传 - Agent相关资源上传管理"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, Index, Integer, String

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class AgentUpload(TimestampMixin, Base):
    __tablename__ = "agent_upload"
    __table_args__ = (
        Index("idx_au_user", "user_id"),
        Index("idx_au_agent", "agent_id"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(100), nullable=True)
    agent_id = Column(String(64), nullable=True)
    agent_name = Column(String(200), nullable=True)
    file_name = Column(String(200), nullable=False, comment="文件名")
    file_url = Column(String(500), nullable=False, comment="文件URL")
    file_type = Column(String(50), nullable=True, comment="image/document/video/audio")
    file_size = Column(Integer, default=0, comment="文件大小(字节)")
    mime_type = Column(String(100), nullable=True)
    ext = Column(String(20), nullable=True, comment="扩展名")
    biz_type = Column(String(50), default="avatar", comment="avatar/cover/document/attachment")
    status = Column(Integer, default=1, comment="0=删除 1=正常 2=审核")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("", summary="记录上传")
def record_upload(file_name: str = Query(...), file_url: str = Query(...),
                         file_type: str | None = None, file_size: int = 0,
                         mime_type: str | None = None, ext: str | None = None,
                         agent_id: str | None = None, agent_name: str | None = None,
                         biz_type: str = "avatar"):
    with get_session() as db:
        try:
            u = AgentUpload(
                user_id=_uid(), user_name="匿名用户",
                file_name=file_name, file_url=file_url,
                file_type=file_type, file_size=file_size,
                mime_type=mime_type, ext=ext,
                agent_id=agent_id, agent_name=agent_name,
                biz_type=biz_type, status=1,
            )
            db.add(u)
            db.flush()
            return success({"id": u.id, "file_url": u.file_url})
        except Exception as e:
            logger.error(f"agent upload error: {e}")
            return error(str(e))


@router.get("/list", summary="我的上传")
def list_uploads(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                       agent_id: str | None = None, biz_type: str | None = None,
                       file_type: str | None = None):
    with get_session() as db:
        try:
            q = db.query(AgentUpload).filter(AgentUpload.user_id == _uid(), AgentUpload.status == 1)
            if agent_id:
                q = q.filter(AgentUpload.agent_id == agent_id)
            if biz_type:
                q = q.filter(AgentUpload.biz_type == biz_type)
            if file_type:
                q = q.filter(AgentUpload.file_type == file_type)
            total = q.count()
            items = q.order_by(AgentUpload.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": u.id, "file_name": u.file_name, "file_url": u.file_url,
                "file_type": u.file_type, "file_size": u.file_size,
                "mime_type": u.mime_type, "ext": u.ext,
                "agent_id": u.agent_id, "biz_type": u.biz_type,
                "create_time": u.created_at.isoformat() if u.created_at else None,
            } for u in items], total=total)
        except Exception as e:
            logger.error(f"agent upload list error: {e}")
            return error(str(e))


@router.delete("/{uid}", summary="删除上传记录")
def delete_upload(uid: int):
    with get_session() as db:
        try:
            u = db.query(AgentUpload).filter(AgentUpload.id == uid, AgentUpload.user_id == _uid()).first()
            if not u:
                return error("记录不存在", "404")
            u.status = 0
            return success()
        except Exception as e:
            logger.error(f"agent upload delete error: {e}")
            return error(str(e))
