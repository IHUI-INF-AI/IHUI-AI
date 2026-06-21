"""用户模型聊天路由注册"""

from fastapi import APIRouter

from app.api.v1.user_model_chat.user_model_chat import router as user_model_chat_router

router = APIRouter()
router.include_router(user_model_chat_router, prefix="/user-model-chat", tags=["User Model Chat"])
