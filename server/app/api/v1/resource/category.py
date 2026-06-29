"""资源体系 - 资源分类 CRUD + 资源 CRUD + 分类关系管理"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel, Field

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.resource_ext_models import (
    ResourceCategory,
    ResourceCategoryRelation,
    ResourceResource,
    ResourceResourceCategoryRelation,
)
from app.schemas.common import error, success


class ResourceCreateRequest(BaseModel):
    introduction: str = Field(..., min_length=1)


router = APIRouter()


def _cat_to_dict(c: ResourceCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "sort_order": c.sort_order,
        "is_show": c.is_show,
        "is_show_index": c.is_show_index,
        "level": c.level,
        "image": c.image,
        "create_time": c.created_at.isoformat() if c.created_at else None,
    }


def _r_to_dict(r: ResourceResource) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "member_id": r.member_id,
        "introduction": r.introduction,
        "image": r.image,
        "url": r.url,
        "status": r.status,
        "type": r.type,
        "create_time": r.created_at.isoformat() if r.created_at else None,
    }


# ============ 资源分类 ============


@router.get("/category/list", summary="资源分类列表")
async def list_categories(
    level: int | None = None,
    is_show: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ResourceCategory)
            if level is not None:
                q = q.filter(ResourceCategory.level == level)
            if is_show is not None:
                q = q.filter(ResourceCategory.is_show == is_show)
            items = q.order_by(ResourceCategory.sort_order.asc()).all()
            return success([_cat_to_dict(c) for c in items], total=len(items))
        except Exception as e:
            logger.error(f"resource category list error: {e}")
            return error(str(e))


@router.get("/category/{cid}", summary="资源分类详情")
async def get_category(cid: int):
    with get_session() as db:
        try:
            c = db.query(ResourceCategory).filter(ResourceCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.error(f"resource category get error: {e}")
            return error(str(e))


@router.post("/category", summary="创建资源分类")
async def create_category(
    name: str = Query(..., min_length=1, max_length=50),
    level: int = Query(...),
    image: str = Query(..., max_length=500),
    sort_order: int = 1,
    is_show: bool = True,
    is_show_index: bool = True,
):
    with get_session() as db:
        try:
            c = ResourceCategory(
                name=name,
                level=level,
                image=image,
                sort_order=sort_order,
                is_show=is_show,
                is_show_index=is_show_index,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"resource category create error: {e}")
            return error(str(e))


@router.put("/category/{cid}", summary="修改资源分类")
async def update_category(
    cid: int,
    name: str | None = None,
    image: str | None = None,
    sort_order: int | None = None,
    is_show: bool | None = None,
    is_show_index: bool | None = None,
    level: int | None = None,
):
    with get_session() as db:
        try:
            c = db.query(ResourceCategory).filter(ResourceCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
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
            if level is not None:
                c.level = level
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"resource category update error: {e}")
            return error(str(e))


@router.delete("/category/{cid}", summary="删除资源分类")
async def delete_category(cid: int):
    with get_session() as db:
        try:
            c = db.query(ResourceCategory).filter(ResourceCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            db.query(ResourceCategoryRelation).filter(
                ResourceCategoryRelation.child_category_id == cid
            ).delete()
            db.query(ResourceResourceCategoryRelation).filter(
                ResourceResourceCategoryRelation.category_id == cid
            ).delete()
            return success()
        except Exception as e:
            logger.error(f"resource category delete error: {e}")
            return error(str(e))


# ============ 资源分类关系 ============


@router.get("/category-relation/list", summary="资源分类关系列表")
async def list_category_relations(
    father_category_id: int | None = None,
    child_category_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ResourceCategoryRelation)
            if father_category_id:
                q = q.filter(ResourceCategoryRelation.father_category_id == father_category_id)
            if child_category_id:
                q = q.filter(ResourceCategoryRelation.child_category_id == child_category_id)
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
            logger.error(f"resource category relation list error: {e}")
            return error(str(e))


@router.post("/category-relation", summary="创建资源分类关系")
async def create_category_relation(
    child_category_id: int = Query(...),
    father_category_id: int = Query(...),
    direct_father_category_id: int = Query(...),
    is_sub: bool = Query(False),
):
    with get_session() as db:
        try:
            r = ResourceCategoryRelation(
                child_category_id=child_category_id,
                father_category_id=father_category_id,
                direct_father_category_id=direct_father_category_id,
                is_sub=is_sub,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"resource category relation create error: {e}")
            return error(str(e))


@router.delete("/category-relation/{rid}", summary="删除资源分类关系")
async def delete_category_relation(rid: int):
    with get_session() as db:
        try:
            r = db.query(ResourceCategoryRelation).filter(ResourceCategoryRelation.id == rid).first()
            if not r:
                return error("分类关系不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"resource category relation delete error: {e}")
            return error(str(e))


# ============ 资源 ============


@router.get("/resource/list", summary="资源列表")
async def list_resources(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    type: str | None = None,
    status: str | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ResourceResource)
            if member_id:
                q = q.filter(ResourceResource.member_id == member_id)
            if type:
                q = q.filter(ResourceResource.type == type)
            if status:
                q = q.filter(ResourceResource.status == status)
            if keyword:
                q = q.filter(ResourceResource.title.like(f"%{keyword}%"))
            total = q.count()
            items = q.order_by(ResourceResource.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_r_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"resource resource list error: {e}")
            return error(str(e))


@router.get("/resource/{rid}", summary="资源详情")
async def get_resource(rid: int):
    with get_session() as db:
        try:
            r = db.query(ResourceResource).filter(ResourceResource.id == rid).first()
            if not r:
                return error("资源不存在", "404")
            return success(_r_to_dict(r))
        except Exception as e:
            logger.error(f"resource resource get error: {e}")
            return error(str(e))


@router.post("/resource", summary="创建资源")
async def create_resource(
    title: str = Query(..., min_length=1, max_length=100),
    payload: ResourceCreateRequest = Depends(),
    status: str = Query(...),
    type: str = Query(...),
    image: str | None = None,
    url: str | None = None,
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            r = ResourceResource(
                title=title,
                member_id=member_id,
                introduction=payload.introduction,
                image=image,
                url=url,
                status=status,
                type=type,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"resource resource create error: {e}")
            return error(str(e))


@router.put("/resource/{rid}", summary="修改资源")
async def update_resource(
    rid: int,
    title: str | None = None,
    introduction: str | None = None,
    image: str | None = None,
    url: str | None = None,
    status: str | None = None,
    type: str | None = None,
):
    with get_session() as db:
        try:
            r = db.query(ResourceResource).filter(ResourceResource.id == rid).first()
            if not r:
                return error("资源不存在", "404")
            if title is not None:
                r.title = title
            if introduction is not None:
                r.introduction = introduction
            if image is not None:
                r.image = image
            if url is not None:
                r.url = url
            if status is not None:
                r.status = status
            if type is not None:
                r.type = type
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"resource resource update error: {e}")
            return error(str(e))


@router.delete("/resource/{rid}", summary="删除资源")
async def delete_resource(rid: int):
    with get_session() as db:
        try:
            r = db.query(ResourceResource).filter(ResourceResource.id == rid).first()
            if not r:
                return error("资源不存在", "404")
            db.delete(r)
            db.query(ResourceResourceCategoryRelation).filter(
                ResourceResourceCategoryRelation.resource_id == rid
            ).delete()
            return success()
        except Exception as e:
            logger.error(f"resource resource delete error: {e}")
            return error(str(e))


# ============ 资源类目关系 ============


@router.get("/resource-category-relation/list", summary="资源类目关系列表")
async def list_resource_category_relations(
    category_id: int | None = None,
    resource_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(ResourceResourceCategoryRelation)
            if category_id:
                q = q.filter(ResourceResourceCategoryRelation.category_id == category_id)
            if resource_id:
                q = q.filter(ResourceResourceCategoryRelation.resource_id == resource_id)
            items = q.all()
            return success(
                [
                    {
                        "id": r.id,
                        "category_id": r.category_id,
                        "resource_id": r.resource_id,
                    }
                    for r in items
                ],
                total=len(items),
            )
        except Exception as e:
            logger.error(f"resource resource category relation list error: {e}")
            return error(str(e))


@router.post("/resource-category-relation", summary="创建资源类目关系")
async def create_resource_category_relation(
    category_id: int = Query(...),
    resource_id: int = Query(...),
):
    with get_session() as db:
        try:
            r = ResourceResourceCategoryRelation(category_id=category_id, resource_id=resource_id)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"resource resource category relation create error: {e}")
            return error(str(e))


@router.delete("/resource-category-relation/{rid}", summary="删除资源类目关系")
async def delete_resource_category_relation(rid: int):
    with get_session() as db:
        try:
            r = db.query(ResourceResourceCategoryRelation).filter(
                ResourceResourceCategoryRelation.id == rid
            ).first()
            if not r:
                return error("类目关系不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"resource resource category relation delete error: {e}")
            return error(str(e))
