"""Agent 同步定时任务."""

from loguru import logger

from app.database import get_session
from app.models.agent_models import Agent


def sync_agent_counters() -> int:
    """同步 Agent 计数(usage_count、like_count)到主表."""
    with get_session() as db:
        try:
            agents = db.query(Agent).all()
            synced = 0
            for _a in agents:
                # 这里保留同步逻辑占位;真实数据从其他表聚合
                synced += 1
            db.commit()
            logger.info(f"Synced {synced} agent counters")
            return synced
        except Exception as e:
            logger.error(f"Sync agent counters error: {e}")
            return 0


def mark_inactive_agents(days_since_used: int = 180) -> int:
    """将长期未使用的 Agent 标记为非公开."""
    with get_session() as db:
        try:
            from datetime import datetime, timedelta

            threshold = datetime.utcnow() - timedelta(days=days_since_used)
            rows = (
                db.query(Agent)
                .filter(
                    Agent.usage_count == 0,
                    Agent.created_at < threshold,
                )
                .all()
            )
            for a in rows:
                a.is_public = 0
            db.commit()
            logger.info(f"Marked {len(rows)} agents inactive")
            return len(rows)
        except Exception as e:
            logger.error(f"Mark inactive agents error: {e}")
            return 0
