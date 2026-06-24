"""edu_live service - Live broadcast (migrated from ihui-ai-edu-live-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-live-service\\
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduLiveRoom, EduLiveAttendance
from app.services.edu_base import EduPermissionError, EduValidationError, paginate, get_or_404


def create_room(
    db: Session, teacher_id: int, title: str,
    scheduled_start: datetime, scheduled_end: datetime, **fields
) -> EduLiveRoom:
    if not title:
        raise EduValidationError("title required")
    if scheduled_end <= scheduled_start:
        raise EduValidationError("scheduled_end must be after scheduled_start")
    room = EduLiveRoom(
        title=title, teacher_id=teacher_id,
        course_id=fields.get("course_id"),
        description=fields.get("description"),
        cover=fields.get("cover"),
        scheduled_start=scheduled_start, scheduled_end=scheduled_end,
        status="scheduled",
        max_attendees=fields.get("max_attendees", 1000),
        attendee_count=0,
    )
    db.add(room)
    db.flush()
    db.refresh(room)
    return room


def start_live(db: Session, room_id: int, teacher_id: int) -> EduLiveRoom:
    room = get_or_404(db, EduLiveRoom, room_id, "room")
    if room.teacher_id != teacher_id:
        raise EduPermissionError("only the teacher can start the live")
    room.status = "live"
    room.actual_start = datetime.now(timezone.utc)
    db.flush()
    db.refresh(room)
    return room


def end_live(db: Session, room_id: int, teacher_id: int, playback_url: Optional[str] = None) -> EduLiveRoom:
    room = get_or_404(db, EduLiveRoom, room_id, "room")
    if room.teacher_id != teacher_id:
        raise EduPermissionError("only the teacher can end the live")
    room.status = "ended"
    room.actual_end = datetime.now(timezone.utc)
    if playback_url:
        room.playback_url = playback_url
    db.flush()
    db.refresh(room)
    return room


def join_live(db: Session, room_id: int, user_id: int) -> EduLiveAttendance:
    room = get_or_404(db, EduLiveRoom, room_id, "room")
    if room.status != "live":
        raise EduValidationError("room is not live")
    if room.attendee_count >= room.max_attendees:
        raise EduValidationError("room is full")
    # Check existing
    existing = db.execute(
        select(EduLiveAttendance).where(
            and_(EduLiveAttendance.room_id == room_id, EduLiveAttendance.user_id == user_id,
                 EduLiveAttendance.leave_at.is_(None))
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    att = EduLiveAttendance(
        room_id=room_id, user_id=user_id,
        join_at=datetime.now(timezone.utc), duration_seconds=0,
    )
    db.add(att)
    room.attendee_count = (room.attendee_count or 0) + 1
    db.flush()
    db.refresh(att)
    return att


def leave_live(db: Session, room_id: int, user_id: int) -> EduLiveAttendance:
    att = db.execute(
        select(EduLiveAttendance).where(
            and_(EduLiveAttendance.room_id == room_id, EduLiveAttendance.user_id == user_id,
                 EduLiveAttendance.leave_at.is_(None))
        )
    ).scalar_one_or_none()
    if not att:
        from app.services.edu_base import EduNotFoundError
        raise EduNotFoundError("attendance", 0)
    att.leave_at = datetime.now(timezone.utc)
    att.duration_seconds = int((att.leave_at - att.join_at).total_seconds())
    db.flush()
    db.refresh(att)
    return att


def list_rooms(
    db: Session, page: int = 1, size: int = 20,
    teacher_id: Optional[int] = None, status: Optional[str] = None,
) -> Tuple[List[EduLiveRoom], int]:
    filters = []
    if teacher_id is not None:
        filters.append(EduLiveRoom.teacher_id == teacher_id)
    if status:
        filters.append(EduLiveRoom.status == status)
    return paginate(db, EduLiveRoom, page=page, size=size, filters=filters, order_by=desc(EduLiveRoom.plan_start_time))


def get_room(db: Session, room_id: int) -> EduLiveRoom:
    return get_or_404(db, EduLiveRoom, room_id, "room")


def list_room_attendees(
    db: Session, room_id: int, page: int = 1, size: int = 20,
) -> Tuple[List[EduLiveAttendance], int]:
    return paginate(db, EduLiveAttendance, page=page, size=size,
                    filters=[EduLiveAttendance.room_id == room_id])
