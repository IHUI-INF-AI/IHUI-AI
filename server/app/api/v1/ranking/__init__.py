"""排行榜路由注册"""

from fastapi import APIRouter

from app.api.v1.ranking.ranking import router as ranking_router

router = APIRouter()
router.include_router(ranking_router, prefix="/ranking", tags=["Ranking"])
