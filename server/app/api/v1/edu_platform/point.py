"""积分模块路由 - 迁移自旧 Java Spring Boot point-service (2026-07-05).

包含: 积分渠道CRUD/积分规则CRUD/积分渠道关联/积分记录查询.
"""
from fastapi import APIRouter, Body, Query
from loguru import logger

from app.database import get_session
from app.models.edu_platform_models_ext import (
    EduPoint,
    EduPointChannel,
    EduPointChannelRelation,
    EduPointRecord,
)
from app.schemas.common import error, success

router = APIRouter()


# ---------------------------------------------------------------------------
# 积分渠道
# ---------------------------------------------------------------------------


def _channel_to_dict(c: EduPointChannel) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "code": c.code,
        "description": c.description,
        "sort": c.sort,
        "status": c.status,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/channel/list", summary="积分渠道列表")
async def channel_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    name: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduPointChannel)
            if name:
                q = q.filter(EduPointChannel.name.like(f"%{name}%"))
            if status is not None:
                q = q.filter(EduPointChannel.status == status)
            total = q.count()
            items = (
                q.order_by(EduPointChannel.sort.asc(), EduPointChannel.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_channel_to_dict(c) for c in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu point] channel list error: {e}")
            return error(str(e))


@router.get("/public-api/channel", summary="积分渠道详情(公开)")
async def get_channel_public(id: int = Query(..., description="渠道id")):
    with get_session() as db:
        try:
            c = db.query(EduPointChannel).filter(EduPointChannel.id == id).first()
            if not c:
                return error("渠道不存在", "404")
            return success(_channel_to_dict(c))
        except Exception as e:
            logger.error(f"[edu point] get channel public error: {e}")
            return error(str(e))


@router.get("/channel/all", summary="所有积分渠道")
async def channel_all():
    with get_session() as db:
        try:
            items = (
                db.query(EduPointChannel)
                .filter(EduPointChannel.status == 1)
                .order_by(EduPointChannel.sort.asc(), EduPointChannel.id.asc())
                .all()
            )
            return success([_channel_to_dict(c) for c in items])
        except Exception as e:
            logger.error(f"[edu point] channel all error: {e}")
            return error(str(e))


@router.post("/channel", summary="新建积分渠道")
async def create_channel(
    name: str = Body(..., min_length=1, max_length=100),
    code: str | None = Body(None, max_length=50),
    description: str | None = Body(None),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            c = EduPointChannel(
                name=name,
                code=code,
                description=description,
                sort=sort,
                status=status,
            )
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu point] create channel error: {e}")
            return error(str(e))


@router.put("/channel", summary="更新积分渠道")
async def update_channel(
    id: int = Body(...),
    name: str | None = Body(None),
    code: str | None = Body(None),
    description: str | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            c = db.query(EduPointChannel).filter(EduPointChannel.id == id).first()
            if not c:
                return error("渠道不存在", "404")
            if name is not None:
                c.name = name
            if code is not None:
                c.code = code
            if description is not None:
                c.description = description
            if sort is not None:
                c.sort = sort
            if status is not None:
                c.status = status
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"[edu point] update channel error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 积分规则
# ---------------------------------------------------------------------------


def _point_to_dict(p: EduPoint) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "code": p.code,
        "channel_id": p.channel_id,
        "point": p.point,
        "description": p.description,
        "sort": p.sort,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/public-api/point", summary="积分规则详情(公开)")
async def get_point_public(id: int = Query(..., description="积分id")):
    with get_session() as db:
        try:
            p = db.query(EduPoint).filter(EduPoint.id == id).first()
            if not p:
                return error("积分规则不存在", "404")
            return success(_point_to_dict(p))
        except Exception as e:
            logger.error(f"[edu point] get point public error: {e}")
            return error(str(e))


@router.post("/point", summary="新建积分规则")
async def create_point(
    name: str = Body(..., min_length=1, max_length=100),
    code: str | None = Body(None, max_length=50),
    channel_id: int | None = Body(None),
    point: int = Body(0),
    description: str | None = Body(None),
    sort: int = Body(0),
    status: int = Body(1),
):
    with get_session() as db:
        try:
            p = EduPoint(
                name=name,
                code=code,
                channel_id=channel_id,
                point=point,
                description=description,
                sort=sort,
                status=status,
            )
            db.add(p)
            db.flush()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"[edu point] create point error: {e}")
            return error(str(e))


@router.put("/point", summary="更新积分规则")
async def update_point(
    id: int = Body(...),
    name: str | None = Body(None),
    code: str | None = Body(None),
    channel_id: int | None = Body(None),
    point: int | None = Body(None),
    description: str | None = Body(None),
    sort: int | None = Body(None),
    status: int | None = Body(None),
):
    with get_session() as db:
        try:
            p = db.query(EduPoint).filter(EduPoint.id == id).first()
            if not p:
                return error("积分规则不存在", "404")
            if name is not None:
                p.name = name
            if code is not None:
                p.code = code
            if channel_id is not None:
                p.channel_id = channel_id
            if point is not None:
                p.point = point
            if description is not None:
                p.description = description
            if sort is not None:
                p.sort = sort
            if status is not None:
                p.status = status
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"[edu point] update point error: {e}")
            return error(str(e))


@router.delete("/point", summary="删除积分规则")
async def delete_point(id: int = Query(..., description="积分id")):
    with get_session() as db:
        try:
            p = db.query(EduPoint).filter(EduPoint.id == id).first()
            if not p:
                return error("积分规则不存在", "404")
            db.delete(p)
            return success()
        except Exception as e:
            logger.error(f"[edu point] delete point error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 积分渠道关联
# ---------------------------------------------------------------------------


def _relation_to_dict(r: EduPointChannelRelation) -> dict:
    return {
        "id": r.id,
        "point_id": r.point_id,
        "channel_id": r.channel_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/point/channel/relation/list", summary="积分渠道关联列表")
async def relation_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    point_id: int | None = None,
    channel_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduPointChannelRelation)
            if point_id:
                q = q.filter(EduPointChannelRelation.point_id == point_id)
            if channel_id:
                q = q.filter(EduPointChannelRelation.channel_id == channel_id)
            total = q.count()
            items = (
                q.order_by(EduPointChannelRelation.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_relation_to_dict(r) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu point] relation list error: {e}")
            return error(str(e))


@router.put("/point/channel/relation", summary="更新积分渠道关联")
async def update_relation(
    point_id: int = Body(...),
    channel_ids: list[int] = Body(..., description="渠道id列表"),
):
    """更新某个积分规则关联的渠道列表(全量覆盖)."""
    with get_session() as db:
        try:
            db.query(EduPointChannelRelation).filter(
                EduPointChannelRelation.point_id == point_id
            ).delete(synchronize_session=False)
            for cid in channel_ids or []:
                db.add(EduPointChannelRelation(point_id=point_id, channel_id=cid))
            db.flush()
            return success({"point_id": point_id, "channel_ids": channel_ids})
        except Exception as e:
            logger.error(f"[edu point] update relation error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 积分记录(辅助查询)
# ---------------------------------------------------------------------------


def _record_to_dict(r: EduPointRecord) -> dict:
    return {
        "id": r.id,
        "member_id": r.member_id,
        "point": r.point,
        "balance": r.balance,
        "type": r.type,
        "description": r.description,
        "ref_id": r.ref_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/record/list", summary="积分记录列表")
async def record_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    type: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(EduPointRecord)
            if member_id:
                q = q.filter(EduPointRecord.member_id == member_id)
            if type:
                q = q.filter(EduPointRecord.type == type)
            total = q.count()
            items = (
                q.order_by(EduPointRecord.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_record_to_dict(r) for r in items],
                total=total,
                page=page,
                page_size=limit,
            )
        except Exception as e:
            logger.error(f"[edu point] record list error: {e}")
            return error(str(e))
