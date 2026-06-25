"""报名管理 API

迁移自 edu server ihui-ai-edu-learn-service 的 signup 模块.
提供课程报名、取消报名、报名查询、进度更新、完成课程、报名数量统计等功能.
"""

from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import Lesson, SignUp
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _to_dict(item: SignUp) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "member_id": item.member_id,
        "company_id": item.company_id,
        "status": item.status,
        "completed_time": item.completed_time.isoformat()
        if item.completed_time
        else None,
        "progress": item.progress,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class SignUpCreate(BaseModel):
    lesson_id: int
    member_id: int
    company_id: int | None = None


class ProgressUpdate(BaseModel):
    progress: int = Field(..., ge=0, le=100)


# ---------------------------------------------------------------------------
# 报名操作
# ---------------------------------------------------------------------------


@router.post("", summary="报名课程")
async def create_signup(body: SignUpCreate):
    with get_session() as db:
        try:
            existing = (
                db.query(SignUp)
                .filter(
                    SignUp.lesson_id == body.lesson_id,
                    SignUp.member_id == body.member_id,
                    SignUp.status != 2,
                )
                .first()
            )
            if existing:
                return error("已报名该课程")
            lesson = db.query(Lesson).filter(Lesson.id == body.lesson_id).first()
            if not lesson:
                return error("课程不存在")
            signup = SignUp(
                lesson_id=body.lesson_id,
                member_id=body.member_id,
                company_id=body.company_id,
                status=0,
                progress=0,
            )
            db.add(signup)
            db.flush()
            return success(_to_dict(signup))
        except Exception as e:
            logger.exception("create_signup error")
            return error(str(e))


@router.get("/check", summary="检查报名状态")
async def check_signup(
    member_id: int = Query(...),
    lesson_id: int = Query(...),
):
    with get_session() as db:
        try:
            signup = (
                db.query(SignUp)
                .filter(
                    SignUp.member_id == member_id,
                    SignUp.lesson_id == lesson_id,
                    SignUp.status != 2,
                )
                .first()
            )
            return success(
                {
                    "signed_up": signup is not None,
                    "signup": _to_dict(signup) if signup else None,
                }
            )
        except Exception as e:
            logger.exception("check_signup error")
            return error(str(e))


@router.get("/{signup_id}", summary="报名详情")
async def get_signup(signup_id: int):
    with get_session() as db:
        try:
            signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
            if not signup:
                return error("报名记录不存在")
            return success(_to_dict(signup))
        except Exception as e:
            logger.exception("get_signup error")
            return error(str(e))


@router.delete("/{signup_id}", summary="取消报名")
async def cancel_signup(signup_id: int):
    with get_session() as db:
        try:
            signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
            if not signup:
                return error("报名记录不存在")
            signup.status = 2
            db.flush()
            return success({"id": signup_id})
        except Exception as e:
            logger.exception("cancel_signup error")
            return error(str(e))


@router.put("/{signup_id}/progress", summary="更新学习进度")
async def update_progress(signup_id: int, body: ProgressUpdate):
    with get_session() as db:
        try:
            signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
            if not signup:
                return error("报名记录不存在")
            signup.progress = body.progress
            if body.progress >= 100:
                signup.status = 1
                signup.completed_time = utcnow()
            db.flush()
            return success(_to_dict(signup))
        except Exception as e:
            logger.exception("update_progress error")
            return error(str(e))


@router.put("/{signup_id}/complete", summary="完成课程")
async def complete_signup(signup_id: int):
    with get_session() as db:
        try:
            signup = db.query(SignUp).filter(SignUp.id == signup_id).first()
            if not signup:
                return error("报名记录不存在")
            signup.status = 1
            signup.progress = 100
            signup.completed_time = utcnow()
            db.flush()
            return success(_to_dict(signup))
        except Exception as e:
            logger.exception("complete_signup error")
            return error(str(e))


# ---------------------------------------------------------------------------
# 报名列表
# ---------------------------------------------------------------------------


@router.get("/member/{member_id}/list", summary="会员报名列表")
async def list_member_signups(
    member_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(SignUp).filter(SignUp.member_id == member_id)
            if status is not None:
                q = q.filter(SignUp.status == status)
            else:
                q = q.filter(SignUp.status != 2)
            total = q.count()
            items = (
                q.order_by(SignUp.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_member_signups error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/list", summary="课程报名列表")
async def list_lesson_signups(
    lesson_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(SignUp).filter(SignUp.lesson_id == lesson_id)
            if status is not None:
                q = q.filter(SignUp.status == status)
            else:
                q = q.filter(SignUp.status != 2)
            total = q.count()
            items = (
                q.order_by(SignUp.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_lesson_signups error")
            return error(str(e))


# ---------------------------------------------------------------------------
# 报名数量统计
# ---------------------------------------------------------------------------


@router.get("/member/{member_id}/count", summary="会员报名数量统计")
async def count_member_signups(member_id: int):
    with get_session() as db:
        try:
            total = (
                db.query(SignUp)
                .filter(SignUp.member_id == member_id, SignUp.status != 2)
                .count()
            )
            completed = (
                db.query(SignUp)
                .filter(
                    SignUp.member_id == member_id,
                    SignUp.status == 1,
                )
                .count()
            )
            return success(
                {
                    "member_id": member_id,
                    "total": total,
                    "completed": completed,
                    "in_progress": total - completed,
                }
            )
        except Exception as e:
            logger.exception("count_member_signups error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/count", summary="课程报名数量统计")
async def count_lesson_signups(lesson_id: int):
    with get_session() as db:
        try:
            total = (
                db.query(SignUp)
                .filter(SignUp.lesson_id == lesson_id, SignUp.status != 2)
                .count()
            )
            completed = (
                db.query(SignUp)
                .filter(
                    SignUp.lesson_id == lesson_id,
                    SignUp.status == 1,
                )
                .count()
            )
            return success(
                {
                    "lesson_id": lesson_id,
                    "total": total,
                    "completed": completed,
                    "in_progress": total - completed,
                }
            )
        except Exception as e:
            logger.exception("count_lesson_signups error")
            return error(str(e))
