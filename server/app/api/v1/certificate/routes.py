"""证书模块 - 证书模板 CRUD + 颁发记录"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.certificate_models import Certificate, CertificateTemplate
from app.schemas.common import error, success

router = APIRouter()


def _tpl_to_dict(t: CertificateTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "awarding_organization": t.awarding_organization,
        "awarder_name": t.awarder_name,
        "awarder_position": t.awarder_position,
        "design": t.design,
        "award_conditions": t.award_conditions,
        "validity_policy": t.validity_policy,
        "status": t.status,
        "company_id": t.company_id,
        "create_user_id": t.create_user_id,
        "create_user_name": t.create_user_name,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _cert_to_dict(c: Certificate) -> dict:
    return {
        "id": c.id,
        "certificate_id": c.certificate_id,
        "code": c.code,
        "name": c.name,
        "description": c.description,
        "awarding_organization": c.awarding_organization,
        "awarder_name": c.awarder_name,
        "awarder_position": c.awarder_position,
        "design": c.design,
        "award_conditions": c.award_conditions,
        "validity_policy": c.validity_policy,
        "award_date": c.award_date.isoformat() if c.award_date else None,
        "validity": c.validity.isoformat() if c.validity else None,
        "status": c.status,
        "member_id": c.member_id,
        "lesson_id": c.lesson_id,
        "lesson_sign_id": c.lesson_sign_id,
        "lesson_sign_time": c.lesson_sign_time.isoformat() if c.lesson_sign_time else None,
        "lesson_complete_time": c.lesson_complete_time.isoformat() if c.lesson_complete_time else None,
        "score": c.score,
        "company_id": c.company_id,
        "create_user_id": c.create_user_id,
        "create_user_name": c.create_user_name,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


# ============ 证书模板 ============


@router.get("/template/list", summary="证书模板列表")
async def list_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = None,
    status: str | None = None,
    company_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CertificateTemplate)
            if keyword:
                q = q.filter(CertificateTemplate.name.like(f"%{keyword}%"))
            if status:
                q = q.filter(CertificateTemplate.status == status)
            if company_id:
                q = q.filter(CertificateTemplate.company_id == company_id)
            total = q.count()
            items = q.order_by(CertificateTemplate.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_tpl_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"certificate template list error: {e}")
            return error(str(e))


@router.get("/template/{tid}", summary="证书模板详情")
async def get_template(tid: int):
    with get_session() as db:
        try:
            t = db.query(CertificateTemplate).filter(CertificateTemplate.id == tid).first()
            if not t:
                return error("证书模板不存在", "404")
            return success(_tpl_to_dict(t))
        except Exception as e:
            logger.error(f"certificate template get error: {e}")
            return error(str(e))


@router.post("/template", summary="创建证书模板")
async def create_template(
    name: str = Query(..., min_length=1, max_length=200),
    description: str | None = None,
    awarding_organization: str | None = None,
    awarder_name: str | None = None,
    awarder_position: str | None = None,
    design: str | None = None,
    award_conditions: str | None = None,
    validity_policy: str | None = None,
    status: str = "inactive",
    company_id: int | None = None,
    create_user_id: int | None = None,
    create_user_name: str | None = None,
):
    with get_session() as db:
        try:
            t = CertificateTemplate(
                name=name,
                description=description or "",
                awarding_organization=awarding_organization or "",
                awarder_name=awarder_name or "",
                awarder_position=awarder_position or "",
                design=design or "",
                award_conditions=award_conditions or "",
                validity_policy=validity_policy or "",
                status=status,
                company_id=company_id,
                create_user_id=create_user_id,
                create_user_name=create_user_name or "",
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"certificate template create error: {e}")
            return error(str(e))


@router.put("/template/{tid}", summary="修改证书模板")
async def update_template(
    tid: int,
    name: str | None = None,
    description: str | None = None,
    awarding_organization: str | None = None,
    awarder_name: str | None = None,
    awarder_position: str | None = None,
    design: str | None = None,
    award_conditions: str | None = None,
    validity_policy: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            t = db.query(CertificateTemplate).filter(CertificateTemplate.id == tid).first()
            if not t:
                return error("证书模板不存在", "404")
            if name is not None:
                t.name = name
            if description is not None:
                t.description = description
            if awarding_organization is not None:
                t.awarding_organization = awarding_organization
            if awarder_name is not None:
                t.awarder_name = awarder_name
            if awarder_position is not None:
                t.awarder_position = awarder_position
            if design is not None:
                t.design = design
            if award_conditions is not None:
                t.award_conditions = award_conditions
            if validity_policy is not None:
                t.validity_policy = validity_policy
            if status is not None:
                t.status = status
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"certificate template update error: {e}")
            return error(str(e))


@router.delete("/template/{tid}", summary="删除证书模板")
async def delete_template(tid: int):
    with get_session() as db:
        try:
            t = db.query(CertificateTemplate).filter(CertificateTemplate.id == tid).first()
            if not t:
                return error("证书模板不存在", "404")
            db.delete(t)
            return success()
        except Exception as e:
            logger.error(f"certificate template delete error: {e}")
            return error(str(e))


# ============ 颁发记录 ============


@router.get("/list", summary="证书颁发记录列表")
async def list_certificates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    lesson_id: int | None = None,
    status: str | None = None,
    company_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Certificate)
            if member_id:
                q = q.filter(Certificate.member_id == member_id)
            if lesson_id:
                q = q.filter(Certificate.lesson_id == lesson_id)
            if status:
                q = q.filter(Certificate.status == status)
            if company_id:
                q = q.filter(Certificate.company_id == company_id)
            total = q.count()
            items = q.order_by(Certificate.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_cert_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"certificate list error: {e}")
            return error(str(e))


@router.get("/{cid}", summary="证书颁发记录详情")
async def get_certificate(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            return success(_cert_to_dict(c))
        except Exception as e:
            logger.error(f"certificate get error: {e}")
            return error(str(e))


@router.post("", summary="颁发证书")
async def create_certificate(
    name: str = Query(..., min_length=1, max_length=128),
    code: str | None = None,
    description: str | None = None,
    awarding_organization: str | None = None,
    awarder_name: str | None = None,
    awarder_position: str | None = None,
    design: str | None = None,
    award_conditions: str | None = None,
    validity_policy: str | None = None,
    award_date: str | None = None,
    validity: str | None = None,
    status: str | None = None,
    member_id: int | None = None,
    lesson_id: int | None = None,
    lesson_sign_id: int | None = None,
    lesson_sign_time: str | None = None,
    lesson_complete_time: str | None = None,
    score: str | None = None,
    company_id: int | None = None,
    create_user_id: int | None = None,
    create_user_name: str | None = None,
):
    with get_session() as db:
        try:
            c = Certificate(
                name=name,
                code=code,
                description=description,
                awarding_organization=awarding_organization,
                awarder_name=awarder_name,
                awarder_position=awarder_position,
                design=design,
                award_conditions=award_conditions,
                validity_policy=validity_policy,
                award_date=datetime.fromisoformat(award_date) if award_date else None,
                validity=datetime.fromisoformat(validity) if validity else None,
                status=status,
                member_id=member_id,
                lesson_id=lesson_id,
                lesson_sign_id=lesson_sign_id,
                lesson_sign_time=datetime.fromisoformat(lesson_sign_time) if lesson_sign_time else None,
                lesson_complete_time=datetime.fromisoformat(lesson_complete_time) if lesson_complete_time else None,
                score=score,
                company_id=company_id,
                create_user_id=create_user_id,
                create_user_name=create_user_name,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"certificate create error: {e}")
            return error(str(e))


@router.put("/{cid}", summary="修改证书颁发记录")
async def update_certificate(
    cid: int,
    name: str | None = None,
    code: str | None = None,
    description: str | None = None,
    status: str | None = None,
    score: str | None = None,
    validity_policy: str | None = None,
):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            if name is not None:
                c.name = name
            if code is not None:
                c.code = code
            if description is not None:
                c.description = description
            if status is not None:
                c.status = status
            if score is not None:
                c.score = score
            if validity_policy is not None:
                c.validity_policy = validity_policy
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"certificate update error: {e}")
            return error(str(e))


@router.delete("/{cid}", summary="删除证书颁发记录")
async def delete_certificate(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"certificate delete error: {e}")
            return error(str(e))


# ============ 证书状态迁移 ============


@router.put("/{cid}/valid", summary="设为有效")
async def set_certificate_valid(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            c.status = "valid"
            return success({"id": c.id, "status": c.status})
        except Exception as e:
            logger.error(f"certificate set valid error: {e}")
            return error(str(e))


@router.put("/{cid}/suspended", summary="暂停证书")
async def set_certificate_suspended(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            c.status = "suspended"
            return success({"id": c.id, "status": c.status})
        except Exception as e:
            logger.error(f"certificate set suspended error: {e}")
            return error(str(e))


@router.put("/{cid}/revoked", summary="撤销证书")
async def set_certificate_revoked(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            c.status = "revoked"
            return success({"id": c.id, "status": c.status})
        except Exception as e:
            logger.error(f"certificate set revoked error: {e}")
            return error(str(e))


@router.put("/{cid}/cancelled", summary="取消证书")
async def set_certificate_cancelled(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            c.status = "cancelled"
            return success({"id": c.id, "status": c.status})
        except Exception as e:
            logger.error(f"certificate set cancelled error: {e}")
            return error(str(e))


@router.put("/{cid}/expired", summary="过期证书")
async def set_certificate_expired(cid: int):
    with get_session() as db:
        try:
            c = db.query(Certificate).filter(Certificate.id == cid).first()
            if not c:
                return error("证书不存在", "404")
            c.status = "expired"
            return success({"id": c.id, "status": c.status})
        except Exception as e:
            logger.error(f"certificate set expired error: {e}")
            return error(str(e))
