"""外呼回调 - 外部系统回调处理"""

from datetime import datetime

from fastapi import APIRouter, Body, Request
from loguru import logger
from sqlalchemy import BigInteger, Column, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class CallBackLog(TimestampMixin, Base):
    """外呼回调日志"""

    __tablename__ = "callback_log"
    __table_args__ = (
        Index("idx_cbl_biz", "biz_type"),
        Index("idx_cbl_time", "created_at"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    biz_type = Column(String(50), nullable=False, comment="业务类型: call/sms/payment/...")
    biz_id = Column(String(64), nullable=True, comment="业务ID")
    source = Column(String(50), nullable=True, comment="来源系统")
    request_body = Column(Text, nullable=True, comment="请求体")
    response_body = Column(Text, nullable=True, comment="响应体")
    status = Column(Integer, default=1, comment="0=失败 1=成功")
    error_msg = Column(String(500), nullable=True)
    ip = Column(String(50), nullable=True)
    process_time = Column(Integer, default=0, comment="处理耗时(毫秒)")


router = APIRouter()


@router.post("/call", summary="外呼回调")
async def call_callback(
    request: Request,
    biz_id: str | None = None,
    biz_type: str = "call",
    source: str | None = None,
    payload: dict = Body(default_factory=dict, embed=True),
):
    with get_session() as db:
        try:
            start = datetime.utcnow()
            body = await request.body()
            ip = request.client.host if request.client else None
            log = CallBackLog(
                biz_type=biz_type,
                biz_id=biz_id,
                source=source,
                request_body=body.decode("utf-8") if body else "",
                status=1,
                ip=ip,
            )
            db.add(log)
            db.flush()
            log.response_body = '{"code":0,"message":"ok"}'
            log.process_time = int((datetime.utcnow() - start).total_seconds() * 1000)
            return success({"callback_id": log.id})
        except Exception as e:
            logger.error(f"call callback error: {e}")
            return error(str(e))


@router.post("/sms", summary="短信回调")
async def sms_callback(
    request: Request, biz_id: str | None = None, payload: dict = Body(default_factory=dict, embed=True)
):
    return await call_callback(request, biz_id=biz_id, biz_type="sms", source="sms", payload=payload)


@router.post("/payment", summary="支付回调")
async def payment_callback(
    request: Request, biz_id: str | None = None, payload: dict = Body(default_factory=dict, embed=True)
):
    return await call_callback(request, biz_id=biz_id, biz_type="payment", source="payment", payload=payload)


@router.get("/log/list", operation_id="callback_log_list", summary="回调日志")
async def log_list(
    page: int = 1,
    limit: int = 20,
    biz_type: str | None = None,
    source: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CallBackLog)
            if biz_type:
                q = q.filter(CallBackLog.biz_type == biz_type)
            if source:
                q = q.filter(CallBackLog.source == source)
            if status is not None:
                q = q.filter(CallBackLog.status == status)
            total = q.count()
            items = q.order_by(CallBackLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "biz_type": l.biz_type,
                        "biz_id": l.biz_id,
                        "source": l.source,
                        "status": l.status,
                        "error_msg": l.error_msg,
                        "ip": l.ip,
                        "process_time": l.process_time,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"callback log error: {e}")
            return error(str(e))


@router.get("/log/{lid}", summary="回调详情")
async def log_detail(lid: int):
    with get_session() as db:
        try:
            l = db.query(CallBackLog).filter(CallBackLog.id == lid).first()
            if not l:
                return error("日志不存在", "404")
            return success(
                {
                    "id": l.id,
                    "biz_type": l.biz_type,
                    "biz_id": l.biz_id,
                    "source": l.source,
                    "request_body": l.request_body,
                    "response_body": l.response_body,
                    "status": l.status,
                    "error_msg": l.error_msg,
                    "ip": l.ip,
                    "process_time": l.process_time,
                    "create_time": l.created_at.isoformat() if l.created_at else None,
                }
            )
        except Exception as e:
            logger.error(f"callback log detail error: {e}")
            return error(str(e))
