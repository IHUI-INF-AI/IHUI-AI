"""分类管理 API (迁移自 ihui-ai-edu-learn-service 分类模块)

包含课程分类 (Category) 与专题分类 (TopicCategory) 两套体系,
以及各自的分类关系表 (CategoryRelation / TopicCategoryRelation)。
课程分类: 8 个端点; 专题分类: 4 个端点。
"""
from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.learn_models import (
    Category,
    CategoryRelation,
    TopicCategory,
    TopicCategoryRelation,
)
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


def _cat_to_dict(item: Category) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "sort_order": item.sort_order,
        "is_show": item.is_show,
        "is_show_index": item.is_show_index,
        "image": item.image,
        "level": item.level,
        "create_user_id": item.create_user_id,
        "company_id": item.company_id,
        "department_id": item.department_id,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


def _tcat_to_dict(item: TopicCategory) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "sort_order": item.sort_order,
        "is_show": item.is_show,
        "is_show_index": item.is_show_index,
        "image": item.image,
        "level": item.level,
        "create_user_id": item.create_user_id,
        "company_id": item.company_id,
        "department_id": item.department_id,
        "create_time": _iso(item.created_at),
        "update_time": _iso(item.updated_at),
    }


# ---------------------------------------------------------------------------
# 请求体
# ---------------------------------------------------------------------------


class CategoryCreate(BaseModel):
    name: str
    sort_order: int = 0
    is_show: int = 1
    is_show_index: int = 0
    image: str | None = None
    level: int = 1
    company_id: int | None = None
    department_id: int | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    sort_order: int | None = None
    is_show: int | None = None
    is_show_index: int | None = None
    image: str | None = None
    level: int | None = None
    company_id: int | None = None
    department_id: int | None = None


class CategoryRelationCreate(BaseModel):
    child_category_id: int
    father_category_id: int
    direct_father_category_id: int | None = None
    is_sub: int = 0


# ===========================================================================
# 课程分类
# ===========================================================================


@router.get("/list", summary="课程分类列表")
async def list_categories(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_show: int | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(Category)
            if is_show is not None:
                q = q.filter(Category.is_show == is_show)
            if keyword:
                q = q.filter(Category.name.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(Category.sort_order.asc(), Category.id.asc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_cat_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception("list_categories error")
            return error(str(e))


@router.get("/tree", summary="课程分类树")
async def category_tree():
    with get_session() as db:
        try:
            cats = (
                db.query(Category)
                .order_by(Category.sort_order.asc(), Category.id.asc())
                .all()
            )
            relations = db.query(CategoryRelation).all()
            cat_map = {c.id: _cat_to_dict(c) for c in cats}
            for c in cat_map.values():
                c["children"] = []
            child_ids = set()
            parent_of: dict[int, list[int]] = {}
            for r in relations:
                parent_of.setdefault(r.father_category_id, []).append(
                    r.child_category_id
                )
                child_ids.add(r.child_category_id)
            for parent_id, child_list in parent_of.items():
                parent = cat_map.get(parent_id)
                if parent:
                    for cid in child_list:
                        child = cat_map.get(cid)
                        if child:
                            parent["children"].append(child)
            roots = [cat_map[c.id] for c in cats if c.id not in child_ids]
            return success(roots)
        except Exception as e:
            logger.exception("category_tree error")
            return error(str(e))


@router.post("", summary="创建课程分类")
async def create_category(body: CategoryCreate):
    with get_session() as db:
        try:
            item = Category(
                name=body.name,
                sort_order=body.sort_order,
                is_show=body.is_show,
                is_show_index=body.is_show_index,
                image=body.image,
                level=body.level,
                create_user_id=_uid_int(),
                company_id=body.company_id,
                department_id=body.department_id,
            )
            db.add(item)
            db.flush()
            return success(_cat_to_dict(item))
        except Exception as e:
            logger.exception("create_category error")
            return error(str(e))


@router.put("/{category_id}", summary="更新课程分类")
async def update_category(category_id: int, body: CategoryUpdate):
    with get_session() as db:
        try:
            item = db.query(Category).filter(Category.id == category_id).first()
            if not item:
                return error("分类不存在")
            if body.name is not None:
                item.name = body.name
            if body.sort_order is not None:
                item.sort_order = body.sort_order
            if body.is_show is not None:
                item.is_show = body.is_show
            if body.is_show_index is not None:
                item.is_show_index = body.is_show_index
            if body.image is not None:
                item.image = body.image
            if body.level is not None:
                item.level = body.level
            if body.company_id is not None:
                item.company_id = body.company_id
            if body.department_id is not None:
                item.department_id = body.department_id
            db.flush()
            return success(_cat_to_dict(item))
        except Exception as e:
            logger.exception("update_category error")
            return error(str(e))


@router.delete("/{category_id}", summary="删除课程分类")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            item = db.query(Category).filter(Category.id == category_id).first()
            if not item:
                return error("分类不存在")
            has_child = (
                db.query(CategoryRelation)
                .filter(CategoryRelation.father_category_id == category_id)
                .count()
                > 0
            )
            if has_child:
                return error("存在子分类, 无法删除")
            db.query(CategoryRelation).filter(
                CategoryRelation.child_category_id == category_id
            ).delete()
            db.delete(item)
            db.flush()
            return success({"id": category_id})
        except Exception as e:
            logger.exception("delete_category error")
            return error(str(e))


@router.put("/{category_id}/show", summary="显示课程分类")
async def show_category(category_id: int):
    with get_session() as db:
        try:
            item = db.query(Category).filter(Category.id == category_id).first()
            if not item:
                return error("分类不存在")
            item.is_show = 1
            db.flush()
            return success(_cat_to_dict(item))
        except Exception as e:
            logger.exception("show_category error")
            return error(str(e))


@router.put("/{category_id}/hide", summary="隐藏课程分类")
async def hide_category(category_id: int):
    with get_session() as db:
        try:
            item = db.query(Category).filter(Category.id == category_id).first()
            if not item:
                return error("分类不存在")
            item.is_show = 0
            db.flush()
            return success(_cat_to_dict(item))
        except Exception as e:
            logger.exception("hide_category error")
            return error(str(e))


@router.post("/relation", summary="设置课程分类关系")
async def set_category_relation(body: CategoryRelationCreate):
    with get_session() as db:
        try:
            exists = (
                db.query(CategoryRelation)
                .filter(
                    CategoryRelation.child_category_id == body.child_category_id,
                    CategoryRelation.father_category_id == body.father_category_id,
                )
                .first()
            )
            if exists:
                if body.direct_father_category_id is not None:
                    exists.direct_father_category_id = body.direct_father_category_id
                exists.is_sub = body.is_sub
                db.flush()
                return success(
                    {
                        "id": exists.id,
                        "child_category_id": exists.child_category_id,
                        "father_category_id": exists.father_category_id,
                        "direct_father_category_id": exists.direct_father_category_id,
                        "is_sub": exists.is_sub,
                    }
                )
            item = CategoryRelation(
                child_category_id=body.child_category_id,
                father_category_id=body.father_category_id,
                direct_father_category_id=body.direct_father_category_id,
                is_sub=body.is_sub,
            )
            db.add(item)
            db.flush()
            return success(
                {
                    "id": item.id,
                    "child_category_id": item.child_category_id,
                    "father_category_id": item.father_category_id,
                    "direct_father_category_id": item.direct_father_category_id,
                    "is_sub": item.is_sub,
                }
            )
        except Exception as e:
            logger.exception("set_category_relation error")
            return error(str(e))


# ===========================================================================
# 专题分类
# ===========================================================================


@router.get("/topic/list", summary="专题分类列表")
async def list_topic_categories(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_show: int | None = None,
    keyword: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(TopicCategory)
            if is_show is not None:
                q = q.filter(TopicCategory.is_show == is_show)
            if keyword:
                q = q.filter(TopicCategory.name.like(f"%{keyword}%"))
            total = q.count()
            items = (
                q.order_by(TopicCategory.sort_order.asc(), TopicCategory.id.asc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result(
                [_tcat_to_dict(i) for i in items], total, page, limit
            )
        except Exception as e:
            logger.exception("list_topic_categories error")
            return error(str(e))


@router.post("/topic", summary="创建专题分类")
async def create_topic_category(body: CategoryCreate):
    with get_session() as db:
        try:
            item = TopicCategory(
                name=body.name,
                sort_order=body.sort_order,
                is_show=body.is_show,
                is_show_index=body.is_show_index,
                image=body.image,
                level=body.level,
                create_user_id=_uid_int(),
                company_id=body.company_id,
                department_id=body.department_id,
            )
            db.add(item)
            db.flush()
            return success(_tcat_to_dict(item))
        except Exception as e:
            logger.exception("create_topic_category error")
            return error(str(e))


@router.put("/topic/{category_id}", summary="更新专题分类")
async def update_topic_category(category_id: int, body: CategoryUpdate):
    with get_session() as db:
        try:
            item = (
                db.query(TopicCategory)
                .filter(TopicCategory.id == category_id)
                .first()
            )
            if not item:
                return error("专题分类不存在")
            if body.name is not None:
                item.name = body.name
            if body.sort_order is not None:
                item.sort_order = body.sort_order
            if body.is_show is not None:
                item.is_show = body.is_show
            if body.is_show_index is not None:
                item.is_show_index = body.is_show_index
            if body.image is not None:
                item.image = body.image
            if body.level is not None:
                item.level = body.level
            if body.company_id is not None:
                item.company_id = body.company_id
            if body.department_id is not None:
                item.department_id = body.department_id
            db.flush()
            return success(_tcat_to_dict(item))
        except Exception as e:
            logger.exception("update_topic_category error")
            return error(str(e))


@router.delete("/topic/{category_id}", summary="删除专题分类")
async def delete_topic_category(category_id: int):
    with get_session() as db:
        try:
            item = (
                db.query(TopicCategory)
                .filter(TopicCategory.id == category_id)
                .first()
            )
            if not item:
                return error("专题分类不存在")
            has_child = (
                db.query(TopicCategoryRelation)
                .filter(TopicCategoryRelation.father_category_id == category_id)
                .count()
                > 0
            )
            if has_child:
                return error("存在子分类, 无法删除")
            db.query(TopicCategoryRelation).filter(
                TopicCategoryRelation.child_category_id == category_id
            ).delete()
            db.delete(item)
            db.flush()
            return success({"id": category_id})
        except Exception as e:
            logger.exception("delete_topic_category error")
            return error(str(e))
