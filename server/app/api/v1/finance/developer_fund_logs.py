"""Developer fund logs API - 开发者订单日志

迁移自 Java ai-smart-society-java: ZhsDeveloperFundLogsController (6 端点)
对应模型: app.models.java_missing_models.ZhsDeveloperFundLogs (zhs_developer_fund_logs)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.java_missing_models import ZhsDeveloperFundLogs
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/developer-fund-logs", tags=["DeveloperFundLogs"])


class DeveloperFundLogReq(BaseModel):
    order_id: str | None = None
    operate: int = 0
    amount: int = 0
    real_amount: int = 0
    discount: int = 100
    product_id: str | None = None
    type: int = 0
    operate_id: str | None = None
    beneficiary: str | None = None
    benefit_amount: str | None = None


@router.get("/list", summary="开发者资金日志列表")
def list_logs(
    order_id: str | None = None,
    operate: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsDeveloperFundLogs)
    if order_id:
        q = q.filter(ZhsDeveloperFundLogs.order_id == order_id)
    if operate is not None:
        q = q.filter(ZhsDeveloperFundLogs.operate == operate)
    total = q.count()
    items = q.order_by(ZhsDeveloperFundLogs.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [i.to_dict() for i in items], "total": total}, "msg": "ok"}


@router.get("/{log_id}", summary="开发者资金日志详情")
def get_log(log_id: int, db=Depends(_get_db)):
    item = db.query(ZhsDeveloperFundLogs).filter(ZhsDeveloperFundLogs.id == log_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="日志不存在")
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.post("", summary="新增开发者资金日志")
def create_log(req: DeveloperFundLogReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    from app.utils.datetime_helper import utcnow
    item = ZhsDeveloperFundLogs(
        order_id=req.order_id,
        operate=req.operate,
        amount=req.amount,
        real_amount=req.real_amount,
        discount=req.discount,
        product_id=req.product_id,
        type=req.type,
        operate_id=req.operate_id,
        operated_at=utcnow(),
        beneficiary=req.beneficiary,
        benefit_amount=req.benefit_amount,
    )
    db.add(item)
    db.flush()
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.put("/{log_id}", summary="更新开发者资金日志")
def update_log(log_id: int, req: DeveloperFundLogReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsDeveloperFundLogs).filter(ZhsDeveloperFundLogs.id == log_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="日志不存在")
    item.order_id = req.order_id
    item.operate = req.operate
    item.amount = req.amount
    item.real_amount = req.real_amount
    item.discount = req.discount
    item.product_id = req.product_id
    item.type = req.type
    item.operate_id = req.operate_id
    item.beneficiary = req.beneficiary
    item.benefit_amount = req.benefit_amount
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.delete("/{log_id}", summary="删除开发者资金日志")
def delete_log(log_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsDeveloperFundLogs).filter(ZhsDeveloperFundLogs.id == log_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="日志不存在")
    db.delete(item)
    return {"code": 0, "msg": "ok"}


@router.get("/export", summary="导出开发者资金日志")
def export_logs(
    order_id: str | None = None,
    operate: int | None = None,
    db=Depends(_get_db),
):
    q = db.query(ZhsDeveloperFundLogs)
    if order_id:
        q = q.filter(ZhsDeveloperFundLogs.order_id == order_id)
    if operate is not None:
        q = q.filter(ZhsDeveloperFundLogs.operate == operate)
    items = q.order_by(ZhsDeveloperFundLogs.created_at.desc()).limit(1000).all()
    return {"code": 0, "data": [i.to_dict() for i in items], "msg": "ok"}
