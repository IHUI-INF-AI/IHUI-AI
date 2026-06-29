"""资源体系路由注册"""

from fastapi import APIRouter

from app.api.v1.resource.category import router as category_router

router = APIRouter()
router.include_router(category_router, prefix="/resource", tags=["Resource: Category"])
