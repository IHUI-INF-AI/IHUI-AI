"""直播路由注册"""

from fastapi import APIRouter

from app.api.v1.live.category import router as category_router
from app.api.v1.live.channel import router as channel_router
from app.api.v1.live.lecturer import router as lecturer_router

router = APIRouter()
router.include_router(category_router, prefix="/live", tags=["Live"])
router.include_router(channel_router, prefix="/live", tags=["Live"])
router.include_router(lecturer_router, prefix="/live", tags=["Live"])
