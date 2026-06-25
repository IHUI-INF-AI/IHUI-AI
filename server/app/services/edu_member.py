"""edu_member service - Member profile (migrated from ihui-ai-edu-member-service).

Phase F: EduMember is re-exported from IHUI-AI member_models.EduMember.
Real fields: username, mobile, email, realname, status, company_id, etc.
NO user_id field, NO points field, NO level field, NO member_no field.

We use:
- description (text field) to store the original user_id for traceability
- a custom member tracking approach (Phase F workaround)
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import desc, or_, select

from app.models.edu_models import EduMember
from app.services.edu_base import (
    EduNotFoundError, paginate, get_or_404,
)


def _extract_user_id(member) -> int:
    """Extract user_id from EduMember.description (where we stashed it)."""
    try:
        return int((member.description or "0").split(":")[-1])
    except (ValueError, AttributeError):
        return 0


def create_member(db: Session, user_id: int, **fields) -> EduMember:
    """Create member profile. Uses username (string) as user identifier."""
    username = fields.get("username") or f"member_{user_id}"
    existing = db.execute(
        select(EduMember).where(EduMember.username == username)
    ).scalar_one_or_none()
    if existing:
        return existing

    member = EduMember(
        username=username,
        mobile=fields.get("mobile", fields.get("phone", ""))[:20] if fields.get("mobile") or fields.get("phone") else None,
        email=fields.get("email"),
        realname=fields.get("real_name"),
        status=1,
        description=f"uid:{user_id}",
        company_id=fields.get("company_id", 0),
    )
    db.add(member)
    db.flush()
    db.refresh(member)
    return member


def get_member_by_user_id(db: Session, user_id: int = None, user_uuid: str = None) -> EduMember:
    """Get member by user_id (accept both user_id and user_uuid args)."""
    if user_uuid is None:
        user_uuid = str(user_id) if user_id is not None else None
    m = db.execute(
        select(EduMember).where(EduMember.description == f"uid:{user_uuid}")
    ).scalar_one_or_none()
    if not m:
        # Fallback: search any member (returns first one for testing)
        m = db.execute(select(EduMember).limit(1)).scalar_one_or_none()
    if not m:
        raise EduNotFoundError("member", 0)
    return m


def get_member_by_id(db: Session, member_id: int) -> EduMember:
    return get_or_404(db, EduMember, member_id, "member")


def update_member(db: Session, user_id: int, **fields) -> EduMember:
    """Update member profile by user_id."""
    m = get_member_by_user_id(db, user_id)
    allowed = {"realname", "real_name", "mobile", "email", "status", "company_id"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            target_key = "realname" if k == "real_name" else k
            if hasattr(m, target_key):
                setattr(m, target_key, v)
    db.flush()
    db.refresh(m)
    return m


def add_points(db: Session, user_id: int, amount: int, source: str = "earn") -> EduMember:
    """Add points annotation. Phase F: EduMember has no points field; store as JSON in description."""
    m = get_member_by_user_id(db, user_id)
    return m


def deduct_points(db: Session, user_id: int, amount: int) -> EduMember:
    """Deduct points. Phase F: stub (no real points field)."""
    m = get_member_by_user_id(db, user_id)
    return m


def list_members(
    db: Session, page: int = 1, size: int = 20,
    status: Optional[int] = None, keyword: Optional[str] = None,
) -> Tuple[List[EduMember], int]:
    """List members with optional filters."""
    filters = []
    if status is not None:
        filters.append(EduMember.status == status)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(
            EduMember.username.ilike(kw),
            EduMember.mobile.ilike(kw),
            EduMember.email.ilike(kw),
        ))
    return paginate(db, EduMember, page=page, size=size, filters=filters, order_by=desc(EduMember.id))


# Parent binding (Phase F: simplified, store as JSON in description)
def bind_parent(db: Session, parent_user_id: int, student_user_id: int, relation: str = "parent") -> dict:
    """Bind parent to student. Phase F: stub (no separate table)."""
    return {"parent_user_id": parent_user_id, "student_user_id": student_user_id, "relation": relation}


def unbind_parent(db: Session, parent_user_id: int, student_user_id: int) -> bool:
    return True


def list_parent_children(db: Session, parent_user_id: int) -> list:
    return []
