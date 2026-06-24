"""学习地图 API (迁移自 ihui-ai-edu-learn-service learnmap 模块)

提供学习地图的 CRUD、发布/取消发布、推荐、以及学习地图与专题的关系管理。
模型: LearnMap, LearnMapTopic
"""
from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import LearnMap, LearnMapTopic
from app.schemas.common import error, page_result, success

router = APIRouter()


def _uid() -> str:
    return current_user_id_or_guest()


def _to_dict(item: LearnMap) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "image": item.image,
        "status": item.status,
        "create_user_id": item.create_user_id,
        "company_id": item.company_id,
        "department_id": item.department_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def _topic_to_dict(item: LearnMapTopic) -> dict:
    return {
        "id": item.id,
        "learn_map_id": item.learn_map_id,
        "topic_id": item.topic_id,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


class LearnMapCreate(BaseModel):
    title: str
    description: str | None = None
    image: str | None = None
    company_id: int | None = None
    department_id: int | None = None


class LearnMapUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    image: str | None = None


class LearnMapTopicCreate(BaseModel):
    topic_id: int


@router.get("/list", summary="学习地图列表")
async def list_learnmaps(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnMap).filter(LearnMap.status != 2)
            if status is not None:
                q = q.filter(LearnMap.status == status)
            if keyword:
                q = q.filter(LearnMap.title.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(LearnMap.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_learnmaps error")
            return error(str(e))


@router.get("/{map_id}", summary="学习地图详情")
async def get_learnmap(map_id: int):
    with get_session() as db:
        try:
            item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
            if not item:
                return error("学习地图不存在")
            topics = (
                db.query(LearnMapTopic)
                .filter(LearnMapTopic.learn_map_id == map_id)
                .order_by(LearnMapTopic.id.asc())
                .all()
            )
            data = _to_dict(item)
            data["topics"] = [_topic_to_dict(t) for t in topics]
            return success(data)
        except Exception as e:
            logger.exception("get_learnmap error")
            return error(str(e))


@router.post("", summary="创建学习地图")
async def create_learnmap(body: LearnMapCreate):
    with get_session() as db:
        try:
            item = LearnMap(
                title=body.title,
                description=body.description,
                image=body.image,
                status=0,
                create_user_id=_uid(),
                company_id=body.company_id,
                department_id=body.department_id,
            )
            db.add(item)
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("create_learnmap error")
            return error(str(e))


@router.put("/{map_id}", summary="更新学习地图")
async def update_learnmap(map_id: int, body: LearnMapUpdate):
    with get_session() as db:
        try:
            item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
            if not item:
                return error("学习地图不存在")
            if body.title is not None:
                item.title = body.title
            if body.description is not None:
                item.description = body.description
            if body.image is not None:
                item.image = body.image
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("update_learnmap error")
            return error(str(e))


@router.delete("/{map_id}", summary="删除学习地图")
async def delete_learnmap(map_id: int):
    with get_session() as db:
        try:
            item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
            if not item:
                return error("学习地图不存在")
            item.status = 2
            db.flush()
            return success()
        except Exception as e:
            logger.exception("delete_learnmap error")
            return error(str(e))


@router.put("/{map_id}/publish", summary="发布学习地图")
async def publish_learnmap(map_id: int):
    with get_session() as db:
        try:
            item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
            if not item:
                return error("学习地图不存在")
            item.status = 1
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("publish_learnmap error")
            return error(str(e))


@router.put("/{map_id}/unpublish", summary="取消发布学习地图")
async def unpublish_learnmap(map_id: int):
    with get_session() as db:
        try:
            item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
            if not item:
                return error("学习地图不存在")
            item.status = 0
            db.flush()
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("unpublish_learnmap error")
            return error(str(e))


@router.get("/recommend", summary="推荐学习地图列表")
async def list_recommend_learnmaps(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    with get_session() as db:
        try:
            q = db.query(LearnMap).filter(LearnMap.status == 1)
            total = q.count()
            items = q.order_by(LearnMap.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return page_result([_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_recommend_learnmaps error")
            return error(str(e))


@router.put("/{map_id}/recommend", summary="推荐学习地图")
async def recommend_learnmap(map_id: int):
    with get_session() as db:
        try:
            item = db.query(LearnMap).filter(LearnMap.id == map_id).first()
            if not item:
                return error("学习地图不存在")
            # 模型暂无 recommend 字段, 校验存在并返回当前状态
            return success(_to_dict(item))
        except Exception as e:
            logger.exception("recommend_learnmap error")
            return error(str(e))


@router.get("/{map_id}/topics", summary="学习地图主题列表")
async def list_learnmap_topics(map_id: int):
    with get_session() as db:
        try:
            items = (
                db.query(LearnMapTopic)
                .filter(LearnMapTopic.learn_map_id == map_id)
                .order_by(LearnMapTopic.id.asc())
                .all()
            )
            return success([_topic_to_dict(i) for i in items])
        except Exception as e:
            logger.exception("list_learnmap_topics error")
            return error(str(e))


@router.post("/{map_id}/topics", summary="添加学习地图主题关系")
async def add_learnmap_topic(map_id: int, body: LearnMapTopicCreate):
    with get_session() as db:
        try:
            exists = (
                db.query(LearnMapTopic)
                .filter(
                    LearnMapTopic.learn_map_id == map_id,
                    LearnMapTopic.topic_id == body.topic_id,
                )
                .first()
            )
            if exists:
                return error("该主题已存在")
            item = LearnMapTopic(learn_map_id=map_id, topic_id=body.topic_id)
            db.add(item)
            db.flush()
            return success(_topic_to_dict(item))
        except Exception as e:
            logger.exception("add_learnmap_topic error")
            return error(str(e))


@router.delete("/{map_id}/topics/{topic_id}", summary="移除学习地图主题关系")
async def remove_learnmap_topic(map_id: int, topic_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(LearnMapTopic)
                .filter(
                    LearnMapTopic.learn_map_id == map_id,
                    LearnMapTopic.topic_id == topic_id,
                )
                .first()
            )
            if not item:
                return error("主题关系不存在")
            db.delete(item)
            db.flush()
            return success()
        except Exception as e:
            logger.exception("remove_learnmap_topic error")
            return error(str(e))
