"""用户图片交互路由注册"""

from fastapi import APIRouter

from app.api.v1.user_agent_image.user_agent_image import router as user_agent_image_router

router = APIRouter()
router.include_router(user_agent_image_router, prefix="/user-agent-image", tags=["User Agent Image"])
