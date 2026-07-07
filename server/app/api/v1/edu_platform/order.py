"""订单模块路由 - 迁移自旧 Java Spring Boot order-service (2026-07-06).

包含: 课程订单/会员卡订单/支付/退款/发票管理/通用订单.
订单状态: pending(待支付)/paid(已支付)/cancelled(已取消)/refunded(已退款).
支付状态: created/paying/paid/failed/cancelled.
退款状态: pending/approved/rejected/processing/completed/failed.
发票申请状态: pending/approved/rejected/invoicing/invoiced/canceled.
"""
import datetime as dt
import uuid

from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduInvoiceApplication,
    EduInvoiceTitle,
    EduOrder,
    EduPayment,
    EduRefund,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


def _gen_order_no() -> str:
    """生成订单号: EDU + 年月日时分秒 + uuid后6位."""
    now = dt.datetime.now()
    return "EDU" + now.strftime("%Y%m%d%H%M%S") + uuid.uuid4().hex[:6].upper()


def _gen_payment_no() -> str:
    """生成支付号: PAY + 年月日时分秒 + uuid后6位."""
    now = dt.datetime.now()
    return "PAY" + now.strftime("%Y%m%d%H%M%S") + uuid.uuid4().hex[:6].upper()


def _order_to_dict(o: EduOrder) -> dict:
    return {
        "id": o.id,
        "order_no": o.order_no,
        "member_id": o.member_id,
        "order_type": o.order_type,
        "target_id": o.target_id,
        "target_title": o.target_title,
        "quantity": o.quantity,
        "original_price": o.original_price,
        "discount_amount": o.discount_amount,
        "pay_amount": o.pay_amount,
        "pay_type": o.pay_type,
        "status": o.status,
        "pay_time": o.pay_time.isoformat() if o.pay_time else None,
        "cancel_time": o.cancel_time.isoformat() if o.cancel_time else None,
        "refund_time": o.refund_time.isoformat() if o.refund_time else None,
        "remark": o.remark,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
    }


def _payment_to_dict(p: EduPayment) -> dict:
    return {
        "id": p.id,
        "payment_no": p.payment_no,
        "order_id": p.order_id,
        "order_type": p.order_type,
        "member_id": p.member_id,
        "pay_type": p.pay_type,
        "pay_amount": p.pay_amount,
        "pay_url": p.pay_url,
        "status": p.status,
        "pay_time": p.pay_time.isoformat() if p.pay_time else None,
        "third_party_no": p.third_party_no,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _refund_to_dict(r: EduRefund) -> dict:
    return {
        "id": r.id,
        "order_id": r.order_id,
        "order_type": r.order_type,
        "order_no": r.order_no,
        "member_id": r.member_id,
        "reason": r.reason,
        "refund_amount": r.refund_amount,
        "refund_type": r.refund_type,
        "status": r.status,
        "apply_time": r.apply_time.isoformat() if r.apply_time else None,
        "process_time": r.process_time.isoformat() if r.process_time else None,
        "complete_time": r.complete_time.isoformat() if r.complete_time else None,
        "process_message": r.process_message,
        "handle_message": r.handle_message,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _invoice_app_to_dict(a: EduInvoiceApplication) -> dict:
    return {
        "id": a.id,
        "order_id": a.order_id,
        "member_id": a.member_id,
        "invoice_type": a.invoice_type,
        "title_id": a.title_id,
        "amount": a.amount,
        "email": a.email,
        "status": a.status,
        "remark": a.remark,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _invoice_title_to_dict(t: EduInvoiceTitle) -> dict:
    return {
        "id": t.id,
        "member_id": t.member_id,
        "title_type": t.title_type,
        "title": t.title,
        "tax_no": t.tax_no,
        "bank": t.bank,
        "bank_account": t.bank_account,
        "address": t.address,
        "phone": t.phone,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


# ---------------------------------------------------------------------------
# 课程订单
# ---------------------------------------------------------------------------


@router.post("/auth-api/course-order", summary="创建课程订单")
async def create_course_order(
    member_id: int = Body(..., description="会员id"),
    target_id: int = Body(..., description="课程id"),
    target_title: str | None = Body(None, max_length=200),
    quantity: int = Body(1, ge=1),
    original_price: float = Body(0, ge=0),
    discount_amount: float = Body(0, ge=0),
    pay_amount: float = Body(0, ge=0),
    pay_type: str | None = Body(None, max_length=50),
    remark: str | None = Body(None, max_length=500),
):
    with get_session() as db:
        try:
            o = EduOrder(
                order_no=_gen_order_no(),
                member_id=member_id,
                order_type="course",
                target_id=target_id,
                target_title=target_title,
                quantity=quantity,
                original_price=original_price,
                discount_amount=discount_amount,
                pay_amount=pay_amount,
                pay_type=pay_type,
                status="pending",
                remark=remark,
            )
            db.add(o)
            db.flush()
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] create course order error: {e}")
            return error(str(e))


@router.put("/auth-api/course-order/cancel", summary="取消课程订单")
async def cancel_course_order(
    id: int = Body(..., embed=True, description="订单id"),
):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(
                EduOrder.id == id, EduOrder.order_type == "course"
            ).first()
            if not o:
                return error("订单不存在", "404")
            if o.status != "pending":
                return error("订单状态不允许取消", "400")
            o.status = "cancelled"
            o.cancel_time = dt.datetime.utcnow()
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] cancel course order error: {e}")
            return error(str(e))


@router.get("/auth-api/course-order", summary="课程订单详情")
async def get_course_order(id: int = Query(..., description="订单id")):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(
                EduOrder.id == id, EduOrder.order_type == "course"
            ).first()
            if not o:
                return error("订单不存在", "404")
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] get course order error: {e}")
            return error(str(e))


@router.get("/auth-api/course-order/list", summary="用户课程订单列表")
async def course_order_list(
    member_id: int = Query(..., description="会员id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduOrder).filter(
                EduOrder.member_id == member_id, EduOrder.order_type == "course"
            )
            if status:
                q = q.filter(EduOrder.status == status)
            total = q.count()
            items = (
                q.order_by(EduOrder.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] course order list error: {e}")
            return error(str(e))


@router.get("/admin-api/course-order/list", summary="管理员课程订单列表")
async def admin_course_order_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    member_id: int | None = None,
    order_no: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduOrder).filter(EduOrder.order_type == "course")
            if status:
                q = q.filter(EduOrder.status == status)
            if member_id:
                q = q.filter(EduOrder.member_id == member_id)
            if order_no:
                q = q.filter(EduOrder.order_no.like(f"%{order_no}%"))
            total = q.count()
            items = (
                q.order_by(EduOrder.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] admin course order list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 会员卡订单
# ---------------------------------------------------------------------------


@router.post("/auth-api/card-order", summary="创建会员卡订单")
async def create_card_order(
    member_id: int = Body(..., description="会员id"),
    target_id: int = Body(..., description="会员卡id"),
    target_title: str | None = Body(None, max_length=200),
    quantity: int = Body(1, ge=1),
    original_price: float = Body(0, ge=0),
    discount_amount: float = Body(0, ge=0),
    pay_amount: float = Body(0, ge=0),
    pay_type: str | None = Body(None, max_length=50),
    remark: str | None = Body(None, max_length=500),
):
    with get_session() as db:
        try:
            o = EduOrder(
                order_no=_gen_order_no(),
                member_id=member_id,
                order_type="card",
                target_id=target_id,
                target_title=target_title,
                quantity=quantity,
                original_price=original_price,
                discount_amount=discount_amount,
                pay_amount=pay_amount,
                pay_type=pay_type,
                status="pending",
                remark=remark,
            )
            db.add(o)
            db.flush()
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] create card order error: {e}")
            return error(str(e))


@router.put("/auth-api/card-order/cancel", summary="取消会员卡订单")
async def cancel_card_order(
    id: int = Body(..., embed=True, description="订单id"),
):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(
                EduOrder.id == id, EduOrder.order_type == "card"
            ).first()
            if not o:
                return error("订单不存在", "404")
            if o.status != "pending":
                return error("订单状态不允许取消", "400")
            o.status = "cancelled"
            o.cancel_time = dt.datetime.utcnow()
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] cancel card order error: {e}")
            return error(str(e))


@router.get("/auth-api/card-order", summary="会员卡订单详情")
async def get_card_order(id: int = Query(..., description="订单id")):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(
                EduOrder.id == id, EduOrder.order_type == "card"
            ).first()
            if not o:
                return error("订单不存在", "404")
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] get card order error: {e}")
            return error(str(e))


@router.get("/auth-api/card-order/list", summary="用户会员卡订单列表")
async def card_order_list(
    member_id: int = Query(..., description="会员id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduOrder).filter(
                EduOrder.member_id == member_id, EduOrder.order_type == "card"
            )
            if status:
                q = q.filter(EduOrder.status == status)
            total = q.count()
            items = (
                q.order_by(EduOrder.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] card order list error: {e}")
            return error(str(e))


@router.get("/admin-api/card-order/list", summary="管理员会员卡订单列表")
async def admin_card_order_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    member_id: int | None = None,
    order_no: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduOrder).filter(EduOrder.order_type == "card")
            if status:
                q = q.filter(EduOrder.status == status)
            if member_id:
                q = q.filter(EduOrder.member_id == member_id)
            if order_no:
                q = q.filter(EduOrder.order_no.like(f"%{order_no}%"))
            total = q.count()
            items = (
                q.order_by(EduOrder.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] admin card order list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 支付
# ---------------------------------------------------------------------------


@router.post("/auth-api/payment/create", summary="创建支付")
async def create_payment(
    order_id: int = Body(..., description="订单id"),
    member_id: int = Body(..., description="会员id"),
    pay_type: str = Body("alipay", description="支付方式: alipay/wechat/balance"),
    pay_amount: float = Body(0, ge=0),
    pay_url: str | None = Body(None, max_length=500),
):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(EduOrder.id == order_id).first()
            if not o:
                return error("订单不存在", "404")
            if o.status != "pending":
                return error("订单状态不允许支付", "400")
            p = EduPayment(
                payment_no=_gen_payment_no(),
                order_id=order_id,
                order_type=o.order_type,
                member_id=member_id,
                pay_type=pay_type,
                pay_amount=pay_amount or o.pay_amount,
                pay_url=pay_url,
                status="created",
            )
            db.add(p)
            db.flush()
            return success(_payment_to_dict(p))
        except Exception as e:
            logger.error(f"[edu order] create payment error: {e}")
            return error(str(e))


@router.get("/auth-api/payment/status", summary="查询支付状态")
async def payment_status(paymentId: int = Query(..., description="支付id")):
    with get_session() as db:
        try:
            p = db.query(EduPayment).filter(EduPayment.id == paymentId).first()
            if not p:
                return error("支付记录不存在", "404")
            return success(
                {
                    "id": p.id,
                    "payment_no": p.payment_no,
                    "status": p.status,
                    "pay_type": p.pay_type,
                    "pay_amount": p.pay_amount,
                    "pay_time": p.pay_time.isoformat() if p.pay_time else None,
                    "third_party_no": p.third_party_no,
                }
            )
        except Exception as e:
            logger.error(f"[edu order] payment status error: {e}")
            return error(str(e))


@router.put("/auth-api/payment/cancel", summary="取消支付")
async def cancel_payment(
    id: int = Body(..., embed=True, description="支付id"),
):
    with get_session() as db:
        try:
            p = db.query(EduPayment).filter(EduPayment.id == id).first()
            if not p:
                return error("支付记录不存在", "404")
            if p.status in ("paid", "cancelled"):
                return error("支付状态不允许取消", "400")
            p.status = "cancelled"
            return success(_payment_to_dict(p))
        except Exception as e:
            logger.error(f"[edu order] cancel payment error: {e}")
            return error(str(e))


@router.get("/auth-api/payment/list", summary="用户支付记录列表")
async def payment_list(
    member_id: int = Query(..., description="会员id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduPayment).filter(EduPayment.member_id == member_id)
            if status:
                q = q.filter(EduPayment.status == status)
            total = q.count()
            items = (
                q.order_by(EduPayment.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_payment_to_dict(p) for p in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] payment list error: {e}")
            return error(str(e))


@router.get("/admin-api/payment/list", summary="管理员支付记录列表")
async def admin_payment_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    member_id: int | None = None,
    order_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduPayment)
            if status:
                q = q.filter(EduPayment.status == status)
            if member_id:
                q = q.filter(EduPayment.member_id == member_id)
            if order_id:
                q = q.filter(EduPayment.order_id == order_id)
            total = q.count()
            items = (
                q.order_by(EduPayment.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_payment_to_dict(p) for p in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] admin payment list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 退款
# ---------------------------------------------------------------------------


@router.post("/auth-api/refund/apply", summary="申请退款")
async def apply_refund(
    order_id: int = Body(..., description="订单id"),
    member_id: int = Body(..., description="会员id"),
    reason: str | None = Body(None, max_length=500),
    refund_amount: float = Body(0, ge=0),
    refund_type: str = Body("original", description="退款方式: original/balance"),
):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(EduOrder.id == order_id).first()
            if not o:
                return error("订单不存在", "404")
            if o.status != "paid":
                return error("订单未支付, 无法退款", "400")
            r = EduRefund(
                order_id=order_id,
                order_type=o.order_type,
                order_no=o.order_no,
                member_id=member_id,
                reason=reason,
                refund_amount=refund_amount or o.pay_amount,
                refund_type=refund_type,
                status="pending",
                apply_time=dt.datetime.utcnow(),
            )
            db.add(r)
            db.flush()
            return success(_refund_to_dict(r))
        except Exception as e:
            logger.error(f"[edu order] apply refund error: {e}")
            return error(str(e))


@router.get("/auth-api/refund", summary="退款详情")
async def get_refund(id: int = Query(..., description="退款id")):
    with get_session() as db:
        try:
            r = db.query(EduRefund).filter(EduRefund.id == id).first()
            if not r:
                return error("退款记录不存在", "404")
            return success(_refund_to_dict(r))
        except Exception as e:
            logger.error(f"[edu order] get refund error: {e}")
            return error(str(e))


@router.get("/auth-api/refund/list", summary="用户退款列表")
async def refund_list(
    member_id: int = Query(..., description="会员id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduRefund).filter(EduRefund.member_id == member_id)
            if status:
                q = q.filter(EduRefund.status == status)
            total = q.count()
            items = (
                q.order_by(EduRefund.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_refund_to_dict(r) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] refund list error: {e}")
            return error(str(e))


@router.put("/admin-api/refund/process", summary="审核退款")
async def process_refund(
    id: int = Body(..., embed=True, description="退款id"),
    status: str = Body(..., embed=True, description="approved/rejected"),
    process_message: str | None = Body(None, embed=True, max_length=500),
):
    with get_session() as db:
        try:
            if status not in ("approved", "rejected"):
                return error("status 必须为 approved 或 rejected", "400")
            r = db.query(EduRefund).filter(EduRefund.id == id).first()
            if not r:
                return error("退款记录不存在", "404")
            r.status = status
            r.process_message = process_message
            r.process_time = dt.datetime.utcnow()
            return success(_refund_to_dict(r))
        except Exception as e:
            logger.error(f"[edu order] process refund error: {e}")
            return error(str(e))


@router.put("/admin-api/refund/handle", summary="处理退款")
async def handle_refund(
    id: int = Body(..., embed=True, description="退款id"),
    status: str = Body(..., embed=True, description="processing/completed/failed"),
    handle_message: str | None = Body(None, embed=True, max_length=500),
):
    with get_session() as db:
        try:
            if status not in ("processing", "completed", "failed"):
                return error("status 必须为 processing/completed/failed", "400")
            r = db.query(EduRefund).filter(EduRefund.id == id).first()
            if not r:
                return error("退款记录不存在", "404")
            r.status = status
            r.handle_message = handle_message
            if status == "completed":
                r.complete_time = dt.datetime.utcnow()
                # 同步更新订单状态为已退款
                o = db.query(EduOrder).filter(EduOrder.id == r.order_id).first()
                if o:
                    o.status = "refunded"
                    o.refund_time = dt.datetime.utcnow()
            return success(_refund_to_dict(r))
        except Exception as e:
            logger.error(f"[edu order] handle refund error: {e}")
            return error(str(e))


@router.get("/admin-api/refund/list", summary="管理员退款列表")
async def admin_refund_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    member_id: int | None = None,
    order_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduRefund)
            if status:
                q = q.filter(EduRefund.status == status)
            if member_id:
                q = q.filter(EduRefund.member_id == member_id)
            if order_id:
                q = q.filter(EduRefund.order_id == order_id)
            total = q.count()
            items = (
                q.order_by(EduRefund.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_refund_to_dict(r) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] admin refund list error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 发票管理 - 发票申请
# ---------------------------------------------------------------------------


@router.get("/invoice/application/list", summary="发票申请列表")
async def invoice_application_list(
    member_id: int | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(EduInvoiceApplication)
            if member_id:
                q = q.filter(EduInvoiceApplication.member_id == member_id)
            if status:
                q = q.filter(EduInvoiceApplication.status == status)
            total = q.count()
            items = (
                q.order_by(EduInvoiceApplication.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_invoice_app_to_dict(a) for a in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] invoice application list error: {e}")
            return error(str(e))


@router.post("/invoice/application", summary="创建发票申请")
async def create_invoice_application(
    member_id: int = Body(..., description="会员id"),
    order_id: int | None = Body(None, description="订单id"),
    invoice_type: str = Body("normal", description="normal/special"),
    title_id: int | None = Body(None, description="发票抬头id"),
    amount: float = Body(0, ge=0),
    email: str | None = Body(None, max_length=100),
    remark: str | None = Body(None, max_length=500),
):
    with get_session() as db:
        try:
            a = EduInvoiceApplication(
                member_id=member_id,
                order_id=order_id,
                invoice_type=invoice_type,
                title_id=title_id,
                amount=amount,
                email=email,
                status="pending",
                remark=remark,
            )
            db.add(a)
            db.flush()
            return success(_invoice_app_to_dict(a))
        except Exception as e:
            logger.error(f"[edu order] create invoice application error: {e}")
            return error(str(e))


@router.put("/invoice/application", summary="更新发票申请")
async def update_invoice_application(
    id: int = Body(...),
    invoice_type: str | None = Body(None),
    title_id: int | None = Body(None),
    amount: float | None = Body(None),
    email: str | None = Body(None),
    remark: str | None = Body(None),
    status: str | None = Body(None),
):
    with get_session() as db:
        try:
            a = db.query(EduInvoiceApplication).filter(EduInvoiceApplication.id == id).first()
            if not a:
                return error("发票申请不存在", "404")
            if invoice_type is not None:
                a.invoice_type = invoice_type
            if title_id is not None:
                a.title_id = title_id
            if amount is not None:
                a.amount = amount
            if email is not None:
                a.email = email
            if remark is not None:
                a.remark = remark
            if status is not None:
                a.status = status
            return success(_invoice_app_to_dict(a))
        except Exception as e:
            logger.error(f"[edu order] update invoice application error: {e}")
            return error(str(e))


@router.delete("/invoice/application", summary="删除发票申请")
async def delete_invoice_application(data: dict = Body(...)):
    with get_session() as db:
        try:
            nested = data.get("data")
            app_id = data.get("id") or (nested.get("id") if isinstance(nested, dict) else None)
            if not app_id:
                return error("缺少参数 id", "400")
            app_id = int(app_id)
            a = db.query(EduInvoiceApplication).filter(EduInvoiceApplication.id == app_id).first()
            if not a:
                return error("发票申请不存在", "404")
            db.delete(a)
            return success({"id": app_id})
        except Exception as e:
            logger.error(f"[edu order] delete invoice application error: {e}")
            return error(str(e))


def _change_invoice_application_status(status_value: str, label: str):
    """通用: 变更发票申请状态."""

    @router.post(f"/invoice/application/{status_value}", summary=f"发票申请-{label}")
    async def _change(
        id: int = Body(..., embed=True, description="发票申请id"),
    ):
        with get_session() as db:
            try:
                a = db.query(EduInvoiceApplication).filter(EduInvoiceApplication.id == id).first()
                if not a:
                    return error("发票申请不存在", "404")
                a.status = status_value
                return success(_invoice_app_to_dict(a))
            except Exception as e:
                logger.error(f"[edu order] invoice application {status_value} error: {e}")
                return error(str(e))

    return _change


_change_invoice_application_status("approved", "审核通过")
_change_invoice_application_status("rejected", "审核拒绝")
_change_invoice_application_status("invoicing", "开票中")
_change_invoice_application_status("invoiced", "已开票")
_change_invoice_application_status("canceled", "已取消")


# ---------------------------------------------------------------------------
# 发票管理 - 发票抬头
# ---------------------------------------------------------------------------


@router.get("/invoice/title/list", summary="发票抬头列表")
async def invoice_title_list(
    member_id: int = Query(..., description="会员id"),
    title_type: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduInvoiceTitle).filter(EduInvoiceTitle.member_id == member_id)
            if title_type:
                q = q.filter(EduInvoiceTitle.title_type == title_type)
            items = q.order_by(EduInvoiceTitle.id.desc()).all()
            return success([_invoice_title_to_dict(t) for t in items])
        except Exception as e:
            logger.error(f"[edu order] invoice title list error: {e}")
            return error(str(e))


@router.post("/invoice/title", summary="创建发票抬头")
async def create_invoice_title(
    member_id: int = Body(..., description="会员id"),
    title: str = Body(..., min_length=1, max_length=200),
    title_type: str = Body("personal", description="personal/company"),
    tax_no: str | None = Body(None, max_length=50),
    bank: str | None = Body(None, max_length=200),
    bank_account: str | None = Body(None, max_length=50),
    address: str | None = Body(None, max_length=500),
    phone: str | None = Body(None, max_length=20),
):
    with get_session() as db:
        try:
            t = EduInvoiceTitle(
                member_id=member_id,
                title=title,
                title_type=title_type,
                tax_no=tax_no,
                bank=bank,
                bank_account=bank_account,
                address=address,
                phone=phone,
            )
            db.add(t)
            db.flush()
            return success(_invoice_title_to_dict(t))
        except Exception as e:
            logger.error(f"[edu order] create invoice title error: {e}")
            return error(str(e))


@router.put("/invoice/title", summary="更新发票抬头")
async def update_invoice_title(
    id: int = Body(...),
    title: str | None = Body(None),
    title_type: str | None = Body(None),
    tax_no: str | None = Body(None),
    bank: str | None = Body(None),
    bank_account: str | None = Body(None),
    address: str | None = Body(None),
    phone: str | None = Body(None),
):
    with get_session() as db:
        try:
            t = db.query(EduInvoiceTitle).filter(EduInvoiceTitle.id == id).first()
            if not t:
                return error("发票抬头不存在", "404")
            if title is not None:
                t.title = title
            if title_type is not None:
                t.title_type = title_type
            if tax_no is not None:
                t.tax_no = tax_no
            if bank is not None:
                t.bank = bank
            if bank_account is not None:
                t.bank_account = bank_account
            if address is not None:
                t.address = address
            if phone is not None:
                t.phone = phone
            return success(_invoice_title_to_dict(t))
        except Exception as e:
            logger.error(f"[edu order] update invoice title error: {e}")
            return error(str(e))


@router.delete("/invoice/title", summary="删除发票抬头")
async def delete_invoice_title(data: dict = Body(...)):
    with get_session() as db:
        try:
            nested = data.get("data")
            title_id = data.get("id") or (nested.get("id") if isinstance(nested, dict) else None)
            if not title_id:
                return error("缺少参数 id", "400")
            title_id = int(title_id)
            t = db.query(EduInvoiceTitle).filter(EduInvoiceTitle.id == title_id).first()
            if not t:
                return error("发票抬头不存在", "404")
            db.delete(t)
            return success({"id": title_id})
        except Exception as e:
            logger.error(f"[edu order] delete invoice title error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 通用订单 (前端 index.ts orderApi)
# ---------------------------------------------------------------------------


@router.post("/order", summary="创建订单")
async def create_order(
    member_id: int = Body(..., description="会员id"),
    order_type: str = Body("course", description="course/card"),
    target_id: int | None = Body(None, description="目标id"),
    target_title: str | None = Body(None, max_length=200),
    quantity: int = Body(1, ge=1),
    original_price: float = Body(0, ge=0),
    discount_amount: float = Body(0, ge=0),
    pay_amount: float = Body(0, ge=0),
    pay_type: str | None = Body(None, max_length=50),
    remark: str | None = Body(None, max_length=500),
):
    with get_session() as db:
        try:
            o = EduOrder(
                order_no=_gen_order_no(),
                member_id=member_id,
                order_type=order_type,
                target_id=target_id,
                target_title=target_title,
                quantity=quantity,
                original_price=original_price,
                discount_amount=discount_amount,
                pay_amount=pay_amount,
                pay_type=pay_type,
                status="pending",
                remark=remark,
            )
            db.add(o)
            db.flush()
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] create order error: {e}")
            return error(str(e))


@router.post("/orders/{order_id}/cancel", summary="取消订单")
async def cancel_order(order_id: int):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(EduOrder.id == order_id).first()
            if not o:
                return error("订单不存在", "404")
            if o.status != "pending":
                return error("订单状态不允许取消", "400")
            o.status = "cancelled"
            o.cancel_time = dt.datetime.utcnow()
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] cancel order error: {e}")
            return error(str(e))


@router.post("/orders/{order_id}/refund", summary="退款")
async def refund_order(order_id: int):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(EduOrder.id == order_id).first()
            if not o:
                return error("订单不存在", "404")
            if o.status != "paid":
                return error("订单未支付, 无法退款", "400")
            r = EduRefund(
                order_id=order_id,
                order_type=o.order_type,
                order_no=o.order_no,
                member_id=o.member_id,
                refund_amount=o.pay_amount,
                refund_type="original",
                status="pending",
                apply_time=dt.datetime.utcnow(),
            )
            db.add(r)
            db.flush()
            return success(_refund_to_dict(r))
        except Exception as e:
            logger.error(f"[edu order] refund order error: {e}")
            return error(str(e))


@router.get("/orders/{order_id}", summary="订单详情")
async def get_order(order_id: int):
    with get_session() as db:
        try:
            o = db.query(EduOrder).filter(EduOrder.id == order_id).first()
            if not o:
                return error("订单不存在", "404")
            return success(_order_to_dict(o))
        except Exception as e:
            logger.error(f"[edu order] get order error: {e}")
            return error(str(e))


@router.get("/orders/me", summary="我的订单")
async def my_orders(
    member_id: int = Query(..., description="会员id"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    order_type: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduOrder).filter(EduOrder.member_id == member_id)
            if status:
                q = q.filter(EduOrder.status == status)
            if order_type:
                q = q.filter(EduOrder.order_type == order_type)
            total = q.count()
            items = (
                q.order_by(EduOrder.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu order] my orders error: {e}")
            return error(str(e))
