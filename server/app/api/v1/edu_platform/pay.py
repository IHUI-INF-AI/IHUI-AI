"""支付模块路由 - 迁移自旧 Java Spring Boot pay-service (2026-07-05).

包含: 发起支付/退款/支付宝回调/微信支付回调.
金额单位: 分 (cents), 与旧 Java 项目保持一致.
"""
import datetime as dt
import uuid

from fastapi import APIRouter, Body, Query, Request
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models import EduTrade
from app.schemas.common import error, success

router = APIRouter()


def _trade_to_dict(t: EduTrade) -> dict:
    return {
        "id": t.id,
        "trade_no": t.trade_no,
        "order_no": t.order_no,
        "user_id": t.user_id,
        "amount": t.amount,
        "pay_type": t.pay_type,
        "status": t.status,
        "pay_time": t.pay_time.isoformat() if t.pay_time else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _gen_trade_no() -> str:
    """生成交易号: 年月日时分秒 + uuid后6位."""
    now = dt.datetime.now()
    return now.strftime("%Y%m%d%H%M%S") + uuid.uuid4().hex[:6].upper()


@router.post("/auth-api/trade/payment", summary="发起支付")
async def trade_payment(
    userId: int = Body(..., embed=True, description="用户id"),
    amount: int = Body(..., ge=1, embed=True, description="金额(分)"),
    payType: str = Body("alipay", embed=True, description="alipay/wechat"),
    orderNo: str | None = Body(None, embed=True, description="订单号"),
):
    with get_session() as db:
        try:
            trade_no = _gen_trade_no()
            t = EduTrade(
                trade_no=trade_no,
                order_no=orderNo,
                user_id=userId,
                amount=amount,
                pay_type=payType,
                status=0,
            )
            db.add(t)
            db.flush()
            return success(
                {
                    "id": t.id,
                    "trade_no": t.trade_no,
                    "amount": t.amount,
                    "pay_type": t.pay_type,
                    "status": t.status,
                }
            )
        except Exception as e:
            logger.error(f"[edu pay] trade payment error: {e}")
            return error(str(e))


@router.post("/trade/refund", summary="退款")
async def trade_refund(
    tradeNo: str = Body(..., embed=True, description="交易号"),
):
    with get_session() as db:
        try:
            t = db.query(EduTrade).filter(EduTrade.trade_no == tradeNo).first()
            if not t:
                return error("交易不存在", "404")
            if t.status != 1:
                return error("交易未支付, 无法退款", "400")
            t.status = 2
            return success(_trade_to_dict(t))
        except Exception as e:
            logger.error(f"[edu pay] trade refund error: {e}")
            return error(str(e))


@router.post("/public-api/alipay/notify", summary="支付宝回调")
async def alipay_notify(request: Request):
    with get_session() as db:
        try:
            form = await request.form()
            trade_no = form.get("out_trade_no") or form.get("trade_no") or ""
            trade_status = form.get("trade_status") or ""
            if not trade_no:
                return error("缺少交易号", "400")
            t = db.query(EduTrade).filter(EduTrade.trade_no == trade_no).first()
            if not t:
                return error("交易不存在", "404")
            if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
                t.status = 1
                t.pay_time = dt.datetime.utcnow()
            return success({"trade_no": trade_no, "status": t.status})
        except Exception as e:
            logger.error(f"[edu pay] alipay notify error: {e}")
            return error(str(e))


@router.post("/public-api/wechatpay/notify", summary="微信支付回调")
async def wechatpay_notify(request: Request):
    with get_session() as db:
        try:
            import json

            body = await request.body()
            data = json.loads(body) if body else {}
            trade_no = data.get("out_trade_no", "")
            result_code = data.get("result_code", "")
            if not trade_no:
                return error("缺少交易号", "400")
            t = db.query(EduTrade).filter(EduTrade.trade_no == trade_no).first()
            if not t:
                return error("交易不存在", "404")
            if result_code == "SUCCESS":
                t.status = 1
                t.pay_time = dt.datetime.utcnow()
            return success({"trade_no": trade_no, "status": t.status})
        except Exception as e:
            logger.error(f"[edu pay] wechatpay notify error: {e}")
            return error(str(e))
