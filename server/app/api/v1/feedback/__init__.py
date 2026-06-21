"""用户反馈路由注册"""

from fastapi import APIRouter

from app.api.v1.feedback.feedback import router as feedback_router

router = APIRouter()
router.include_router(feedback_router, prefix="/feedback", tags=["Feedback"])
