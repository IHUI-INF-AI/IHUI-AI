"""Legacy supplement API - 封存前补齐的 3 个前端调用但路径未对齐的 Controller

2026-06-26 对接联调修复:
  经端点级核查, 原有 15 个 Controller 中:
  - 11 个被现有模块覆盖/路径冲突/前端无调用 → 已删除
    (Activity/Information/UserAgentImage/Department/Company/AgentSettlement/
     AgentUsedetail/Lecturer/FileStorage/UserCommentLog/UserVideoComment/
     OperateTokenFlow)
  - 3 个路径不匹配前端实际调用 → 保留并修改路径对齐前端
    (UserAuthInfo → /auth_info, UserThirdPartyAccount → /auth_accounts,
     ZhsCoursePayLog → /coursePayLog)

模型路径:
  - UserAuthInfo          → app.models.user_models          (user_auth_info)
  - UserThirdPartyAccount → app.models.user_models          (user_third_party_accounts)
  - ZhsCoursePayLog       → app.models.education_ext_models (zhs_course_pay_log)

前端调用证据:
  - client/src/api/auth/auth-info.ts:30      → /auth_info (snake_case)
  - client/src/api/auth/auth-accounts.ts:28   → /auth_accounts (snake_case 复数)
  - client/src/api/course/course-pay-log.ts:33 → /coursePayLog (camelCase)
  (均经 /api-kou 代理, 需在 vite.config.ts prefixMaps 追加映射)
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import inspect

from app.database import get_session
from app.models.education_ext_models import ZhsCoursePayLog
from app.models.user_models import UserAuthInfo, UserThirdPartyAccount
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
        try:
            for col in inspect(obj).mapper.column_attrs:
                v = getattr(obj, col.key, None)
                if hasattr(v, "isoformat"):
                    v = v.isoformat()
                out[col.key] = v
        except Exception:
            logger.debug("legacy_supplement _row_to_dict failed for %s", type(obj).__name__, exc_info=True)
    return out


# ===========================================================================
# 1. UserAuthInfoController (3 端点) - 路径: /auth_info (对齐前端 auth-info.ts)
# 模型: UserAuthInfo (user_auth_info, 主键 user_uuid)
# ===========================================================================

@router.get("/auth_info/list", summary="[UserAuthInfo]用户认证信息列表")
def user_auth_info_list(
    user_uuid: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    q = db.query(UserAuthInfo)
    if user_uuid:
        q = q.filter(UserAuthInfo.user_uuid == user_uuid)
    total = q.count()
    items = q.offset((page - 1) * size).limit(size).all()
    return _ok({"list": [_row_to_dict(i) for i in items], "total": total})


@router.get("/auth_info/{auth_user_uuid}", summary="[UserAuthInfo]认证信息详情")
def user_auth_info_get(auth_user_uuid: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == auth_user_uuid).first()
    if not item:
        return _ok(None, "认证信息不存在")
    return _ok(_row_to_dict(item))


@router.get("/auth_info/user/{user_uuid}", summary="[UserAuthInfo]按用户查询")
def user_auth_info_by_user(user_uuid: str, _user: str = Depends(require_login), db=Depends(_get_db)):
    items = db.query(UserAuthInfo).filter(UserAuthInfo.user_uuid == user_uuid).all()
    return _ok([_row_to_dict(i) for i in items])


# ===========================================================================
# 2. UserThirdPartyAccountController (3 端点) - 路径: /auth_accounts (对齐前端 auth-accounts.ts)
# 模型: UserThirdPartyAccount (user_third_party_accounts)
# ===========================================================================

@router.get("/auth_accounts/list", summary="[UserThirdPartyAccount]三方账号列表")
def user_third_party_account_list(
    user_uuid: str | None = None,
    platform: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
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


@router.get("/auth_accounts/{account_id}", summary="[UserThirdPartyAccount]三方账号详情")
def user_third_party_account_get(account_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserThirdPartyAccount).filter(
        UserThirdPartyAccount.id == account_id,
        UserThirdPartyAccount.deleted_at.is_(None),
    ).first()
    if not item:
        return _ok(None, "三方账号不存在")
    return _ok(_row_to_dict(item))


@router.delete("/auth_accounts/{account_id}", summary="[UserThirdPartyAccount]删除三方账号")
def user_third_party_account_delete(account_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(UserThirdPartyAccount).filter(UserThirdPartyAccount.id == account_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="三方账号不存在")
    db.delete(item)
    return _ok(msg="删除成功")


# ===========================================================================
# 3. ZhsCoursePayLogController (2 端点) - 路径: /coursePayLog (对齐前端 course-pay-log.ts)
# 模型: ZhsCoursePayLog (zhs_course_pay_log)
# ===========================================================================

@router.get("/coursePayLog/list", summary="[ZhsCoursePayLog]课程支付日志列表")
def course_pay_log_list(
    user_id: str | None = None,
    course_id: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: str = Depends(require_login),
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


@router.get("/coursePayLog/{log_id}", summary="[ZhsCoursePayLog]支付日志详情")
def course_pay_log_get(log_id: int, _user: str = Depends(require_login), db=Depends(_get_db)):
    item = db.query(ZhsCoursePayLog).filter(ZhsCoursePayLog.id == log_id).first()
    if not item:
        return _ok(None, "日志不存在")
    return _ok(_row_to_dict(item))
