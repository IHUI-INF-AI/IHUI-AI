"""分类数据同步工具.

迁移自 coze_zhs_py/utils/category_sync_tool.py.
将 zhs_agent_category 表数据同步到 agents 表冗余字段.
"""

from datetime import datetime
from typing import Any

from loguru import logger
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_session
from app.models.activity_models import AgentCategory
from app.models.agent_models import Agent


class CategorySyncTool:
    """分类数据同步工具."""

    @staticmethod
    def sync_all_categories(db: Session | None = None) -> dict[str, Any]:
        """同步所有分类数据从 zhs_agent_category 到 agents 表."""
        result = {"success": 0, "errors": 0, "total": 0, "message": ""}
        should_close = db is None
        try:
            if db is None:
                db = next(get_session())
            categories = db.query(AgentCategory).limit(500).all()
            result["total"] = len(categories)
            for category in categories:
                try:
                    agent = db.query(Agent).filter(Agent.agent_id == category.agent_id).first()
                    if agent:
                        agent.category_synced_at = datetime.now()
                        result["success"] += 1
                except Exception as e:
                    result["errors"] += 1
                    logger.error(f"同步智能体 {category.agent_id} 失败: {e}")
            db.commit()
            result["message"] = f"成功 {result['success']}, 失败 {result['errors']}"
        except Exception as e:
            logger.error(f"同步分类数据失败: {e}")
            result["message"] = f"同步失败: {e}"
        finally:
            if should_close and db:
                db.close()
        return result

    @staticmethod
    def check_sync_status(db: Session | None = None) -> dict[str, Any]:
        """检查同步状态."""
        should_close = db is None
        try:
            if db is None:
                db = next(get_session())
            total = db.query(AgentCategory).count()
            synced = db.execute(text("SELECT COUNT(DISTINCT agent_id) FROM agents WHERE category_synced_at IS NOT NULL")).scalar() or 0
            return {"total": total, "synced": synced, "unsynced": total - synced}
        except Exception as e:
            logger.error(f"检查同步状态失败: {e}")
            return {"total": 0, "synced": 0, "unsynced": 0}
        finally:
            if should_close and db:
                db.close()


_tool: CategorySyncTool | None = None


def get_category_sync_tool() -> CategorySyncTool:
    global _tool
    if _tool is None:
        _tool = CategorySyncTool()
    return _tool
