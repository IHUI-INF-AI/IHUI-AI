"""发票管理路由 (迁移自历史 ihui-ai-edu-order-service)

涵盖: 发票抬头 CRUD + 发票申请 CRUD.
"""
from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.invoice_models import InvoiceApplication, InvoiceTitle
from app.schemas.common import error, success

router = APIRouter()


# ============ 发票抬头 ============


def _title_to_dict(t: InvoiceTitle) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "company_id": t.company_id,
        "title_type": t.title_type,
        "company_name": t.company_name,
        "company_tax_number": t.company_tax_number,
        "company_address": t.company_address,
        "company_phone": t.company_phone,
        "bank_name": t.bank_name,
        "bank_account": t.bank_account,
        "email": t.email,
        "mobile_phone": t.mobile_phone,
        "default_flag": t.default_flag,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


@router.get("/title/list", summary="发票抬头列表")
async def list_titles(user_id: int = Query(...), page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    with get_session() as db:
        try:
            q = db.query(InvoiceTitle).filter(InvoiceTitle.user_id == user_id)
            total = q.count()
            items = q.order_by(InvoiceTitle.default_flag.desc(), InvoiceTitle.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_title_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"invoice title list error: {e}")
            return error(str(e))


@router.post("/title", summary="创建发票抬头")
async def create_title(
    title_type: int = Query(..., ge=1, le=2),
    company_name: str = Query(..., max_length=200),
    company_tax_number: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
    bank_name: str | None = None,
    bank_account: str | None = None,
    email: str | None = None,
    mobile_phone: str | None = None,
    default_flag: bool = False,
    company_id: int | None = None,
    create_user_id: int | None = None,
    user_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            if default_flag:
                db.query(InvoiceTitle).filter(InvoiceTitle.user_id == user_id, InvoiceTitle.default_flag).update(
                    {InvoiceTitle.default_flag: False}
                )
            t = InvoiceTitle(
                user_id=user_id,
                company_id=company_id,
                title_type=title_type,
                company_name=company_name,
                company_tax_number=company_tax_number,
                company_address=company_address,
                company_phone=company_phone,
                bank_name=bank_name,
                bank_account=bank_account,
                email=email,
                mobile_phone=mobile_phone,
                default_flag=default_flag,
                create_user_id=create_user_id,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"invoice title create error: {e}")
            return error(str(e))


@router.put("/title/{tid}", summary="修改发票抬头")
async def update_title(
    tid: int,
    company_name: str | None = None,
    company_tax_number: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
    bank_name: str | None = None,
    bank_account: str | None = None,
    email: str | None = None,
    mobile_phone: str | None = None,
    default_flag: bool | None = None,
):
    with get_session() as db:
        try:
            t = db.query(InvoiceTitle).filter(InvoiceTitle.id == tid).first()
            if not t:
                return error("抬头不存在", "404")
            if company_name is not None:
                t.company_name = company_name
            if company_tax_number is not None:
                t.company_tax_number = company_tax_number
            if company_address is not None:
                t.company_address = company_address
            if company_phone is not None:
                t.company_phone = company_phone
            if bank_name is not None:
                t.bank_name = bank_name
            if bank_account is not None:
                t.bank_account = bank_account
            if email is not None:
                t.email = email
            if mobile_phone is not None:
                t.mobile_phone = mobile_phone
            if default_flag is not None:
                if default_flag:
                    db.query(InvoiceTitle).filter(InvoiceTitle.user_id == t.user_id, InvoiceTitle.default_flag).update(
                        {InvoiceTitle.default_flag: False}
                    )
                t.default_flag = default_flag
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"invoice title update error: {e}")
            return error(str(e))


@router.delete("/title/{tid}", summary="删除发票抬头")
async def delete_title(tid: int):
    with get_session() as db:
        try:
            t = db.query(InvoiceTitle).filter(InvoiceTitle.id == tid).first()
            if not t:
                return error("抬头不存在", "404")
            db.delete(t)
            return success()
        except Exception as e:
            logger.error(f"invoice title delete error: {e}")
            return error(str(e))


# ============ 发票申请 ============


def _app_to_dict(a: InvoiceApplication) -> dict:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "order_id": a.order_id,
        "order_no": a.order_no,
        "invoice_title_id": a.invoice_title_id,
        "title_type": a.title_type,
        "company_name": a.company_name,
        "invoice_amount": float(a.invoice_amount) if a.invoice_amount is not None else 0,
        "status": a.status,
        "invoice_no": a.invoice_no,
        "invoice_url": a.invoice_url,
        "reject_reason": a.reject_reason,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


@router.get("/application/list", summary="发票申请列表")
async def list_applications(
    user_id: int | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(InvoiceApplication)
            if user_id:
                q = q.filter(InvoiceApplication.user_id == user_id)
            if status is not None:
                q = q.filter(InvoiceApplication.status == status)
            total = q.count()
            items = q.order_by(InvoiceApplication.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_app_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"invoice application list error: {e}")
            return error(str(e))


@router.post("/application", summary="创建发票申请")
async def create_application(
    order_id: int = Query(...),
    order_no: str = Query(..., max_length=50),
    title_type: int = Query(..., ge=1, le=2),
    company_name: str = Query(..., max_length=200),
    invoice_amount: float = Query(..., ge=0),
    invoice_title_id: int | None = None,
    company_tax_number: str | None = None,
    company_address: str | None = None,
    company_phone: str | None = None,
    bank_name: str | None = None,
    bank_account: str | None = None,
    email: str | None = None,
    mobile_phone: str | None = None,
    invoice_content: str | None = None,
    company_id: int | None = None,
    create_user_id: int | None = None,
    user_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            a = InvoiceApplication(
                user_id=user_id,
                company_id=company_id,
                order_id=order_id,
                order_no=order_no,
                invoice_title_id=invoice_title_id,
                title_type=title_type,
                company_name=company_name,
                company_tax_number=company_tax_number,
                company_address=company_address,
                company_phone=company_phone,
                bank_name=bank_name,
                bank_account=bank_account,
                email=email,
                mobile_phone=mobile_phone,
                invoice_amount=invoice_amount,
                invoice_content=invoice_content,
                status=0,
                create_user_id=create_user_id,
            )
            db.add(a)
            db.flush()
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"invoice application create error: {e}")
            return error(str(e))


@router.put("/application/{aid}/status", summary="审核发票申请")
async def review_application(
    aid: int,
    status: int = Query(..., ge=0, le=4, description="0-待开票/1-开票中/2-已开票/3-已拒绝/4-已取消"),
    invoice_no: str | None = None,
    invoice_url: str | None = None,
    reject_reason: str | None = None,
):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            a.status = status
            if invoice_no is not None:
                a.invoice_no = invoice_no
            if invoice_url is not None:
                a.invoice_url = invoice_url
            if reject_reason is not None:
                a.reject_reason = reject_reason
            return success({"id": a.id})
        except Exception as e:
            logger.error(f"invoice application review error: {e}")
            return error(str(e))


@router.get("/application/{aid}", summary="发票申请详情")
async def get_application(aid: int):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            return success(_app_to_dict(a))
        except Exception as e:
            logger.error(f"invoice application get error: {e}")
            return error(str(e))


# ============ 发票申请状态迁移 ============


@router.put("/application/{aid}/approved", summary="审核通过")
async def set_application_approved(aid: int):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            a.status = 0
            return success({"id": a.id, "status": a.status})
        except Exception as e:
            logger.error(f"invoice application approved error: {e}")
            return error(str(e))


@router.put("/application/{aid}/rejected", summary="审核拒绝")
async def set_application_rejected(aid: int):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            a.status = 3
            return success({"id": a.id, "status": a.status})
        except Exception as e:
            logger.error(f"invoice application rejected error: {e}")
            return error(str(e))


@router.put("/application/{aid}/invoicing", summary="开票中")
async def set_application_invoicing(aid: int):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            a.status = 1
            return success({"id": a.id, "status": a.status})
        except Exception as e:
            logger.error(f"invoice application invoicing error: {e}")
            return error(str(e))


@router.put("/application/{aid}/invoiced", summary="已开票")
async def set_application_invoiced(aid: int):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            a.status = 2
            return success({"id": a.id, "status": a.status})
        except Exception as e:
            logger.error(f"invoice application invoiced error: {e}")
            return error(str(e))


@router.put("/application/{aid}/canceled", summary="已取消")
async def set_application_canceled(aid: int):
    with get_session() as db:
        try:
            a = db.query(InvoiceApplication).filter(InvoiceApplication.id == aid).first()
            if not a:
                return error("申请不存在", "404")
            a.status = 4
            return success({"id": a.id, "status": a.status})
        except Exception as e:
            logger.error(f"invoice application canceled error: {e}")
            return error(str(e))
