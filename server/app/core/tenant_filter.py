"""SQLAlchemy 动态 search_path 路由 (建议 102 阶段 1).

纵深防御层:
  1. SQLAlchemy before_cursor_execute event hook (本文件, 应用层强制)
  2. PG schema 物理隔离 (DB 层强制, schema 本身就是边界)
  3. ORM Model __table_args__["schema"] 显式声明 (设计层, 阶段 2 引入)

单租户模式 (默认) 不注册, 行为与单库模式 100% 一致 -- 后向兼容.
"""

import contextlib
import logging

from sqlalchemy import event
from sqlalchemy.engine import Engine

from app.core.tenant import (
    get_current_tenant_id,
    get_tenant_schema_name,
    is_multi_tenant_enabled,
)

logger = logging.getLogger(__name__)

# 内部开关: 防止重复注册 (event.listen 多次调用会重复触发)
_engine_registered: set = set()


def _set_search_path(conn, cursor, statement, parameters, context, executemany):
    """before_cursor_execute hook: 在每条 SQL 前 SET LOCAL search_path.

    只在:
      - 多租户模式开启 (MULTI_TENANT_ENABLED=true)
      - 当前请求有 tenant_id
    时切 search_path. 单租户模式 / 后台任务走默认 (public).
    """
    if not is_multi_tenant_enabled():
        return
    tid = get_current_tenant_id()
    if tid is None:
        return
    schema = get_tenant_schema_name(tid)
    # SET LOCAL 仅在当前事务内生效, 事务结束自动恢复, 防跨租户污染
    cursor.execute(f'SET LOCAL search_path TO "{schema}", public')


def register_tenant_routing(engine: Engine) -> bool:
    """给 engine 注册 before_cursor_execute 钩子.

    Returns: True 表示本次注册成功, False 表示跳过 (单租户 / 已注册)
    """
    if not is_multi_tenant_enabled():
        return False
    if id(engine) in _engine_registered:
        return False
    event.listen(engine, "before_cursor_execute", _set_search_path)
    _engine_registered.add(id(engine))
    logger.info("[tenant] search_path router registered for engine %s", engine)
    return True


def unregister_tenant_routing(engine: Engine) -> bool:
    """卸载已注册的钩子 (测试 / 重启用)."""
    if id(engine) not in _engine_registered:
        return False
    with contextlib.suppress(Exception):
        event.remove(engine, "before_cursor_execute", _set_search_path)
    _engine_registered.discard(id(engine))
    return True


def reset_registration_state() -> None:
    """清空注册表 (测试 fixture / pytest 隔离用)."""
    _engine_registered.clear()


def get_registration_count() -> int:
    """返回已注册 engine 数量 (监控 / 健康检查)."""
    return len(_engine_registered)
