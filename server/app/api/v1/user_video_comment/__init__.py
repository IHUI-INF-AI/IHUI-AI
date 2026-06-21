"""用户视频评论路由注册"""

from fastapi import APIRouter

from app.api.v1.user_video_comment.user_video_comment import router as user_video_comment_router

router = APIRouter()
router.include_router(user_video_comment_router, prefix="/user-video-comment", tags=["User Video Comment"])
