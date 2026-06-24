"""Seed 最小 admin 用户 (用于 CI / 自动化测试 / 新环境初始化).

执行:
  python -m scripts.seed_admin

效果:
  - 如果 admin_user 表为空, 创建 admin/admin123 用户 (超管 + 全部权限)
  - 已存在则跳过 (幂等)

依赖:
  - 表结构必须先建好 (运行 python -m scripts.init_db)
  - bcrypt 库 (passlib)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from loguru import logger
from passlib.context import CryptContext
from sqlalchemy import Engine
from sqlalchemy.orm import sessionmaker

import app.models as _models  # noqa: F401
from app.database import SessionFactory1, engine1
from app.models.sys_models import SysRole, SysUser, SysUserRole


DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "admin123"


def _ensure_tables_sqlite_safe(engine) -> None:
    """确保 admin_user/admin_role/admin_user_role 表存在 (SQLite 下剥离 schema).

    只创建 seed_admin 需要的 3 张表, 避免 Base.metadata 中重复表名导致 create_all 失败.

    注意: 不再直接修改 ``Table.schema`` (会污染全局元数据, 影响其他使用该表的代码).
    改用 ``schema_translate_map={"public": None}`` 在连接级别把 public schema 翻译为无 schema,
    仅影响本次建表, 不改变模型定义.
    """
    from app.models.sys_models import SysRole, SysUser, SysUserRole

    is_sqlite = str(engine.url).startswith("sqlite")
    tables = (SysUser.__table__, SysRole.__table__, SysUserRole.__table__)

    if is_sqlite:
        # SQLite: 用 schema_translate_map 把 public 翻译为无 schema, 不修改全局 Table.schema
        with engine.connect().execution_options(
            schema_translate_map={"public": None}
        ) as conn:
            for table in tables:
                try:
                    table.create(bind=conn, checkfirst=True)
                except Exception as e:
                    logger.debug(f"[seed_admin] create table {table.name} skipped: {e}")
            conn.commit()
    else:
        for table in tables:
            table.create(bind=engine, checkfirst=True)
    logger.debug(f"[seed_admin] admin_user/admin_role/admin_user_role ensured (sqlite={is_sqlite})")


def seed_admin(
    username: str = DEFAULT_USERNAME,
    password: str = DEFAULT_PASSWORD,
    engine: Engine | None = None,
) -> dict:
    """注入 admin 用户. 返回 {created, already_exists, user_id}.

    Args:
        engine: 可选, 指定数据库引擎 (用于测试隔离). 默认使用全局 engine1.

    Raises:
        RuntimeError: 如果 admin_user 表尚未建立
    """
    pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

    # 确保表存在 (idempotent, SQLite-safe)
    target_engine = engine or engine1
    _ensure_tables_sqlite_safe(target_engine)

    factory = sessionmaker(bind=target_engine) if engine is not None else SessionFactory1
    with factory() as db:
        existing = db.query(SysUser).filter(SysUser.user_name == username).first()
        if existing:
            return {"created": False, "already_exists": True, "user_id": existing.user_id}

        # 确保 admin 角色存在
        admin_role = db.query(SysRole).filter(SysRole.role_key == "admin").first()
        if not admin_role:
            admin_role = SysRole(
                role_id=1,
                role_name="超级管理员",
                role_key="admin",
                role_sort=1,
                status="0",
                data_scope="1",
                remark="内置超管",
                del_flag="0",
            )
            db.add(admin_role)
            db.flush()

        # 创建用户
        hashed = pwd.hash(password)
        user = SysUser(
            user_name=username,
            nick_name="超级管理员",
            password=hashed,
            dept_id=1,
            status="0",
            del_flag="0",
            remark="seed_admin 注入",
        )
        db.add(user)
        db.flush()

        # 关联角色
        db.add(SysUserRole(user_id=user.user_id, role_id=admin_role.role_id))
        db.commit()

        return {"created": True, "already_exists": False, "user_id": user.user_id}


def main():
    result = seed_admin()
    if result["created"]:
        print(f"[seed_admin] ✓ 创建用户: admin/admin123 (user_id={result['user_id']})")
    else:
        print(f"[seed_admin] - admin 已存在 (user_id={result['user_id']}), 跳过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
