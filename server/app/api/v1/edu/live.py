"""Edu live router - /api/v1/edu/live

Migrated from ihui-ai-edu-live-service.
Complete Phase B implementation.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


from app.core.current_user import get_current_user_id

from app.schemas.common import success

router = APIRouter()


@router.post("/rooms", summary="Create room")
def create_room_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_live import create_room
    result = create_room(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/rooms/{room_id}/start", summary="Start live")
def start_live_endpoint(room_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_live import start_live
    result = start_live(db, room_id=room_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/rooms/{room_id}/end", summary="End live")
def end_live_endpoint(room_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_live import end_live
    result = end_live(db, room_id=room_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/rooms/{room_id}/join", summary="Join live")
def join_live_endpoint(room_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_live import join_live
    result = join_live(db, room_id=room_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/rooms/{room_id}/leave", summary="Leave live")
def leave_live_endpoint(room_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_live import leave_live
    result = leave_live(db, room_id=room_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/rooms/{room_id}", summary="Get room")
def get_room_endpoint(room_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_live import get_room
    result = get_room(db, room_id=room_id)
    return success(data=result)

@router.get("/rooms", summary="List rooms")
def list_rooms_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_live import list_rooms
    result = list_rooms(db)
    return success(data=result)

@router.get("/rooms/{room_id}/attendees", summary="List attendees")
def list_room_attendees_endpoint(room_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_live import list_room_attendees
    result = list_room_attendees(db, room_id=room_id)
    return success(data=result)
