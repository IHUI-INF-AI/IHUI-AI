"""Agent category link API - Agent 分类关联

迁移自 Java ai-smart-society-java: AgentCategoryLinkController (6 端点)
补充封存前缺失的 Agent 分类关联管理功能
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/agents/category-link", tags=["AgentCategoryLink"])


class CategoryLinkReq(BaseModel):
    agent_id: str
    category_id: str
    sort_order: int = 0


class ReorderReq(BaseModel):
    items: list[dict]


@router.get("/list", summary="分类关联列表")
def list_links(
    agent_id: str | None = None,
    category_id: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """分类关联列表 (迁移自 Java: AgentCategoryLinkController.list)"""
    from app.models.agent_rule_models import AgentCategoryLink
    q = db.query(AgentCategoryLink)
    if agent_id:
        q = q.filter(AgentCategoryLink.agent_id == agent_id)
    if category_id:
        q = q.filter(AgentCategoryLink.category_id == category_id)
    total = q.count()
    items = q.order_by(AgentCategoryLink.id.asc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [_to_dict(i) for i in items], "total": total}, "msg": "ok"}


@router.post("", summary="绑定分类")
def bind_category(req: CategoryLinkReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    """绑定分类 (迁移自 Java: AgentCategoryLinkController.bind)"""
    from app.models.agent_rule_models import AgentCategoryLink
    existing = db.query(AgentCategoryLink).filter(
        AgentCategoryLink.agent_id == req.agent_id,
        AgentCategoryLink.category_id == int(req.category_id),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该关联已存在")
    item = AgentCategoryLink(agent_id=req.agent_id, category_id=int(req.category_id))
    db.add(item)
    db.flush()
    return {"code": 0, "data": _to_dict(item), "msg": "ok"}


@router.delete("/{link_id}", summary="解绑分类")
def unbind_category(link_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    """解绑分类 (迁移自 Java: AgentCategoryLinkController.unbind)"""
    from app.models.agent_rule_models import AgentCategoryLink
    item = db.query(AgentCategoryLink).filter(AgentCategoryLink.id == link_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="关联不存在")
    db.delete(item)
    return {"code": 0, "msg": "ok"}


@router.get("/by-agent/{agent_id}", summary="按 Agent 查询分类")
def list_by_agent(agent_id: str, db=Depends(_get_db)):
    """按 Agent 查询分类 (迁移自 Java: AgentCategoryLinkController.listByAgent)"""
    from app.models.agent_rule_models import AgentCategoryLink
    items = db.query(AgentCategoryLink).filter(AgentCategoryLink.agent_id == agent_id).order_by(AgentCategoryLink.id.asc()).all()
    return {"code": 0, "data": [_to_dict(i) for i in items], "msg": "ok"}


@router.get("/by-category/{category_id}", summary="按分类查询 Agent")
def list_by_category(category_id: int, db=Depends(_get_db)):
    """按分类查询 Agent (迁移自 Java: AgentCategoryLinkController.listByCategory)"""
    from app.models.agent_rule_models import AgentCategoryLink
    items = db.query(AgentCategoryLink).filter(AgentCategoryLink.category_id == category_id).order_by(AgentCategoryLink.id.asc()).all()
    return {"code": 0, "data": [_to_dict(i) for i in items], "msg": "ok"}


def _to_dict(row) -> dict:
    return {c.name: getattr(row, c.name) for c in row.__table__.columns}
