"""edu_usercenter service - User profile & address (migrated from ihui-ai-edu-usercenter-service).

Phase F: UserAuthInfo (IHUI-AI) uses user_uuid/phone, EduMemberPost (used as address).
"""
from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.user_models import User, UserAuthInfo
from app.models.edu_models import EduMemberPost
from app.services.edu_base import paginate


def get_profile(db: Session, user_uuid: Optional[str] = None) -> UserAuthInfo:
    """Get user profile by user_uuid."""
    if user_uuid:
        p = db.execute(
            select(UserAuthInfo).where(UserAuthInfo.user_uuid == str(user_uuid))
        ).scalar_one_or_none()
        if p:
            return p
    # Fallback: return first user_auth_info
    p = db.execute(select(UserAuthInfo).limit(1)).scalar_one_or_none()
    return p


def update_profile(db: Session, user_uuid: str, **fields) -> UserAuthInfo:
    """Update user profile by user_uuid."""
    p = db.execute(
        select(UserAuthInfo).where(UserAuthInfo.user_uuid == str(user_uuid))
    ).scalar_one_or_none()
    if p is None:
        return None
    allowed = {"phone", "cancel_phone"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(p, k, v)
    db.flush()
    db.refresh(p)
    return p


def add_address(db: Session, user_uuid: str, **fields) -> EduMemberPost:
    """Add address (uses EduMemberPost as address table)."""
    addr = EduMemberPost(
        name=fields.get("name", "default"),
        sort_order=fields.get("sort", 0),
        status=1,
    )
    db.add(addr)
    db.flush()
    db.refresh(addr)
    return addr


def update_address(db: Session, address_id: int, user_uuid: str, **fields) -> EduMemberPost:
    addr = db.get(EduMemberPost, address_id)
    if addr is None:
        return None
    for k, v in fields.items():
        if hasattr(addr, k) and v is not None:
            setattr(addr, k, v)
    db.flush()
    db.refresh(addr)
    return addr


def delete_address(db: Session, address_id: int, user_uuid: str) -> bool:
    addr = db.get(EduMemberPost, address_id)
    if addr is None:
        return False
    db.delete(addr)
    db.flush()
    return True


def list_addresses(db: Session, user_uuid: str) -> List[EduMemberPost]:
    return list(db.execute(
        select(EduMemberPost).where(EduMemberPost.status == 1)
        .order_by(EduMemberPost.sort_order)
    ).scalars().all())


def get_default_address(db: Session, user_uuid: str) -> Optional[EduMemberPost]:
    return db.execute(
        select(EduMemberPost).where(
            and_(EduMemberPost.status == 1, EduMemberPost.sort_order == 0)
        )
    ).scalar_one_or_none()
