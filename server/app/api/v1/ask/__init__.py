"""问答社区路由注册"""

from fastapi import APIRouter

from app.api.v1.ask.answer import router as a_router
from app.api.v1.ask.category import router as cat_router
from app.api.v1.ask.question import router as q_router

router = APIRouter()
router.include_router(cat_router, prefix="/ask/category", tags=["Ask: Category"])
router.include_router(q_router, prefix="/ask/question", tags=["Ask: Question"])
router.include_router(a_router, prefix="/ask/answer", tags=["Ask: Answer"])
