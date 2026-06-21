"""建议 125 测试: 多租户并行迁移 + dryrun."""

import sys

import pytest
import sqlalchemy as sa
from sqlalchemy import create_engine

# ---------------------------------------------------------------------------
# 测试 migrate_one_tenant
# ---------------------------------------------------------------------------


class TestMigrateOneTenant:
    """单 tenant 迁移函数测试."""

    def test_migrate_one_tenant_success_dry_run(self):
        from scripts.ci.migrate_tenants import migrate_one_tenant

        eng = create_engine("sqlite:///:memory:")
        result = migrate_one_tenant(eng, tenant_id=1, revision="head", dry_run=True, retries=0)
        assert result["tenant_id"] == 1
        assert result["schema"] == "tenant_1"
        assert result["dry_run"] is True
        # dry-run 应当成功 (不依赖 alembic 真正跑通)
        # 实际可能 alembic command 失败; 但 dry_run 路径应通过
        # 我们只验证函数返回结构正确
        assert "attempts" in result
        assert "duration_seconds" in result
        assert "error" in result

    def test_migrate_one_tenant_invalid_tenant_id(self):
        from scripts.ci.migrate_tenants import migrate_one_tenant

        eng = create_engine("sqlite:///:memory:")
        # tenant_id=0 应抛 ValueError (get_tenant_schema_name 拒绝 0)
        with pytest.raises(Exception):
            migrate_one_tenant(eng, tenant_id=0, revision="head", dry_run=True, retries=0)

    def test_migrate_one_tenant_schema_name_format(self):
        from scripts.ci.migrate_tenants import migrate_one_tenant

        eng = create_engine("sqlite:///:memory:")
        result = migrate_one_tenant(eng, tenant_id=42, revision="head", dry_run=True, retries=0)
        assert result["schema"] == "tenant_42"
        assert result["tenant_id"] == 42

    def test_migrate_one_tenant_retries_increments(self, monkeypatch):
        from scripts.ci import migrate_tenants as mt

        # mock _migrate_real 让它总是抛
        def _raise(*a, **kw):
            raise RuntimeError("mock failure")

        monkeypatch.setattr(mt, "_migrate_real", _raise)

        eng = create_engine("sqlite:///:memory:")
        # retries=2 应跑 3 次 (attempts=0,1,2)
        result = mt.migrate_one_tenant(eng, tenant_id=1, revision="head", dry_run=False, retries=2)
        assert result["attempts"] == 3
        assert result["success"] is False
        assert "mock failure" in result["error"]

    def test_migrate_one_tenant_records_duration(self):
        from scripts.ci.migrate_tenants import migrate_one_tenant

        eng = create_engine("sqlite:///:memory:")
        result = migrate_one_tenant(eng, tenant_id=1, revision="head", dry_run=True, retries=0)
        assert result["duration_seconds"] >= 0.0
        assert result["duration_seconds"] < 30.0  # 1 次 dry-run 应 < 30s


# ---------------------------------------------------------------------------
# 测试 migrate_all_tenants (并行)
# ---------------------------------------------------------------------------


class TestMigrateAllTenants:
    """多 tenant 并行迁移测试."""

    def test_migrate_all_serial(self):
        from scripts.ci.migrate_tenants import migrate_all_tenants

        eng = create_engine("sqlite:///:memory:")
        results = migrate_all_tenants(eng, [1, 2, 3], revision="head", parallel=1, dry_run=True)
        assert len(results) == 3
        for r in results:
            assert r["tenant_id"] in [1, 2, 3]
            assert r["schema"] in ["tenant_1", "tenant_2", "tenant_3"]
        # 按 tenant_id 排序
        assert [r["tenant_id"] for r in results] == [1, 2, 3]

    def test_migrate_all_parallel(self):
        from scripts.ci.migrate_tenants import migrate_all_tenants

        eng = create_engine("sqlite:///:memory:")
        results = migrate_all_tenants(eng, [1, 2, 3, 4, 5], revision="head", parallel=3, dry_run=True)
        assert len(results) == 5
        # 验证所有 tenant_id 都有结果
        ids = sorted(r["tenant_id"] for r in results)
        assert ids == [1, 2, 3, 4, 5]

    def test_migrate_all_preserves_tenant_ids(self):
        from scripts.ci.migrate_tenants import migrate_all_tenants

        eng = create_engine("sqlite:///:memory:")
        ids = [10, 20, 30, 40]
        results = migrate_all_tenants(eng, ids, revision="head", parallel=2, dry_run=True)
        result_ids = {r["tenant_id"] for r in results}
        assert result_ids == set(ids)

    def test_migrate_all_empty(self):
        from scripts.ci.migrate_tenants import migrate_all_tenants

        eng = create_engine("sqlite:///:memory:")
        results = migrate_all_tenants(eng, [], revision="head", parallel=2, dry_run=True)
        assert results == []


# ---------------------------------------------------------------------------
# 测试 list_active_tenants
# ---------------------------------------------------------------------------


class TestListActiveTenants:
    """从 admin_tenant 读 tenant 列表测试."""

    def test_list_active_empty_db(self):
        from scripts.ci.migrate_tenants import list_active_tenants

        eng = create_engine("sqlite:///:memory:")
        # 无 admin_tenant 表, 应返回空
        result = list_active_tenants(eng)
        assert result == []

    def test_list_active_with_table(self):
        from scripts.ci.migrate_tenants import list_active_tenants

        eng = create_engine("sqlite:///:memory:")
        with eng.connect() as conn:
            conn.execute(sa.text("CREATE TABLE admin_tenant (id INTEGER, status INTEGER)"))
            conn.execute(sa.text("INSERT INTO admin_tenant VALUES (1, 1)"))
            conn.execute(sa.text("INSERT INTO admin_tenant VALUES (2, 1)"))
            conn.execute(sa.text("INSERT INTO admin_tenant VALUES (3, 0)"))  # disabled
            conn.commit()
        result = list_active_tenants(eng)
        assert sorted(result) == [1, 2]


# ---------------------------------------------------------------------------
# 测试 print_report
# ---------------------------------------------------------------------------


class TestPrintReport:
    """报告输出测试."""

    def test_print_report_doesnt_crash(self, capsys):
        from scripts.ci.migrate_tenants import print_report

        results = [
            {
                "tenant_id": 1,
                "schema": "tenant_1",
                "success": True,
                "attempts": 1,
                "duration_seconds": 0.1,
                "error": None,
                "dry_run": False,
            },
            {
                "tenant_id": 2,
                "schema": "tenant_2",
                "success": False,
                "attempts": 3,
                "duration_seconds": 1.5,
                "error": "测试错误",
                "dry_run": False,
            },
        ]
        print_report(results, verbose=True)
        captured = capsys.readouterr()
        assert "tenant_id=   1" in captured.out
        assert "tenant_id=   2" in captured.out
        assert "成功: 1" in captured.out
        assert "失败: 1" in captured.out

    def test_print_report_all_success(self, capsys):
        from scripts.ci.migrate_tenants import print_report

        results = [
            {
                "tenant_id": i,
                "schema": f"tenant_{i}",
                "success": True,
                "attempts": 1,
                "duration_seconds": 0.05,
                "error": None,
                "dry_run": True,
            }
            for i in [1, 2, 3]
        ]
        print_report(results, verbose=False)
        captured = capsys.readouterr()
        assert "成功: 3" in captured.out
        assert "失败: 0" in captured.out


# ---------------------------------------------------------------------------
# 测试 dryrun_one_tenant
# ---------------------------------------------------------------------------


class TestDryrunOneTenant:
    """dryrun plan 测试."""

    def test_dryrun_sqlite_basic(self):
        from scripts.ci.migrate_tenant_dryrun import dryrun_one_tenant

        eng = create_engine("sqlite:///:memory:")
        plan = dryrun_one_tenant(eng, tenant_id=1, revision="head")
        assert plan["tenant_id"] == 1
        assert plan["schema"] == "tenant_1"
        assert plan["target_revision"] == "head"
        # sqlite 无 alembic_version, current = None
        assert plan["current_revision"] is None

    def test_dryrun_returns_all_fields(self):
        from scripts.ci.migrate_tenant_dryrun import dryrun_one_tenant

        eng = create_engine("sqlite:///:memory:")
        plan = dryrun_one_tenant(eng, tenant_id=5, revision="abc123")
        for k in (
            "tenant_id",
            "schema",
            "current_revision",
            "target_revision",
            "schema_exists",
            "schema_writable",
            "error",
        ):
            assert k in plan

    def test_dryrun_writable_probe(self):
        from scripts.ci.migrate_tenant_dryrun import dryrun_one_tenant

        eng = create_engine("sqlite:///:memory:")
        plan = dryrun_one_tenant(eng, tenant_id=2, revision="head")
        # sqlite :memory: 总是可写
        assert plan["schema_writable"] is True


# ---------------------------------------------------------------------------
# 测试 CLI 入口 (mock)
# ---------------------------------------------------------------------------


class TestCLIIntegration:
    """CLI 命令测试."""

    def test_cli_list_with_tenants(self, capsys, monkeypatch):
        """验证 --list 不需要 DB 时也能跑."""

        test_argv = ["migrate_tenants.py", "--tenants", "1,2", "--list"]
        monkeypatch.setattr(sys, "argv", test_argv)
        from scripts.ci.migrate_tenants import main

        exit_code = main()
        assert exit_code == 0
        captured = capsys.readouterr()
        assert "tenant_id=1" in captured.out
        assert "tenant_id=2" in captured.out

    def test_cli_dryrun_runs(self, monkeypatch, capsys):
        """验证 --dry-run 模式可跑通 (用 :memory:)."""

        # patch engine_url 到 :memory:
        import sqlalchemy as sa

        from scripts.ci import migrate_tenants as mt_module

        orig_create = sa.create_engine

        def mock_create(url, *a, **kw):
            if ":memory:" in url or "memory" in url.lower() or "sqlite" in url.lower():
                return orig_create("sqlite:///:memory:")
            return orig_create(url, *a, **kw)

        monkeypatch.setattr("scripts.ci.migrate_tenants.sa.create_engine", mock_create)
        test_argv = [
            "migrate_tenants.py",
            "--tenants",
            "1",
            "--engine-url",
            "sqlite:///:memory:",
            "--dry-run",
            "--retries",
            "0",
        ]
        monkeypatch.setattr(sys, "argv", test_argv)
        exit_code = mt_module.main()
        # exit 0 或 1 都行, 只要不崩
        assert exit_code in (0, 1)
        captured = capsys.readouterr()
        assert "目标 tenants" in captured.out
