"""Agent 同步定时任务.

2026-06-29 收尾: 修复假同步 — sync_agent_counters 现在从 agent_heat_stats 表
聚合 hit_count 到 Agent.usage_count, 而非仅计数遍历.
"""

from loguru import logger
from sqlalchemy import func

from app.database import get_session
from app.models.agent_models import Agent, AgentHeatStats


def sync_agent_counters() -> int:
    """同步 Agent 计数(usage_count)从 agent_heat_stats 聚合到主表.

    从 AgentHeatStats 表按 agent_id 聚合 hit_count 总和,
    更新到对应 Agent.usage_count 字段.
    """
    with get_session() as db:
        try:
            # 按 agent_id 聚合 hit_count
            heat_stats = (
                db.query(
                    AgentHeatStats.agent_id,
                    func.sum(AgentHeatStats.hit_count).label("total_hits"),
                )
                .group_by(AgentHeatStats.agent_id)
                .all()
            )

            synced = 0
            for stat in heat_stats:
                agent = (
                    db.query(Agent)
                    .filter(Agent.agent_id == stat.agent_id)
                    .first()
                )
                if agent:
                    agent.usage_count = stat.total_hits or 0
                    synced += 1

            db.commit()
            logger.info(f"Synced {synced} agent counters from agent_heat_stats")
            return synced
        except Exception as e:
            db.rollback()
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
            db.rollback()
            logger.error(f"Mark inactive agents error: {e}")
            return 0
