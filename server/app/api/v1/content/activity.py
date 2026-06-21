"""活动管理路由(前端 / 管理端共用)."""

from fastapi import APIRouter, Query
from loguru import logger

from app.database import get_session
from app.schemas.common import error, success

router = APIRouter()


@router.get("/list", summary="活动列表")
async def list_activities(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None, description="筛选状态: 0=关闭 1=开启"),
):
    """分页返回活动列表,可按 status 筛选."""
    with get_session() as db:
        try:
            from app.models.activity_models import Activity

            q = db.query(Activity)
            if status is not None:
                q = q.filter(Activity.status == status)
            total = q.count()
            items = q.order_by(Activity.id.desc()).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "id": a.id,
                    "activity_name": a.activity_name,
                    "activity_rule": a.activity_rule,
                    "activity_recharge": a.activity_recharge,
                    "multiple": a.multiple,
                    "computing": a.computing,
                    "begin_time": a.begin_time.isoformat() if a.begin_time else None,
                    "end_time": a.end_time.isoformat() if a.end_time else None,
                    "status": a.status,
                    "begin_amount": a.begin_amount,
                    "creator": a.creator,
                }
                for a in items
            ]
            return success(data, total=total)
        except Exception as e:
            logger.error(f"List activities error: {e}")
            return error(str(e))


@router.get("/{activity_id}", summary="活动详情")
async def get_activity(activity_id: str):
    """根据活动 ID 返回详情."""
    with get_session() as db:
        try:
            from app.models.activity_models import Activity

            act = db.query(Activity).filter(Activity.id == activity_id).first()
            if not act:
                return error("活动不存在", "404")
            return success(
                {
                    "id": act.id,
                    "activity_name": act.activity_name,
                    "activity_rule": act.activity_rule,
                    "activity_recharge": act.activity_recharge,
                    "multiple": act.multiple,
                    "computing": act.computing,
                    "begin_time": act.begin_time.isoformat() if act.begin_time else None,
                    "end_time": act.end_time.isoformat() if act.end_time else None,
                    "status": act.status,
                    "begin_amount": act.begin_amount,
                    "creator": act.creator,
                    "updator": act.updator,
                }
            )
        except Exception as e:
            logger.error(f"Get activity error: {e}")
            return error(str(e))
