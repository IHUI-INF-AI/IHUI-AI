"""智能体权限检查器.

迁移自 coze_zhs_py/utils/agent_permission_checker.py.
"""

from typing import Any

from loguru import logger
from sqlalchemy.orm import Session

from app.models.activity_models import AgentCategory
from app.models.user_models import User


class AgentPermissionChecker:
    """智能体权限检查器."""

    @staticmethod
    def _determine_permission(agent_group: int, user_vip_status: int) -> dict[str, Any]:
        """根据智能体群体和用户 VIP 状态确定访问权限."""
        if agent_group == 1 and user_vip_status == 0:
            return {
                "has_permission": False,
                "reason": "该智能体仅限会员使用",
                "should_show_vip": True,
            }
        return {"has_permission": True, "reason": "", "should_show_vip": False}

    @staticmethod
    def check_user_vip_status(user_uuid: str | None, user_db: Session) -> dict[str, Any]:
        """检查用户 VIP 状态."""
        result = {"is_vip": 0, "user_type": "普通用户", "exists": False}
        if not user_uuid or not user_uuid.strip():
            return result
        try:
            user = user_db.query(User).filter(User.uuid == user_uuid.strip()).first()
            if user:
                result["exists"] = True
                result["is_vip"] = user.is_vip if user.is_vip is not None else 0
                result["user_type"] = "会员用户" if result["is_vip"] in (1, 2) else "普通用户"
        except Exception as e:
            logger.error(f"查询用户 VIP 状态失败: uuid={user_uuid}, error={e}")
        return result

    @staticmethod
    def check_agent_group(agent_id: str, db: Session) -> dict[str, Any]:
        """检查智能体面向群体."""
        result = {"group": 2, "group_desc": "面向全部用户", "exists": False}
        try:
            category = db.query(AgentCategory).filter(AgentCategory.agent_id == agent_id).first()
            if category and category.group is not None:
                result["exists"] = True
                try:
                    result["group"] = int(category.group)
                except (ValueError, TypeError):
                    result["group"] = 2
                result["group_desc"] = "面向会员" if result["group"] == 1 else "面向全部用户"
        except Exception as e:
            logger.error(f"查询智能体群体配置失败: agent_id={agent_id}, error={e}")
        return result

    @staticmethod
    def has_access_permission(
        user_uuid: str | None,
        agent_id: str,
        user_db: Session,
        agent_db: Session,
    ) -> dict[str, Any]:
        """综合权限检查."""
        try:
            user_status = AgentPermissionChecker.check_user_vip_status(user_uuid, user_db)
            agent_group = AgentPermissionChecker.check_agent_group(agent_id, agent_db)
            perm = AgentPermissionChecker._determine_permission(agent_group["group"], user_status["is_vip"])
            return {
                "has_permission": perm["has_permission"],
                "reason": perm["reason"],
                "user_type": user_status["user_type"],
                "agent_group": agent_group["group_desc"],
                "should_show_vip": perm["should_show_vip"],
                "user_vip_status": user_status["is_vip"],
                "agent_group_code": agent_group["group"],
            }
        except Exception as e:
            logger.error(f"权限检查失败: agent_id={agent_id}, user_uuid={user_uuid}, error={e}")
            return {
                "has_permission": True,
                "reason": "",
                "user_type": "普通用户",
                "agent_group": "面向全部用户",
                "should_show_vip": False,
                "user_vip_status": 0,
                "agent_group_code": 2,
            }


def check_agents_permissions(
    agents_data: list[dict[str, Any]],
    user_uuid: str | None,
    user_db: Session,
    agent_db: Session,
) -> list[dict[str, Any]]:
    """批量检查智能体权限."""
    for agent in agents_data:
        agent_id = agent.get("id") or agent.get("agent_id")
        if not agent_id:
            continue
        perm = AgentPermissionChecker.has_access_permission(user_uuid, str(agent_id), user_db, agent_db)
        agent["has_permission"] = perm["has_permission"]
        agent["permission_reason"] = perm["reason"]
        agent["should_show_vip"] = perm["should_show_vip"]
    return agents_data
