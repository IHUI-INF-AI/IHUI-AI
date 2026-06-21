"""用户评论日志路由注册"""
from fastapi import APIRouter

from app.api.v1.user_comment_log.user_comment_log import router as user_comment_log_router

router = APIRouter()
router.include_router(user_comment_log_router, prefix="/user-comment-log", tags=["User Comment Log"])
