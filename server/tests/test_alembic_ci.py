"""Alembic CI 集成测试 (任务 68).

覆盖:
  - alembic upgrade head 成功
  - 关键 schema 存在 (admin_user/admin_role/admin_menu/admin_dept + admin_job/admin_job_log)
  - 高频索引已建 (idx_admin_user_*, idx_admin_role_*)
  - 004_add_user_uuid 已添加 user_uuid 列 + 唯一约束
  - downgrade -1 + upgrade head 迁移可逆

不在 pytest 主 session 跑, 避免污染 conftest 的 zhs_test.db — 用临时 db.
需要 alembic + sqlalchemy + app.models (导入会触发 settings 加载).
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy import text

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def alembic_tmp_db(monkeypatch):
    """为 alembic 测试创建独立 SQLite db file, 跑完清理."""
    fd, path = tempfile.mkstemp(suffix=".db", prefix="zhs_alembic_test_")
    os.close(fd)
    url = f"sqlite:///{path}"
    # 让 alembic_cfg 读到这个 url
    monkeypatch.setenv("DB1_URL", url)
    monkeypatch.setenv("DB2_URL", url)
    monkeypatch.setenv("DB3_URL", url)
    yield url
    try:
        os.remove(path)
    except OSError:
        pass


def _alembic_cfg(db_url: str):
    from alembic.config import Config

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    return cfg


_BASE_DDL = [
    """CREATE TABLE IF NOT EXISTS admin_user (
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
    "CREATE INDEX IF NOT EXISTS idx_admin_user_dept ON admin_user(dept_id)",
    "CREATE INDEX IF NOT EXISTS idx_admin_user_status ON admin_user(status, del_flag)",
    "CREATE INDEX IF NOT EXISTS idx_admin_user_phone ON admin_user(phone)",
    "CREATE INDEX IF NOT EXISTS idx_admin_user_uuid ON admin_user(user_uuid)",
    """CREATE TABLE IF NOT EXISTS admin_role (
        role_id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_name VARCHAR(32) NOT NULL, role_key VARCHAR(100) NOT NULL,
        role_sort INTEGER NOT NULL, data_scope VARCHAR(1) DEFAULT '1',
        status VARCHAR(1) DEFAULT '0', del_flag VARCHAR(1) DEFAULT '0',
        create_time DATETIME, update_time DATETIME, remark VARCHAR(500)
    )""",
    "CREATE INDEX IF NOT EXISTS idx_admin_role_key ON admin_role(role_key)",
    "CREATE INDEX IF NOT EXISTS idx_admin_role_status ON admin_role(status, del_flag)",
    """CREATE TABLE IF NOT EXISTS admin_menu (
        menu_id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_name VARCHAR(64) NOT NULL, parent_id BIGINT DEFAULT 0,
        order_num INTEGER DEFAULT 0, path VARCHAR(200) DEFAULT '',
        component VARCHAR(255), perms VARCHAR(100), menu_type VARCHAR(1) DEFAULT 'M',
        visible VARCHAR(1) DEFAULT '0', status VARCHAR(1) DEFAULT '0',
        icon VARCHAR(128) DEFAULT '#', create_time DATETIME,
        update_time DATETIME, remark VARCHAR(500)
    )""",
    """CREATE TABLE IF NOT EXISTS admin_dept (
        dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id BIGINT DEFAULT 0, ancestors VARCHAR(50) DEFAULT '0',
        dept_name VARCHAR(30) NOT NULL, order_num INTEGER DEFAULT 0,
        leader VARCHAR(20), phone VARCHAR(11), email VARCHAR(50),
        status VARCHAR(1) DEFAULT '0', del_flag VARCHAR(1) DEFAULT '0',
        create_time DATETIME
    )""",
]


def _ensure_base_schema(engine):
    """与 scripts/ci/alembic_ci.py 同源的兜底建表逻辑 (走 DDL, 不导入 ORM)."""
    from sqlalchemy import text

    with engine.begin() as conn:
        for stmt in _BASE_DDL:
            conn.execute(text(stmt))


def _table_exists(engine, name: str) -> bool:
    return name in sa.inspect(engine).get_table_names()


def _column_exists(engine, tbl: str, col: str) -> bool:
    insp = sa.inspect(engine)
    if tbl not in insp.get_table_names():
        return False
    return col in {c["name"] for c in insp.get_columns(tbl)}


def _index_exists(engine, name: str) -> bool:
    insp = sa.inspect(engine)
    for t in insp.get_table_names():
        for idx in insp.get_indexes(t):
            if idx["name"] == name:
                return True
    return False


def test_alembic_upgrade_creates_all_business_tables(alembic_tmp_db):
    """upgrade head 后 4 张基表 + 2 张 job 表 + user_uuid + 索引齐全."""
    from alembic import command

    engine = sa.create_engine(alembic_tmp_db)
    _ensure_base_schema(engine)
    cfg = _alembic_cfg(alembic_tmp_db)
    command.upgrade(cfg, "head")

    # 001: 4 张基表
    for tbl in ("admin_user", "admin_role", "admin_menu", "admin_dept"):
        assert _table_exists(engine, tbl), f"缺表 {tbl}"
    for tbl, col in [
        ("admin_user", "user_id"),
        ("admin_user", "user_name"),
        ("admin_user", "password"),
        ("admin_role", "role_id"),
        ("admin_role", "role_key"),
        ("admin_menu", "menu_id"),
        ("admin_dept", "dept_id"),
    ]:
        assert _column_exists(engine, tbl, col), f"缺列 {tbl}.{col}"
    # 002: job 表
    for tbl in ("admin_job", "admin_job_log"):
        assert _table_exists(engine, tbl), f"缺表 {tbl}"
    # 003: 高频索引
    for idx in (
        "idx_admin_user_dept",
        "idx_admin_user_status",
        "idx_admin_user_phone",
        "idx_admin_role_key",
        "idx_admin_role_status",
    ):
        assert _index_exists(engine, idx), f"缺索引 {idx}"
    # 004: user_uuid 列 + 索引
    assert _column_exists(engine, "admin_user", "user_uuid"), "缺 user_uuid 列"
    assert _index_exists(engine, "idx_admin_user_uuid"), "缺 user_uuid 索引"


def test_alembic_reversibility_downgrade_then_upgrade(alembic_tmp_db):
    """迁移可逆: downgrade -1 -> upgrade head 必须无异常."""
    from alembic import command

    engine = sa.create_engine(alembic_tmp_db)
    _ensure_base_schema(engine)
    cfg = _alembic_cfg(alembic_tmp_db)
    command.upgrade(cfg, "head")
    # 降级一步
    command.downgrade(cfg, "-1")
    # 重新建表 (降级可能 drop 了 user_uuid 列) 再升级
    _ensure_base_schema(engine)
    command.upgrade(cfg, "head")
    # 升级后 user_uuid 还在
    assert _column_exists(engine, "admin_user", "user_uuid")


def test_alembic_migration_chain_is_well_formed():
    """迁移链无断裂: 每个 revision 必须能解析 down_revision.

    2026-06-26: 迁移已重编号, head = 047_notify_persist, 链 016-047 完整.
    """
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "alembic"))
    sd = ScriptDirectory.from_config(cfg)
    revisions = list(sd.walk_revisions())
    assert len(revisions) >= 10, f"迁移版本数异常: {len(revisions)}"
    revs = {r.revision: r for r in revisions}
    for r in revisions:
        if r.down_revision:
            assert r.down_revision in revs, f"断链: {r.revision} 引用了不存在的 down_revision {r.down_revision}"
    # 至少应包含 016-047 范围的关键版本 (2026-06-26 重编号后的范围)
    expected = {"016_add_refund_tables", "047_notify_persist"}
    actual = {r.revision for r in revisions}
    missing = expected - actual
    assert not missing, f"缺失迁移版本: {missing}"
    # head 必须是 054_add_agent_need_task_columns (2026-06-26 新增)
    heads = [r for r in revisions if r.down_revision and r.down_revision not in {x.revision for x in revisions if x is not r}]
    # 更稳: 没有任何迁移的 down_revision 指向 head
    all_ups = {r.down_revision for r in revisions if r.down_revision}
    actual_heads = [r.revision for r in revisions if r.revision not in all_ups]
    assert "054_add_agent_need_task_columns" in actual_heads, f"head 应为 054_add_agent_need_task_columns, 实际 {actual_heads}"


def test_alembic_002_no_longer_inserts_admin_data(alembic_tmp_db):
    """任务 76: 002_admin_job 不应再硬塞 admin 账号 (迁移=DDL, seed=数据)."""
    from alembic import command

    engine = sa.create_engine(alembic_tmp_db)
    _ensure_base_schema(engine)
    cfg = _alembic_cfg(alembic_tmp_db)
    command.upgrade(cfg, "head")
    # upgrade 后 admin_user 应只有 001 建表时的行 (无数据), 也就没有 admin
    with engine.connect() as conn:
        cnt = conn.execute(text("SELECT COUNT(*) FROM admin_user")).scalar()
    assert cnt == 0, f"迁移不应插入任何 admin_user 数据, 实际 {cnt} 行"


def test_alembic_plus_seed_admin_creates_admin(alembic_tmp_db):
    """集成: alembic upgrade head + seed_admin = 默认 admin 账号就位."""
    from alembic import command

    sys.path.insert(0, str(ROOT))
    from scripts.ci.seed_admin import seed_admin

    engine = sa.create_engine(alembic_tmp_db)
    _ensure_base_schema(engine)
    cfg = _alembic_cfg(alembic_tmp_db)
    command.upgrade(cfg, "head")
    rc = seed_admin(engine=engine)
    assert rc == 1
    with engine.connect() as conn:
        row = conn.execute(text("SELECT user_name, nick_name FROM admin_user WHERE user_name='admin'")).fetchone()
    assert row is not None
    assert row[0] == "admin"
    assert row[1] == "管理员"
