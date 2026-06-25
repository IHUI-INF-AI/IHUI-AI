"""Order management service."""

import logging
import random
import string
import time
from datetime import datetime

from app.database import SessionFactory1, get_session
from app.telemetry import trace_business
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)


def _gen_out_trade_no(prefix="WX"):
    chars = string.ascii_uppercase + string.digits
    rand_part = "".join(random.choices(chars, k=8))
    return f"{prefix}{rand_part}{int(time.time())}"


@trace_business("order.create", {"biz.type": "order", "biz.action": "create"})
def create_order(
    user_id,
    amount,
    order_type=0,
    product_id=None,
    pay_type="wechat",
    activity_id=None,
    product_identity_id=None,
    open_id=None,
) -> dict:
    with get_session(factory=SessionFactory1) as db:
        try:
            from app.models.payment_models import Order

            out_trade_no = _gen_out_trade_no("WX")
            order = Order(
                user_id=user_id,
                out_trade_no=out_trade_no,
                open_id=open_id,
                amount=amount,
                status=0,
                payment_status=0,
                order_type=order_type,
                product_id=product_id,
                pay_type=pay_type,
                activity_id=activity_id,
                product_identity_id=product_identity_id,
            )
            db.add(order)
            db.flush()
            return {"success": True, "out_trade_no": out_trade_no, "order_id": order.id}
        except Exception as e:
            logger.error(f"Create order error: {e}")
            return {"success": False, "msg": str(e)}


@trace_business("order.create_course", {"biz.type": "order", "biz.action": "create_course"})
def create_course_order(user_id, amount, product_type, product_id, pay_type="wechat_course") -> dict:
    """Create a course-related order."""
    with get_session() as db:
        try:
            from app.models.payment_models import Order

            out_trade_no = _gen_out_trade_no("COURSE")
            order = Order(
                user_id=user_id,
                out_trade_no=out_trade_no,
                amount=amount,
                status=0,
                payment_status=0,
                order_type=product_type,
                product_id=product_id,
                pay_type=pay_type,
            )
            db.add(order)
            db.flush()
            return {"success": True, "out_trade_no": out_trade_no, "order_id": order.id}
        except Exception as e:
            logger.error(f"Create course order error: {e}")
            return {"success": False, "msg": str(e)}


def get_order(out_trade_no: str) -> dict | None:
    with get_session() as db:
        from app.models.payment_models import Order

        order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
        if not order:
            return None
        return {
            "id": order.id,
            "user_id": order.user_id,
            "out_trade_no": order.out_trade_no,
            "amount": order.amount,
            "status": order.status,
            "payment_status": order.payment_status,
            "order_type": order.order_type,
            "product_id": order.product_id,
            "pay_type": order.pay_type,
            "created_at": str(order.created_at) if order.created_at else None,
            "paid_at": str(order.paid_at) if order.paid_at else None,
        }


@trace_business("order.update_status", {"biz.type": "order", "biz.action": "update_status"})
def update_order_status(out_trade_no, status, payment_status=None, trade_no=None) -> dict:
    with get_session() as db:
        try:
            from app.models.payment_models import Order

            order = db.query(Order).filter(Order.out_trade_no == out_trade_no).first()
            if not order:
                return {"success": False, "msg": "Order not found"}
            order.status = status
            if payment_status is not None:
                order.payment_status = payment_status
            if status == 1:
                order.paid_at = utcnow()
            return {"success": True}
        except Exception as e:
            logger.error(f"Update order status error: {e}")
            return {"success": False, "msg": str(e)}


def list_user_orders(user_id, page=1, limit=20) -> dict:
    with get_session() as db:
        from app.models.payment_models import Order

        q = db.query(Order).filter(Order.user_id == user_id).order_by(Order.id.desc())
        total = q.count()
        orders = q.offset((page - 1) * limit).limit(limit).all()
        return {
            "total": total,
            "page": page,
            "limit": limit,
            "orders": [
                {
                    "id": o.id,
                    "out_trade_no": o.out_trade_no,
                    "amount": o.amount,
                    "status": o.status,
                    "payment_status": o.payment_status,
                    "order_type": o.order_type,
                    "pay_type": o.pay_type,
                    "created_at": str(o.created_at) if o.created_at else None,
                }
                for o in orders
            ],
        }


def list_paid_orders_by_date(date_str: str) -> list:
    """List paid orders for a given date (yyyy-MM-dd)."""
    from datetime import time as dtime

    with get_session() as db:
        from app.models.payment_models import Order

        try:
            day = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return []
        start = datetime.combine(day, dtime.min)
        end = datetime.combine(day, dtime.max)
        orders = db.query(Order).filter(Order.status == 1, Order.created_at.between(start, end)).all()
        return [
            {"id": o.id, "out_trade_no": o.out_trade_no, "user_id": o.user_id, "amount": o.amount, "status": o.status}
            for o in orders
        ]
