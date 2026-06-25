"""用户反馈"""

from app.utils.datetime_helper import utcnow

from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success
from app.security import require_role


class Feedback(TimestampMixin, Base):
    """用户反馈"""

    __tablename__ = "ai_user_feedback"
    __table_args__ = (
        Index("idx_fb_user", "user_id"),
        Index("idx_fb_status", "status"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=True)
    user_name = Column(String(100), nullable=True)
    contact = Column(String(100), nullable=True, comment="联系方式")
    type = Column(String(20), default="bug", comment="bug/suggestion/consultation/complaint/other")
    title = Column(String(200), nullable=False, comment="反馈标题")
    content = Column(Text, nullable=False, comment="反馈内容")
    images = Column(Text, nullable=True, comment="图片JSON数组")
    contact_info = Column(String(200), nullable=True, comment="联系方式")
    app_version = Column(String(50), nullable=True)
    device_info = Column(String(500), nullable=True)
    status = Column(Integer, default=0, comment="0=待处理 1=已处理 2=已忽略 3=跟进中")
    priority = Column(Integer, default=1, comment="1=低 2=中 3=高")
    handle_user = Column(String(64), nullable=True)
    handle_time = Column(DateTime, nullable=True)
    handle_remark = Column(Text, nullable=True)
    reply = Column(Text, nullable=True, comment="回复内容")
    reply_time = Column(DateTime, nullable=True)
    rating = Column(Integer, default=0, comment="用户评分1-5")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

@router.post("", summary="提交反馈")
def submit_feedback(
    title: str = Query(..., min_length=1, max_length=200),
    content: str = Query(..., min_length=1),
    type: str = "bug",
    images: str | None = None,
    contact: str | None = None,
    app_version: str | None = None,
    device_info: str | None = None,
):
    with get_session() as db:
        try:
            uid = _uid()
            f = Feedback(
                user_id=uid,
                user_name="匿名用户",
                type=type,
                title=title,
                content=content,
                images=images,
                contact_info=contact,
                app_version=app_version,
                device_info=device_info,
                status=0,
                priority=1,
            )
            db.add(f)
            db.flush()
            return success({"id": f.id})
        except Exception as e:
            logger.error(f"feedback submit error: {e}")
            return error(str(e))


@router.get("/list", summary="我的反馈")
def list_my_feedbacks(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: str | None = None,
    status: int | None = None,
):
    """我的反馈列表.

    2026-06-25 P1 加固: 默认隐藏 status==2 (已忽略) 的反馈,
    用户主动查询 status==2 仍可看到 (兼容前端按状态筛选).
    """
    with get_session() as db:
        try:
            q = db.query(Feedback).filter(Feedback.user_id == _uid())
            if type:
                q = q.filter(Feedback.type == type)
            if status is not None:
                q = q.filter(Feedback.status == status)
            else:
                # 不指定 status 时, 默认过滤掉 status==2 (已忽略, 业务软删除)
                q = q.filter(Feedback.status != 2)
            total = q.count()
            items = q.order_by(Feedback.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": f.id,
                        "type": f.type,
                        "title": f.title,
                        "content": f.content,
                        "images": f.images,
                        "status": f.status,
                        "priority": f.priority,
                        "reply": f.reply,
                        "reply_time": f.reply_time.isoformat() if f.reply_time else None,
                        "handle_remark": f.handle_remark,
                        "rating": f.rating,
                        "create_time": f.created_at.isoformat() if f.created_at else None,
                    }
                    for f in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"feedback list error: {e}")
            return error(str(e))


@router.get("/admin/list", operation_id="feedback_admin_list", summary="反馈列表(管理员)")
def admin_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    type: str | None = None,
    priority: int | None = None,
    _admin: str = Depends(require_role("admin")),
):
    with get_session() as db:
        try:
            q = db.query(Feedback)
            if status is not None:
                q = q.filter(Feedback.status == status)
            if type:
                q = q.filter(Feedback.type == type)
            if priority is not None:
                q = q.filter(Feedback.priority == priority)
            total = q.count()
            items = (
                q.order_by(Feedback.priority.desc(), Feedback.id.desc()).offset((page - 1) * limit).limit(limit).all()
            )
            return success(
                [
                    {
                        "id": f.id,
                        "user_id": f.user_id,
                        "user_name": f.user_name,
                        "type": f.type,
                        "title": f.title,
                        "content": f.content,
                        "status": f.status,
                        "priority": f.priority,
                        "contact_info": f.contact_info,
                        "app_version": f.app_version,
                        "device_info": f.device_info,
                        "create_time": f.created_at.isoformat() if f.created_at else None,
                    }
                    for f in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"feedback admin list error: {e}")
            return error(str(e))


@router.get("/{fid}", summary="反馈详情")
def get_feedback(fid: int):
    """反馈详情.

    2026-06-25 P1 加固: 用户视角隐藏 status==2 (已忽略, 业务软删除)
    """
    with get_session() as db:
        try:
            uid = _uid()
            f = db.query(Feedback).filter(
                Feedback.id == fid, Feedback.status != 2
            ).first()
            # 用户视角: 自己的反馈 或 (admin 看到所有) (这里简化为用户只能看自己的)
            if f and f.user_id != uid and uid != "admin":
                f = None
            if not f:
                return error("反馈不存在", "404")
            return success(
                {
                    "id": f.id,
                    "user_id": f.user_id,
                    "user_name": f.user_name,
                    "type": f.type,
                    "title": f.title,
                    "content": f.content,
                    "images": f.images,
                    "status": f.status,
                    "priority": f.priority,
                    "contact_info": f.contact_info,
                    "app_version": f.app_version,
                    "device_info": f.device_info,
                    "handle_user": f.handle_user,
                    "handle_remark": f.handle_remark,
                    "handle_time": f.handle_time.isoformat() if f.handle_time else None,
                    "reply": f.reply,
                    "reply_time": f.reply_time.isoformat() if f.reply_time else None,
                    "rating": f.rating,
                }
            )
        except Exception as e:
            logger.error(f"feedback get error: {e}")
            return error(str(e))


@router.put("/{fid}/handle", summary="处理反馈")
def handle_feedback(
    fid: int,
    status: int = Query(...),
    remark: str | None = None,
    priority: int | None = None,
    reply: str | None = None,
):
    with get_session() as db:
        try:
            f = db.query(Feedback).filter(Feedback.id == fid).first()
            if not f:
                return error("反馈不存在", "404")
            f.status = status
            f.handle_user = "admin"
            f.handle_time = utcnow()
            if remark:
                f.handle_remark = remark
            if priority is not None:
                f.priority = priority
            if reply:
                f.reply = reply
                f.reply_time = utcnow()
            return success()
        except Exception as e:
            logger.error(f"feedback handle error: {e}")
            return error(str(e))


@router.post("/{fid}/rate", summary="评价反馈")
def rate_feedback(fid: int, rating: int = Query(..., ge=1, le=5)):
    with get_session() as db:
        try:
            f = db.query(Feedback).filter(Feedback.id == fid).first()
            if not f:
                return error("反馈不存在", "404")
            f.rating = rating
            return success()
        except Exception as e:
            logger.error(f"feedback rate error: {e}")
            return error(str(e))


@router.delete("/{fid}", summary="删除反馈")
def delete_feedback(fid: int):
    with get_session() as db:
        try:
            f = db.query(Feedback).filter(Feedback.id == fid).first()
            if not f:
                return error("反馈不存在", "404")
            db.delete(f)
            return success()
        except Exception as e:
            logger.error(f"feedback delete error: {e}")
            return error(str(e))
