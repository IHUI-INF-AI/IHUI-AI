"""多租户模式启用示例 (Multi-Tenant Schema Isolation).

架构:
  PostgreSQL 单库 + 多 schema:
    - public  schema: 公共表 (admin_config, hot_config 等)
    - tenant_{tid} schema: 每个租户的私有表 (users, products, orders 等)

使用步骤:

1. 启用多租户 (settings.MULTI_TENANT_ENABLED=True)
2. 为新租户初始化 schema:
   >>> from app.scripts.init_tenant_schema import init_tenant_schema
   >>> init_tenant_schema(tid=2)  # 创建 tenant_2 schema + 所有私有表
3. 业务模型继承 TenantBase, 声明 __tenant_schema__ = "contextvar"
4. 在请求入口从 JWT 解析 tid, 写入 ContextVar
5. SQLAlchemy 自动切 search_path 到 tenant_{tid}, 数据完全隔离
"""

from __future__ import annotations

import logging

from sqlalchemy import MetaData, text
from sqlalchemy.engine import Engine

from app.core.tenant import (
    get_tenant_schema_name,
    is_multi_tenant_enabled,
)
from app.database import ENGINES
from app.orm.tenant_base import (
    get_tenant_models,
    list_tenant_tables,
)

logger = logging.getLogger(__name__)


def init_tenant_schema(tid: int, engine: Engine | None = None) -> None:
    """为新租户初始化 schema + 所有私有表.

    Args:
        tid: 租户 ID (>= 1)
        engine: 数据库引擎 (默认用 engine1/ai)

    Usage:
        >>> init_tenant_schema(2)
        [OK] Created schema tenant_2
        [OK] Created 87 tables in tenant_2
    """
    if tid < 1:
        raise ValueError(f"tid 必须 >= 1, 实际 {tid}")

    schema = get_tenant_schema_name(tid)
    engine = engine or ENGINES["ai"]

    logger.info(f"Initializing tenant schema: {schema}")
    with engine.begin() as conn:
        # 1. 创建 schema (如果不存在)
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))

        # 2. 用 to_metadata 复制表到目标 schema (线程安全, 不修改全局 Table.schema)
        #    原 table.schema 保持不变, 副本带 schema 标签用于建表
        tenant_md = MetaData()
        for tablename in list_tenant_tables(include_skipped=False):
            model_cls = get_tenant_models().get(tablename)
            if model_cls is None:
                continue
            try:
                src_table = model_cls.__table__
                if src_table is None:
                    continue
                src_table.to_metadata(tenant_md, schema=schema)
            except Exception as e:
                logger.error(f"  [ERR] {tablename}: {e}")
                raise

        # 3. 在目标 schema 下创建所有表 (checkfirst=True 避免重复创建)
        tenant_md.create_all(conn, checkfirst=True)
        for tname in tenant_md.tables:
            logger.debug(f"  [OK] {schema}.{tname}")

    logger.info(f"[OK] Tenant schema {schema} initialized")


def drop_tenant_schema(tid: int, engine: Engine | None = None) -> None:
    """删除租户 schema (DANGER: 数据不可恢复!).

    Args:
        tid: 租户 ID
        engine: 数据库引擎
    """
    if tid <= 1:
        raise ValueError("禁止删除默认租户 tenant_1")

    schema = get_tenant_schema_name(tid)
    engine = engine or ENGINES["ai"]

    logger.warning(f"DROPPING tenant schema: {schema}")
    with engine.begin() as conn:
        conn.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    logger.info(f"[OK] Tenant schema {schema} dropped")


def enable_multi_tenant() -> None:
    """启用多租户模式 (热更新: 改 .env 然后重启).

    启用步骤:
        1. 编辑 .env:
            MULTI_TENANT_ENABLED=true
        2. 重启服务:
            docker compose restart api
        3. 初始化默认租户:
            python -c "from app.tenant_demo import init_tenant_schema; init_tenant_schema(1)"
        4. 为新租户创建:
            python -c "from app.tenant_demo import init_tenant_schema; init_tenant_schema(2)"
    """
    if not is_multi_tenant_enabled():
        logger.warning("多租户未启用. 设置 MULTI_TENANT_ENABLED=true 然后重启服务.")
        return

    logger.info("Multi-tenant mode is ENABLED")
    logger.info("  - public schema:  公共表 (admin_config, hot_config)")
    logger.info("  - tenant_{tid} schema: 租户私有表 (users, products, orders)")


# ---------------------------------------------------------------------------
# 中间件示例: 在 FastAPI 请求入口自动切 tenant
# ---------------------------------------------------------------------------

EXAMPLE_MIDDLEWARE_CODE = '''
# app/middleware/tenant_middleware.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.tenant import set_current_tenant_id, reset_current_tenant_id
from app.config import settings
import jwt

class TenantMiddleware(BaseHTTPMiddleware):
    """从 JWT 解析 tid 写入 ContextVar, 切 schema_translate_map."""

    async def dispatch(self, request: Request, call_next):
        if not settings.MULTI_TENANT_ENABLED:
            return await call_next(request)

        # 1. 从 Authorization 头解析 JWT
        auth = request.headers.get("Authorization", "")
        tid = None
        if auth.startswith("Bearer "):
            token = auth[7:]
            try:
                payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
                tid = payload.get("tid")
            except Exception as e:
                logger.debug("解析 JWT 获取租户 ID 失败: %s", e)

        # 2. 写入 ContextVar
        if tid is not None:
            set_current_tenant_id(int(tid))

        try:
            response = await call_next(request)
        finally:
            reset_current_tenant_id()
        return response
'''


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m app.tenant_demo init <tid>")
        print("       python -m app.tenant_demo drop <tid>")
        print("       python -m app.tenant_demo status")
        sys.exit(0)
    cmd = sys.argv[1]
    if cmd == "init":
        init_tenant_schema(int(sys.argv[2]))
    elif cmd == "drop":
        drop_tenant_schema(int(sys.argv[2]))
    elif cmd == "status":
        enable_multi_tenant()
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
