"""消息通知路由注册"""

from fastapi import APIRouter

from app.api.v1.message.message import router as message_router

router = APIRouter()
router.include_router(message_router, prefix="/message", tags=["Message"])
