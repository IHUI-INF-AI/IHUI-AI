"""edu_schedule service - Class schedule (migrated from ihui-ai-edu-schedule-service)."""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from app.models.edu_models import EduScheduleCourse
from app.services.edu_base import EduValidationError, paginate, get_or_404


def create_schedule(
    db: Session, course_id: int, teacher_id: int,
    week_day: int, start_time: str, end_time: str, **fields
) -> EduScheduleCourse:
    if week_day < 1 or week_day > 7:
        raise EduValidationError("week_day must be 1-7")
    s = EduScheduleCourse(
        course_id=course_id, teacher_id=teacher_id,
        week_day=week_day, start_time=start_time, end_time=end_time,
        classroom=fields.get("classroom"),
        semester=fields.get("semester"),
        effective_from=fields.get("effective_from", datetime.now()),
        effective_to=fields.get("effective_to"),
    )
    db.add(s)
    db.flush()
    db.refresh(s)
    return s


def list_teacher_schedule(
    db: Session, teacher_id: int, semester: Optional[str] = None,
) -> List[EduScheduleCourse]:
    filters = [EduScheduleCourse.teacher_id == teacher_id]
    if semester:
        filters.append(EduScheduleCourse.semester == semester)
    return list(db.execute(
        select(EduScheduleCourse).where(and_(*filters)).order_by(EduScheduleCourse.week_day, EduScheduleCourse.start_time)
    ).scalars().all())


def check_conflict(
    db: Session, teacher_id: int, week_day: int, start_time: str, end_time: str,
    exclude_id: Optional[int] = None,
) -> List[EduScheduleCourse]:
    """Check for scheduling conflicts for a teacher at a given slot."""
    filters = [
        EduScheduleCourse.teacher_id == teacher_id,
        EduScheduleCourse.week_day == week_day,
        # Time overlap: existing.start < new.end AND existing.end > new.start
        EduScheduleCourse.start_time < end_time,
        EduScheduleCourse.end_time > start_time,
    ]
    if exclude_id is not None:
        filters.append(EduScheduleCourse.id != exclude_id)
    return list(db.execute(select(EduScheduleCourse).where(and_(*filters))).scalars().all())


def delete_schedule(db: Session, schedule_id: int) -> bool:
    s = get_or_404(db, EduScheduleCourse, schedule_id, "schedule")
    db.delete(s)
    db.flush()
    return True
