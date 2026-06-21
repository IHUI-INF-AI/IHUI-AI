"""通义图像编辑路由注册"""

from fastapi import APIRouter

from app.api.v1.tongyi_image_edit.tongyi_image_edit import router as tongyi_edit_router

router = APIRouter()
router.include_router(tongyi_edit_router, prefix="/tongyi-image-edit", tags=["Tongyi Image Edit"])
