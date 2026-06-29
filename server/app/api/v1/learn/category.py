"""学习模块 - 课程分类管理"""
from fastapi import APIRouter, Body, Depends, Path, Query
from loguru import logger

from app.core.admin_auth import admin_required
from app.database import get_session
from app.models.learn_models import (
    LearnCategory,
    LearnCategoryRelation,
    LearnLessonCategoryRelation,
)
from app.schemas.common import error, success

router = APIRouter()


@router.get("/category/list", summary="课程分类列表(树形)")
async def list_categories(level: int | None = None, is_show: bool | None = None):
    with get_session() as db:
        try:
            q = db.query(LearnCategory)
            if level is not None:
                q = q.filter(LearnCategory.level == level)
            if is_show is not None:
                q = q.filter(LearnCategory.is_show == is_show)
            items = q.order_by(LearnCategory.sort_order.asc(), LearnCategory.id.asc()).all()
            return success(
                [
                    {
                        "id": c.id,
                        "name": c.name,
                        "sort_order": c.sort_order,
                        "is_show": c.is_show,
                        "is_show_index": c.is_show_index,
                        "level": c.level,
                        "image": c.image,
                        "company_id": c.company_id,
                        "department_id": c.department_id,
                        "create_user_id": c.create_user_id,
                        "created_at": c.created_at.isoformat() if c.created_at else None,
                    }
                    for c in items
                ],
                total=len(items),
            )
        except Exception as e:
            logger.error(f"learn category list error: {e}")
            return error(str(e))


@router.get("/category/tree", summary="课程分类树(含父子关系)")
async def category_tree():
    with get_session() as db:
        try:
            rels = db.query(LearnCategoryRelation).all()
            cats = db.query(LearnCategory).filter(LearnCategory.is_show).order_by(LearnCategory.sort_order.asc()).all()
            cat_map = {c.id: {"id": c.id, "name": c.name, "level": c.level, "image": c.image, "children": []} for c in cats}
            for r in rels:
                if r.father_category_id in cat_map and r.child_category_id in cat_map:
                    cat_map[r.father_category_id]["children"].append(cat_map[r.child_category_id])
            roots = [v for v in cat_map.values() if not any(rel.child_category_id == v["id"] and rel.father_category_id != v["id"] for rel in rels)]
            return success(roots)
        except Exception as e:
            logger.error(f"learn category tree error: {e}")
            return error(str(e))


@router.post("/category", summary="创建课程分类", dependencies=[Depends(admin_required)])
async def create_category(
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
            c = LearnCategory(
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
            logger.error(f"learn category create error: {e}")
            return error(str(e))


@router.put("/category/{cid}", summary="修改课程分类", dependencies=[Depends(admin_required)])
async def update_category(
    cid: int,
    name: str | None = Body(None),
    image: str | None = Body(None),
    sort_order: int | None = Body(None),
    is_show: bool | None = Body(None),
    is_show_index: bool | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(LearnCategory).filter(LearnCategory.id == cid).first()
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
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"learn category update error: {e}")
            return error(str(e))


@router.delete("/category/{cid}", summary="删除课程分类", dependencies=[Depends(admin_required)])
async def delete_category(cid: int):
    with get_session() as db:
        try:
            c = db.query(LearnCategory).filter(LearnCategory.id == cid).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            db.query(LearnCategoryRelation).filter(
                (LearnCategoryRelation.child_category_id == cid)
                | (LearnCategoryRelation.father_category_id == cid)
            ).delete()
            db.query(LearnLessonCategoryRelation).filter(LearnLessonCategoryRelation.category_id == cid).delete()
            return success()
        except Exception as e:
            logger.error(f"learn category delete error: {e}")
            return error(str(e))


@router.post("/category/batch-delete", summary="批量删除课程分类", dependencies=[Depends(admin_required)])
async def batch_delete_categories(ids: list[int] = Body(..., embed=True)):
    with get_session() as db:
        try:
            if not ids:
                return error("ids 不能为空", "400")
            id_list = [int(i) for i in ids if i is not None]
            db.query(LearnCategory).filter(LearnCategory.id.in_(id_list)).delete(synchronize_session=False)
            db.query(LearnCategoryRelation).filter(
                (LearnCategoryRelation.child_category_id.in_(id_list))
                | (LearnCategoryRelation.father_category_id.in_(id_list))
            ).delete(synchronize_session=False)
            db.query(LearnLessonCategoryRelation).filter(
                LearnLessonCategoryRelation.category_id.in_(id_list)
            ).delete(synchronize_session=False)
            return success({"success": len(id_list), "failed": 0})
        except Exception as e:
            logger.error(f"learn category batch delete error: {e}")
            return error(str(e))


@router.post("/category/relation", summary="建立分类父子关系", dependencies=[Depends(admin_required)])
async def create_category_relation(
    child_category_id: int = Query(...),
    father_category_id: int = Query(...),
    direct_father_category_id: int | None = None,
    is_sub: bool = False,
):
    with get_session() as db:
        try:
            r = LearnCategoryRelation(
                child_category_id=child_category_id,
                father_category_id=father_category_id,
                direct_father_category_id=direct_father_category_id or father_category_id,
                is_sub=is_sub,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn category relation create error: {e}")
            return error(str(e))


@router.post("/lesson/{lesson_id}/bind-category", summary="课程绑定分类", dependencies=[Depends(admin_required)])
async def bind_lesson_category(lesson_id: int = Path(...), category_id: int = Query(...)):
    with get_session() as db:
        try:
            existing = (
                db.query(LearnLessonCategoryRelation)
                .filter(
                    LearnLessonCategoryRelation.lesson_id == lesson_id,
                    LearnLessonCategoryRelation.category_id == category_id,
                )
                .first()
            )
            if existing:
                return success({"id": existing.id, "exists": True})
            r = LearnLessonCategoryRelation(lesson_id=lesson_id, category_id=category_id)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn lesson bind category error: {e}")
            return error(str(e))
