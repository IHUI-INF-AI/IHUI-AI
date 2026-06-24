"""学习统计 API (迁移自 ihui-ai-edu-learn-service statistics 模块)

提供学习业务的综合统计数据概览, 包含课程、报名、学习时长、证书等聚合指标。
模型: SignUp, Record, Lesson, Certificate
"""
from fastapi import APIRouter
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.models.learn_models import Certificate, Lesson, Record, SignUp
from app.schemas.common import error, success

router = APIRouter()


@router.get("/overview", summary="综合统计数据")
async def overview():
    with get_session() as db:
        try:
            total_lessons = (
                db.query(func.count(Lesson.id))
                .filter(Lesson.status != 2)
                .scalar()
                or 0
            )
            published_lessons = (
                db.query(func.count(Lesson.id))
                .filter(Lesson.status == 1)
                .scalar()
                or 0
            )
            total_signups = db.query(func.count(SignUp.id)).scalar() or 0
            completed_signups = (
                db.query(func.count(SignUp.id))
                .filter(SignUp.status == 1)
                .scalar()
                or 0
            )
            total_learn_time = db.query(func.sum(Record.learn_time)).scalar() or 0
            total_certificates = (
                db.query(func.count(Certificate.id))
                .filter(Certificate.status == 0)
                .scalar()
                or 0
            )
            return success(
                {
                    "total_lessons": total_lessons,
                    "published_lessons": published_lessons,
                    "total_signups": total_signups,
                    "completed_signups": completed_signups,
                    "total_learn_time": total_learn_time,
                    "total_certificates": total_certificates,
                }
            )
        except Exception as e:
            logger.exception("overview error")
            return error(str(e))
