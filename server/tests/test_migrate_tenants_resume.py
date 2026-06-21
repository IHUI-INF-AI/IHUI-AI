"""建议 135 测试: migrate_tenants 断点续传 (prisma migrate deploy 风格).

测试:
  - MigrationStateTracker: 状态读写持久化
  - 跳过已 done 的 tenant (--resume)
  - 失败 tenant 状态正确标记
  - reset / reset_failed
  - migrate_one_tenant 集成 tracker
  - 端到端: 模拟部分 tenant 失败, --resume 只跑失败部分
"""

import json
import sys
from pathlib import Path

import pytest

# 让 migrate_tenants.py 可 import
ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_CI = ROOT / "scripts" / "ci"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SCRIPTS_CI) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_CI))

from migrate_tenants import MigrationStateTracker

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def state_file(tmp_path):
    return str(tmp_path / "migrate_state.json")


@pytest.fixture
def tracker(state_file):
    return MigrationStateTracker(state_file, target_revision="head")


# ---------------------------------------------------------------------------
# TestStateTrackerBasic
# ---------------------------------------------------------------------------


class TestStateTrackerBasic:
    """MigrationStateTracker 基础读写."""

    def test_initial_empty(self, state_file):
        t = MigrationStateTracker(state_file)
        assert t.get_tenant_status(1) == "pending"
        assert t.is_done(1) is False

    def test_mark_in_progress(self, tracker):
        tracker.mark_in_progress(1, "tenant_1")
        assert tracker.get_tenant_status(1) == "in_progress"

    def test_mark_done(self, tracker):
        tracker.mark_in_progress(1, "tenant_1")
        tracker.mark_done(1, attempts=1, duration=1.5)
        assert tracker.get_tenant_status(1) == "done"
        assert tracker.is_done(1) is True

    def test_mark_failed(self, tracker):
        tracker.mark_in_progress(1, "tenant_1")
        tracker.mark_failed(1, "tenant_1", attempts=2, duration=0.5, error="boom")
        assert tracker.get_tenant_status(1) == "failed"
        rec = tracker.get_tenant_record(1)
        assert rec["error"] == "boom"
        assert rec["attempts"] == 2

    def test_persistence_to_file(self, state_file):
        """状态写盘后, 新实例能加载."""
        t1 = MigrationStateTracker(state_file)
        t1.mark_done(1, attempts=1, duration=1.0)
        t1.mark_failed(2, "tenant_2", attempts=3, duration=0.5, error="e2")
        # 新实例加载
        t2 = MigrationStateTracker(state_file)
        assert t2.is_done(1)
        assert t2.get_tenant_status(2) == "failed"
        assert t2.get_tenant_record(2)["error"] == "e2"

    def test_corrupted_file_reinit(self, state_file):
        """state 文件损坏时, 不抛异常, 重新初始化."""
        with open(state_file, "w", encoding="utf-8") as f:
            f.write("{ not valid json")
        t = MigrationStateTracker(state_file)
        assert t.get_tenant_status(1) == "pending"
        # 应该能正常写
        t.mark_done(1, attempts=1, duration=0.1)
        assert t.is_done(1)


# ---------------------------------------------------------------------------
# TestGetPendingTenants
# ---------------------------------------------------------------------------


class TestGetPendingTenants:
    """get_pending_tenants 排除已 done."""

    def test_excludes_done(self, tracker):
        tracker.mark_in_progress(1, "tenant_1")
        tracker.mark_done(1, attempts=1, duration=0.1)
        tracker.mark_in_progress(2, "tenant_2")
        tracker.mark_done(2, attempts=1, duration=0.1)
        tracker.mark_failed(3, "tenant_3", attempts=2, duration=0.1, error="x")
        pending = tracker.get_pending_tenants([1, 2, 3, 4, 5])
        # 1, 2 done → 排除; 3 failed (仍需重试) → 保留; 4, 5 未开始 → 保留
        assert pending == [3, 4, 5]

    def test_empty_input(self, tracker):
        assert tracker.get_pending_tenants([]) == []

    def test_all_done(self, tracker):
        for i in (1, 2, 3):
            tracker.mark_in_progress(i, f"tenant_{i}")
            tracker.mark_done(i, attempts=1, duration=0.1)
        assert tracker.get_pending_tenants([1, 2, 3]) == []


# ---------------------------------------------------------------------------
# TestSummary
# ---------------------------------------------------------------------------


class TestSummary:
    """summary() 状态计数."""

    def test_empty_summary(self, tracker):
        cnt = tracker.summary()
        assert cnt["pending"] == 0
        assert cnt["done"] == 0
        assert cnt["failed"] == 0
        assert cnt["in_progress"] == 0

    def test_mixed_summary(self, tracker):
        tracker.mark_done(1, attempts=1, duration=0.1)
        tracker.mark_done(2, attempts=1, duration=0.1)
        tracker.mark_failed(3, "tenant_3", attempts=2, duration=0.1, error="x")
        tracker.mark_in_progress(4, "tenant_4")
        cnt = tracker.summary()
        assert cnt["done"] == 2
        assert cnt["failed"] == 1
        assert cnt["in_progress"] == 1


# ---------------------------------------------------------------------------
# TestReset
# ---------------------------------------------------------------------------


class TestReset:
    """reset / reset_failed."""

    def test_reset_clears_all(self, tracker):
        tracker.mark_done(1, attempts=1, duration=0.1)
        tracker.mark_done(2, attempts=1, duration=0.1)
        tracker.reset()
        assert tracker.get_tenant_status(1) == "pending"
        assert tracker.get_tenant_status(2) == "pending"
        cnt = tracker.summary()
        assert cnt["done"] == 0

    def test_reset_failed_only(self, tracker):
        tracker.mark_done(1, attempts=1, duration=0.1)
        tracker.mark_failed(2, "tenant_2", attempts=2, duration=0.1, error="x")
        tracker.mark_failed(3, "tenant_3", attempts=2, duration=0.1, error="y")
        n = tracker.reset_failed()
        assert n == 2
        # 1 还应是 done
        assert tracker.get_tenant_status(1) == "done"
        # 2, 3 应变 pending, error 清除
        assert tracker.get_tenant_status(2) == "pending"
        assert tracker.get_tenant_record(2).get("error") is None
        assert tracker.get_tenant_status(3) == "pending"


# ---------------------------------------------------------------------------
# TestIntegrationWithMigrate
# ---------------------------------------------------------------------------


class TestIntegrationWithMigrate:
    """migrate_one_tenant 集成 tracker."""

    def test_success_persists_done(self, state_file, monkeypatch):
        """迁移成功时, tracker 写 done."""
        from unittest.mock import MagicMock

        from migrate_tenants import MigrationStateTracker, migrate_one_tenant

        eng = MagicMock()
        tracker = MigrationStateTracker(state_file, target_revision="head")
        # 用 mock 让 _migrate_real 不做事
        monkeypatch.setattr("migrate_tenants._migrate_real", lambda *a, **kw: None)
        monkeypatch.setattr("migrate_tenants._migrate_dry_run", lambda *a, **kw: None)
        result = migrate_one_tenant(eng, 7, tracker=tracker)
        assert result["success"] is True
        # tracker 写 done
        assert tracker.is_done(7)

    def test_failure_persists_failed(self, state_file, monkeypatch):
        """迁移失败时, tracker 写 failed."""
        from unittest.mock import MagicMock

        from migrate_tenants import MigrationStateTracker, migrate_one_tenant

        eng = MagicMock()
        tracker = MigrationStateTracker(state_file, target_revision="head")

        def _raise(*a, **kw):
            raise RuntimeError("simulated alembic failure")

        monkeypatch.setattr("migrate_tenants._migrate_real", _raise)

        result = migrate_one_tenant(eng, 7, retries=0, tracker=tracker)
        assert result["success"] is False
        assert tracker.get_tenant_status(7) == "failed"
        rec = tracker.get_tenant_record(7)
        assert "simulated alembic failure" in rec["error"]

    def test_skip_done_on_resume(self, state_file, monkeypatch):
        """--resume 跳过已 done 的 tenant."""
        from unittest.mock import MagicMock

        from migrate_tenants import MigrationStateTracker, migrate_all_tenants

        eng = MagicMock()
        tracker = MigrationStateTracker(state_file, target_revision="head")
        # 预置: 1, 2 已 done
        tracker.mark_in_progress(1, "tenant_1")
        tracker.mark_done(1, attempts=1, duration=0.1)
        tracker.mark_in_progress(2, "tenant_2")
        tracker.mark_done(2, attempts=1, duration=0.1)
        # 3 失败, 4 没跑
        tracker.mark_in_progress(3, "tenant_3")
        tracker.mark_failed(3, "tenant_3", attempts=2, duration=0.1, error="x")

        # 计数 _migrate_real 调用次数
        call_log = []

        def _fake_migrate(*a, **kw):
            call_log.append(a[1])  # schema

        monkeypatch.setattr("migrate_tenants._migrate_real", _fake_migrate)

        # 跑 [1, 2, 3, 4], skip_done=True
        results = migrate_all_tenants(
            engine=eng,
            tenant_ids=[1, 2, 3, 4],
            parallel=1,
            retries=0,
            tracker=tracker,
            skip_done=True,
        )
        # 1, 2 done 跳过, 3, 4 应该跑
        assert sorted(call_log) == ["tenant_3", "tenant_4"]
        # 3, 4 在结果中
        result_tids = {r["tenant_id"] for r in results}
        assert result_tids == {3, 4}


# ---------------------------------------------------------------------------
# TestStatusSnapshot
# ---------------------------------------------------------------------------


class TestStatusSnapshot:
    """--status 输出快照."""

    def test_status_includes_all_tenants(self, state_file):
        """status 打印所有 tenant 详情."""
        tracker = MigrationStateTracker(state_file, target_revision="head")
        tracker.mark_in_progress(1, "tenant_1")
        tracker.mark_done(1, attempts=1, duration=0.5)
        tracker.mark_failed(2, "tenant_2", attempts=2, duration=1.0, error="boom")
        cnt = tracker.summary()
        assert cnt["done"] == 1
        assert cnt["failed"] == 1
        # 验证所有 tenant record 可查
        assert tracker.get_tenant_record(1)["attempts"] == 1
        assert tracker.get_tenant_record(2)["attempts"] == 2


# ---------------------------------------------------------------------------
# TestStateFileFormat
# ---------------------------------------------------------------------------


class TestStateFileFormat:
    """state 文件格式 (兼容性 / 跨进程可读)."""

    def test_state_file_is_valid_json(self, state_file):
        tracker = MigrationStateTracker(state_file, target_revision="abc123")
        tracker.mark_done(1, attempts=1, duration=0.1)
        with open(state_file, encoding="utf-8") as f:
            data = json.load(f)
        assert data["version"] == 1
        assert data["target_revision"] == "abc123"
        assert "1" in data["tenants"]
        assert data["tenants"]["1"]["status"] == "done"

    def test_target_revision_recorded(self, state_file):
        t = MigrationStateTracker(state_file, target_revision="rev_007")
        assert t._data["target_revision"] == "rev_007"
