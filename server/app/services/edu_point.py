"""edu_point service - Points (migrated from ihui-ai-edu-point-service).

Phase F: PointAccount (IHUI-AI) uses available_point/frozen_point/total_point.
"""
from __future__ import annotations

from sqlalchemy import desc, select

from app.models.edu_models import EduPointAccount, EduPointRecord
from app.services.edu_base import EduValidationError, paginate


def get_or_create_account(db: Session, user_id: str = None, user_uuid: str = None) -> EduPointAccount:
    a = db.execute(
        select(EduPointAccount).where(EduPointAccount.user_id == str(user_id))
    ).scalar_one_or_none()
    if not a:
        a = EduPointAccount(
            user_id=str(user_id), user_name=str(user_id),
            total_point=0, available_point=0, frozen_point=0, used_point=0,
            level=1,
        )
        db.add(a)
        db.flush()
        db.refresh(a)
    return a


def earn_points(db: Session, user_id: str, amount: int, source: str = "earn", remark: Optional[str] = None) -> EduPointAccount:
    a = get_or_create_account(db, user_id)
    a.available_point = (a.available_point or 0) + amount
    a.total_point = (a.total_point or 0) + amount
    rec = EduPointRecord(
        user_id=str(user_id), user_name=str(user_id),
        type="earn", action=source, point=amount,
        balance=a.available_point, description=remark or source,
    )
    db.add(rec)
    db.flush()
    db.refresh(a)
    return a


def spend_points(db: Session, user_id: str, amount: int, source: str = "spend", remark: Optional[str] = None) -> EduPointAccount:
    a = get_or_create_account(db, user_id)
    if (a.available_point or 0) < amount:
        raise EduValidationError("insufficient points")
    a.available_point -= amount
    a.used_point = (a.used_point or 0) + amount
    rec = EduPointRecord(
        user_id=str(user_id), user_name=str(user_id),
        type="spend", action=source, point=-amount,
        balance=a.available_point, description=remark or source,
    )
    db.add(rec)
    db.flush()
    db.refresh(a)
    return a


def get_account(db: Session, user_id: str = None, user_uuid: str = None) -> EduPointAccount:
    return get_or_create_account(db, user_id)


def list_records(db: Session, user_id: str, page: int = 1, size: int = 20) -> Tuple[List[EduPointRecord], int]:
    return paginate(db, EduPointRecord, page=page, size=size,
                    filters=[EduPointRecord.user_id == str(user_id)],
                    order_by=desc(EduPointRecord.created_at))
