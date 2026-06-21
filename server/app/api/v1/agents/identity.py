"""产品身份订单路由 & 身份比例配置路由."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from loguru import logger
from pydantic import BaseModel

from app.database import get_session
from app.models.app_content_models import ProductIdentity
from app.models.payment_models import Order
from app.schemas.common import error, success
from app.security import require_login

router = APIRouter()


@router.get("/list", summary="身份订单列表")
async def list_identity_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None, description="订单状态 0=待支付 1=已支付 2=已退款 3=已取消"),
    order_type: int = Query(2, description="订单类型, 默认2=身份订单"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        q = db.query(Order).filter(Order.user_id == user_uuid)
        if status is not None:
            q = q.filter(Order.status == status)
        q = q.filter(Order.order_type == order_type)
        total = q.count()
        items = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
        data = []
        for o in items:
            # 关联查询产品身份信息
            identity = None
            if o.product_identity_id:
                identity = db.query(ProductIdentity).filter(ProductIdentity.id == o.product_identity_id).first()
            data.append(
                {
                    "id": o.id,
                    "out_trade_no": o.out_trade_no,
                    "user_id": o.user_id,
                    "amount": o.amount,
                    "status": o.status,
                    "payment_status": o.payment_status,
                    "order_type": o.order_type,
                    "product_identity_id": o.product_identity_id,
                    "pay_type": o.pay_type,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                    "paid_at": o.paid_at.isoformat() if o.paid_at else None,
                    "identity_name": identity.name if identity else None,
                    "identity_type": identity.identity_type if identity else None,
                    "duration_days": identity.duration_days if identity else None,
                }
            )
        return success(data, total=total)


@router.get("/info", summary="获取身份产品详情")
async def get_identity_info(
    identity_id: str = Query(..., description="产品身份ID"),
):
    with get_session() as db:
        identity = db.query(ProductIdentity).filter(ProductIdentity.id == identity_id).first()
        if not identity:
            return error("身份产品不存在")
        data = {
            "id": identity.id,
            "name": identity.name,
            "description": identity.description,
            "price": identity.price,
            "token_amount": identity.token_amount,
            "identity_type": identity.identity_type,
            "duration_days": identity.duration_days,
            "status": identity.status,
            "sort": identity.sort,
            "created_at": identity.created_at.isoformat() if identity.created_at else None,
            "updated_at": identity.updated_at.isoformat() if identity.updated_at else None,
        }
        return success(data)


@router.post("/create", summary="创建身份订单")
async def create_identity_order(
    identity_id: str = Query(..., description="产品身份ID"),
    pay_type: str = Query("wechat", description="支付方式: wechat / alipay"),
    user_uuid: str = Depends(require_login),
):
    with get_session() as db:
        try:
            # 校验身份产品是否存在且启用
            identity = db.query(ProductIdentity).filter(ProductIdentity.id == identity_id).first()
            if not identity:
                return error("身份产品不存在")
            if identity.status != 1:
                return error("该身份产品已下架")

            # 生成商户订单号
            out_trade_no = f"ID{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:8]}"

            order = Order(
                user_id=user_uuid,
                out_trade_no=out_trade_no,
                amount=identity.price,
                status=0,
                payment_status=0,
                order_type=2,
                product_identity_id=identity_id,
                pay_type=pay_type,
            )
            db.add(order)
            db.commit()
            db.refresh(order)

            data = {
                "id": order.id,
                "out_trade_no": out_trade_no,
                "amount": order.amount,
                "status": order.status,
                "identity_name": identity.name,
                "identity_type": identity.identity_type,
                "duration_days": identity.duration_days,
                "pay_type": pay_type,
            }
            return success(data, msg="订单创建成功")
        except Exception as e:
            logger.error(f"Create identity order error: {e}")
            return error(str(e))


# ===========================================================================
# IdentityProportion (身份比例配置)
# ===========================================================================


class IdentityProportionBody(BaseModel):
    begin_time: str | None = None
    end_time: str | None = None
    status: int | None = 0
    gift: int | None = 0
    token_proportion: int | None = 0
    vip_gift: int | None = 0
    routine_proportion: int | None = 0
    vip_proportion: int | None = 0
    trader_proportion: int | None = 0
    trader_gift: int | None = 0
    trader_routine_proportion: int | None = 0
    trader_vip_proportion: int | None = 0
    trader_trader_proportion: int | None = 0
    grand_routine_proportion: int | None = 0
    grand_vip_proportion: int | None = 0
    grand_trader_proportion: int | None = 0


def _serialize_proportion(p) -> dict:
    return {
        "id": p.id,
        "begin_time": p.begin_time.isoformat() if p.begin_time else None,
        "end_time": p.end_time.isoformat() if p.end_time else None,
        "status": p.status,
        "gift": p.gift,
        "token_proportion": p.token_proportion,
        "vip_gift": p.vip_gift,
        "routine_proportion": p.routine_proportion,
        "vip_proportion": p.vip_proportion,
        "trader_proportion": p.trader_proportion,
        "trader_gift": p.trader_gift,
        "trader_routine_proportion": p.trader_routine_proportion,
        "trader_vip_proportion": p.trader_vip_proportion,
        "trader_trader_proportion": p.trader_trader_proportion,
        "grand_routine_proportion": p.grand_routine_proportion,
        "grand_vip_proportion": p.grand_vip_proportion,
        "grand_trader_proportion": p.grand_trader_proportion,
        "creator": p.creator,
        "created_time": p.created_time.isoformat() if p.created_time else None,
    }


@router.get("/proportion/list", summary="身份比例列表")
async def list_proportions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: int = Query(None, description="0=stopped 1=active"),
    user_uuid: str = Depends(require_login),
):
    from app.models.payment_models import IdentityProportion

    with get_session() as db:
        q = db.query(IdentityProportion)
        if status is not None:
            q = q.filter(IdentityProportion.status == status)
        total = q.count()
        items = q.order_by(IdentityProportion.id.desc()).offset((page - 1) * limit).limit(limit).all()
        return success([_serialize_proportion(p) for p in items], total=total)


@router.post("/proportion/create", summary="创建比例配置")
async def create_proportion(
    body: IdentityProportionBody,
    user_uuid: str = Depends(require_login),
):
    from app.models.payment_models import IdentityProportion

    with get_session() as db:
        try:
            prop_id = uuid.uuid4().hex
            begin_dt = datetime.fromisoformat(body.begin_time) if body.begin_time else None
            end_dt = datetime.fromisoformat(body.end_time) if body.end_time else None
            p = IdentityProportion(
                id=prop_id,
                begin_time=begin_dt,
                end_time=end_dt,
                status=body.status,
                gift=body.gift,
                token_proportion=body.token_proportion,
                vip_gift=body.vip_gift,
                routine_proportion=body.routine_proportion,
                vip_proportion=body.vip_proportion,
                trader_proportion=body.trader_proportion,
                trader_gift=body.trader_gift,
                trader_routine_proportion=body.trader_routine_proportion,
                trader_vip_proportion=body.trader_vip_proportion,
                trader_trader_proportion=body.trader_trader_proportion,
                grand_routine_proportion=body.grand_routine_proportion,
                grand_vip_proportion=body.grand_vip_proportion,
                grand_trader_proportion=body.grand_trader_proportion,
                creator=user_uuid,
                created_time=datetime.utcnow(),
            )
            db.add(p)
            db.commit()
            db.refresh(p)
            return success(_serialize_proportion(p))
        except Exception as e:
            logger.error(f"Create proportion error: {e}")
            return error(str(e))


@router.put("/proportion/{proportion_id}", summary="修改比例")
async def update_proportion(
    proportion_id: str,
    body: IdentityProportionBody,
    user_uuid: str = Depends(require_login),
):
    from app.models.payment_models import IdentityProportion

    with get_session() as db:
        try:
            p = db.query(IdentityProportion).filter(IdentityProportion.id == proportion_id).first()
            if not p:
                return error("比例配置不存在", "404")
            if body.begin_time is not None:
                p.begin_time = datetime.fromisoformat(body.begin_time)
            if body.end_time is not None:
                p.end_time = datetime.fromisoformat(body.end_time)
            for field in (
                "status",
                "gift",
                "token_proportion",
                "vip_gift",
                "routine_proportion",
                "vip_proportion",
                "trader_proportion",
                "trader_gift",
                "trader_routine_proportion",
                "trader_vip_proportion",
                "trader_trader_proportion",
                "grand_routine_proportion",
                "grand_vip_proportion",
                "grand_trader_proportion",
            ):
                val = getattr(body, field)
                if val is not None:
                    setattr(p, field, val)
            p.updator = user_uuid
            p.updated_time = datetime.utcnow()
            db.commit()
            return success({"id": p.id})
        except Exception as e:
            logger.error(f"Update proportion error: {e}")
            return error(str(e))
