"""Certificate Legacy Routes - 1:1 兼容 Java 历史项目.

完整迁移自 H:\\ihui-ai-edu-learn-service:
  - CertificateController         (8 端点)
  - CertificateTemplateController (7 端点)
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.security import get_current_user_id_flexible, require_login
from app.services import certificate_business

router = APIRouter(prefix="", tags=["Certificate-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

class CertificateCreateReq(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    awardingOrganization: str | None = None
    awarderName: str | None = None
    awarderPosition: str | None = None
    design: str | None = None
    awardConditions: str | None = None
    validityPolicy: str | None = None
    awardDate: str | None = None
    validity: str | None = None
    memberId: int | None = None
    lessonId: int | None = None
    score: int | None = None


class CertificateIdReq(BaseModel):
    id: int


class CertificateTemplateCreateReq(BaseModel):
    name: str
    description: str | None = None
    awardingOrganization: str | None = None
    awarderName: str | None = None
    awarderPosition: str | None = None
    design: str | None = None
    awardConditions: str | None = None
    validityPolicy: str | None = None


class CertificateTemplateUpdateReq(BaseModel):
    id: int
    name: str | None = None
    description: str | None = None
    awardingOrganization: str | None = None
    awarderName: str | None = None
    awarderPosition: str | None = None
    design: str | None = None
    awardConditions: str | None = None
    validityPolicy: str | None = None


class CertificateGetByLessonIdReq(BaseModel):
    lessonId: int


# ===========================================================================
# CertificateController (8 端点)
# ===========================================================================

@router.get("/certificate", summary="[Cert]获取证书详情")
def cert_get(id: int | None = None, memberId: int | None = None):
    if id is not None:
        return _ok(certificate_business.get_certificate(id))
    return _ok({})


@router.post("/certificate", summary="[Cert]创建证书")
def cert_create(req: CertificateCreateReq):
    try:
        return _ok(certificate_business.create_certificate(
            name=req.name, code=req.code, description=req.description,
            awarding_organization=req.awardingOrganization,
            awarder_name=req.awarderName, awarder_position=req.awarderPosition,
            design=req.design, award_conditions=req.awardConditions,
            validity_policy=req.validityPolicy, validity=req.validity,
            member_id=req.memberId, lesson_id=req.lessonId, score=req.score,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.get("/certificate/list", summary="[Cert]获取证书列表")
def cert_list(
    page: int = 1,
    pageSize: int = 20,
    memberId: int | None = None,
    lessonId: int | None = None,
    status: int | None = None,
):
    return _ok(certificate_business.list_certificates(
        page=page, page_size=pageSize, member_id=memberId, lesson_id=lessonId, status=status,
    ))


@router.get("/auth-api/certificate", summary="[Cert]获取证书详情(需登录)")
def cert_auth_get(id: int | None = None, _user: str = Depends(require_login)):
    if id is not None:
        return _ok(certificate_business.get_certificate(id))
    return _ok({})


@router.get("/auth-api/certificate/list", summary="[Cert]获取证书列表(需登录)")
def cert_auth_list(
    page: int = 1,
    pageSize: int = 20,
    lessonId: int | None = None,
    _user: str = Depends(require_login),
):
    member_id = get_current_user_id_flexible()
    return _ok(certificate_business.list_certificates(
        page=page, page_size=pageSize, member_id=member_id, lesson_id=lessonId,
    ))


@router.get("/auth-api/certificate/byLessonId", summary="[Cert]按课程ID获取证书")
def cert_by_lesson(req: CertificateGetByLessonIdReq = Depends(), _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(certificate_business.get_certificate_by_lesson(req.lessonId, member_id))


@router.delete("/certificate", summary="[Cert]删除证书")
def cert_delete(req: CertificateIdReq):
    return _ok({"deleted": certificate_business.delete_certificate(req.id)})


@router.put("/certificate/valid", summary="[Cert]恢复证书")
def cert_valid(req: CertificateIdReq):
    return _ok({"updated": certificate_business.valid_certificate(req.id)})


@router.put("/certificate/suspended", summary="[Cert]暂停证书")
def cert_suspended(req: CertificateIdReq):
    return _ok({"updated": certificate_business.suspended_certificate(req.id)})


@router.put("/certificate/revoked", summary="[Cert]撤销证书")
def cert_revoked(req: CertificateIdReq):
    return _ok({"updated": certificate_business.revoked_certificate(req.id)})


@router.put("/certificate/cancelled", summary="[Cert]注销证书")
def cert_cancelled(req: CertificateIdReq):
    return _ok({"updated": certificate_business.cancelled_certificate(req.id)})


@router.put("/certificate/expired", summary="[Cert]失效证书")
def cert_expired(req: CertificateIdReq):
    return _ok({"updated": certificate_business.expired_certificate(req.id)})


# ===========================================================================
# CertificateTemplateController (7 端点)
# ===========================================================================

@router.get("/certificate-template", summary="[CertTpl]获取证书模板")
def cert_tpl_get(id: int | None = None):
    if id is not None:
        return _ok(certificate_business.get_certificate_template(id))
    return _ok({})


@router.get("/auth-api/certificate-template", summary="[CertTpl]获取证书模板(需登录)")
def cert_tpl_auth_get(id: int | None = None, _user: str = Depends(require_login)):
    if id is not None:
        return _ok(certificate_business.get_certificate_template(id))
    return _ok({})


@router.get("/certificate-template/list", summary="[CertTpl]获取证书模板列表")
def cert_tpl_list(
    page: int = 1,
    pageSize: int = 20,
    name: str | None = None,
    status: int | None = None,
):
    return _ok(certificate_business.list_certificate_templates(
        page=page, page_size=pageSize, name=name, status=status,
    ))


@router.post("/certificate-template", summary="[CertTpl]创建证书模板")
def cert_tpl_create(req: CertificateTemplateCreateReq):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(certificate_business.create_certificate_template(
            name=req.name, description=req.description,
            awarding_organization=req.awardingOrganization,
            awarder_name=req.awarderName, awarder_position=req.awarderPosition,
            design=req.design, award_conditions=req.awardConditions,
            validity_policy=req.validityPolicy,
            create_user_id=member_id,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/certificate-template", summary="[CertTpl]更新证书模板")
def cert_tpl_update(req: CertificateTemplateUpdateReq):
    member_id = get_current_user_id_flexible()
    return _ok(certificate_business.update_certificate_template(
        template_id=req.id, name=req.name, description=req.description,
        awarding_organization=req.awardingOrganization,
        awarder_name=req.awarderName, awarder_position=req.awarderPosition,
        design=req.design, award_conditions=req.awardConditions,
        validity_policy=req.validityPolicy,
        update_user_id=member_id,
    ))


@router.delete("/certificate-template", summary="[CertTpl]删除证书模板")
def cert_tpl_delete(req: CertificateIdReq):
    certificate_business.delete_certificate_template(req.id)
    return _ok()


@router.put("/certificate-template/active", summary="[CertTpl]启用证书模板")
def cert_tpl_active(req: CertificateIdReq):
    certificate_business.active_certificate_template(req.id)
    return _ok()


@router.put("/certificate-template/inactive", summary="[CertTpl]禁用证书模板")
def cert_tpl_inactive(req: CertificateIdReq):
    certificate_business.inactive_certificate_template(req.id)
    return _ok()
