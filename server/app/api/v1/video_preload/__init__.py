"""视频预读路由注册"""

from fastapi import APIRouter

from app.api.v1.video_preload.video_preload import router as video_preload_router

router = APIRouter()
router.include_router(video_preload_router, prefix="/video-preload", tags=["Video Preload"])
