"""学习报表 API (迁移自 ihui-ai-edu-learn-service report 模块)

提供课程报名、课程学习、用户、公司维度的聚合统计报表。
模型: SignUp, Record, Lesson, Rate, Certificate
"""
from datetime import datetime

from fastapi import APIRouter, Query
from loguru import logger
from sqlalchemy import case, func

from app.database import get_session
from app.models.learn_models import Certificate, Lesson, Rate, Record, SignUp
from app.schemas.common import error, success

router = APIRouter()


def _parse_end_date(end_date: str | None) -> datetime | None:
    """将 YYYY-MM-DD 结束日期转换为当天 23:59:59, 便于范围过滤."""
    if not end_date:
        return None
    dt = datetime.strptime(end_date, "%Y-%m-%d")
    return dt.replace(hour=23, minute=59, second=59)


@router.get("/lesson/signup", summary="课程报名统计")
async def lesson_signup_report(
    start_date: str | None = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
):
    with get_session() as db:
        try:
            q = (
                db.query(
                    SignUp.lesson_id,
                    func.count(SignUp.id).label("signup_count"),
                )
                .group_by(SignUp.lesson_id)
            )
            if start_date:
                q = q.filter(SignUp.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
            end_dt = _parse_end_date(end_date)
            if end_dt:
                q = q.filter(SignUp.created_at <= end_dt)
            rows = q.all()
            lesson_ids = [r.lesson_id for r in rows]
            lesson_map: dict[int, str] = {}
            if lesson_ids:
                lessons = db.query(Lesson).filter(Lesson.id.in_(lesson_ids)).all()
                lesson_map = {l.id: l.name for l in lessons}
            return success(
                [
                    {
                        "lesson_id": r.lesson_id,
                        "lesson_name": lesson_map.get(r.lesson_id, ""),
                        "signup_count": r.signup_count,
                    }
                    for r in rows
                ]
            )
        except Exception as e:
            logger.exception("lesson_signup_report error")
            return error(str(e))


@router.get("/lesson/learn", summary="课程学习统计")
async def lesson_learn_report(
    start_date: str | None = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: str | None = Query(None, description="结束日期 YYYY-MM-DD"),
):
    with get_session() as db:
        try:
            q = (
                db.query(
                    Record.lesson_id,
                    func.sum(Record.learn_time).label("total_learn_time"),
                    func.count(Record.id).label("record_count"),
                    func.sum(case((Record.status == 1, 1), else_=0)).label("completed_count"),
                )
                .group_by(Record.lesson_id)
            )
            if start_date:
                q = q.filter(Record.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
            end_dt = _parse_end_date(end_date)
            if end_dt:
                q = q.filter(Record.created_at <= end_dt)
            rows = q.all()
            lesson_ids = [r.lesson_id for r in rows]
            lesson_map: dict[int, str] = {}
            rate_map: dict[int, float] = {}
            if lesson_ids:
                lessons = db.query(Lesson).filter(Lesson.id.in_(lesson_ids)).all()
                lesson_map = {l.id: l.name for l in lessons}
                rate_rows = (
                    db.query(
                        Rate.lesson_id,
                        func.avg(Rate.overall_satisfaction_score).label("avg_score"),
                    )
                    .filter(Rate.lesson_id.in_(lesson_ids))
                    .group_by(Rate.lesson_id)
                    .all()
                )
                rate_map = {
                    r.lesson_id: round(float(r.avg_score), 2) if r.avg_score else 0
                    for r in rate_rows
                }
            return success(
                [
                    {
                        "lesson_id": r.lesson_id,
                        "lesson_name": lesson_map.get(r.lesson_id, ""),
                        "total_learn_time": r.total_learn_time or 0,
                        "record_count": r.record_count,
                        "completed_count": r.completed_count or 0,
                        "completion_rate": round(
                            (r.completed_count or 0) / r.record_count * 100, 2
                        )
                        if r.record_count
                        else 0,
                        "avg_score": rate_map.get(r.lesson_id, 0),
                    }
                    for r in rows
                ]
            )
        except Exception as e:
            logger.exception("lesson_learn_report error")
            return error(str(e))


@router.get("/user", summary="用户学习统计")
async def user_report(member_id: int = Query(..., description="会员ID")):
    with get_session() as db:
        try:
            signup_count = (
                db.query(func.count(SignUp.id))
                .filter(SignUp.member_id == member_id)
                .scalar()
                or 0
            )
            completed_count = (
                db.query(func.count(SignUp.id))
                .filter(SignUp.member_id == member_id, SignUp.status == 1)
                .scalar()
                or 0
            )
            total_learn_time = (
                db.query(func.sum(Record.learn_time))
                .filter(Record.member_id == member_id)
                .scalar()
                or 0
            )
            cert_count = (
                db.query(func.count(Certificate.id))
                .filter(Certificate.member_id == member_id)
                .scalar()
                or 0
            )
            return success(
                {
                    "member_id": member_id,
                    "signup_count": signup_count,
                    "completed_count": completed_count,
                    "total_learn_time": total_learn_time,
                    "certificate_count": cert_count,
                }
            )
        except Exception as e:
            logger.exception("user_report error")
            return error(str(e))


@router.get("/company", summary="公司统计")
async def company_report(company_id: int = Query(..., description="公司ID")):
    with get_session() as db:
        try:
            signup_count = (
                db.query(func.count(SignUp.id))
                .filter(SignUp.company_id == company_id)
                .scalar()
                or 0
            )
            completed_count = (
                db.query(func.count(SignUp.id))
                .filter(SignUp.company_id == company_id, SignUp.status == 1)
                .scalar()
                or 0
            )
            avg_progress = (
                db.query(func.avg(SignUp.progress))
                .filter(SignUp.company_id == company_id)
                .scalar()
            )
            return success(
                {
                    "company_id": company_id,
                    "signup_count": signup_count,
                    "completed_count": completed_count,
                    "avg_progress": round(float(avg_progress), 2)
                    if avg_progress is not None
                    else 0,
                }
            )
        except Exception as e:
            logger.exception("company_report error")
            return error(str(e))
