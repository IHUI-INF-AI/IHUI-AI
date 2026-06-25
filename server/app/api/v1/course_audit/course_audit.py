"""课程审核"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Boolean, Column, DateTime, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow


class CourseAudit(TimestampMixin, Base):
    __tablename__ = "course_audit"
    __table_args__ = (
        Index("idx_ca_course", "course_id"),
        Index("idx_ca_status", "status"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    course_id = Column(BigInteger, nullable=False, comment="课程ID")
    course_title = Column(String(200), nullable=True)
    user_id = Column(String(64), nullable=False, comment="提交者")
    user_name = Column(String(100), nullable=True)
    status = Column(Integer, default=0, comment="0=待审核 1=通过 2=拒绝 3=下架")
    audit_user = Column(String(64), nullable=True, comment="审核人")
    audit_time = Column(DateTime, nullable=True, comment="审核时间")
    audit_remark = Column(Text, nullable=True, comment="审核意见")
    reject_reason = Column(String(500), nullable=True)
    score = Column(Integer, default=0, comment="审核评分")
    is_final = Column(Boolean, default=False, comment="是否终审")


router = APIRouter()


@router.post("/submit", operation_id="course_audit_submit", summary="提交课程审核")
def submit(course_id: int = Query(...), course_title: str | None = None):
    with get_session() as db:
        try:
            a = CourseAudit(
                course_id=course_id, course_title=course_title,
                user_id="guest", user_name="匿名用户", status=0,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"course audit submit error: {e}")
            return error(str(e))


@router.get("/list", summary="审核列表")
def list_audits(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
                       status: int | None = None, course_id: int | None = None):
    with get_session() as db:
        try:
            q = db.query(CourseAudit)
            if status is not None:
                q = q.filter(CourseAudit.status == status)
            if course_id:
                q = q.filter(CourseAudit.course_id == course_id)
            total = q.count()
            items = q.order_by(CourseAudit.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([{
                "id": a.id, "course_id": a.course_id, "course_title": a.course_title,
                "user_id": a.user_id, "user_name": a.user_name, "status": a.status,
                "audit_user": a.audit_user, "audit_time": a.audit_time.isoformat() if a.audit_time else None,
                "audit_remark": a.audit_remark, "reject_reason": a.reject_reason,
                "score": a.score, "is_final": a.is_final,
                "create_time": a.created_at.isoformat() if a.created_at else None,
            } for a in items], total=total)
        except Exception as e:
            logger.error(f"course audit list error: {e}")
            return error(str(e))


@router.get("/{aid}", summary="审核详情")
def get_audit(aid: int):
    with get_session() as db:
        try:
            a = db.query(CourseAudit).filter(CourseAudit.id == aid).first()
            if not a:
                return error("审核记录不存在", "404")
            return success({
                "id": a.id, "course_id": a.course_id, "course_title": a.course_title,
                "user_id": a.user_id, "user_name": a.user_name, "status": a.status,
                "audit_user": a.audit_user, "audit_time": a.audit_time.isoformat() if a.audit_time else None,
                "audit_remark": a.audit_remark, "reject_reason": a.reject_reason,
                "score": a.score, "is_final": a.is_final,
            })
        except Exception as e:
            logger.error(f"course audit get error: {e}")
            return error(str(e))


@router.put("/{aid}/audit", summary="审核操作")
def audit_course(aid: int, status: int = Query(..., ge=1, le=3),
                        remark: str | None = None, score: int = 0, is_final: bool = False):
    with get_session() as db:
        try:
            a = db.query(CourseAudit).filter(CourseAudit.id == aid).first()
            if not a:
                return error("审核记录不存在", "404")
            a.status = status
            a.audit_user = "admin"
            a.audit_time = utcnow()
            a.audit_remark = remark
            a.score = score
            a.is_final = is_final
            return success()
        except Exception as e:
            logger.error(f"course audit error: {e}")
            return error(str(e))
