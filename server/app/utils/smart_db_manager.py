"""SmartDBManager - 多数据源统一管理入口.

封装 app/database.py 已有的三套数据库引擎和会话工厂, 提供统一访问 API.
支持按 db_name (db1/db2/db3) 或模型 __bind_key__ 自动路由.
不重复创建引擎, 仅作为统一入口封装现有 SessionFactory1/2/3.

Usage:
    from app.utils.smart_db_manager import smart_db_manager

    # 按名称获取会话 (上下文管理器, 自动提交/回滚/关闭)
    with smart_db_manager.get_session("db1") as db:
        db.query(Model).all()

    # 按模型自动路由 (读取模型 __bind_key__)
    with smart_db_manager.get_session_for_model(User) as db:
        db.query(User).all()

    # 兼容历史 API
    with smart_db_manager.get_users_db() as db:
        ...
    with smart_db_manager.get_user_margin_db() as db:
        ...
"""

from contextlib import contextmanager, suppress
from typing import Any, Generator

from loguru import logger
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import (
    SessionFactory1,
    SessionFactory2,
    SessionFactory3,
    engine1,
    engine2,
    engine3,
)


class SmartDBManager:
    """多数据源统一管理器.

    复用 app/database.py 的 engine1/2/3 和 SessionFactory1/2/3,
    不重复创建引擎, 仅提供统一入口和模型路由能力.
    """

    # db_name -> SessionFactory 映射
    _SESSION_FACTORIES: dict[str, sessionmaker] = {
        "db1": SessionFactory1,
        "db2": SessionFactory2,
        "db3": SessionFactory3,
    }

    # db_name -> Engine 映射
    _ENGINES: dict[str, Engine] = {
        "db1": engine1,
        "db2": engine2,
        "db3": engine3,
    }

    # __bind_key__ / db_name 别名 -> 标准 db_name 映射
    # 兼容历史 bind_key 命名 (ai/center/course) 与新架构 (db1/db2/db3)
    _BIND_KEY_ALIASES: dict[str, str] = {
        "db1": "db1",
        "db2": "db2",
        "db3": "db3",
        "ai": "db1",
        "center": "db2",
        "course": "db3",
        "default": "db1",
    }

    def _resolve_db_name(self, db_name: str | None) -> str:
        """规范化 db_name (小写, 别名转换, 未知值回退 db1)."""
        key = (db_name or "db1").lower()
        return self._BIND_KEY_ALIASES.get(key, "db1")

    def get_engine(self, db_name: str = "db1") -> Engine:
        """获取指定数据库的引擎.

        Args:
            db_name: db1 / db2 / db3 (也接受别名 ai/center/course/default)

        Returns:
            SQLAlchemy Engine
        """
        key = self._resolve_db_name(db_name)
        return self._ENGINES[key]

    def get_session_factory(self, db_name: str = "db1") -> sessionmaker:
        """获取指定数据库的会话工厂.

        Args:
            db_name: db1 / db2 / db3

        Returns:
            sessionmaker
        """
        key = self._resolve_db_name(db_name)
        return self._SESSION_FACTORIES[key]

    @contextmanager
    def get_session(self, db_name: str = "db1") -> Generator[Session, None, None]:
        """获取指定数据库的会话 (上下文管理器, 自动提交/回滚/关闭).

        Args:
            db_name: db1 / db2 / db3

        Usage:
            with smart_db_manager.get_session("db1") as db:
                db.query(Model).all()
        """
        factory = self.get_session_factory(db_name)
        session = factory()
        try:
            yield session
            session.commit()
        except Exception as e:
            with suppress(Exception):
                session.rollback()
            logger.error(f"[SmartDBManager] session error db={db_name}: {e}")
            raise
        finally:
            with suppress(Exception):
                session.close()

    def get_session_for_model(self, model_class: Any):
        """根据模型的 __bind_key__ 自动选择数据库会话 (上下文管理器).

        读取模型类的 __bind_key__ 属性路由到对应数据库;
        未定义 __bind_key__ 时默认使用 db1.

        Args:
            model_class: SQLAlchemy 模型类

        Usage:
            with smart_db_manager.get_session_for_model(User) as db:
                db.query(User).all()
        """
        bind_key = getattr(model_class, "__bind_key__", None)
        db_name = self._resolve_db_name(bind_key) if bind_key else "db1"
        return self.get_session(db_name)

    # ------------------------------------------------------------------
    # 兼容历史 API (coze_zhs_py smart_db_manager)
    # ------------------------------------------------------------------

    @contextmanager
    def get_users_db(self) -> Generator[Session, None, None]:
        """历史 API: 用户库 (映射到 db1)."""
        with self.get_session("db1") as db:
            yield db

    @contextmanager
    def get_user_margin_db(self) -> Generator[Session, None, None]:
        """历史 API: 用户保证金库 (映射到 db2)."""
        with self.get_session("db2") as db:
            yield db

    def get_all_engines(self) -> dict[str, Engine]:
        """返回全部引擎 (db_name -> Engine)."""
        return dict(self._ENGINES)

    def get_all_session_factories(self) -> dict[str, sessionmaker]:
        """返回全部会话工厂 (db_name -> sessionmaker)."""
        return dict(self._SESSION_FACTORIES)


# 全局实例
smart_db_manager = SmartDBManager()
