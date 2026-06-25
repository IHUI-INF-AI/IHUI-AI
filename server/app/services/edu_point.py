"""edu_point service - Points (migrated from ihui-ai-edu-point-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-point-service\\
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduPointAccount, EduPointRecord
from app.services.edu_base import EduNotFoundError, EduValidationError, paginate, get_or_404


def get_or_create_account(db: Session, user_id: int) -> EduPointAccount:
    a = db.execute(select(EduPointAccount).where(EduPointAccount.user_id == user_id)).scalar_one_or_none()
    if not a:
        a = EduPointAccount(user_id=user_id, balance=0, frozen=0,
                            total_earned=0, total_spent=0)
        db.add(a)
        db.flush()
        db.refresh(a)
    return a


def earn_points(
    db: Session, user_id: int, amount: int, source: str, remark: Optional[str] = None
) -> EduPointAccount:
    """Add points to user's account."""
    if amount <= 0:
        raise EduValidationError("amount must be > 0")
    a = get_or_create_account(db, user_id)
    a.balance = (a.balance or 0) + amount
    a.total_earned = (a.total_earned or 0) + amount
    # Record transaction
    rec = EduPointRecord(
        user_id=user_id, change_type="earn", amount=amount,
        balance_after=a.balance, source=source, remark=remark,
    )
    db.add(rec)
    db.flush()
    db.refresh(a)
    return a


def spend_points(
    db: Session, user_id: int, amount: int, source: str, remark: Optional[str] = None
) -> EduPointAccount:
    """Spend points from user's account."""
    if amount <= 0:
        raise EduValidationError("amount must be > 0")
    a = get_or_create_account(db, user_id)
    if a.balance < amount:
        raise EduValidationError("insufficient points")
    a.balance -= amount
    a.total_spent = (a.total_spent or 0) + amount
    rec = EduPointRecord(
        user_id=user_id, change_type="spend", amount=amount,
        balance_after=a.balance, source=source, remark=remark,
    )
    db.add(rec)
    db.flush()
    db.refresh(a)
    return a


def get_account(db: Session, user_id: int) -> EduPointAccount:
    return get_or_create_account(db, user_id)


def list_records(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    change_type: Optional[str] = None,
) -> Tuple[List[EduPointRecord], int]:
    filters = [EduPointRecord.uuid == user_id]
    if change_type:
        filters.append(EduPointRecord.type == change_type)
    return paginate(db, EduPointRecord, page=page, size=size, filters=filters, order_by=desc(EduPointRecord.id))
