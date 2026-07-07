"""AI 动态/资讯聚合模块路由聚合."""
from app.api.v1.ai_feed.routes import router as routes_router
from fastapi import APIRouter

router = APIRouter()
router.include_router(routes_router, prefix="/ai-feed", tags=["AI Feed: 动态聚合"])
