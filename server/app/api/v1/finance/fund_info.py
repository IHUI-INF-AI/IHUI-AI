"""User fund info API - 用户资金信息

2026-06-26 对接联调修复:
  - prefix 从 /user-fund-info 改为 /user/fund (对齐前端 getUserFundInfo 调用 /user/fund)
  - 新增 GET / 端点 (从 require_login 解析当前用户, 无需传 user_uuid)
  - _to_dict 字段对齐前端 UserFundInfo 接口 (userId/frozenAmount/totalConsumption/totalWithdraw/updateTime)

迁移自 ai-smart-society-java: UserFundInfoController (6 端点)
对应模型: app.models.payment_models.UserFundInfo (zhs_user_fund_info)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.payment_models import UserFundInfo
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


# 2026-06-26: prefix 对齐前端 getUserFundInfo() 调用的 /user/fund
router = APIRouter(prefix="/user/fund", tags=["Finance: User Fund Info"])


class FundInfoCreateReq(BaseModel):
    user_uuid: str
    balance: int = 0
    frozen: int = 0
    total_recharge: int = 0
    total_consume: int = 0
    status: int = 0


class FundInfoUpdateReq(BaseModel):
    id: int
    balance: int | None = None
    frozen: int | None = None
    total_recharge: int | None = None
    total_consume: int | None = None
    status: int | None = None


def _ok(data=None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _to_dict(item: UserFundInfo) -> dict:
    """字段对齐前端 UserFundInfo 接口 (client/src/api/user/user.ts:109-118)."""
    return {
        "id": str(item.id),
        "userId": item.user_uuid,
        "balance": item.balance,
        "frozenAmount": item.frozen,
        "totalRecharge": item.total_recharge,
        "totalConsumption": item.total_consume,
        "totalWithdraw": 0,  # 模型无此字段, 占位 0
        "updateTime": item.updated_at.isoformat() if getattr(item, "updated_at", None) else None,
    }


@router.get("", summary="获取当前登录用户资金信息")
def fund_info_current(
    user_uuid: str = Depends(require_login),
    db=Depends(_get_db),
):
    """前端 getUserFundInfo() 调用此端点, 从 token 解析当前用户."""
    item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
    if not item:
        return _ok(None, "资金信息不存在")
    return _ok(_to_dict(item))


@router.get("/list", summary="用户资金信息列表")
def fund_info_list(
    user_uuid: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    q = db.query(UserFundInfo)
    if user_uuid:
        q = q.filter(UserFundInfo.user_uuid == user_uuid)
    if status is not None:
        q = q.filter(UserFundInfo.status == status)
    total = q.count()
    items = q.order_by(UserFundInfo.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_to_dict(i) for i in items], "total": total})


@router.get("/user/{user_uuid}", summary="按用户查询资金信息")
def fund_info_by_user(user_uuid: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserFundInfo).filter(UserFundInfo.user_uuid == user_uuid).first()
    if not item:
        return _ok(None)
    return _ok(_to_dict(item))


@router.get("/{fund_id}", summary="用户资金信息详情")
def fund_info_get(fund_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserFundInfo).filter(UserFundInfo.id == fund_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="资金信息不存在")
    return _ok(_to_dict(item))


@router.post("", summary="新增用户资金信息")
def fund_info_create(req: FundInfoCreateReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = UserFundInfo(
        user_uuid=req.user_uuid, balance=req.balance, frozen=req.frozen,
        total_recharge=req.total_recharge, total_consume=req.total_consume, status=req.status,
    )
    db.add(item)
    db.flush()
    return _ok(_to_dict(item))


@router.put("", summary="更新用户资金信息")
def fund_info_update(req: FundInfoUpdateReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserFundInfo).filter(UserFundInfo.id == req.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="资金信息不存在")
    for field in ["balance", "frozen", "total_recharge", "total_consume", "status"]:
        val = getattr(req, field, None)
        if val is not None:
            setattr(item, field, val)
    return _ok(_to_dict(item))


@router.delete("/{fund_ids}", summary="删除用户资金信息")
def fund_info_delete(fund_ids: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    ids = [int(i) for i in fund_ids.split(",") if i.strip()]
    for fid in ids:
        item = db.query(UserFundInfo).filter(UserFundInfo.id == fid).first()
        if item:
            db.delete(item)
    return _ok()
