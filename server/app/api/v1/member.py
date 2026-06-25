"""Member routes - 接入 member_service (13 个新 model 业务方法).

提供 会员 / 公司 / 标签 / 岗位 / 分组 / 等级 / 签到 / 关注 等 CRUD 的 HTTP 接入.

注意: 本文件只负责 HTTP 层, 业务逻辑在 app.services.member_service.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import require_login
from app.services import member_service

router = APIRouter(prefix="/member", tags=["Member"])


# ---------------------------------------------------------------------------
# Pydantic 模型
# ---------------------------------------------------------------------------

class CreateMemberReq(BaseModel):
    name: str
    mobile: str | None = None
    open_id: str | None = None
    union_id: str | None = None
    company_id: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class CreateCompanyReq(BaseModel):
    name: str
    company_type_id: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class CreateTagReq(BaseModel):
    name: str


class CreatePostReq(BaseModel):
    name: str


class CreateGroupReq(BaseModel):
    name: str


class CreateLevelReq(BaseModel):
    name: str
    conditions: int = 0


class CheckinReq(BaseModel):
    member_id: str


class FollowReq(BaseModel):
    member_id: str
    follow_member_id: str


def _to_dict(obj: Any) -> dict[str, Any]:
    """ORM 对象 → dict (仅导出常规列)."""
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


# ---------------------------------------------------------------------------
# EduMember
# ---------------------------------------------------------------------------

@router.get("/{member_id}", summary="查询会员详情")
def get_member(member_id: str, _user: str = Depends(require_login)):
    m = member_service.get_edu_member(member_id)
    if not m:
        raise HTTPException(status_code=404, detail="会员不存在")
    return {"code": 0, "data": _to_dict(m), "msg": "ok"}


@router.get("/by/mobile/{mobile}", summary="按手机号查询会员")
def get_member_by_mobile(mobile: str, _user: str = Depends(require_login)):
    m = member_service.get_edu_member_by_mobile(mobile)
    if not m:
        raise HTTPException(status_code=404, detail="会员不存在")
    return {"code": 0, "data": _to_dict(m), "msg": "ok"}


@router.get("/by/openid/{open_id}", summary="按 open_id 查询会员")
def get_member_by_openid(open_id: str, _user: str = Depends(require_login)):
    m = member_service.get_edu_member_by_openid(open_id)
    if not m:
        raise HTTPException(status_code=404, detail="会员不存在")
    return {"code": 0, "data": _to_dict(m), "msg": "ok"}


@router.post("", summary="创建会员")
def create_member(req: CreateMemberReq, _user: str = Depends(require_login)):
    m = member_service.create_edu_member(
        name=req.name,
        mobile=req.mobile,
        open_id=req.open_id,
        union_id=req.union_id,
        company_id=req.company_id,
        **req.extra,
    )
    return {"code": 0, "data": _to_dict(m), "msg": "ok"}


# ---------------------------------------------------------------------------
# EduMemberCompany
# ---------------------------------------------------------------------------

@router.post("/company", summary="创建会员公司")
def create_company(req: CreateCompanyReq, _user: str = Depends(require_login)):
    c = member_service.create_company(name=req.name, company_type_id=req.company_type_id, **req.extra)
    return {"code": 0, "data": _to_dict(c), "msg": "ok"}


@router.post("/company/{company_id}/members/{member_id}", summary="绑定会员到公司")
def add_member_to_company(company_id: str, member_id: str, _user: str = Depends(require_login)):
    r = member_service.add_member_to_company(member_id=member_id, company_id=company_id)
    return {"code": 0, "data": _to_dict(r), "msg": "ok"}


@router.get("/{member_id}/companies", summary="会员所属公司列表")
def list_member_companies(member_id: str, _user: str = Depends(require_login)):
    items = member_service.list_member_companies(member_id)
    return {"code": 0, "data": [_to_dict(c) for c in items], "msg": "ok"}


# ---------------------------------------------------------------------------
# EduMemberTag
# ---------------------------------------------------------------------------

@router.post("/tag", summary="创建会员标签")
def create_tag(req: CreateTagReq, _user: str = Depends(require_login)):
    t = member_service.create_tag(name=req.name)
    return {"code": 0, "data": _to_dict(t), "msg": "ok"}


@router.post("/tag/{tag_id}/members/{member_id}", summary="给会员打标签")
def tag_member(tag_id: str, member_id: str, _user: str = Depends(require_login)):
    r = member_service.tag_member(member_id=member_id, tag_id=tag_id)
    return {"code": 0, "data": _to_dict(r), "msg": "ok"}


@router.get("/{member_id}/tags", summary="查询会员标签")
def list_member_tags(member_id: str, _user: str = Depends(require_login)):
    items = member_service.list_member_tags(member_id)
    return {"code": 0, "data": [_to_dict(t) for t in items], "msg": "ok"}


# ---------------------------------------------------------------------------
# EduMemberPost / Group
# ---------------------------------------------------------------------------

@router.post("/post", summary="创建会员岗位")
def create_post(req: CreatePostReq, _user: str = Depends(require_login)):
    p = member_service.create_post(name=req.name)
    return {"code": 0, "data": _to_dict(p), "msg": "ok"}


@router.post("/post/{post_id}/members/{member_id}", summary="分配岗位")
def assign_post(post_id: str, member_id: str, _user: str = Depends(require_login)):
    r = member_service.assign_post(member_id=member_id, post_id=post_id)
    return {"code": 0, "data": _to_dict(r), "msg": "ok"}


@router.post("/group", summary="创建会员分组")
def create_group(req: CreateGroupReq, _user: str = Depends(require_login)):
    g = member_service.create_group(name=req.name)
    return {"code": 0, "data": _to_dict(g), "msg": "ok"}


@router.post("/group/{group_id}/members/{member_id}", summary="添加会员到分组")
def add_to_group(group_id: str, member_id: str, _user: str = Depends(require_login)):
    r = member_service.add_to_group(member_id=member_id, group_id=group_id)
    return {"code": 0, "data": _to_dict(r), "msg": "ok"}


# ---------------------------------------------------------------------------
# EduMemberLevel
# ---------------------------------------------------------------------------

@router.post("/level", summary="创建会员等级")
def create_level(req: CreateLevelReq, _user: str = Depends(require_login)):
    lv = member_service.create_level(name=req.name, conditions=req.conditions)
    return {"code": 0, "data": _to_dict(lv), "msg": "ok"}


@router.post("/level/{level_id}/grant/{member_id}", summary="授予会员等级")
def grant_level(level_id: str, member_id: str, _user: str = Depends(require_login)):
    r = member_service.grant_level(member_id=member_id, level_id=level_id)
    return {"code": 0, "data": _to_dict(r), "msg": "ok"}


# ---------------------------------------------------------------------------
# EduCheckIn / EduCheckInRecord
# ---------------------------------------------------------------------------

@router.post("/checkin", summary="会员签到")
def do_checkin(req: CheckinReq, _user: str = Depends(require_login)):
    ci, rec = member_service.do_checkin(member_id=req.member_id)
    return {
        "code": 0,
        "data": {
            "summary": _to_dict(ci),
            "record": _to_dict(rec),
        },
        "msg": "ok",
    }


@router.get("/{member_id}/checkin-records", summary="会员签到记录")
def list_checkin_records(
    member_id: str,
    limit: int = Query(30, ge=1, le=100),
    _user: str = Depends(require_login),
):
    items = member_service.list_checkin_records(member_id, limit=limit)
    return {"code": 0, "data": [_to_dict(r) for r in items], "msg": "ok"}


# ---------------------------------------------------------------------------
# EduFollow
# ---------------------------------------------------------------------------

@router.post("/follow", summary="关注会员")
def follow_member(req: FollowReq, _user: str = Depends(require_login)):
    f = member_service.follow_member(req.member_id, req.follow_member_id)
    return {"code": 0, "data": _to_dict(f), "msg": "ok"}


@router.delete("/follow", summary="取消关注")
def unfollow_member(req: FollowReq, _user: str = Depends(require_login)):
    ok = member_service.unfollow_member(req.member_id, req.follow_member_id)
    if not ok:
        raise HTTPException(status_code=404, detail="未关注")
    return {"code": 0, "msg": "ok"}


@router.get("/{member_id}/following", summary="关注列表")
def list_following(member_id: str, _user: str = Depends(require_login)):
    items = member_service.list_following(member_id)
    return {"code": 0, "data": [_to_dict(f) for f in items], "msg": "ok"}
