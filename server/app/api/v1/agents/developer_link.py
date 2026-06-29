# Developer link management - ported from P2 ZhsDeveloperLinkController.java

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.utils.pagination import paginate

router = APIRouter()


class DeveloperLinkCreate(BaseModel):
    user_id: str
    coze_account_id: str | None = None
    coze_account_name: str | None = None
    status: int | None = 1


class DeveloperLinkUpdate(BaseModel):
    id: int
    user_id: str | None = None
    coze_account_id: str | None = None
    coze_account_name: str | None = None
    status: int | None = None


class AssignAccountRequest(BaseModel):
    id: str
    cozeId: str  # noqa: 5


@router.get("/list", summary="List developer links")
async def list_developer_links(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    user_id: str | None = Query(None),
    status: int | None = Query(None),
):
    with get_session() as db:
        from app.models.activity_models import DeveloperLink

        q = db.query(DeveloperLink)
        if user_id:
            q = q.filter(DeveloperLink.user_id == user_id)
        if status is not None:
            q = q.filter(DeveloperLink.status == status)
        q = q.order_by(DeveloperLink.id.desc())
        items, total = paginate(q, page, limit)
        rows = []
        for i in items:
            rows.append(
                {
                    "id": i.id,
                    "user_id": i.user_id,
                    "coze_account_id": i.coze_account_id,
                    "coze_account_name": i.coze_account_name,
                    "status": i.status,
                    "created_at": str(i.created_at) if hasattr(i, "created_at") and i.created_at else None,
                }
            )
        return success({"rows": rows, "total": total})


@router.get("/{item_id}", summary="Get developer link detail")
async def get_developer_link(item_id: int):
    with get_session() as db:
        from app.models.activity_models import DeveloperLink

        item = db.query(DeveloperLink).filter(DeveloperLink.id == item_id).first()
        if not item:
            return error("Not found", "404")
        return success(
            {
                "id": item.id,
                "user_id": item.user_id,
                "coze_account_id": item.coze_account_id,
                "coze_account_name": item.coze_account_name,
                "status": item.status,
            }
        )


@router.post("", summary="Create developer link")
async def create_developer_link(body: DeveloperLinkCreate):
    with get_session() as db:
        try:
            from app.models.activity_models import DeveloperLink

            item = DeveloperLink(
                user_id=body.user_id,
                coze_account_id=body.coze_account_id,
                coze_account_name=body.coze_account_name,
                status=body.status,
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            return success({"id": item.id})
        except Exception as e:
            logger.error("Create developer link error: " + str(e))
            return error(str(e))


@router.put("", summary="Update developer link")
async def update_developer_link(body: DeveloperLinkUpdate):
    with get_session() as db:
        try:
            from app.models.activity_models import DeveloperLink

            item = db.query(DeveloperLink).filter(DeveloperLink.id == body.id).first()
            if not item:
                return error("Not found", "404")
            if body.user_id is not None:
                item.user_id = body.user_id
            if body.coze_account_id is not None:
                item.coze_account_id = body.coze_account_id
            if body.coze_account_name is not None:
                item.coze_account_name = body.coze_account_name
            if body.status is not None:
                item.status = body.status
            db.commit()
            return success()
        except Exception as e:
            logger.error("Update developer link error: " + str(e))
            return error(str(e))


@router.delete("/{item_ids}", summary="Delete developer links")
async def delete_developer_links(item_ids: str):
    with get_session() as db:
        try:
            from app.models.activity_models import DeveloperLink

            ids = [int(x) for x in item_ids.split(",") if x.strip()]
            db.query(DeveloperLink).filter(DeveloperLink.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            return success()
        except Exception as e:
            logger.error("Delete developer link error: " + str(e))
            return error(str(e))


@router.put("/assignAccount", summary="Assign Coze account to developer")
async def assign_account(body: AssignAccountRequest):
    """Assign a Coze account to a developer link."""
    if not body.cozeId:
        return error("No Coze account ID provided")
    if not body.id:
        return error("No developer link ID provided")
    with get_session() as db:
        try:
            from app.models.activity_models import DeveloperLink

            item = db.query(DeveloperLink).filter(DeveloperLink.id == int(body.id)).first()
            if not item:
                return error("Developer link not found", "404")
            item.coze_account_id = body.cozeId
            db.commit()
            return success()
        except Exception as e:
            logger.error("Assign account error: " + str(e))
            return error(str(e))
