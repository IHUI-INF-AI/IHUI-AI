"""签到模块 - 每日签到 + 签到记录"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.core.current_user import get_member_id_int
from app.database import get_session
from app.models.checkin_models import CheckIn, CheckInRecord
from app.schemas.common import error, success

router = APIRouter()


def _checkin_to_dict(c: CheckIn) -> dict:
    return {
        "id": c.id,
        "member_id": c.member_id,
        "continuous_num": c.continuous_num,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _record_to_dict(r: CheckInRecord) -> dict:
    return {
        "id": r.id,
        "member_id": r.member_id,
        "type": r.type,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


# ============ 连续签到 ============


@router.get("/list", summary="会员连续签到列表")
async def list_checkins(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CheckIn)
            if member_id:
                q = q.filter(CheckIn.member_id == member_id)
            total = q.count()
            items = q.order_by(CheckIn.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_checkin_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"checkin list error: {e}")
            return error(str(e))


@router.get("/{cid}", summary="连续签到详情")
async def get_checkin(cid: int):
    with get_session() as db:
        try:
            c = db.query(CheckIn).filter(CheckIn.id == cid).first()
            if not c:
                return error("签到记录不存在", "404")
            return success(_checkin_to_dict(c))
        except Exception as e:
            logger.error(f"checkin get error: {e}")
            return error(str(e))


@router.post("", summary="创建/更新连续签到")
async def create_checkin(
    continuous_num: int = Query(..., ge=0),
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            existing = db.query(CheckIn).filter(CheckIn.member_id == member_id).first()
            if existing:
                existing.continuous_num = continuous_num
                return success({"id": existing.id})
            c = CheckIn(member_id=member_id, continuous_num=continuous_num)
            db.add(c)
            db.flush()
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"checkin create error: {e}")
            return error(str(e))


@router.put("/{cid}", summary="修改连续签到")
async def update_checkin(
    cid: int,
    continuous_num: int | None = None,
):
    with get_session() as db:
        try:
            c = db.query(CheckIn).filter(CheckIn.id == cid).first()
            if not c:
                return error("签到记录不存在", "404")
            if continuous_num is not None:
                c.continuous_num = continuous_num
            return success({"id": c.id})
        except Exception as e:
            logger.error(f"checkin update error: {e}")
            return error(str(e))


@router.delete("/{cid}", summary="删除连续签到")
async def delete_checkin(cid: int):
    with get_session() as db:
        try:
            c = db.query(CheckIn).filter(CheckIn.id == cid).first()
            if not c:
                return error("签到记录不存在", "404")
            db.delete(c)
            return success()
        except Exception as e:
            logger.error(f"checkin delete error: {e}")
            return error(str(e))


# ============ 签到记录 ============


@router.get("/record/list", summary="签到记录列表")
async def list_records(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    member_id: int | None = None,
    type: str | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CheckInRecord)
            if member_id:
                q = q.filter(CheckInRecord.member_id == member_id)
            if type:
                q = q.filter(CheckInRecord.type == type)
            total = q.count()
            items = q.order_by(CheckInRecord.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success([_record_to_dict(i) for i in items], total=total)
        except Exception as e:
            logger.error(f"checkin record list error: {e}")
            return error(str(e))


@router.get("/record/{rid}", summary="签到记录详情")
async def get_record(rid: int):
    with get_session() as db:
        try:
            r = db.query(CheckInRecord).filter(CheckInRecord.id == rid).first()
            if not r:
                return error("签到记录不存在", "404")
            return success(_record_to_dict(r))
        except Exception as e:
            logger.error(f"checkin record get error: {e}")
            return error(str(e))


@router.post("/record", summary="新增签到记录（每日签到）")
async def create_record(
    type: str = Query(..., max_length=20),
    member_id: int = Depends(get_member_id_int),
):
    with get_session() as db:
        try:
            r = CheckInRecord(member_id=member_id, type=type)
            db.add(r)
            db.flush()
            return success({"id": r.id, "checkin_time": datetime.utcnow().isoformat()})
        except Exception as e:
            logger.error(f"checkin record create error: {e}")
            return error(str(e))


@router.put("/record/{rid}", summary="修改签到记录")
async def update_record(
    rid: int,
    type: str | None = None,
):
    with get_session() as db:
        try:
            r = db.query(CheckInRecord).filter(CheckInRecord.id == rid).first()
            if not r:
                return error("签到记录不存在", "404")
            if type is not None:
                r.type = type
            return success({"id": r.id})
        except Exception as e:
            logger.error(f"checkin record update error: {e}")
            return error(str(e))


@router.delete("/record/{rid}", summary="删除签到记录")
async def delete_record(rid: int):
    with get_session() as db:
        try:
            r = db.query(CheckInRecord).filter(CheckInRecord.id == rid).first()
            if not r:
                return error("签到记录不存在", "404")
            db.delete(r)
            return success()
        except Exception as e:
            logger.error(f"checkin record delete error: {e}")
            return error(str(e))
