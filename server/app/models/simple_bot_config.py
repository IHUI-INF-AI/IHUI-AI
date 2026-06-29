"""简化智能体配置数据模型.

迁移自 coze_zhs_py/models/simple_bot_config.py.
专门处理 shortcut_commands 循环格式化和 agents_variable 数组存储.
"""

from datetime import datetime
from typing import Any

from loguru import logger
from sqlalchemy import JSON, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import Session

from app.database import Base


class SimpleBotConfig(Base):
    """简化的智能体配置表."""

    __tablename__ = "simple_bot_configs"

    bot_id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    shortcut_commands = Column(JSON)
    agents_variable = Column(JSON)
    other_config = Column(JSON)
    shortcut_count = Column(Integer, default=0)
    variable_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        return {
            "bot_id": self.bot_id,
            "name": self.name,
            "description": self.description,
            "shortcut_commands": self.shortcut_commands or [],
            "agents_variable": self.agents_variable or [],
            "other_config": self.other_config or {},
            "shortcut_count": self.shortcut_count,
            "variable_count": self.variable_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def format_shortcut_commands_for_storage(shortcut_commands: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """格式化 shortcut_commands 用于数据库存储."""
    if not shortcut_commands:
        return []
    result = []
    for i, command in enumerate(shortcut_commands):
        try:
            fc = dict(command) if isinstance(command, dict) else {"value": command}
            if "id" not in fc:
                fc["id"] = f"cmd_{i}"
            if "name" not in fc:
                fc["name"] = f"Command {i + 1}"
            result.append(fc)
        except Exception as e:
            logger.error(f"格式化 shortcut_command {i} 失败: {e}")
            result.append(command)
    return result


def format_agents_variable_for_storage(agents_variable: Any) -> list[dict[str, Any]]:
    """格式化 agents_variable 为数组形式."""
    if not agents_variable:
        return []
    if isinstance(agents_variable, list):
        return agents_variable
    if isinstance(agents_variable, dict):
        result = []
        for key, value in agents_variable.items():
            item = {"name": key, "value": value, "type": type(value).__name__}
            if isinstance(value, dict):
                item.update(value)
                item["type"] = "object"
            elif isinstance(value, list):
                item["type"] = "array"
            result.append(item)
        return result
    return [{"name": "unknown_param", "value": agents_variable, "type": type(agents_variable).__name__}]


class SimpleBotConfigManager:
    """简化的智能体配置管理器."""

    @staticmethod
    def save_bot_config(bot_data: dict[str, Any], session: Session) -> SimpleBotConfig:
        """保存智能体配置到数据库."""
        bot_id = bot_data.get("bot_id", "")
        config = session.query(SimpleBotConfig).filter_by(bot_id=bot_id).first()
        if not config:
            config = SimpleBotConfig(bot_id=bot_id)
            session.add(config)
        config.name = bot_data.get("name", "")
        config.description = bot_data.get("description", "")
        config.shortcut_commands = format_shortcut_commands_for_storage(bot_data.get("shortcut_commands", []))
        config.shortcut_count = len(config.shortcut_commands)
        config.agents_variable = format_agents_variable_for_storage(bot_data.get("agents_variable", []))
        config.variable_count = len(config.agents_variable)
        other = {k: v for k, v in bot_data.items() if k not in ("bot_id", "name", "description", "shortcut_commands", "agents_variable")}
        config.other_config = other
        config.updated_at = datetime.utcnow()
        session.commit()
        return config

    @staticmethod
    def get_bot_config(bot_id: str, session: Session) -> SimpleBotConfig | None:
        return session.query(SimpleBotConfig).filter_by(bot_id=bot_id).first()

    @staticmethod
    def export_bot_config(bot_id: str, session: Session) -> dict[str, Any] | None:
        config = SimpleBotConfigManager.get_bot_config(bot_id, session)
        if not config:
            return None
        result = dict(config.other_config or {})
        result.update({
            "bot_id": config.bot_id,
            "name": config.name,
            "description": config.description,
            "shortcut_commands": config.shortcut_commands,
            "agents_variable": config.agents_variable,
        })
        return result
