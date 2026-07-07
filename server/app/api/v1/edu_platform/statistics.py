"""统计模块路由 - 迁移自旧 Java Spring Boot statistics-service (2026-07-05).

聚合各业务模块的统计指标: 学习/考试/直播/会员/总览.
本模块不持有独立数据模型, 直接查询其他模块的表.
"""
from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduCircleDynamic,
    EduExam,
    EduExamRecord,
    EduLesson,
    EduLessonStudyRecord,
    EduLiveChannel,
    EduSignUp,
)
from app.models.edu_platform_models import EduArticle, EduMember, EduNews
from app.schemas.common import error, success

router = APIRouter()


@router.get("/learn", summary="学习统计")
async def learn_statistics():
    with get_session() as db:
        try:
            lesson_total = db.query(EduLesson).count()
            lesson_published = (
                db.query(EduLesson)
                .filter(EduLesson.is_published == True, EduLesson.status == 1)  # noqa: E712
                .count()
            )
            signup_total = db.query(EduSignUp).count()
            study_record_total = db.query(EduLessonStudyRecord).count()
            view_sum_rows = (
                db.query(EduLesson)
                .filter(EduLesson.status == 1)
                .with_entities(EduLesson.view_count)
                .all()
            )
            view_sum = sum((r[0] or 0) for r in view_sum_rows)
            return success(
                {
                    "lesson_total": lesson_total,
                    "lesson_published": lesson_published,
                    "signup_total": signup_total,
                    "study_record_total": study_record_total,
                    "view_sum": view_sum,
                }
            )
        except Exception as e:
            logger.error(f"[edu statistics] learn error: {e}")
            return error(str(e))


@router.get("/exam", summary="考试统计")
async def exam_statistics():
    with get_session() as db:
        try:
            exam_total = db.query(EduExam).count()
            exam_published = (
                db.query(EduExam)
                .filter(EduExam.is_published == True, EduExam.status == 1)  # noqa: E712
                .count()
            )
            record_total = db.query(EduExamRecord).count()
            pass_total = (
                db.query(EduExamRecord).filter(EduExamRecord.is_pass == True).count()  # noqa: E712
            )
            return success(
                {
                    "exam_total": exam_total,
                    "exam_published": exam_published,
                    "record_total": record_total,
                    "pass_total": pass_total,
                    "pass_rate": round(pass_total / record_total, 4) if record_total else 0,
                }
            )
        except Exception as e:
            logger.error(f"[edu statistics] exam error: {e}")
            return error(str(e))


@router.get("/live", summary="直播统计")
async def live_statistics():
    with get_session() as db:
        try:
            total = db.query(EduLiveChannel).count()
            living = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.is_live == True, EduLiveChannel.status == 1)  # noqa: E712
                .count()
            )
            published = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.is_published == True, EduLiveChannel.status == 1)  # noqa: E712
                .count()
            )
            view_rows = (
                db.query(EduLiveChannel)
                .filter(EduLiveChannel.status == 1)
                .with_entities(EduLiveChannel.view_count)
                .all()
            )
            view_sum = sum((r[0] or 0) for r in view_rows)
            return success(
                {
                    "total": total,
                    "living": living,
                    "published": published,
                    "view_sum": view_sum,
                }
            )
        except Exception as e:
            logger.error(f"[edu statistics] live error: {e}")
            return error(str(e))


@router.get("/member", summary="会员统计")
async def member_statistics():
    with get_session() as db:
        try:
            member_total = db.query(EduMember).count()
            article_total = db.query(EduArticle).count()
            news_total = db.query(EduNews).count()
            dynamic_total = (
                db.query(EduCircleDynamic).filter(EduCircleDynamic.status == 1).count()
            )
            return success(
                {
                    "member_total": member_total,
                    "article_total": article_total,
                    "news_total": news_total,
                    "dynamic_total": dynamic_total,
                }
            )
        except Exception as e:
            logger.error(f"[edu statistics] member error: {e}")
            return error(str(e))


@router.get("/overview", summary="总览统计")
async def overview_statistics():
    """聚合各业务模块核心指标, 用于首页大盘展示."""
    with get_session() as db:
        try:
            member_total = db.query(EduMember).count()
            lesson_total = db.query(EduLesson).count()
            exam_total = db.query(EduExam).count()
            live_total = db.query(EduLiveChannel).count()
            article_total = db.query(EduArticle).count()
            news_total = db.query(EduNews).count()
            signup_total = db.query(EduSignUp).count()
            exam_record_total = db.query(EduExamRecord).count()
            return success(
                {
                    "member_total": member_total,
                    "lesson_total": lesson_total,
                    "exam_total": exam_total,
                    "live_total": live_total,
                    "article_total": article_total,
                    "news_total": news_total,
                    "signup_total": signup_total,
                    "exam_record_total": exam_record_total,
                }
            )
        except Exception as e:
            logger.error(f"[edu statistics] overview error: {e}")
            return error(str(e))
