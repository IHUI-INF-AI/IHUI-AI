"""外呼回调路由注册"""

from fastapi import APIRouter

from app.api.v1.callback.callback import router as callback_router

router = APIRouter()
router.include_router(callback_router, prefix="/callback", tags=["Callback"])
