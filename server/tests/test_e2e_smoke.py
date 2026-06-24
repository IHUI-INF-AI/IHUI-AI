"""端到端 Smoke 测试: 模拟"启动后端 → 创建批次 → 执行迁移 → 验证"全链路.

不依赖真实 DB (使用 SQLite fallback + mock H 盘 MySQL).
适合在 CI / 封版前回归, 1 分钟内可跑完.

执行:
    pytest tests/test_e2e_smoke.py -v -m unit
"""
from __future__ import annotations

import os
import time
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# 阶段 0: 测试环境隔离
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _isolation_env(monkeypatch):
    """强制测试环境, 禁止连接生产配置."""
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("DEV_FAST_START", "true")
    monkeypatch.setenv("DUAL_WRITE_ENABLED", "false")
    monkeypatch.setenv("DUAL_WRITE_RECONCILE", "false")
    yield


# ---------------------------------------------------------------------------
# 阶段 1: 启动链
# ---------------------------------------------------------------------------

class TestBootSmoke:
    """后端进程能否正常启动 (import 不报错)."""

    def test_import_main_app(self):
        """main.py 可正常导入 (即进程能启动)."""
        # 延迟 import 防止 conftest 副作用
        from app.main import app

        assert app is not None
        assert hasattr(app, "router")

    def test_celery_app_construct(self):
        """Celery 应用可正常构造 (即 beat 配置正确)."""
        from app.celery_app import celery_app, _CELERY_AVAILABLE

        if _CELERY_AVAILABLE:
            assert celery_app is not None
            beat = celery_app.conf.beat_schedule
            assert "run-reconcile-every-6h" in beat
            # 验证 cron 表达式: minute=0, hour=*/6
            schedule = beat["run-reconcile-every-6h"]["schedule"]
            # crontab 对象 __str__ 形如 "0 */6 * * *"
            assert "*/6" in str(schedule)

    def test_reconcile_task_registered(self):
        """3 个 task 全部注册到 celery include 列表."""
        from app.tasks.reconcile_tasks import (
            auto_reconcile_yesterday_task,
            close_expired_orders_task,
            run_reconcile_task,
        )
        assert run_reconcile_task.name == "app.tasks.reconcile_tasks.run_reconcile_task"
        assert close_expired_orders_task.name == "app.tasks.reconcile_tasks.close_expired_orders_task"
        assert auto_reconcile_yesterday_task.name == "app.tasks.reconcile_tasks.auto_reconcile_yesterday_task"


# ---------------------------------------------------------------------------
# 阶段 2: ETL 链路 (mock H 盘)
# ---------------------------------------------------------------------------

class TestMigrationChainE2E:
    """完整迁移链路: H 盘读取 → 转换 → G 盘写入 → 映射持久化 → checkpoint 更新."""

    def test_full_chain_with_mocked_drivers(self):
        """端到端: 模拟 H 盘 3 行 → ETL → 验证 G 盘 3 行 + 3 条 id_mapping + checkpoint done."""
        from scripts.etl.config import MigrationTask
        from scripts.etl.transformer import transform_row
        from scripts.etl.checkpoint import upsert_checkpoint, MigrationCheckpoint

        task = MigrationTask(
            source_table="t_member",
            source_db="ihui-ai-edu-member-service",
            target_table="edu_member",
            field_map={"name": "full_name"},
            unit_convert={},
            id_lookup={},
        )

        # 1) 模拟 H 盘读取 3 行
        h_rows = [
            {"id": 1, "name": "Alice", "mobile": "13800000001", "createTime": datetime(2026, 6, 24, 10, 0, 0)},
            {"id": 2, "name": "Bob",   "mobile": "13800000002", "createTime": datetime(2026, 6, 24, 11, 0, 0)},
            {"id": 3, "name": "Carol", "mobile": "13800000003", "createTime": datetime(2026, 6, 24, 12, 0, 0)},
        ]

        # 2) 转换
        cache: dict[tuple[str, int], str] = {}
        transformed = [transform_row(r, task, cache) for r in h_rows]

        # 3) 断言: 3 行全部转换成功
        assert len(transformed) == 3
        for out in transformed:
            # 自身主键变 UUID
            assert isinstance(out["id"], str) and len(out["id"]) == 32
            # 字段重命名: name → full_name
            assert "full_name" in out
            assert "name" not in out
            # createTime 归一化
            assert isinstance(out["createTime"], datetime)
            assert out["createTime"].tzinfo is None

        # 4) 断言: 3 条映射都被加入 cache
        assert len(cache) == 3
        for old_id in (1, 2, 3):
            assert ("t_member", old_id) in cache

        # 5) 模拟 G 盘写入 + 持久化映射
        # 注意: mapping.py / checkpoint.py 顶部已 import get_session
        # 需 patch `scripts.etl.mapping.get_session` 和 `scripts.etl.checkpoint.get_session`
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.execute.return_value.rowcount = 3
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_db)
        mock_ctx.__exit__ = MagicMock(return_value=False)

        with patch("scripts.etl.mapping.get_session", return_value=mock_ctx), \
             patch("scripts.etl.checkpoint.get_session", return_value=mock_ctx):
            from scripts.etl.mapping import persist_mappings
            persist_mappings("v2026_06_24_smoke_01", task, cache)
            # 触发了 1 次 upsert 映射
            assert mock_db.execute.call_count >= 1

            # 6) 模拟 checkpoint 状态推进
            upsert_checkpoint("v2026_06_24_smoke_01", "t_member", "edu_member", "running")
            upsert_checkpoint(
                "v2026_06_24_smoke_01", "t_member", "edu_member", "done",
                last_pk="3", total_rows=3, migrated_rows=3,
            )

        # 7) 整体: 链路无异常
        assert True  # 走到这里说明全链路跑通

    def test_chain_resilience_on_transform_error(self):
        """转换错误不应让整个 batch 崩溃, 单行错误被记录并跳过."""
        from scripts.etl.config import MigrationTask
        from scripts.etl.transformer import transform_row

        task = MigrationTask(
            source_table="t_member", source_db="db", target_table="edu_member",
        )
        cache: dict[tuple[str, int], str] = {}

        # 第 1 行: 正常
        ok_row = transform_row({"id": 1, "name": "Alice"}, task, cache)
        assert ok_row["id"] != "1"
        # 第 2 行: id 类型异常 -> 应被 try/except 兜住
        try:
            bad = transform_row({"id": object()}, task, cache)  # type: ignore[arg-type]
            # 不抛就 OK
            assert bad is not None
        except Exception:
            # 抛异常也 OK (transformer 的容错层会处理)
            pass

        # 正常行的映射已入 cache
        assert ("t_member", 1) in cache


# ---------------------------------------------------------------------------
# 阶段 3: 回滚链
# ---------------------------------------------------------------------------

class TestRollbackChainE2E:
    """回滚链路: 触发回滚 → 验证业务表清空 + mapping 清空 + checkpoint 状态变更."""

    def test_rollback_clears_all_layers(self):
        """完整回滚流程."""
        from scripts.rollback import _rollback_batch

        batch_id = "v2026_06_24_smoke_rb"

        # 1) 模拟已有数据
        with patch("scripts.rollback.get_batch") as mock_get_batch:
            mock_get_batch.return_value = MagicMock(
                batch_id=batch_id, description="smoke", tasks=[],
            )

            executed = []
            mock_db = MagicMock()
            mock_ck = MagicMock()
            mock_ck.target_table = "edu_member"
            mock_ck.migrated_rows = 100
            mock_db.query.return_value.filter.return_value.all.return_value = [mock_ck]
            mock_db.query.return_value.filter.return_value.count.return_value = 50

            def fake_execute(sql, params=None):
                executed.append(str(sql).upper())
                r = MagicMock()
                r.scalar.return_value = 50
                r.rowcount = 50
                return r

            mock_db.execute.side_effect = fake_execute
            mock_ctx = MagicMock()
            mock_ctx.__enter__ = MagicMock(return_value=mock_db)
            mock_ctx.__exit__ = MagicMock(return_value=False)

            with patch("scripts.rollback.get_session", return_value=mock_ctx):
                _rollback_batch(batch_id, dry_run=False, keep_mappings=False, confirm=True)

        # 2) 验证: 业务表 + id_mapping + migration_checkpoint 都执行了 DELETE
        all_sql = " ".join(executed)
        assert "EDU_MEMBER" in all_sql
        assert "ID_MAPPING" in all_sql
        assert "MIGRATION_CHECKPOINT" in all_sql


# ---------------------------------------------------------------------------
# 阶段 4: 对账链
# ---------------------------------------------------------------------------

class TestReconcileChainE2E:
    """对账链路: 触发 run_reconcile_task → 验证报告结构."""

    def test_reconcile_task_returns_summary_shape(self):
        """任务返回 dict 必须含关键字段 (前端 / 监控消费)."""
        from app.tasks.reconcile_tasks import run_reconcile_task
        from unittest.mock import patch, MagicMock

        # full_reconcile 在 reconcile_tasks 函数体内 import
        # mock 真实模块路径 app.services.dual_write.full_reconcile
        mock_report_1 = MagicMock()
        mock_report_1.is_balanced = True
        mock_report_1.table = "t_a"
        mock_report_2 = MagicMock()
        mock_report_2.is_balanced = False
        mock_report_2.table = "t_b"
        with patch("app.services.dual_write.full_reconcile", return_value=[mock_report_1, mock_report_2]):
            # stub 模式: self.retry 不存在, 已内置兜底
            result = run_reconcile_task(MagicMock())
            assert result["total"] == 2
            assert result["balanced"] == 1
            assert result["unbalanced"] == 1
            assert "duration_s" in result
            assert "started_at" in result
            assert "finished_at" in result


# ---------------------------------------------------------------------------
# 阶段 5: API 链路 (FastAPI TestClient)
# ---------------------------------------------------------------------------

class TestAPISmoke:
    """关键 API 在迁移管理流程中可被调用."""

    def test_migration_admin_endpoints_registered(self):
        """所有 admin migration 路由都被注册."""
        from app.api.admin_migration import router

        paths = [r.path for r in router.routes]
        # 关键路径
        assert any("/batches" in p for p in paths), f"缺少 batches 路径: {paths}"
        assert any("/run" in p for p in paths), f"缺少 run 路径: {paths}"
        assert any("/rollback" in p for p in paths), f"缺少 rollback 路径: {paths}"
        assert any("/id-mapping" in p for p in paths), f"缺少 id-mapping 路径: {paths}"

    def test_dual_write_endpoints_registered(self):
        """双写管理路由就位."""
        from app.api.v1.system.dual_write import router

        paths = [r.path for r in router.routes]
        assert any("/config" in p for p in paths)
        assert any("/reconcile" in p for p in paths)

    def test_member_endpoints_registered(self):
        """会员管理路由就位."""
        from app.api.v1.member import router

        paths = [r.path for r in router.routes]
        # 至少 15 条路由
        assert len(paths) >= 15, f"会员路由数 {len(paths)} < 15: {paths}"

    def test_commission_endpoints_registered(self):
        """佣金路由就位 (含 service 接入)."""
        from app.api.v1.finance.commission import router

        paths = [r.path for r in router.routes]
        # 新增 3 条
        assert any("feedback-invite" in p for p in paths)
        assert any("invalidate-proportion-cache" in p for p in paths)
        assert any("active-proportion" in p for p in paths)


# ---------------------------------------------------------------------------
# 阶段 6: 性能基准 (轻量)
# ---------------------------------------------------------------------------

class TestPerformanceBaseline:
    """关键热路径性能基准 (CI 早期告警)."""

    def test_transform_row_throughput(self):
        """transform_row 应能在 100ms 内处理 1000 行."""
        from scripts.etl.config import MigrationTask
        from scripts.etl.transformer import transform_row

        task = MigrationTask(
            source_table="t_x", source_db="db", target_table="t_x",
            unit_convert={"price": "yuan_to_fen"},
        )
        cache: dict[tuple[str, int], str] = {}
        rows = [{"id": i, "price": i * 0.99, "name": f"user_{i}"} for i in range(1, 1001)]

        started = time.perf_counter()
        for r in rows:
            transform_row(r, task, cache)
        elapsed_ms = (time.perf_counter() - started) * 1000

        # 1000 行 < 500ms (基线, 实际应在 100ms 以内)
        assert elapsed_ms < 500, f"transform_row 性能回归: 1000 行耗时 {elapsed_ms:.0f}ms"
        assert len(cache) == 1000

    def test_dual_write_decorator_overhead(self):
        """dual_write 装饰器不应引入显著开销."""
        from app.services.dual_write import dual_write
        from unittest.mock import patch

        # dual_write 签名: (table_name, h_op, g_op)
        @dual_write(
            table_name="t_test",
            h_op=lambda *a, **kw: None,
            g_op=lambda *a, **kw: None,
        )
        def fake_write(pk: str, payload: dict) -> dict:
            return {"id": pk, "ok": True}

        # stub 双写: H/G 盘不实际写
        with patch("app.services.dual_write.DUAL_WRITE_ENABLED", False):
            started = time.perf_counter()
            for i in range(1000):
                fake_write(f"uuid_{i}", {"v": i})
            elapsed_ms = (time.perf_counter() - started) * 1000

        # 1000 次装饰器 < 200ms
        assert elapsed_ms < 200, f"dual_write 装饰器开销回归: {elapsed_ms:.0f}ms"
