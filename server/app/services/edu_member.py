"""edu_member service - Member profile (migrated from ihui-ai-edu-member-service).

Source (junction access): G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-member-service\\
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduMember, EduMemberParent
from app.services.edu_base import (
    EduNotFoundError, EduValidationError, paginate, get_or_404, soft_delete,
)


def create_member(
    db: Session, user_id: int, **fields
) -> EduMember:
    """Create member profile for a user. Auto-generates member_no."""
    existing = db.execute(
        select(EduMember).where(EduMember.user_id == user_id)
    ).scalar_one_or_none()
    if existing:
        return existing

    member_no = fields.get("member_no") or f"M{datetime.now().strftime('%Y%m%d')}{secrets.token_hex(3).upper()}"
    member = EduMember(
        user_id=user_id,
        member_no=member_no,
        real_name=fields.get("real_name"),
        member_type=fields.get("member_type", "student"),
        school=fields.get("school"),
        grade=fields.get("grade"),
        class_name=fields.get("class_name"),
        student_no=fields.get("student_no"),
        id_card=fields.get("id_card"),
        points=0,
        level=1,
    )
    db.add(member)
    db.flush()
    db.refresh(member)
    return member


def get_member_by_user_id(db: Session, user_id: int) -> EduMember:
    """Get member profile by user id."""
    m = db.execute(
        select(EduMember).where(EduMember.user_id == user_id)
    ).scalar_one_or_none()
    if not m:
        raise EduNotFoundError("member", user_id)
    return m


def get_member_by_id(db: Session, member_id: int) -> EduMember:
    return get_or_404(db, EduMember, member_id, "member")


def update_member(db: Session, user_id: int, **fields) -> EduMember:
    """Update member profile."""
    m = get_member_by_user_id(db, user_id)
    allowed = {"real_name", "school", "grade", "class_name", "student_no", "id_card"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(m, k, v)
    db.flush()
    db.refresh(m)
    return m


def add_points(db: Session, user_id: int, amount: int, source: str = "earn") -> EduMember:
    """Add points to member."""
    m = get_member_by_user_id(db, user_id)
    m.points = (m.points or 0) + amount
    # Level up every 1000 points
    if m.points >= 1000 * m.level:
        m.level = (m.points // 1000) + 1
    db.flush()
    db.refresh(m)
    return m


def deduct_points(db: Session, user_id: int, amount: int) -> EduMember:
    """Deduct points. Raises if insufficient."""
    m = get_member_by_user_id(db, user_id)
    if m.points < amount:
        raise EduValidationError("insufficient points")
    m.points -= amount
    db.flush()
    db.refresh(m)
    return m


def list_members(
    db: Session, page: int = 1, size: int = 20,
    member_type: Optional[str] = None, keyword: Optional[str] = None,
) -> Tuple[List[EduMember], int]:
    filters = []
    if member_type:
        filters.append(EduMember.member_type == member_type)
    if keyword:
        kw = f"%{keyword}%"
        filters.append(or_(EduMember.real_name.ilike(kw), EduMember.student_no.ilike(kw), EduMember.school.ilike(kw)))
    return paginate(db, EduMember, page=page, size=size, filters=filters, order_by=desc(EduMember.id))


# ============================================================================
# Parent binding (迁移自 MemberController + ParentBindingService)
# ============================================================================

def bind_parent(
    db: Session, parent_user_id: int, student_user_id: int, relation: str = "parent", is_primary: bool = False
) -> EduMemberParent:
    """Bind a parent to a student."""
    existing = db.execute(
        select(EduMemberParent).where(
            and_(
                EduMemberParent.parent_user_id == parent_user_id,
                EduMemberParent.student_user_id == student_user_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    binding = EduMemberParent(
        parent_user_id=parent_user_id,
        student_user_id=student_user_id,
        relation=relation,
        is_primary=is_primary,
    )
    db.add(binding)
    db.flush()
    db.refresh(binding)
    return binding


def unbind_parent(db: Session, parent_user_id: int, student_user_id: int) -> bool:
    binding = db.execute(
        select(EduMemberParent).where(
            and_(
                EduMemberParent.parent_user_id == parent_user_id,
                EduMemberParent.student_user_id == student_user_id,
            )
        )
    ).scalar_one_or_none()
    if not binding:
        return False
    db.delete(binding)
    db.flush()
    return True


def list_parent_children(db: Session, parent_user_id: int) -> List[EduMember]:
    """List all students bound to a parent."""
    student_ids = db.execute(
        select(EduMemberParent.student_user_id).where(EduMemberParent.parent_user_id == parent_user_id)
    ).scalars().all()
    if not student_ids:
        return []
    return list(db.execute(
        select(EduMember).where(EduMember.user_id.in_(student_ids))
    ).scalars().all())
