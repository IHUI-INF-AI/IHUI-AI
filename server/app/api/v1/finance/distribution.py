"""分销 / 邀请 / 佣金路由."""


from fastapi import APIRouter, Depends, Query
from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/subordinates", summary="我的下级用户列表")
async def list_subordinates(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.user_models import User

            q = db.query(User).filter(User.parent_id == user_uuid)
            total = q.count()
            items = q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "uuid": u.uuid,
                    "nickname": u.nickname,
                    "avatar": u.avatar,
                    "is_vip": u.is_vip,
                    "created_at": u.created_at.isoformat() if u.created_at else None,
                }
                for u in items
            ]
            return success(data, total=total)

        except Exception as e:
            logger.error(f"Error: {e}")
            return error(str(e))


@router.get("/team", summary="我的团队(下属列表+搜索排序)")
async def list_team(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    keyword: str | None = Query(None, description="搜索关键词(昵称/UUID)"),
    sort_by: str = Query("created_at", description="排序字段: created_at / is_vip"),
    sort_order: str = Query("desc", description="排序方向: asc / desc"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.user_models import User

            q = db.query(User).filter(User.parent_id == user_uuid)
            if keyword:
                pattern = f"%{keyword}%"
                q = q.filter((User.nickname.like(pattern)) | (User.uuid.like(pattern)))
        except Exception as e:
            logger.error(f"Error: {e}")
            return error(str(e))


@router.get("/team/center", summary="个人中心我的团队(概要)")
async def team_center(user_uuid: str = Depends(require_login)):
    """Unimplemented. Use /invitee-stats instead."""
    return error("Not implemented")


@router.get("/invitee-stats", summary="邀请统计")
async def invitee_stats(user_uuid: str = Depends(require_login)):
    with get_session() as db:
        try:
            from app.models.user_models import User

            total = db.query(func.count(User.uuid)).filter(User.parent_id == user_uuid).scalar() or 0
            vip_count = (
                db.query(func.count(User.uuid)).filter(User.parent_id == user_uuid, User.is_vip == 1).scalar() or 0
            )
            return success({"total_invitees": total, "vip_invitees": vip_count})

        except Exception as e:
            logger.error(f"Error: {e}")
            return error(str(e))


@router.get("/commission-detail", summary="佣金明细")
async def commission_detail(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            from app.models.payment_models import CommissionFlow

            q = db.query(CommissionFlow).filter(CommissionFlow.user_id == user_uuid)
            total = q.count()
            items = q.order_by(CommissionFlow.id.desc()).offset((page - 1) * limit).limit(limit).all()
            data = [
                {
                    "id": c.id,
                    "amount": c.amount,
                    "token": c.token,
                    "type": c.type,
                    "status": c.status,
                    "remark": c.remark,
                    "invited_user_id": c.invited_user_id,
                    "time": c.time,
                }
                for c in items
            ]
            return success(data, total=total)

        except Exception as e:
            logger.error(f"Error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 新增: 对应 Java DistributionController 中缺失的端点
# ---------------------------------------------------------------------------


@router.get("/operator-card", summary="操盘手数据卡片统计")
async def operator_data_card(user_uuid: str = Depends(require_login)):
    """Mirrors Java getOperatorDataCardData.

    Returns commission stats (today/month/total), order stats of invitees,
    invited user counts, and withdrawal stats.
    """


    # Stub: function body is empty - variables computed but never used, no return value
    return error("Not implemented")


@router.get("/invitee-order-stats", summary="下级用户订单统计")
async def invitee_order_stats(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """Mirrors Java getUserInviteeOrderStats.

    For each invitee, return their order count, total amount, and latest order time.
    """
    from app.models.payment_models import Order
    from app.models.user_models import User

    with get_session() as db:
        try:
            invitees = db.query(User).filter(User.parent_id == user_uuid).all()
            inv_uuids = [inv.uuid for inv in invitees]
            agg_map = {}
            if inv_uuids:
                agg_rows = (
                    db.query(
                        Order.user_id,
                        func.count(Order.id).label("cnt"),
                        func.sum(Order.amount).label("total"),
                        func.max(Order.created_at).label("latest"),
                    )
                    .filter(Order.user_id.in_(inv_uuids), Order.status == 1)
                    .group_by(Order.user_id)
                    .all()
                )
                agg_map = {r.user_id: (r.cnt or 0, r.total or 0, r.latest) for r in agg_rows}
            result = []
            for inv in invitees:
                cnt, total, latest = agg_map.get(inv.uuid, (0, 0, None))
                result.append(
                    {
                        "uuid": inv.uuid,
                        "nickname": inv.nickname,
                        "avatar": inv.avatar,
                        "is_vip": inv.is_vip,
                        "created_at": inv.created_at.isoformat() if inv.created_at else None,
                        "order_count": cnt,
                        "total_amount": total,
                        "latest_time": latest.isoformat() if latest else None,
                    }
                )

        except Exception as e:
            logger.error(f"Error: {e}")
            return error(str(e))


@router.get("/user-and-children-orders", summary="用户及下级的订单列表")
async def user_and_children_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """Mirrors Java getUserAndChildrenOrders.

    Returns orders from the current user AND all invitees, paginated.
    """
    from app.models.payment_models import Order
    from app.models.user_models import User

    with get_session() as db:
        try:
            pass
        except Exception as e:
            logger.error(f"Error: {e}")
            return error(str(e))
        # Collect self + children UUIDs
        child_uuids = [u[0] for u in db.query(User.uuid).filter(User.parent_id == user_uuid).all()]
        all_uuids = [user_uuid, *child_uuids]

        q = db.query(Order).filter(Order.user_id.in_(all_uuids))
        total = q.count()
        items = q.order_by(Order.id.desc()).offset((page - 1) * limit).limit(limit).all()
        data = [
            {
                "id": o.id,
                "out_trade_no": o.out_trade_no,
                "amount": o.amount,
                "status": o.status,
                "payment_status": o.payment_status,
                "order_type": o.order_type,
                "product_id": o.product_id,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in items
        ]
        return success(data, total=total)
