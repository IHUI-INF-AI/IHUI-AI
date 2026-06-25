"""Avatar sync service."""


from loguru import logger

from app.database import SessionFactory1
from app.models.activity_models import AgentExamine
from app.models.agent_models import Agent
from app.utils.datetime_helper import utcnow


class AvatarSyncService:
    """Sync agent avatars to examine table."""

    def __init__(self):
        self.logger = logger

    def sync_avatar_to_examine_table(self, agent_id, agent_avatar, agent_name=None, db=None):
        """Sync agent avatar to examine table."""
        should_close_db = False
        if db is None:
            db = SessionFactory1()
            should_close_db = True
        try:
            logger.info(f"Syncing avatar: agent_id={agent_id}")
            if not agent_name:
                agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
                if agent:
                    agent_name = agent.agent_name
            existing = (
                db.query(AgentExamine)
                .filter(AgentExamine.agent_id == agent_id)
                .order_by(AgentExamine.start_time.desc())
                .all()
            )
            if not existing:
                return self._create_new(db, agent_id, agent_avatar, agent_name)
            return self._update_existing(db, existing, agent_avatar, agent_name)
        except Exception as e:
            logger.error(f"Sync avatar failed: {e}")
            if should_close_db:
                db.rollback()
            raise
        finally:
            if should_close_db:
                db.close()

    def _create_new(self, db, agent_id, agent_avatar, agent_name):
        now = utcnow()
        from sqlalchemy import text

        r = db.execute(text("SELECT COALESCE(MAX(id), 0) + 1 FROM zhs_agent_examine")).first()
        next_id = r[0] if r else 1
        rec = AgentExamine(
            id=next_id,
            agent_id=agent_id,
            agent_name=agent_name or f"agent_{agent_id}",
            agent_avatar=agent_avatar,
            status=0,
            start_time=now,
            desc="Avatar synced",
            follow=f"[{now.isoformat()}] Avatar synced to examine table",
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        return {"action": "create", "record_id": str(rec.id), "agent_id": agent_id}

    def _update_existing(self, db, records, agent_avatar, agent_name):
        now = utcnow()
        count = 0
        for r in records:
            r.agent_avatar = agent_avatar
            if agent_name and agent_name != r.agent_name:
                r.agent_name = agent_name
            note = f"[{now.isoformat()}] synced = {agent_avatar}"
            r.follow = (r.follow or "") + note
            count += 1
        db.commit()
        aid = records[0].agent_id if records else None
        return {"action": "update", "updated_count": count, "agent_id": aid}

    def sync_avatar_from_agent_table(self, agent_id, db=None):
        """Sync avatar from agent table to examine table."""
        should_close = db is None
        if should_close:
            db = SessionFactory1()
        try:
            agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
            if not agent:
                return {"success": False, "message": f"Agent not found: {agent_id}"}
            if not agent.agent_avatar:
                return {"success": False, "message": f"Agent avatar empty: {agent_id}"}
            result = self.sync_avatar_to_examine_table(
                agent_id=agent_id, agent_avatar=agent.agent_avatar, agent_name=agent.agent_name, db=db
            )
            result["success"] = True
            return result
        except Exception as e:
            logger.error(f"Sync avatar failed: {e}")
            return {"success": False, "message": str(e)}
        finally:
            if should_close:
                db.close()


# 模块级单例
avatar_sync_service = AvatarSyncService()
