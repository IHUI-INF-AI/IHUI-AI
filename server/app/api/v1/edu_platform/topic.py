"""专题模块路由 - 迁移自旧 Java Spring Boot topic-service (2026-07-05).

包含: 课程专题列表/详情. 专题模型定义在 learn 模块 (EduLessonTopic).
"""
import json

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduLesson, EduLessonTopic
from app.schemas.common import error, success

router = APIRouter()


def _parse_lesson_ids(raw: str | None) -> list[int]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [int(i) for i in data if str(i).isdigit()]
    except (ValueError, TypeError):
        pass
    return []


def _topic_to_dict(t: EduLessonTopic, with_lessons: bool = False, lessons: list | None = None) -> dict:
    result = {
        "id": t.id,
        "title": t.title,
        "cover_image": t.cover_image,
        "description": t.description,
        "lesson_ids": _parse_lesson_ids(t.lesson_ids),
        "is_published": t.is_published,
        "sort": t.sort,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }
    if with_lessons:
        result["lessons"] = lessons or []
    return result


def _lesson_brief(l: EduLesson) -> dict:
    return {
        "id": l.id,
        "title": l.title,
        "cover_image": l.cover_image,
        "intro": l.intro,
        "price": l.price,
        "original_price": l.original_price,
        "is_free": l.is_free,
        "lesson_count": l.lesson_count,
        "view_count": l.view_count,
        "signup_count": l.signup_count,
    }


@router.get("/list", summary="专题列表")
async def topic_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    is_published: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduLessonTopic)
            if title:
                q = q.filter(EduLessonTopic.title.like(f"%{title}%"))
            if is_published is not None:
                q = q.filter(EduLessonTopic.is_published == is_published)
            if status is not None:
                q = q.filter(EduLessonTopic.status == status)
            else:
                q = q.filter(EduLessonTopic.status == 1)
            total = q.count()
            items = (
                q.order_by(EduLessonTopic.sort.asc(), EduLessonTopic.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_topic_to_dict(t) for t in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu topic] list error: {e}")
            return error(str(e))


@router.get("/{topic_id}", summary="专题详情")
async def topic_detail(topic_id: int):
    with get_session() as db:
        try:
            t = db.query(EduLessonTopic).filter(EduLessonTopic.id == topic_id).first()
            if not t:
                return error("专题不存在", "404")
            lesson_ids = _parse_lesson_ids(t.lesson_ids)
            lessons: list = []
            if lesson_ids:
                rows = (
                    db.query(EduLesson)
                    .filter(EduLesson.id.in_(lesson_ids), EduLesson.status == 1)
                    .all()
                )
                lesson_map = {l.id: l for l in rows}
                lessons = [ _lesson_brief(lesson_map[lid]) for lid in lesson_ids if lid in lesson_map ]
            return success(_topic_to_dict(t, with_lessons=True, lessons=lessons))
        except Exception as e:
            logger.error(f"[edu topic] detail error: {e}")
            return error(str(e))


@router.post("/", summary="新建专题")
async def create_topic(
    title: str = Query(..., min_length=1, max_length=200),
    cover_image: str | None = Query(None, max_length=500),
    description: str | None = Query(None),
    lesson_ids: str | None = Query(None, description="课程id列表(JSON数组字符串)"),
    is_published: bool = Query(False),
    sort: int = Query(0),
    status: int = Query(1),
):
    with get_session() as db:
        try:
            t = EduLessonTopic(
                title=title,
                cover_image=cover_image,
                description=description,
                lesson_ids=lesson_ids,
                is_published=is_published,
                sort=sort,
                status=status,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu topic] create error: {e}")
            return error(str(e))


@router.put("/", summary="更新专题")
async def update_topic(
    id: int = Query(...),
    title: str | None = Query(None),
    cover_image: str | None = Query(None),
    description: str | None = Query(None),
    lesson_ids: str | None = Query(None),
    is_published: bool | None = Query(None),
    sort: int | None = Query(None),
    status: int | None = Query(None),
):
    with get_session() as db:
        try:
            t = db.query(EduLessonTopic).filter(EduLessonTopic.id == id).first()
            if not t:
                return error("专题不存在", "404")
            if title is not None:
                t.title = title
            if cover_image is not None:
                t.cover_image = cover_image
            if description is not None:
                t.description = description
            if lesson_ids is not None:
                t.lesson_ids = lesson_ids
            if is_published is not None:
                t.is_published = is_published
            if sort is not None:
                t.sort = sort
            if status is not None:
                t.status = status
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu topic] update error: {e}")
            return error(str(e))


@router.delete("/", summary="删除专题")
async def delete_topic(id: int = Query(..., description="专题id")):
    with get_session() as db:
        try:
            t = db.query(EduLessonTopic).filter(EduLessonTopic.id == id).first()
            if not t:
                return error("专题不存在", "404")
            db.delete(t)
            return success()
        except Exception as e:
            logger.error(f"[edu topic] delete error: {e}")
            return error(str(e))
