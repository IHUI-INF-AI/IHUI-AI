"""首页配置模块路由 - 迁移自旧 Java Spring Boot index-service (2026-07-05).

包含: 首页配置CRUD/首页分类导航列表.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import EduIndexCategory, EduIndexConfig
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 首页配置
# ---------------------------------------------------------------------------


def _config_to_dict(c: EduIndexConfig) -> dict:
    return {
        "id": c.id,
        "config_key": c.config_key,
        "config_value": c.config_value,
        "description": c.description,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/config/list", summary="首页配置列表", operation_id="edu_platform_index_config_list")
async def config_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    config_key: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduIndexConfig)
            if config_key:
                q = q.filter(EduIndexConfig.config_key.like(f"%{config_key}%"))
            if status is not None:
                q = q.filter(EduIndexConfig.status == status)
            total = q.count()
            items = (
                q.order_by(EduIndexConfig.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_config_to_dict(c) for c in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu index] config list error: {e}")
            return error(str(e))


@router.get("/config", summary="首页配置详情(按 key)", operation_id="edu_platform_index_get_config")
async def get_config(key: str = Query(..., description="配置键")):
    with get_session() as db:
        try:
            c = db.query(EduIndexConfig).filter(EduIndexConfig.config_key == key).first()
            if not c:
                return error("配置不存在", "404")
            return success(_config_to_dict(c))
        except Exception as e:
            logger.error(f"[edu index] get config error: {e}")
            return error(str(e))


@router.put("/config", summary="更新首页配置", operation_id="edu_platform_index_update_config")
async def update_config(
    id: int = Body(...),
    config_key: str | None = Body(None),
    config_value: str | None = Body(None),
    description: str | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduIndexConfig).filter(EduIndexConfig.id == id).first()
            if not c:
                return error("配置不存在", "404")
            if config_key is not None:
                c.config_key = config_key
            if config_value is not None:
                c.config_value = config_value
            if description is not None:
                c.description = description
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu index] update config error: {e}")
            return error(str(e))


@router.post("/config", summary="新建首页配置", operation_id="edu_platform_index_create_config")
async def create_config(
    config_key: str = Body(..., min_length=1, max_length=100),
    config_value: str | None = Body(None),
    description: str | None = Body(None, max_length=500),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduIndexConfig(
                config_key=config_key,
                config_value=config_value,
                description=description,
                status=status,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu index] create config error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 首页分类导航
# ---------------------------------------------------------------------------


def _category_to_dict(c: EduIndexCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "icon": c.icon,
        "link_url": c.link_url,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/category/list", summary="首页分类导航列表", operation_id="edu_platform_index_category_list")
async def category_list(
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduIndexCategory)
            if status is not None:
                q = q.filter(EduIndexCategory.status == status)
            else:
                q = q.filter(EduIndexCategory.status == 1)
            items = (
                q.order_by(EduIndexCategory.sort.asc(), EduIndexCategory.id.asc()).all()
            )
            return success([_category_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu index] category list error: {e}")
            return error(str(e))


@router.post("/category", summary="新建首页分类导航", operation_id="edu_platform_index_create_category")
async def create_category(
    name: str = Body(..., min_length=1, max_length=100),
    icon: str | None = Body(None, max_length=500),
    link_url: str | None = Body(None, max_length=500),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduIndexCategory(
                name=name,
                icon=icon,
                link_url=link_url,
                sort=sort,
                status=status,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu index] create category error: {e}")
            return error(str(e))


@router.put("/category", summary="更新首页分类导航", operation_id="edu_platform_index_update_category")
async def update_category(
    id: int = Body(...),
    name: str | None = Body(None),
    icon: str | None = Body(None),
    link_url: str | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduIndexCategory).filter(EduIndexCategory.id == id).first()
            if not c:
                return error("导航不存在", "404")
            if name is not None:
                c.name = name
            if icon is not None:
                c.icon = icon
            if link_url is not None:
                c.link_url = link_url
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu index] update category error: {e}")
            return error(str(e))


@router.delete("/category", summary="删除首页分类导航", operation_id="edu_platform_index_delete_category")
async def delete_category(id: int = Query(..., description="导航id")):
    with get_session() as db:
        try:
            c = db.query(EduIndexCategory).filter(EduIndexCategory.id == id).first()
            if not c:
                return error("导航不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"[edu index] delete category error: {e}")
            return error(str(e))
