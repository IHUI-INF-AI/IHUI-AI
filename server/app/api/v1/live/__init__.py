"""直播路由注册"""

from fastapi import APIRouter

from app.api.v1.live.channel import router as channel_router

router = APIRouter()
router.include_router(channel_router, prefix="/live", tags=["Live"])
