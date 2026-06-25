"""edu_live service - Live broadcast (migrated from ihui-ai-edu-live-service).

Source: G:\\IHUI-AI\\storage\\edu-assets\\java-source\\ihui-ai-edu-live-service\\
"""

from __future__ import annotations

from datetime import datetime

from app.utils.datetime_helper import utcnow
from typing import List, Optional, Tuple

from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.models.edu_models import EduLiveRoom, EduLiveAttendance
from app.services.edu_base import EduPermissionError, EduValidationError, paginate, get_or_404


def create_room(
    db: Session, teacher_id: int, title: str,
    scheduled_start: datetime, scheduled_end: datetime, **fields
) -> EduLiveRoom:
    """Create a live room.

    2026-06-25 字段对齐修复: teacher_id→host_id, 删除 course_id,
    scheduled_start→plan_start_time, scheduled_end→end_time,
    status="scheduled"→status=0, 删除 max_attendees/attendee_count。
    """
    if not title:
        raise EduValidationError("title required")
    if scheduled_end <= scheduled_start:
        raise EduValidationError("scheduled_end must be after scheduled_start")
    room = EduLiveRoom(
        title=title, host_id=teacher_id,
        description=fields.get("description"),
        cover=fields.get("cover"),
        plan_start_time=scheduled_start, end_time=scheduled_end,
        status=0,
    )
    db.add(room)
    db.flush()
    db.refresh(room)
    return room


def start_live(db: Session, room_id: int, teacher_id: int) -> EduLiveRoom:
    """Start a live room.

    2026-06-25 字段对齐修复: room.teacher_id→room.host_id,
    room.status="live"→room.status=1, room.actual_start→room.start_time。
    """
    room = get_or_404(db, EduLiveRoom, room_id, "room")
    if room.host_id != teacher_id:
        raise EduPermissionError("only the teacher can start the live")
    room.status = 1
    room.start_time = utcnow()
    db.flush()
    db.refresh(room)
    return room


def end_live(db: Session, room_id: int, teacher_id: int, playback_url: Optional[str] = None) -> EduLiveRoom:
    """End a live room.

    2026-06-25 字段对齐修复: room.teacher_id→room.host_id,
    room.status="ended"→room.status=2, room.actual_end→room.end_time,
    room.playback_url→room.record_url。
    """
    room = get_or_404(db, EduLiveRoom, room_id, "room")
    if room.host_id != teacher_id:
        raise EduPermissionError("only the teacher can end the live")
    room.status = 2
    room.end_time = utcnow()
    if playback_url:
        room.record_url = playback_url
    db.flush()
    db.refresh(room)
    return room


def join_live(db: Session, room_id: int, user_id: int) -> EduLiveAttendance:
    """Subscribe/join a live room.

    2026-06-25 字段对齐修复: 删除 attendee_count/max_attendees 容量检查,
    EduLiveAttendance.room_id→channel_id, 删除 leave_at 过滤,
    构造函数 room_id→channel_id, 删除 join_at/duration_seconds, status 改为 int 对齐。
    """
    room = get_or_404(db, EduLiveRoom, room_id, "room")
    if room.status != 1:
        raise EduValidationError("room is not live")
    # Check existing
    existing = db.execute(
        select(EduLiveAttendance).where(
            and_(EduLiveAttendance.channel_id == room_id, EduLiveAttendance.user_id == user_id)
        )
    ).scalar_one_or_none()
    if existing:
        return existing
    att = EduLiveAttendance(
        channel_id=room_id, user_id=user_id,
    )
    db.add(att)
    db.flush()
    db.refresh(att)
    return att


def leave_live(db: Session, room_id: int, user_id: int) -> EduLiveAttendance:
    """Leave a live room.

    2026-06-25 字段对齐修复: LiveSubscribe 无 join_at/leave_at/duration_seconds 字段,
    leave_live 改为 noop; EduLiveAttendance.room_id→channel_id。
    """
    att = db.execute(
        select(EduLiveAttendance).where(
            and_(EduLiveAttendance.channel_id == room_id, EduLiveAttendance.user_id == user_id)
        )
    ).scalar_one_or_none()
    if not att:
        from app.services.edu_base import EduNotFoundError
        raise EduNotFoundError("attendance", 0)
    # LiveSubscribe 无时间字段, 此处为 noop, 直接返回订阅记录
    return att


def list_rooms(
    db: Session, page: int = 1, size: int = 20,
    teacher_id: Optional[int] = None, status: Optional[str] = None,
) -> Tuple[List[EduLiveRoom], int]:
    """List live rooms.

    2026-06-25 字段对齐修复: EduLiveRoom.teacher_id→host_id。
    """
    filters = []
    if teacher_id is not None:
        filters.append(EduLiveRoom.host_id == teacher_id)
    if status:
        filters.append(EduLiveRoom.status == status)
    return paginate(db, EduLiveRoom, page=page, size=size, filters=filters, order_by=desc(EduLiveRoom.plan_start_time))


def get_room(db: Session, room_id: int) -> EduLiveRoom:
    return get_or_404(db, EduLiveRoom, room_id, "room")


def list_room_attendees(
    db: Session, room_id: int, page: int = 1, size: int = 20,
) -> Tuple[List[EduLiveAttendance], int]:
    """List room attendees.

    2026-06-25 字段对齐修复: EduLiveAttendance.room_id→channel_id。
    """
    return paginate(db, EduLiveAttendance, page=page, size=size,
                    filters=[EduLiveAttendance.channel_id == room_id])
