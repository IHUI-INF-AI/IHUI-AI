"""User sys link API - 普通用户与系统用户对应关系

迁移自 Java ai-smart-society-java: ZhsUserSysLinkController (6 端点)
对应模型: app.models.java_missing_models.ZhsUserSysLink (zhs_user_sys_link)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.models.java_missing_models import ZhsUserSysLink
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="/user-sys-link", tags=["UserSysLink"])


class UserSysLinkReq(BaseModel):
    user_uuid: str
    sys_user_id: str
    field1: str | None = None
    status: int = 0


@router.get("/list", summary="用户系统链接列表")
def list_links(
    user_uuid: str | None = None,
    sys_user_id: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.is_del == 0)
    if user_uuid:
        q = q.filter(ZhsUserSysLink.user_uuid == user_uuid)
    if sys_user_id:
        q = q.filter(ZhsUserSysLink.sys_user_id == sys_user_id)
    total = q.count()
    items = q.order_by(ZhsUserSysLink.created_at.desc()).offset((page - 1) * size).limit(size).all()
    return {"code": 0, "data": {"list": [i.to_dict() for i in items], "total": total}, "msg": "ok"}


@router.get("/{link_id}", summary="用户系统链接详情")
def get_link(link_id: int, db=Depends(_get_db)):
    item = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.id == link_id, ZhsUserSysLink.is_del == 0).first()
    if not item:
        raise HTTPException(status_code=404, detail="链接不存在")
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.post("", summary="新增用户系统链接")
def create_link(req: UserSysLinkReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = ZhsUserSysLink(
        user_uuid=req.user_uuid,
        sys_user_id=req.sys_user_id,
        field1=req.field1,
        status=req.status,
    )
    db.add(item)
    db.flush()
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.put("/{link_id}", summary="更新用户系统链接")
def update_link(link_id: int, req: UserSysLinkReq, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.id == link_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="链接不存在")
    item.user_uuid = req.user_uuid
    item.sys_user_id = req.sys_user_id
    item.field1 = req.field1
    item.status = req.status
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}


@router.delete("/{link_id}", summary="删除用户系统链接")
def delete_link(link_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsUserSysLink).filter(ZhsUserSysLink.id == link_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="链接不存在")
    item.is_del = 1
    return {"code": 0, "msg": "ok"}


@router.get("/by-uuid/{user_uuid}", summary="按用户UUID查询链接")
def get_by_uuid(user_uuid: str, db=Depends(_get_db)):
    item = db.query(ZhsUserSysLink).filter(
        ZhsUserSysLink.user_uuid == user_uuid,
        ZhsUserSysLink.is_del == 0,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="链接不存在")
    return {"code": 0, "data": item.to_dict(), "msg": "ok"}
