"""分类转换工具.

迁移自 coze_zhs_py/utils/category_converter.py.
"""

from typing import Any

from loguru import logger

from app.services.agent_category_dict_cache import get_agent_category_dict_cache


class CategoryConverter:
    """分类转换器."""

    @staticmethod
    def convert_agent_categories(agents_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量转换智能体列表中的分类 ID 为名称."""
        if not agents_list:
            return agents_list
        try:
            cache = get_agent_category_dict_cache()
            for agent in agents_list:
                main = agent.get("agent_main_category", "")
                if main:
                    agent["agent_main_category_name"] = cache.convert_ids_to_names(str(main), "0")
                sub = agent.get("agent_category", "")
                if sub:
                    agent["agent_category_name"] = cache.convert_ids_to_names(str(sub), "1")
                custom = agent.get("agent_custom_category", "")
                if custom:
                    agent["agent_custom_category_name"] = cache.convert_ids_to_names(str(custom), "2")
        except Exception as e:
            logger.error(f"分类转换失败: {e}")
        return agents_list

    @staticmethod
    def convert_single(agent: dict[str, Any]) -> dict[str, Any]:
        return CategoryConverter.convert_agent_categories([agent])[0] if agent else agent
