# Product management - ported from P2 ZhsProductController.java

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.utils.pagination import paginate

router = APIRouter()


class ProductCreate(BaseModel):
    id: str
    name: str
    price: int | None = None
    token_amount: int | None = None
    type: str | None = None
    status: int | None = 1
    sort: int | None = 0


class ProductUpdate(BaseModel):
    id: str
    name: str | None = None
    price: int | None = None
    token_amount: int | None = None
    type: str | None = None
    status: int | None = None
    sort: int | None = None


@router.get("/list", summary="List products")
def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    name: str | None = Query(None),
    type: str | None = Query(None),
    status: int | None = Query(None),
):
    try:
        with get_session() as db:
            from app.models.app_content_models import ZhsProduct

            q = db.query(ZhsProduct)
            if name:
                q = q.filter(ZhsProduct.name.like("%" + name + "%"))
            if type:
                q = q.filter(ZhsProduct.type == type)
            if status is not None:
                q = q.filter(ZhsProduct.status == status)
            q = q.order_by(ZhsProduct.sort.asc(), ZhsProduct.id.asc())
            items, total = paginate(q, page, limit)
            rows = []
            for i in items:
                rows.append(
                    {
                        "id": i.id,
                        "name": i.name,
                        "price": i.price,
                        "token_amount": i.token_amount,
                        "type": i.type,
                        "status": i.status,
                        "sort": i.sort,
                        "created_at": str(i.created_at) if hasattr(i, "created_at") and i.created_at else None,
                        "updated_at": str(i.updated_at) if hasattr(i, "updated_at") and i.updated_at else None,
                    }
                )
            return success({"rows": rows, "total": total})
    except Exception as e:
        # 数据库表可能未初始化(开发环境常见),返回空数据
        logger.warning(f"Product list fallback (table may not exist): {e}")
        return success({"rows": [], "total": 0})


@router.get("/{item_id}", summary="Get product detail")
def get_product(item_id: str):
    with get_session() as db:
        from app.models.app_content_models import ZhsProduct

        item = db.query(ZhsProduct).filter(ZhsProduct.id == item_id).first()
        if not item:
            return error("Not found", "404")
        return success(
            {
                "id": item.id,
                "name": item.name,
                "price": item.price,
                "token_amount": item.token_amount,
                "type": item.type,
                "status": item.status,
                "sort": item.sort,
            }
        )


@router.post("", summary="Create product")
def create_product(body: ProductCreate):
    with get_session() as db:
        try:
            from app.models.app_content_models import ZhsProduct

            item = ZhsProduct(
                id=body.id,
                name=body.name,
                price=body.price,
                token_amount=body.token_amount,
                type=body.type,
                status=body.status,
                sort=body.sort,
            )
            db.add(item)
            db.commit()
            return success({"id": item.id})
        except Exception as e:
            logger.error("Create product error: " + str(e))
            return error(str(e))


@router.put("", summary="Update product")
def update_product(body: ProductUpdate):
    with get_session() as db:
        try:
            from app.models.app_content_models import ZhsProduct

            item = db.query(ZhsProduct).filter(ZhsProduct.id == body.id).first()
            if not item:
                return error("Not found", "404")
            if body.name is not None:
                item.name = body.name
            if body.price is not None:
                item.price = body.price
            if body.token_amount is not None:
                item.token_amount = body.token_amount
            if body.type is not None:
                item.type = body.type
            if body.status is not None:
                item.status = body.status
            if body.sort is not None:
                item.sort = body.sort
            db.commit()
            return success()
        except Exception as e:
            logger.error("Update product error: " + str(e))
            return error(str(e))


@router.delete("/{item_ids}", summary="Delete products")
def delete_products(item_ids: str):
    with get_session() as db:
        try:
            from app.models.app_content_models import ZhsProduct

            ids = [x.strip() for x in item_ids.split(",") if x.strip()]
            db.query(ZhsProduct).filter(ZhsProduct.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            return success()
        except Exception as e:
            logger.error("Delete product error: " + str(e))
            return error(str(e))
