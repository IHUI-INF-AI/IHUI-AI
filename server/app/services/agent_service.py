"""Agent management service."""

import logging
import uuid

from app.database import get_session
from app.models.agent_models import Agent

logger = logging.getLogger(__name__)


def get_agent(agent_id: str) -> dict | None:
    """Get a single agent by ID."""
    with get_session() as db:
        a = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        if not a:
            return None
        return {
            "agent_id": a.agent_id,
            "agent_name": a.agent_name,
            "bot_id": a.bot_id,
            "user_id": a.user_id,
            "publish_status": a.publish_status,
            "usage_count": a.usage_count,
        }


def list_agents(
    page: int = 1,
    limit: int = 20,
    user_id: str | None = None,
    status: int | None = None,
    keyword: str | None = None,
) -> dict:
    """List agents with optional filters."""
    with get_session() as db:
        q = db.query(Agent)
        if user_id:
            q = q.filter(Agent.user_id == user_id)
        if status is not None:
            q = q.filter(Agent.publish_status == status)
        if keyword:
            q = q.filter(Agent.agent_name.like(f"%{keyword}%"))
        total = q.count()
        agents = q.order_by(Agent.agent_id.desc()).offset((page - 1) * limit).limit(limit).all()
        return {
            "total": total,
            "data": [
                {
                    "agent_id": a.agent_id,
                    "agent_name": a.agent_name,
                    "bot_id": a.bot_id,
                    "publish_status": a.publish_status,
                    "usage_count": a.usage_count,
                }
                for a in agents
            ],
        }


def create_agent(
    user_id: str,
    agent_name: str,
    bot_id: str | None = None,
    agent_prompt: str | None = None,
    **kwargs,
) -> dict:
    """Create a new agent."""
    with get_session() as db:
        agent = Agent(
            agent_id=str(uuid.uuid4()),
            agent_name=agent_name,
            bot_id=bot_id or "",
            user_id=user_id,
            agent_prompt=agent_prompt or "",
            publish_status=0,
            usage_count=0,
        )
        for k, v in kwargs.items():
            if hasattr(agent, k):
                setattr(agent, k, v)
        db.add(agent)
        return {"success": True, "agent_id": agent.agent_id}


def update_agent(agent_id: str, **kwargs) -> dict:
    """Update an existing agent."""
    with get_session() as db:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        if not agent:
            return {"success": False, "msg": "Agent not found"}
        for k, v in kwargs.items():
            if hasattr(agent, k) and v is not None:
                setattr(agent, k, v)
        return {"success": True}


def delete_agent(agent_id: str) -> dict:
    """Delete an agent."""
    with get_session() as db:
        agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
        if not agent:
            return {"success": False, "msg": "Agent not found"}
        db.delete(agent)
        return {"success": True}
