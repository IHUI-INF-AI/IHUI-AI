"""
Legacy local auth endpoints (migrated from client/backend/api/auth_routes.py).

These endpoints are NOT duplicates of server/app/api/v1/auth/login.py --
they cover registration, password change, and current-user lookup that
the new auth module does not provide.

NOTE: The server's auth_service (app.services.auth_service) has a
completely different interface from the client/backend auth_service.
The handlers below are wired to the server's auth_service and User
model (app.models.user_models.User) -- register delegates to
auth_service.register_user, while /me and /change-password query the
users table (center DB, SessionFactory2) directly.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from loguru import logger
from pydantic import BaseModel

from app.security import hash_password, require_login, verify_password
from app.services import auth_service
from app.utils.response import fail, success

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UserResponse(BaseModel):
    uuid: str
    phone: str | None = None
    nickname: str | None = None
    avatar: str | None = None
    status: int = 1
    is_vip: int = 0


@router.post("/register")
async def register(
    request: Request,
    data: RegisterRequest,
):
    # legacy 适配: username 作为登录名/手机号传入 auth_service.register_user
    result = auth_service.register_user(data.username, data.password, None)
    if not result["success"]:
        return fail(result["msg"], code=400)
    return success(result["data"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user_uuid: str = Depends(require_login),
):
    from app.database import SessionFactory2
    from app.models.user_models import User

    db = SessionFactory2()
    try:
        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        return UserResponse(
            uuid=user.uuid,
            phone=user.phone,
            nickname=user.nickname,
            avatar=user.avatar,
            status=user.status,
            is_vip=user.is_vip,
        )
    finally:
        db.close()


@router.post("/change-password")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    user_uuid: str = Depends(require_login),
):
    from app.database import SessionFactory2
    from app.models.user_models import User

    if len(data.new_password) < 6:
        return fail("密码长度不能少于6位", code=400)

    db = SessionFactory2()
    try:
        user = db.query(User).filter(User.uuid == user_uuid).first()
        if not user:
            return fail("用户不存在", code=404)
        if not user.password_hash or not verify_password(data.old_password, user.password_hash):
            return fail("旧密码错误", code=400)
        user.password_hash = hash_password(data.new_password)
        db.commit()
        return success(msg="密码修改成功")
    except Exception as e:
        db.rollback()
        logger.error(f"Change password error: {e}")
        return fail("密码修改失败", code=500)
    finally:
        db.close()
