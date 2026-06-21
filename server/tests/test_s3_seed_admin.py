"""S3 seed_admin.py 单元测试 - 验证 admin 用户注入幂等 + 与 app.security 兼容."""

import os
import sys
import tempfile
from pathlib import Path

import pytest
import sqlalchemy as sa

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def tmp_db(monkeypatch):
    """为每个测试建独立 sqlite db, 返回 engine (隔离全局 engine1)."""
    fd, path = tempfile.mkstemp(suffix=".db", prefix="zhs_s3_seed_admin_")
    os.close(fd)
    url = f"sqlite:///{path}"
    monkeypatch.setenv("DB1_URL", url)
    engine = sa.create_engine(url, connect_args={"check_same_thread": False})
    yield engine
    engine.dispose()
    try:
        os.remove(path)
    except OSError:
        pass


def test_seed_admin_creates_default_account(tmp_db):
    """首次 seed 应创建 admin/admin123, 返回 created=True."""
    from scripts.seed_admin import seed_admin

    result = seed_admin(engine=tmp_db)
    assert result["created"] is True
    assert result["already_exists"] is False
    assert result["user_id"] is not None


def test_seed_admin_is_idempotent(tmp_db):
    """重跑 seed_admin 应幂等 (不创建第二行)."""
    from scripts.seed_admin import seed_admin

    r1 = seed_admin(engine=tmp_db)
    r2 = seed_admin(engine=tmp_db)
    # 至少有一个 created=False 表示已存在
    assert (
        r1["created"] is True or r2["created"] is False
    ), f"两次调用必须有一次返回 already_exists, 实际 r1={r1} r2={r2}"
    # user_id 必须一致
    assert r1["user_id"] == r2["user_id"]


def test_seed_admin_password_verifies_with_security(tmp_db):
    """默认 seed 后的密码哈希能被 app.security.verify_password 校验."""
    from sqlalchemy.orm import sessionmaker

    from app.models.sys_models import SysUser
    from app.security import verify_password
    from scripts.seed_admin import seed_admin

    seed_admin(engine=tmp_db)
    with sessionmaker(bind=tmp_db)() as db:
        row = db.query(SysUser).filter(SysUser.user_name == "admin").first()
    assert row is not None
    assert verify_password("admin123", row.password)
    assert not verify_password("wrong_password", row.password)


def test_seed_admin_links_admin_role(tmp_db):
    """seed_admin 注入的 admin 必须关联到 admin 角色 (role_key='admin')."""
    from sqlalchemy.orm import sessionmaker

    from app.models.sys_models import SysRole, SysUser, SysUserRole
    from scripts.seed_admin import seed_admin

    seed_admin(engine=tmp_db)
    with sessionmaker(bind=tmp_db)() as db:
        user = db.query(SysUser).filter(SysUser.user_name == "admin").first()
        assert user is not None
        role_link = (
            db.query(SysUserRole)
            .join(SysRole, SysRole.role_id == SysUserRole.role_id)
            .filter(SysUserRole.user_id == user.user_id, SysRole.role_key == "admin")
            .first()
        )
        assert role_link is not None, "admin 用户应关联到 admin 角色"
