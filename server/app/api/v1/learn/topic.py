"""专题管理 API (迁移自 ihui-ai-edu-learn-service 专题模块)

提供专题的增删改查、发布/取消发布/推荐, 以及专题课程关系管理。
专题状态: 0=未发布 1=已发布 2=已删除。
"""
from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import Topic, TopicLesson
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _uid_int() -> int | None:
    """将当前用户 UUID 转为整数, 失败返回 None (兼容 BigInteger 列)."""
    try:
        return int(_uid())
    except (TypeError, ValueError):
        return None


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _to_dict(item: Topic) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "image": item.image,
        "status": item.status,
        "price": item.price,
        "original_price": item.original_price,
        "create_user_id": item.create_user_id,
        "company_id": item.company_id,
        "department_id": item.department_id,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


def _lesson_to_dict(item: TopicLesson) -> dict:
    return {
        "id": item.id,
        "lesson_id": item.lesson_id,
        "topic_id": item.topic_id,
        "create_time": _iso(item.created_at),
    }


class TopicCreate(BaseModel):
    title: str
    description: str | None = None
    image: str | None = None
    status: int = 0
    price: int = 0
    original_price: int = 0
    company_id: int | None = None
    department_id: int | None = None


class TopicUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    image: str | None = None
    status: int | None = None
    price: int | None = None
    original_price: int | None = None
    company_id: int | None = None
    department_id: int | None = None


class TopicLessonCreate(BaseModel):
    lesson_id: int


@router.get("/list", summary="专题列表")
def list_topics(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Topic).filter(Topic.status != 2)
            if status is not None:
                q = q.filter(Topic.status == status)
            if keyword:
                q = q.filter(Topic.title.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(Topic.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_topics error")
            return error(str(e))


@router.get("/{topic_id}", summary="专题详情")
def get_topic(topic_id: int):
    with get_session() as db:
        try:
            item = db.query(Topic).filter(Topic.id == topic_id).first()
            if not item:
                return error("专题不存在")
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("get_topic error")
            return error(str(e))


@router.post("", summary="创建专题")
def create_topic(body: TopicCreate):
    with get_session() as db:
        try:
            item = Topic(
                title=body.title,
                description=body.description,
                image=body.image,
                status=body.status,
                price=body.price,
                original_price=body.original_price,
                create_user_id=_uid_int(),
                company_id=body.company_id,
                department_id=body.department_id,
            )
            db.add(item)
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("create_topic error")
            return error(str(e))


@router.put("/{topic_id}", summary="更新专题")
def update_topic(topic_id: int, body: TopicUpdate):
    with get_session() as db:
        try:
            item = db.query(Topic).filter(Topic.id == topic_id).first()
            if not item:
                return error("专题不存在")
            if body.title is not None:
                item.title = body.title
            if body.description is not None:
                item.description = body.description
            if body.image is not None:
                item.image = body.image
            if body.status is not None:
                item.status = body.status
            if body.price is not None:
                item.price = body.price
            if body.original_price is not None:
                item.original_price = body.original_price
            if body.company_id is not None:
                item.company_id = body.company_id
            if body.department_id is not None:
                item.department_id = body.department_id
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("update_topic error")
            return error(str(e))


@router.delete("/{topic_id}", summary="删除专题")
def delete_topic(topic_id: int):
    with get_session() as db:
        try:
            item = db.query(Topic).filter(Topic.id == topic_id).first()
            if not item:
                return error("专题不存在")
            item.status = 2
            db.flush()
            return success({"id": topic_id})
        except Exception as e:
            logger.exception("delete_topic error")
            return error(str(e))


@router.put("/{topic_id}/publish", summary="发布专题")
def publish_topic(topic_id: int):
    with get_session() as db:
        try:
            item = db.query(Topic).filter(Topic.id == topic_id).first()
            if not item:
                return error("专题不存在")
            item.status = 1
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("publish_topic error")
            return error(str(e))


@router.put("/{topic_id}/unpublish", summary="取消发布专题")
def unpublish_topic(topic_id: int):
    with get_session() as db:
        try:
            item = db.query(Topic).filter(Topic.id == topic_id).first()
            if not item:
                return error("专题不存在")
            item.status = 0
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("unpublish_topic error")
            return error(str(e))


@router.get("/recommend", summary="推荐专题列表")
def list_recommend_topics(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(Topic).filter(Topic.status == 1)
            total = q.count()
            items = q.order_by(Topic.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_recommend_topics error")
            return error(str(e))


@router.put("/{topic_id}/recommend", summary="推荐专题")
def recommend_topic(topic_id: int):
    with get_session() as db:
        try:
            item = db.query(Topic).filter(Topic.id == topic_id).first()
            if not item:
                return error("专题不存在")
            # 推荐专题需先发布, 确保对学员可见
            item.status = 1
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("recommend_topic error")
            return error(str(e))


@router.get("/{topic_id}/lessons", summary="专题课程列表")
def list_topic_lessons(
    topic_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(TopicLesson).filter(TopicLesson.topic_id == topic_id)
            total = q.count()
            items = (
                q.order_by(TopicLesson.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_lesson_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_topic_lessons error")
            return error(str(e))


@router.post("/{topic_id}/lessons", summary="添加专题课程关系")
def add_topic_lesson(topic_id: int, body: TopicLessonCreate):
    with get_session() as db:
        try:
            exists = (
                db.query(TopicLesson)
                .filter(
                    TopicLesson.topic_id == topic_id,
                    TopicLesson.lesson_id == body.lesson_id,
                )
                .first()
            )
            if exists:
                return error("该课程已添加到专题")
            item = TopicLesson(topic_id=topic_id, lesson_id=body.lesson_id)
            db.add(item)
            db.flush()
            return success(_lesson_to_dict(item))
        except Exception as e:
            logger.exception("add_topic_lesson error")
            return error(str(e))


@router.delete("/{topic_id}/lessons/{lesson_id}", summary="移除专题课程关系")
def remove_topic_lesson(topic_id: int, lesson_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(TopicLesson)
                .filter(
                    TopicLesson.topic_id == topic_id,
                    TopicLesson.lesson_id == lesson_id,
                )
                .first()
            )
            if not item:
                return error("专题课程关系不存在")
            db.delete(item)
            db.flush()
            return success({"topic_id": topic_id, "lesson_id": lesson_id})
        except Exception as e:
            logger.exception("remove_topic_lesson error")
            return error(str(e))
