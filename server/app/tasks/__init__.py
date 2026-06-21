"""Background tasks -- APScheduler-based periodic jobs."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

scheduler = AsyncIOScheduler()


def init_scheduler():
    """Register all periodic tasks."""
    # Heat stats aggregation -- every hour
    # scheduler.add_job(heat_stats_service.aggregate, 'cron', minute=0)

    # Category sync -- every 6 hours
    # scheduler.add_job(category_service.sync_categories, 'cron', hour='*/6')

    scheduler.start()
    logger.info("APScheduler started")


def shutdown_scheduler():
    """Shut down the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
    logger.info("APScheduler stopped")
