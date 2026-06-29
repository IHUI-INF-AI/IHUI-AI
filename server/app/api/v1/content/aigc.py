# AIGC management - ported from P2 AiGcController.java

from fastapi import APIRouter, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.schemas.common import error, success
from app.utils.pagination import paginate

router = APIRouter()


class AiGcCreate(BaseModel):
    user_uuid: str
    agent_id: str | None = None
    gc_type: str | None = "text"
    content: str | None = None
    status: int | None = 1


class AiGcUpdate(BaseModel):
    id: int
    user_uuid: str | None = None
    agent_id: str | None = None
    gc_type: str | None = None
    content: str | None = None
    status: int | None = None


@router.get("/list", summary="List AIGC records")
async def list_aigc(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    user_uuid: str | None = Query(None),
    gc_type: str | None = Query(None),
    status: int | None = Query(None),
):
    with get_session() as db:
        from app.models.ai_gc_models import AiGc

        q = db.query(AiGc)
        if user_uuid:
            q = q.filter(AiGc.user_uuid == user_uuid)
        if gc_type:
            q = q.filter(AiGc.gc_type == gc_type)
        if status is not None:
            q = q.filter(AiGc.status == status)
        q = q.order_by(AiGc.id.desc())
        items, total = paginate(q, page, limit)
        rows = []
        for i in items:
            rows.append(
                {
                    "id": i.id,
                    "user_uuid": i.user_uuid,
                    "agent_id": i.agent_id,
                    "gc_type": i.gc_type,
                    "content": i.content,
                    "status": i.status,
                    "create_time": str(i.create_time) if i.create_time else None,
                }
            )
        return success({"rows": rows, "total": total})


@router.get("/{item_id}", summary="Get AIGC detail")
async def get_aigc(item_id: int):
    with get_session() as db:
        from app.models.ai_gc_models import AiGc

        item = db.query(AiGc).filter(AiGc.id == item_id).first()
        if not item:
            return error("Not found", "404")
        return success(
            {
                "id": item.id,
                "user_uuid": item.user_uuid,
                "agent_id": item.agent_id,
                "gc_type": item.gc_type,
                "content": item.content,
                "status": item.status,
                "create_time": str(item.create_time) if item.create_time else None,
            }
        )


@router.post("", summary="Create AIGC record")
async def create_aigc(body: AiGcCreate):
    with get_session() as db:
        try:
            from app.models.ai_gc_models import AiGc

            item = AiGc(
                user_uuid=body.user_uuid,
                agent_id=body.agent_id,
                gc_type=body.gc_type,
                content=body.content,
                status=body.status,
            )
            db.add(item)
            db.commit()
            db.refresh(item)
            return success({"id": item.id})
        except Exception as e:
            logger.error("Create AIGC error: " + str(e))
            return error(str(e))


@router.put("", summary="Update AIGC record")
async def update_aigc(body: AiGcUpdate):
    with get_session() as db:
        try:
            from app.models.ai_gc_models import AiGc

            item = db.query(AiGc).filter(AiGc.id == body.id).first()
            if not item:
                return error("Not found", "404")
            if body.user_uuid is not None:
                item.user_uuid = body.user_uuid
            if body.agent_id is not None:
                item.agent_id = body.agent_id
            if body.gc_type is not None:
                item.gc_type = body.gc_type
            if body.content is not None:
                item.content = body.content
            if body.status is not None:
                item.status = body.status
            db.commit()
            return success()
        except Exception as e:
            logger.error("Update AIGC error: " + str(e))
            return error(str(e))


@router.delete("/{item_ids}", summary="Delete AIGC records")
async def delete_aigc(item_ids: str):
    with get_session() as db:
        try:
            from app.models.ai_gc_models import AiGc

            ids = [int(x) for x in item_ids.split(",") if x.strip()]
            db.query(AiGc).filter(AiGc.id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            return success()
        except Exception as e:
            logger.error("Delete AIGC error: " + str(e))
            return error(str(e))
