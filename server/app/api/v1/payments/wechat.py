"""WeChat Pay V3 routes with idempotency protection."""

import json
import time

from fastapi import APIRouter, Depends, Header, Query, Request
from loguru import logger

from app.config import settings
from app.database import get_session
from app.metrics_business import BizTimer
from app.schemas.common import error, success
from app.security import require_login
from app.services.order_service import (
    create_course_order,
    create_order,
    get_order,
    update_order_status,
)
from app.utils import wechat_pay_util as wx
from app.utils.payment_idempotency import (
    check_payment_idempotency,
    mark_payment_failed,
    mark_payment_processed,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Internal utilities
# ---------------------------------------------------------------------------


def _parse_and_decrypt(
    body_str: str,
    wechatpay_serial: str,
    wechatpay_signature: str,
    wechatpay_timestamp: str,
    wechatpay_nonce: str,
) -> dict:
    """Parse and decrypt WeChat Pay callback body, returning decrypted fields.

    Matches Java WXPayNowServiceImpl.handleNotify flow:
    1. Verify signature using platform public key
    2. Decrypt resource.ciphertext with AES-256-GCM
    """
    # 1. Signature verification
    if wechatpay_timestamp and wechatpay_signature:
        if not wx.verify_callback_signature(wechatpay_timestamp, wechatpay_nonce, body_str, wechatpay_signature):
            raise ValueError("Signature verification failed")

    # 2. Decrypt resource
    envelope = json.loads(body_str)
    resource = envelope.get("resource", {})
    decrypted = wx.decrypt_callback(
        resource.get("ciphertext", ""),
        resource.get("nonce", ""),
        resource.get("associated_data", ""),
    )
    return decrypted


# ---------------------------------------------------------------------------
# JSAPI / Mini program payment
# ---------------------------------------------------------------------------


@router.post("/create", summary="Create WeChat Pay order (JSAPI / mini program)")
async def create_wx_pay(
    amount: int = Query(..., description="Amount in fen"),
    product_id: str = Query(None),
    order_type: int = Query(0, description="0=token,1=activity,2=identity,3=agent"),
    open_id: str = Query(..., description="WeChat openid"),
    description: str = Query("Purchase"),
    user_uuid: str = Depends(require_login),
):
    """Matches Java WXPayNowController.initiatePay + WXPayNowServiceImpl.pay."""
    with BizTimer("biz:wechat:create", with_user=True):
        result = create_order(
            user_uuid,
            amount,
            order_type,
            product_id,
            pay_type="wechat",
            activity_id=None,
            product_identity_id=None,
            open_id=open_id,
        )
        if not result["success"]:
            return error(result["msg"])
        out_trade_no = result["out_trade_no"]
        prepay = await wx.jsapi_prepay(open_id, amount, out_trade_no, description)
        if "prepay_id" not in prepay:
            return error(f"WeChat prepay failed: {prepay}")
        pay_sign = wx.build_jsapi_sign(prepay["prepay_id"])
        return success(
            {
                "out_trade_no": out_trade_no,
                **pay_sign,
                "amount": amount,
            }
        )


# ---------------------------------------------------------------------------
# Android APP payment
# ---------------------------------------------------------------------------


@router.post("/android/create", summary="Create WeChat Pay order (Android app)")
async def create_wx_pay_android(
    amount: int = Query(...),
    product_id: str = Query(None),
    order_type: int = Query(0),
    description: str = Query("Purchase"),
    user_uuid: str = Depends(require_login),
):
    """Matches Java PayManagementController.wxPay + PayAndroidServiceImpl.pay.

    Android uses APP payment API (not JSAPI), uses separate APP_ID,
    and notify URL is wx.app.notify (WX_ANDROID_NOTIFY_URL).
    """
    result = create_order(user_uuid, amount, order_type, product_id, pay_type="wechat_android")
    if not result["success"]:
        return error(result["msg"])
    out_trade_no = result["out_trade_no"]
    prepay = await wx.app_prepay(amount, out_trade_no, description)
    return success(
        {
            "out_trade_no": out_trade_no,
            "amount": amount,
            "prepay_data": prepay,
            "notify_url": settings.WX_ANDROID_NOTIFY_URL,
        }
    )


# ---------------------------------------------------------------------------
# Course payment
# ---------------------------------------------------------------------------


@router.post("/course/create", summary="Create WeChat Pay order (course)")
async def create_wx_pay_course(
    amount: int = Query(...),
    course_id: str = Query(...),
    user_uuid: str = Depends(require_login),
):
    """Create a course payment order."""
    result = create_course_order(user_uuid, amount, product_type=1, product_id=course_id)
    if not result["success"]:
        return error(result["msg"])
    out_trade_no = result["out_trade_no"]
    prepay = await wx.jsapi_prepay(None, amount, out_trade_no, "Course purchase")
    return success(
        {
            "out_trade_no": out_trade_no,
            **prepay,
            "amount": amount,
        }
    )


# ---------------------------------------------------------------------------
# Payment callbacks with idempotency protection
# ---------------------------------------------------------------------------


@router.post("/notify", summary="WeChat Pay V3 async callback")
async def wx_pay_notify(
    request: Request,
    wechatpay_serial: str = Header(None),
    wechatpay_signature: str = Header(None),
    wechatpay_timestamp: str = Header(None),
    wechatpay_nonce: str = Header(None),
):
    """WeChat Pay V3 callback with idempotency protection.

    This endpoint handles payment success notifications from WeChat Pay V3.
    Implements idempotency to prevent duplicate order status updates when
    WeChat retries the callback.
    """
    body_str = await request.body()
    body_str = body_str.decode("utf-8") if isinstance(body_str, bytes) else body_str

    try:
        # Parse and verify callback
        decrypted = _parse_and_decrypt(
            body_str,
            wechatpay_serial or "",
            wechatpay_signature or "",
            wechatpay_timestamp or "",
            wechatpay_nonce or "",
        )
    except ValueError as e:
        logger.error(f"WeChat notify parse error: {e}")
        return {"code": "FAIL", "message": str(e)}

    # Extract key fields
    out_trade_no = decrypted.get("out_trade_no", "")
    transaction_id = decrypted.get("transaction_id", "")
    trade_state = decrypted.get("trade_state", "")

    if not out_trade_no:
        logger.error("WeChat notify missing out_trade_no")
        return {"code": "FAIL", "message": "Missing order number"}

    logger.info(f"WeChat notify: out_trade_no={out_trade_no}, " f"transaction_id={transaction_id}, state={trade_state}")

    # Idempotency check
    idem_result = check_payment_idempotency(out_trade_no, transaction_id)

    if idem_result.status.value == "completed":
        # Already processed this callback
        logger.info(f"Duplicate WeChat callback ignored: {out_trade_no}")
        return {"code": "SUCCESS", "message": "Already processed"}

    if idem_result.status.value == "processing":
        # Another request is processing, return retry instruction
        logger.warning(f"Concurrent callback processing: {out_trade_no}")
        return {"code": "FAIL", "message": "Concurrent processing, retry later"}

    # Process the callback
    try:
        if trade_state == "SUCCESS":
            # Get order info for commission processing
            order = get_order(out_trade_no)
            if order and order["status"] != 1:
                # Amount verification: prevent forged low-amount payment
                callback_amount = None
                amount_obj = decrypted.get("amount")
                if isinstance(amount_obj, dict):
                    callback_amount = amount_obj.get("total")
                if callback_amount is None:
                    logger.error(
                        f"WeChat notify missing amount: {out_trade_no}, "
                        f"decrypted keys={list(decrypted.keys())}"
                    )
                    mark_payment_failed(out_trade_no, transaction_id, "Missing callback amount")
                    return {"code": "FAIL", "message": "Missing amount"}

                if int(callback_amount) != int(order["amount"]):
                    logger.error(
                        f"WeChat notify amount mismatch: {out_trade_no}, "
                        f"callback={callback_amount}, order={order['amount']}"
                    )
                    mark_payment_failed(out_trade_no, transaction_id, "Amount mismatch")
                    return {"code": "FAIL", "message": "Amount mismatch"}

                update_order_status(out_trade_no, status=1, payment_status=1)
                logger.info(f"Order paid: {out_trade_no}")

                # Trigger commission feedback (idempotent)
                try:
                    from app.services.commission_service import feedback_invite_by_order

                    feedback_invite_by_order(out_trade_no)
                except Exception as e:
                    logger.error(f"Commission feedback failed for {out_trade_no}: {e}")
            else:
                logger.info(f"Order already paid or not found: {out_trade_no}")

        # Mark as completed
        mark_payment_processed(
            out_trade_no, transaction_id, result={"status": trade_state, "processed_at": time.time()}
        )

        return {"code": "SUCCESS", "message": "OK"}

    except Exception as e:
        logger.error(f"WeChat notify processing error: {e}")
        mark_payment_failed(out_trade_no, transaction_id, str(e))
        return {"code": "FAIL", "message": str(e)}


@router.post("/notify/refund", summary="WeChat Pay refund callback")
async def wx_refund_notify(
    request: Request,
    wechatpay_serial: str = Header(None),
    wechatpay_signature: str = Header(None),
    wechatpay_timestamp: str = Header(None),
    wechatpay_nonce: str = Header(None),
):
    """WeChat Pay refund callback with idempotency protection."""
    body_str = await request.body()
    body_str = body_str.decode("utf-8") if isinstance(body_str, bytes) else body_str

    try:
        decrypted = _parse_and_decrypt(
            body_str,
            wechatpay_serial or "",
            wechatpay_signature or "",
            wechatpay_timestamp or "",
            wechatpay_nonce or "",
        )
    except ValueError as e:
        logger.error(f"WeChat refund notify parse error: {e}")
        return {"code": "FAIL", "message": str(e)}

    out_trade_no = decrypted.get("out_trade_no", "")
    refund_id = decrypted.get("refund_id", "")
    refund_status = decrypted.get("refund_status", "")

    if not out_trade_no:
        return {"code": "FAIL", "message": "Missing order number"}

    logger.info(f"WeChat refund notify: out_trade_no={out_trade_no}, " f"refund_id={refund_id}, status={refund_status}")

    # Idempotency check with refund-specific key
    idem_key = f"refund:{refund_id}"
    idem_result = check_payment_idempotency(out_trade_no, idem_key)

    if idem_result.status.value == "completed":
        logger.info(f"Duplicate refund callback ignored: {out_trade_no}")
        return {"code": "SUCCESS", "message": "Already processed"}

    try:
        if refund_status in ("SUCCESS", "CHANGE"):
            order = get_order(out_trade_no)
            if order:
                update_order_status(out_trade_no, status=2, payment_status=2)
                logger.info(f"Refund processed: {out_trade_no}")

        mark_payment_processed(
            out_trade_no, idem_key, result={"refund_status": refund_status, "processed_at": time.time()}
        )

        return {"code": "SUCCESS", "message": "OK"}

    except Exception as e:
        logger.error(f"Refund notify processing error: {e}")
        mark_payment_failed(out_trade_no, idem_key, str(e))
        return {"code": "FAIL", "message": str(e)}


@router.post("/notify/transfer", summary="WeChat Pay transfer callback")
async def wx_transfer_notify(
    request: Request,
    wechatpay_serial: str = Header(None),
    wechatpay_signature: str = Header(None),
    wechatpay_timestamp: str = Header(None),
    wechatpay_nonce: str = Header(None),
):
    """WeChat Pay transfer (withdrawal) callback with idempotency."""
    body_str = await request.body()
    body_str = body_str.decode("utf-8") if isinstance(body_str, bytes) else body_str

    try:
        decrypted = _parse_and_decrypt(
            body_str,
            wechatpay_serial or "",
            wechatpay_signature or "",
            wechatpay_timestamp or "",
            wechatpay_nonce or "",
        )
    except ValueError as e:
        logger.error(f"WeChat transfer notify parse error: {e}")
        return {"code": "FAIL", "message": str(e)}

    partner_trade_no = decrypted.get("out_batch_no") or decrypted.get("partner_trade_no", "")
    transfer_state = decrypted.get("transfer_state", "")
    mchid = decrypted.get("mchid", "")

    if not partner_trade_no:
        return {"code": "FAIL", "message": "Missing transfer number"}

    logger.info(f"WeChat transfer notify: trade_no={partner_trade_no}, state={transfer_state}")

    # Idempotency check
    idem_result = check_payment_idempotency(partner_trade_no, f"transfer:{mchid}")

    if idem_result.status.value == "completed":
        logger.info(f"Duplicate transfer callback ignored: {partner_trade_no}")
        return {"code": "SUCCESS", "message": "Already processed"}

    try:
        if partner_trade_no and transfer_state == "SUCCESS":
            from app.models.payment_models import WithdrawalFlow

            with get_session() as db1:
                flow = db1.query(WithdrawalFlow).filter(WithdrawalFlow.partner_trade_no == partner_trade_no).first()
                if flow:
                    flow.status = 2  # completed

        mark_payment_processed(
            partner_trade_no,
            f"transfer:{mchid}",
            result={"transfer_state": transfer_state, "processed_at": time.time()},
        )

        return {"code": "SUCCESS", "message": "OK"}

    except Exception as e:
        logger.error(f"Transfer notify processing error: {e}")
        mark_payment_failed(partner_trade_no, f"transfer:{mchid}", str(e))
        return {"code": "FAIL", "message": str(e)}


# ---------------------------------------------------------------------------
# Query / Close / Refund
# ---------------------------------------------------------------------------


@router.post("/query", summary="Query WeChat Pay order")
async def wx_pay_query(out_trade_no: str = Query(...)):
    local = get_order(out_trade_no)
    if not local:
        return error("Order not found", 404)
    remote = await wx.query_order(out_trade_no)
    return success({"local": local, "wechat": remote})


@router.post("/query/by-trade-no", summary="Query by merchant trade number")
async def query_by_trade_no(out_trade_no: str = Query(...)):
    """Query local order and WeChat payment status."""
    local = get_order(out_trade_no)
    if not local:
        return error("Order not found", 404)
    remote = await wx.query_order(out_trade_no)
    return success({"local": local, "wechat": remote})


@router.post("/close", summary="Close WeChat Pay order")
async def wx_pay_close(out_trade_no: str = Query(...)):
    """Matches Java WXPayNowServiceImpl.closeOrder -- updates status to 4 (closed)."""
    remote = await wx.close_order(out_trade_no)
    update_order_status(out_trade_no, status=4, payment_status=0)
    return success({"out_trade_no": out_trade_no, "wechat_response": remote, "closed": True})


@router.post("/refund", summary="Refund WeChat Pay order")
async def wx_pay_refund(
    out_trade_no: str = Query(...),
    refund_amount: int = Query(..., description="Refund amount in fen"),
    reason: str = Query("User requested refund"),
    user_uuid: str = Depends(require_login),
):
    """Matches Java WXPayNowServiceImpl.refunds.

    Note: Java refund code has a bug -- it calls setOutTradeNo(outRefundNo)
    overwriting the original out_trade_no. Python uses out_refund_no correctly.

    2026-06-25 安全加固: 退款是高风险操作, 必须登录, 并记录操作人
    """
    logger.bind(audit=True).info(
        f"[REFUND] wechat refund attempt: out_trade_no={out_trade_no}, "
        f"refund_amount={refund_amount}, reason={reason}, by={user_uuid}"
    )
    order = get_order(out_trade_no)
    if not order:
        return error("Order not found", 404)
    if order["status"] != 1:
        return error("Only paid orders can be refunded")

    refund_no = f"refund_{out_trade_no}"
    remote = await wx.refund(
        out_trade_no,
        refund_no,
        refund_amount,
        order["amount"],
        reason,
    )
    update_order_status(out_trade_no, status=2, payment_status=2)
    return success(
        {
            "out_trade_no": out_trade_no,
            "refund_no": refund_no,
            "wechat_response": remote,
        }
    )


@router.get("/status/{out_trade_no}", summary="Check payment status")
def check_status(out_trade_no: str):
    order = get_order(out_trade_no)
    if not order:
        return error("Order not found", 404)
    return success(order)


# ---------------------------------------------------------------------------
# Consecutive subscription products
# ---------------------------------------------------------------------------


@router.get("/consecutive/product", summary="Query consecutive subscription products")
def consecutive_product(user_uuid: str = Depends(require_login)):
    """Query consecutive subscription (monthly/annual) product list."""
    from app.models.app_content_models import ZhsProduct

    with get_session() as db1:
        products = (
            db1.query(ZhsProduct)
            .filter(ZhsProduct.type == "consecutive", ZhsProduct.status == 1)
            .order_by(ZhsProduct.sort.asc())
            .all()
        )
        return success(
            [
                {
                    "id": p.id,
                    "name": p.name,
                    "price": p.price,
                    "token_amount": p.token_amount,
                    "type": p.type,
                }
                for p in products
            ]
        )
