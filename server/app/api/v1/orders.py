"""
通用订单管理 API
迁移自: ihui-ai-edu-order-service OrderController
  - POST /auth-api/order → /create
  - POST /auth-api/order/cancel → /cancel
  - GET /auth-api/order → /{order_id}
  - GET /order/list → /list
  - GET /auth-api/order/list → /user/list
  - POST /public-api/order/update/status → /{order_id}/status
  - POST /auth-api/order/pre-get-order-amount → /pre-amount
  - POST /auth-api/order/get-order-amount → /{order_id}/amount
  - POST /auth-api/order/payment → /{order_id}/pay
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Body
from loguru import logger
from sqlalchemy import select

from app.core.current_user import current_user_id_or_guest
from app.database import get_session
from app.models.payment_models import Order
from app.schemas.common import error, success
from app.security import require_login, require_role

router = APIRouter(prefix="/order", tags=["Order"])


def _uid() -> str:
    """获取当前用户ID, 未登录返回 'guest'."""
    return current_user_id_or_guest()


def _is_admin(db, user_uuid: str) -> bool:
    """检查用户是否拥有 admin 角色 (用于跨用户/管理端操作的权限校验)."""
    from app.models.sys_models import SysRole, SysUser, SysUserRole

    stmt = (
        select(SysUser.user_id)
        .join(SysUserRole, SysUser.user_id == SysUserRole.user_id)
        .join(SysRole, SysUserRole.role_id == SysRole.role_id)
        .where(
            SysUser.user_uuid == user_uuid,
            SysRole.role_key == "admin",
            SysRole.status == "0",
            SysRole.del_flag == "0",
        )
        .limit(1)
    )
    return db.execute(stmt).scalar() is not None


def _order_to_dict(o: Order) -> dict:
    """将 Order 对象序列化为字典."""
    return {
        "id": o.id,
        "user_id": o.user_id,
        "out_trade_no": o.out_trade_no,
        "open_id": o.open_id,
        "amount": o.amount,
        "status": o.status,
        "payment_status": o.payment_status,
        "product_id": o.product_id,
        "order_type": o.order_type,
        "pay_type": o.pay_type,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "paid_at": o.paid_at.isoformat() if o.paid_at else None,
        "refund_time": o.refund_time.isoformat() if o.refund_time else None,
        "refund_reason": o.refund_reason,
    }


# =============================================================================
# 订单创建 / 取消 / 预估价
# 注意: 静态路由 (/list, /user/list, /pre-amount) 必须定义在动态路由
#       (/{order_id}) 之前, 否则 FastAPI 会把 "list" 当作 order_id 匹配.
# =============================================================================


@router.post("/create", summary="创建订单")
async def create_order(
    product_id: str = Query(..., description="产品ID"),
    order_type: int = Query(0, ge=0, le=3, description="订单类型: 0=token, 1=activity, 2=identity, 3=agent"),
    amount: int = Query(..., ge=1, description="金额(分)"),
    pay_type: str = Query("wechat", description="支付方式: wechat, alipay"),
    user_id: str = Depends(_uid),
):
    """创建订单.

    生成商户订单号并创建一条待支付订单记录 (status=0, payment_status=0).
    返回订单ID、商户订单号和金额, 前端可据此发起支付.
    """
    with get_session() as db:
        try:
            from app.utils.order_generator import order_generator

            out_trade_no = order_generator.generate()
            order = Order(
                user_id=user_id,
                out_trade_no=out_trade_no,
                amount=amount,
                status=0,
                payment_status=0,
                product_id=product_id,
                order_type=order_type,
                pay_type=pay_type,
            )
            db.add(order)
            db.commit()
            db.refresh(order)
            return success(
                {
                    "id": order.id,
                    "out_trade_no": order.out_trade_no,
                    "amount": order.amount,
                    "status": order.status,
                    "order_type": order.order_type,
                    "pay_type": order.pay_type,
                }
            )
        except Exception as e:
            logger.error(f"create order error: {e}")
            return error(str(e))


@router.post("/cancel", summary="取消订单")
async def cancel_order(
    order_id: int = Query(..., ge=1, description="订单ID"),
    user_id: str = Depends(_uid),
):
    """取消订单.

    仅待支付 (status=0) 的订单可取消, 取消后 status 置为 3 (已取消).
    """
    with get_session() as db:
        try:
            order = db.query(Order).filter(
                Order.id == order_id,
                Order.user_id == user_id,
            ).first()
            if not order:
                return error("订单不存在", code="404000")
            if order.status != 0:
                return error("仅待支付订单可取消")
            order.status = 3
            db.commit()
            return success({"id": order.id, "status": order.status})
        except Exception as e:
            logger.error(f"cancel order error: {e}")
            return error(str(e))


@router.post("/pre-amount", summary="下单前计算价格")
async def pre_amount(
    product_id: str = Query(..., description="产品ID"),
    order_type: int = Query(0, ge=0, le=3, description="订单类型: 0=token, 1=activity, 2=identity, 3=agent"),
    amount: int = Query(..., ge=1, description="金额(分)"),
):
    """下单前计算价格.

    根据产品ID和订单类型校验并返回最终应付金额(分).
    当前直接返回传入金额, 后续可接入产品定价规则做优惠/折扣计算.
    """
    try:
        # TODO: 后续可按 product_id / order_type 查询产品定价, 计算优惠后金额
        return success(
            {
                "product_id": product_id,
                "order_type": order_type,
                "original_amount": amount,
                "pay_amount": amount,
            }
        )
    except Exception as e:
        logger.error(f"pre amount error: {e}")
        return error(str(e))


# =============================================================================
# 订单列表 (静态路由, 必须在 /{order_id} 之前)
# =============================================================================


@router.get("/list", summary="订单列表")
async def order_list(
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(20, ge=1, le=100, description="每页条数"),
    status: int | None = Query(None, description="状态筛选: 0=待支付, 1=已支付, 2=已退款, 3=已取消"),
    user_id: str | None = Query(None, description="按用户筛选"),
    user_uuid: str = Depends(require_login),
):
    """订单列表.

    支持按状态和用户ID筛选, 分页返回.
    - 未传 user_id: 默认返回当前登录用户的订单
    - 传了 user_id 且与当前登录用户不同: 需要 admin 角色, 否则只能查看自己的订单
    """
    with get_session() as db:
        try:
            # 权限校验: 跨用户查询需要 admin 角色
            target_user_id = user_id or user_uuid
            if user_id and user_id != user_uuid:
                if not _is_admin(db, user_uuid):
                    return error("无权查看其他用户的订单", "403000")

            q = db.query(Order)
            if status is not None:
                q = q.filter(Order.status == status)
            q = q.filter(Order.user_id == target_user_id)
            total = q.count()
            items = (
                q.order_by(Order.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
            )
        except Exception as e:
            logger.error(f"order list error: {e}")
            return error(str(e))


@router.get("/user/list", summary="用户订单列表")
async def user_order_list(
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(20, ge=1, le=100, description="每页条数"),
    user_id: str = Depends(_uid),
):
    """当前用户的订单列表.

    按当前登录用户筛选, 分页返回, 默认按创建时间倒序.
    """
    with get_session() as db:
        try:
            q = db.query(Order).filter(Order.user_id == user_id)
            total = q.count()
            items = (
                q.order_by(Order.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
                .all()
            )
            return success(
                [_order_to_dict(o) for o in items],
                total=total,
            )
        except Exception as e:
            logger.error(f"user order list error: {e}")
            return error(str(e))


# =============================================================================
# 订单详情 / 金额 / 状态 / 支付 (动态路由 /{order_id} 及其子路径)
# =============================================================================


@router.get("/{order_id}", summary="获取订单详情")
async def order_detail(
    order_id: int,
    user_id: str = Depends(_uid),
):
    """获取订单详情.

    按订单ID查询, 同时校验订单归属当前用户.
    """
    with get_session() as db:
        try:
            order = db.query(Order).filter(
                Order.id == order_id,
                Order.user_id == user_id,
            ).first()
            if not order:
                return error("订单不存在", code="404000")
            return success(_order_to_dict(order))
        except Exception as e:
            logger.error(f"order detail error: {e}")
            return error(str(e))


@router.get("/{order_id}/amount", summary="下单后获取价格")
async def order_amount(
    order_id: int,
    user_uuid: str = Depends(require_login),
):
    """下单后获取订单价格.

    按订单ID查询并返回订单金额(分)及支付状态.
    校验订单归属: 仅订单所有者或 admin 可查询.
    """
    with get_session() as db:
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return error("订单不存在", code="404000")
            # 权限校验: 仅订单所有者或 admin 可查询
            if order.user_id != user_uuid and not _is_admin(db, user_uuid):
                return error("无权查看该订单", "403000")
            return success(
                {
                    "id": order.id,
                    "out_trade_no": order.out_trade_no,
                    "amount": order.amount,
                    "status": order.status,
                    "payment_status": order.payment_status,
                    "pay_type": order.pay_type,
                }
            )
        except Exception as e:
            logger.error(f"order amount error: {e}")
            return error(str(e))


@router.put("/{order_id}/status", summary="更新订单状态")
async def update_order_status(
    order_id: int,
    status: int = Query(..., ge=0, le=3, description="订单状态: 0=待支付, 1=已支付, 2=已退款, 3=已取消"),
    user_uuid: str = Depends(require_role("admin")),
):
    """更新订单状态 (管理端).

    需要 admin 角色权限. 根据传入的状态值更新订单, 并在状态为已支付时记录支付时间.
    """
    with get_session() as db:
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return error("订单不存在", code="404000")

            order.status = status
            if status == 1:
                # 已支付: 同步支付状态并记录支付时间
                order.payment_status = 1
                order.paid_at = datetime.now(timezone.utc)
            elif status == 2:
                # 已退款: 同步支付状态并记录退款时间
                order.payment_status = 2
                order.refund_time = datetime.now(timezone.utc)
            db.commit()
            return success({"id": order.id, "status": order.status})
        except Exception as e:
            logger.error(f"update order status error: {e}")
            return error(str(e))


@router.post("/{order_id}/pay", summary="支付订单")
async def pay_order(
    order_id: int,
    pay_type: str = Query("wechat", description="支付方式: wechat, alipay"),
    user_id: str = Depends(_uid),
):
    """支付订单.

    根据支付方式发起支付:
      - wechat: 有 open_id 走 JSAPI 预下单, 否则走 APP 预下单
      - alipay: 生成支付宝页面支付链接

    返回对应渠道的支付参数, 前端据此调起支付.
    """
    with get_session() as db:
        try:
            order = db.query(Order).filter(
                Order.id == order_id,
                Order.user_id == user_id,
            ).first()
            if not order:
                return error("订单不存在", code="404000")
            if order.status != 0:
                return error("订单状态不允许支付")

            if pay_type == "wechat":
                from app.utils import wechat_pay_util as wx

                if order.open_id:
                    result = await wx.jsapi_prepay(
                        open_id=order.open_id,
                        amount_cents=order.amount,
                        out_trade_no=order.out_trade_no,
                        description="订单支付",
                    )
                else:
                    result = await wx.app_prepay(
                        amount_cents=order.amount,
                        out_trade_no=order.out_trade_no,
                        description="订单支付",
                    )
                if not result.get("prepay_id"):
                    return error(result.get("message", "微信支付下单失败"))
                # 支付网关成功后才更新并提交 pay_type
                order.pay_type = pay_type
                db.commit()
                return success(result)

            elif pay_type == "alipay":
                from app.utils import alipay_util as alipay

                total_amount = f"{order.amount / 100:.2f}"
                biz = {
                    "out_trade_no": order.out_trade_no,
                    "total_amount": total_amount,
                    "subject": "订单支付",
                    "product_code": "FAST_INSTANT_TRADE_PAY",
                }
                pay_url = alipay.build_signed_url(biz, method="alipay.trade.page.pay")
                # 支付网关成功后才更新并提交 pay_type
                order.pay_type = pay_type
                db.commit()
                return success(
                    {
                        "out_trade_no": order.out_trade_no,
                        "pay_url": pay_url,
                        "amount": order.amount,
                    }
                )

            else:
                return error(f"不支持的支付方式: {pay_type}")
        except Exception as e:
            logger.error(f"pay order error: {e}")
            return error(str(e))
