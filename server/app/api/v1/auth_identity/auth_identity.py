"""实名认证"""

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String

from app.core.current_user import current_user_id_or_guest
from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success
from app.utils.datetime_helper import utcnow


class AuthIdentity(TimestampMixin, Base):
    """实名认证"""

    __tablename__ = "auth_identity"
    __table_args__ = (
        Index("idx_ai_user", "user_id"),
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False)
    real_name = Column(String(50), nullable=False, comment="真实姓名")
    id_card = Column(String(20), nullable=False, comment="身份证号")
    id_card_front = Column(String(500), nullable=True, comment="身份证正面")
    id_card_back = Column(String(500), nullable=True, comment="身份证反面")
    phone = Column(String(20), nullable=True)
    status = Column(Integer, default=0, comment="0=待审核 1=已通过 2=已拒绝 3=已过期")
    audit_user = Column(String(64), nullable=True)
    audit_time = Column(DateTime, nullable=True)
    audit_remark = Column(String(500), nullable=True)
    expire_time = Column(DateTime, nullable=True, comment="过期时间")
    type = Column(Integer, default=1, comment="1=个人 2=企业")


router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()

def _mask_id_card(id_card: str) -> str:
    """身份证号脱敏"""
    if not id_card or len(id_card) < 8:
        return id_card
    return id_card[:4] + "*" * (len(id_card) - 8) + id_card[-4:]


@router.post("/submit", operation_id="auth_identity_submit", summary="提交实名认证")
async def submit(
    real_name: str = Query(..., min_length=2, max_length=50),
    id_card: str = Query(..., min_length=15, max_length=20),
    phone: str | None = None,
    id_card_front: str | None = None,
    id_card_back: str | None = None,
    type: int = 1,
):
    with get_session() as db:
        try:
            uid = _uid()
            exist = db.query(AuthIdentity).filter(AuthIdentity.user_id == uid).first()
            if exist and exist.status in (0, 1):
                return error("已存在认证记录", "400")
            if exist:
                db.delete(exist)
                db.flush()
            a = AuthIdentity(
                user_id=uid,
                real_name=real_name,
                id_card=id_card,
                phone=phone,
                id_card_front=id_card_front,
                id_card_back=id_card_back,
                type=type,
                status=0,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id, "status": 0})
        except Exception as e:
            logger.error(f"auth identity submit error: {e}")
            return error(str(e))


@router.get("/my", summary="我的认证")
async def my_identity():
    with get_session() as db:
        try:
            a = db.query(AuthIdentity).filter(AuthIdentity.user_id == _uid()).first()
            if not a:
                return success(None)
            return success(
                {
                    "id": a.id,
                    "real_name": a.real_name,
                    "id_card": _mask_id_card(a.id_card),
                    "phone": a.phone,
                    "status": a.status,
                    "audit_remark": a.audit_remark,
                    "audit_time": a.audit_time.isoformat() if a.audit_time else None,
                    "expire_time": a.expire_time.isoformat() if a.expire_time else None,
                    "type": a.type,
                }
            )
        except Exception as e:
            logger.error(f"my identity error: {e}")
            return error(str(e))


@router.get("/list", summary="认证列表(管理员)")
async def list_identities(
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), status: int | None = None
):
    with get_session() as db:
        try:
            q = db.query(AuthIdentity)
            if status is not None:
                q = q.filter(AuthIdentity.status == status)
            total = q.count()
            items = q.order_by(AuthIdentity.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": a.id,
                        "user_id": a.user_id,
                        "real_name": a.real_name,
                        "id_card": _mask_id_card(a.id_card),
                        "phone": a.phone,
                        "status": a.status,
                        "type": a.type,
                        "audit_time": a.audit_time.isoformat() if a.audit_time else None,
                        "create_time": a.created_at.isoformat() if a.created_at else None,
                    }
                    for a in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"identity list error: {e}")
            return error(str(e))


@router.put("/{aid}/audit", summary="审核认证")
async def audit(aid: int, status: int = Query(..., ge=1, le=3), remark: str | None = None, expire_days: int = 365):
    with get_session() as db:
        try:
            a = db.query(AuthIdentity).filter(AuthIdentity.id == aid).first()
            if not a:
                return error("认证记录不存在", "404")
            a.status = status
            a.audit_user = "admin"
            a.audit_time = datetime.utcnow()
            a.audit_remark = remark
            if status == 1:
                a.expire_time = datetime.utcnow() + __import__("datetime").timedelta(days=expire_days)
            return success()
        except Exception as e:
            logger.error(f"identity audit error: {e}")
            return error(str(e))
