"""edu_usercenter service - User profile & address (migrated from ihui-ai-edu-usercenter-service).

Source (junction access): G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-usercenter-service\\
"""

from __future__ import annotations

from typing import List, Optional, Tuple

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduUserProfile, EduUserAddress
from app.services.edu_base import EduValidationError, paginate, get_or_404


def get_profile(db: Session, user_id: int) -> EduUserProfile:
    """Get user profile, auto-create if not exists."""
    p = db.execute(
        select(EduUserProfile).where(EduUserProfile.user_id == user_id)
    ).scalar_one_or_none()
    if not p:
        p = EduUserProfile(
            user_id=user_id, timezone="Asia/Shanghai", locale="zh-CN",
        )
        db.add(p)
        db.flush()
        db.refresh(p)
    return p


def update_profile(db: Session, user_id: int, **fields) -> EduUserProfile:
    """Update user profile."""
    p = get_profile(db, user_id)
    allowed = {"bio", "tags", "preferences", "timezone", "locale"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(p, k, v)
    db.flush()
    db.refresh(p)
    return p


# ============================================================================
# Address CRUD (迁移自 AddressController)
# ============================================================================

def add_address(
    db: Session, user_id: int, receiver: str, phone: str,
    province: str, city: str, district: Optional[str], detail: str,
    is_default: bool = False,
) -> EduUserAddress:
    """Add a delivery address."""
    if not receiver or not phone or not province or not city or not detail:
        raise EduValidationError("receiver/phone/province/city/detail required")
    # If this is the first address or marked default, unset others
    if is_default:
        db.query(EduUserAddress).filter(
            and_(EduUserAddress.user_id == user_id, EduUserAddress.is_default == True)
        ).update({"is_default": False})
    addr = EduUserAddress(
        user_id=user_id, receiver=receiver, phone=phone,
        province=province, city=city, district=district, detail=detail,
        is_default=is_default,
    )
    db.add(addr)
    db.flush()
    db.refresh(addr)
    return addr


def update_address(db: Session, address_id: int, user_id: int, **fields) -> EduUserAddress:
    """Update address (only owner can update)."""
    addr = get_or_404(db, EduUserAddress, address_id, "address")
    if addr.user_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your address")
    if fields.get("is_default"):
        db.query(EduUserAddress).filter(
            and_(EduUserAddress.user_id == user_id, EduUserAddress.is_default == True,
                 EduUserAddress.id != address_id)
        ).update({"is_default": False})
    for k, v in fields.items():
        if v is not None and hasattr(addr, k):
            setattr(addr, k, v)
    db.flush()
    db.refresh(addr)
    return addr


def delete_address(db: Session, address_id: int, user_id: int) -> bool:
    addr = get_or_404(db, EduUserAddress, address_id, "address")
    if addr.user_id != user_id:
        from app.services.edu_base import EduPermissionError
        raise EduPermissionError("not your address")
    db.delete(addr)
    db.flush()
    return True


def list_addresses(db: Session, user_id: int) -> List[EduUserAddress]:
    """List all addresses for a user."""
    return list(db.execute(
        select(EduUserAddress).where(EduUserAddress.user_id == user_id)
        .order_by(EduUserAddress.is_default.desc(), EduUserAddress.id.desc())
    ).scalars().all())


def get_default_address(db: Session, user_id: int) -> Optional[EduUserAddress]:
    return db.execute(
        select(EduUserAddress).where(
            and_(EduUserAddress.user_id == user_id, EduUserAddress.is_default == True)
        )
    ).scalar_one_or_none()
