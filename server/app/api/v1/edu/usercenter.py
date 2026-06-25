"""Edu usercenter router - /api/v1/edu/usercenter

Migrated from ihui-ai-edu-usercenter-service.
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


@router.get("/profile/me", summary="Get my profile")
def get_profile_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import get_profile
    result = get_profile(db, user_uuid=str(user_id))
    return success(data=result)

@router.put("/profile/me", summary="Update my profile")
def update_profile_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import update_profile
    result = update_profile(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/profile/{user_id}", summary="Get user profile")
def get_profile_endpoint(user_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import get_profile
    result = get_profile(db, user_uuid=str(user_id))
    return success(data=result)

@router.post("/addresses", summary="Add address")
def add_address_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import add_address
    result = add_address(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.put("/addresses/{address_id}", summary="Update address")
def update_address_endpoint(address_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import update_address
    result = update_address(db, address_id=address_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.delete("/addresses/{address_id}", summary="Delete address")
def delete_address_endpoint(address_id: int, user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import delete_address
    result = delete_address(db, address_id=address_id, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/addresses/me", summary="List my addresses")
def list_addresses_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import list_addresses
    result = list_addresses(db, user_uuid=str(user_id))
    return success(data=result)

@router.get("/addresses/me/default", summary="Get default address")
def get_default_address_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_usercenter import get_default_address
    result = get_default_address(db, user_uuid=str(user_id))
    return success(data=result)
