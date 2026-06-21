"""Category service -- agent categories CRUD."""

import logging

from app.database import get_session

logger = logging.getLogger(__name__)


def get_categories(group: str | None = None) -> list:
    """Get agent categories, optionally filtered by group."""
    with get_session() as db:
        from app.models.activity_models import AgentCategory

        q = db.query(AgentCategory)
        if group:
            q = q.filter(AgentCategory.group == group)
        items = q.all()
        return [
            {
                "id": c.id,
                "agent_id": c.agent_id,
                "group": c.group,
                "type": c.type,
                "type_child": c.type_child,
                "limit_free": c.limit_free,
            }
            for c in items
        ]


async def start():
    logger.info("Category service started")


async def stop():
    logger.info("Category service stopped")
