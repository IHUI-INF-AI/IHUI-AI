"""Edu member router - /api/v1/edu/member

Migrated from ihui-ai-edu-member-service.
Complete Phase B implementation.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_session


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


try:
    from app.dependencies import get_current_user_id
except ImportError:
    def get_current_user_id() -> int:
        return 1  # dev stub

from app.schemas.common import success

router = APIRouter()


@router.post("", summary="Create member profile")
def create_member_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import create_member
    result = create_member(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/me", summary="Get my member")
def get_member_by_user_id_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import get_member_by_user_id
    result = get_member_by_user_id(db, user_uuid=str(user_id))
    return success(data=result)

@router.put("/me", summary="Update my member")
def update_member_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import update_member
    result = update_member(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/{member_id}", summary="Get member by id")
def get_member_by_id_endpoint(member_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import get_member_by_id
    result = get_member_by_id(db, member_id=member_id)
    return success(data=result)

@router.post("/{user_id}/points/add", summary="Add points")
def add_points_endpoint(user_id: int, payload: dict = {}, db: Session = Depends(_get_db), current_user_id: int = Depends(get_current_user_id)):
    from app.services.edu_member import add_points
    result = add_points(db, user_id=user_id, current_user_id=current_user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/{user_id}/points/deduct", summary="Deduct points")
def deduct_points_endpoint(user_id: int, payload: dict = {}, db: Session = Depends(_get_db), current_user_id: int = Depends(get_current_user_id)):
    from app.services.edu_member import deduct_points
    result = deduct_points(db, user_id=user_id, current_user_id=current_user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("", summary="List members")
def list_members_endpoint(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import list_members
    result = list_members(db)
    return success(data=result)

@router.post("/parents", summary="Bind parent")
def bind_parent_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import bind_parent
    result = bind_parent(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/parents", summary="Unbind parent")
def unbind_parent_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_member import unbind_parent
    result = unbind_parent(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/parents/{parent_user_id}/children", summary="List children")
def list_parent_children_endpoint(parent_user_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_member import list_parent_children
    result = list_parent_children(db, parent_user_id=parent_user_id)
    return success(data=result)
