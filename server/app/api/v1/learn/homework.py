"""作业管理 API (迁移自 ihui-ai-edu-learn-service 作业模块)

提供作业布置、查询、更新、删除, 以及学员作业提交与审批。
作业记录状态: 0=待审批 1=通过 2=驳回。
"""
from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import Homework, HomeworkRecord
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _uid_int() -> int | None:
    try:
        return int(_uid())
    except (TypeError, ValueError):
        return None


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _hw_to_dict(item: Homework) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "content": item.content,
        "url": item.url,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


def _record_to_dict(item: HomeworkRecord) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "member_id": item.member_id,
        "url": item.url,
        "sign_up_id": item.sign_up_id,
        "status": item.status,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


class HomeworkCreate(BaseModel):
    lesson_id: int
    content: str | None = None
    url: str | None = None


class HomeworkUpdate(BaseModel):
    content: str | None = None
    url: str | None = None


class HomeworkSubmit(BaseModel):
    lesson_id: int
    member_id: int
    url: str | None = None
    sign_up_id: int | None = None


class HomeworkAudit(BaseModel):
    status: int  # 1=通过 2=驳回


@router.post("", summary="布置作业")
async def create_homework(body: HomeworkCreate):
    with get_session() as db:
        try:
            item = Homework(
                lesson_id=body.lesson_id,
                content=body.content,
                url=body.url,
            )
            db.add(item)
            db.flush()
            return success(_hw_to_dict(item))
        except Exception as e:
            logger.exception("create_homework error")
            return error(str(e))


@router.get("/{homework_id}", summary="作业详情")
async def get_homework(homework_id: int):
    with get_session() as db:
        try:
            item = db.query(Homework).filter(Homework.id == homework_id).first()
            if not item:
                return error("作业不存在")
            return success(_hw_to_dict(item))
        except Exception as e:
            logger.exception("get_homework error")
            return error(str(e))


@router.get("/lesson/{lesson_id}", summary="课程作业详情")
async def get_lesson_homework(lesson_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(Homework)
                .filter(Homework.lesson_id == lesson_id)
                .order_by(Homework.id.desc())
                .first()
            )
            if not item:
                return error("该课程暂未布置作业")
            return success(_hw_to_dict(item))
        except Exception as e:
            logger.exception("get_lesson_homework error")
            return error(str(e))


@router.put("/{homework_id}", summary="更新作业")
async def update_homework(homework_id: int, body: HomeworkUpdate):
    with get_session() as db:
        try:
            item = db.query(Homework).filter(Homework.id == homework_id).first()
            if not item:
                return error("作业不存在")
            if body.content is not None:
                item.content = body.content
            if body.url is not None:
                item.url = body.url
            db.flush()
            return success(_hw_to_dict(item))
        except Exception as e:
            logger.exception("update_homework error")
            return error(str(e))


@router.delete("/{homework_id}", summary="删除作业")
async def delete_homework(homework_id: int):
    with get_session() as db:
        try:
            item = db.query(Homework).filter(Homework.id == homework_id).first()
            if not item:
                return error("作业不存在")
            db.delete(item)
            db.flush()
            return success({"id": homework_id})
        except Exception as e:
            logger.exception("delete_homework error")
            return error(str(e))


@router.post("/submit", summary="提交作业")
async def submit_homework(body: HomeworkSubmit):
    with get_session() as db:
        try:
            item = HomeworkRecord(
                lesson_id=body.lesson_id,
                member_id=body.member_id,
                url=body.url,
                sign_up_id=body.sign_up_id,
                status=0,
            )
            db.add(item)
            db.flush()
            return success(_record_to_dict(item))
        except Exception as e:
            logger.exception("submit_homework error")
            return error(str(e))


@router.get("/record/{record_id}", summary="作业记录详情")
async def get_homework_record(record_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(HomeworkRecord)
                .filter(HomeworkRecord.id == record_id)
                .first()
            )
            if not item:
                return error("作业记录不存在")
            return success(_record_to_dict(item))
        except Exception as e:
            logger.exception("get_homework_record error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/records", summary="课程作业记录列表")
async def list_lesson_records(
    lesson_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    member_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(HomeworkRecord).filter(HomeworkRecord.lesson_id == lesson_id)
            if status is not None:
                q = q.filter(HomeworkRecord.status == status)
            if member_id is not None:
                q = q.filter(HomeworkRecord.member_id == member_id)
            total = q.count()
            items = (
                q.order_by(HomeworkRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_record_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_lesson_records error")
            return error(str(e))


@router.put("/record/{record_id}/audit", summary="审批作业")
async def audit_homework_record(record_id: int, body: HomeworkAudit):
    with get_session() as db:
        try:
            if body.status not in (1, 2):
                return error("审批状态非法, 仅支持 1=通过 2=驳回")
            item = (
                db.query(HomeworkRecord)
                .filter(HomeworkRecord.id == record_id)
                .first()
            )
            if not item:
                return error("作业记录不存在")
            item.status = body.status
            db.flush()
            return success(_record_to_dict(item))
        except Exception as e:
            logger.exception("audit_homework_record error")
            return error(str(e))
