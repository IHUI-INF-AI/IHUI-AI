"""seed_admin.py 单元测试 (任务 76).

覆盖:
  - admin_user 表不存在时 seed_admin 跳过 (返回 -1)
  - admin_user 表存在时首次 seed 成功 (返回 1)
  - 重跑 seed 幂等不报错 (返回 0 或 1)
  - 自定义 user_name / nick_name / password_hash 都生效
  - 默认账号能用 app.security.verify_password 校验
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
def tmp_db(monkeypatch):
    """为每个 seed_admin 测试建独立 sqlite db."""
    fd, path = tempfile.mkstemp(suffix=".db", prefix="zhs_seed_admin_")
    os.close(fd)
    url = f"sqlite:///{path}"
    monkeypatch.setenv("DB1_URL", url)
    yield url
    try:
        os.remove(path)
    except OSError:
        pass


def _create_admin_user(engine):
    """用 DDL 建 admin_user 表 (与 alembic 001 兜底一致)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
            CREATE TABLE admin_user (
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
            )
        """
            )
        )


def test_seed_admin_skips_when_admin_user_missing(tmp_db):
    """admin_user 表不存在 → seed_admin 优雅跳过 (返回 -1)."""
    from scripts.ci.seed_admin import seed_admin

    engine = sa.create_engine(tmp_db)
    rc = seed_admin(engine=engine)
    assert rc == -1, f"应跳过并返回 -1, 实际 {rc}"


def test_seed_admin_creates_default_account(tmp_db):
    """首次 seed → 写入 admin/admin123/管理员, 返回 1."""
    from scripts.ci.seed_admin import seed_admin

    engine = sa.create_engine(tmp_db)
    _create_admin_user(engine)
    rc = seed_admin(engine=engine)
    assert rc == 1
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT user_name, nick_name, password FROM admin_user WHERE user_name='admin'")
        ).fetchone()
    assert row is not None
    assert row[0] == "admin"
    assert row[1] == "管理员"
    # bcrypt('admin123') 标准 hash
    assert row[2].startswith("$2a$10$")


def test_seed_admin_is_idempotent(tmp_db):
    """重跑 seed_admin 不报错, 也不会创建第二行."""
    from scripts.ci.seed_admin import seed_admin

    engine = sa.create_engine(tmp_db)
    _create_admin_user(engine)
    assert seed_admin(engine=engine) == 1
    rc2 = seed_admin(engine=engine)
    assert rc2 in (0, 1), f"重跑应幂等, 返回 0 或 1, 实际 {rc2}"
    with engine.connect() as conn:
        cnt = conn.execute(text("SELECT COUNT(*) FROM admin_user WHERE user_name='admin'")).scalar()
    assert cnt == 1, f"应只有 1 行 admin, 实际 {cnt}"


def test_seed_admin_custom_credentials(tmp_db):
    """自定义 user_name / nick_name / password_hash 都生效."""
    from scripts.ci.seed_admin import seed_admin

    engine = sa.create_engine(tmp_db)
    _create_admin_user(engine)
    custom_hash = "$2a$10$abcdefghijklmnopqrstuv1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ012"
    rc = seed_admin(
        engine=engine,
        user_name="root",
        nick_name="超级管理员",
        password="root123",
        password_hash=custom_hash,
    )
    assert rc == 1
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT user_name, nick_name, password FROM admin_user WHERE user_name='root'")
        ).fetchone()
    assert row[0] == "root"
    assert row[1] == "超级管理员"
    assert row[2] == custom_hash


def test_seed_admin_password_verifies_with_security(tmp_db):
    """默认 seed 的 password 哈希能被 app.security.verify_password 校验."""
    from app.security import verify_password
    from scripts.ci.seed_admin import seed_admin

    engine = sa.create_engine(tmp_db)
    _create_admin_user(engine)
    assert seed_admin(engine=engine) == 1
    with engine.connect() as conn:
        hashed = conn.execute(text("SELECT password FROM admin_user WHERE user_name='admin'")).scalar()
    # 默认密码 admin123 应当能校验通过
    assert verify_password("admin123", hashed), "默认 admin123 密码应能校验通过"
    assert not verify_password("wrong_password", hashed), "错误密码应校验失败"


# ---------------------------------------------------------------------------
# seed_full() 完整 seed 测试 (角色/部门/岗位/字典/菜单/关联)
# ---------------------------------------------------------------------------


def _create_full_schema(engine):
    """为 seed_full() 建完整的 admin_* 表 (匹配 sys_models.py 表结构)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                """
            CREATE TABLE admin_user (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uuid VARCHAR(36) UNIQUE,
                dept_id BIGINT, user_name VARCHAR(64) NOT NULL,
                nick_name VARCHAR(32) NOT NULL, email VARCHAR(64) DEFAULT '',
                phone VARCHAR(11) DEFAULT '', sex VARCHAR(1) DEFAULT '0',
                avatar VARCHAR(128) DEFAULT '', password VARCHAR(128) DEFAULT '',
                status VARCHAR(1) DEFAULT '0', del_flag VARCHAR(1) DEFAULT '0',
                login_ip VARCHAR(128) DEFAULT '', login_date DATETIME,
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME,
                remark VARCHAR(500) DEFAULT ''
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_role (
                role_id INTEGER PRIMARY KEY AUTOINCREMENT,
                role_name VARCHAR(64) NOT NULL, role_key VARCHAR(64) NOT NULL,
                role_sort INTEGER DEFAULT 0, data_scope VARCHAR(1) DEFAULT '1',
                menu_check_strictly INTEGER DEFAULT 1, dept_check_strictly INTEGER DEFAULT 1,
                status VARCHAR(1) DEFAULT '0', del_flag VARCHAR(1) DEFAULT '0',
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME,
                remark VARCHAR(500) DEFAULT ''
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_dept (
                dept_id INTEGER PRIMARY KEY AUTOINCREMENT,
                parent_id BIGINT DEFAULT 0, ancestors VARCHAR(50) DEFAULT '',
                dept_name VARCHAR(64) NOT NULL, order_num INTEGER DEFAULT 0,
                leader VARCHAR(32) DEFAULT '', phone VARCHAR(11) DEFAULT '',
                email VARCHAR(64) DEFAULT '', status VARCHAR(1) DEFAULT '0',
                del_flag VARCHAR(1) DEFAULT '0',
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_post (
                post_id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_code VARCHAR(64) NOT NULL, post_name VARCHAR(64) NOT NULL,
                post_sort INTEGER DEFAULT 0, status VARCHAR(1) DEFAULT '0',
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME,
                remark VARCHAR(500) DEFAULT ''
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_dict_type (
                dict_id INTEGER PRIMARY KEY AUTOINCREMENT,
                dict_name VARCHAR(64) NOT NULL, dict_type VARCHAR(64) NOT NULL,
                status VARCHAR(1) DEFAULT '0',
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME,
                remark VARCHAR(500) DEFAULT ''
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_dict_data (
                dict_code INTEGER PRIMARY KEY AUTOINCREMENT,
                dict_sort INTEGER DEFAULT 0, dict_label VARCHAR(64) NOT NULL,
                dict_value VARCHAR(64) NOT NULL, dict_type VARCHAR(64) NOT NULL,
                is_default VARCHAR(1) DEFAULT 'N', status VARCHAR(1) DEFAULT '0',
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME,
                remark VARCHAR(500) DEFAULT ''
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_menu (
                menu_id INTEGER PRIMARY KEY AUTOINCREMENT,
                menu_name VARCHAR(64) NOT NULL, parent_id BIGINT DEFAULT 0,
                order_num INTEGER DEFAULT 0, path VARCHAR(200) DEFAULT '',
                component VARCHAR(255) DEFAULT '', query VARCHAR(255) DEFAULT '',
                route_name VARCHAR(64) DEFAULT '', is_frame VARCHAR(1) DEFAULT '1',
                is_cache VARCHAR(1) DEFAULT '0', menu_type VARCHAR(1) DEFAULT '',
                visible VARCHAR(1) DEFAULT '0', status VARCHAR(1) DEFAULT '0',
                perms VARCHAR(100) DEFAULT '', icon VARCHAR(100) DEFAULT '#',
                create_by VARCHAR(64) DEFAULT '', create_time DATETIME,
                update_by VARCHAR(64) DEFAULT '', update_time DATETIME,
                remark VARCHAR(500) DEFAULT ''
            )
        """
            )
        )
        conn.execute(
            text(
                """
            CREATE TABLE admin_user_role (
                user_id BIGINT NOT NULL, role_id BIGINT NOT NULL,
                PRIMARY KEY (user_id, role_id)
            )
        """
            )
        )


def test_seed_full_inserts_all_default_data(tmp_db):
    """seed_full() 一次性插入角色/部门/岗位/字典/菜单 + 关联 admin user."""
    from scripts.ci.seed_admin import seed_admin, seed_full

    engine = sa.create_engine(tmp_db)
    _create_full_schema(engine)
    assert seed_admin(engine=engine) == 1
    result = seed_full(engine=engine)
    # 各类数据都已插入
    assert result["roles"] == 2  # 超级管理员 + 普通角色
    assert result["depts"] == 4  # 总公司 + 3 子部门
    assert result["posts"] == 4  # 4 个岗位
    assert result["dict_types"] == 4  # 4 个字典类型
    assert result["dict_data"] == 13  # 3 + 2 + 2 + 6
    assert result["menus"] == 11  # 系统管理目录 + 9 子菜单 + 日志管理 + 操作日志
    assert result["user_role_linked"] is True
    # 验证关键数据
    with engine.connect() as conn:
        # admin 角色存在
        assert (
            conn.execute(text("SELECT COUNT(*) FROM admin_role WHERE role_key='admin'")).scalar()
            == 1
        )
        # admin user 已关联到 admin role
        assert (
            conn.execute(
                text(
                    "SELECT COUNT(*) FROM admin_user_role ur "
                    "JOIN admin_user u ON ur.user_id = u.user_id "
                    "JOIN admin_role r ON ur.role_id = r.role_id "
                    "WHERE u.user_name='admin' AND r.role_key='admin'"
                )
            ).scalar()
            == 1
        )


def test_seed_full_is_idempotent(tmp_db):
    """重跑 seed_full() 不重复插入."""
    from scripts.ci.seed_admin import seed_admin, seed_full

    engine = sa.create_engine(tmp_db)
    _create_full_schema(engine)
    seed_admin(engine=engine)
    first = seed_full(engine=engine)
    second = seed_full(engine=engine)
    # 第二次全部为 0 (除了 user_role_linked=False 因为已关联)
    assert second["roles"] == 0
    assert second["depts"] == 0
    assert second["posts"] == 0
    assert second["dict_types"] == 0
    assert second["dict_data"] == 0
    assert second["menus"] == 0
    assert second["user_role_linked"] is False  # 已存在, 不重复 link
    # 实际行数没变
    for t in ("admin_role", "admin_dept", "admin_post", "admin_dict_type", "admin_dict_data", "admin_menu"):
        cnt = engine.connect().execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
        expected = first[{"admin_role": "roles", "admin_dept": "depts", "admin_post": "posts", "admin_dict_type": "dict_types", "admin_dict_data": "dict_data", "admin_menu": "menus"}[t]]
        assert cnt == expected, f"{t} 第二次 seed 后行数应等于首次 ({expected}), 实际 {cnt}"


def test_seed_full_skips_when_tables_missing(tmp_db):
    """admin_* 表都不存在 → seed_full() 优雅跳过, 返回空 dict."""
    from scripts.ci.seed_admin import seed_full

    engine = sa.create_engine(tmp_db)
    # 不建任何表
    result = seed_full(engine=engine)
    assert result == {}
