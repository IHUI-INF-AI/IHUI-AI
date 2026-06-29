"""学习模块 - 学习记录"""

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.learn_models import LearnRecord, LearnRecordLog
from app.schemas.common import error, success

router = APIRouter()


@router.get("/record/list", summary="学习记录列表")
async def list_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    lesson_id: int | None = None,
    sign_up_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnRecord)
            if member_id:
                q = q.filter(LearnRecord.member_id == member_id)
            if lesson_id:
                q = q.filter(LearnRecord.lesson_id == lesson_id)
            if sign_up_id:
                q = q.filter(LearnRecord.sign_up_id == sign_up_id)
            total = q.count()
            items = q.order_by(LearnRecord.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": r.id,
                        "member_id": r.member_id,
                        "lesson_id": r.lesson_id,
                        "lesson_chapter_section_id": r.lesson_chapter_section_id,
                        "sign_up_id": r.sign_up_id,
                        "learn_time": r.learn_time,
                        "max_progress_time": r.max_progress_time,
                        "status": r.status,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                    }
                    for r in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn record list error: {e}")
            return error(str(e))


@router.post("/record/upsert", summary="上报学习进度(无则新增,有则更新)")
async def upsert_record(
    lesson_id: int = Query(...),
    lesson_chapter_section_id: int = Query(...),
    sign_up_id: int = Query(...),
    learn_time: int = Query(0, ge=0),
    max_progress_time: int = Query(0, ge=0),
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            r = (
                db.query(LearnRecord)
                .filter(
                    LearnRecord.member_id == member_id,
                    LearnRecord.lesson_id == lesson_id,
                    LearnRecord.lesson_chapter_section_id == lesson_chapter_section_id,
                    LearnRecord.sign_up_id == sign_up_id,
                )
                .first()
            )
            if r:
                if learn_time > r.learn_time:
                    r.learn_time = learn_time
                if max_progress_time > r.max_progress_time:
                    r.max_progress_time = max_progress_time
                if r.status != "completed" and r.status != "progressing":
                    r.status = "progressing"
            else:
                r = LearnRecord(
                    member_id=member_id,
                    lesson_id=lesson_id,
                    lesson_chapter_section_id=lesson_chapter_section_id,
                    sign_up_id=sign_up_id,
                    learn_time=learn_time,
                    max_progress_time=max_progress_time,
                    status="progressing",
                )
                db.add(r)
            db.flush()
            # 追加日志
            db.add(
                LearnRecordLog(
                    member_id=member_id,
                    lesson_id=lesson_id,
                    lesson_chapter_section_id=lesson_chapter_section_id,
                    sign_up_id=sign_up_id,
                    learn_time=learn_time,
                )
            )
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn record upsert error: {e}")
            return error(str(e))


@router.put("/record/{rid}/complete", summary="标记章节完成")
async def complete_record(rid: int):
    with get_session() as db:
        try:
            r = db.query(LearnRecord).filter(LearnRecord.id == rid).first()
            if not r:
                return error("记录不存在", "404")
            r.status = "completed"
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn record complete error: {e}")
            return error(str(e))


@router.get("/record-log/list", summary="学习记录日志列表")
async def list_record_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    lesson_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnRecordLog)
            if member_id:
                q = q.filter(LearnRecordLog.member_id == member_id)
            if lesson_id:
                q = q.filter(LearnRecordLog.lesson_id == lesson_id)
            total = q.count()
            items = q.order_by(LearnRecordLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "member_id": l.member_id,
                        "lesson_id": l.lesson_id,
                        "lesson_chapter_section_id": l.lesson_chapter_section_id,
                        "sign_up_id": l.sign_up_id,
                        "learn_time": l.learn_time,
                        "created_at": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn record log list error: {e}")
            return error(str(e))
