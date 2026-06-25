"""Agent category link API - Agent 与分类关联关系

迁移自 ai-smart-society-java: AgentCategoryLinkController (6 端点)
对应模型: app.models.agent_rule_models.AgentCategoryLink (agent_category_link)

注意: router.py 注册时附加 prefix="/agents/category-link", 因此本 router 不再设置 prefix.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.agent_rule_models import AgentCategoryLink
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="", tags=["Agent Category Link"])


class CategoryLinkCreateReq(BaseModel):
    agent_id: str
    category_id: int


class CategoryLinkUpdateReq(BaseModel):
    id: int
    agent_id: str | None = None
    category_id: int | None = None


def _ok(data=None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _to_dict(item: AgentCategoryLink) -> dict:
    return {
        "id": item.id,
        "agentId": item.agent_id,
        "categoryId": item.category_id,
        "createTime": item.create_time.isoformat() if getattr(item, "create_time", None) else None,
    }


@router.get("/list", summary="Agent 分类关联列表")
def category_link_list(
    agent_id: str | None = None,
    category_id: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(AgentCategoryLink)
    if agent_id:
        q = q.filter(AgentCategoryLink.agent_id == agent_id)
    if category_id is not None:
        q = q.filter(AgentCategoryLink.category_id == category_id)
    total = q.count()
    items = q.order_by(AgentCategoryLink.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_to_dict(i) for i in items], "total": total})


@router.get("/{link_id}", summary="Agent 分类关联详情")
def category_link_get(link_id: int, db=Depends(_get_db)):
    item = db.query(AgentCategoryLink).filter(AgentCategoryLink.id == link_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="关联不存在")
    return _ok(_to_dict(item))


@router.post("", summary="新增 Agent 分类关联")
def category_link_create(req: CategoryLinkCreateReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = AgentCategoryLink(agent_id=req.agent_id, category_id=req.category_id)
    db.add(item)
    db.flush()
    return _ok(_to_dict(item))


@router.put("", summary="更新 Agent 分类关联")
def category_link_update(req: CategoryLinkUpdateReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(AgentCategoryLink).filter(AgentCategoryLink.id == req.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="关联不存在")
    if req.agent_id is not None:
        item.agent_id = req.agent_id
    if req.category_id is not None:
        item.category_id = req.category_id
    return _ok(_to_dict(item))


@router.delete("/{link_ids}", summary="删除 Agent 分类关联")
def category_link_delete(link_ids: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    ids = [int(i) for i in link_ids.split(",") if i.strip()]
    for lid in ids:
        item = db.query(AgentCategoryLink).filter(AgentCategoryLink.id == lid).first()
        if item:
            db.delete(item)
    return _ok()


@router.get("/category/{category_id}", summary="按分类查询关联")
def category_link_by_category(category_id: int, db=Depends(_get_db)):
    items = db.query(AgentCategoryLink).filter(AgentCategoryLink.category_id == category_id).all()
    return _ok([_to_dict(i) for i in items])
