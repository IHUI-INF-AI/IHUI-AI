"""课程任务 API

迁移自 edu server ihui-ai-edu-learn-service 的 task 模块.
提供课程任务 CRUD、启用/禁用、课程任务列表、会员任务进度查询.
"""

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import LessonTask
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _to_dict(item: LessonTask) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "lesson_chapter_id": item.lesson_chapter_id,
        "lesson_chapter_section_id": item.lesson_chapter_section_id,
        "title": item.title,
        "content_type": item.content_type,
        "conditions": item.conditions,
        "status": item.status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class TaskCreate(BaseModel):
    lesson_id: int
    lesson_chapter_id: int | None = None
    lesson_chapter_section_id: int | None = None
    title: str | None = Field(None, max_length=200)
    content_type: str | None = None
    conditions: str | None = None
    status: int = 0


class TaskUpdate(BaseModel):
    lesson_chapter_id: int | None = None
    lesson_chapter_section_id: int | None = None
    title: str | None = Field(None, max_length=200)
    content_type: str | None = None
    conditions: str | None = None
    status: int | None = None


# ---------------------------------------------------------------------------
# 任务 CRUD
# ---------------------------------------------------------------------------


@router.post("", summary="创建任务")
async def create_task(body: TaskCreate):
    with get_session() as db:
        try:
            task = LessonTask(
                lesson_id=body.lesson_id,
                lesson_chapter_id=body.lesson_chapter_id,
                lesson_chapter_section_id=body.lesson_chapter_section_id,
                title=body.title,
                content_type=body.content_type,
                conditions=body.conditions,
                status=body.status,
            )
            db.add(task)
            db.flush()
            return success(_to_dict(task))
        except Exception as e:
            logger.exception("create_task error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/list", summary="课程任务列表")
async def list_lesson_tasks(
    lesson_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LessonTask).filter(LessonTask.lesson_id == lesson_id)
            if status is not None:
                q = q.filter(LessonTask.status == status)
            total = q.count()
            items = (
                q.order_by(LessonTask.id.asc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_lesson_tasks error")
            return error(str(e))


@router.get("/lesson/{lesson_id}/member/{member_id}/progress", summary="会员任务进度")
async def get_member_task_progress(lesson_id: int, member_id: int):
    with get_session() as db:
        try:
            tasks = (
                db.query(LessonTask)
                .filter(LessonTask.lesson_id == lesson_id, LessonTask.status == 1)
                .order_by(LessonTask.id.asc())
                .all()
            )
            total = len(tasks)
            result = []
            for t in tasks:
                result.append(
                    {
                        "task_id": t.id,
                        "title": t.title,
                        "content_type": t.content_type,
                        "progress": 0,
                        "completed": False,
                    }
                )
            completed = sum(1 for r in result if r["completed"])
            return success(
                {
                    "lesson_id": lesson_id,
                    "member_id": member_id,
                    "total": total,
                    "completed": completed,
                    "progress": (completed // total * 100) if total else 0,
                    "tasks": result,
                }
            )
        except Exception as e:
            logger.exception("get_member_task_progress error")
            return error(str(e))


@router.get("/{task_id}", summary="任务详情")
async def get_task(task_id: int):
    with get_session() as db:
        try:
            task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
            if not task:
                return error("任务不存在")
            return success(_to_dict(task))
        except Exception as e:
            logger.exception("get_task error")
            return error(str(e))


@router.put("/{task_id}", summary="更新任务")
async def update_task(task_id: int, body: TaskUpdate):
    with get_session() as db:
        try:
            task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
            if not task:
                return error("任务不存在")
            update_data = body.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(task, key, value)
            db.flush()
            return success(_to_dict(task))
        except Exception as e:
            logger.exception("update_task error")
            return error(str(e))


@router.delete("/{task_id}", summary="删除任务")
async def delete_task(task_id: int):
    with get_session() as db:
        try:
            task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
            if not task:
                return error("任务不存在")
            db.delete(task)
            db.flush()
            return success({"id": task_id})
        except Exception as e:
            logger.exception("delete_task error")
            return error(str(e))


@router.put("/{task_id}/enable", summary="启用任务")
async def enable_task(task_id: int):
    with get_session() as db:
        try:
            task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
            if not task:
                return error("任务不存在")
            task.status = 1
            db.flush()
            return success(_to_dict(task))
        except Exception as e:
            logger.exception("enable_task error")
            return error(str(e))


@router.put("/{task_id}/disable", summary="禁用任务")
async def disable_task(task_id: int):
    with get_session() as db:
        try:
            task = db.query(LessonTask).filter(LessonTask.id == task_id).first()
            if not task:
                return error("任务不存在")
            task.status = 0
            db.flush()
            return success(_to_dict(task))
        except Exception as e:
            logger.exception("disable_task error")
            return error(str(e))
