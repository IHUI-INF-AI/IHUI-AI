"""证书管理 API (迁移自 ihui-ai-edu-learn-service 证书模块)

提供证书的创建/查询/状态管理/批量颁发, 证书模板管理, 以及证书序列号管理。
证书状态: 0=有效 1=暂停 2=注销 3=失效 4=撤销 5=删除;
模板状态: 0=禁用 1=启用 2=删除。
"""
from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import (
    Certificate,
    CertificateSerialNumber,
    CertificateTemplate,
)
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _uid_int() -> int | None:
    try:
        return int(_uid())
    except (TypeError, ValueError):
        return None


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _cert_to_dict(item: Certificate) -> dict:
    return {
        "id": item.id,
        "certificate_id": item.certificate_id,
        "code": item.code,
        "name": item.name,
        "description": item.description,
        "awarding_organization": item.awarding_organization,
        "awarder_name": item.awarder_name,
        "awarder_position": item.awarder_position,
        "design": item.design,
        "award_conditions": item.award_conditions,
        "validity_policy": item.validity_policy,
        "award_date": _iso(item.award_date),
        "validity": item.validity,
        "status": item.status,
        "member_id": item.member_id,
        "lesson_id": item.lesson_id,
        "lesson_sign_id": item.lesson_sign_id,
        "lesson_sign_time": _iso(item.lesson_sign_time),
        "lesson_complete_time": _iso(item.lesson_complete_time),
        "score": item.score,
        "company_id": item.company_id,
        "create_user_id": item.create_user_id,
        "create_user_name": item.create_user_name,
        "update_user_id": item.update_user_id,
        "update_user_name": item.update_user_name,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


def _tpl_to_dict(item: CertificateTemplate) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "awarding_organization": item.awarding_organization,
        "awarder_name": item.awarder_name,
        "awarder_position": item.awarder_position,
        "design": item.design,
        "award_conditions": item.award_conditions,
        "validity_policy": item.validity_policy,
        "status": item.status,
        "company_id": item.company_id,
        "create_user_id": item.create_user_id,
        "create_user_name": item.create_user_name,
        "update_user_id": item.update_user_id,
        "update_user_name": item.update_user_name,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


def _serial_to_dict(item: CertificateSerialNumber) -> dict:
    return {
        "id": item.id,
        "year": item.year,
        "month": item.month,
        "day": item.day,
        "current_serial": item.current_serial,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


def _get_or_create_serial(db, now: datetime) -> CertificateSerialNumber:
    item = (
        db.query(CertificateSerialNumber)
        .filter(
            CertificateSerialNumber.year == now.year,
            CertificateSerialNumber.month == now.month,
            CertificateSerialNumber.day == now.day,
        )
        .first()
    )
    if not item:
        item = CertificateSerialNumber(
            year=now.year, month=now.month, day=now.day, current_serial=0
        )
        db.add(item)
        db.flush()
    return item


def _generate_code(db) -> str:
    now = utcnow()
    serial = _get_or_create_serial(db, now)
    serial.current_serial = (serial.current_serial or 0) + 1
    db.flush()
    return f"CERT-{now.year}{now.month:02d}{now.day:02d}-{serial.current_serial:04d}"


# ---------------------------------------------------------------------------
# 请求体
# ---------------------------------------------------------------------------


class CertificateCreate(BaseModel):
    certificate_id: int | None = None
    name: str | None = None
    description: str | None = None
    awarding_organization: str | None = None
    awarder_name: str | None = None
    awarder_position: str | None = None
    design: str | None = None
    award_conditions: str | None = None
    validity_policy: str | None = None
    award_date: datetime | None = None
    validity: str | None = None
    status: int = 0
    member_id: int | None = None
    lesson_id: int | None = None
    lesson_sign_id: int | None = None
    lesson_sign_time: datetime | None = None
    lesson_complete_time: datetime | None = None
    score: int | None = None
    company_id: int | None = None


class CertificateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    awarding_organization: str | None = None
    awarder_name: str | None = None
    awarder_position: str | None = None
    design: str | None = None
    award_conditions: str | None = None
    validity_policy: str | None = None
    award_date: datetime | None = None
    validity: str | None = None
    score: int | None = None


class CertificateStatusUpdate(BaseModel):
    status: int


class CertificateIssue(BaseModel):
    lesson_id: int
    template_id: int | None = None
    name: str | None = None


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    awarding_organization: str | None = None
    awarder_name: str | None = None
    awarder_position: str | None = None
    design: str | None = None
    award_conditions: str | None = None
    validity_policy: str | None = None
    status: int = 1
    company_id: int | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    awarding_organization: str | None = None
    awarder_name: str | None = None
    awarder_position: str | None = None
    design: str | None = None
    award_conditions: str | None = None
    validity_policy: str | None = None


class TemplateStatusUpdate(BaseModel):
    status: int


# ===========================================================================
# 证书
# ===========================================================================


@router.post("", summary="创建证书")
async def create_certificate(body: CertificateCreate):
    with get_session() as db:
        try:
            uid = _uid_int()
            code = _generate_code(db)
            item = Certificate(
                certificate_id=body.certificate_id,
                code=code,
                name=body.name,
                description=body.description,
                awarding_organization=body.awarding_organization,
                awarder_name=body.awarder_name,
                awarder_position=body.awarder_position,
                design=body.design,
                award_conditions=body.award_conditions,
                validity_policy=body.validity_policy,
                award_date=body.award_date,
                validity=body.validity,
                status=body.status,
                member_id=body.member_id,
                lesson_id=body.lesson_id,
                lesson_sign_id=body.lesson_sign_id,
                lesson_sign_time=body.lesson_sign_time,
                lesson_complete_time=body.lesson_complete_time,
                score=body.score,
                company_id=body.company_id,
                create_user_id=uid,
                create_user_name=_uid(),
            )
            db.add(item)
            db.flush()
            return success(_cert_to_dict(item))
        except Exception as e:
            logger.exception("create_certificate error")
            return error(str(e))


@router.get("/list", summary="证书列表")
async def list_certificates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    keyword: str | None = None,
    member_id: int | None = None,
    lesson_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Certificate).filter(Certificate.status != 5)
            if status is not None:
                q = q.filter(Certificate.status == status)
            if member_id is not None:
                q = q.filter(Certificate.member_id == member_id)
            if lesson_id is not None:
                q = q.filter(Certificate.lesson_id == lesson_id)
            if keyword:
                q = q.filter(
                    (Certificate.name.like(f"%{keyword}%"))
                    | (Certificate.code.like(f"%{keyword}%"))
                )
            total = q.count()
            items = (
                q.order_by(Certificate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_cert_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_certificates error")
            return error(str(e))


@router.get("/code/{code}", summary="按证书编号查询")
async def get_certificate_by_code(code: str):
    with get_session() as db:
        try:
            item = (
                db.query(Certificate)
                .filter(Certificate.code == code)
                .first()
            )
            if not item:
                return error("证书不存在")
            return success(_cert_to_dict(item))
        except Exception as e:
            logger.exception("get_certificate_by_code error")
            return error(str(e))


@router.get("/member/{member_id}/list", summary="会员证书列表")
async def list_member_certificates(
    member_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Certificate).filter(
                Certificate.member_id == member_id,
                Certificate.status != 5,
            )
            if status is not None:
                q = q.filter(Certificate.status == status)
            total = q.count()
            items = (
                q.order_by(Certificate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_cert_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_member_certificates error")
            return error(str(e))


@router.get("/member/{member_id}/count", summary="会员证书数量")
async def count_member_certificates(member_id: int):
    with get_session() as db:
        try:
            total = (
                db.query(Certificate)
                .filter(
                    Certificate.member_id == member_id,
                    Certificate.status != 5,
                )
                .count()
            )
            return success({"member_id": member_id, "count": total})
        except Exception as e:
            logger.exception("count_member_certificates error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/list", summary="课程证书列表")
async def list_lesson_certificates(
    lesson_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Certificate).filter(
                Certificate.lesson_id == lesson_id,
                Certificate.status != 5,
            )
            if status is not None:
                q = q.filter(Certificate.status == status)
            total = q.count()
            items = (
                q.order_by(Certificate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_cert_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_lesson_certificates error")
            return error(str(e))


@router.post("/issue", summary="批量颁发证书")
async def issue_certificates(body: CertificateIssue):
    with get_session() as db:
        try:
            from app.models.learn_models import SignUp

            tpl = None
            if body.template_id:
                tpl = (
                    db.query(CertificateTemplate)
                    .filter(
                        CertificateTemplate.id == body.template_id,
                        CertificateTemplate.status != 2,
                    )
                    .first()
                )
                if not tpl:
                    return error("证书模板不存在")
            signups = (
                db.query(SignUp)
                .filter(SignUp.lesson_id == body.lesson_id, SignUp.status == 1)
                .all()
            )
            uid = _uid_int()
            issued = []
            for su in signups:
                exists = (
                    db.query(Certificate)
                    .filter(
                        Certificate.lesson_id == body.lesson_id,
                        Certificate.member_id == su.member_id,
                        Certificate.status != 5,
                    )
                    .first()
                )
                if exists:
                    continue
                code = _generate_code(db)
                item = Certificate(
                    certificate_id=body.template_id,
                    code=code,
                    name=body.name or (tpl.name if tpl else None),
                    description=tpl.description if tpl else None,
                    awarding_organization=tpl.awarding_organization if tpl else None,
                    awarder_name=tpl.awarder_name if tpl else None,
                    awarder_position=tpl.awarder_position if tpl else None,
                    design=tpl.design if tpl else None,
                    award_conditions=tpl.award_conditions if tpl else None,
                    validity_policy=tpl.validity_policy if tpl else None,
                    award_date=utcnow(),
                    status=0,
                    member_id=su.member_id,
                    lesson_id=body.lesson_id,
                    lesson_sign_id=su.id,
                    lesson_sign_time=None,
                    lesson_complete_time=su.completed_time,
                    company_id=su.company_id,
                    create_user_id=uid,
                    create_user_name=_uid(),
                )
                db.add(item)
                db.flush()
                issued.append(_cert_to_dict(item))
            return success({"lesson_id": body.lesson_id, "issued": issued, "count": len(issued)})
        except Exception as e:
            logger.exception("issue_certificates error")
            return error(str(e))


@router.get("/{certificate_id}", summary="证书详情")
async def get_certificate(certificate_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(Certificate)
                .filter(Certificate.id == certificate_id)
                .first()
            )
            if not item:
                return error("证书不存在")
            return success(_cert_to_dict(item))
        except Exception as e:
            logger.exception("get_certificate error")
            return error(str(e))


@router.put("/{certificate_id}", summary="更新证书信息")
async def update_certificate(certificate_id: int, body: CertificateUpdate):
    with get_session() as db:
        try:
            item = (
                db.query(Certificate)
                .filter(Certificate.id == certificate_id)
                .first()
            )
            if not item:
                return error("证书不存在")
            if body.name is not None:
                item.name = body.name
            if body.description is not None:
                item.description = body.description
            if body.awarding_organization is not None:
                item.awarding_organization = body.awarding_organization
            if body.awarder_name is not None:
                item.awarder_name = body.awarder_name
            if body.awarder_position is not None:
                item.awarder_position = body.awarder_position
            if body.design is not None:
                item.design = body.design
            if body.award_conditions is not None:
                item.award_conditions = body.award_conditions
            if body.validity_policy is not None:
                item.validity_policy = body.validity_policy
            if body.award_date is not None:
                item.award_date = body.award_date
            if body.validity is not None:
                item.validity = body.validity
            if body.score is not None:
                item.score = body.score
            item.update_user_id = _uid_int()
            item.update_user_name = _uid()
            db.flush()
            return success(_cert_to_dict(item))
        except Exception as e:
            logger.exception("update_certificate error")
            return error(str(e))


@router.put("/{certificate_id}/status", summary="更新证书状态")
async def update_certificate_status(
    certificate_id: int, body: CertificateStatusUpdate
):
    with get_session() as db:
        try:
            item = (
                db.query(Certificate)
                .filter(Certificate.id == certificate_id)
                .first()
            )
            if not item:
                return error("证书不存在")
            item.status = body.status
            item.update_user_id = _uid_int()
            item.update_user_name = _uid()
            db.flush()
            return success(_cert_to_dict(item))
        except Exception as e:
            logger.exception("update_certificate_status error")
            return error(str(e))


@router.delete("/{certificate_id}", summary="删除证书")
async def delete_certificate(certificate_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(Certificate)
                .filter(Certificate.id == certificate_id)
                .first()
            )
            if not item:
                return error("证书不存在")
            item.status = 5
            db.flush()
            return success({"id": certificate_id})
        except Exception as e:
            logger.exception("delete_certificate error")
            return error(str(e))


# ===========================================================================
# 证书模板
# ===========================================================================


@router.post("/template", summary="创建证书模板")
async def create_template(body: TemplateCreate):
    with get_session() as db:
        try:
            item = CertificateTemplate(
                name=body.name,
                description=body.description,
                awarding_organization=body.awarding_organization,
                awarder_name=body.awarder_name,
                awarder_position=body.awarder_position,
                design=body.design,
                award_conditions=body.award_conditions,
                validity_policy=body.validity_policy,
                status=body.status,
                company_id=body.company_id,
                create_user_id=_uid_int(),
                create_user_name=_uid(),
            )
            db.add(item)
            db.flush()
            return success(_tpl_to_dict(item))
        except Exception as e:
            logger.exception("create_template error")
            return error(str(e))


@router.get("/template/list", summary="模板列表")
async def list_templates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CertificateTemplate).filter(
                CertificateTemplate.status != 2
            )
            if status is not None:
                q = q.filter(CertificateTemplate.status == status)
            if keyword:
                q = q.filter(CertificateTemplate.name.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(CertificateTemplate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_tpl_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_templates error")
            return error(str(e))


@router.get("/template/{template_id}", summary="模板详情")
async def get_template(template_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(CertificateTemplate)
                .filter(CertificateTemplate.id == template_id)
                .first()
            )
            if not item:
                return error("模板不存在")
            return success(_tpl_to_dict(item))
        except Exception as e:
            logger.exception("get_template error")
            return error(str(e))


@router.put("/template/{template_id}", summary="更新模板")
async def update_template(template_id: int, body: TemplateUpdate):
    with get_session() as db:
        try:
            item = (
                db.query(CertificateTemplate)
                .filter(CertificateTemplate.id == template_id)
                .first()
            )
            if not item:
                return error("模板不存在")
            if body.name is not None:
                item.name = body.name
            if body.description is not None:
                item.description = body.description
            if body.awarding_organization is not None:
                item.awarding_organization = body.awarding_organization
            if body.awarder_name is not None:
                item.awarder_name = body.awarder_name
            if body.awarder_position is not None:
                item.awarder_position = body.awarder_position
            if body.design is not None:
                item.design = body.design
            if body.award_conditions is not None:
                item.award_conditions = body.award_conditions
            if body.validity_policy is not None:
                item.validity_policy = body.validity_policy
            item.update_user_id = _uid_int()
            item.update_user_name = _uid()
            db.flush()
            return success(_tpl_to_dict(item))
        except Exception as e:
            logger.exception("update_template error")
            return error(str(e))


@router.delete("/template/{template_id}", summary="删除模板")
async def delete_template(template_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(CertificateTemplate)
                .filter(CertificateTemplate.id == template_id)
                .first()
            )
            if not item:
                return error("模板不存在")
            item.status = 2
            db.flush()
            return success({"id": template_id})
        except Exception as e:
            logger.exception("delete_template error")
            return error(str(e))


@router.put("/template/{template_id}/status", summary="更新模板状态")
async def update_template_status(
    template_id: int, body: TemplateStatusUpdate
):
    with get_session() as db:
        try:
            item = (
                db.query(CertificateTemplate)
                .filter(CertificateTemplate.id == template_id)
                .first()
            )
            if not item:
                return error("模板不存在")
            item.status = body.status
            item.update_user_id = _uid_int()
            item.update_user_name = _uid()
            db.flush()
            return success(_tpl_to_dict(item))
        except Exception as e:
            logger.exception("update_template_status error")
            return error(str(e))


# ===========================================================================
# 证书序列号
# ===========================================================================


@router.get("/serial/next", summary="获取下一个序列号")
async def get_next_serial():
    with get_session() as db:
        try:
            now = utcnow()
            serial = _get_or_create_serial(db, now)
            db.flush()
            return success(
                {
                    "year": now.year,
                    "month": now.month,
                    "day": now.day,
                    "next_serial": (serial.current_serial or 0) + 1,
                }
            )
        except Exception as e:
            logger.exception("get_next_serial error")
            return error(str(e))


@router.get("/serial/current", summary="获取当前序列号")
async def get_current_serial():
    with get_session() as db:
        try:
            now = utcnow()
            serial = _get_or_create_serial(db, now)
            return success(_serial_to_dict(serial))
        except Exception as e:
            logger.exception("get_current_serial error")
            return error(str(e))
