"""用户视频观看日志路由注册"""

from fastapi import APIRouter

from app.api.v1.user_video_log.user_video_log import router as user_video_log_router

router = APIRouter()
router.include_router(user_video_log_router, prefix="/user-video-log", tags=["User Video Log"])
