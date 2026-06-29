"""Heat stats service -- aggregates agent traffic stats."""

import contextlib
import logging
from datetime import datetime

# 在模块级暴露 SessionFactory1, 便于测试 monkeypatch
from app.database import SessionFactory1

logger = logging.getLogger(__name__)


def aggregate_heat_stats():
    """Aggregate daily heat stats for all agents."""
    db = SessionFactory1()
    try:
        from app.models.agent_models import AgentHeatStats

        date_str = datetime.now().strftime("%Y-%m-%d")
        existing = db.query(AgentHeatStats).filter(AgentHeatStats.date_str == date_str).count()
        logger.info(f"Heat stats for {date_str}: {existing} records")
        return existing
    finally:
        with contextlib.suppress(Exception):
            db.close()


async def start():
    """生命周期: 启动 heat stats 后台任务."""
    logger.info("heat_stats_service started")
    return True


async def stop():
    """生命周期: 停止 heat stats 后台任务."""
    logger.info("heat_stats_service stopped")
    return True


async def increment_hit(agent_id: str, date_str: str | None = None):
    """Increment hit count for an agent on a given date."""
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    logger.debug(f"Incrementing hit for agent {agent_id} on {date_str}")
    db = SessionFactory1()
    try:
        from app.models.agent_models import AgentHeatStats

        stat = (
            db.query(AgentHeatStats)
            .filter(
                AgentHeatStats.agent_id == agent_id,
                AgentHeatStats.date_str == date_str,
            )
            .first()
        )
        if stat:
            stat.hit_count = (stat.hit_count or 0) + 1  # type: ignore[assignment]
        else:
            stat = AgentHeatStats(
                agent_id=agent_id,
                date_str=date_str,
                hit_count=1,
            )
            db.add(stat)
        db.commit()
    finally:
        with contextlib.suppress(Exception):
            db.close()
    return True
