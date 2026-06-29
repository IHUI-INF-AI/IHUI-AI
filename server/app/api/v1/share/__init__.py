"""分享路由注册"""

from fastapi import APIRouter

from app.api.v1.share.routes import router as share_router

router = APIRouter()
router.include_router(share_router, prefix="/share", tags=["Share"])
