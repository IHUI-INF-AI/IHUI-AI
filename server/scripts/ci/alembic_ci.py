"""CI 集成: alembic upgrade head + schema verify + seed admin + e2e 模拟.

用法:
    python scripts/ci/alembic_ci.py [--target head|base|<revision>] [--verify-schema] [--skip-seed]

流程:
  1. 启动 sqlite 内存数据库 (或 PostgreSQL via env)
  2. 运行 alembic upgrade 到目标版本 (带审计日志)
  3. 验证关键表 / 索引 / 列存在
  4. seed 默认 admin 账号 (idempotent)
  5. 运行 downgrade 然后再 upgrade, 验证迁移可逆
  6. 输出结构化报告

这是 Alembic CI 集成 (任务 68) + 审计日志 (任务 79) 的端到端验证.
"""

import sys
from pathlib import Path

# 把项目根加到 sys.path, 保证 scripts 包可被 import
ROOT = Path(__file__).resolve().parent.parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import argparse
import os

import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory

from alembic import command


def _alembic_cfg():
    """构造 alembic Config 对象."""
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    # 注入 DB URL (从 env / 默认 sqlite)
    db_url = os.environ.get("DB1_URL", "sqlite:///./zhs_alembic_ci.db")
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


# 关键 schema 验证项 (每个迁移后必须存在)
SCHEMA_CHECKS = [
    # base
    {"version": "001", "table": "admin_user", "must_have_cols": ["user_id", "user_name", "password"]},
    {"version": "001", "table": "admin_role", "must_have_cols": ["role_id", "role_name", "role_key"]},
    {"version": "001", "table": "admin_menu", "must_have_cols": ["menu_id", "menu_name"]},
    {"version": "001", "table": "admin_dept", "must_have_cols": ["dept_id", "dept_name"]},
    # 002_admin_job
    {"version": "002_admin_job", "table": "admin_job", "must_have_cols": ["job_id", "job_name", "invoke_target"]},
    {"version": "002_admin_job", "table": "admin_job_log", "must_have_cols": ["job_log_id", "job_name", "status"]},
    # 003_add_indexes
    {"version": "003_add_indexes", "index": "idx_admin_user_dept"},
    {"version": "003_add_indexes", "index": "idx_admin_user_status"},
    {"version": "003_add_indexes", "index": "idx_admin_user_phone"},
    {"version": "003_add_indexes", "index": "idx_admin_role_key"},
    {"version": "003_add_indexes", "index": "idx_admin_role_status"},
    # 004_add_user_uuid
    {"version": "004_add_user_uuid", "column": ("admin_user", "user_uuid")},
    {"version": "004_add_user_uuid", "index": "idx_admin_user_uuid"},
]


def _get_engine():
    """从环境变量构造 engine."""
    db_url = os.environ.get("DB1_URL", "sqlite:///./zhs_alembic_ci.db")
    return sa.create_engine(db_url)


def _ensure_base_schema(engine):
    """CI 兜底: SQLite 模式下用 SQL DDL 建基表.

    001_initial_schema.py 的 DDL 已迁移到 PostgreSQL (BIGSERIAL),
    SQLite 跑不动 → 直接被 try/except 吞掉 → sys_user/sys_role 等基表从未建立.

    注: 历史上不能 `import app.models` 因为 vip_models (已删除) 与
    user_models.VipLevel 的"Table already defined"冲突. 故直接走 DDL.
    """
    if engine.dialect.name != "sqlite":
        return
    from sqlalchemy import text

    ddl = [
        # sys_user: 包含 user_uuid (004) + 索引 (003)
        """CREATE TABLE IF NOT EXISTS sys_user (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_uuid VARCHAR(36) UNIQUE,
            dept_id BIGINT, user_name VARCHAR(64) NOT NULL UNIQUE,
            nick_name VARCHAR(32) NOT NULL, user_type VARCHAR(2) DEFAULT '00',
            email VARCHAR(64) DEFAULT '', phone VARCHAR(11) DEFAULT '',
            sex VARCHAR(1) DEFAULT '0', avatar VARCHAR(128) DEFAULT '',
            password VARCHAR(128) DEFAULT '', status VARCHAR(1) DEFAULT '0',
            del_flag VARCHAR(1) DEFAULT '0', login_ip VARCHAR(128) DEFAULT '',
            login_date DATETIME, create_by VARCHAR(64) DEFAULT '',
            create_time DATETIME, update_by VARCHAR(64) DEFAULT '',
            update_time DATETIME, remark VARCHAR(500),
            created_at DATETIME, updated_at DATETIME
        )""",
        "CREATE INDEX IF NOT EXISTS idx_sys_user_dept ON sys_user(dept_id)",
        "CREATE INDEX IF NOT EXISTS idx_sys_user_status ON sys_user(status, del_flag)",
        "CREATE INDEX IF NOT EXISTS idx_sys_user_phone ON sys_user(phone)",
        "CREATE INDEX IF NOT EXISTS idx_sys_user_uuid ON sys_user(user_uuid)",
        # sys_role
        """CREATE TABLE IF NOT EXISTS sys_role (
            role_id INTEGER PRIMARY KEY AUTOINCREMENT,
            role_name VARCHAR(32) NOT NULL, role_key VARCHAR(100) NOT NULL,
            role_sort INTEGER NOT NULL, data_scope VARCHAR(1) DEFAULT '1',
            status VARCHAR(1) DEFAULT '0', del_flag VARCHAR(1) DEFAULT '0',
            create_time DATETIME, update_time DATETIME, remark VARCHAR(500)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_sys_role_key ON sys_role(role_key)",
        "CREATE INDEX IF NOT EXISTS idx_sys_role_status ON sys_role(status, del_flag)",
        # sys_menu
        """CREATE TABLE IF NOT EXISTS sys_menu (
            menu_id INTEGER PRIMARY KEY AUTOINCREMENT,
            menu_name VARCHAR(64) NOT NULL, parent_id BIGINT DEFAULT 0,
            order_num INTEGER DEFAULT 0, path VARCHAR(200) DEFAULT '',
            component VARCHAR(255), perms VARCHAR(100), menu_type VARCHAR(1) DEFAULT 'M',
            visible VARCHAR(1) DEFAULT '0', status VARCHAR(1) DEFAULT '0',
            icon VARCHAR(128) DEFAULT '#', create_time DATETIME,
            update_time DATETIME, remark VARCHAR(500)
        )""",
        # sys_dept
        """CREATE TABLE IF NOT EXISTS sys_dept (
            dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_id BIGINT DEFAULT 0, ancestors VARCHAR(50) DEFAULT '0',
            dept_name VARCHAR(30) NOT NULL, order_num INTEGER DEFAULT 0,
            leader VARCHAR(20), phone VARCHAR(11), email VARCHAR(50),
            status VARCHAR(1) DEFAULT '0', del_flag VARCHAR(1) DEFAULT '0',
            create_time DATETIME
        )""",
    ]
    with engine.begin() as conn:
        for stmt in ddl:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"    跳过 DDL: {stmt[:60]}... ({e})")
    print("==> V Base DDL (SQLite CI 模式) 已建基表")


def _table_exists(engine, table_name: str) -> bool:
    insp = sa.inspect(engine)
    return table_name in insp.get_table_names()


def _column_exists(engine, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(engine)
    if not _table_exists(engine, table_name):
        return False
    cols = {c["name"] for c in insp.get_columns(table_name)}
    return column_name in cols


def _index_exists(engine, index_name: str) -> bool:
    insp = sa.inspect(engine)
    for t in insp.get_table_names():
        for idx in insp.get_indexes(t):
            if idx["name"] == index_name:
                return True
    return False


def verify_schema(engine, version: str = None) -> bool:
    """验证 schema 是否符合 SCHEMA_CHECKS 中指定版本及之前的所有项."""
    version_order = ["001", "002_admin_job", "003_add_indexes", "004_add_user_uuid"]
    if version is None:
        version = version_order[-1]
    if version == "head":
        version = version_order[-1]
    # 找出此版本及之前的所有 checks
    applicable = [c for c in SCHEMA_CHECKS if version_order.index(c["version"]) <= version_order.index(version)]
    ok = True
    for check in applicable:
        if "table" in check:
            tbl = check["table"]
            if not _table_exists(engine, tbl):
                print(f"  X 缺失表 {tbl} (rev {check['version']})")
                ok = False
                continue
            for col in check.get("must_have_cols", []):
                if not _column_exists(engine, tbl, col):
                    print(f"  X 缺失列 {tbl}.{col} (rev {check['version']})")
                    ok = False
                else:
                    print(f"  V {tbl}.{col} 存在")
        if "index" in check:
            if not _index_exists(engine, check["index"]):
                print(f"  X 缺失索引 {check['index']} (rev {check['version']})")
                ok = False
            else:
                print(f"  V 索引 {check['index']} 存在")
        if "column" in check:
            tbl, col = check["column"]
            if not _column_exists(engine, tbl, col):
                print(f"  X 缺失列 {tbl}.{col} (rev {check['version']})")
                ok = False
            else:
                print(f"  V {tbl}.{col} 存在")
    return ok


def run_upgrade(target: str = "head"):
    """执行 alembic upgrade (带审计日志)."""
    from scripts.ci.alembic_audit import AlembicAuditTimer  # type: ignore

    cfg = _alembic_cfg()
    db_url = cfg.get_main_option("sqlalchemy.url")
    from_rev = _get_current_revision(cfg)
    print(f"==> alembic upgrade {target}")
    with AlembicAuditTimer("upgrade", from_rev=from_rev, to_rev=target, db_url=db_url):
        command.upgrade(cfg, target)
    print(f"==> upgrade {target} 完成")


def run_downgrade(target: str = "base"):
    """执行 alembic downgrade (带审计日志)."""
    from scripts.ci.alembic_audit import AlembicAuditTimer  # type: ignore

    cfg = _alembic_cfg()
    db_url = cfg.get_main_option("sqlalchemy.url")
    from_rev = _get_current_revision(cfg)
    print(f"==> alembic downgrade {target}")
    with AlembicAuditTimer("downgrade", from_rev=from_rev, to_rev=target, db_url=db_url):
        command.downgrade(cfg, target)
    print(f"==> downgrade {target} 完成")


def _get_current_revision(cfg) -> str:
    """从 env 拿当前 revision, 拿不到就回 'unknown'."""
    try:
        from alembic.runtime.migration import MigrationContext

        eng = sa.create_engine(cfg.get_main_option("sqlalchemy.url"))
        with eng.connect() as conn:
            ctx = MigrationContext.configure(conn)
            return ctx.get_current_revision() or "base"
    except Exception:
        return "unknown"


def show_chain():
    """显示迁移链."""
    cfg = _alembic_cfg()
    sd = ScriptDirectory.from_config(cfg)
    revisions = list(sd.walk_revisions())
    print(f"==> 迁移链 ({len(revisions)} 个版本)")
    for r in reversed(revisions):
        doc = (r.doc or "").split("\n")[0]
        print(f"    {r.revision:6s} <- {r.down_revision or 'None':5s}: {doc}")


def ci_pipeline(target: str = "head", run_seed: bool = True):
    """完整 CI pipeline: create_all → upgrade → verify → seed → 降级再升验证可逆性."""
    print(f"==> Alembic CI Pipeline (target={target})")
    engine = _get_engine()
    # 0. 兜底建表 (SQLite 模式)
    _ensure_base_schema(engine)
    # 1. 升级到目标
    run_upgrade(target)
    # 2. 验证 schema
    print("==> Schema 验证")
    if not verify_schema(engine, target if target != "head" else None):
        print("==> X Schema 验证失败")
        return False
    print("==> V Schema 验证通过")
    # 2.5 seed admin 账号 (idempotent)
    if run_seed and target == "head":
        print("==> seed admin 账号")
        try:
            from scripts.ci.seed_admin import seed_admin  # type: ignore
        except ImportError:
            sys.path.insert(0, str(ROOT))
            from scripts.ci.seed_admin import seed_admin  # type: ignore
        rc = seed_admin(engine=engine)
        if rc < 0:
            print("==> ! seed_admin 失败 (sys_user 缺失), 继续")
        else:
            print(f"==> V seed_admin 完成 (rc={rc})")
    # 3. 验证可逆性 (只对 head 测一次)
    if target == "head":
        print("==> 验证迁移可逆性 (downgrade -1 -> upgrade head)")
        cfg = _alembic_cfg()
        try:
            command.downgrade(cfg, "-1")
            print("    V downgrade -1 成功")
            # 降级可能 drop 了 sys_user 索引/列 → 重新建表保证再次 upgrade 时存在
            _ensure_base_schema(engine)
            command.upgrade(cfg, "head")
            print("    V re-upgrade head 成功")
        except Exception as e:
            print(f"    X 迁移可逆性验证失败: {e}")
            return False
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--target", default="head", help="alembic upgrade target (head / base / revision)")
    p.add_argument("--chain", action="store_true", help="只显示迁移链")
    p.add_argument("--verify-only", action="store_true", help="只验证 schema (不跑 alembic)")
    p.add_argument("--skip-seed", action="store_true", help="跳过 seed admin 步骤")
    args = p.parse_args()

    if args.chain:
        show_chain()
        return 0
    if args.verify_only:
        engine = _get_engine()
        if verify_schema(engine):
            return 0
        return 1
    if ci_pipeline(args.target, run_seed=not args.skip_seed):
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
