"""豆包图片编辑路由注册"""

from fastapi import APIRouter

from app.api.v1.doubao_image_edit.doubao_image_edit import router as doubao_router

router = APIRouter()
router.include_router(doubao_router, prefix="/doubao-image-edit", tags=["Doubao Image Edit"])
