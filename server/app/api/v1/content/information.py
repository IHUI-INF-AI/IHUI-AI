"""AI 资讯管理路由."""

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


# ---------------------------------------------------------------------------
# 字典分类
# ---------------------------------------------------------------------------


@router.get("/dictionary", summary="资讯分类字典")
async def list_dictionary(
    type: str = Query(None, description="字典类型筛选"),
):
    """返回 zhs_category_dictionary 中的分类字典列表."""
    with get_session() as db:
        try:
            from app.models.app_content_models import CategoryDictionary

            q = db.query(CategoryDictionary).filter(CategoryDictionary.status == 1)
            if type:
                q = q.filter(CategoryDictionary.type == type)
            items = q.order_by(CategoryDictionary.sort, CategoryDictionary.id).all()
            data = [
                {
                    "id": d.id,
                    "name": d.name,
                    "code": d.code,
                    "parent_id": d.parent_id,
                    "type": d.type,
                }
                for d in items
            ]
            return success(data)
        except Exception as e:
            logger.error(f"List dictionary error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 资讯 CRUD
# ---------------------------------------------------------------------------


@router.post("/create", summary="创建资讯")
async def create_information(
    title: str = Query(...),
    content: str = Query(""),
    type: int = Query(None, description="资讯分类 type"),
    sort: int = Query(0),
    user_uuid: str = Depends(require_login),
):
    """管理端创建一条 AI 资讯."""
    with get_session() as db:
        try:
            from app.models.app_content_models import Information

            info = Information(title=title, content=content, type=type, sort=sort, status=1)
            db.add(info)
            db.commit()
            return success({"id": info.id, "title": title})
        except Exception as e:
            logger.error(f"Create information error: {e}")
            return error(str(e))


@router.get("/list", summary="资讯列表")
async def list_information(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: int = Query(None, description="按分类筛选"),
    status: int = Query(None, description="筛选状态: 0=禁用 1=启用"),
):
    """分页返回资讯列表."""
    with get_session() as db:
        try:
            from app.models.app_content_models import Information

            q = db.query(Information)
            if type is not None:
                q = q.filter(Information.type == type)
            if status is not None:
                q = q.filter(Information.status == status)
            total = q.count()
            items = q.order_by(Information.sort, Information.id.desc()).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "id": i.id,
                    "title": i.title,
                    "content": i.content,
                    "type": i.type,
                    "status": i.status,
                    "sort": i.sort,
                }
                for i in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List information error: {e}")
            return error(str(e))
