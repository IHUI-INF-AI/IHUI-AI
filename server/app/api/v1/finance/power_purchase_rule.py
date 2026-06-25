"""Power purchase rule API - 算力购买规则

迁移自 Java ai-smart-society-java: PowerPurchaseRuleController (6 端点)
对应模型: app.models.java_missing_models.PowerPurchaseRule (power_purchase_rule)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.java_missing_models import PowerPurchaseRule
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/power-purchase-rule", tags=["PowerPurchaseRule"])


class PowerPurchaseRuleReq(BaseModel):
    title: str
    status: int = 0
    begin_at: str | None = None
    end_at: str | None = None
    pic_explain: str | None = None
    field1: str | None = None


@router.get("/list", summary="算力购买规则列表")
def list_rules(
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.is_del == 0)
    if status is not None:
        q = q.filter(PowerPurchaseRule.status == status)
    total = q.count()
    items = q.order_by(PowerPurchaseRule.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [i.to_dict() for i in items], "total": total}, "msg": "ok"}


@router.get("/{rule_id}", summary="算力购买规则详情")
def get_rule(rule_id: str, db=Depends(_get_db)):
    item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id, PowerPurchaseRule.is_del == 0).first()
    if not item:
        raise HTTPException(status_code=404, detail="规则不存在")
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.post("", summary="新增算力购买规则")
def create_rule(req: PowerPurchaseRuleReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    from app.utils.datetime_helper import utcnow
    import uuid
    item = PowerPurchaseRule(
        id=str(uuid.uuid4().hex[:16]),
        title=req.title,
        status=req.status,
        begin_at=req.begin_at,
        end_at=req.end_at,
        pic_explain=req.pic_explain,
        field1=req.field1,
    )
    db.add(item)
    db.flush()
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.put("/{rule_id}", summary="更新算力购买规则")
def update_rule(rule_id: str, req: PowerPurchaseRuleReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="规则不存在")
    item.title = req.title
    item.status = req.status
    item.begin_at = req.begin_at
    item.end_at = req.end_at
    item.pic_explain = req.pic_explain
    item.field1 = req.field1
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.delete("/{rule_id}", summary="删除算力购买规则")
def delete_rule(rule_id: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="规则不存在")
    item.is_del = 1
    return {"code": 0, "msg": "ok"}


@router.put("/{rule_id}/status", summary="更新规则状态")
def update_status(rule_id: str, payload: dict = {}, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(PowerPurchaseRule).filter(PowerPurchaseRule.id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="规则不存在")
    item.status = payload.get("status", item.status)
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}
