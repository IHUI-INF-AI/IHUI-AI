"""资源模块路由 - 迁移自旧 Java Spring Boot resource-service (2026-07-05).

包含: 资源分类CRUD/资源CRUD/资源标签CRUD/资源产品CRUD.
资源支持发布/浏览量/下载量统计, 产品支持价格与上下架.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduResource,
    EduResourceCategory,
    EduResourceProduct,
    EduResourceTag,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 资源分类
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduResourceCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "pid": c.pid,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/category/admin/list", summary="资源分类树", operation_id="edu_platform_resource_category_admin_list")
async def category_admin_list(
    id: int | None = Query(None, description="父分类id, 不传则返回全部"),
    fetchAll: bool | None = Query(None, description="是否获取全部(含禁用)"),
):
    with get_session() as db:
        try:
            q = db.query(EduResourceCategory)
            if id is not None:
                q = q.filter(EduResourceCategory.pid == id)
            if not fetchAll:
                q = q.filter(EduResourceCategory.status == 1)
            items = q.order_by(
                EduResourceCategory.sort.asc(), EduResourceCategory.id.asc()
            ).all()
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu resource] category admin list error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="资源分类详情", operation_id="edu_platform_resource_get_category_detail")
async def get_category_detail(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduResourceCategory).filter(
                EduResourceCategory.id == category_id
            ).first()
            if not c:
                return error("分类不存在", "404")
            return success(_category_to_dict(c))
        except Exception as e:
            logger.error(f"[edu resource] get category detail error: {e}")
            return error(str(e))


@router.post("/category", summary="新建资源分类", operation_id="edu_platform_resource_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    pid: int = Body(0),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduResourceCategory(name=name, pid=pid, sort=sort, status=status)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu resource] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新资源分类", operation_id="edu_platform_resource_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    pid: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduResourceCategory).filter(
                EduResourceCategory.id == id
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
            logger.error(f"[edu resource] update category error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除资源分类", operation_id="edu_platform_resource_delete_category")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(EduResourceCategory).filter(
                EduResourceCategory.id == category_id
            ).first()
            if not c:
                return error("分类不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu resource] delete category error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 资源
# ---------------------------------------------------------------------------


def _resource_to_dict(r: EduResource, with_intro: bool = True) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "cover_image": r.cover_image,
        "intro": r.intro if with_intro else None,
        "category_id": r.category_id,
        "file_url": r.file_url,
        "file_type": r.file_type,
        "file_size": r.file_size,
        "is_published": r.is_published,
        "view_count": r.view_count,
        "download_count": r.download_count,
        "sort": r.sort,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


@router.get("/resource/list", summary="资源列表", operation_id="edu_platform_resource_resource_list")
async def resource_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    title: str | None = None,
    category_id: int | None = None,
    is_published: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduResource)
            if title:
                q = q.filter(EduResource.title.like(f"%{title}%"))
            if category_id:
                q = q.filter(EduResource.category_id == category_id)
            if is_published is not None:
                q = q.filter(EduResource.is_published == is_published)
            if status is not None:
                q = q.filter(EduResource.status == status)
            total = q.count()
            items = (
                q.order_by(EduResource.sort.desc(), EduResource.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_resource_to_dict(r, with_intro=False) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu resource] list error: {e}")
            return error(str(e))


@router.get("/public-api/resource", summary="资源详情(公开)", operation_id="edu_platform_resource_get_resource_public")
async def get_resource_public(id: int = Query(..., description="资源id")):
    with get_session() as db:
        try:
            r = db.query(EduResource).filter(EduResource.id == id).first()
            if not r:
                return error("资源不存在", "404")
            r.view_count = (r.view_count or 0) + 1
            db.flush()
            return success(_resource_to_dict(r, with_intro=True))
        except Exception as e:
            logger.error(f"[edu resource] get public error: {e}")
            return error(str(e))


@router.post("/resource", summary="新建资源", operation_id="edu_platform_resource_create_resource")
async def create_resource(
    title: str = Body(..., min_length=1, max_length=200),
    cover_image: str | None = Body(None, max_length=500),
    intro: str | None = Body(None),
    category_id: int | None = Body(None),
    file_url: str | None = Body(None, max_length=500),
    file_type: str | None = Body(None, max_length=50),
    file_size: int = Body(0),
    is_published: bool = Body(False),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            r = EduResource(
                title=title,
                cover_image=cover_image,
                intro=intro,
                category_id=category_id,
                file_url=file_url,
                file_type=file_type,
                file_size=file_size,
                is_published=is_published,
                sort=sort,
                status=status,
            )
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu resource] create error: {e}")
            return error(str(e))


@router.put("/resource", summary="更新资源", operation_id="edu_platform_resource_update_resource")
async def update_resource(
    id: int = Body(...),
    title: str | None = Body(None),
    cover_image: str | None = Body(None),
    intro: str | None = Body(None),
    category_id: int | None = Body(None),
    file_url: str | None = Body(None),
    file_type: str | None = Body(None),
    file_size: int | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            r = db.query(EduResource).filter(EduResource.id == id).first()
            if not r:
                return error("资源不存在", "404")
            if title is not None:
                r.title = title
            if cover_image is not None:
                r.cover_image = cover_image
            if intro is not None:
                r.intro = intro
            if category_id is not None:
                r.category_id = category_id
            if file_url is not None:
                r.file_url = file_url
            if file_type is not None:
                r.file_type = file_type
            if file_size is not None:
                r.file_size = file_size
            if sort is not None:
                r.sort = sort
            if status is not None:
                r.status = status
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"[edu resource] update error: {e}")
            return error(str(e))


@router.delete("/auth-api/resource", summary="删除资源", operation_id="edu_platform_resource_delete_resource")
async def delete_resource(id: int = Query(...)):
    with get_session() as db:
        try:
            r = db.query(EduResource).filter(EduResource.id == id).first()
            if not r:
                return error("资源不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"[edu resource] delete error: {e}")
            return error(str(e))


@router.put("/public-api/resource/published", summary="发布/取消发布资源", operation_id="edu_platform_resource_publish_resource")
async def publish_resource(
    id: int = Body(..., embed=True),
    isPublished: bool = Body(..., embed=True),
):
    with get_session() as db:
        try:
            r = db.query(EduResource).filter(EduResource.id == id).first()
            if not r:
                return error("资源不存在", "404")
            r.is_published = isPublished
            return success({"id": r.id, "is_published": r.is_published})
        except Exception as e:
            logger.error(f"[edu resource] publish error: {e}")
            return error(str(e))


@router.get("/public-api/resource/list/by-ids", summary="批量获取资源", operation_id="edu_platform_resource_resource_list_by_ids")
async def resource_list_by_ids(
    ids: str = Query(..., description="资源id列表, 逗号分隔"),
):
    with get_session() as db:
        try:
            id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
            items = (
                db.query(EduResource)
                .filter(EduResource.id.in_(id_list))
                .order_by(EduResource.id.desc())
                .all()
            )
            return success([_resource_to_dict(r, with_intro=False) for r in items])
        except Exception as e:
            logger.error(f"[edu resource] list by ids error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 资源产品
# ---------------------------------------------------------------------------


def _product_to_dict(p: EduResourceProduct) -> dict:
    return {
        "id": p.id,
        "resource_id": p.resource_id,
        "name": p.name,
        "price": p.price,
        "original_price": p.original_price,
        "description": p.description,
        "is_published": p.is_published,
        "sort": p.sort,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("/resource/product/list", summary="资源产品列表", operation_id="edu_platform_resource_product_list")
async def product_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    resource_id: int | None = None,
    name: str | None = None,
    is_published: bool | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduResourceProduct)
            if resource_id:
                q = q.filter(EduResourceProduct.resource_id == resource_id)
            if name:
                q = q.filter(EduResourceProduct.name.like(f"%{name}%"))
            if is_published is not None:
                q = q.filter(EduResourceProduct.is_published == is_published)
            if status is not None:
                q = q.filter(EduResourceProduct.status == status)
            total = q.count()
            items = (
                q.order_by(EduResourceProduct.sort.desc(), EduResourceProduct.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_product_to_dict(p) for p in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu resource] product list error: {e}")
            return error(str(e))


@router.get("/public-api/resource/product", summary="资源产品详情(公开)", operation_id="edu_platform_resource_get_product_public")
async def get_product_public(id: int = Query(..., description="产品id")):
    with get_session() as db:
        try:
            p = db.query(EduResourceProduct).filter(EduResourceProduct.id == id).first()
            if not p:
                return error("产品不存在", "404")
            return success(_product_to_dict(p))
        except Exception as e:
            logger.error(f"[edu resource] get product public error: {e}")
            return error(str(e))


@router.post("/resource/product", summary="新建资源产品", operation_id="edu_platform_resource_create_product")
async def create_product(
    resource_id: int = Body(...),
    name: str = Body(..., min_length=1, max_length=200),
    price: float = Body(0),
    original_price: float = Body(0),
    description: str | None = Body(None),
    is_published: bool = Body(False),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            p = EduResourceProduct(
                resource_id=resource_id,
                name=name,
                price=price,
                original_price=original_price,
                description=description,
                is_published=is_published,
                sort=sort,
                status=status,
            )
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"[edu resource] create product error: {e}")
            return error(str(e))


@router.put("/resource/product", summary="更新资源产品", operation_id="edu_platform_resource_update_product")
async def update_product(
    id: int = Body(...),
    resource_id: int | None = Body(None),
    name: str | None = Body(None),
    price: float | None = Body(None),
    original_price: float | None = Body(None),
    description: str | None = Body(None),
    is_published: bool | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            p = db.query(EduResourceProduct).filter(EduResourceProduct.id == id).first()
            if not p:
                return error("产品不存在", "404")
            if resource_id is not None:
                p.resource_id = resource_id
            if name is not None:
                p.name = name
            if price is not None:
                p.price = price
            if original_price is not None:
                p.original_price = original_price
            if description is not None:
                p.description = description
            if is_published is not None:
                p.is_published = is_published
            if sort is not None:
                p.sort = sort
            if status is not None:
                p.status = status
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"[edu resource] update product error: {e}")
            return error(str(e))


@router.delete("/resource/product", summary="删除资源产品", operation_id="edu_platform_resource_delete_product")
async def delete_product(id: int = Query(...)):
    with get_session() as db:
        try:
            p = db.query(EduResourceProduct).filter(EduResourceProduct.id == id).first()
            if not p:
                return error("产品不存在", "404")
            db.delete(p)
            return success()
        except Exception as e:
            logger.error(f"[edu resource] delete product error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 资源标签
# ---------------------------------------------------------------------------


def _tag_to_dict(t: EduResourceTag) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "sort": t.sort,
        "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/resource/tag/list", summary="资源标签列表", operation_id="edu_platform_resource_tag_list")
async def tag_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduResourceTag)
            if name:
                q = q.filter(EduResourceTag.name.like(f"%{name}%"))
            if status is not None:
                q = q.filter(EduResourceTag.status == status)
            total = q.count()
            items = (
                q.order_by(EduResourceTag.sort.asc(), EduResourceTag.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_tag_to_dict(t) for t in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu resource] tag list error: {e}")
            return error(str(e))


@router.get("/public-api/resource/tag", summary="资源标签详情(公开)", operation_id="edu_platform_resource_get_tag_public")
async def get_tag_public(id: int = Query(..., description="标签id")):
    with get_session() as db:
        try:
            t = db.query(EduResourceTag).filter(EduResourceTag.id == id).first()
            if not t:
                return error("标签不存在", "404")
            return success(_tag_to_dict(t))
        except Exception as e:
            logger.error(f"[edu resource] get tag public error: {e}")
            return error(str(e))


@router.post("/resource/tag", summary="新建资源标签", operation_id="edu_platform_resource_create_tag")
async def create_tag(
    name: str = Body(..., min_length=1, max_length=100),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            t = EduResourceTag(name=name, sort=sort, status=status)
            db.add(t)
            db.flush()
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu resource] create tag error: {e}")
            return error(str(e))


@router.put("/resource/tag", summary="更新资源标签", operation_id="edu_platform_resource_update_tag")
async def update_tag(
    id: int = Body(...),
    name: str | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            t = db.query(EduResourceTag).filter(EduResourceTag.id == id).first()
            if not t:
                return error("标签不存在", "404")
            if name is not None:
                t.name = name
            if sort is not None:
                t.sort = sort
            if status is not None:
                t.status = status
            return success({"id": t.id})
        except Exception as e:
            logger.error(f"[edu resource] update tag error: {e}")
            return error(str(e))


@router.delete("/resource/tag", summary="删除资源标签", operation_id="edu_platform_resource_delete_tag")
async def delete_tag(id: int = Query(...)):
    with get_session() as db:
        try:
            t = db.query(EduResourceTag).filter(EduResourceTag.id == id).first()
            if not t:
                return error("标签不存在", "404")
            db.delete(t)
            return success()
        except Exception as e:
            logger.error(f"[edu resource] delete tag error: {e}")
            return error(str(e))
