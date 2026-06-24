"""订单服务 - OrderItem / OrderPayment / InvoiceApplication / InvoiceTitle.

为 P0 补全的 4 张 edu_* 表提供基础 CRUD.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select

from app.database import get_session
from app.models.payment_models import (
    InvoiceApplication,
    InvoiceTitle,
    OrderItem,
    OrderPayment,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# OrderItem
# ---------------------------------------------------------------------------

def create_order_item(
    order_id: int,
    item_id: int,
    title: str | None = None,
    image: str | None = None,
    price: int = 0,
    quantity: int = 1,
    **kwargs: Any,
) -> OrderItem:
    """新增订单商品. price 单位为分."""
    with get_session() as db:
        item = OrderItem(
            order_id=order_id,
            item_id=item_id,
            title=title,
            image=image,
            price=price,
            original_price=kwargs.get("original_price", 0),
            quantity=quantity,
            payment_amount=kwargs.get("payment_amount", 0),
            discount_amount=kwargs.get("discount_amount", 0),
            total_amount=kwargs.get("total_amount", price * quantity),
        )
        db.add(item)
        db.flush()
        db.refresh(item)
        return item


def list_order_items(order_id: int) -> list[OrderItem]:
    """按 order_id 查所有 OrderItem."""
    with get_session() as db:
        return (
            db.query(OrderItem)
            .filter(OrderItem.order_id == order_id)
            .order_by(OrderItem.id.asc())
            .all()
        )


# ---------------------------------------------------------------------------
# OrderPayment
# ---------------------------------------------------------------------------

def create_order_payment(
    order_id: int,
    channel: str,
    amount: int,
) -> OrderPayment:
    """新增订单支付流水."""
    with get_session() as db:
        p = OrderPayment(
            order_id=order_id,
            channel=channel,
            amount=amount,
            status=0,  # 待支付
        )
        db.add(p)
        db.flush()
        db.refresh(p)
        return p


def update_order_payment_status(payment_id: str, status: int) -> bool:
    """更新支付流水状态."""
    with get_session() as db:
        p = db.query(OrderPayment).filter(OrderPayment.id == payment_id).first()
        if not p:
            return False
        p.status = status
        return True


# ---------------------------------------------------------------------------
# InvoiceApplication
# ---------------------------------------------------------------------------

def create_invoice_application(
    order_no: str,
    user_id: str | None = None,
    company_name: str | None = None,
    company_tax_number: str | None = None,
    invoice_amount: int = 0,
    **kwargs: Any,
) -> InvoiceApplication:
    """新增发票申请."""
    with get_session() as db:
        app = InvoiceApplication(
            order_no=order_no,
            user_id=user_id,
            company_name=company_name,
            company_tax_number=company_tax_number,
            invoice_amount=invoice_amount,
            product_fee=kwargs.get("product_fee", invoice_amount),
            title_type=kwargs.get("title_type", 1),
            invoice_content=kwargs.get("invoice_content"),
            company_address=kwargs.get("company_address"),
            company_phone=kwargs.get("company_phone"),
            bank_name=kwargs.get("bank_name"),
            bank_account=kwargs.get("bank_account"),
            email=kwargs.get("email"),
            mobile_phone=kwargs.get("mobile_phone"),
            invoice_status=0,
            create_user_id=user_id,
        )
        db.add(app)
        db.flush()
        db.refresh(app)
        return app


def list_invoice_applications(
    user_id: str | None = None,
    status: int | None = None,
    page: int = 1,
    page_size: int = 20,
) -> list[InvoiceApplication]:
    with get_session() as db:
        q = db.query(InvoiceApplication)
        if user_id:
            q = q.filter(InvoiceApplication.user_id == user_id)
        if status is not None:
            q = q.filter(InvoiceApplication.invoice_status == status)
        return q.order_by(InvoiceApplication.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


# ---------------------------------------------------------------------------
# InvoiceTitle
# ---------------------------------------------------------------------------

def create_invoice_title(
    user_id: str,
    company_name: str,
    company_tax_number: str | None = None,
    title_type: int = 1,
    **kwargs: Any,
) -> InvoiceTitle:
    """新增发票抬头."""
    with get_session() as db:
        t = InvoiceTitle(
            user_id=user_id,
            company_name=company_name,
            company_tax_number=company_tax_number,
            title_type=title_type,
            company_address=kwargs.get("company_address"),
            company_phone=kwargs.get("company_phone"),
            bank_name=kwargs.get("bank_name"),
            bank_account=kwargs.get("bank_account"),
            email=kwargs.get("email"),
            mobile_phone=kwargs.get("mobile_phone"),
            default_flag=kwargs.get("default_flag", False),
        )
        db.add(t)
        db.flush()
        db.refresh(t)
        return t


def list_invoice_titles(user_id: str) -> list[InvoiceTitle]:
    with get_session() as db:
        return (
            db.query(InvoiceTitle)
            .filter(InvoiceTitle.user_id == user_id)
            .order_by(InvoiceTitle.default_flag.desc(), InvoiceTitle.created_at.desc())
            .all()
        )


def set_default_invoice_title(user_id: str, title_id: str) -> bool:
    """设为默认抬头: 取消其它默认."""
    with get_session() as db:
        # 先全部取消
        db.query(InvoiceTitle).filter(
            InvoiceTitle.user_id == user_id
        ).update({InvoiceTitle.default_flag: False})
        # 设置新默认
        t = (
            db.query(InvoiceTitle)
            .filter(InvoiceTitle.id == title_id, InvoiceTitle.user_id == user_id)
            .first()
        )
        if not t:
            return False
        t.default_flag = True
        return True
