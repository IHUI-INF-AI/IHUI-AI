"""直播功能 - 类目管理 (迁移自 edu server ihui-ai-edu-live-service)

注意: GET /category/list 公开列表已在 channel.py 中实现, 本模块不重复创建。
"""

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.live_models import LiveChannelCategory
from app.schemas.common import error, page_result, success
from app.security import require_role

router = APIRouter()


class CategoryCreateBody(BaseModel):
    name: str
    sort_order: int = 0
    is_show: bool = True
    is_show_index: bool = False
    icon: str | None = None


class CategoryUpdateBody(BaseModel):
    id: int
    name: str | None = None
    sort_order: int | None = None
    is_show: bool | None = None
    is_show_index: bool | None = None
    icon: str | None = None


class CategoryShowBody(BaseModel):
    id: int
    is_show: bool


class CategoryShowIndexBody(BaseModel):
    id: int
    is_show_index: bool


class CategoryImageBody(BaseModel):
    icon: str
    category_id: int


def _cat_to_dict(c: LiveChannelCategory) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "sort_order": c.sort_order,
        "is_show": c.is_show,
        "is_show_index": c.is_show_index,
        "icon": c.icon,
        "type": c.type,
        "level": c.level,
        "create_time": c.created_at.isoformat() if c.created_at else None,
        "update_time": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/category/admin/list", summary="后台类目列表")
async def admin_category_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    _admin: str = Depends(require_role("admin")),
):
    with get_session() as db:
        try:
            q = db.query(LiveChannelCategory)
            if name:
                q = q.filter(LiveChannelCategory.name.like(f"%{name}%"))
            total = q.count()
            items = (
                q.order_by(LiveChannelCategory.sort_order.asc(), LiveChannelCategory.id.asc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return page_result([_cat_to_dict(i) for i in items], total, page, limit)
        except Exception as e:
            logger.exception(f"live admin category list error: {e}")
            return error(str(e))


@router.post("/category", summary="创建类目")
async def create_category(body: CategoryCreateBody):
    with get_session() as db:
        try:
            c = LiveChannelCategory(
                name=body.name,
                sort_order=body.sort_order,
                is_show=body.is_show,
                icon=body.icon,
            )
            db.add(c)
            db.flush()
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category create error: {e}")
            return error(str(e))


@router.put("/category", summary="更新类目")
async def update_category(body: CategoryUpdateBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.id).first()
            if not c:
                return error("类目不存在", "404")
            if body.name is not None:
                c.name = body.name
            if body.sort_order is not None:
                c.sort_order = body.sort_order
            if body.is_show is not None:
                c.is_show = body.is_show
            if body.icon is not None:
                c.icon = body.icon
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category update error: {e}")
            return error(str(e))


@router.put("/category/is-show", summary="修改显示状态")
async def update_category_show(body: CategoryShowBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.id).first()
            if not c:
                return error("类目不存在", "404")
            c.is_show = body.is_show
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category is-show error: {e}")
            return error(str(e))


@router.put("/category/is-show-index", summary="修改首页显示状态")
async def update_category_show_index(body: CategoryShowIndexBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.id).first()
            if not c:
                return error("类目不存在", "404")
            c.is_show_index = body.is_show_index
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category is-show-index error: {e}")
            return error(str(e))


@router.post("/category/image", summary="上传类目图片")
async def upload_category_image(body: CategoryImageBody):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == body.category_id).first()
            if not c:
                return error("类目不存在", "404")
            c.icon = body.icon
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category image upload error: {e}")
            return error(str(e))


@router.delete("/category/image", summary="删除类目图片")
async def delete_category_image(category_id: int = Query(...)):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == category_id).first()
            if not c:
                return error("类目不存在", "404")
            c.icon = None
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category image delete error: {e}")
            return error(str(e))


@router.get("/category/{category_id}", summary="类目详情")
async def get_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == category_id).first()
            if not c:
                return error("类目不存在", "404")
            return success(_cat_to_dict(c))
        except Exception as e:
            logger.exception(f"live category get error: {e}")
            return error(str(e))


@router.delete("/category/{category_id}", summary="删除类目")
async def delete_category(category_id: int):
    with get_session() as db:
        try:
            c = db.query(LiveChannelCategory).filter(LiveChannelCategory.id == category_id).first()
            if not c:
                return error("类目不存在", "404")
            db.delete(c)
            return success({"id": category_id})
        except Exception as e:
            logger.exception(f"live category delete error: {e}")
            return error(str(e))
