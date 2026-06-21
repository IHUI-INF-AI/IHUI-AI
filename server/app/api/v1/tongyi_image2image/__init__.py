"""通义图生图路由注册"""

from fastapi import APIRouter

from app.api.v1.tongyi_image2image.tongyi_image2image import router as tongyi_i2i_router

router = APIRouter()
router.include_router(tongyi_i2i_router, prefix="/tongyi-image2image", tags=["Tongyi Image2Image"])
