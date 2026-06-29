"""对账服务 -- 拉取支付宝 / 微信账单,与本地订单对比,输出差异."""

import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from app.telemetry import trace_business
from app.utils.datetime_helper import utcnow

logger = logging.getLogger(__name__)

# 对账结果输出目录 (项目根 / storage / reconcile)
_RECONCILE_DIR = Path(__file__).resolve().parent.parent.parent / "storage" / "reconcile"
_RECONCILE_DIR.mkdir(parents=True, exist_ok=True)


@trace_business("reconcile.alipay", {"biz.type": "payment", "biz.action": "reconcile_alipay"})
async def reconcile_alipay_for(bill_date: str) -> dict:
    """对账:拉取支付宝账单 + 与本地订单对比."""
    from app.utils.alipay_util import reconcile_alipay

    return await reconcile_alipay(bill_date)


@trace_business("reconcile.wechat", {"biz.type": "payment", "biz.action": "reconcile_wechat"})
async def reconcile_wechat_for(bill_date: str) -> dict:
    """对账:拉取微信账单 + 与本地订单对比."""
    from app.services.order_service import list_paid_orders_by_date
    from app.utils.wechat_pay_util import download_bill

    remote = await download_bill(bill_date, "ALL")
    if "download_url" not in remote:
        return {
            "date": bill_date,
            "platform": "wechat",
            "error": remote,
            "local_count": len(list_paid_orders_by_date(bill_date)),
            "remote_count": 0,
        }
    import httpx

    async with httpx.AsyncClient(timeout=30) as client:
        bill_resp = await client.get(remote["download_url"])
    lines = bill_resp.text.splitlines()
    remote_trades = []
    for line in lines:
        parts = line.strip().split(",")
        if len(parts) >= 5 and parts[0].strip().startswith("`") is False:
            remote_trades.append(
                {
                    "out_trade_no": parts[0].strip(),
                    "total_amount": parts[3].strip() if len(parts) > 3 else "",
                    "trade_status": parts[4].strip() if len(parts) > 4 else "",
                }
            )
    local_orders = list_paid_orders_by_date(bill_date)
    local_map = {o["out_trade_no"]: o for o in local_orders}
    remote_map = {t["out_trade_no"]: t for t in remote_trades}
    only_remote = [r for r in remote_trades if r["out_trade_no"] not in local_map]
    only_local = [o for o in local_orders if o["out_trade_no"] not in remote_map]
    return {
        "date": bill_date,
        "platform": "wechat",
        "local_count": len(local_orders),
        "remote_count": len(remote_trades),
        "diff": {
            "only_remote": only_remote[:50],
            "only_local": only_local[:50],
        },
    }


@trace_business("reconcile.all", {"biz.type": "payment", "biz.action": "reconcile_all"})
async def reconcile_all_for(bill_date: str) -> dict:
    """拉取支付宝 + 微信两边账单,输出合并对账结果."""
    ali = await reconcile_alipay_for(bill_date)
    wx = await reconcile_wechat_for(bill_date)
    return {
        "date": bill_date,
        "alipay": ali,
        "wechat": wx,
    }


@trace_business("reconcile.auto_yesterday", {"biz.type": "payment", "biz.action": "auto_reconcile"})
async def auto_reconcile_yesterday() -> dict:
    """对昨天的订单自动对账(供 APScheduler 每日 03:00 调用)."""
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info(f"Auto reconcile for {yesterday}")
    result = await reconcile_all_for(yesterday)
    summary_path = str(_RECONCILE_DIR / f"reconcile_{yesterday}.json")
    try:
        with open(summary_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        logger.info(f"Reconcile summary saved: {summary_path}")
    except Exception as e:
        logger.warning(f"Save reconcile summary failed: {e}")
    return result


def query_pending_orders() -> list[dict]:
    """查询超 30 分钟未支付订单(用于关闭)."""
    from app.database import get_session
    from app.models.payment_models import Order

    with get_session() as db:
        threshold = utcnow() - timedelta(minutes=30)
        orders = (
            db.query(Order)
            .filter(
                Order.payment_status == 0,
                Order.status == 0,
                Order.id.isnot(None),
            )
            .all()
        )
        pending = []
        for o in orders:
            if o.created_at and o.created_at < threshold:
                pending.append(
                    {
                        "id": o.id,
                        "out_trade_no": o.out_trade_no,
                        "amount": o.amount,
                        "pay_type": o.pay_type,
                        "created_at": o.created_at.isoformat(),
                    }
                )
        return pending


@trace_business("reconcile.auto_close_expired", {"biz.type": "payment", "biz.action": "auto_close"})
async def auto_close_expired_orders() -> dict:
    """自动关闭 30 分钟未支付的订单(每 10 分钟跑一次)."""
    pending = query_pending_orders()
    from app.utils import alipay_util, wechat_pay_util

    closed = []
    failed = []
    for p in pending:
        try:
            if p["pay_type"] == "alipay":
                await alipay_util.close_order(p["out_trade_no"])
            elif p["pay_type"] in ("wechat", "wechat_android", "wechat_course"):
                await wechat_pay_util.close_order(p["out_trade_no"])
            from app.services.order_service import update_order_status

            update_order_status(p["out_trade_no"], status=4, payment_status=4)
            closed.append(p["out_trade_no"])
        except Exception as e:
            failed.append({"out_trade_no": p["out_trade_no"], "error": str(e)})
    return {
        "scanned": len(pending),
        "closed": closed,
        "failed": failed,
    }
