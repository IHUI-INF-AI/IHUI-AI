"""Certificate Legacy Business Service.

完整迁移自 ihui-ai-edu-learn-service:
  - CertificateController
  - CertificateTemplateController
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import func

from app.database import get_session
from app.models.learn_models import Certificate, CertificateTemplate

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


# ===========================================================================
# CertificateController
# ===========================================================================

def list_certificates(
    page: int = 1,
    page_size: int = 20,
    member_id: Optional[int] = None,
    lesson_id: Optional[int] = None,
    status: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(Certificate)
        if member_id is not None:
            q = q.filter(Certificate.member_id == member_id)
        if lesson_id is not None:
            q = q.filter(Certificate.lesson_id == lesson_id)
        if status is not None:
            q = q.filter(Certificate.status == status)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_certificate(cert_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        return _to_dict(obj)


def get_certificate_by_lesson(lesson_id: int, member_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = (
            db.query(Certificate)
            .filter(Certificate.lesson_id == lesson_id, Certificate.member_id == member_id)
            .order_by(Certificate.id.desc())
            .first()
        )
        return _to_dict(obj) if obj else {}


def create_certificate(
    name: str,
    code: Optional[str] = None,
    description: Optional[str] = None,
    awarding_organization: Optional[str] = None,
    awarder_name: Optional[str] = None,
    awarder_position: Optional[str] = None,
    design: Optional[str] = None,
    award_conditions: Optional[str] = None,
    validity_policy: Optional[str] = None,
    award_date=None,
    validity: Optional[str] = None,
    member_id: Optional[int] = None,
    lesson_id: Optional[int] = None,
    score: Optional[int] = None,
    company_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = Certificate(
            name=name, code=code, description=description,
            awarding_organization=awarding_organization,
            awarder_name=awarder_name, awarder_position=awarder_position,
            design=design, award_conditions=award_conditions, validity_policy=validity_policy,
            award_date=award_date, validity=validity,
            member_id=member_id, lesson_id=lesson_id, score=score,
            company_id=company_id, status=0,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_certificate(cert_id: int) -> int:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if obj:
            db.delete(obj)
            return 1
        return 0


def valid_certificate(cert_id: int) -> int:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if obj:
            obj.status = 0
            return 1
        return 0


def suspended_certificate(cert_id: int) -> int:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if obj:
            obj.status = 1
            return 1
        return 0


def revoked_certificate(cert_id: int) -> int:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if obj:
            obj.status = 4
            return 1
        return 0


def cancelled_certificate(cert_id: int) -> int:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if obj:
            obj.status = 2
            return 1
        return 0


def expired_certificate(cert_id: int) -> int:
    with get_session() as db:
        obj = db.query(Certificate).filter(Certificate.id == cert_id).first()
        if obj:
            obj.status = 3
            return 1
        return 0


# ===========================================================================
# CertificateTemplateController
# ===========================================================================

def list_certificate_templates(
    page: int = 1,
    page_size: int = 20,
    name: Optional[str] = None,
    status: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        q = db.query(CertificateTemplate)
        if name:
            q = q.filter(CertificateTemplate.name.like(f"%{name}%"))
        if status is not None:
            q = q.filter(CertificateTemplate.status == status)
        total = q.count()
        items = q.offset((page - 1) * page_size).limit(page_size).all()
        return {"list": _to_dict_list(items), "total": total}


def get_certificate_template(template_id: int) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
        return _to_dict(obj)


def create_certificate_template(
    name: str,
    description: Optional[str] = None,
    awarding_organization: Optional[str] = None,
    awarder_name: Optional[str] = None,
    awarder_position: Optional[str] = None,
    design: Optional[str] = None,
    award_conditions: Optional[str] = None,
    validity_policy: Optional[str] = None,
    create_user_id: Optional[int] = None,
    create_user_name: Optional[str] = None,
    company_id: Optional[int] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = CertificateTemplate(
            name=name, description=description,
            awarding_organization=awarding_organization,
            awarder_name=awarder_name, awarder_position=awarder_position,
            design=design, award_conditions=award_conditions, validity_policy=validity_policy,
            create_user_id=create_user_id, create_user_name=create_user_name,
            company_id=company_id, status=1,
        )
        db.add(obj)
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def update_certificate_template(
    template_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    awarding_organization: Optional[str] = None,
    awarder_name: Optional[str] = None,
    awarder_position: Optional[str] = None,
    design: Optional[str] = None,
    award_conditions: Optional[str] = None,
    validity_policy: Optional[str] = None,
    update_user_id: Optional[int] = None,
    update_user_name: Optional[str] = None,
) -> dict[str, Any]:
    with get_session() as db:
        obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
        if not obj:
            return {}
        if name is not None:
            obj.name = name
        if description is not None:
            obj.description = description
        if awarding_organization is not None:
            obj.awarding_organization = awarding_organization
        if awarder_name is not None:
            obj.awarder_name = awarder_name
        if awarder_position is not None:
            obj.awarder_position = awarder_position
        if design is not None:
            obj.design = design
        if award_conditions is not None:
            obj.award_conditions = award_conditions
        if validity_policy is not None:
            obj.validity_policy = validity_policy
        if update_user_id is not None:
            obj.update_user_id = update_user_id
        if update_user_name is not None:
            obj.update_user_name = update_user_name
        db.flush()
        db.refresh(obj)
        return _to_dict(obj)


def delete_certificate_template(template_id: int) -> None:
    with get_session() as db:
        obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
        if obj:
            obj.status = 2


def active_certificate_template(template_id: int) -> None:
    with get_session() as db:
        obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
        if obj:
            obj.status = 1


def inactive_certificate_template(template_id: int) -> None:
    with get_session() as db:
        obj = db.query(CertificateTemplate).filter(CertificateTemplate.id == template_id).first()
        if obj:
            obj.status = 0
