"""建议 132 测试: 第二批业务表迁移到 TenantBase (User + UserMargin)."""

import pytest
import sqlalchemy as sa
from sqlalchemy import create_engine

# ---------------------------------------------------------------------------
# User / UserMargin 已迁移
# ---------------------------------------------------------------------------


class TestUserMigratedToTenantBase:
    """核心 User 表迁移验证."""

    def test_user_inherits_tenant_base(self):
        from app.models.user_models import User
        from app.orm.tenant_base import TenantBase

        assert issubclass(User, TenantBase)

    def test_user_registered_in_tenant_models(self):
        from app.models.user_models import User
        from app.orm.tenant_base import get_tenant_models

        models = get_tenant_models()
        assert "users" in models
        assert models["users"] is User

    def test_user_tenant_schema_is_public(self):
        from app.models.user_models import User

        assert User.__tenant_schema__ == "public"

    def test_user_table_args_has_schema(self):
        """__table_args__ 应自动包含 schema='public' (TenantBase 注入)."""
        from app.models.user_models import User

        args = User.__table_args__
        found = None
        for item in (args if isinstance(args, tuple) else (args,)):
            if isinstance(item, dict) and "schema" in item:
                found = item
                break
        assert found is not None
        assert found["schema"] == "public"

    def test_user_no_manual_schema_in_source(self):
        """源文件中 User class 内 (非注释) 无手写 'schema'."""
        from pathlib import Path

        text = (
            Path(__file__)
            .resolve()
            .parent.parent.joinpath("app", "models", "user_models.py")
            .read_text(encoding="utf-8")
        )
        in_class = False
        for line in text.split("\n"):
            if "class User(" in line and "UserSKInfo" not in line and "UserAuthInfo" not in line:
                in_class = True
                continue
            if in_class:
                if line.startswith("class "):
                    break
                stripped = line.strip()
                if stripped.startswith("#") or not stripped:
                    continue
                if '"schema":' in line or "'schema':" in line:
                    pytest.fail(f"User class 不应手写 schema: {line}")


class TestUserMarginMigratedToTenantBase:
    """UserMargin 表迁移验证."""

    def test_user_margin_inherits_tenant_base(self):
        from app.models.user_models import UserMargin
        from app.orm.tenant_base import TenantBase

        assert issubclass(UserMargin, TenantBase)

    def test_user_margin_registered(self):
        from app.models.user_models import UserMargin
        from app.orm.tenant_base import get_tenant_models

        models = get_tenant_models()
        assert "user_margin" in models
        assert models["user_margin"] is UserMargin

    def test_user_margin_get_schema(self):
        from app.models.user_models import UserMargin

        assert UserMargin.get_schema() == "public"


# ---------------------------------------------------------------------------
# E2E: sqlite create_all
# ---------------------------------------------------------------------------


class TestUserE2E:
    """User / UserMargin e2e 在 sqlite 上能 create_all."""

    def test_user_create_all(self):
        from app.models.user_models import User

        eng = create_engine("sqlite:///:memory:")
        User.__table__.create(eng, checkfirst=True)
        with eng.connect() as conn:
            rows = conn.execute(
                sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            ).fetchall()
            assert len(rows) == 1

    def test_user_margin_create_all(self):
        from app.models.user_models import UserMargin

        eng = create_engine("sqlite:///:memory:")
        UserMargin.__table__.create(eng, checkfirst=True)
        with eng.connect() as conn:
            rows = conn.execute(
                sa.text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_margin'")
            ).fetchall()
            assert len(rows) == 1

    def test_user_metadata_for_tenant(self):
        from app.models.user_models import User

        md = User.metadata_for_tenant(7)
        found = None
        for tbl in md.tables.values():
            if tbl.name == "users" and tbl.schema == "tenant_7":
                found = tbl
                break
        assert found is not None
        # 字段都复制
        col_names = {c.name for c in found.columns}
        assert "uuid" in col_names
        assert "nickname" in col_names
        assert "is_vip" in col_names


# ---------------------------------------------------------------------------
# 兼容性: 未迁移的表 (UserAuthInfo 等) 仍用 Base
# ---------------------------------------------------------------------------


class TestBackwardCompatibility:
    """未迁移的表 (UserAuthInfo 等) 仍继承 Base (不在 _tenant_models 中)."""

    def test_user_auth_info_still_uses_base(self):
        from app.database import Base
        from app.models.user_models import UserAuthInfo
        from app.orm.tenant_base import TenantBase

        assert issubclass(UserAuthInfo, Base)
        assert not issubclass(UserAuthInfo, TenantBase)

    def test_get_tenant_models_excludes_non_tenant(self):
        from app.orm.tenant_base import get_tenant_models

        models = get_tenant_models()
        # UserAuthInfo 不在 _tenant_models 中
        assert "user_auth_info" not in models


# ---------------------------------------------------------------------------
# 跨表查询不破坏
# ---------------------------------------------------------------------------


class TestCrossTableIntegrity:
    """TenantBase 和 Base 的表能在同一 Base.metadata 中并存."""

    def test_both_in_same_metadata(self):
        from app.database import Base
        from app.models.user_models import User, UserAuthInfo

        # 强制 mapper 注册 (通过访问 __table__)
        _ = User.__table__
        _ = UserAuthInfo.__table__
        # 核心断言 1: 两张表都注册在 Base.metadata 中
        names = {t.name for t in Base.metadata.tables.values()}
        assert "users" in names, f"users 表缺失, names={sorted(names)[:5]}..."
        assert "user_auth_info" in names
        # 核心断言 2: 共享同一 Base.metadata
        assert User.__table__.metadata is Base.metadata
        assert UserAuthInfo.__table__.metadata is Base.metadata
        # 核心断言 3: TenantBase 注入的 schema 在 __table_args__ 层
        # (conftest 只清运行时 Table.schema, 不清 __table_args__ 源码层)
        args = User.__table_args__
        schema_in_args = None
        for item in (args if isinstance(args, tuple) else (args,)):
            if isinstance(item, dict) and "schema" in item:
                schema_in_args = item["schema"]
                break
        assert schema_in_args == "public"
        # UserAuthInfo 未迁移, 没有 schema (默认继承 Base)
