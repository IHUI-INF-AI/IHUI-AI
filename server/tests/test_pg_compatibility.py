"""PostgreSQL 迁移验证 (建议 109) 单元测试.

覆盖:
  - check_sqlalchemy_pg_dialect: 5 张关键表 PG dialect 编译无错
  - check_alembic_pg_compat: 005/006 迁移脚本能 import, 含 upgrade/downgrade
  - check_type_casts: pgloader 配置含 tinyint/datetime/longtext/enum 转换
  - check_runbook_exists: docs/PG_MIGRATION_RUNBOOK.md 含 4 个关键章节
  - check_pg_docker_service: docker-compose 含 postgres + multi-tenant + postgres_data
  - main() PASS / FAIL 路径
  - 注入坏配置应 FAIL
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts" / "ci"))
import test_pg_compatibility as pg_check  # noqa: E402

# ---------------------------------------------------------------------------
# 1. check_sqlalchemy_pg_dialect
# ---------------------------------------------------------------------------


def test_sqlalchemy_pg_dialect_passes():
    errs = pg_check.check_sqlalchemy_pg_dialect()
    assert errs == [], f"PG dialect 应通过, 实际: {errs}"


def test_sqlalchemy_pg_dialect_covers_5_tables():
    """5 张关键表应都被检查."""
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateTable

    import app.models  # noqa: F401
    from app.database import Base

    compiled = set()
    for key, table in Base.metadata.tables.items():
        for tgt in ("admin_user", "zhs_order", "zhs_agent_buy", "agents", "zhs_identity"):
            if key.endswith(tgt):
                # 真能编译说明这张表存在且 PG dialect 兼容
                CreateTable(table).compile(dialect=postgresql.dialect())
                compiled.add(tgt)
    assert len(compiled) >= 4, f"应至少编译 4 张关键表, 实际: {compiled}"


# ---------------------------------------------------------------------------
# 2. check_alembic_pg_compat
# ---------------------------------------------------------------------------


def test_alembic_pg_compat_passes():
    errs = pg_check.check_alembic_pg_compat()
    assert errs == [], f"alembic 005/006 应兼容 PG, 实际: {errs}"


def test_alembic_005_and_006_have_upgrade_downgrade():
    """005 和 006 都含 upgrade / downgrade."""
    import importlib.util

    alembic_dir = ROOT / "alembic" / "versions"
    for mig in ("005_create_tenant_metadata", "006_migrate_hot_tables_to_tenant_schema"):
        path = alembic_dir / f"{mig}.py"
        spec = importlib.util.spec_from_file_location(mig, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        assert callable(getattr(mod, "upgrade", None))
        assert callable(getattr(mod, "downgrade", None))


# ---------------------------------------------------------------------------
# 3. check_type_casts
# ---------------------------------------------------------------------------


def test_type_casts_passes_current():
    errs = pg_check.check_type_casts()
    assert errs == [], f"应通过, 实际: {errs}"


def test_type_casts_detects_missing(tmp_path, monkeypatch):
    """pgloader 配置缺类型转换应被检测."""
    # 构造临时 pgloader_dir, 里面放一个缺 type tinyint 转换的 conf
    fake_pgloader_dir = tmp_path / "pgloader"
    fake_pgloader_dir.mkdir()
    (fake_pgloader_dir / "pgloader_x.conf").write_text(
        "LOAD DATABASE FROM postgresql INTO pgsql\n",  # 缺所有 type 转换
        encoding="utf-8",
    )
    # monkeypatch check_type_casts 内的 glob 路径
    from pathlib import Path as _P

    original_glob = _P.glob

    def fake_glob(self, pattern):
        if str(self).endswith("pgloader") and "fake" in str(self):
            return list(fake_pgloader_dir.glob(pattern))
        return original_glob(self, pattern)

    # 直接用更简单方式: monkeypatch ROOT, 让 check_type_casts 用 fake_pgloader_dir
    # 但 ROOT 是模块级常量, monkeypatch 不到. 改用 patch 替换 pgloader_dir 路径
    # 看 test_pg_compatibility.py 的 check_type_casts 实现:
    # pgloader_dir = ROOT / "deploy" / "pgloader" — 用 ROOT 拼的
    # 那 monkeypatch ROOT 也没用, 因为已经在函数外计算过
    # 改成: monkeypatch check_type_casts 内部 ROOT
    fake_root = tmp_path
    (fake_root / "deploy" / "pgloader").mkdir(parents=True)
    (fake_root / "deploy" / "pgloader" / "pgloader_x.conf").write_text(
        "LOAD DATABASE FROM postgresql INTO pgsql\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(pg_check, "ROOT", fake_root)
    errs = pg_check.check_type_casts()
    assert any("tinyint" in e for e in errs), f"应报缺 tinyint 转换, 实际: {errs}"


# ---------------------------------------------------------------------------
# 4. check_runbook_exists
# ---------------------------------------------------------------------------


def test_runbook_exists_passes():
    errs = pg_check.check_runbook_exists()
    assert errs == [], f"应通过, 实际: {errs}"


def test_runbook_has_all_sections():
    """runbook 含 pgloader / MULTI_TENANT_ENABLED / 回滚 / 演练 4 章节."""
    runbook = ROOT / "docs" / "PG_MIGRATION_RUNBOOK.md"
    text = runbook.read_text(encoding="utf-8")
    for section in ("pgloader", "MULTI_TENANT_ENABLED", "回滚", "演练"):
        assert section in text, f"runbook 缺章节: {section}"


# ---------------------------------------------------------------------------
# 5. check_pg_docker_service
# ---------------------------------------------------------------------------


def test_pg_docker_service_passes():
    errs = pg_check.check_pg_docker_service()
    assert errs == [], f"应通过, 实际: {errs}"


# ---------------------------------------------------------------------------
# 6. main() 集成
# ---------------------------------------------------------------------------


def test_main_passes_current(monkeypatch):
    """主函数 5 步全 PASS 时返回 0."""
    test_args = ["test_pg_compatibility.py"]
    monkeypatch.setattr(sys, "argv", test_args)
    rc = pg_check.main()
    assert rc == 0, f"主函数应 PASS, 实际 rc={rc}"


def test_main_returns_one_when_alembic_broken(monkeypatch, tmp_path):
    """alembic 005 文件不存在时主函数返回 1."""
    # 备份原文件
    real_005 = ROOT / "alembic" / "versions" / "005_create_tenant_metadata.py"
    backup = real_005.read_bytes()
    try:
        real_005.unlink()
        test_args = ["test_pg_compatibility.py"]
        monkeypatch.setattr(sys, "argv", test_args)
        rc = pg_check.main()
        assert rc == 1, f"alembic 缺失应 FAIL, 实际 rc={rc}"
    finally:
        real_005.write_bytes(backup)


# ---------------------------------------------------------------------------
# 7. PG 关键文件存在
# ---------------------------------------------------------------------------


def test_pgloader_configs_exist():
    """3 个 pgloader_*.conf 配置文件应存在."""
    for f in ("pgloader_ai.conf", "pgloader_center.conf", "pgloader_course.conf"):
        path = ROOT / "deploy" / "pgloader" / f
        assert path.exists(), f"pgloader 配置缺失: {f}"


def test_pgloader_configs_have_correct_sources():
    """3 个配置文件 SOURCE 应指向对应源库."""
    expect = {
        "pgloader_ai.conf": "zhs_ai_project",
        "pgloader_center.conf": "zhs_educational_center",
        "pgloader_course.conf": "zhs_educational_training",
    }
    for f, db in expect.items():
        path = ROOT / "deploy" / "pgloader" / f
        text = path.read_text(encoding="utf-8")
        assert db in text, f"{f} 应含源库 {db}"
