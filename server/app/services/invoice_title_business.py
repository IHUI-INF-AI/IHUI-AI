"""Invoice Title Business Service.

完整迁移自 ihui-ai-edu-order-service: InvoiceTitleController (7 端点).
- 添加 / 修改 / 删除 / 查询抬头
- 支持 auth-api 鉴权与公开访问
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from sqlalchemy import and_

from app.database import get_session
from app.models.payment_models import InvoiceTitle

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


def add_invoice_title(
    title: str,
    tax_no: str | None = None,
    company_address: str | None = None,
    company_tel: str | None = None,
    bank_name: str | None = None,
    bank_account: str | None = None,
    member_id: int | None = None,
    type: int = 1,
) -> dict[str, Any]:
    """添加发票抬头."""
    with get_session() as db:
        obj = InvoiceTitle(
            title=title, tax_no=tax_no,
            company_address=company_address, company_tel=company_tel,
            bank_name=bank_name, bank_account=bank_account,
            member_id=member_id, type=type,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_invoice_title(
    title_id: int,
    title: Optional[str] = None,
    tax_no: Optional[str] = None,
    company_address: Optional[str] = None,
    company_tel: Optional[str] = None,
    bank_name: Optional[str] = None,
    bank_account: Optional[str] = None,
    type: Optional[int] = None,
) -> dict[str, Any]:
    """修改发票抬头."""
    with get_session() as db:
        obj = db.query(InvoiceTitle).filter(InvoiceTitle.id == title_id).first()
        if not obj:
            raise ValueError(f"发票抬头不存在: {title_id}")
        for k, v in {
            "title": title, "tax_no": tax_no,
            "company_address": company_address, "company_tel": company_tel,
            "bank_name": bank_name, "bank_account": bank_account,
            "type": type,
        }.items():
            if v is not None:
                setattr(obj, k, v)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_invoice_title(title_id: int) -> bool:
    """删除发票抬头."""
    with get_session() as db:
        obj = db.query(InvoiceTitle).filter(InvoiceTitle.id == title_id).first()
        if not obj:
            return False
        db.delete(obj)
        return True


def get_invoice_title(title_id: int) -> dict[str, Any] | None:
    """获取发票抬头详情."""
    with get_session() as db:
        obj = db.query(InvoiceTitle).filter(InvoiceTitle.id == title_id).first()
        return _to_dict(obj) if obj else None


def list_invoice_titles(
    page: int = 1,
    page_size: int = 20,
    member_id: int | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    """分页查询发票抬头."""
    with get_session() as db:
        q = db.query(InvoiceTitle)
        if member_id is not None:
            q = q.filter(InvoiceTitle.member_id == member_id)
        if title:
            q = q.filter(InvoiceTitle.title.like(f"%{title}%"))
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {
            "list": _to_dict_list(items),
            "total": total,
            "page": page,
            "page_size": page_size,
        }
