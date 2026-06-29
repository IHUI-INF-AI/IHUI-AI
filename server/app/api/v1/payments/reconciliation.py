"""支付对账管理端点 -- 仅管理员."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query

from app.schemas.common import success
from app.security import require_login
from app.services.reconciliation_service import (
    auto_close_expired_orders,
    auto_reconcile_yesterday,
    query_pending_orders,
    reconcile_alipay_for,
    reconcile_all_for,
    reconcile_wechat_for,
)

router = APIRouter()


@router.get("/alipay", summary="拉取支付宝某天账单并对账")
async def alipay_reconcile(
    bill_date: str = Query(None, description="yyyy-MM-dd,默认昨天"),
):
    if not bill_date:
        bill_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    result = await reconcile_alipay_for(bill_date)
    return success(result)


@router.get("/wechat", summary="拉取微信某天账单并对账")
async def wechat_reconcile(
    bill_date: str = Query(None, description="yyyy-MM-dd,默认昨天"),
):
    if not bill_date:
        bill_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    result = await reconcile_wechat_for(bill_date)
    return success(result)


@router.get("/all", summary="拉取支付宝 + 微信双边对账")
async def all_reconcile(
    bill_date: str = Query(None, description="yyyy-MM-dd,默认昨天"),
    user_uuid: str = Depends(require_login),
):
    if not bill_date:
        bill_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    result = await reconcile_all_for(bill_date)
    return success(result)


@router.post("/auto", summary="手动触发自动对账(昨天)")
async def auto_reconcile(user_uuid: str = Depends(require_login)):
    result = await auto_reconcile_yesterday()
    return success(result)


@router.get("/pending", summary="查询超时未支付订单")
async def list_pending(user_uuid: str = Depends(require_login)):
    pending = query_pending_orders()
    return success({"count": len(pending), "items": pending})


@router.post("/close_expired", summary="关闭 30 分钟未支付订单")
async def close_expired(user_uuid: str = Depends(require_login)):
    result = await auto_close_expired_orders()
    return success(result)
