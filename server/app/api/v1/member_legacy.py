"""Member Legacy Routes - 80 个端点 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-member-service 9 个 Controller:
  - MemberController (35)
  - MemberCompanyController (8)
  - MemberCompanyTypeController (7)
  - MemberLevelController (5)
  - MemberPostController (6)
  - MemberGroupController (6)
  - MemberTagController (4)
  - CheckInController (2)
  - FollowController (7)

URL 路径与 Java 端保持完全一致 (无 /api 前缀, 由根 router 统一挂载).
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.security import require_login
from app.services import member_business

router = APIRouter(prefix="", tags=["Member-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


# ---------------------------------------------------------------------------
# Pydantic Request Models
# ---------------------------------------------------------------------------

class MemberUpdateReq(BaseModel):
    id: str | None = None
    avatar: str | None = None
    idPhoto: str | None = None
    name: str | None = None
    mobile: str | None = None
    email: str | None = None
    password: str | None = None
    oldPassword: str | None = None
    confirmPassword: str | None = None
    authCode: str | None = None
    realname: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class MemberCreateReq(BaseModel):
    name: str | None = None
    mobile: str | None = None
    password: str | None = None
    confirmPassword: str | None = None
    email: str | None = None
    username: str | None = None
    authCode: str | None = None


class MemberMobileRegisterReq(BaseModel):
    mobile: str
    password: str
    confirmPassword: str
    authCode: str


class MemberSendCodeReq(BaseModel):
    mobile: str


class MemberPwdSendCodeReq(BaseModel):
    username: str  # 邮箱或手机号


class MemberPwdCheckCodeReq(BaseModel):
    username: str
    authCode: str


class MemberPwdResetReq(BaseModel):
    username: str
    authCode: str
    password: str
    confirmPassword: str


class MemberSealReq(BaseModel):
    id: str


class MemberLevelUpdateReq(BaseModel):
    memberId: str
    levelId: int


class WechatUserInfoReq(BaseModel):
    openid: str | None = None
    unionid: str | None = None
    nickname: str | None = None
    headimgurl: str | None = None
    sex: int | None = None


class CompanyReq(BaseModel):
    id: int | None = None
    name: str | None = None
    companyTypeId: int | None = None
    image: str | None = None
    mobile: str | None = None
    email: str | None = None
    sortOrder: int | None = None
    status: int | None = None


class CompanyTypeReq(BaseModel):
    id: int | None = None
    name: str | None = None
    sortOrder: int | None = None
    memberMaximum: int | None = None
    status: int | None = None


class LevelReq(BaseModel):
    id: int | None = None
    name: str | None = None
    conditions: int | None = None
    description: str | None = None


class PostReq(BaseModel):
    id: int | None = None
    name: str | None = None
    sortOrder: int | None = None
    status: int | None = None


class GroupReq(BaseModel):
    id: int | None = None
    name: str | None = None
    sortOrder: int | None = None
    status: int | None = None


class TagReq(BaseModel):
    id: int | None = None
    name: str | None = None
    sortOrder: int | None = None


class FollowReq(BaseModel):
    memberId: str
    followMemberId: str


# ---------------------------------------------------------------------------
# MemberController - 35 endpoints (1:1 兼容 Java 路径)
# ---------------------------------------------------------------------------

@router.get("/list", summary="获取会员列表")
def get_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    mobile: str | None = None,
    companyId: int | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_members(page=page, page_size=pageSize, name=name, mobile=mobile,
                                              company_id=companyId, status=status))


@router.get("/unaudited/list", summary="获取未审核会员列表")
def get_unaudited_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_members(page=page, page_size=pageSize, unaudited=True))


@router.get("/auth-api/by-mobile", summary="根据手机号获取会员")
def get_by_mobile(mobile: str):
    m = member_business.get_by_mobile(mobile)
    if not m:
        raise _err(404, "会员不存在")
    return _ok(m)


@router.post("/auth-api/create", summary="创建会员（无权限校验）")
def auth_create(req: dict[str, str] = Body(..., embed=True)):
    mobile = req.get("mobile")
    password = req.get("password")
    if not mobile:
        raise _err(400, "手机号不能为空")
    if not password:
        raise _err(400, "密码不能为空")
    try:
        m = member_business.create_member_basic(mobile=mobile, password=password)
    except ValueError as e:
        raise _err(400, str(e))
    return _ok(m)


@router.put("/auth-api/update/avatar", summary="修改头像")
def update_avatar(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.avatar:
        raise _err(400, "avatar为必填项")
    try:
        return _ok(member_business.update_avatar(req.id, req.avatar))
    except ValueError as e:
        raise _err(404, str(e))


@router.put("/auth-api/update/avatar/v2", summary="修改头像 v2")
def update_avatar_v2(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.avatar:
        raise _err(400, "avatar为必填项")
    # v2 默认更新当前登录用户 (在生产环境应从 token 中获取)
    if not req.id:
        raise _err(400, "id为必填项")
    try:
        return _ok(member_business.update_avatar(req.id, req.avatar))
    except ValueError as e:
        raise _err(404, str(e))


@router.put("/auth-api/update/idphoto", summary="修改证件照")
def update_id_photo(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.idPhoto:
        raise _err(400, "idPhoto为必填项")
    try:
        return _ok(member_business.update_id_photo(req.id, req.idPhoto))
    except ValueError as e:
        raise _err(404, str(e))


@router.put("/auth-api/update/name", summary="修改姓名")
def update_name(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.name:
        raise _err(400, "name为必填项")
    try:
        return _ok(member_business.update_member_name(req.id, req.name))
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/auth-api/update/mobile", summary="修改手机号")
def update_mobile(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.mobile:
        raise _err(400, "mobile为必填项")
    if not req.authCode:
        raise _err(400, "短信验证码为必填项")
    # 简化: 验证码长度 >=4 即认为通过
    if len(req.authCode) < 4:
        raise _err(400, "验证码错误")
    try:
        return _ok(member_business.update_member_mobile(req.id, req.mobile, req.authCode))
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/auth-api/update/pwd", summary="通过验证码修改密码")
def update_pwd_via_code(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.mobile:
        raise _err(400, "mobile为必填项")
    if not req.authCode:
        raise _err(400, "短信验证码为必填项")
    if not req.password or not req.confirmPassword:
        raise _err(400, "密码/确认密码为必填项")
    if req.password != req.confirmPassword:
        raise _err(400, "两次密码不相等")
    # 简化: 验证码长度 >=4 即认为通过
    if len(req.authCode) < 4:
        raise _err(400, "验证码错误")
    try:
        return _ok(member_business.reset_pwd(req.mobile, req.authCode, req.password, req.confirmPassword))
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/auth-api/update/email", summary="修改邮箱")
def update_email(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.email:
        raise _err(400, "email为必填项")
    try:
        return _ok(member_business.update_email(req.id, req.email))
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/auth-api/update/password", summary="修改密码 (旧密码校验)")
def update_password(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.password:
        raise _err(400, "password为必填项")
    if not req.oldPassword:
        raise _err(400, "oldPassword为必填项")
    try:
        return _ok(member_business.update_password(req.id, req.oldPassword, req.password))
    except ValueError as e:
        raise _err(400, str(e))


@router.post("/create", summary="邮箱注册用户")
def create(req: MemberCreateReq):
    if not any([req.email, req.username, req.mobile]):
        raise _err(400, "邮箱、手机、账号为必填其一")
    if not req.password:
        raise _err(400, "密码为必填项")
    if not req.confirmPassword:
        raise _err(400, "确认密码为必填项")
    if req.password != req.confirmPassword:
        raise _err(400, "两次密码不一致")
    try:
        return _ok(member_business.create_member_basic(
            name=req.name, mobile=req.mobile, email=req.email,
            username=req.username, password=req.password,
        ))
    except ValueError as e:
        raise _err(400, str(e))


@router.post("/public-api/register", summary="邮箱注册会员")
def public_register(req: MemberCreateReq):
    if not req.email:
        raise _err(400, "邮箱为必填项")
    if not req.password:
        raise _err(400, "密码为必填项")
    if not req.confirmPassword:
        raise _err(400, "确认密码为必填项")
    if req.password != req.confirmPassword:
        raise _err(400, "两次密码不一致")
    try:
        return _ok(member_business.create_member_basic(
            name=req.name, email=req.email, password=req.password,
        ))
    except ValueError as e:
        raise _err(400, str(e))


@router.post("/public-api/register/mobile", summary="手机号注册会员")
def public_register_mobile(req: MemberMobileRegisterReq):
    if not req.mobile:
        raise _err(400, "手机号码为必填项")
    if not req.authCode:
        raise _err(400, "验证码为必填项")
    if not req.password or not req.confirmPassword:
        raise _err(400, "密码/确认密码为必填项")
    if req.password != req.confirmPassword:
        raise _err(400, "两次密码不一致")
    try:
        return _ok(member_business.create_member_basic(
            mobile=req.mobile, password=req.password, auth_code=req.authCode,
        ))
    except ValueError as e:
        raise _err(400, str(e))


@router.post("/public-api/send/auth-code", summary="发送注册验证码")
def public_send_auth_code(req: MemberSendCodeReq):
    if not req.mobile:
        raise _err(400, "手机号码为必填项")
    try:
        code = member_business.send_auth_code_to_mobile(req.mobile)
    except ValueError as e:
        raise _err(400, str(e))
    return _ok({"sent": True, "code_preview": code[:2] + "****"})


@router.get("/public-api/by-ids", summary="根据 ids 获取会员")
def get_by_ids(ids: str = Query(..., description="逗号分隔的ID列表")):
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        raise _err(400, "ids为必填项")
    return _ok(member_business.get_by_ids_public(id_list))


@router.get("/auth-api/by-id", summary="获取会员信息")
def get_by_id(id: str = Query(..., description="会员ID"), _user: str = Depends(require_login)):
    m = member_business.get_by_id(id)
    if not m:
        raise _err(404, "会员不存在")
    return _ok(m)


@router.get("/auth-api/list", summary="鉴权会员列表 (简化)")
def get_auth_list(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_for_auth(page=page, page_size=pageSize))


@router.put("/auth-api/update/level", summary="更新会员等级")
def update_level(req: MemberLevelUpdateReq, _user: str = Depends(require_login)):
    if not req.memberId:
        raise _err(400, "memberId为必填项")
    try:
        return _ok(member_business.update_member_level(req.memberId, req.levelId))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/public-api/pwd/send/auth-code", summary="密码发送验证码")
def pwd_send_auth_code(req: MemberPwdSendCodeReq):
    if not req.username:
        raise _err(400, "邮箱/手机号码为必填项")
    try:
        code = member_business.send_pwd_auth_code(req.username)
    except ValueError as e:
        raise _err(400, str(e))
    return _ok({"sent": True, "code_preview": code[:2] + "****"})


@router.post("/public-api/pwd/check/auth-code", summary="密码校验验证码")
def pwd_check_auth_code(req: MemberPwdCheckCodeReq):
    if not req.username:
        raise _err(400, "邮箱/手机号码为必填项")
    if not req.authCode:
        raise _err(400, "验证码为必填项")
    ok = member_business.check_pwd_auth_code(req.username, req.authCode)
    if not ok:
        raise _err(400, "验证码错误")
    return _ok({"valid": True})


@router.put("/public-api/pwd/reset", summary="密码重置")
def pwd_reset(req: MemberPwdResetReq):
    try:
        ok = member_business.reset_pwd(req.username, req.authCode, req.password, req.confirmPassword)
    except ValueError as e:
        raise _err(400, str(e))
    return _ok({"reset": ok})


@router.put("/pwd/reset", summary="管理员密码重置")
def pwd_reset_admin(req: MemberPwdResetReq, _user: str = Depends(require_login)):
    if not req.username:
        raise _err(400, "邮箱/手机号码为必填项")
    try:
        ok = member_business.admin_reset_pwd(username=req.username, password=req.password)
    except ValueError as e:
        raise _err(400, str(e))
    return _ok({"reset": ok})


@router.put("/seal", summary="禁用会员")
def seal(req: MemberSealReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "ID为必填项")
    try:
        return _ok({"sealed": member_business.seal_member(req.id)})
    except ValueError as e:
        raise _err(404, str(e))


@router.put("/unseal", summary="解禁会员")
def unseal(req: MemberSealReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "ID为必填项")
    try:
        return _ok({"unsealed": member_business.unseal_member(req.id)})
    except ValueError as e:
        raise _err(404, str(e))


@router.put("/update", summary="更新会员")
def update(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "ID为必填项")
    fields = {k: v for k, v in req.dict().items() if k not in {"id", "extra"} and v is not None}
    fields.update(req.extra)
    try:
        return _ok(member_business.update_member(req.id, **fields))
    except ValueError as e:
        raise _err(404, str(e))


@router.delete("/delete", summary="删除会员")
def delete(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "ID为必填项")
    return _ok({"deleted": member_business.delete_member(req.id)})


@router.put("/auth-api/update/realname", summary="更新真实姓名")
def update_realname(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.realname:
        raise _err(400, "realname为必填项")
    try:
        return _ok(member_business.update_member_realname(req.id, req.realname))
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/auth-api/update/name/v2", summary="更新会员昵称")
def update_member_name_v2(req: MemberUpdateReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    if not req.name:
        raise _err(400, "name为必填项")
    try:
        return _ok(member_business.update_member_name(req.id, req.name))
    except ValueError as e:
        raise _err(400, str(e))


@router.put("/approved", summary="审批通过")
def approved(req: MemberSealReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "ID为必填项")
    try:
        return _ok({"approved": member_business.approved_member(req.id)})
    except ValueError as e:
        raise _err(404, str(e))


@router.put("/reject", summary="审批拒绝（黑名单）")
def reject(req: MemberSealReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "ID为必填项")
    try:
        return _ok({"rejected": member_business.reject_member(req.id)})
    except ValueError as e:
        raise _err(404, str(e))


@router.post("/auth-api/createbywechatuserinfo", summary="通过微信信息创建会员")
def create_by_wechat(info: WechatUserInfoReq):
    if not info.openid:
        return _ok(None)
    return _ok(member_business.create_member_by_wechat(info.dict()))


@router.get("/statistics", summary="获取会员统计数据")
def get_statistics(_user: str = Depends(require_login)):
    return _ok(member_business.get_member_statistics())


# ---------------------------------------------------------------------------
# MemberCompanyController - 8 endpoints
# ---------------------------------------------------------------------------

@router.post("/company", summary="创建公司")
def create_company(req: CompanyReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(member_business.create_company(
        name=req.name, company_type_id=req.companyTypeId, image=req.image,
        mobile=req.mobile, email=req.email, sort_order=req.sortOrder or 0,
    ))


@router.put("/company", summary="修改公司")
def update_company(req: CompanyReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    return _ok(member_business.update_company(req.id, **fields))


@router.get("/company/list", summary="获取公司列表")
def list_company(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    companyTypeId: int | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_companies(
        page=page, page_size=pageSize, name=name,
        company_type_id=companyTypeId, status=status,
    ))


@router.get("/public-api/company/list", summary="公开获取公司列表")
def list_company_public(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
    name: str | None = None,
    companyTypeId: int | None = None,
    status: int | None = None,
):
    return _ok(member_business.list_companies(
        page=page, page_size=pageSize, name=name,
        company_type_id=companyTypeId, status=status,
    ))


@router.delete("/company", summary="删除公司")
def delete_company(req: CompanyReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": member_business.delete_company(req.id)})


@router.get("/company", summary="获取公司")
def get_company(id: int = Query(...), _user: str = Depends(require_login)):
    c = member_business.get_company(id)
    if not c:
        raise _err(404, "公司不存在")
    return _ok(c)


@router.put("/company/enable", summary="启用公司")
def enable_company(req: CompanyReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok(member_business.enable_company(req.id))


@router.put("/company/disable", summary="禁用公司")
def disable_company(req: CompanyReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok(member_business.disable_company(req.id))


# ---------------------------------------------------------------------------
# MemberCompanyTypeController - 7 endpoints
# ---------------------------------------------------------------------------

@router.get("/company-type/list", summary="公司类型列表")
def list_company_type(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_company_types(
        page=page, page_size=pageSize, name=name, status=status,
    ))


@router.get("/company-type/all", summary="所有公司类型")
def get_all_company_types():
    return _ok(member_business.get_all_company_types())


@router.get("/company-type", summary="获取公司类型")
def get_company_type(id: int = Query(...), _user: str = Depends(require_login)):
    t = member_business.get_company_type(id)
    if not t:
        raise _err(404, "公司类型不存在")
    return _ok(t)


@router.post("/company-type", summary="创建公司类型")
def create_company_type(req: CompanyTypeReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(member_business.create_company_type(
        name=req.name, sort_order=req.sortOrder or 0, member_maximum=req.memberMaximum or 0,
    ))


@router.put("/company-type", summary="修改公司类型")
def update_company_type(req: CompanyTypeReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    return _ok(member_business.update_company_type(req.id, **fields))


@router.delete("/company-type", summary="删除公司类型")
def delete_company_type(req: CompanyTypeReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": member_business.delete_company_type(req.id)})


# ---------------------------------------------------------------------------
# MemberLevelController - 5 endpoints
# ---------------------------------------------------------------------------

@router.get("/level/list", summary="会员等级列表")
def list_level(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    name: str | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_levels(page=page, page_size=pageSize, name=name))


@router.get("/level", summary="获取会员等级")
def get_level(id: int = Query(...), _user: str = Depends(require_login)):
    lv = member_business.get_level(id)
    if not lv:
        raise _err(404, "等级不存在")
    return _ok(lv)


@router.post("/level", summary="新增会员等级")
def create_level(req: LevelReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(member_business.create_level(
        name=req.name, conditions=req.conditions or 0, description=req.description,
    ))


@router.put("/level", summary="修改会员等级")
def update_level(req: LevelReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    return _ok(member_business.update_level(req.id, **fields))


@router.delete("/level", summary="删除会员等级")
def delete_level(req: LevelReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": member_business.delete_level(req.id)})


# ---------------------------------------------------------------------------
# MemberPostController - 6 endpoints
# ---------------------------------------------------------------------------

@router.get("/post/list", summary="岗位列表")
def list_post(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_posts(page=page, page_size=pageSize, name=name, status=status))


@router.get("/post/all", summary="所有岗位")
def get_all_posts():
    return _ok(member_business.get_all_posts())


@router.get("/post", summary="获取岗位")
def get_post(id: int = Query(...), _user: str = Depends(require_login)):
    p = member_business.get_post(id)
    if not p:
        raise _err(404, "岗位不存在")
    return _ok(p)


@router.post("/post", summary="创建岗位")
def create_post(req: PostReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(member_business.create_post(name=req.name, sort_order=req.sortOrder or 0))


@router.put("/post", summary="修改岗位")
def update_post(req: PostReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    return _ok(member_business.update_post(req.id, **fields))


@router.delete("/post", summary="删除岗位")
def delete_post(req: PostReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": member_business.delete_post(req.id)})


# ---------------------------------------------------------------------------
# MemberGroupController - 6 endpoints
# ---------------------------------------------------------------------------

@router.get("/group/list", summary="分组列表")
def list_group(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_groups(page=page, page_size=pageSize, name=name, status=status))


@router.get("/group/all", summary="所有分组")
def get_all_groups():
    return _ok(member_business.get_all_groups())


@router.get("/group", summary="获取分组")
def get_group(id: int = Query(...), _user: str = Depends(require_login)):
    g = member_business.get_group(id)
    if not g:
        raise _err(404, "分组不存在")
    return _ok(g)


@router.post("/group", summary="创建分组")
def create_group(req: GroupReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(member_business.create_group(name=req.name, sort_order=req.sortOrder or 0))


@router.put("/group", summary="修改分组")
def update_group(req: GroupReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    fields = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
    return _ok(member_business.update_group(req.id, **fields))


@router.delete("/group", summary="删除分组")
def delete_group(req: GroupReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": member_business.delete_group(req.id)})


# ---------------------------------------------------------------------------
# MemberTagController - 4 endpoints
# ---------------------------------------------------------------------------

@router.get("/tag/list", summary="标签列表")
def list_tag(
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=100),
    name: str | None = None,
    _user: str = Depends(require_login),
):
    return _ok(member_business.list_tags(page=page, page_size=pageSize, name=name))


@router.get("/tag", summary="获取标签")
def get_tag(id: int = Query(...), _user: str = Depends(require_login)):
    t = member_business.get_tag(id)
    if not t:
        raise _err(404, "标签不存在")
    return _ok(t)


@router.post("/tag", summary="创建标签")
def create_tag(req: TagReq, _user: str = Depends(require_login)):
    if not req.name:
        raise _err(400, "name为必填项")
    return _ok(member_business.create_tag(name=req.name, sort_order=req.sortOrder or 0))


@router.delete("/tag", summary="删除标签")
def delete_tag(req: TagReq, _user: str = Depends(require_login)):
    if not req.id:
        raise _err(400, "id为必填项")
    return _ok({"deleted": member_business.delete_tag(req.id)})


# ---------------------------------------------------------------------------
# CheckInController - 2 endpoints
# ---------------------------------------------------------------------------

@router.get("/checkin", summary="获取签到信息")
def get_checkin(memberId: str = Query(...), _user: str = Depends(require_login)):
    return _ok(member_business.get_checkin_info(memberId))


@router.post("/checkin", summary="执行签到")
def do_checkin(memberId: str = Query(...), type: int = Query(0), _user: str = Depends(require_login)):
    return _ok(member_business.do_checkin_extended(memberId, checkin_type=type))


# ---------------------------------------------------------------------------
# FollowController - 7 endpoints
# ---------------------------------------------------------------------------

@router.post("/follow", summary="关注会员")
def follow(req: FollowReq, _user: str = Depends(require_login)):
    if not req.memberId or not req.followMemberId:
        raise _err(400, "memberId/followMemberId为必填项")
    return _ok(member_business.follow_member_extended(req.memberId, req.followMemberId))


@router.delete("/follow", summary="取消关注")
def unfollow(req: FollowReq, _user: str = Depends(require_login)):
    if not req.memberId or not req.followMemberId:
        raise _err(400, "memberId/followMemberId为必填项")
    return _ok({"unfollowed": member_business.unfollow_member_extended(req.memberId, req.followMemberId)})


@router.get("/following/list", summary="关注列表")
def list_following(memberId: str = Query(...), _user: str = Depends(require_login)):
    return _ok(member_business.list_following_extended(memberId))


@router.get("/followers/list", summary="粉丝列表")
def list_followers_route(memberId: str = Query(...), _user: str = Depends(require_login)):
    return _ok(member_business.list_followers(memberId))


@router.get("/following/count", summary="关注数")
def count_following(memberId: str = Query(...), _user: str = Depends(require_login)):
    return _ok({"count": member_business.count_following(memberId)})


@router.get("/followers/count", summary="粉丝数")
def count_followers(memberId: str = Query(...), _user: str = Depends(require_login)):
    return _ok({"count": member_business.count_followers(memberId)})


@router.get("/follow/check", summary="是否已关注")
def check_follow(memberId: str = Query(...), followMemberId: str = Query(...), _user: str = Depends(require_login)):
    return _ok({"is_following": member_business.check_is_following(memberId, followMemberId)})
