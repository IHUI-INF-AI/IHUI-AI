"""edu base service - shared utilities for all 22 edu domain services.

Phase E compatibility strategy:
- paginate() and get_or_404() still return ORM objects (Phase B style)
- BUT we monkey-patch each object with Phase A field names via setattr
- This way, routers can use either field name on the returned object
"""
from __future__ import annotations

import logging
from typing import Optional, Tuple, TypeVar

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ============================================================================
# Phase A -> IHUI-AI field aliases
# Phase A fields (used by Phase B routers) -> IHUI-AI real field
# ============================================================================
_PHASE_A_ALIASES = {
    "AskQuestion": {
        "view_count": "watch_num",
        "answer_count": "answer_num",
        "comment_count": "comment_num",
        "like_count": "like_num",
        "favorite_count": "favorite_num",
        "is_resolved": "__status_eq_closed",
        "is_top": "is_top",
        "is_essence": "is_essence",
        "tags": None,
        "user_id": "member_id",
        "image": "image",
        "course_id": None,  # AskQuestion has no course_id (ask/circle is course-agnostic)
    },
    "Circle": {
        "is_public": "__status_eq_1",
        "member_count": "member_num",
        "post_count": "post_num",
        "is_official": "is_official",
        "is_top": "is_top",
        "is_essence": "is_essence",
        "category": "category_id",
    },
    "CirclePost": {
        "like_count": "like_num",
        "comment_count": "comment_num",
        "share_count": "share_num",
        "view_count": "watch_num",
    },
    "CircleMember": {
        "joined_at": "joined_at",
    },
    "LiveChannel": {
        "max_attendees": "__max_attendees_none",  # no field, default 0
        "attendee_count": "__attendee_count_none",
        "playback_url": "record_url",
        "scheduled_start": "plan_start_time",
        "actual_start": "start_time",
        "actual_end": "end_time",
    },
    "Lesson": {
        "title": "name",
        "cover": "image",
        "subtitle": "phrase",
        "description": "introduction",
        "rating": "score",
        "is_published": "__status_eq_1",
        "is_free": "__price_eq_0",
        "published_at": None,  # no direct field, return None
    },
    "ExamPaper": {
        "is_published": "__status_eq_1",
    },
    "Message": {
        "is_read": "is_read",
        "msg_type": "type",
    },
    "Notification": {
        "is_sent": "is_send",
    },
    "PointAccount": {
        "balance": "point",
        "frozen": "__frozen_zero",
        "total_earned": "__total_earned_zero",
        "total_spent": "__total_spent_zero",
    },
    "PointLog": {
        "change_type": "type",
        "balance_after": "after_point",
    },
    "Resource": {
        "cover": "image",
        "download_count": "download_num",
        "view_count": "view_num",
    },
    "ExamRecord": {
        "start_at": "start_time",
        "submit_at": "submit_time",
    },
}


def inject_phase_a_fields(obj) -> None:
    """Monkey-patch ORM object with Phase A field names as attributes.

    Mutates the instance to add fields like view_count, is_public, etc.
    that don't exist on the IHUI-AI model. This allows Phase B routers
    to use Phase A field names directly on returned objects.
    """
    if obj is None:
        return
    # Get the class name (strip 'Edu' prefix that some aliases use)
    cls_name = obj.__class__.__name__
    # Try multiple class names (AskQuestion, EduAskQuestion, etc.)
    aliases = _PHASE_A_ALIASES.get(cls_name, {})
    if not aliases:
        # Try without 'Edu' prefix
        for prefix in ("Edu", ""):
            test_name = prefix + cls_name
            aliases = _PHASE_A_ALIASES.get(test_name, {})
            if aliases:
                break
    for phase_a_field, source in aliases.items():
        # Skip if the object already has the field
        if hasattr(obj, phase_a_field):
            continue
        try:
            if source is None:
                # Field doesn't exist in source - skip
                value = None
            elif source.startswith("__"):
                # Computed property
                if source == "__status_eq_closed":
                    value = (getattr(obj, "status", "") == "closed")
                elif source == "__status_eq_1":
                    value = (getattr(obj, "status", 0) == 1)
                elif source == "__price_eq_0":
                    value = ((getattr(obj, "price", 0) or 0) == 0)
                elif source == "__max_attendees_none":
                    value = 0
                elif source == "__attendee_count_none":
                    value = 0
                elif source == "__frozen_zero":
                    value = 0
                elif source == "__total_earned_zero":
                    value = 0
                elif source == "__total_spent_zero":
                    value = 0
                else:
                    value = None
            else:
                value = getattr(obj, source, None)
            setattr(obj, phase_a_field, value)
        except Exception as e:
            logger.debug("注入 Phase A 字段 %s 失败: %s", phase_a_field, e)


def paginate(db, model, page=1, size=20, order_by=None, filters=None):
    """Standard pagination. Returns (list of ORM objects with Phase A fields, total)."""
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
    items = list(db.execute(base).scalars().all())
    for item in items:
        inject_phase_a_fields(item)
    total = db.execute(count_q).scalar() or 0
    return items, total


def get_or_404(db, model, entity_id, entity_name=None):
    """Get single entity. Returns ORM object with Phase A fields injected."""
    obj = db.get(model, entity_id)
    if obj is None:
        from app.services.edu_base import _EduNotFoundError
        raise _EduNotFoundError(entity_name or model.__name__, entity_id)
    inject_phase_a_fields(obj)
    return obj


def get_by_id_optional(db, model, entity_id):
    obj = db.get(model, entity_id)
    if obj:
        inject_phase_a_fields(obj)
    return obj


# Internal error class (renamed to avoid conflict with earlier import)
class _EduNotFoundError(HTTPException):
    def __init__(self, entity, entity_id):
        super().__init__(status_code=404, detail=f"{entity} not found: id={entity_id}")


# Public alias for backward compat
class EduServiceError(HTTPException):
    status_code = 400
    def __init__(self, detail="edu service error", status_code=400):
        super().__init__(status_code=status_code, detail=detail)
        self.status_code = status_code


class EduNotFoundError(EduServiceError):
    def __init__(self, entity, entity_id):
        super().__init__(detail=f"{entity} not found: id={entity_id}", status_code=404)


class EduPermissionError(EduServiceError):
    def __init__(self, message="permission denied"):
        super().__init__(detail=message, status_code=403)


class EduValidationError(EduServiceError):
    def __init__(self, message):
        super().__init__(detail=message, status_code=422)


def soft_delete(db, model, entity_id):
    from datetime import datetime, timezone
    obj = db.get(model, entity_id)
    if obj is None:
        return False
    if hasattr(obj, "is_deleted"):
        obj.is_deleted = True
    if hasattr(obj, "deleted_at"):
        obj.deleted_at = datetime.now(timezone.utc)
    if hasattr(obj, "deleted") and not hasattr(obj, "is_deleted"):
        obj.deleted = True
    db.flush()
    return True


def to_edu_dict(obj) -> dict:
    """Optional helper: convert ORM object to dict (Phase A/B compatibility)."""
    if obj is None:
        return {}
    d = {}
    for col in obj.__table__.columns:
        try:
            d[col.name] = getattr(obj, col.name, None)
        except Exception as e:
            logger.debug("读取列 %s 的值失败: %s", col.name, e)
    # Inject Phase A fields
    inject_phase_a_fields(obj)
    for k in _PHASE_A_ALIASES.get(obj.__class__.__name__, {}):
        if k not in d:
            d[k] = getattr(obj, k, None)
    return d


def to_edu_dicts(objs):
    return [to_edu_dict(o) for o in objs]