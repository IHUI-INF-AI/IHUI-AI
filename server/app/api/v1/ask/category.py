"""问答社区 - 分类管理"""


from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.models.ask_models import AskCategory
from app.schemas.ask import CategoryCreate, CategoryUpdate
from app.schemas.common import error, success
from app.security import require_role

router = APIRouter()


def _to_dict(c: AskCategory) -> dict:
    return {
        "id": c.id,
        "pid": c.pid,
        "name": c.name,
        "sort_order": c.sort_order,
        "is_show": c.is_show,
        "is_show_index": c.is_show_index,
        "image": c.image,
        "level": c.level,
        "create_time": c.created_at.isoformat() if c.created_at else None,
        "update_time": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/admin/list", operation_id="ask_category_admin_list", summary="分类列表(管理员)")
async def admin_list(
    is_show: bool | None = None,
    is_show_index: bool | None = None,
    _admin: str = Depends(require_role("admin")),
):
    with get_session() as db:
        try:
            q = db.query(AskCategory)
            if is_show is not None:
                q = q.filter(AskCategory.is_show == is_show)
            if is_show_index is not None:
                q = q.filter(AskCategory.is_show_index == is_show_index)
            items = q.order_by(AskCategory.sort_order.asc(), AskCategory.id.asc()).all()
            return success([_to_dict(i) for i in items])
        except Exception as e:
            logger.error(f"ask category admin list error: {e}")
            return error(str(e))


@router.get("/public-api/list", summary="分类列表(公开)")
async def public_list(
    is_show: bool | None = None,
    is_show_index: bool | None = None,
):
    with get_session() as db:
        try:
            q = db.query(AskCategory).filter(AskCategory.is_show)
            if is_show is not None:
                q = q.filter(AskCategory.is_show == is_show)
            if is_show_index is not None:
                q = q.filter(AskCategory.is_show_index == is_show_index)
            items = q.order_by(AskCategory.sort_order.asc(), AskCategory.id.asc()).all()
            return success([_to_dict(i) for i in items])
        except Exception as e:
            logger.error(f"ask category public list error: {e}")
            return error(str(e))


@router.get("/{cat_id}", summary="分类详情")
async def get_category(cat_id: int):
    with get_session() as db:
        try:
            c = db.query(AskCategory).filter(AskCategory.id == cat_id).first()
            if not c:
                return error("分类不存在", "404")
            return success(_to_dict(c))
        except Exception as e:
            logger.error(f"ask category get error: {e}")
            return error(str(e))


@router.post("", summary="添加分类")
async def add_category(body: CategoryCreate):
    with get_session() as db:
        try:
            level = 1
            if body.pid and body.pid > 0:
                p = db.query(AskCategory).filter(AskCategory.id == body.pid).first()
                if p:
                    level = (p.level or 1) + 1
            c = AskCategory(
                pid=body.pid,
                name=body.name,
                sort_order=body.sort_order,
                is_show=body.is_show,
                is_show_index=body.is_show_index,
                image=body.image,
                level=level,
            )
            db.add(c)
            db.flush()
            return success(_to_dict(c))
        except Exception as e:
            logger.error(f"ask category add error: {e}")
            return error(str(e))


@router.put("", summary="修改分类")
async def update_category(body: CategoryUpdate):
    with get_session() as db:
        try:
            c = db.query(AskCategory).filter(AskCategory.id == body.id).first()
            if not c:
                return error("分类不存在", "404")
            if body.pid is not None:
                c.pid = body.pid
            if body.name is not None:
                c.name = body.name
            if body.sort_order is not None:
                c.sort_order = body.sort_order
            if body.is_show is not None:
                c.is_show = body.is_show
            if body.is_show_index is not None:
                c.is_show_index = body.is_show_index
            if body.image is not None:
                c.image = body.image
            return success(_to_dict(c))
        except Exception as e:
            logger.error(f"ask category update error: {e}")
            return error(str(e))


@router.delete("/{cat_id}", summary="删除分类")
async def delete_category(cat_id: int):
    with get_session() as db:
        try:
            c = db.query(AskCategory).filter(AskCategory.id == cat_id).first()
            if not c:
                return error("分类不存在", "404")
            has_child = db.query(AskCategory).filter(AskCategory.pid == cat_id).count() > 0
            if has_child:
                return error("存在子分类,无法删除", "400")
            db.delete(c)
            return success({"id": cat_id})
        except Exception as e:
            logger.error(f"ask category delete error: {e}")
            return error(str(e))


@router.put("/is-show", summary="修改显示状态")
async def change_show(id: int = Query(...), is_show: bool = Query(...)):
    with get_session() as db:
        try:
            c = db.query(AskCategory).filter(AskCategory.id == id).first()
            if not c:
                return error("分类不存在", "404")
            c.is_show = is_show
            return success()
        except Exception as e:
            logger.error(f"ask category is-show error: {e}")
            return error(str(e))


@router.put("/is-show-index", summary="修改首页显示状态")
async def change_show_index(id: int = Query(...), is_show_index: bool = Query(...)):
    with get_session() as db:
        try:
            c = db.query(AskCategory).filter(AskCategory.id == id).first()
            if not c:
                return error("分类不存在", "404")
            c.is_show_index = is_show_index
            return success()
        except Exception as e:
            logger.error(f"ask category is-show-index error: {e}")
            return error(str(e))
