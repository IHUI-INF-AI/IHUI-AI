"""学习模块 - 专题学习/学习地图"""
from fastapi import APIRouter, Body, Depends, Path, Query
from loguru import logger

from app.core.admin_auth import admin_required
from app.database import get_session
from app.models.learn_models import (
    LearnTopic,
    LearnTopicCategory,
    LearnTopicCategoryRelation,
    LearnTopicLesson,
    LearnTopicTopicCategoryRelation,
)
from app.schemas.common import error, success

router = APIRouter()


# ============ 专题 ============


@router.get("/topic/list", summary="专题列表")
async def list_topics(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnTopic)
            if status:
                q = q.filter(LearnTopic.status == status)
            if keyword:
                q = q.filter(LearnTopic.title.like(f"%{keyword}%"))
            total = q.count()
            items = q.order_by(LearnTopic.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": t.id,
                        "title": t.title,
                        "image": t.image,
                        "status": t.status,
                        "description": t.description,
                        "price": float(t.price) if t.price is not None else 0,
                        "original_price": float(t.original_price) if t.original_price is not None else 0,
                    }
                    for t in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn topic list error: {e}")
            return error(str(e))


@router.get("/topic/{tid}", summary="专题详情")
async def get_topic(tid: int):
    with get_session() as db:
        try:
            t = db.query(LearnTopic).filter(LearnTopic.id == tid).first()
            if not t:
                return error("专题不存在", "404")
            lesson_ids = [r.lesson_id for r in db.query(LearnTopicLesson).filter(LearnTopicLesson.topic_id == tid).all()]
            return success(
                {
                    "id": t.id,
                    "title": t.title,
                    "image": t.image,
                    "status": t.status,
                    "description": t.description,
                    "price": float(t.price) if t.price is not None else 0,
                    "lesson_ids": lesson_ids,
                }
            )
        except Exception as e:
            logger.error(f"learn topic get error: {e}")
            return error(str(e))


@router.post("/topic", summary="创建专题", dependencies=[Depends(admin_required)])
async def create_topic(
    title: str = Body(..., min_length=1, max_length=100),
    image: str = Body(..., max_length=1000),
    description: str = Body(""),
    status: str = Body("draft"),
    price: float = Body(0),
    original_price: float = Body(0),
    company_id: int | None = Body(None),
    department_id: int | None = Body(None),
    create_user_id: int | None = Body(None),
):
    with get_session() as db:
        try:
            t = LearnTopic(
                title=title,
                image=image,
                description=description,
                status=status,
                price=price,
                original_price=original_price,
                company_id=company_id,
                department_id=department_id,
                create_user_id=create_user_id,
            )
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"learn topic create error: {e}")
            return error(str(e))


@router.put("/topic/{tid}", summary="修改专题", dependencies=[Depends(admin_required)])
async def update_topic(
    tid: int,
    title: str | None = Body(None),
    image: str | None = Body(None),
    description: str | None = Body(None),
    status: str | None = Body(None),
    price: float | None = Body(None),
):
    with get_session() as db:
        try:
            t = db.query(LearnTopic).filter(LearnTopic.id == tid).first()
            if not t:
                return error("专题不存在", "404")
            if title is not None:
                t.title = title
            if image is not None:
                t.image = image
            if description is not None:
                t.description = description
            if status is not None:
                t.status = status
            if price is not None:
                t.price = price
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"learn topic update error: {e}")
            return error(str(e))


@router.delete("/topic/{tid}", summary="删除专题", dependencies=[Depends(admin_required)])
async def delete_topic(tid: int):
    with get_session() as db:
        try:
            t = db.query(LearnTopic).filter(LearnTopic.id == tid).first()
            if not t:
                return error("专题不存在", "404")
            db.delete(t)
            db.query(LearnTopicLesson).filter(LearnTopicLesson.topic_id == tid).delete()
            db.query(LearnTopicTopicCategoryRelation).filter(LearnTopicTopicCategoryRelation.topic_id == tid).delete()
            return success()
        except Exception as e:
            logger.error(f"learn topic delete error: {e}")
            return error(str(e))


@router.post("/topic/batch-delete", summary="批量删除专题", dependencies=[Depends(admin_required)])
async def batch_delete_topics(ids: list[int] = Body(..., embed=True)):
    with get_session() as db:
        try:
            if not ids:
                return error("ids 不能为空", "400")
            id_list = [int(i) for i in ids if i is not None]
            db.query(LearnTopic).filter(LearnTopic.id.in_(id_list)).delete(synchronize_session=False)
            db.query(LearnTopicLesson).filter(LearnTopicLesson.topic_id.in_(id_list)).delete(synchronize_session=False)
            db.query(LearnTopicTopicCategoryRelation).filter(
                LearnTopicTopicCategoryRelation.topic_id.in_(id_list)
            ).delete(synchronize_session=False)
            return success({"success": len(id_list), "failed": 0})
        except Exception as e:
            logger.error(f"learn topic batch delete error: {e}")
            return error(str(e))


@router.post("/topic/{tid}/bind-lesson", summary="专题绑定课程", dependencies=[Depends(admin_required)])
async def bind_topic_lesson(tid: int = Path(...), lesson_id: int = Query(...)):
    with get_session() as db:
        try:
            existing = (
                db.query(LearnTopicLesson)
                .filter(LearnTopicLesson.topic_id == tid, LearnTopicLesson.lesson_id == lesson_id)
                .first()
            )
            if existing:
                return success({"id": existing.id, "exists": True})
            r = LearnTopicLesson(topic_id=tid, lesson_id=lesson_id)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn topic bind lesson error: {e}")
            return error(str(e))


# ============ 专题分类 ============


@router.get("/topic-category/list", summary="专题分类列表")
async def list_topic_categories():
    with get_session() as db:
        try:
            items = (
                db.query(LearnTopicCategory)
                .filter(LearnTopicCategory.is_show)
                .order_by(LearnTopicCategory.sort_order.asc())
                .all()
            )
            return success(
                [
                    {
                        "id": c.id,
                        "name": c.name,
                        "level": c.level,
                        "image": c.image,
                        "sort_order": c.sort_order,
                    }
                    for c in items
                ]
            )
        except Exception as e:
            logger.error(f"learn topic category list error: {e}")
            return error(str(e))


@router.post("/topic-category", summary="创建专题分类", dependencies=[Depends(admin_required)])
async def create_topic_category(
    name: str = Body(..., min_length=1, max_length=50),
    level: int = Body(...),
    image: str = Body(..., max_length=500),
    sort_order: int = Body(1),
    is_show: bool = Body(True),
    is_show_index: bool = Body(True),
    company_id: int = Body(0),
    department_id: int = Body(0),
    create_user_id: int = Body(0),
):
    with get_session() as db:
        try:
            c = LearnTopicCategory(
                name=name,
                level=level,
                image=image,
                sort_order=sort_order,
                is_show=is_show,
                is_show_index=is_show_index,
                company_id=company_id,
                department_id=department_id,
                create_user_id=create_user_id,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"learn topic category create error: {e}")
            return error(str(e))


@router.post("/topic-category/batch-delete", summary="批量删除专题分类", dependencies=[Depends(admin_required)])
async def batch_delete_topic_categories(ids: list[int] = Body(..., embed=True)):
    with get_session() as db:
        try:
            if not ids:
                return error("ids 不能为空", "400")
            id_list = [int(i) for i in ids if i is not None]
            db.query(LearnTopicCategory).filter(LearnTopicCategory.id.in_(id_list)).delete(
                synchronize_session=False
            )
            db.query(LearnTopicCategoryRelation).filter(
                (LearnTopicCategoryRelation.child_category_id.in_(id_list))
                | (LearnTopicCategoryRelation.father_category_id.in_(id_list))
            ).delete(synchronize_session=False)
            db.query(LearnTopicTopicCategoryRelation).filter(
                LearnTopicTopicCategoryRelation.category_id.in_(id_list)
            ).delete(synchronize_session=False)
            return success({"success": len(id_list), "failed": 0})
        except Exception as e:
            logger.error(f"learn topic category batch delete error: {e}")
            return error(str(e))


@router.put("/topic-category/{cid}", summary="修改专题分类", dependencies=[Depends(admin_required)])
async def update_topic_category(
    cid: int,
    name: str | None = Body(None),
    image: str | None = Body(None),
    sort_order: int | None = Body(None),
    is_show: bool | None = Body(None),
    is_show_index: bool | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(LearnTopicCategory).filter(LearnTopicCategory.id == cid).first()
            if not c:
                return error("专题分类不存在", "404")
            if name is not None:
                c.name = name
            if image is not None:
                c.image = image
            if sort_order is not None:
                c.sort_order = sort_order
            if is_show is not None:
                c.is_show = is_show
            if is_show_index is not None:
                c.is_show_index = is_show_index
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"learn topic category update error: {e}")
            return error(str(e))


@router.delete("/topic-category/{cid}", summary="删除专题分类", dependencies=[Depends(admin_required)])
async def delete_topic_category(cid: int):
    with get_session() as db:
        try:
            c = db.query(LearnTopicCategory).filter(LearnTopicCategory.id == cid).first()
            if not c:
                return error("专题分类不存在", "404")
            db.delete(c)
            db.query(LearnTopicCategoryRelation).filter(
                (LearnTopicCategoryRelation.child_category_id == cid)
                | (LearnTopicCategoryRelation.father_category_id == cid)
            ).delete()
            db.query(LearnTopicTopicCategoryRelation).filter(
                LearnTopicTopicCategoryRelation.category_id == cid
            ).delete()
            return success()
        except Exception as e:
            logger.error(f"learn topic category delete error: {e}")
            return error(str(e))
