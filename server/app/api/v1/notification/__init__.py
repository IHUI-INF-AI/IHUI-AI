"""通知系统路由注册"""

from fastapi import APIRouter

from app.api.v1.notification.notification import router as notification_router

router = APIRouter()
router.include_router(notification_router, prefix="/notification", tags=["Notification"])
