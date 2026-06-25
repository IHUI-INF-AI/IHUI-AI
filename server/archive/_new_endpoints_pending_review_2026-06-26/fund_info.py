"""User fund info API - 用户资金信息

迁移自 Java ai-smart-society-java: UserFundInfoController (6 端点)
补充封存前缺失的用户资金信息管理功能
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/user-fund-info", tags=["UserFundInfo"])


class UserFundInfoReq(BaseModel):
    user_uuid: str
    balance: int = 0
    frozen: int = 0
    total_recharge: int = 0
    total_consume: int = 0
    status: int = 0


def _to_dict(row) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}


@router.get("/list", summary="用户资金信息列表")
def list_user_fund_info(
    user_uuid: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """用户资金信息列表 (迁移自 Java: UserFundInfoController.list)"""
    from app.models.payment_models import UserFundInfo
    q = db.query(UserFundInfo)
    if user_uuid:
        q = q.filter(UserFundInfo.user_uuid == user_uuid)
    if status is not None:
        q = q.filter(UserFundInfo.status == status)
    total = q.count()
    items = q.order_by(UserFundInfo.id.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [_to_dict(i) for i in items], "total": total}, "msg": "ok"}


@router.get("/{user_uuid}", summary="用户资金信息详情")
def get_user_fund_info(user_uuid: str, db=Depends(_get_db)):
    """用户资金信息详情 (迁移自 Java: UserFundInfoController.getInfo)"""
    from app.models.payment_models import UserFundInfo
    item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="用户资金信息不存在")
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.post("", summary="新增用户资金信息")
def add_user_fund_info(req: UserFundInfoReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    """新增用户资金信息 (迁移自 Java: UserFundInfoController.add)"""
    from app.models.payment_models import UserFundInfo
    item = UserFundInfo(
        user_uuid=req.user_uuid,
        balance=req.balance,
        frozen=req.frozen,
        total_recharge=req.total_recharge,
        total_consume=req.total_consume,
        status=req.status,
    )
    db.add(item)
    db.flush()
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.put("/{user_uuid}", summary="更新用户资金信息")
def update_user_fund_info(user_uuid: str, req: UserFundInfoReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    """更新用户资金信息 (迁移自 Java: UserFundInfoController.edit)"""
    from app.models.payment_models import UserFundInfo
    item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="用户资金信息不存在")
    item.balance = req.balance
    item.frozen = req.frozen
    item.total_recharge = req.total_recharge
    item.total_consume = req.total_consume
    item.status = req.status
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.delete("/{user_uuid}", summary="删除用户资金信息")
def delete_user_fund_info(user_uuid: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    """删除用户资金信息 (迁移自 Java: UserFundInfoController.remove)"""
    from app.models.payment_models import UserFundInfo
    item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="用户资金信息不存在")
    db.delete(item)
    return {"code": 0, "msg": "ok"}


@router.get("/export", summary="导出用户资金信息")
def export_user_fund_info(
    status: int | None = None,
    db=Depends(_get_db),
):
    """导出用户资金信息 (迁移自 Java: UserFundInfoController.export)"""
    from app.models.payment_models import UserFundInfo
    q = db.query(UserFundInfo)
    if status is not None:
        q = q.filter(UserFundInfo.status == status)
    items = q.order_by(UserFundInfo.id.desc()).limit(1000).all()
    return {"code": 0, "data": [_to_dict(i) for i in items], "msg": "ok"}
