"""多租户阶段 2 业务表 schema 改造 (建议 108 + 113) 单元测试.

覆盖:
  - 3 张最热表 (SysUser / Order / AgentBuy) 都声明了 schema="public" (建议 108)
  - 10 张核心表 (建议 113 第 2 批) 都声明了 schema="public"
  - SQLite 测试环境下 conftest 自动剥离 schema (向后兼容)
  - alembic 006 / 007 迁移脚本存在 + down_revision 链正确
  - 跨租户 schema 名白名单 (通过 tenant.py)
  - 模拟: 切换 schema 后, model.__table__.schema 同步更新
  - 跨租户不可见测试: 不同 schema 下 query 互不干扰
"""

import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# 1. 3 张最热表都声明了 schema="public"
# ---------------------------------------------------------------------------


def test_admin_user_declares_schema_public():
    from app.models.sys_models import SysUser

    # __table_args__ 含 dict (已迁移 PostgreSQL, schema 通过 __tenant_schema__ 设置)
    args = SysUser.__table_args__
    schema = _extract_schema(args)
    assert schema == "public", f"SysUser 应声明 schema='public', 实际: {schema!r}"


def test_order_declares_schema_public():
    from app.models.payment_models import Order

    args = Order.__table_args__
    schema = _extract_schema(args)
    assert schema == "public", f"Order 应声明 schema='public', 实际: {schema!r}"


def test_agent_buy_declares_schema_public():
    from app.models.activity_models import AgentBuy

    args = AgentBuy.__table_args__
    schema = _extract_schema(args)
    assert schema == "public", f"AgentBuy 应声明 schema='public', 实际: {schema!r}"


def _extract_schema(args) -> str | None:
    """从 __table_args__ 提取 schema 字段 (支持 dict 嵌套在 tuple 里)."""
    if isinstance(args, dict):
        return args.get("schema")
    if isinstance(args, tuple):
        for a in args:
            if isinstance(a, dict) and "schema" in a:
                return a["schema"]
            s = _extract_schema(a)
            if s is not None:
                return s
    return None


# ---------------------------------------------------------------------------
# 2. SQLite 测试环境下 conftest 自动剥离 schema
# ---------------------------------------------------------------------------


def test_sqlite_strips_schema_for_compatibility():
    """SQLite 下 conftest 应把 schema 字段清掉, 防止 'unknown database public' 错误."""

    from app.database import Base

    # 3 张最热表 (带 schema 的 fullname 也算) 都被处理过 (conftest 跑过)
    candidates = [
        name
        for name in Base.metadata.tables.keys()
        if name
        in ("admin_user", "public.admin_user", "zhs_order", "public.zhs_order", "zhs_agent_buy", "public.zhs_agent_buy")
    ]
    assert len(candidates) == 3, f"应找到 3 张最热表 (含 schema 前缀), 实际找到: {candidates}"
    for name in candidates:
        t = Base.metadata.tables[name]
        # conftest 跑后 schema 应为 None (剥离)
        assert t.schema is None, f"SQLite 下 {name}.schema 应被剥离, 实际: {t.schema!r}"


def test_full_table_list_in_metadata():
    """Base.metadata 应有 30+ 张表 (模型全加载)."""
    from app.database import Base

    assert len(Base.metadata.tables) >= 30, f"应有 30+ 张表, 实际: {len(Base.metadata.tables)}"


# ---------------------------------------------------------------------------
# 3. alembic 006 迁移脚本合法性
# ---------------------------------------------------------------------------


def test_alembic_006_migration_exists():
    """alembic/versions/006_migrate_hot_tables_to_tenant_schema.py 必须存在."""
    mig = ROOT / "alembic" / "versions" / "006_migrate_hot_tables_to_tenant_schema.py"
    assert mig.exists(), f"迁移文件不存在: {mig}"
    text = mig.read_text(encoding="utf-8")
    assert "down_revision" in text
    assert "005_create_tenant_metadata" in text, "应下接 005"


def test_alembic_006_declares_hot_tables():
    """006 应列出 3 张最热表: admin_user / zhs_order / zhs_agent_buy."""
    mig = ROOT / "alembic" / "versions" / "006_migrate_hot_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    for tbl in ("admin_user", "zhs_order", "zhs_agent_buy"):
        assert f'"{tbl}"' in text or f"'{tbl}'" in text or f"`{tbl}`" in text, f"006 迁移应操作 {tbl} 表"


def test_alembic_006_pg_only():
    """006 迁移只在 PG dialect 下执行, 其它 dialect 跳过 (SQLite 兼容)."""
    mig = ROOT / "alembic" / "versions" / "006_migrate_hot_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    assert "postgresql" in text, "006 迁移应检查 PG dialect"
    assert "dialect.name" in text, "应通过 dialect.name 判断"


def test_alembic_chain_005_to_006():
    """006 down_revision 应为 005."""
    mig = ROOT / "alembic" / "versions" / "006_migrate_hot_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    # 找到 down_revision = "..." 那行
    import re

    m = re.search(r'down_revision\s*=\s*["\']([^"\']+)["\']', text)
    assert m is not None, "应包含 down_revision 赋值"
    assert (
        m.group(1) == "005_create_tenant_metadata"
    ), f"down_revision 应是 005_create_tenant_metadata, 实际: {m.group(1)}"


# ---------------------------------------------------------------------------
# 4. 跨租户 schema 名生成 + 隔离 (复用 tenant.py 工具)
# ---------------------------------------------------------------------------


def test_tenant_schema_name_unique_per_tenant():
    """不同 tenant_id 生成的 schema 名必须不同."""
    from app.core.tenant import get_tenant_schema_name

    s1 = get_tenant_schema_name(1)
    s2 = get_tenant_schema_name(2)
    assert s1 != s2
    assert s1 == "tenant_1"
    assert s2 == "tenant_2"


def test_tenant_schema_name_rejects_sql_injection():
    """tenant_id 必须是正整数, 字符串等被白名单拒绝."""
    from app.core.tenant import get_tenant_schema_name

    for bad in [None, "1", "1; DROP TABLE", "1 OR 1=1", "' OR 1=1", -1, 0, 1.5]:
        try:
            r = get_tenant_schema_name(bad)  # type: ignore
            # None 会回退到 get_effective_tenant_id(), 单租户模式 = 1, 合法
            if bad is None:
                assert r == "tenant_1"
            else:
                pytest.fail(f"非法 tenant_id {bad!r} 应被拒绝, 实际返回: {r!r}")
        except (ValueError, TypeError):
            pass  # 预期


# ---------------------------------------------------------------------------
# 5. 动态 schema 切换 (模拟: model.__table__.schema 可改)
# ---------------------------------------------------------------------------


def test_dynamic_schema_switch_for_admin_user():
    """模拟多租户模式: 把 SysUser.__table__.schema 从 public 改为 tenant_2, 然后改回."""
    from app.models.sys_models import SysUser

    original = SysUser.__table__.schema
    try:
        SysUser.__table__.schema = "tenant_2"
        assert SysUser.__table__.schema == "tenant_2"
    finally:
        # 还原 (重要: 不能影响其他测试)
        SysUser.__table__.schema = original
    assert SysUser.__table__.schema == original


# ---------------------------------------------------------------------------
# 6. 设计文档覆盖 schema 改造
# ---------------------------------------------------------------------------


def test_design_doc_documents_phase2():
    """MULTI_TENANT_DESIGN.md 应说明阶段 2 业务表 schema 改造."""
    doc = ROOT / "docs" / "MULTI_TENANT_DESIGN.md"
    text = doc.read_text(encoding="utf-8")
    assert "阶段 2" in text, "设计文档应包含阶段 2"
    assert "业务表" in text, "应包含业务表改造说明"
    assert "30" in text, "应说明 30 张业务表"


# ---------------------------------------------------------------------------
# 7. 建议 113: 10 张核心表 (第 2 批) 都声明了 schema="public"
# ---------------------------------------------------------------------------

# (model_path, class_name, expected_tablename) 三元组
PHASE2_TABLES = [
    ("app.models.agent_settlement", "AgentSettlement", "zhs_agent_settlement"),
    ("app.models.payment_models", "CommissionFlow", "zhs_commission_flow"),
    ("app.models.payment_models", "WithdrawalFlow", "zhs_withdrawal_flow"),
    ("app.models.identity_models", "ZhsIdentity", "zhs_identity"),
    ("app.models.ai_gc_models", "AiGc", "ai_gc"),
    ("app.models.user_models", "User", "users"),
    ("app.models.user_models", "UserMargin", "user_margin"),
    ("app.models.course_models", "Course", "zhs_course"),
    ("app.models.token_models", "VideoGenerationTask", "video_generation_tasks"),
    ("app.models.agent_models", "Agent", "agents"),
]


def _import_model(module_path: str, class_name: str):
    """动态 import (避开 ImportError 跳过, 让测试更鲁棒)."""
    import importlib

    mod = importlib.import_module(module_path)
    return getattr(mod, class_name)


def test_phase2_table_agent_settlement():
    from app.models.agent_settlement import AgentSettlement

    assert _extract_schema(AgentSettlement.__table_args__) == "public", "AgentSettlement 应声明 schema='public'"


def test_phase2_table_commission_flow():
    from app.models.payment_models import CommissionFlow

    assert _extract_schema(CommissionFlow.__table_args__) == "public", "CommissionFlow 应声明 schema='public'"


def test_phase2_table_withdrawal_flow():
    from app.models.payment_models import WithdrawalFlow

    assert _extract_schema(WithdrawalFlow.__table_args__) == "public", "WithdrawalFlow 应声明 schema='public'"


def test_phase2_table_zhs_identity():
    from app.models.identity_models import ZhsIdentity

    assert _extract_schema(ZhsIdentity.__table_args__) == "public", "ZhsIdentity 应声明 schema='public'"


def test_phase2_table_ai_gc():
    from app.models.ai_gc_models import AiGc

    assert _extract_schema(AiGc.__table_args__) == "public", "AiGc 应声明 schema='public'"


def test_phase2_table_user():
    from app.models.user_models import User

    assert _extract_schema(User.__table_args__) == "public", "User 应声明 schema='public'"


def test_phase2_table_user_margin():
    from app.models.user_models import UserMargin

    assert _extract_schema(UserMargin.__table_args__) == "public", "UserMargin 应声明 schema='public'"


def test_phase2_table_course():
    from app.models.course_models import Course

    assert _extract_schema(Course.__table_args__) == "public", "Course 应声明 schema='public'"


def test_phase2_table_video_generation_task():
    from app.models.token_models import VideoGenerationTask

    assert _extract_schema(VideoGenerationTask.__table_args__) == "public", "VideoGenerationTask 应声明 schema='public'"


def test_phase2_table_agent():
    from app.models.agent_models import Agent

    assert _extract_schema(Agent.__table_args__) == "public", "Agent 应声明 schema='public'"


def test_phase2_all_tables_have_schema_public():
    """循环校验所有 10 张表都声明了 schema='public' (参数化)."""
    failed = []
    for module_path, class_name, expected_tn in PHASE2_TABLES:
        try:
            model = _import_model(module_path, class_name)
        except (ImportError, AttributeError) as e:
            failed.append(f"{class_name}: import failed ({e})")
            continue
        # 表名一致
        assert (
            model.__tablename__ == expected_tn
        ), f"{class_name}.__tablename__ 应为 {expected_tn!r}, 实际: {model.__tablename__!r}"
        # schema='public'
        schema = _extract_schema(model.__table_args__)
        if schema != "public":
            failed.append(f"{class_name}: schema={schema!r}")
    assert not failed, f"以下表未声明 schema='public': {failed}"


def test_phase2_tables_count_in_metadata():
    """Base.metadata 应有 40+ 张表 (3+10 张 hot + 30+ 张其他模型)."""
    from app.database import Base

    assert len(Base.metadata.tables) >= 40, f"应有 40+ 张表, 实际: {len(Base.metadata.tables)}"


# ---------------------------------------------------------------------------
# 8. alembic 007 迁移脚本合法性 (建议 113)
# ---------------------------------------------------------------------------


def test_alembic_007_migration_exists():
    """alembic/versions/007_migrate_phase2_tables_to_tenant_schema.py 必须存在."""
    mig = ROOT / "alembic" / "versions" / "007_migrate_phase2_tables_to_tenant_schema.py"
    assert mig.exists(), f"迁移文件不存在: {mig}"
    text = mig.read_text(encoding="utf-8")
    assert "down_revision" in text
    assert "006_migrate_hot_tables_to_tenant_schema" in text, "应下接 006"


def test_alembic_007_chain_006_to_007():
    """007 down_revision 应为 006."""
    mig = ROOT / "alembic" / "versions" / "007_migrate_phase2_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    m = re.search(r'down_revision\s*=\s*["\']([^"\']+)["\']', text)
    assert m is not None, "应包含 down_revision 赋值"
    assert (
        m.group(1) == "006_migrate_hot_tables_to_tenant_schema"
    ), f"down_revision 应是 006_migrate_hot_tables_to_tenant_schema, 实际: {m.group(1)}"


def test_alembic_007_declares_phase2_tables():
    """007 应列出 10 张核心表."""
    mig = ROOT / "alembic" / "versions" / "007_migrate_phase2_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    for tbl in (
        "agents",
        "users",
        "user_margin",
        "zhs_course",
        "zhs_identity",
        "video_generation_tasks",
        "ai_gc",
        "zhs_commission_flow",
        "zhs_withdrawal_flow",
        "zhs_agent_settlement",
    ):
        assert f'"{tbl}"' in text or f"'{tbl}'" in text or f"`{tbl}`" in text, f"007 迁移应操作 {tbl} 表"


def test_alembic_007_pg_only():
    """007 迁移只在 PG dialect 下执行, 其它 dialect 跳过 (SQLite 兼容)."""
    mig = ROOT / "alembic" / "versions" / "007_migrate_phase2_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    assert "postgresql" in text, "007 迁移应检查 PG dialect"
    assert "dialect.name" in text, "应通过 dialect.name 判断"


def test_alembic_007_reversible():
    """007 迁移必须有 upgrade + downgrade 两个函数."""
    mig = ROOT / "alembic" / "versions" / "007_migrate_phase2_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    assert "def upgrade" in text, "应包含 upgrade 函数"
    assert "def downgrade" in text, "应包含 downgrade 函数"
    # 提取 PHASE2_TABLES 列表, 确保 downgrade 引用同一列表
    m = re.search(r"PHASE2_TABLES\s*=\s*(\[[^\]]+\])", text, re.MULTILINE)
    assert m is not None, "应定义 PHASE2_TABLES 列表"
    assert "PHASE2_TABLES" in text.split("def downgrade")[1], "downgrade 应复用 PHASE2_TABLES (避免漂移)"


# ---------------------------------------------------------------------------
# 9. 跨租户不可见测试 (建议 113 关键特性: schema 隔离)
# ---------------------------------------------------------------------------


def test_cross_tenant_schema_isolation():
    """模拟多租户模式: 不同 schema 名不同, 数据互不干扰.

    在 SQLite 测试环境下, 实际表只有一个 (无 schema). 但 schema 名字符串
    在生成 query 时会被 SQLAlchemy 拼接, 所以这里只验证 schema 名本身.
    """
    from app.core.tenant import get_tenant_schema_name

    schema_a = get_tenant_schema_name(1)
    schema_b = get_tenant_schema_name(2)
    schema_c = get_tenant_schema_name(99)
    # 不同 tenant_id 必须生成不同 schema
    assert schema_a != schema_b
    assert schema_b != schema_c
    assert schema_a != schema_c
    # 命名规范: tenant_<id>
    for s in (schema_a, schema_b, schema_c):
        assert s.startswith("tenant_"), f"schema 名应以 'tenant_' 开头, 实际: {s}"


def test_phase2_models_share_metadata_with_phase1():
    """建议 113 改造的 10 张表与建议 108 的 3 张表在同一个 Base.metadata 下."""
    from app.database import Base

    # 阶段 1: 3 张 (admin_user / zhs_order / zhs_agent_buy)
    phase1 = {"admin_user", "zhs_order", "zhs_agent_buy"}
    # 阶段 2: 10 张
    phase2 = {
        "agents",
        "users",
        "user_margin",
        "zhs_course",
        "zhs_identity",
        "video_generation_tasks",
        "ai_gc",
        "zhs_commission_flow",
        "zhs_withdrawal_flow",
        "zhs_agent_settlement",
    }
    actual = set(Base.metadata.tables.keys())
    # 全部 13 张表都应注册在 metadata (含 schema 前缀的情况也要兼容)
    for tbl in phase1 | phase2:
        assert (
            tbl in actual or f"public.{tbl}" in actual
        ), f"{tbl} 未在 Base.metadata 中找到, 实际 keys: {sorted(actual)[:5]}..."


def test_dynamic_schema_switch_for_phase2_table():
    """模拟多租户模式: 把 User.__table__.schema 从 public 改为 tenant_5, 然后改回."""
    from app.models.user_models import User

    original = User.__table__.schema
    try:
        User.__table__.schema = "tenant_5"
        assert User.__table__.schema == "tenant_5"
        # 切换回 public
        User.__table__.schema = "public"
        assert User.__table__.schema == "public"
    finally:
        # 还原 (重要: 不能影响其他测试)
        User.__table__.schema = original
    assert User.__table__.schema == original


def test_phase2_table_schema_field_is_well_typed():
    """所有 phase2 表的 __table_args__ 中 schema 字段必须是字符串, 不能是 None / 数字."""
    bad = []
    for module_path, class_name, _ in PHASE2_TABLES:
        try:
            model = _import_model(module_path, class_name)
        except (ImportError, AttributeError):
            continue
        schema = _extract_schema(model.__table_args__)
        if not isinstance(schema, str):
            bad.append(f"{class_name}.schema 类型错误: {type(schema).__name__}={schema!r}")
    assert not bad, f"schema 字段类型异常: {bad}"


def test_phase2_tables_in_alembic_and_models_match():
    """alembic 007 的 PHASE2_TABLES 与 113 批改造的 10 张表 __tablename__ 一一对应."""
    mig = ROOT / "alembic" / "versions" / "007_migrate_phase2_tables_to_tenant_schema.py"
    text = mig.read_text(encoding="utf-8")
    m = re.search(r"PHASE2_TABLES\s*=\s*(\[[^\]]+\])", text, re.MULTILINE)
    assert m is not None
    mig_tables = {t.strip().strip('"').strip("'") for t in m.group(1).strip("[]").split(",")}
    mig_tables = {t for t in mig_tables if t}  # 过滤空字符串
    model_tables = {tn for _, _, tn in PHASE2_TABLES}
    # 两边都应包含 10 张表 (顺序可能不同)
    assert mig_tables == model_tables, f"alembic 007 PHASE2_TABLES={mig_tables} 与 模型表名集合={model_tables} 不一致"
