"""圈子社区 - 话题/动态管理 + 分类关系管理"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.circle_ext_models import (
    CircleCategoryRelation,
    CircleCircleCategoryRelation,
    CircleDynamic,
)
from app.schemas.common import error, success


class TopicCreateRequest(BaseModel):
    content: str = Field(..., min_length=1)


router = APIRouter()


def _d_to_dict(d: CircleDynamic) -> dict:
    return {
        "id": d.id,
        "content": d.content,
        "member_id": d.member_id,
        "image": d.image,
        "status": d.status,
        "circle_id": d.circle_id,
        "create_time": d.created_at.isoformat() if d.created_at else None,
    }


# ============ 话题/动态 ============


@router.get("/topic/list", summary="话题列表")
async def list_topics(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    circle_id: int | None = None,
    member_id: int | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CircleDynamic)
            if circle_id:
                q = q.filter(CircleDynamic.circle_id == circle_id)
            if member_id:
                q = q.filter(CircleDynamic.member_id == member_id)
            if status:
                q = q.filter(CircleDynamic.status == status)
            total = q.count()
            items = q.order_by(CircleDynamic.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_d_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"circle topic list error: {e}")
            return error(str(e))


@router.get("/topic/{tid}", summary="话题详情")
async def get_topic(tid: int):
    with get_session() as db:
        try:
            d = db.query(CircleDynamic).filter(CircleDynamic.id == tid).first()
            if not d:
                return error("话题不存在", "404")
            return success(_d_to_dict(d))
        except Exception as e:
            logger.error(f"circle topic get error: {e}")
            return error(str(e))


@router.post("/topic", summary="创建话题")
async def create_topic(
    circle_id: int = Query(...),
    payload: TopicCreateRequest = Depends(),
    image: str | None = None,
    status: str = "published",
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            d = CircleDynamic(
                circle_id=circle_id,
                member_id=member_id,
                content=payload.content,
                image=image,
                status=status,
            )
            db.add(d)
            db.flush()
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"circle topic create error: {e}")
            return error(str(e))


@router.put("/topic/{tid}", summary="修改话题")
async def update_topic(
    tid: int,
    content: str | None = None,
    image: str | None = None,
    status: str | None = None,
):
    with get_session() as db:
        try:
            d = db.query(CircleDynamic).filter(CircleDynamic.id == tid).first()
            if not d:
                return error("话题不存在", "404")
            if content is not None:
                d.content = content
            if image is not None:
                d.image = image
            if status is not None:
                d.status = status
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"circle topic update error: {e}")
            return error(str(e))


@router.delete("/topic/{tid}", summary="删除话题")
async def delete_topic(tid: int):
    with get_session() as db:
        try:
            d = db.query(CircleDynamic).filter(CircleDynamic.id == tid).first()
            if not d:
                return error("话题不存在", "404")
            db.delete(d)
            return success()
        except Exception as e:
            logger.error(f"circle topic delete error: {e}")
            return error(str(e))


# ============ 圈子分类关系 ============


@router.get("/category-relation/list", summary="圈子分类关系列表")
async def list_category_relations(
    father_category_id: int | None = None,
    child_category_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CircleCategoryRelation)
            if father_category_id:
                q = q.filter(CircleCategoryRelation.father_category_id == father_category_id)
            if child_category_id:
                q = q.filter(CircleCategoryRelation.child_category_id == child_category_id)
            items = q.all()
            return success(
                [
                    {
                        "id": r.id,
                        "child_category_id": r.child_category_id,
                        "father_category_id": r.father_category_id,
                        "direct_father_category_id": r.direct_father_category_id,
                        "is_sub": r.is_sub,
                    }
                    for r in items
                ],
                total=len(items),
            )
        except Exception as e:
            logger.error(f"circle category relation list error: {e}")
            return error(str(e))


@router.post("/category-relation", summary="创建圈子分类关系")
async def create_category_relation(
    child_category_id: int = Query(...),
    father_category_id: int = Query(...),
    direct_father_category_id: int = Query(...),
    is_sub: bool = Query(False),
):
    with get_session() as db:
        try:
            r = CircleCategoryRelation(
                child_category_id=child_category_id,
                father_category_id=father_category_id,
                direct_father_category_id=direct_father_category_id,
                is_sub=is_sub,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"circle category relation create error: {e}")
            return error(str(e))


@router.delete("/category-relation/{rid}", summary="删除圈子分类关系")
async def delete_category_relation(rid: int):
    with get_session() as db:
        try:
            r = db.query(CircleCategoryRelation).filter(CircleCategoryRelation.id == rid).first()
            if not r:
                return error("分类关系不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"circle category relation delete error: {e}")
            return error(str(e))


# ============ 圈子类目关系 ============


@router.get("/circle-category-relation/list", summary="圈子类目关系列表")
async def list_circle_category_relations(
    category_id: int | None = None,
    circle_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CircleCircleCategoryRelation)
            if category_id:
                q = q.filter(CircleCircleCategoryRelation.category_id == category_id)
            if circle_id:
                q = q.filter(CircleCircleCategoryRelation.circle_id == circle_id)
            items = q.all()
            return success(
                [
                    {
                        "id": r.id,
                        "category_id": r.category_id,
                        "circle_id": r.circle_id,
                    }
                    for r in items
                ],
                total=len(items),
            )
        except Exception as e:
            logger.error(f"circle circle category relation list error: {e}")
            return error(str(e))


@router.post("/circle-category-relation", summary="创建圈子类目关系")
async def create_circle_category_relation(
    category_id: int = Query(...),
    circle_id: int = Query(...),
):
    with get_session() as db:
        try:
            r = CircleCircleCategoryRelation(category_id=category_id, circle_id=circle_id)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"circle circle category relation create error: {e}")
            return error(str(e))


@router.delete("/circle-category-relation/{rid}", summary="删除圈子类目关系")
async def delete_circle_category_relation(rid: int):
    with get_session() as db:
        try:
            r = db.query(CircleCircleCategoryRelation).filter(CircleCircleCategoryRelation.id == rid).first()
            if not r:
                return error("类目关系不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"circle circle category relation delete error: {e}")
            return error(str(e))
