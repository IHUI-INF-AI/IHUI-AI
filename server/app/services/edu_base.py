"""edu base service - shared utilities for all 23 edu domain services.

Provides:
- common error handling (EduNotFoundError, EduPermissionError, etc.)
- common pagination helper
- common tenant scoping helper (uses app.core.tenant ContextVar)
"""

from __future__ import annotations

from typing import Generic, List, Optional, Type, TypeVar

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

T = TypeVar("T")


class EduServiceError(HTTPException):
    """Base exception for all edu domain services."""
    status_code = 400

    def __init__(self, detail: str = "edu service error", status_code: int = 400):
        super().__init__(status_code=status_code, detail=detail)
        self.status_code = status_code


class EduNotFoundError(EduServiceError):
    def __init__(self, entity: str, entity_id: int):
        super().__init__(
            detail=f"{entity} not found: id={entity_id}",
            status_code=404,
        )


class EduPermissionError(EduServiceError):
    def __init__(self, message: str = "permission denied"):
        super().__init__(detail=message, status_code=403)


class EduValidationError(EduServiceError):
    def __init__(self, message: str):
        super().__init__(detail=message, status_code=422)


def paginate(
    db: Session,
    model: Type[T],
    page: int = 1,
    size: int = 20,
    order_by=None,
    filters: Optional[list] = None,
) -> tuple[List[T], int]:
    """Standard pagination helper for edu services.

    Args:
        db: SQLAlchemy session
        model: ORM model class
        page: 1-based page number
        size: page size (default 20, max 100)
        order_by: ordering column or expression (default: id desc)
        filters: list of SQLAlchemy filter expressions to apply

    Returns:
        (items, total) tuple
    """
    page = max(1, page)
    size = max(1, min(100, size))

    base = select(model)
    count_q = select(func.count()).select_from(model)

    if filters:
        for f in filters:
            base = base.where(f)
            count_q = count_q.where(f)

    if order_by is not None:
        base = base.order_by(order_by)
    else:
        base = base.order_by(model.id.desc())

    base = base.offset((page - 1) * size).limit(size)

    items = db.execute(base).scalars().all()
    total = db.execute(count_q).scalar() or 0

    return list(items), total


def get_or_404(db: Session, model: Type[T], entity_id: int, entity_name: str = None) -> T:
    """Get a single entity by id or raise EduNotFoundError."""
    obj = db.get(model, entity_id)
    if obj is None:
        name = entity_name or model.__name__
        raise EduNotFoundError(name, entity_id)
    return obj


def soft_delete(db: Session, model: Type[T], entity_id: int) -> bool:
    """Soft-delete by setting is_deleted=True and deleted_at=now()."""
    from datetime import datetime, timezone

    obj = db.get(model, entity_id)
    if obj is None:
        return False
    if hasattr(obj, "is_deleted"):
        obj.is_deleted = True
    if hasattr(obj, "deleted_at"):
        obj.deleted_at = datetime.now(timezone.utc)
    db.flush()
    return True


def to_dict(obj) -> dict:
    """Convert SQLAlchemy ORM object to dict (excluding SQLAlchemy state)."""
    if obj is None:
        return None
    result = {}
    for col in obj.__table__.columns:
        result[col.name] = getattr(obj, col.name, None)
    return result