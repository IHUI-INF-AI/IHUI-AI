"""User management routes.

NOTE: /list is provided by admin_panel.py (user_router).
This file only has /info and /update which are user-facing, not admin.
"""

from fastapi import APIRouter, Depends, Query

from app.schemas.common import error, success
from app.security import require_login
from app.services.user_service import get_user_by_uuid, update_user

router = APIRouter()


@router.get("/info", summary="Get current user profile")
def get_profile(user_uuid: str = Depends(require_login)):
    info = get_user_by_uuid(user_uuid)
    if not info:
        return error("User not found", "404")
    return success(info)


@router.put("/update", summary="Update user profile")
def update_profile(
    nickname: str = Query(None),
    avatar: str = Query(None),
    gender: int = Query(None),
    user_uuid: str = Depends(require_login),
):
    result = update_user(user_uuid, nickname=nickname, avatar=avatar, gender=gender)
    if not result["success"]:
        return error(result["msg"])
    return success(msg="Updated")
