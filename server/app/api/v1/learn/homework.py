"""学习模块 - 作业管理"""
from fastapi import APIRouter, Body, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.learn_models import LearnHomework, LearnHomeworkRecord
from app.schemas.common import error, success


class HomeworkUpsertRequest(BaseModel):
    content: str = Field(..., min_length=1)
    url: str = ""


router = APIRouter()


@router.get("/homework/lesson/{lesson_id}", summary="课程作业详情")
async def get_homework_by_lesson(lesson_id: int):
    with get_session() as db:
        try:
            h = db.query(LearnHomework).filter(LearnHomework.lesson_id == lesson_id).first()
            if not h:
                return success(None)
            return success(
                {
                    "id": h.id,
                    "lesson_id": h.lesson_id,
                    "url": h.url,
                    "content": h.content,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
            )
        except Exception as e:
            logger.error(f"learn homework get error: {e}")
            return error(str(e))


@router.post("/homework", summary="创建/更新课程作业")
async def upsert_homework(
    lesson_id: int = Query(...),
    payload: HomeworkUpsertRequest = Depends(),
):
    with get_session() as db:
        try:
            h = db.query(LearnHomework).filter(LearnHomework.lesson_id == lesson_id).first()
            if h:
                h.content = payload.content
                h.url = payload.url
            else:
                h = LearnHomework(lesson_id=lesson_id, content=payload.content, url=payload.url)
                db.add(h)
            db.flush()
            return success({"id": h.id})
        except Exception as e:
            logger.error(f"learn homework upsert error: {e}")
            return error(str(e))


@router.delete("/homework/{hid}", summary="删除作业")
async def delete_homework(hid: int):
    with get_session() as db:
        try:
            h = db.query(LearnHomework).filter(LearnHomework.id == hid).first()
            if not h:
                return error("作业不存在", "404")
            db.delete(h)
            return success()
        except Exception as e:
            logger.error(f"learn homework delete error: {e}")
            return error(str(e))


# ============ 作业提交记录 ============


@router.get("/homework-record/list", summary="作业提交记录列表")
async def list_homework_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    lesson_id: int | None = None,
    sign_up_id: int | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnHomeworkRecord)
            if member_id:
                q = q.filter(LearnHomeworkRecord.member_id == member_id)
            if lesson_id:
                q = q.filter(LearnHomeworkRecord.lesson_id == lesson_id)
            if sign_up_id:
                q = q.filter(LearnHomeworkRecord.sign_up_id == sign_up_id)
            if status:
                q = q.filter(LearnHomeworkRecord.status == status)
            total = q.count()
            items = q.order_by(LearnHomeworkRecord.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": r.id,
                        "member_id": r.member_id,
                        "lesson_id": r.lesson_id,
                        "url": r.url,
                        "status": r.status,
                        "sign_up_id": r.sign_up_id,
                        "created_at": r.created_at.isoformat() if r.created_at else None,
                    }
                    for r in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn homework record list error: {e}")
            return error(str(e))


@router.post("/homework-record", summary="提交作业")
async def submit_homework_record(
    lesson_id: int = Query(...),
    sign_up_id: int = Query(...),
    url: str = Query(..., max_length=3000),
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            r = LearnHomeworkRecord(
                member_id=member_id,
                lesson_id=lesson_id,
                sign_up_id=sign_up_id,
                url=url,
                status="pending",
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn homework record submit error: {e}")
            return error(str(e))


@router.put("/homework-record/{rid}/status", summary="审核作业")
async def review_homework_record(rid: int, status: str = Body(..., embed=True, description="pass_approval/reject_approval/pending")):
    with get_session() as db:
        try:
            r = db.query(LearnHomeworkRecord).filter(LearnHomeworkRecord.id == rid).first()
            if not r:
                return error("记录不存在", "404")
            r.status = status
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn homework record review error: {e}")
            return error(str(e))
