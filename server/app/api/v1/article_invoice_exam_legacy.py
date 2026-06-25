"""Article + Invoice + Exam Legacy Routes - 1:1 兼容 Java 历史项目.

完整迁移自:
  - InvoiceApplicationController (14 端点, order-service)
  - ArticleController (15 端点, content-service)
  - ExamController (13 端点, exam-service)

合计 42 个端点.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.article_invoice_models import Article, InvoiceApplication
from app.models.exam_models import Exam
from app.security import get_current_user_id_flexible, require_login

router = APIRouter(prefix="", tags=["Article-Invoice-Exam-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


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


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class InvoiceCreateReq(BaseModel):
    orderId: int | None = None
    invoiceType: str | None = None
    title: str | None = None
    taxNo: str | None = None
    amount: float = 0
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    bankName: str | None = None
    bankAccount: str | None = None
    remark: str | None = None


class InvoiceUpdateReq(BaseModel):
    id: int
    invoiceType: str | None = None
    title: str | None = None
    taxNo: str | None = None
    amount: float | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    bankName: str | None = None
    bankAccount: str | None = None
    remark: str | None = None
    auditRemark: str | None = None
    status: int | None = None


class InvoiceGetReq(BaseModel):
    id: int


class InvoiceListReq(BaseModel):
    userId: int | None = None
    status: int | None = None
    page: int = 1
    pageSize: int = 20


class InvoiceRemoveReq(BaseModel):
    id: int


class InvoiceApprovedReq(BaseModel):
    id: int
    remark: str | None = None


class InvoiceRejectedReq(BaseModel):
    id: int
    reason: str | None = None


class InvoiceInvoicingReq(BaseModel):
    id: int
    invoiceNo: str | None = None


class InvoiceInvoicedReq(BaseModel):
    id: int
    invoiceNo: str
    invoiceUrl: str | None = None


class InvoiceCanceledReq(BaseModel):
    id: int
    reason: str | None = None


class ArticleCreateReq(BaseModel):
    title: str
    content: str | None = None
    summary: str | None = None
    cover: str | None = None
    status: int = 0


class ArticleUpdateReq(BaseModel):
    id: int
    title: str | None = None
    content: str | None = None
    summary: str | None = None
    cover: str | None = None
    status: int | None = None
    isRecommend: bool | None = None
    isTop: bool | None = None


class ArticleDeleteReq(BaseModel):
    id: int


class ArticleRecommendReq(BaseModel):
    id: int


class ArticleTopReq(BaseModel):
    id: int


class ExamCreateReq(BaseModel):
    title: str
    description: str | None = None
    type: str = "sign"
    startTime: str | None = None
    endTime: str | None = None
    duration: int = 60
    totalScore: float = 100
    passScore: float = 60
    status: int = 0


class ExamUpdateReq(BaseModel):
    id: int
    title: str | None = None
    description: str | None = None
    type: str | None = None
    startTime: str | None = None
    endTime: str | None = None
    duration: int | None = None
    totalScore: float | None = None
    passScore: float | None = None
    status: int | None = None


class ExamDeleteReq(BaseModel):
    id: int


class ExamPublishReq(BaseModel):
    id: int


# ---------------------------------------------------------------------------
# InvoiceApplicationController - 14 endpoints
# ---------------------------------------------------------------------------

@router.post("/auth-api/invoice/application", summary="创建发票申请 (鉴权)")
def invoice_create_auth(req: InvoiceCreateReq, _user: str = Depends(require_login)):
    user_id = get_current_user_id_flexible()
    with get_session() as db:
        inv = InvoiceApplication(
            user_id=user_id, order_id=req.orderId,
            invoice_type=req.invoiceType, title=req.title, tax_no=req.taxNo,
            amount=req.amount, email=req.email, phone=req.phone,
            address=req.address, bank_name=req.bankName,
            bank_account=req.bankAccount, remark=req.remark,
            status=0,
        )
        db.add(inv)
        db.flush()
        db.refresh(inv)
        return _ok(_to_dict(inv))


@router.post("/invoice/application", summary="创建发票申请")
def invoice_create(req: InvoiceCreateReq):
    with get_session() as db:
        inv = InvoiceApplication(
            order_id=req.orderId, invoice_type=req.invoiceType,
            title=req.title, tax_no=req.taxNo, amount=req.amount,
            email=req.email, phone=req.phone, address=req.address,
            bank_name=req.bankName, bank_account=req.bankAccount,
            remark=req.remark, status=0,
        )
        db.add(inv)
        db.flush()
        db.refresh(inv)
        return _ok(_to_dict(inv))


@router.put("/auth-api/invoice/application", summary="更新发票申请 (鉴权)")
def invoice_update_auth(req: InvoiceUpdateReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        fields = {
            "invoice_type": req.invoiceType, "title": req.title, "tax_no": req.taxNo,
            "amount": req.amount, "email": req.email, "phone": req.phone,
            "address": req.address, "bank_name": req.bankName,
            "bank_account": req.bankAccount, "remark": req.remark,
            "audit_remark": req.auditRemark, "status": req.status,
        }
        for k, v in fields.items():
            if v is not None:
                setattr(inv, k, v)
        db.flush()
        db.refresh(inv)
        return _ok(_to_dict(inv))


@router.put("/invoice/application", summary="更新发票申请")
def invoice_update(req: InvoiceUpdateReq):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        fields = {
            "invoice_type": req.invoiceType, "title": req.title, "tax_no": req.taxNo,
            "amount": req.amount, "email": req.email, "phone": req.phone,
            "address": req.address, "bank_name": req.bankName,
            "bank_account": req.bankAccount, "remark": req.remark,
            "audit_remark": req.auditRemark, "status": req.status,
        }
        for k, v in fields.items():
            if v is not None:
                setattr(inv, k, v)
        db.flush()
        db.refresh(inv)
        return _ok(_to_dict(inv))


@router.get("/auth-api/invoice/application", summary="获取发票申请 (鉴权)")
def invoice_get_auth(id: int = Query(...), _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        return _ok(_to_dict(inv))


@router.get("/invoice/application/list", summary="获取发票申请列表")
def invoice_list(
    userId: int | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(InvoiceApplication)
        if userId is not None:
            q = q.filter(InvoiceApplication.user_id == userId)
        if status is not None:
            q = q.filter(InvoiceApplication.status == status)
        total = q.count()
        items = q.order_by(InvoiceApplication.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})


@router.get("/auth-api/invoice/application/list", summary="获取发票申请列表 (鉴权)")
def invoice_list_auth(
    userId: int | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
):
    return invoice_list(userId=userId, status=status, page=page, pageSize=pageSize, _user=_user)


@router.delete("/auth-api/invoice/application", summary="删除发票申请 (鉴权)")
def invoice_remove_auth(req: InvoiceRemoveReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            return _ok({"deleted": False})
        db.delete(inv)
        return _ok({"deleted": True})


@router.delete("/invoice/application", summary="删除发票申请")
def invoice_remove(req: InvoiceRemoveReq):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            return _ok({"deleted": False})
        db.delete(inv)
        return _ok({"deleted": True})


@router.post("/invoice/application/approved", summary="发票申请审核通过")
def invoice_approved(req: InvoiceApprovedReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        inv.status = 1  # approved
        if req.remark:
            inv.audit_remark = req.remark
        db.flush()
        db.refresh(inv)
        return _ok({"approved": True, "application": _to_dict(inv)})


@router.post("/invoice/application/rejected", summary="发票申请审核驳回")
def invoice_rejected(req: InvoiceRejectedReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        inv.status = 2  # rejected
        if req.reason:
            inv.audit_remark = req.reason
        db.flush()
        db.refresh(inv)
        return _ok({"rejected": True, "application": _to_dict(inv)})


@router.post("/invoice/application/invoicing", summary="发票开票中")
def invoice_invoicing(req: InvoiceInvoicingReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        inv.status = 3  # invoicing
        db.flush()
        db.refresh(inv)
        return _ok({"invoicing": True, "application": _to_dict(inv)})


@router.post("/invoice/application/invoiced", summary="发票已开票")
def invoice_invoiced(req: InvoiceInvoicedReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        inv.status = 4  # invoiced
        inv.tax_no = req.invoiceNo
        db.flush()
        db.refresh(inv)
        return _ok({"invoiced": True, "application": _to_dict(inv)})


@router.post("/invoice/application/canceled", summary="发票申请作废")
def invoice_canceled(req: InvoiceCanceledReq, _user: str = Depends(require_login)):
    with get_session() as db:
        inv = db.query(InvoiceApplication).filter(InvoiceApplication.id == req.id).first()
        if not inv:
            raise _err(404, "发票申请不存在")
        inv.status = 5  # canceled
        if req.reason:
            inv.audit_remark = req.reason
        db.flush()
        db.refresh(inv)
        return _ok({"canceled": True, "application": _to_dict(inv)})


# ---------------------------------------------------------------------------
# ArticleController - 15 endpoints
# ---------------------------------------------------------------------------

@router.post("/auth-api/article", summary="发布文章")
def article_create(req: ArticleCreateReq, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    with get_session() as db:
        a = Article(
            member_id=member_id, title=req.title,
            content=req.content, summary=req.summary,
            cover=req.cover, status=req.status,
        )
        db.add(a)
        db.flush()
        db.refresh(a)
        return _ok(_to_dict(a))


@router.put("/auth-api/article", summary="修改文章")
def article_update(req: ArticleUpdateReq, _user: str = Depends(require_login)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == req.id).first()
        if not a:
            raise _err(404, "文章不存在")
        fields = {
            "title": req.title, "content": req.content, "summary": req.summary,
            "cover": req.cover, "status": req.status,
            "is_recommend": req.isRecommend, "is_top": req.isTop,
        }
        for k, v in fields.items():
            if v is not None:
                setattr(a, k, v)
        db.flush()
        db.refresh(a)
        return _ok(_to_dict(a))


@router.delete("/auth-api/article", summary="删除文章")
def article_delete(req: ArticleDeleteReq, _user: str = Depends(require_login)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == req.id).first()
        if not a:
            return _ok({"deleted": False})
        db.delete(a)
        return _ok({"deleted": True})


@router.get("/article/list", summary="获取文章列表")
def article_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    title: str | None = None,
    status: int | None = None,
    memberId: int | None = None,
    _user: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(Article)
        if title:
            q = q.filter(Article.title.like(f"%{title}%"))
        if status is not None:
            q = q.filter(Article.status == status)
        if memberId is not None:
            q = q.filter(Article.member_id == memberId)
        total = q.count()
        items = q.order_by(Article.is_top.desc(), Article.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})


@router.get("/public-api/article/list", summary="获取文章列表 (公开)")
def article_public_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    title: str | None = None,
):
    with get_session() as db:
        q = db.query(Article).filter(Article.status == 1)  # published
        if title:
            q = q.filter(Article.title.like(f"%{title}%"))
        total = q.count()
        items = q.order_by(Article.is_top.desc(), Article.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})


@router.get("/public-api/article/list/by-ids", summary="按IDs获取文章")
def article_list_by_ids(ids: str = Query(...)):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    if not id_list:
        return _ok([])
    with get_session() as db:
        items = db.query(Article).filter(Article.id.in_(id_list)).all()
        return _ok(_to_dict_list(items))


@router.get("/public-api/article", summary="获取文章详情")
def article_get(id: int = Query(...)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == id).first()
        if not a:
            raise _err(404, "文章不存在")
        a.view_count = (a.view_count or 0) + 1
        return _ok(_to_dict(a))


@router.post("/article/recommend", summary="推荐文章")
def article_recommend(req: ArticleRecommendReq, _user: str = Depends(require_login)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == req.id).first()
        if not a:
            raise _err(404, "文章不存在")
        a.is_recommend = True
        return _ok({"recommended": True})


@router.delete("/article/recommend", summary="取消推荐")
def article_recommend_delete(req: ArticleRecommendReq, _user: str = Depends(require_login)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == req.id).first()
        if not a:
            raise _err(404, "文章不存在")
        a.is_recommend = False
        return _ok({"unrecommended": True})


@router.get("/public-api/article/recommend/list", summary="推荐文章列表")
def article_recommend_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        q = db.query(Article).filter(Article.is_recommend == True, Article.status == 1)  # noqa: E712
        total = q.count()
        items = q.order_by(Article.sort_order.desc(), Article.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})


@router.post("/article/top", summary="置顶文章")
def article_top(req: ArticleTopReq, _user: str = Depends(require_login)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == req.id).first()
        if not a:
            raise _err(404, "文章不存在")
        a.is_top = True
        return _ok({"topped": True})


@router.delete("/article/top", summary="取消置顶")
def article_top_delete(req: ArticleTopReq, _user: str = Depends(require_login)):
    with get_session() as db:
        a = db.query(Article).filter(Article.id == req.id).first()
        if not a:
            raise _err(404, "文章不存在")
        a.is_top = False
        return _ok({"untopped": True})


@router.get("/public-api/article/top/list", summary="置顶文章列表")
def article_top_list():
    with get_session() as db:
        items = db.query(Article).filter(Article.is_top == True, Article.status == 1).order_by(Article.id.desc()).all()  # noqa: E712
        return _ok(_to_dict_list(items))


@router.get("/public-api/article/member/count", summary="获取会员文章数量")
def article_member_count():
    member_id = get_current_user_id_flexible()
    with get_session() as db:
        if not member_id:
            return _ok(0)
        count = db.query(Article).filter(Article.member_id == member_id).count()
        return _ok(count)


@router.get("/auth-api/member/article/list", summary="获取会员文章列表")
def article_member_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    memberId: int | None = None,
    _user: str = Depends(require_login),
):
    if not memberId:
        memberId = get_current_user_id_flexible()
    if not memberId:
        raise _err(401, "未登录")
    return article_list(page=page, pageSize=pageSize, memberId=memberId, _user=_user)


# ---------------------------------------------------------------------------
# ExamController - 13 endpoints
# ---------------------------------------------------------------------------

@router.post("/exam", summary="创建考试")
def exam_create(req: ExamCreateReq, _user: str = Depends(require_login)):
    with get_session() as db:
        e = Exam(
            title=req.title, description=req.description,
            type=req.type, duration=req.duration,
            total_score=req.totalScore, pass_score=req.passScore,
            status=req.status,
        )
        db.add(e)
        db.flush()
        db.refresh(e)
        return _ok(_to_dict(e))


@router.put("/exam", summary="更新考试")
def exam_update(req: ExamUpdateReq, _user: str = Depends(require_login)):
    with get_session() as db:
        e = db.query(Exam).filter(Exam.id == req.id).first()
        if not e:
            raise _err(404, "考试不存在")
        fields = {
            "title": req.title, "description": req.description, "type": req.type,
            "duration": req.duration, "total_score": req.totalScore,
            "pass_score": req.passScore, "status": req.status,
        }
        for k, v in fields.items():
            if v is not None:
                setattr(e, k, v)
        db.flush()
        db.refresh(e)
        return _ok(_to_dict(e))


@router.get("/exam/list", summary="获取考试列表")
def exam_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    type: str | None = None,
    status: int | None = None,
    title: str | None = None,
    _user: str = Depends(require_login),
):
    if not type:
        type = "sign"
    with get_session() as db:
        q = db.query(Exam).filter(Exam.type == type)
        if status is not None:
            q = q.filter(Exam.status == status)
        if title:
            q = q.filter(Exam.title.like(f"%{title}%"))
        total = q.count()
        items = q.order_by(Exam.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})


@router.get("/public-api/exam/list", summary="公开获取考试列表")
def exam_public_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    type: str | None = None,
    title: str | None = None,
):
    if not type:
        type = "sign"
    with get_session() as db:
        q = db.query(Exam).filter(Exam.type == type, Exam.status == 1)
        if title:
            q = q.filter(Exam.title.like(f"%{title}%"))
        total = q.count()
        items = q.order_by(Exam.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})


@router.get("/exam", summary="获取考试信息")
def exam_get(id: int = Query(...), _user: str = Depends(require_login)):
    with get_session() as db:
        e = db.query(Exam).filter(Exam.id == id).first()
        if not e:
            raise _err(404, "考试不存在")
        return _ok(_to_dict(e))


@router.get("/public-api/exam", summary="公开获取考试信息")
def exam_public_get(id: int = Query(...)):
    with get_session() as db:
        e = db.query(Exam).filter(Exam.id == id, Exam.status == 1).first()
        if not e:
            raise _err(404, "考试不存在")
        return _ok(_to_dict(e))


@router.delete("/exam", summary="删除考试")
def exam_delete(req: ExamDeleteReq, _user: str = Depends(require_login)):
    with get_session() as db:
        e = db.query(Exam).filter(Exam.id == req.id).first()
        if not e:
            return _ok({"deleted": False})
        db.delete(e)
        return _ok({"deleted": True})


@router.put("/exam/publish", summary="发布考试")
def exam_publish(req: ExamPublishReq, _user: str = Depends(require_login)):
    with get_session() as db:
        e = db.query(Exam).filter(Exam.id == req.id).first()
        if not e:
            raise _err(404, "考试不存在")
        e.status = 1
        return _ok({"published": True})


@router.put("/exam/un-publish", summary="取消发布考试")
def exam_unpublish(req: ExamPublishReq, _user: str = Depends(require_login)):
    with get_session() as db:
        e = db.query(Exam).filter(Exam.id == req.id).first()
        if not e:
            raise _err(404, "考试不存在")
        e.status = 0
        return _ok({"unpublished": True})


@router.get("/public-api/recommend", summary="热门推荐考试列表")
def exam_recommend_list():
    with get_session() as db:
        items = db.query(Exam).filter(Exam.status == 1).order_by(Exam.id.desc()).limit(10).all()
        return _ok(_to_dict_list(items))


@router.get("/public-api/hot", summary="分类热门推荐考试列表")
def exam_hot_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    type: str | None = None,
):
    with get_session() as db:
        q = db.query(Exam).filter(Exam.status == 1)
        if type:
            q = q.filter(Exam.type == type)
        items = q.order_by(Exam.id.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok(_to_dict_list(items))


@router.get("/public-api/list/by-ids", summary="按IDs获取考试")
def exam_list_by_ids(ids: str = Query(...)):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    if not id_list:
        return _ok([])
    with get_session() as db:
        items = db.query(Exam).filter(Exam.id.in_(id_list), Exam.status == 1).all()
        return _ok(_to_dict_list(items))


@router.get("/auth-api/member/sign-up/list", summary="获取会员报名考试列表")
def exam_member_signup_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
):
    member_id = get_current_user_id_flexible()
    if not member_id:
        raise _err(401, "未登录")
    # 简化: 关联 ExamSignUp 模型
    with get_session() as db:
        from app.models.exam_models import ExamSignUp
        q = db.query(Exam).join(ExamSignUp, ExamSignUp.exam_id == Exam.id).filter(ExamSignUp.member_id == member_id)
        total = q.count()
        items = q.order_by(ExamSignUp.create_at.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
        return _ok({"list": _to_dict_list(items), "total": total, "page": page, "pageSize": pageSize})
