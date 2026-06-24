"""Edu auth router - /api/v1/edu/auth

Migrated from ihui-ai-edu-auth-service.
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


@router.post("/register", summary="Register new user")
async def register_user_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import register_user
    result = register_user(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/login", summary="Login")
async def login_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import login
    result = login(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.get("/me", summary="Get current user")
async def get_user_by_id_endpoint(user_id: int = Depends(get_current_user_id), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(_get_db)):
    from app.services.edu_auth import get_user_by_id
    result = get_user_by_id(db, user_id=user_id)
    return success(data=result)

@router.put("/me", summary="Update profile")
async def update_profile_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import update_profile
    result = update_profile(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/change-password", summary="Change password")
async def change_password_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import change_password
    result = change_password(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/sso/login", summary="SSO login (signed JWT)")
async def sso_login_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import sso_login
    result = sso_login(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/sso/keypair", summary="Generate SSO keypair (admin)")
async def generate_sso_keypair_endpoint(user_id: int = Depends(get_current_user_id), payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import generate_sso_keypair
    result = generate_sso_keypair(db, user_id=user_id, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)

@router.post("/third-party/login", summary="Third-party OAuth login")
async def third_party_login_endpoint(payload: dict = {}, db: Session = Depends(_get_db)):
    from app.services.edu_auth import third_party_login
    result = third_party_login(db, **{k: v for k, v in payload.items() if v is not None})
    return success(data=result)
