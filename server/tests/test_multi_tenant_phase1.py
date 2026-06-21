"""多租户改造 - 阶段 1 基础设施 (建议 102) 单元测试.

覆盖:
  - app.core.tenant: ContextVar / 工具函数 / 白名单校验
  - app.core.tenant_filter: search_path 路由注册 / 重复保护
  - app.security: JWT 含 tenant_id 字段自动注入 ContextVar
  - 单租户模式向后兼容 (所有函数不抛, 默认 tenant=1)
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _reset_tenant_state():
    """每个测试前后清空 ContextVar + routing 注册表, 防测试间污染."""
    from app.core import tenant, tenant_filter

    tenant.reset_current_tenant_id()
    tenant_filter.reset_registration_state()
    yield
    tenant.reset_current_tenant_id()
    tenant_filter.reset_registration_state()


# ---------------------------------------------------------------------------
# 1. ContextVar 基础行为
# ---------------------------------------------------------------------------


def test_get_current_tenant_id_default_none():
    """未 set 时返回 None (系统调用场景)."""
    from app.core.tenant import get_current_tenant_id

    assert get_current_tenant_id() is None


def test_set_and_get_current_tenant_id():
    """set 后 get 能拿到."""
    from app.core.tenant import get_current_tenant_id, set_current_tenant_id

    set_current_tenant_id(7)
    assert get_current_tenant_id() == 7


def test_reset_current_tenant_id():
    """reset 后回到 None."""
    from app.core.tenant import (
        get_current_tenant_id,
        reset_current_tenant_id,
        set_current_tenant_id,
    )

    set_current_tenant_id(99)
    assert get_current_tenant_id() == 99
    reset_current_tenant_id()
    assert get_current_tenant_id() is None


def test_set_none_resets():
    """set_current_tenant_id(None) 等价 reset."""
    from app.core.tenant import (
        get_current_tenant_id,
        set_current_tenant_id,
    )

    set_current_tenant_id(1)
    set_current_tenant_id(None)
    assert get_current_tenant_id() is None


# ---------------------------------------------------------------------------
# 2. 输入校验
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("bad_value", [0, -1, -100, 100_000_000, 999_999_999])
def test_set_invalid_int_raises(bad_value):
    """<=0 或超出白名单的整数应抛 ValueError."""
    from app.core.tenant import set_current_tenant_id

    with pytest.raises(ValueError, match="tenant_id"):
        set_current_tenant_id(bad_value)


@pytest.mark.parametrize("bad_value", [True, False, 1.5, "1", [], {}, object()])
def test_set_non_int_raises(bad_value):
    """非整数 / bool 应抛 ValueError."""
    from app.core.tenant import set_current_tenant_id

    with pytest.raises(ValueError, match="tenant_id"):
        set_current_tenant_id(bad_value)


# ---------------------------------------------------------------------------
# 3. get_tenant_schema_name 白名单
# ---------------------------------------------------------------------------


def test_get_tenant_schema_name_default():
    """tid=1 -> 'tenant_1'."""
    from app.core.tenant import get_tenant_schema_name

    assert get_tenant_schema_name(1) == "tenant_1"


def test_get_tenant_schema_name_uses_context_when_none(monkeypatch):
    """传 None 时用 ContextVar 当前值 (多租户模式)."""
    from app.config import settings
    from app.core.tenant import get_tenant_schema_name, set_current_tenant_id

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True)
    set_current_tenant_id(42)
    assert get_tenant_schema_name(None) == "tenant_42"


@pytest.mark.parametrize("tid,expected", [(1, "tenant_1"), (99, "tenant_99"), (99999999, "tenant_99999999")])
def test_get_tenant_schema_name_valid(tid, expected):
    from app.core.tenant import get_tenant_schema_name

    assert get_tenant_schema_name(tid) == expected


def test_get_tenant_schema_name_rejects_overflow():
    """超过白名单上限应抛."""
    from app.core.tenant import get_tenant_schema_name

    with pytest.raises(ValueError, match="非法"):
        get_tenant_schema_name(100_000_000)


# ---------------------------------------------------------------------------
# 4. get_effective_tenant_id (单租户/多租户)
# ---------------------------------------------------------------------------


def test_effective_tenant_id_single_tenant_mode(monkeypatch):
    """单租户模式 (默认): 永远返回 1."""
    from app.config import settings
    from app.core import tenant

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", False)
    tenant.set_current_tenant_id(99)  # 即便 set 了也忽略
    assert tenant.get_effective_tenant_id() == 1


def test_effective_tenant_id_multi_tenant_with_context(monkeypatch):
    """多租户模式 + 已 set: 返回 ContextVar 值."""
    from app.config import settings
    from app.core import tenant

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True)
    tenant.set_current_tenant_id(5)
    assert tenant.get_effective_tenant_id() == 5


def test_effective_tenant_id_multi_tenant_without_context(monkeypatch):
    """多租户模式 + 未 set: 回退到 1 (默认值)."""
    from app.config import settings
    from app.core import tenant

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True)
    tenant.reset_current_tenant_id()
    assert tenant.get_effective_tenant_id() == 1


# ---------------------------------------------------------------------------
# 5. is_multi_tenant_enabled 开关
# ---------------------------------------------------------------------------


def test_is_multi_tenant_enabled_default_false(monkeypatch):
    """默认 (settings 无 MULTI_TENANT_ENABLED 或 False) 应返回 False."""
    from app.config import settings

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", False)
    from app.core.tenant import is_multi_tenant_enabled

    assert is_multi_tenant_enabled() is False


def test_is_multi_tenant_enabled_true(monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True)
    from app.core.tenant import is_multi_tenant_enabled

    assert is_multi_tenant_enabled() is True


# ---------------------------------------------------------------------------
# 6. tenant_filter 注册 / 卸载
# ---------------------------------------------------------------------------


def test_register_tenant_routing_skipped_single_tenant(monkeypatch):
    """单租户模式: register 应返回 False, 不真注册."""
    from app.config import settings
    from app.core import tenant_filter

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", False)
    from app.database import engine1

    assert tenant_filter.register_tenant_routing(engine1) is False
    assert tenant_filter.get_registration_count() == 0


def test_register_tenant_routing_idempotent(monkeypatch):
    """多租户模式: 重复注册同一 engine 应返回 False."""
    from app.config import settings
    from app.core import tenant_filter

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True)
    from app.database import engine1

    assert tenant_filter.register_tenant_routing(engine1) is True
    assert tenant_filter.register_tenant_routing(engine1) is False
    assert tenant_filter.get_registration_count() == 1


def test_unregister_tenant_routing(monkeypatch):
    """unregister 后能再次 register."""
    from app.config import settings
    from app.core import tenant_filter

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", True)
    from app.database import engine1

    tenant_filter.register_tenant_routing(engine1)
    assert tenant_filter.unregister_tenant_routing(engine1) is True
    assert tenant_filter.get_registration_count() == 0
    assert tenant_filter.register_tenant_routing(engine1) is True


def test_unregister_unregistered_returns_false(monkeypatch):
    """未注册时 unregister 应返回 False."""
    from app.core import tenant_filter
    from app.database import engine1

    assert tenant_filter.unregister_tenant_routing(engine1) is False


def test_database_init_does_not_register_in_single_tenant_mode(monkeypatch):
    """数据库初始化 (database.py 末尾的 _register_tenant_routing_if_enabled) 单租户模式不注册."""
    from app.config import settings
    from app.core import tenant_filter

    monkeypatch.setattr(settings, "MULTI_TENANT_ENABLED", False)
    # 重新触发 (database.py 模块级只执行一次, 这里直接调内部函数)
    from app.database import _register_tenant_routing_if_enabled

    _register_tenant_routing_if_enabled()
    assert tenant_filter.get_registration_count() == 0


# ---------------------------------------------------------------------------
# 7. JWT tenant_id 字段自动注入
# ---------------------------------------------------------------------------


def test_jwt_without_tenant_id_defaults_to_1(monkeypatch):
    """老 token (无 tenant_id 字段) 默认注入 1, 不抛."""
    from datetime import timedelta

    from app.core.tenant import get_current_tenant_id, set_current_tenant_id
    from app.security import create_access_token, decode_access_token

    # 模拟 get_current_user_uuid 的逻辑
    token = create_access_token("u-test", expires_delta=timedelta(minutes=5))
    payload = decode_access_token(token)
    assert payload is not None
    assert "tenant_id" not in payload  # 老 token 没这个字段

    # 用与 get_current_user_uuid 相同的回退逻辑
    tenant_id = payload.get("tenant_id", 1)
    set_current_tenant_id(int(tenant_id))
    assert get_current_tenant_id() == 1


def test_jwt_with_tenant_id_injects_correctly(monkeypatch):
    """新 token (tenant_id=5) 注入 5."""
    from datetime import timedelta

    from app.core.tenant import get_current_tenant_id, set_current_tenant_id
    from app.security import create_access_token, decode_access_token

    token = create_access_token("u-test", expires_delta=timedelta(minutes=5), extra_claims={"tenant_id": 5})
    payload = decode_access_token(token)
    assert payload["tenant_id"] == 5
    set_current_tenant_id(int(payload.get("tenant_id", 1)))
    assert get_current_tenant_id() == 5


def test_jwt_with_invalid_tenant_id_falls_back_to_1(monkeypatch):
    """非法 tenant_id (字符串非数字) 走 except 分支, 注入 1."""
    from datetime import timedelta

    from app.core.tenant import set_current_tenant_id
    from app.security import create_access_token, decode_access_token

    token = create_access_token("u-test", expires_delta=timedelta(minutes=5), extra_claims={"tenant_id": "invalid"})
    payload = decode_access_token(token)
    try:
        set_current_tenant_id(int(payload.get("tenant_id", 1)))
    except (ValueError, TypeError):
        set_current_tenant_id(1)
    from app.core.tenant import get_current_tenant_id

    assert get_current_tenant_id() == 1


# ---------------------------------------------------------------------------
# 8. 设计文档检查
# ---------------------------------------------------------------------------


def test_design_doc_documents_decision():
    """MULTI_TENANT_DESIGN.md 必须包含 3 个决策点的答案."""
    doc_path = ROOT / "docs" / "MULTI_TENANT_DESIGN.md"
    assert doc_path.exists(), f"设计文档不存在: {doc_path}"
    text = doc_path.read_text(encoding="utf-8")
    assert "PostgreSQL Schema 隔离" in text, "设计文档应记录决策: PG Schema 隔离"
    assert "tenant_id 全部填 1" in text or "tenant_id=1" in text, "应记录默认 tenant=1"
    assert "影子流量" in text, "应记录灰度方式: 影子流量"


def test_alembic_migration_005_exists():
    """alembic/versions/005_create_tenant_metadata.py 必须存在."""
    mig = ROOT / "alembic" / "versions" / "005_create_tenant_metadata.py"
    assert mig.exists(), f"迁移文件不存在: {mig}"
    text = mig.read_text(encoding="utf-8")
    assert "admin_tenant" in text
    assert "down_revision" in text
    assert "'004_add_user_uuid'" in text or "004_add_user_uuid" in text


def test_docker_compose_has_postgres():
    """docker-compose.yml 应含 postgres 服务 (阶段 0 用)."""
    compose = ROOT / "deploy" / "docker" / "docker-compose.yml"
    assert compose.exists()
    text = compose.read_text(encoding="utf-8")
    assert "postgres" in text.lower(), "docker-compose 应含 postgres 服务"
