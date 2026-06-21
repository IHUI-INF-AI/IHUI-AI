"""实名认证路由注册"""

from fastapi import APIRouter

from app.api.v1.auth_identity.auth_identity import router as auth_identity_router

router = APIRouter()
router.include_router(auth_identity_router, prefix="/auth-identity", tags=["Auth Identity"])
