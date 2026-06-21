"""APScheduler task definitions."""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler():
    """Register all scheduled tasks and start the scheduler."""
    # Heat stats aggregation - every hour
    scheduler.add_job(
        task_update_heat_stats,
        "interval",
        hours=1,
        id="heat_stats_hourly",
        replace_existing=True,
    )
    # Heat aggregation summary - daily
    scheduler.add_job(
        task_aggregate_daily_heat,
        "cron",
        hour=2,
        minute=0,
        id="heat_aggregate_daily",
        replace_existing=True,
    )
    # Old heat cleanup - daily
    scheduler.add_job(
        task_cleanup_old_heat,
        "cron",
        hour=3,
        minute=0,
        id="heat_cleanup_daily",
        replace_existing=True,
    )
    # Agent sync - every 30 minutes
    scheduler.add_job(
        task_sync_agents,
        "interval",
        minutes=30,
        id="agent_sync",
        replace_existing=True,
    )
    # Agent counter sync - hourly
    scheduler.add_job(
        task_sync_agent_counters,
        "interval",
        hours=1,
        id="agent_counter_sync",
        replace_existing=True,
    )
    # Expire agent purchases - every 10 minutes
    scheduler.add_job(
        task_expire_agents,
        "interval",
        minutes=10,
        id="expire_agents",
        replace_existing=True,
    )
    # Order timeout check - every 5 minutes
    scheduler.add_job(
        task_check_expired_orders,
        "interval",
        minutes=5,
        id="order_timeout_check",
        replace_existing=True,
    )
    # Payment reconciliation - daily at 03:30
    scheduler.add_job(
        task_reconcile_yesterday,
        "cron",
        hour=3,
        minute=30,
        id="payment_reconcile_daily",
        replace_existing=True,
    )
    # Close expired unpaid orders - every 10 minutes
    scheduler.add_job(
        task_close_expired_orders,
        "interval",
        minutes=10,
        id="close_expired_orders",
        replace_existing=True,
    )
    # Phase 9: 告警噪音分析 + 抑制工单生成 (建议 2)
    # 每日 04:00 跑, 避开 02:00 heat 聚合 / 03:00 cleanup / 03:30 对账
    scheduler.add_job(
        task_alert_noise_inhibit_ticket,
        "cron",
        hour=4,
        minute=0,
        id="alert_noise_inhibit_ticket_daily",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started with scheduled jobs")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")


async def task_update_heat_stats():
    """Aggregate agent heat stats."""
    from app.services.heat_stats_service import aggregate_heat_stats

    try:
        aggregate_heat_stats()
        logger.debug("Heat stats aggregated")
    except Exception as e:
        logger.error(f"Heat stats task error: {e}")


async def task_aggregate_daily_heat():
    from app.tasks.heat_stats_task import aggregate_daily_heat

    try:
        result = aggregate_daily_heat(days=7)
        logger.info(f"Daily heat aggregated: {result}")
    except Exception as e:
        logger.error(f"Aggregate daily heat error: {e}")


async def task_cleanup_old_heat():
    from app.tasks.heat_stats_task import cleanup_old_heat

    try:
        deleted = cleanup_old_heat(days_to_keep=90)
        logger.info(f"Old heat cleaned: {deleted}")
    except Exception as e:
        logger.error(f"Cleanup old heat error: {e}")


async def task_sync_agents():
    """Sync agent data from Coze."""
    from app.tasks.agent_sync import sync_agent_counters

    try:
        sync_agent_counters()
        logger.debug("Agent sync done")
    except Exception as e:
        logger.error(f"Agent sync error: {e}")


async def task_sync_agent_counters():
    from app.tasks.agent_sync import sync_agent_counters

    try:
        synced = sync_agent_counters()
        logger.info(f"Synced {synced} agent counters")
    except Exception as e:
        logger.error(f"Agent counter sync error: {e}")


async def task_expire_agents():
    from app.tasks.expiration_monitor import expire_agents

    try:
        count = expire_agents()
        logger.info(f"Expired {count} agent purchases")
    except Exception as e:
        logger.error(f"Expire agents error: {e}")


async def task_check_expired_orders():
    """Cancel expired unpaid orders."""
    from datetime import timedelta

    from app.database import get_session
    from app.models.payment_models import Order
    from app.utils.datetime_helper import utcnow

    with get_session() as db:
        try:
            cutoff = utcnow() - timedelta(minutes=30)
            expired = db.query(Order).filter(Order.status == 0, Order.created_at < cutoff).all()
            for order in expired:
                order.status = 3  # cancelled
            if expired:
                logger.info(f"Cancelled {len(expired)} expired orders")
        except Exception as e:
            logger.error(f"Order timeout check error: {e}")


async def task_reconcile_yesterday():
    """对昨天的订单做双边对账."""
    from app.services.reconciliation_service import auto_reconcile_yesterday

    try:
        result = await auto_reconcile_yesterday()
        logger.info(
            f"Reconcile done: alipay={result.get('alipay', {}).get('local_count', 0)} local / "
            f"wechat={result.get('wechat', {}).get('local_count', 0)} local"
        )
    except Exception as e:
        logger.error(f"Reconcile task error: {e}")


async def task_close_expired_orders():
    """关闭超时未支付订单(调支付宝/微信关闭接口)."""
    from app.services.reconciliation_service import auto_close_expired_orders

    try:
        result = await auto_close_expired_orders()
        if result["scanned"]:
            logger.info(f"Closed {len(result['closed'])} / failed {len(result['failed'])} orders")
    except Exception as e:
        logger.error(f"Close expired orders error: {e}")


async def task_alert_noise_inhibit_ticket():
    """Phase 9 建议 2: 每日告警噪音分析 + 抑制建议工单 (dry-run).

    复用 scripts/ops/analyze_alert_noise + generate_inhibit_ticket 链路.
    生产环境通过 ALERTMANAGER_URL 注入真实 AM 地址, 缺省回退 mock 模式.
    输出:
      - logs/inhibit_tickets/<YYYYMMDD>.md (供人 review)
      - logs/inhibit_tickets/<YYYYMMDD>.json (供下游消费)
    """
    import os as _os
    import subprocess as _sp
    from pathlib import Path as _P

    repo_root = _P(__file__).resolve().parent.parent.parent
    am_url = _os.environ.get("ALERTMANAGER_URL", "")
    try:
        cmd = ["python", "scripts/ops/generate_inhibit_ticket.py"]
        if am_url:
            cmd += ["--alertmanager-url", am_url]
        else:
            cmd += ["--mock"]
        result = _sp.run(cmd, cwd=str(repo_root), capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            logger.info(
                f"Alert noise inhibit ticket generated (am_url={'real' if am_url else 'mock'}), "
                f"stdout 末行: {result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''}"
            )
        else:
            logger.error(f"Alert noise inhibit ticket failed rc={result.returncode}, stderr: {result.stderr[-500:]}")
    except Exception as e:
        logger.error(f"Alert noise inhibit ticket error: {e}")
