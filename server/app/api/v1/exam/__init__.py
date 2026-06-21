"""考试系统路由注册"""

from fastapi import APIRouter

from app.api.v1.exam.paper import router as paper_router

router = APIRouter()
router.include_router(paper_router, prefix="/exam", tags=["Exam"])
