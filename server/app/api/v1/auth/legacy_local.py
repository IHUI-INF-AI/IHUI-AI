"""
Legacy local auth endpoints (migrated from client/backend/api/auth_routes.py).

These endpoints are NOT duplicates of server/app/api/v1/auth/login.py --
they cover registration, password change, and current-user lookup that
the new auth module does not provide.

NOTE: The server's auth_service (app.services.auth_service) has a
completely different interface from the client/backend auth_service.
The handlers below reference the client/backend implementations via
NotImplementedError stubs -- full implementation requires wiring to
the server's user model (SysUser).
"""

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    role: str
    is_active: bool


@router.post("/register")
async def register(
    request: Request,
    data: RegisterRequest,
):
    raise NotImplementedError(
        "Migrated from client/backend/api/auth_routes.py -- "
        "register handler requires server UserService wiring. "
        "See .migration_backup/client_backend/api/auth_routes.py register()."
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user=None,
):
    raise NotImplementedError(
        "Migrated from client/backend/api/auth_routes.py -- "
        "me handler requires get_current_user dependency from client/backend "
        "auth_service. See .migration_backup/client_backend/api/auth_routes.py me()."
    )


@router.post("/change-password")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    current_user=None,
):
    raise NotImplementedError(
        "Migrated from client/backend/api/auth_routes.py -- "
        "change_password handler. See "
        ".migration_backup/client_backend/api/auth_routes.py change_password()."
    )
