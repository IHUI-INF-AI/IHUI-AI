"""建议 129 测试: 多租户迁移 CI 集成验证."""

import re
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# CI YAML 验证
# ---------------------------------------------------------------------------


class TestCIYAMLContains:
    """CI yaml 应包含多租户迁移 job."""

    @pytest.fixture
    def ci_yaml(self):
        p = Path(__file__).resolve().parent.parent / ".github" / "workflows" / "ci.yml"
        return p.read_text(encoding="utf-8")

    def test_ci_yaml_exists(self):
        p = Path(__file__).resolve().parent.parent / ".github" / "workflows" / "ci.yml"
        assert p.exists()

    def test_tenant_migrate_job_present(self, ci_yaml):
        assert "tenant-migrate:" in ci_yaml, "应包含 tenant-migrate job"
        assert "Multi-Tenant Migration" in ci_yaml, "应包含 job name"

    def test_depends_on_alembic(self, ci_yaml):
        """tenant-migrate 应依赖 alembic-migrate."""
        # 简单解析: 找 tenant-migrate block
        m = re.search(r"tenant-migrate:.*?(?=\n  \w[\w-]+:|\Z)", ci_yaml, re.DOTALL)
        assert m is not None
        block = m.group()
        assert "needs:" in block
        assert "alembic-migrate" in block

    def test_runs_migrate_tenants_py(self, ci_yaml):
        assert "migrate_tenants.py" in ci_yaml

    def test_runs_dryrun_script(self, ci_yaml):
        assert "migrate_tenant_dryrun.py" in ci_yaml

    def test_runs_relevant_tests(self, ci_yaml):
        for t in (
            "test_migrate_tenants",
            "test_canary_stages",
            "test_canary_routes",
            "test_tenant_base_migration",
        ):
            assert t in ci_yaml, f"应跑 {t}"

    def test_runs_cli_smoke(self, ci_yaml):
        assert "--list" in ci_yaml or "CLI 入口 smoke" in ci_yaml

    def test_uses_sqlite_for_dry_run(self, ci_yaml):
        """dry-run 应不依赖真实 DB."""
        assert "sqlite:///:memory:" in ci_yaml or "sqlite" in ci_yaml.lower()


# ---------------------------------------------------------------------------
# migrate_tenants.py 脚本可执行
# ---------------------------------------------------------------------------


class TestMigrateScriptImportable:
    """migrate_tenants.py 应可被 import."""

    def test_import_migrate_tenants(self):
        from scripts.ci import migrate_tenants

        assert hasattr(migrate_tenants, "main")
        assert hasattr(migrate_tenants, "migrate_one_tenant")
        assert hasattr(migrate_tenants, "migrate_all_tenants")
        assert hasattr(migrate_tenants, "list_active_tenants")

    def test_import_migrate_dryrun(self):
        from scripts.ci import migrate_tenant_dryrun

        assert hasattr(migrate_tenant_dryrun, "main")
        assert hasattr(migrate_tenant_dryrun, "dryrun_one_tenant")
        assert hasattr(migrate_tenant_dryrun, "print_dryrun_report")


# ---------------------------------------------------------------------------
# 端到端 CI 模拟: 跑 dry-run + 跑测试 (与 CI 步骤一致)
# ---------------------------------------------------------------------------


class TestEndToEndCISimulation:
    """模拟 CI 步骤: dry-run + 测试."""

    def test_dryrun_with_multiple_tenants(self, capsys):
        """模拟 CI 中 dry-run 多个 tenant."""

        from sqlalchemy import create_engine

        from scripts.ci.migrate_tenant_dryrun import dryrun_one_tenant

        eng = create_engine("sqlite:///:memory:")
        for tid in [1, 2, 3]:
            plan = dryrun_one_tenant(eng, tid, "head")
            assert plan["tenant_id"] == tid
            assert plan["schema"] == f"tenant_{tid}"

    def test_list_active_for_cli_smoke(self, capsys):
        """模拟 CI 中 --list."""
        from sqlalchemy import create_engine

        from scripts.ci import migrate_tenants as mt

        eng = create_engine("sqlite:///:memory:")
        # 空表
        assert mt.list_active_tenants(eng) == []


# ---------------------------------------------------------------------------
# 集成: 与 canary 联动 (建议 130 准备)
# ---------------------------------------------------------------------------


class TestMigrateCanaryIntegration:
    """多租户迁移 + Canary 联动 (建议 130 准备)."""

    def test_migrate_completion_can_emit_canary_event(self):
        """迁移完成后可发 canary traffic 事件 (用于阶段化门控)."""
        from app.canary_stages import CanaryStageController

        ctrl = CanaryStageController(cooldown_seconds=0)
        # 模拟迁移完: 提升到 10%
        ctrl.promote(reason="迁移完成")
        ctrl.promote(reason="迁移完成")
        assert ctrl.current_ratio() == 0.10
        # 报告流量
        ctrl.mark_traffic(100)
        assert ctrl.state().total_traffic_in_stage == 100
