# Alipay fund payment endpoints -- create pay order, async notify, sync return.
# Ported from P2 FundAliPayController.java

import time

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse
from loguru import logger

from app.security import require_login
from app.utils.alipay_util import create_pay_order, verify_alipay_signature

router = APIRouter(tags=["Alipay Fund"])


@router.post("/create")
async def create_pay(request: Request, user_uuid: str = Depends(require_login)):
    # Create Alipay payment order
    body = await request.json()
    desc = body.get("desc", "Product purchase")
    amount = body.get("amount", 0)
    product_id = body.get("id")
    product_type = body.get("productType", 1)
    if not amount or amount <= 0:
        return {"code": "400", "msg": "Invalid amount"}

    order_id = "ORDER_" + str(int(time.time() * 1000))
    try:
        pay_form = await create_pay_order(order_id, desc, amount, product_id, product_type)
        return pay_form
    except Exception as e:
        logger.error("Create pay error: " + str(e))
        return {"code": "500", "msg": str(e)}


@router.post("/create2")
async def create_pay_json(request: Request, user_uuid: str = Depends(require_login)):
    # Create Alipay payment order, return JSON instead of HTML
    body = await request.json()
    desc = body.get("desc", "Product purchase")
    amount = body.get("amount", 0)
    product_id = body.get("id")
    product_type = body.get("productType", 1)
    if not amount or amount <= 0:
        return {"code": "400", "msg": "Invalid amount"}

    order_id = "ORDER_" + str(int(time.time() * 1000))
    try:
        pay_form = await create_pay_order(order_id, desc, amount, product_id, product_type)
        return {
            "code": "200",
            "msg": "success",
            "data": {"pay_form": pay_form, "order_id": order_id},
        }
    except Exception as e:
        logger.error("Create pay2 error: " + str(e))
        return {"code": "500", "msg": str(e)}


@router.post("/alipay/notify", operation_id="alipay_fund_notify")
async def alipay_notify(request: Request):
    # Alipay async callback (core endpoint)
    try:
        form = await request.form()
        params = dict(form)
        logger.info("Alipay notify received, trade_no=" + params.get("trade_no", ""))  # type: ignore[operator]
        # Verify signature
        verified = await verify_alipay_signature(params)
        if not verified:
            logger.warning("Alipay signature verification failed")
            return "fail"
        trade_status = params.get("trade_status", "")
        if trade_status != "TRADE_SUCCESS":
            logger.warning("Trade status: " + trade_status)  # type: ignore[operator]
            return "fail"
        out_trade_no = params.get("out_trade_no", "")
        trade_no = params.get("trade_no", "")
        total_amount = params.get("total_amount", "0")
        # Check idempotency
        from sqlalchemy import text

        from app.database import get_session

        with get_session() as db:
            # 注意: 字段名是 out_trade_no, 不是 order_no
            existing = db.execute(
                text("SELECT id FROM zhs_order WHERE out_trade_no = :no AND status = 1"),
                {"no": out_trade_no},
            ).fetchone()
            if existing:
                return "success"
            db.execute(
                text("UPDATE zhs_order SET status = 1, trade_no = :tn, amount = :ta WHERE out_trade_no = :no"),
                {"tn": trade_no, "ta": total_amount, "no": out_trade_no},
            )
            return "success"
    except Exception as e:
        logger.error("Alipay notify error: " + str(e))
        return "fail"


@router.get("/alipay/return")
async def alipay_return(request: Request):
    # Alipay sync return (user browser redirect)
    try:
        params = dict(request.query_params)

        verified = await verify_alipay_signature(params)
        if verified and params.get("trade_status") == "TRADE_SUCCESS":
            return RedirectResponse(url="/pay/success?orderNo=" + params.get("out_trade_no", ""))
        return RedirectResponse(url="/pay/fail")
    except Exception as e:
        logger.error("Alipay return error: " + str(e))
        return RedirectResponse(url="/pay/fail")


@router.get("/success")
async def pay_success(orderNo: str = Query("", description="order number")):
    return {"code": "200", "msg": "Payment success", "data": {"orderNo": orderNo}}


@router.get("/fail")
async def pay_fail():
    return {"code": "500", "msg": "Payment failed, please retry"}
