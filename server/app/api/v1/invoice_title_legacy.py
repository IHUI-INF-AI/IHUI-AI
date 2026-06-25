"""Invoice Title Legacy Routes - 1:1 兼容 Java InvoiceTitleController.

完整迁移自 ihui-ai-edu-order-service InvoiceTitleController (7 端点).
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import invoice_title_business

router = APIRouter(prefix="", tags=["InvoiceTitle-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


class InvoiceTitleCreateReq(BaseModel):
    title: str
    taxNo: str | None = None
    companyAddress: str | None = None
    companyTel: str | None = None
    bankName: str | None = None
    bankAccount: str | None = None
    type: int = 1


class InvoiceTitleUpdateReq(BaseModel):
    id: int
    title: str | None = None
    taxNo: str | None = None
    companyAddress: str | None = None
    companyTel: str | None = None
    bankName: str | None = None
    bankAccount: str | None = None
    type: int | None = None


class InvoiceTitleDeleteReq(BaseModel):
    id: int


# ============= POST /auth-api/invoice/title =============
@router.post("/auth-api/invoice/title", summary="[InvoiceTitle]添加抬头(登录)")
def invoice_title_add_auth(req: InvoiceTitleCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(invoice_title_business.add_invoice_title(
            title=req.title, tax_no=req.taxNo,
            company_address=req.companyAddress, company_tel=req.companyTel,
            bank_name=req.bankName, bank_account=req.bankAccount,
            member_id=member_id, type=req.type,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ============= POST /invoice/title =============
@router.post("/invoice/title", summary="[InvoiceTitle]添加抬头(管理端)")
def invoice_title_add_admin(req: InvoiceTitleCreateReq):
    try:
        return _ok(invoice_title_business.add_invoice_title(
            title=req.title, tax_no=req.taxNo,
            company_address=req.companyAddress, company_tel=req.companyTel,
            bank_name=req.bankName, bank_account=req.bankAccount,
            member_id=req.type and None, type=req.type,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ============= PUT /auth-api/invoice/title =============
@router.put("/auth-api/invoice/title", summary="[InvoiceTitle]修改抬头(登录)")
def invoice_title_update_auth(req: InvoiceTitleUpdateReq, _user: str = Depends(require_login)):
    try:
        return _ok(invoice_title_business.update_invoice_title(
            title_id=req.id, title=req.title, tax_no=req.taxNo,
            company_address=req.companyAddress, company_tel=req.companyTel,
            bank_name=req.bankName, bank_account=req.bankAccount,
            type=req.type,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ============= PUT /invoice/title =============
@router.put("/invoice/title", summary="[InvoiceTitle]修改抬头(管理端)")
def invoice_title_update_admin(req: InvoiceTitleUpdateReq):
    try:
        return _ok(invoice_title_business.update_invoice_title(
            title_id=req.id, title=req.title, tax_no=req.taxNo,
            company_address=req.companyAddress, company_tel=req.companyTel,
            bank_name=req.bankName, bank_account=req.bankAccount,
            type=req.type,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ============= GET /auth-api/invoice/title =============
@router.get("/auth-api/invoice/title", summary="[InvoiceTitle]查询抬头列表(登录)")
def invoice_title_list_auth(
    page: int = 1,
    pageSize: int = 20,
    title: str | None = None,
    _user: str = Depends(require_login),
):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(invoice_title_business.list_invoice_titles(
            page=page, page_size=pageSize, member_id=member_id, title=title,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ============= DELETE /auth-api/invoice/title =============
@router.delete("/auth-api/invoice/title", summary="[InvoiceTitle]删除抬头(登录)")
def invoice_title_delete_auth(req: InvoiceTitleDeleteReq, _user: str = Depends(require_login)):
    try:
        return _ok({"deleted": invoice_title_business.delete_invoice_title(req.id)})
    except Exception as e:
        raise _err(500, str(e))


# ============= DELETE /invoice/title =============
@router.delete("/invoice/title", summary="[InvoiceTitle]删除抬头(管理端)")
def invoice_title_delete_admin(req: InvoiceTitleDeleteReq):
    try:
        return _ok({"deleted": invoice_title_business.delete_invoice_title(req.id)})
    except Exception as e:
        raise _err(500, str(e))
