"""圈子模块路由 - 迁移自旧 Java Spring Boot circle-service (2026-07-05).

包含: 圈子分类CRUD/圈子CRUD/圈子动态CRUD.
动态支持点赞/评论计数, 圈子支持成员数/动态数统计.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduCircle,
    EduCircleCategory,
    EduCircleDynamic,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 圈子分类
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduCircleCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/category/admin/list", summary="圈子分类树", operation_id="edu_platform_circle_category_admin_list")
async def category_admin_list(
    id: int | None = Query(None, description="父分类id, 不传则返回全部"),
    fetchAll: bool | None = Query(None, description="是否获取全部(含禁用)"),
):
    with get_session() as db:
        try:
            q = db.query(EduCircleCategory)
            if id is not None:
                q = q.filter(EduCircleCategory.pid == id)
            if not fetchAll:
                q = q.filter(EduCircleCategory.status == 1)
            items = q.order_by(
                EduCircleCategory.sort.asc(), EduCircleCategory.id.asc()
            ).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu circle] category admin list error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="圈子分类详情", operation_id="edu_platform_circle_get_category_detail")
async def get_category_detail(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduCircleCategory).filter(
                EduCircleCategory.id == category_id
            ).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"[edu circle] get category detail error: {e}")
            return error(str(e))


@router.post("/category", summary="新建圈子分类", operation_id="edu_platform_circle_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduCircleCategory(name=name, pid=pid, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu circle] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新圈子分类", operation_id="edu_platform_circle_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduCircleCategory).filter(
                EduCircleCategory.id == id
            ).first()
            if not c:
                return error("分类不存在", "404")
            if name is not None:
                c.name = name
            if pid is not None:
                c.pid = pid
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu circle] update category error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除圈子分类", operation_id="edu_platform_circle_delete_category")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduCircleCategory).filter(
                EduCircleCategory.id == category_id
            ).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu circle] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 圈子
# ---------------------------------------------------------------------------


def _circle_to_dict(c: EduCircle) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "cover_image": c.cover_image,
        "description": c.description,
        "category_id": c.category_id,
        "member_count": c.member_count,
        "post_count": c.post_count,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/public-api/circle", summary="圈子详情(公开)", operation_id="edu_platform_circle_get_circle_public")
async def get_circle_public(id: int = Query(..., description="圈子id")):
    with get_session() as db:
        try:
            c = db.query(EduCircle).filter(EduCircle.id == id).first()
            if not c:
                return error("圈子不存在", "404")
            return success(_circle_to_dict(c))
        except Exception as e:
            logger.error(f"[edu circle] get circle public error: {e}")
            return error(str(e))


@router.post("/circle", summary="新建圈子", operation_id="edu_platform_circle_create_circle")
async def create_circle(
    name: str = Body(..., min_length=1, max_length=200),
    cover_image: str | None = Body(None, max_length=500),
    description: str | None = Body(None),
    category_id: int | None = Body(None),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduCircle(
                name=name,
                cover_image=cover_image,
                description=description,
                category_id=category_id,
                sort=sort,
                status=status,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu circle] create circle error: {e}")
            return error(str(e))


@router.put("/circle", summary="更新圈子", operation_id="edu_platform_circle_update_circle")
async def update_circle(
    id: int = Body(...),
    name: str | None = Body(None),
    cover_image: str | None = Body(None),
    description: str | None = Body(None),
    category_id: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduCircle).filter(EduCircle.id == id).first()
            if not c:
                return error("圈子不存在", "404")
            if name is not None:
                c.name = name
            if cover_image is not None:
                c.cover_image = cover_image
            if description is not None:
                c.description = description
            if category_id is not None:
                c.category_id = category_id
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu circle] update circle error: {e}")
            return error(str(e))


@router.delete("/auth-api/circle", summary="删除圈子", operation_id="edu_platform_circle_delete_circle")
async def delete_circle(id: int = Query(...)):
    with get_session() as db:
        try:
            c = db.query(EduCircle).filter(EduCircle.id == id).first()
            if not c:
                return error("圈子不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu circle] delete circle error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 圈子动态
# ---------------------------------------------------------------------------


def _dynamic_to_dict(d: EduCircleDynamic) -> dict:
    return {
        "id": d.id,
        "circle_id": d.circle_id,
        "category_id": d.category_id,
        "member_id": d.member_id,
        "member_name": d.member_name,
        "content": d.content,
        "images": d.images,
        "like_count": d.like_count,
        "comment_count": d.comment_count,
        "is_top": d.is_top,
        "status": d.status,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


@router.get("/dynamic/list", summary="动态列表", operation_id="edu_platform_circle_dynamic_list")
async def dynamic_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    circle_id: int | None = None,
    category_id: int | None = None,
    member_id: int | None = None,
    is_top: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduCircleDynamic)
            if circle_id:
                q = q.filter(EduCircleDynamic.circle_id == circle_id)
            if category_id:
                q = q.filter(EduCircleDynamic.category_id == category_id)
            if member_id:
                q = q.filter(EduCircleDynamic.member_id == member_id)
            if is_top is not None:
                q = q.filter(EduCircleDynamic.is_top == is_top)
            if status is not None:
                q = q.filter(EduCircleDynamic.status == status)
            total = q.count()
            items = (
                q.order_by(
                    EduCircleDynamic.is_top.desc(), EduCircleDynamic.id.desc()
                )
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_dynamic_to_dict(d) for d in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu circle] dynamic list error: {e}")
            return error(str(e))


@router.get("/public-api/dynamic", summary="动态详情(公开)", operation_id="edu_platform_circle_get_dynamic_public")
async def get_dynamic_public(id: int = Query(..., description="动态id")):
    with get_session() as db:
        try:
            d = db.query(EduCircleDynamic).filter(EduCircleDynamic.id == id).first()
            if not d:
                return error("动态不存在", "404")
            return success(_dynamic_to_dict(d))
        except Exception as e:
            logger.error(f"[edu circle] get dynamic public error: {e}")
            return error(str(e))


@router.post("/dynamic", summary="新建动态", operation_id="edu_platform_circle_create_dynamic")
async def create_dynamic(
    circle_id: int | None = Body(None),
    category_id: int | None = Body(None),
    member_id: int = Body(...),
    member_name: str | None = Body(None, max_length=100),
    content: str = Body(..., min_length=1),
    images: str | None = Body(None, description="图片JSON"),
    is_top: bool = Body(False),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            d = EduCircleDynamic(
                circle_id=circle_id,
                category_id=category_id,
                member_id=member_id,
                member_name=member_name,
                content=content,
                images=images,
                is_top=is_top,
                status=status,
            )
            db.add(d)
            db.flush()
            # 更新圈子动态数
            if circle_id:
                circle = db.query(EduCircle).filter(EduCircle.id == circle_id).first()
                if circle:
                    circle.post_count = (circle.post_count or 0) + 1
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"[edu circle] create dynamic error: {e}")
            return error(str(e))


@router.put("/dynamic", summary="更新动态", operation_id="edu_platform_circle_update_dynamic")
async def update_dynamic(
    id: int = Body(...),
    circle_id: int | None = Body(None),
    category_id: int | None = Body(None),
    member_name: str | None = Body(None),
    content: str | None = Body(None),
    images: str | None = Body(None),
    is_top: bool | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            d = db.query(EduCircleDynamic).filter(EduCircleDynamic.id == id).first()
            if not d:
                return error("动态不存在", "404")
            if circle_id is not None:
                d.circle_id = circle_id
            if category_id is not None:
                d.category_id = category_id
            if member_name is not None:
                d.member_name = member_name
            if content is not None:
                d.content = content
            if images is not None:
                d.images = images
            if is_top is not None:
                d.is_top = is_top
            if status is not None:
                d.status = status
            return success({"id": d.id})
        except Exception as e:
            logger.error(f"[edu circle] update dynamic error: {e}")
            return error(str(e))


@router.delete("/dynamic", summary="删除动态", operation_id="edu_platform_circle_delete_dynamic")
async def delete_dynamic(id: int = Query(...)):
    with get_session() as db:
        try:
            d = db.query(EduCircleDynamic).filter(EduCircleDynamic.id == id).first()
            if not d:
                return error("动态不存在", "404")
            # 递减圈子动态数
            if d.circle_id:
                circle = db.query(EduCircle).filter(EduCircle.id == d.circle_id).first()
                if circle and circle.post_count:
                    circle.post_count = max(0, circle.post_count - 1)
            db.delete(d)
            return success()
        except Exception as e:
            logger.error(f"[edu circle] delete dynamic error: {e}")
            return error(str(e))


@router.get("/public-api/dynamic/list/by-ids", summary="批量获取动态", operation_id="edu_platform_circle_dynamic_list_by_ids")
async def dynamic_list_by_ids(
    ids: str = Query(..., description="动态id列表, 逗号分隔"),
):
    with get_session() as db:
        try:
            id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
            items = (
                db.query(EduCircleDynamic)
                .filter(EduCircleDynamic.id.in_(id_list))
                .order_by(EduCircleDynamic.id.desc())
                .all()
            )
            return success([_dynamic_to_dict(d) for d in items])
        except Exception as e:
            logger.error(f"[edu circle] dynamic list by ids error: {e}")
            return error(str(e))
