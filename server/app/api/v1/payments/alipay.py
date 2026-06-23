"""Alipay routes (RSA2 签名/验签)."""


import time

from fastapi import APIRouter, Depends, Query, Request
from loguru import logger

from app.core.tracking import (
    EVENT_ORDER_CREATE,
    EVENT_PAYMENT_CREATE,
    EVENT_PAYMENT_FAIL,
    EVENT_PAYMENT_SUCCESS,
    track_event,
    track_funnel,
    track_latency,
)
from app.metrics_business import BizTimer
from app.schemas.common import error, success
from app.security import require_login
from app.services.order_service import create_order, get_order, update_order_status
from app.utils import alipay_util as alipay

router = APIRouter()


@router.post("/create", summary="Create Alipay PC / H5 page pay")
async def create_alipay(
    amount: float = Query(..., description="金额(元)"),
    product_id: str = Query(None),
    order_type: int = Query(0),
    subject: str = Query("订单支付"),
    user_uuid: str = Depends(require_login),
):
    with BizTimer("biz:alipay:create", with_user=True):
        track_funnel("payment", "checkout_click", user_id=user_uuid, channel="alipay", amount=amount)
        t0 = time.perf_counter()
        amount_cents = round(amount * 100)
        result = create_order(user_uuid, amount_cents, order_type, product_id, pay_type="alipay")
        if not result["success"]:
            track_event(EVENT_PAYMENT_FAIL, user_id=user_uuid, channel="alipay", reason=result.get("msg"))
            return error(result["msg"])
        biz = {
            "out_trade_no": result["out_trade_no"],
            "total_amount": f"{amount:.2f}",
            "subject": subject,
            "product_code": "FAST_INSTANT_TRADE_PAY",
        }
        pay_url = alipay.build_signed_url(biz, method="alipay.trade.page.pay")
        out_trade_no = result["out_trade_no"]
        duration = time.perf_counter() - t0
        track_event(EVENT_ORDER_CREATE, user_id=user_uuid, out_trade_no=out_trade_no, amount=amount_cents)
        track_event(EVENT_PAYMENT_CREATE, user_id=user_uuid, out_trade_no=out_trade_no, channel="alipay", amount=amount_cents)
        track_funnel("payment", "pay_submit", user_id=user_uuid, channel="alipay", out_trade_no=out_trade_no)
        track_latency(EVENT_PAYMENT_CREATE, duration, user_id=user_uuid, channel="alipay")
        return success(
            {
                "out_trade_no": out_trade_no,
                "pay_url": pay_url,
                "amount": amount_cents,
            }
        )


@router.post("/app/create", summary="Create Alipay order for mobile app")
async def create_alipay_app(
    amount: float = Query(...),
    product_id: str = Query(None),
    order_type: int = Query(0),
    subject: str = Query("订单支付"),
    user_uuid: str = Depends(require_login),
):
    with BizTimer("biz:alipay:app_create", with_user=True):
        amount_cents = round(amount * 100)
        result = create_order(user_uuid, amount_cents, order_type, product_id, pay_type="alipay_app")
        if not result["success"]:
            return error(result["msg"])
        order_str = await alipay.app_pay_order(result["out_trade_no"], f"{amount:.2f}", subject)
        return success(
            {
                "out_trade_no": result["out_trade_no"],
                "amount": amount_cents,
                "order_str": order_str,
            }
        )


@router.post("/notify", summary="Alipay async callback (RSA2 verify)")
async def alipay_notify(request: Request):
    form = await request.form()
    params = dict(form.multi_items())
    if not alipay.verify_notify(dict(params)):
        logger.error("Alipay notify verify failed")
        track_event(EVENT_PAYMENT_FAIL, channel="alipay", reason="verify_failed")
        return "fail"
    out_trade_no = params.get("out_trade_no")
    trade_status = params.get("trade_status")
    if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED") and out_trade_no:
        order = get_order(out_trade_no)
        if not order:
            logger.error(f"Order not found: {out_trade_no}")
            return "fail"
        update_order_status(
            out_trade_no,
            status=1,
            payment_status=1,
            trade_no=params.get("trade_no"),
            paid_at=int(__import__("time").time() * 1000),
        )
        # 支付成功埋点
        try:
            total_amount = params.get("total_amount") or "0"
            track_event(
                EVENT_PAYMENT_SUCCESS,
                user_id=out_trade_no,
                channel="alipay",
                out_trade_no=out_trade_no,
                trade_no=params.get("trade_no") or "",
                amount=float(total_amount),
            )
            track_funnel("payment", "pay_success", out_trade_no=out_trade_no, channel="alipay")
        except Exception as e:
            logger.debug(f"payment success tracking failed: {e}")
        # After payment success, trigger commission feedback to referrers
        try:
            from app.services.commission_service import feedback_invite_by_order

            feedback_invite_by_order(out_trade_no)
        except Exception as e:
            logger.error(f"Commission feedback failed for {out_trade_no}: {e}")
    return "success"


@router.post("/query", summary="Query Alipay order")
async def alipay_query(out_trade_no: str = Query(...)):
    local = get_order(out_trade_no)
    if not local:
        return error("Order not found", "404")
    remote = await alipay.query_order(out_trade_no)
    return success({"local": local, "alipay": remote})


@router.post("/refund", summary="Alipay 退款(调用 alipay.trade.refund)")
async def alipay_refund(
    out_trade_no: str = Query(...),
    refund_amount: float = Query(..., description="退款金额(元)"),
    reason: str = Query("用户申请退款"),
):
    order = get_order(out_trade_no)
    if not order:
        return error("Order not found", "404")
    if order["status"] != 1:
        return error("Only paid orders can be refunded")
    remote = await alipay.refund_order(out_trade_no, f"{refund_amount:.2f}", reason)
    success_flag = remote.get("alipay_trade_refund_response", {}).get("code") == "10000"
    if success_flag:
        update_order_status(out_trade_no, status=2, payment_status=2)
    return success(
        {
            "out_trade_no": out_trade_no,
            "refund_amount": round(refund_amount * 100),
            "reason": reason,
            "alipay_response": remote,
            "success": success_flag,
        }
    )
