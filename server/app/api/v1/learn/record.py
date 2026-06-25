"""学习记录 API

迁移自 edu server ihui-ai-edu-learn-service 的 record 模块.
提供学习记录保存(同步写日志并更新报名进度)、会员课程学习记录查询、会员学习记录列表.
"""

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import Record, RecordLog, SignUp
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _record_to_dict(item: Record) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "lesson_chapter_section_id": item.lesson_chapter_section_id,
        "member_id": item.member_id,
        "learn_time": item.learn_time,
        "sign_up_id": item.sign_up_id,
        "max_progress_time": item.max_progress_time,
        "status": item.status,
        "progress": item.progress,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class RecordSave(BaseModel):
    lesson_id: int
    lesson_chapter_section_id: int
    member_id: int
    learn_time: int = 0
    sign_up_id: int | None = None
    max_progress_time: int = 0
    progress: int = Field(0, ge=0, le=100)


# ---------------------------------------------------------------------------
# 学习记录接口
# ---------------------------------------------------------------------------


@router.post("/save", summary="保存学习记录")
def save_record(body: RecordSave):
    with get_session() as db:
        try:
            record = (
                db.query(Record)
                .filter(
                    Record.lesson_id == body.lesson_id,
                    Record.lesson_chapter_section_id == body.lesson_chapter_section_id,
                    Record.member_id == body.member_id,
                )
                .first()
            )
            if record:
                record.learn_time = body.learn_time
                if body.max_progress_time > record.max_progress_time:
                    record.max_progress_time = body.max_progress_time
                if body.progress > record.progress:
                    record.progress = body.progress
                if body.progress >= 100:
                    record.status = 1
            else:
                record = Record(
                    lesson_id=body.lesson_id,
                    lesson_chapter_section_id=body.lesson_chapter_section_id,
                    member_id=body.member_id,
                    learn_time=body.learn_time,
                    sign_up_id=body.sign_up_id,
                    max_progress_time=body.max_progress_time,
                    status=1 if body.progress >= 100 else 0,
                    progress=body.progress,
                )
                db.add(record)
            db.flush()

            log = RecordLog(
                lesson_id=body.lesson_id,
                lesson_chapter_section_id=body.lesson_chapter_section_id,
                member_id=body.member_id,
                learn_time=body.learn_time,
                sign_up_id=body.sign_up_id,
            )
            db.add(log)

            if body.sign_up_id:
                signup = db.query(SignUp).filter(SignUp.id == body.sign_up_id).first()
                if signup:
                    records = (
                        db.query(Record)
                        .filter(
                            Record.sign_up_id == body.sign_up_id,
                            Record.member_id == body.member_id,
                        )
                        .all()
                    )
                    if records:
                        avg_progress = sum(r.progress for r in records) // len(records)
                        if avg_progress > signup.progress:
                            signup.progress = avg_progress
                        if avg_progress >= 100:
                            signup.status = 1
            db.flush()
            return success(_record_to_dict(record))
        except Exception as e:
            logger.exception("save_record error")
            return error(str(e))


@router.get("/member/{member_id}/lesson/{lesson_id}", summary="查询会员课程学习记录")
def get_member_lesson_records(member_id: int, lesson_id: int):
    with get_session() as db:
        try:
            records = (
                db.query(Record)
                .filter(
                    Record.member_id == member_id,
                    Record.lesson_id == lesson_id,
                )
                .order_by(Record.id.asc())
                .all()
            )
            total_learn_time = sum(r.learn_time for r in records)
            max_progress = max((r.progress for r in records), default=0)
            return success(
                {
                    "member_id": member_id,
                    "lesson_id": lesson_id,
                    "records": [_record_to_dict(r) for r in records],
                    "total_learn_time": total_learn_time,
                    "max_progress": max_progress,
                    "section_count": len(records),
                }
            )
        except Exception as e:
            logger.exception("get_member_lesson_records error")
            return error(str(e))


@router.get("/member/{member_id}/list", summary="会员所有学习记录")
def list_member_records(
    member_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    lesson_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Record).filter(Record.member_id == member_id)
            if lesson_id is not None:
                q = q.filter(Record.lesson_id == lesson_id)
            total = q.count()
            items = (
                q.order_by(Record.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_record_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_member_records error")
            return error(str(e))
