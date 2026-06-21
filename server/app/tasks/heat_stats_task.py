"""Agent 热度统计定时任务."""

from datetime import date, timedelta

from loguru import logger

from app.database import get_session
from app.models.agent_models import AgentHeatStats


def aggregate_daily_heat(days: int = 7) -> dict:
    """聚合最近 N 天热度数据,返回每日总量."""
    with get_session() as db:
        cutoff = (date.today() - timedelta(days=days)).isoformat()
        rows = db.query(AgentHeatStats).filter(AgentHeatStats.date_str >= cutoff).all()
        daily = {}
        for r in rows:
            daily[r.date_str] = daily.get(r.date_str, 0) + int(r.hit_count or 0)
        logger.info(f"Heat aggregation done: {len(daily)} days")
        return {"days": days, "daily": daily}


def cleanup_old_heat(days_to_keep: int = 90) -> int:
    """清理 N 天前的热度数据."""
    with get_session() as db:
        cutoff = (date.today() - timedelta(days=days_to_keep)).isoformat()
        deleted = db.query(AgentHeatStats).filter(AgentHeatStats.date_str < cutoff).delete()
        logger.info(f"Cleaned up {deleted} old heat records")
        return deleted
