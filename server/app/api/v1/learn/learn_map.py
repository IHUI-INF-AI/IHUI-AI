"""学习模块 - 学习地图"""
from fastapi import APIRouter, Body, Depends, Path, Query
from loguru import logger

from app.core.admin_auth import admin_required
from app.database import get_session
from app.models.learn_models import LearnLearnMap, LearnLearnMapTopic
from app.schemas.common import error, success

router = APIRouter()


@router.get("/learn-map/list", summary="学习地图列表")
async def list_learn_maps(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(LearnLearnMap)
            if status:
                q = q.filter(LearnLearnMap.status == status)
            total = q.count()
            items = q.order_by(LearnLearnMap.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": m.id,
                        "title": m.title,
                        "image": m.image,
                        "status": m.status,
                        "description": m.description,
                    }
                    for m in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"learn map list error: {e}")
            return error(str(e))


@router.get("/learn-map/{mid}", summary="学习地图详情")
async def get_learn_map(mid: int):
    with get_session() as db:
        try:
            m = db.query(LearnLearnMap).filter(LearnLearnMap.id == mid).first()
            if not m:
                return error("学习地图不存在", "404")
            topic_ids = [
                r.topic_id
                for r in db.query(LearnLearnMapTopic).filter(LearnLearnMapTopic.learn_map_id == mid).all()
            ]
            return success(
                {
                    "id": m.id,
                    "title": m.title,
                    "image": m.image,
                    "status": m.status,
                    "description": m.description,
                    "topic_ids": topic_ids,
                }
            )
        except Exception as e:
            logger.error(f"learn map get error: {e}")
            return error(str(e))


@router.post("/learn-map", summary="创建学习地图", dependencies=[Depends(admin_required)])
async def create_learn_map(
    title: str = Body(..., min_length=1, max_length=100),
    image: str = Body(..., max_length=1000),
    description: str = Body(""),
    status: str = Body("draft"),
    company_id: int | None = Body(None),
    department_id: int | None = Body(None),
):
    with get_session() as db:
        try:
            m = LearnLearnMap(
                title=title,
                image=image,
                description=description,
                status=status,
                company_id=company_id,
                department_id=department_id,
            )
            db.add(m)
            db.flush()
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"learn map create error: {e}")
            return error(str(e))


@router.put("/learn-map/{mid}", summary="修改学习地图", dependencies=[Depends(admin_required)])
async def update_learn_map(
    mid: int,
    title: str | None = Body(None),
    image: str | None = Body(None),
    description: str | None = Body(None),
    status: str | None = Body(None),
):
    with get_session() as db:
        try:
            m = db.query(LearnLearnMap).filter(LearnLearnMap.id == mid).first()
            if not m:
                return error("学习地图不存在", "404")
            if title is not None:
                m.title = title
            if image is not None:
                m.image = image
            if description is not None:
                m.description = description
            if status is not None:
                m.status = status
            return success({"id": m.id})
        except Exception as e:
            logger.error(f"learn map update error: {e}")
            return error(str(e))


@router.delete("/learn-map/{mid}", summary="删除学习地图", dependencies=[Depends(admin_required)])
async def delete_learn_map(mid: int):
    with get_session() as db:
        try:
            m = db.query(LearnLearnMap).filter(LearnLearnMap.id == mid).first()
            if not m:
                return error("学习地图不存在", "404")
            db.delete(m)
            db.query(LearnLearnMapTopic).filter(LearnLearnMapTopic.learn_map_id == mid).delete()
            return success()
        except Exception as e:
            logger.error(f"learn map delete error: {e}")
            return error(str(e))


@router.post("/learn-map/batch-delete", summary="批量删除学习地图", dependencies=[Depends(admin_required)])
async def batch_delete_learn_maps(ids: list[int] = Body(..., embed=True)):
    with get_session() as db:
        try:
            if not ids:
                return error("ids 不能为空", "400")
            id_list = [int(i) for i in ids if i is not None]
            db.query(LearnLearnMap).filter(LearnLearnMap.id.in_(id_list)).delete(synchronize_session=False)
            db.query(LearnLearnMapTopic).filter(
                LearnLearnMapTopic.learn_map_id.in_(id_list)
            ).delete(synchronize_session=False)
            return success({"success": len(id_list), "failed": 0})
        except Exception as e:
            logger.error(f"learn map batch delete error: {e}")
            return error(str(e))


@router.post("/learn-map/{mid}/bind-topic", summary="学习地图绑定专题", dependencies=[Depends(admin_required)])
async def bind_map_topic(mid: int = Path(...), topic_id: int = Query(...)):
    with get_session() as db:
        try:
            existing = (
                db.query(LearnLearnMapTopic)
                .filter(LearnLearnMapTopic.learn_map_id == mid, LearnLearnMapTopic.topic_id == topic_id)
                .first()
            )
            if existing:
                return success({"id": existing.id, "exists": True})
            r = LearnLearnMapTopic(learn_map_id=mid, topic_id=topic_id)
            db.add(r)
            db.flush()
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"learn map bind topic error: {e}")
            return error(str(e))
