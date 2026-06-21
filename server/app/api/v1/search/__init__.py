"""搜索路由注册"""

from fastapi import APIRouter

from app.api.v1.search.search import router as search_router

router = APIRouter()
router.include_router(search_router, prefix="/search", tags=["Search"])
