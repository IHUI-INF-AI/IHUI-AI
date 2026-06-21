"""第三方设备路由注册"""
from fastapi import APIRouter

from app.api.v1.tbox.tbox import router as tbox_router

router = APIRouter()
router.include_router(tbox_router, prefix="/tbox", tags=["TBox"])
