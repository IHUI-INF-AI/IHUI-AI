"""Legacy supplement API - 封存前补齐的 16 个部分缺失 Controller (54 端点)

迁移自:
  - edu Java 微服务 (usercenter-service): DepartmentController, CompanyController, LecturerController
  - edu Java 微服务 (member-service): 部分补齐
  - ai-smart-society-java: ZhsActivityController, ZhsInformationController, UserAgentImageController,
    ZhsAgentSettlementController, ZhsAgentUsedetailController, UserAuthInfoController,
    UserThirdPartyAccountController, AiFileStorageController, ZhsOperateTokenFlowController
  - ZHS_Server_java: ZhsCoursePayLogController, ZhsUserCommentLogController, ZhsUserVideoCommentController

模型路径汇总 (已通过 Grep 验证):
  - Activity            → app.models.activity_models          (zhs_activity)
  - Information         → app.models.app_content_models       (zhs_information)
  - UserAgentImage      → app.models.context_models           (zhs_user_agent_image)
  - AdminDept           → app.models.admin_models             (admin_dept) [Department 别名]
  - Company             → app.models.java_missing_models      (zhs_company) [新增]
  - AgentSettlement     → app.models.agent_settlement         (zhs_agent_settlement)
  - AgentUsedetail      → app.api.v1.agent_usedetail.agent_usedetail  (zhs_agent_usedetail)
  - Lecturer            → app.models.live_models              (zhs_lecturer)
  - UserAuthInfo        → app.models.user_models              (zhs_user_auth_info)
  - UserThirdPartyAccount → app.models.user_models            (zhs_user_third_party_account)
  - AiFileStorage       → app.models.app_content_models       (zhs_file_storage)
  - ZhsCoursePayLog     → app.models.education_ext_models     (zhs_course_pay_log)
  - ZhsUserCommentLog   → app.models.education_ext_models     (zhs_user_comment_log)
  - ZhsUserVideoComment → app.models.education_ext_models     (zhs_user_video_comment)
  - ZhsOperateTokenFlow → app.models.token_models             (zhs_operate_token_flow)
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import inspect

from app.database import get_session
from app.models.activity_models import Activity
from app.models.admin_models import AdminDept
from app.models.agent_settlement import AgentSettlement
from app.models.app_content_models import AiFileStorage, Information
from app.models.context_models import UserAgentImage
from app.models.education_ext_models import (
    ZhsCoursePayLog,
    ZhsUserCommentLog,
    ZhsUserVideoComment,
)
from app.models.java_missing_models import Company
from app.models.live_models import Lecturer
from app.models.token_models import ZhsOperateTokenFlow
from app.models.user_models import UserAuthInfo, UserThirdPartyAccount
from app.api.v1.agent_usedetail.agent_usedetail import AgentUsedetail
from app.security import require_login


def _get_db():
    with get_session() as db:
        yield db


router = APIRouter(prefix="", tags=["Legacy-Supplement"])


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _row_to_dict(obj: Any) -> dict:
    """通用 ORM 行转 dict, 兼容不同模型字段."""
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    try:
        for col in obj.__table__.columns:
            v = getattr(obj, col.name, None)
            if hasattr(v, "isoformat"):
                v = v.isoformat()
            out[col.name] = v
    except Exception:
        # 兜底: 用 inspect
        try:
            for col in inspect(obj).mapper.column_attrs:
                v = getattr(obj, col.key, None)
                if hasattr(v, "isoformat"):
                    v = v.isoformat()
                out[col.key] = v
        except Exception:
            logger.debug("legacy_supplement _to_dict failed for %s", type(obj).__name__, exc_info=True)
    return out


def _apply_filters(q, model, **filters):
    for k, v in filters.items():
        if v is not None:
            col = getattr(model, k, None)
            if col is not None:
                q = q.filter(col == v)
    return q


# ===========================================================================
# 1. ZhsActivityController (6 端点) - 模型: Activity (zhs_activity)
# ===========================================================================

@router.get("/activity/list", summary="[Activity]活动列表")
def activity_list(
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(Activity)
    if status is not None:
        q = q.filter(Activity.status == status)
    total = q.count()
    items = q.order_by(Activity.begin_time.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/activity/{activity_id}", summary="[Activity]活动详情")
def activity_get(activity_id: str, db=Depends(_get_db)):
    item = db.query(Activity).filter(Activity.id == activity_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="活动不存在")
    return _ok(_row_to_dict(item))


@router.post("/activity", summary="[Activity]新增活动")
def activity_create(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = Activity(**{k: v for k, v in payload.items() if hasattr(Activity, k)})
    db.add(item)
    db.flush()
    return _ok(_row_to_dict(item))


@router.put("/activity", summary="[Activity]更新活动")
def activity_update(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    activity_id = payload.get("id")
    if not activity_id:
        raise HTTPException(status_code=400, detail="id 必填")
    item = db.query(Activity).filter(Activity.id == activity_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="活动不存在")
    for k, v in payload.items():
        if hasattr(item, k):
            setattr(item, k, v)
    return _ok(_row_to_dict(item))


@router.delete("/activity/{activity_id}", summary="[Activity]删除活动")
def activity_delete(activity_id: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(Activity).filter(Activity.id == activity_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="活动不存在")
    db.delete(item)
    return _ok()


@router.put("/activity/status/{activity_id}", summary="[Activity]更新活动状态")
def activity_status(activity_id: str, payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(Activity).filter(Activity.id == activity_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="活动不存在")
    item.status = payload.get("status", item.status)
    return _ok(_row_to_dict(item))


# ===========================================================================
# 2. ZhsInformationController (5 端点) - 模型: Information (zhs_information)
# ===========================================================================

@router.get("/information/list", summary="[Information]资讯列表")
def information_list(
    title: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(Information)
    if title:
        q = q.filter(Information.title.like(f"%{title}%"))
    if status is not None:
        q = q.filter(Information.status == status)
    total = q.count()
    items = q.order_by(Information.sort.asc(), Information.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/information/{info_id}", summary="[Information]资讯详情")
def information_get(info_id: int, db=Depends(_get_db)):
    item = db.query(Information).filter(Information.id == info_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="资讯不存在")
    return _ok(_row_to_dict(item))


@router.post("/information", summary="[Information]新增资讯")
def information_create(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = Information(**{k: v for k, v in payload.items() if hasattr(Information, k)})
    db.add(item)
    db.flush()
    return _ok(_row_to_dict(item))


@router.put("/information", summary="[Information]更新资讯")
def information_update(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    info_id = payload.get("id")
    if not info_id:
        raise HTTPException(status_code=400, detail="id 必填")
    item = db.query(Information).filter(Information.id == info_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="资讯不存在")
    for k, v in payload.items():
        if hasattr(item, k):
            setattr(item, k, v)
    return _ok(_row_to_dict(item))


@router.delete("/information/{info_id}", summary="[Information]删除资讯")
def information_delete(info_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(Information).filter(Information.id == info_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="资讯不存在")
    db.delete(item)
    return _ok()


# ===========================================================================
# 3. ZhsUserAgentImageController (4 端点) - 模型: UserAgentImage (zhs_user_agent_image)
# ===========================================================================

@router.get("/user-agent-image/list", summary="[UserAgentImage]用户图片列表")
def user_agent_image_list(
    user_id: str | None = None,
    agent_id: str | None = None,
    image_type: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(UserAgentImage)
    if user_id:
        q = q.filter(UserAgentImage.user_id == user_id)
    if agent_id:
        q = q.filter(UserAgentImage.agent_id == agent_id)
    if image_type:
        q = q.filter(UserAgentImage.image_type == image_type)
    total = q.count()
    items = q.order_by(UserAgentImage.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/user-agent-image/{image_id}", summary="[UserAgentImage]图片详情")
def user_agent_image_get(image_id: int, db=Depends(_get_db)):
    item = db.query(UserAgentImage).filter(UserAgentImage.id == image_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="图片不存在")
    return _ok(_row_to_dict(item))


@router.delete("/user-agent-image/{image_id}", summary="[UserAgentImage]删除图片")
def user_agent_image_delete(image_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserAgentImage).filter(UserAgentImage.id == image_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="图片不存在")
    db.delete(item)
    return _ok()


@router.get("/user-agent-image/user/{user_id}", summary="[UserAgentImage]按用户查询")
def user_agent_image_by_user(user_id: str, db=Depends(_get_db)):
    items = db.query(UserAgentImage).filter(UserAgentImage.user_id == user_id).all()
    return _ok([_row_to_dict(i) for i in items])


# ===========================================================================
# 4. DepartmentController (5 端点) - 模型: AdminDept (admin_dept)
# ===========================================================================

@router.get("/department/list", summary="[Department]部门列表")
def department_list(
    dept_name: str | None = None,
    status: str | None = None,
    db=Depends(_get_db),
):
    q = db.query(AdminDept).filter(AdminDept.del_flag == "0")
    if dept_name:
        q = q.filter(AdminDept.dept_name.like(f"%{dept_name}%"))
    if status:
        q = q.filter(AdminDept.status == status)
    items = q.order_by(AdminDept.dept_id.asc()).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": len(items)})


@router.get("/department/{dept_id}", summary="[Department]部门详情")
def department_get(dept_id: int, db=Depends(_get_db)):
    item = db.query(AdminDept).filter(AdminDept.dept_id == dept_id, AdminDept.del_flag == "0").first()
    if not item:
        raise HTTPException(status_code=404, detail="部门不存在")
    return _ok(_row_to_dict(item))


@router.post("/department", summary="[Department]新增部门")
def department_create(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = AdminDept(**{k: v for k, v in payload.items() if hasattr(AdminDept, k)})
    db.add(item)
    db.flush()
    return _ok(_row_to_dict(item))


@router.put("/department", summary="[Department]更新部门")
def department_update(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    dept_id = payload.get("dept_id")
    if not dept_id:
        raise HTTPException(status_code=400, detail="dept_id 必填")
    item = db.query(AdminDept).filter(AdminDept.dept_id == dept_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="部门不存在")
    for k, v in payload.items():
        if hasattr(item, k):
            setattr(item, k, v)
    return _ok(_row_to_dict(item))


@router.delete("/department/{dept_id}", summary="[Department]删除部门")
def department_delete(dept_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(AdminDept).filter(AdminDept.dept_id == dept_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="部门不存在")
    item.del_flag = "2"
    return _ok()


# ===========================================================================
# 5. CompanyController (5 端点) - 模型: Company (zhs_company)
# ===========================================================================

@router.get("/company/list", summary="[Company]公司列表")
def company_list(
    name: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(Company).filter(Company.is_del == 0)
    if name:
        q = q.filter(Company.name.like(f"%{name}%"))
    if status is not None:
        q = q.filter(Company.status == status)
    total = q.count()
    items = q.order_by(Company.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [i.to_dict() for i in items], "total": total})


@router.get("/company/{company_id}", summary="[Company]公司详情")
def company_get(company_id: int, db=Depends(_get_db)):
    item = db.query(Company).filter(Company.id == company_id, Company.is_del == 0).first()
    if not item:
        raise HTTPException(status_code=404, detail="公司不存在")
    return _ok(item.to_dict())


@router.post("/company", summary="[Company]新增公司")
def company_create(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = Company(**{k: v for k, v in payload.items() if hasattr(Company, k)})
    db.add(item)
    db.flush()
    return _ok(item.to_dict())


@router.put("/company", summary="[Company]更新公司")
def company_update(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    company_id = payload.get("id")
    if not company_id:
        raise HTTPException(status_code=400, detail="id 必填")
    item = db.query(Company).filter(Company.id == company_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="公司不存在")
    for k, v in payload.items():
        if hasattr(item, k):
            setattr(item, k, v)
    return _ok(item.to_dict())


@router.delete("/company/{company_id}", summary="[Company]删除公司")
def company_delete(company_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(Company).filter(Company.id == company_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="公司不存在")
    item.is_del = 1
    return _ok()


# ===========================================================================
# 6. ZhsAgentSettlementController (3 端点) - 模型: AgentSettlement (zhs_agent_settlement)
# ===========================================================================

@router.get("/agent-settlement/list", summary="[AgentSettlement]结算记录列表")
def agent_settlement_list(
    uuid: str | None = None,
    agent_id: str | None = None,
    settlement: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(AgentSettlement)
    if uuid:
        q = q.filter(AgentSettlement.uuid == uuid)
    if agent_id:
        q = q.filter(AgentSettlement.agent_id == agent_id)
    if settlement is not None:
        q = q.filter(AgentSettlement.settlement == settlement)
    total = q.count()
    items = q.order_by(AgentSettlement.create_time.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/agent-settlement/{settlement_id}", summary="[AgentSettlement]结算详情")
def agent_settlement_get(settlement_id: str, db=Depends(_get_db)):
    item = db.query(AgentSettlement).filter(AgentSettlement.id == settlement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="结算记录不存在")
    return _ok(_row_to_dict(item))


@router.get("/agent-settlement/order/{order_no}", summary="[AgentSettlement]按订单查询")
def agent_settlement_by_order(order_no: str, db=Depends(_get_db)):
    items = db.query(AgentSettlement).filter(AgentSettlement.order_no == order_no).all()
    return _ok([_row_to_dict(i) for i in items])


# ===========================================================================
# 7. ZhsAgentUsedetailController (3 端点) - 模型: AgentUsedetail (zhs_agent_usedetail)
# ===========================================================================

@router.get("/agent-usedetail/list", summary="[AgentUsedetail]使用明细列表")
def agent_usedetail_list(
    agent_id: str | None = None,
    user_id: str | None = None,
    type: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(AgentUsedetail)
    if agent_id:
        q = q.filter(AgentUsedetail.agent_id == agent_id)
    if user_id:
        q = q.filter(AgentUsedetail.user_id == user_id)
    if type:
        q = q.filter(AgentUsedetail.type == type)
    total = q.count()
    items = q.order_by(AgentUsedetail.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/agent-usedetail/{detail_id}", summary="[AgentUsedetail]使用明细详情")
def agent_usedetail_get(detail_id: int, db=Depends(_get_db)):
    item = db.query(AgentUsedetail).filter(AgentUsedetail.id == detail_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="明细不存在")
    return _ok(_row_to_dict(item))


@router.get("/agent-usedetail/agent/{agent_id}", summary="[AgentUsedetail]按Agent查询")
def agent_usedetail_by_agent(agent_id: str, db=Depends(_get_db)):
    items = db.query(AgentUsedetail).filter(AgentUsedetail.agent_id == agent_id).all()
    return _ok([_row_to_dict(i) for i in items])


# ===========================================================================
# 8. LecturerController (5 端点) - 模型: Lecturer (zhs_lecturer)
# ===========================================================================

@router.get("/lecturer/list", summary="[Lecturer]讲师列表")
def lecturer_list(
    name: str | None = None,
    status: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(Lecturer)
    if name:
        q = q.filter(Lecturer.name.like(f"%{name}%"))
    if status is not None:
        q = q.filter(Lecturer.status == status)
    total = q.count()
    items = q.order_by(Lecturer.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/lecturer/{lecturer_id}", summary="[Lecturer]讲师详情")
def lecturer_get(lecturer_id: int, db=Depends(_get_db)):
    item = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="讲师不存在")
    return _ok(_row_to_dict(item))


@router.post("/lecturer", summary="[Lecturer]新增讲师")
def lecturer_create(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = Lecturer(**{k: v for k, v in payload.items() if hasattr(Lecturer, k)})
    db.add(item)
    db.flush()
    return _ok(_row_to_dict(item))


@router.put("/lecturer", summary="[Lecturer]更新讲师")
def lecturer_update(payload: dict, _user: str = Depends(require_login), db=Depends(_get_db)):
    lecturer_id = payload.get("id")
    if not lecturer_id:
        raise HTTPException(status_code=400, detail="id 必填")
    item = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="讲师不存在")
    for k, v in payload.items():
        if hasattr(item, k):
            setattr(item, k, v)
    return _ok(_row_to_dict(item))


@router.delete("/lecturer/{lecturer_id}", summary="[Lecturer]删除讲师")
def lecturer_delete(lecturer_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(Lecturer).filter(Lecturer.id == lecturer_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="讲师不存在")
    db.delete(item)
    return _ok()


# ===========================================================================
# 9. UserAuthInfoController (3 端点) - 模型: UserAuthInfo (zhs_user_auth_info)
# ===========================================================================

@router.get("/user-auth-info/list", summary="[UserAuthInfo]用户认证信息列表")
def user_auth_info_list(
    user_uuid: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(UserAuthInfo)
    if user_uuid:
        q = q.filter(UserAuthInfo.user_uuid == user_uuid)
    total = q.count()
    items = q.offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/user-auth-info/{auth_user_uuid}", summary="[UserAuthInfo]认证信息详情")
def user_auth_info_get(auth_user_uuid: str, db=Depends(_get_db)):
    item = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == auth_user_uuid).first()
    if not item:
        raise HTTPException(status_code=404, detail="认证信息不存在")
    return _ok(_row_to_dict(item))


@router.get("/user-auth-info/user/{user_uuid}", summary="[UserAuthInfo]按用户查询")
def user_auth_info_by_user(user_uuid: str, db=Depends(_get_db)):
    items = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).all()
    return _ok([_row_to_dict(i) for i in items])


# ===========================================================================
# 10. UserThirdPartyAccountController (3 端点) - 模型: UserThirdPartyAccount
# ===========================================================================

@router.get("/user-third-party-account/list", summary="[UserThirdPartyAccount]三方账号列表")
def user_third_party_account_list(
    user_uuid: str | None = None,
    platform: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(UserThirdPartyAccount).filter(UserThirdPartyAccount.deleted_at.is_(None))
    if user_uuid:
        q = q.filter(UserThirdPartyAccount.user_uuid == user_uuid)
    if platform:
        q = q.filter(UserThirdPartyAccount.platform == platform)
    total = q.count()
    items = q.order_by(UserThirdPartyAccount.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/user-third-party-account/{account_id}", summary="[UserThirdPartyAccount]三方账号详情")
def user_third_party_account_get(account_id: int, db=Depends(_get_db)):
    item = db.query(UserThirdPartyAccount).filter(
        UserThirdPartyAccount.id == account_id,
        UserThirdPartyAccount.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="三方账号不存在")
    return _ok(_row_to_dict(item))


@router.delete("/user-third-party-account/{account_id}", summary="[UserThirdPartyAccount]删除三方账号")
def user_third_party_account_delete(account_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserThirdPartyAccount).filter(UserThirdPartyAccount.id == account_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="三方账号不存在")
    db.delete(item)
    return _ok()


# ===========================================================================
# 11. AiFileStorageController (3 端点) - 模型: AiFileStorage (zhs_file_storage)
# ===========================================================================

@router.get("/file-storage/list", summary="[AiFileStorage]文件存储列表")
def file_storage_list(
    file_name: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(AiFileStorage)
    if file_name:
        q = q.filter(AiFileStorage.file_name.like(f"%{file_name}%"))
    total = q.count()
    items = q.order_by(AiFileStorage.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/file-storage/{file_id}", summary="[AiFileStorage]文件详情")
def file_storage_get(file_id: int, db=Depends(_get_db)):
    item = db.query(AiFileStorage).filter(AiFileStorage.id == file_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="文件不存在")
    return _ok(_row_to_dict(item))


@router.delete("/file-storage/{file_id}", summary="[AiFileStorage]删除文件")
def file_storage_delete(file_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(AiFileStorage).filter(AiFileStorage.id == file_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="文件不存在")
    db.delete(item)
    return _ok()


# ===========================================================================
# 12. ZhsCoursePayLogController (2 端点) - 模型: ZhsCoursePayLog
# ===========================================================================

@router.get("/course-pay-log/list", summary="[ZhsCoursePayLog]课程支付日志列表")
def course_pay_log_list(
    user_id: str | None = None,
    course_id: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsCoursePayLog)
    if user_id:
        q = q.filter(ZhsCoursePayLog.user_id == user_id)
    if course_id:
        q = q.filter(ZhsCoursePayLog.course_id == course_id)
    total = q.count()
    items = q.order_by(ZhsCoursePayLog.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/course-pay-log/{log_id}", summary="[ZhsCoursePayLog]支付日志详情")
def course_pay_log_get(log_id: int, db=Depends(_get_db)):
    item = db.query(ZhsCoursePayLog).filter(ZhsCoursePayLog.id == log_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="日志不存在")
    return _ok(_row_to_dict(item))


# ===========================================================================
# 13. ZhsUserCommentLogController (3 端点) - 模型: ZhsUserCommentLog
# ===========================================================================

@router.get("/user-comment-log/list", summary="[ZhsUserCommentLog]评论日志列表")
def user_comment_log_list(
    user_id: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsUserCommentLog)
    if user_id:
        q = q.filter(ZhsUserCommentLog.user_id == user_id)
    total = q.count()
    items = q.order_by(ZhsUserCommentLog.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/user-comment-log/{log_id}", summary="[ZhsUserCommentLog]评论日志详情")
def user_comment_log_get(log_id: int, db=Depends(_get_db)):
    item = db.query(ZhsUserCommentLog).filter(ZhsUserCommentLog.id == log_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="日志不存在")
    return _ok(_row_to_dict(item))


@router.delete("/user-comment-log/{log_id}", summary="[ZhsUserCommentLog]删除评论日志")
def user_comment_log_delete(log_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsUserCommentLog).filter(ZhsUserCommentLog.id == log_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="日志不存在")
    db.delete(item)
    return _ok()


# ===========================================================================
# 14. ZhsUserVideoCommentController (2 端点) - 模型: ZhsUserVideoComment
# ===========================================================================

@router.get("/user-video-comment/list", summary="[ZhsUserVideoComment]视频评论列表")
def user_video_comment_list(
    user_id: str | None = None,
    video_id: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsUserVideoComment)
    if user_id:
        q = q.filter(ZhsUserVideoComment.user_id == user_id)
    if video_id:
        q = q.filter(ZhsUserVideoComment.video_id == video_id)
    total = q.count()
    items = q.order_by(ZhsUserVideoComment.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/user-video-comment/{comment_id}", summary="[ZhsUserVideoComment]视频评论详情")
def user_video_comment_get(comment_id: int, db=Depends(_get_db)):
    item = db.query(ZhsUserVideoComment).filter(ZhsUserVideoComment.id == comment_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="评论不存在")
    return _ok(_row_to_dict(item))


# ===========================================================================
# 15. ZhsOperateTokenFlowController (2 端点) - 模型: ZhsOperateTokenFlow
# ===========================================================================

@router.get("/operate-token-flow/list", summary="[ZhsOperateTokenFlow]Token流水列表")
def operate_token_flow_list(
    user_id: str | None = None,
    operate: int | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    q = db.query(ZhsOperateTokenFlow)
    if user_id:
        q = q.filter(ZhsOperateTokenFlow.user_id == user_id)
    if operate is not None:
        q = q.filter(ZhsOperateTokenFlow.operate == operate)
    total = q.count()
    items = q.order_by(ZhsOperateTokenFlow.id.desc()).offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/operate-token-flow/user/{user_id}", summary="[ZhsOperateTokenFlow]按用户查询流水")
def operate_token_flow_by_user(user_id: str, db=Depends(_get_db)):
    items = db.query(ZhsOperateTokenFlow).filter(ZhsOperateTokenFlow.user_id == user_id).all()
    return _ok([_row_to_dict(i) for i in items])
