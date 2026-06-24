"""edu_behavior service - Behavior tracking (migrated from ihui-ai-edu-behavior-service).

Tracks user learning behavior: views, clicks, study time, answer paths.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy import and_, desc, func, select
from sqlalchemy.orm import Session
from app.models.edu_models import EduBehaviorView
from app.services.edu_base import EduValidationError, paginate


def track_event(
    db: Session, session_id: str, entity_type: str, entity_id: int, event: str,
    user_id: Optional[int] = None, duration_ms: int = 0,
    path: Optional[str] = None, referrer: Optional[str] = None,
    ua: Optional[str] = None,
) -> EduBehaviorView:
    """Track a behavior event."""
    if event not in ("view", "click", "hover", "scroll", "play", "pause", "seek", "submit"):
        raise EduValidationError(f"event must be one of view/click/hover/scroll/play/pause/seek/submit")
    b = EduBehaviorView(
        user_id=user_id, session_id=session_id,
        entity_type=entity_type, entity_id=entity_id, event=event,
        duration_ms=duration_ms, path=path, referrer=referrer, ua=ua,
    )
    db.add(b)
    db.flush()
    db.refresh(b)
    return b


def get_user_study_metrics(db: Session, user_id: int, since: Optional[datetime] = None) -> dict:
    """Aggregate user study metrics."""
    base = EduBehaviorView.user_id == user_id
    if since:
        base = base & (EduBehaviorView.created_at >= since)
    total_events = db.execute(select(func.count(EduBehaviorView.id)).where(base)).scalar() or 0
    total_duration_ms = db.execute(
        select(func.coalesce(func.sum(EduBehaviorView.duration_ms), 0)).where(base)
    ).scalar() or 0
    view_events = db.execute(
        select(func.count(EduBehaviorView.id)).where(
            base & (EduBehaviorView.event == "view")
        )
    ).scalar() or 0
    return {
        "user_id": user_id,
        "total_events": total_events,
        "total_duration_seconds": int(total_duration_ms / 1000),
        "view_events": view_events,
    }


def get_entity_view_count(db: Session, entity_type: str, entity_id: int) -> int:
    return db.execute(
        select(func.count(EduBehaviorView.id)).where(
            and_(
                EduBehaviorView.entity_type == entity_type,
                EduBehaviorView.entity_id == entity_id,
                EduBehaviorView.event == "view",
            )
        )
    ).scalar() or 0


def list_user_events(
    db: Session, user_id: int, page: int = 1, size: int = 20,
    event: Optional[str] = None, entity_type: Optional[str] = None,
) -> Tuple[List[EduBehaviorView], int]:
    filters = [EduBehaviorView.user_id == user_id]
    if event:
        filters.append(EduBehaviorView.event == event)
    if entity_type:
        filters.append(EduBehaviorView.entity_type == entity_type)
    return paginate(db, EduBehaviorView, page=page, size=size, filters=filters, order_by=desc(EduBehaviorView.id))
