"""Agent 过期监控定时任务."""

from datetime import timedelta

from loguru import logger

from app.database import get_session
from app.models.activity_models import AgentBuy
from app.utils.datetime_helper import utcnow


def expire_agents(grace_days: int = 0) -> int:
    """将过期但仍 active 的 Agent 购买记录标记为 expired."""
    try:
        with get_session() as db:
            now = utcnow()
            expire_before = now - timedelta(days=grace_days)
            q = db.query(AgentBuy).filter(
                AgentBuy.status == "0",
                AgentBuy.expiration_date is not None,
                AgentBuy.expiration_date < expire_before,
            )
            count = 0
            for record in q.all():
                record.status = "1"
                count += 1
            logger.info(f"Expired {count} agent purchases")
            return count
    except Exception as e:
        logger.error(f"Expire agents error: {e}")
        return 0


def remind_expiring_soon(hours_before: int = 24) -> list:
    """查询即将过期(24h 内)的 Agent 列表."""
    with get_session() as db:
        now = utcnow()
        soon = now + timedelta(hours=hours_before)
        rows = (
            db.query(AgentBuy)
            .filter(
                AgentBuy.status == "0",
                AgentBuy.expiration_date is not None,
                AgentBuy.expiration_date >= now,
                AgentBuy.expiration_date <= soon,
            )
            .all()
        )
        return [
            {
                "order_no": r.order_no,
                "agent_id": r.agent_id,
                "agent_name": r.agent_name,
                "expiration_date": (r.expiration_date.isoformat() if r.expiration_date else None),
                "bug_uuid": r.bug_uuid,
            }
            for r in rows
        ]
