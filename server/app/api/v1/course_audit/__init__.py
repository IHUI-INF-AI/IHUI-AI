"""课程审核路由注册"""
from fastapi import APIRouter

from app.api.v1.course_audit.course_audit import router as course_audit_router

router = APIRouter()
router.include_router(course_audit_router, prefix="/course-audit", tags=["Course Audit"])
