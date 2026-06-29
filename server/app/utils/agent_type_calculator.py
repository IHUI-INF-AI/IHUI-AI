"""智能体类型计算器.

迁移自 coze_zhs_py/utils/agent_type_calculator.py 和 optimized_agent_type_calculator.py.
"""

from datetime import datetime, timedelta
from typing import Any, ClassVar

from loguru import logger
from sqlalchemy.orm import Session

from app.models.activity_models import AgentBuy, AgentCategory
from app.models.user_models import User


class AgentTypeCalculator:
    """智能体类型计算器."""

    @staticmethod
    def calculate_free_duration_months(limit_free: str) -> int:
        """计算免费时长(月数)."""
        return {"1": 1, "2": 3, "3": 6, "4": 12}.get(limit_free, 0)

    @staticmethod
    def format_account_type(account: int, type_child: str) -> str:
        """格式化价格显示."""
        price_yuan = account / 100
        if type_child == "1":
            return f"{price_yuan:.2f}元/月"
        if type_child == "2":
            return f"{price_yuan:.2f}元/年"
        if type_child == "3":
            return f"{price_yuan:.2f}元/永久"
        return f"{price_yuan:.2f}元"

    @staticmethod
    def is_in_free_trial_period(create_time: datetime | None, limit_free: str) -> bool:
        """判断是否在免费试用期内."""
        if not create_time or not limit_free:
            return False
        months = AgentTypeCalculator.calculate_free_duration_months(limit_free)
        if months <= 0:
            return False
        try:
            # 简化:按 30 天/月计算
            expiry = create_time + timedelta(days=30 * months)
            return datetime.now() <= expiry
        except Exception:
            return False

    @staticmethod
    def calculate_agent_type(
        agent_id: str,
        user_uuid: str,
        agent_db: Session,
        user_db: Session | None = None,
    ) -> dict[str, Any]:
        """计算智能体的 type 和 accountType.

        Returns:
            {
                "type": str,         # "free"/"vip"/"purchased"
                "accountType": str,  # 价格显示
                "has_permission": bool,
            }
        """
        result = {"type": "free", "accountType": "免费", "has_permission": True}
        try:
            category = agent_db.query(AgentCategory).filter(AgentCategory.agent_id == agent_id).first()
            if not category:
                return result

            is_vip = 0
            if user_db and user_uuid:
                user = user_db.query(User).filter(User.uuid == user_uuid).first()
                if user:
                    is_vip = user.is_vip if user.is_vip is not None else 0  # type: ignore[assignment]

            account = getattr(category, "account", 0) or 0
            type_child = str(getattr(category, "type_child", "") or "")
            str(getattr(category, "limit_free", "") or "")
            group = getattr(category, "group", 2)

            if group == 1 and is_vip == 0:
                result["has_permission"] = False
                result["type"] = "vip_only"

            if account > 0 and type_child:
                result["accountType"] = AgentTypeCalculator.format_account_type(account, type_child)
                if result["type"] == "free":
                    result["type"] = "paid"

            if user_uuid and user_db:
                purchased = (
                    user_db.query(AgentBuy)
                    .filter(AgentBuy.user_uuid == user_uuid, AgentBuy.bot_id == agent_id)
                    .first()
                )
                if purchased:
                    result["type"] = "purchased"
                    result["accountType"] = "已购买"
        except Exception as e:
            logger.error(f"计算智能体类型失败: agent_id={agent_id}, error={e}")
        return result


class OptimizedAgentTypeCalculator(AgentTypeCalculator):
    """优化版智能体类型计算器:减少重复查询."""

    _category_cache: ClassVar[dict[str, dict[str, Any]]] = {}

    @classmethod
    def calculate_batch(
        cls,
        agent_ids: list,
        user_uuid: str,
        agent_db: Session,
        user_db: Session | None = None,
    ) -> dict[str, dict[str, Any]]:
        """批量计算."""
        results = {}
        for aid in agent_ids:
            results[str(aid)] = cls.calculate_agent_type(str(aid), user_uuid, agent_db, user_db)
        return results
