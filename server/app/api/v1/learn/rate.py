"""课程评价 API

迁移自 edu server ihui-ai-edu-learn-service 的 rate 模块.
提供课程评价创建(含重复评价校验)、评价详情、课程/会员评价列表、删除评价、课程评分汇总.
"""

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import func

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import Rate
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _to_dict(item: Rate) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "sign_id": item.sign_id,
        "member_id": item.member_id,
        "content_utility_score": item.content_utility_score,
        "content_depth_score": item.content_depth_score,
        "instructor_expertise_score": item.instructor_expertise_score,
        "teaching_method_score": item.teaching_method_score,
        "innovate_score": item.innovate_score,
        "overall_satisfaction_score": item.overall_satisfaction_score,
        "additional_comments": item.additional_comments,
        "company_id": item.company_id,
        "create_user_id": item.create_user_id,
        "create_user_name": item.create_user_name,
        "update_user_id": item.update_user_id,
        "update_user_name": item.update_user_name,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class RateCreate(BaseModel):
    lesson_id: int
    sign_id: int | None = None
    member_id: int
    content_utility_score: int = Field(5, ge=1, le=5)
    content_depth_score: int = Field(5, ge=1, le=5)
    instructor_expertise_score: int = Field(5, ge=1, le=5)
    teaching_method_score: int = Field(5, ge=1, le=5)
    innovate_score: int = Field(5, ge=1, le=5)
    overall_satisfaction_score: int = Field(5, ge=1, le=5)
    additional_comments: str | None = None
    company_id: int | None = None


# ---------------------------------------------------------------------------
# 评价接口
# ---------------------------------------------------------------------------


@router.post("", summary="创建评价")
def create_rate(body: RateCreate):
    with get_session() as db:
        try:
            existing = (
                db.query(Rate)
                .filter(
                    Rate.lesson_id == body.lesson_id,
                    Rate.member_id == body.member_id,
                )
                .first()
            )
            if existing:
                return error("已评价过该课程")
            rate = Rate(
                lesson_id=body.lesson_id,
                sign_id=body.sign_id,
                member_id=body.member_id,
                content_utility_score=body.content_utility_score,
                content_depth_score=body.content_depth_score,
                instructor_expertise_score=body.instructor_expertise_score,
                teaching_method_score=body.teaching_method_score,
                innovate_score=body.innovate_score,
                overall_satisfaction_score=body.overall_satisfaction_score,
                additional_comments=body.additional_comments,
                company_id=body.company_id,
                create_user_id=_uid(),
            )
            db.add(rate)
            db.flush()
            return success(_to_dict(rate))
        except Exception as e:
            logger.exception("create_rate error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/list", summary="课程评价列表")
def list_lesson_rates(
    lesson_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(Rate).filter(Rate.lesson_id == lesson_id)
            total = q.count()
            items = (
                q.order_by(Rate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_lesson_rates error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/summary", summary="课程评分汇总")
def lesson_rate_summary(lesson_id: int):
    with get_session() as db:
        try:
            q = db.query(Rate).filter(Rate.lesson_id == lesson_id)
            total = q.count()
            if total == 0:
                return success(
                    {
                        "lesson_id": lesson_id,
                        "total": 0,
                        "content_utility_score": 0,
                        "content_depth_score": 0,
                        "instructor_expertise_score": 0,
                        "teaching_method_score": 0,
                        "innovate_score": 0,
                        "overall_satisfaction_score": 0,
                        "average_score": 0,
                    }
                )
            row = db.query(
                func.avg(Rate.content_utility_score).label("content_utility_score"),
                func.avg(Rate.content_depth_score).label("content_depth_score"),
                func.avg(Rate.instructor_expertise_score).label(
                    "instructor_expertise_score"
                ),
                func.avg(Rate.teaching_method_score).label("teaching_method_score"),
                func.avg(Rate.innovate_score).label("innovate_score"),
                func.avg(Rate.overall_satisfaction_score).label(
                    "overall_satisfaction_score"
                ),
            ).filter(Rate.lesson_id == lesson_id).one()
            scores = {
                "content_utility_score": round(float(row.content_utility_score or 0), 2),
                "content_depth_score": round(float(row.content_depth_score or 0), 2),
                "instructor_expertise_score": round(
                    float(row.instructor_expertise_score or 0), 2
                ),
                "teaching_method_score": round(
                    float(row.teaching_method_score or 0), 2
                ),
                "innovate_score": round(float(row.innovate_score or 0), 2),
                "overall_satisfaction_score": round(
                    float(row.overall_satisfaction_score or 0), 2
                ),
            }
            average_score = round(sum(scores.values()) / len(scores), 2)
            return success(
                {
                    "lesson_id": lesson_id,
                    "total": total,
                    **scores,
                    "average_score": average_score,
                }
            )
        except Exception as e:
            logger.exception("lesson_rate_summary error")
            return error(str(e))


@router.get("/member/{member_id}/list", summary="会员评价列表")
def list_member_rates(
    member_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(Rate).filter(Rate.member_id == member_id)
            total = q.count()
            items = (
                q.order_by(Rate.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_member_rates error")
            return error(str(e))


@router.get("/{rate_id}", summary="评价详情")
def get_rate(rate_id: int):
    with get_session() as db:
        try:
            rate = db.query(Rate).filter(Rate.id == rate_id).first()
            if not rate:
                return error("评价不存在")
            return success(_to_dict(rate))
        except Exception as e:
            logger.exception("get_rate error")
            return error(str(e))


@router.delete("/{rate_id}", summary="删除评价")
def delete_rate(rate_id: int):
    with get_session() as db:
        try:
            rate = db.query(Rate).filter(Rate.id == rate_id).first()
            if not rate:
                return error("评价不存在")
            db.delete(rate)
            db.flush()
            return success({"id": rate_id})
        except Exception as e:
            logger.exception("delete_rate error")
            return error(str(e))
