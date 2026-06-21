"""智能体分类字典缓存服务.

迁移自 coze_zhs_py/services/agent_category_dict_cache.py.
"""

from datetime import datetime
from typing import Any

from loguru import logger
from sqlalchemy import text

from app.database import get_session


class AgentCategoryDictCache:
    """智能体分类字典内存缓存管理器."""

    def __init__(self):
        self._cache: dict[str, dict[str, Any]] = {}
        self._type_cache: dict[str, dict[str, str]] = {}
        self._last_updated: datetime | None = None
        self._is_loaded = False

    def load_from_db(self) -> int:
        """从数据库加载分类字典数据."""
        with get_session() as db:
            try:
                rows = db.execute(text("""
                    SELECT id, name, code, show_name, parent_id, is_hidden, is_use,
                           status, sort, field1, field2, but_url
                    FROM agent_category
                    WHERE status = 1
                """)).mappings().all()
                self._cache.clear()
                self._type_cache.clear()
                for row in rows:
                    d = dict(row)
                    self._cache[str(d.get("id"))] = d
                    f2 = str(d.get("field2") or "0")
                    if f2 not in self._type_cache:
                        self._type_cache[f2] = {}
                    self._type_cache[f2][str(d.get("id"))] = d.get("show_name") or d.get("name") or ""
                self._is_loaded = True
                self._last_updated = datetime.now()
                return len(self._cache)
            except Exception as e:
                logger.error(f"加载分类字典失败: {e}")
                return 0

    def convert_ids_to_names(self, ids_str: str, field2: str = "0") -> str:
        """将分类 ID 字符串转换为名称字符串."""
        if not self._is_loaded:
            self.load_from_db()
        if not ids_str:
            return ""
        type_map = self._type_cache.get(str(field2), {})
        names = []
        for raw_id in ids_str.split(","):
            cid = str(raw_id).strip()
            if not cid:
                continue
            names.append(type_map.get(cid, cid))
        return ",".join(names)

    def get_cache_info(self) -> dict[str, Any]:
        return {
            "is_loaded": self._is_loaded,
            "total_count": len(self._cache),
            "last_updated": self._last_updated.isoformat() if self._last_updated else None,
        }


_cache_instance: AgentCategoryDictCache | None = None


def get_agent_category_dict_cache() -> AgentCategoryDictCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = AgentCategoryDictCache()
        _cache_instance.load_from_db()
    return _cache_instance
