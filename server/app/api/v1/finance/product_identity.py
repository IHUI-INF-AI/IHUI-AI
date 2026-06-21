# Product identity management - ported from P2 ZhsProductIdentityController.java

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.utils.pagination import paginate

router = APIRouter()


class ProductIdentityCreate(BaseModel):
    id: str
    name: str | None = None
    description: str | None = None
    price: int | None = None
    token_amount: int | None = None
    identity_type: str | None = None
    duration_days: int | None = None
    status: int | None = 1
    sort: int | None = 0


class ProductIdentityUpdate(BaseModel):
    id: str
    name: str | None = None
    description: str | None = None
    price: int | None = None
    token_amount: int | None = None
    identity_type: str | None = None
    duration_days: int | None = None
    status: int | None = None
    sort: int | None = None


@router.get("/list", summary="List product identities")
async def list_product_identities(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    name: str | None = Query(None),
    identity_type: str | None = Query(None),
    status: int | None = Query(None),
):
    with get_session() as db:
        from app.models.app_content_models import ProductIdentity

        q = db.query(ProductIdentity)
        if name:
            q = q.filter(ProductIdentity.name.like("%" + name + "%"))
        if identity_type:
            q = q.filter(ProductIdentity.identity_type == identity_type)
        if status is not None:
            q = q.filter(ProductIdentity.status == status)
        q = q.order_by(ProductIdentity.sort.asc(), ProductIdentity.id.asc())
        items, total = paginate(q, page, limit)
        rows = []
        for i in items:
            rows.append(
                {
                    "id": i.id,
                    "name": i.name,
                    "description": i.description,
                    "price": i.price,
                    "token_amount": i.token_amount,
                    "identity_type": i.identity_type,
                    "duration_days": i.duration_days,
                    "status": i.status,
                    "sort": i.sort,
                }
            )
        return success({"rows": rows, "total": total})


@router.get("/{item_id}", summary="Get product identity detail")
async def get_product_identity(item_id: str):
    with get_session() as db:
        from app.models.app_content_models import ProductIdentity

        item = db.query(ProductIdentity).filter(ProductIdentity.id == item_id).first()
        if not item:
            return error("Not found", "404")
        return success(
            {
                "id": item.id,
                "name": item.name,
                "description": item.description,
                "price": item.price,
                "token_amount": item.token_amount,
                "identity_type": item.identity_type,
                "duration_days": item.duration_days,
                "status": item.status,
                "sort": item.sort,
            }
        )


@router.post("", summary="Create product identity")
async def create_product_identity(body: ProductIdentityCreate):
    with get_session() as db:
        try:
            from app.models.app_content_models import ProductIdentity

            item = ProductIdentity(
                id=body.id,
                name=body.name,
                description=body.description,
                price=body.price,
                token_amount=body.token_amount,
                identity_type=body.identity_type,
                duration_days=body.duration_days,
                status=body.status,
                sort=body.sort,
            )
            db.add(item)
            db.commit()
            return success({"id": item.id})
        except Exception as e:
            logger.error("Create product identity error: " + str(e))
            return error(str(e))


@router.put("", summary="Update product identity")
async def update_product_identity(body: ProductIdentityUpdate):
    with get_session() as db:
        try:
            from app.models.app_content_models import ProductIdentity

            item = db.query(ProductIdentity).filter(ProductIdentity.id == body.id).first()
            if not item:
                return error("Not found", "404")
            if body.name is not None:
                item.name = body.name
            if body.description is not None:
                item.description = body.description
            if body.price is not None:
                item.price = body.price
            if body.token_amount is not None:
                item.token_amount = body.token_amount
            if body.identity_type is not None:
                item.identity_type = body.identity_type
            if body.duration_days is not None:
                item.duration_days = body.duration_days
            if body.status is not None:
                item.status = body.status
            if body.sort is not None:
                item.sort = body.sort
            db.commit()
            return success()
        except Exception as e:
            logger.error("Update product identity error: " + str(e))
            return error(str(e))


@router.delete("/{item_ids}", summary="Delete product identities")
async def delete_product_identities(item_ids: str):
    with get_session() as db:
        try:
            from app.models.app_content_models import ProductIdentity

            ids = [x.strip() for x in item_ids.split(",") if x.strip()]
            db.query(ProductIdentity).filter(ProductIdentity.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            return success()
        except Exception as e:
            logger.error("Delete product identity error: " + str(e))
            return error(str(e))
