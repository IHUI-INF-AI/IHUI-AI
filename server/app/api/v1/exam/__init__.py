"""考试系统路由注册"""

from fastapi import APIRouter

from app.api.v1.exam.composition import router as composition_router
from app.api.v1.exam.paper import router as paper_router

router = APIRouter()
router.include_router(paper_router, prefix="/exam", tags=["Exam"])
router.include_router(composition_router, prefix="/exam", tags=["Exam"])
