"""P2 基金操作路由 -- 创建订单/微信支付/转账/提现.

对应 Java: FundController (createOrder, wechatPay, transfer, withdrawal)
5 个端点:
  POST /orders              - 创建基金订单
  POST /fund/wechat         - 基金微信支付
  POST /fund/alipay         - 基金支付宝支付 (委托 alipay_fund.py)
  POST /fund/transfer       - 银行转账
  POST /fund/withdrawal     - 基金提现
"""


from fastapi import APIRouter, Depends, Query
from loguru import logger

from app.database import get_session
from app.metrics_business import BizTimer
from app.schemas.common import error, success
from app.security import require_login
from app.services.order_service import create_order

router = APIRouter(tags=["Fund Operations"])


@router.post("/createOrder", summary="创建基金充值订单")
async def create_fund_order(
    amount: float = Query(..., description="充值金额(元)"),
    product_id: str = Query(None),
    order_type: int = Query(0),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: FundController.createOrder -- 创建充值订单并返回支付参数."""
    with BizTimer("biz:fund:create_order", with_user=True):
        amount_cents = round(amount * 100)
        if amount_cents <= 0:
            return error("金额必须大于 0")
        result = create_order(user_uuid, amount_cents, order_type, product_id, pay_type="fund")
        if not result["success"]:
            return error(result["msg"])
        return success(
            {
                "out_trade_no": result["out_trade_no"],
                "amount": amount_cents,
                "order_id": result["order_id"],
            }
        )


@router.post("/wechatPay", summary="基金微信支付")
async def fund_wechat_pay(
    out_trade_no: str = Query(..., description="订单号"),
    total_fee: int = Query(..., description="金额(分)"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: FundController.wechatPay -- 调用微信支付 JSAPI 下单."""
    with BizTimer("biz:fund:wechat_pay", with_user=True):
        try:
            from app.utils.wechat_pay_util import WechatPayUtil

            pay = WechatPayUtil()
            result = await pay.jsapi_pay(
                out_trade_no=out_trade_no,
                total_fee=total_fee,
                description="基金充值",
            )
            if result.get("prepay_id"):
                return success(result)
            return error(result.get("message", "微信支付下单失败"))
        except Exception as e:
            logger.error(f"Fund wechat pay error: {e}")
            return error(str(e))


@router.post("/transfer", summary="银行转账")
async def fund_transfer(
    amount: int = Query(..., description="转账金额(分)"),
    bank_account: str = Query(..., description="收款账号"),
    bank_name: str = Query("", description="收款银行"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: FundController.transfer -- 银行转账(审核后执行)."""
    with BizTimer("biz:fund:transfer", with_user=True):
        if amount <= 0:
            return error("转账金额必须大于 0")
        with get_session() as db:
            try:
                from app.models.payment_models import WithdrawalFlow
                from app.utils.order_generator import order_generator

                partner_no = order_generator.generate()
                flow = WithdrawalFlow(
                    user_id=user_uuid,
                    amount=amount,
                    status=0,
                    partner_trade_no=partner_no,
                )
                db.add(flow)
                db.commit()
                return success(
                    {
                        "id": flow.id,
                        "partner_trade_no": partner_no,
                        "amount": amount,
                        "bank_account": bank_account,
                        "status": "pending",
                    }
                )
            except Exception as e:
                logger.error(f"Fund transfer error: {e}")
                return error(str(e))


@router.post("/withdrawal", summary="基金提现")
async def fund_withdrawal(
    amount: int = Query(..., description="提现金额(分)"),
    user_uuid: str = Depends(require_login),
):
    """对应 Java: FundController.withdrawal -- 申请提现(扣除 2% 手续费)."""
    with BizTimer("biz:fund:withdrawal", with_user=True):
        if amount <= 0:
            return error("提现金额必须大于 0")
        actual_amount = int(amount * 0.98)
        fee = amount - actual_amount
        with get_session() as db:
            try:
                from app.models.payment_models import WithdrawalFlow
                from app.utils.order_generator import order_generator

                partner_no = order_generator.generate()
                flow = WithdrawalFlow(
                    user_id=user_uuid,
                    amount=actual_amount,
                    status=0,
                    partner_trade_no=partner_no,
                )
                db.add(flow)
                db.commit()
                return success(
                    {
                        "id": flow.id,
                        "partner_trade_no": partner_no,
                        "original_amount": amount,
                        "actual_amount": actual_amount,
                        "fee": fee,
                        "status": "pending",
                    }
                )
            except Exception as e:
                logger.error(f"Fund withdrawal error: {e}")
                return error(str(e))
