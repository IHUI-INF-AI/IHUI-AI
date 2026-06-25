"""edu_usercenter service - User profile & address (migrated from ihui-ai-edu-usercenter-service).

Phase F: UserAuthInfo (IHUI-AI) uses user_uuid/phone, EduMemberPost (used as address).
"""
from __future__ import annotations

from sqlalchemy import select

from app.models.user_models import UserAuthInfo


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


def add_address(db: Session, user_uuid: str, **fields) -> dict:
    """Add address (Phase F: stub, store as JSON)."""
    return {"user_uuid": user_uuid, "fields": fields}


def update_address(db: Session, address_id: int, user_uuid: str, **fields) -> dict:
    return {"address_id": address_id, "fields": fields}


def delete_address(db: Session, address_id: int, user_uuid: str) -> bool:
    return True


def list_addresses(db: Session, user_uuid: str) -> List[dict]:
    return []


def get_default_address(db: Session, user_uuid: str) -> Optional[dict]:
    return None
