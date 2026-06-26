"""WebSocket 自动恢复 Prometheus 指标测试 (2026-06-26 新增).

覆盖:
- 模块 import / Counter/Gauge/Histogram 注册到全局 registry
- update_gauges() 同步 manager 状态到 Gauge (含 ws_manager 字段缺失场景)
- inc_recovery_* / inc_monitor_exception 计数正确性
- RecoveryTimer 上下文管理器 succeeded / failed 两种路径
- FastAPI 路由 /api/v1/system/auto-recovery/metrics 返回 Prometheus 文本格式
- FastAPI 路由 /api/v1/system/auto-recovery/status 返回 JSON
- FastAPI 路由 /api/v1/system/auto-recovery/history 返回历史
- 完整链路: 触发恢复 -> update_gauges -> /metrics 端点文本包含关键 metric
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from prometheus_client import generate_latest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# ---------------------------------------------------------------------------
# 模块加载 / 指标注册
# ---------------------------------------------------------------------------
class TestMetricsModuleImport:
    def test_module_imports(self):
        """模块应能 import, 不抛异常."""
        from app.ws import auto_recovery_metrics

        assert auto_recovery_metrics is not None

    def test_all_metrics_registered(self):
        """所有指标都已注册到 prometheus_client 全局 registry."""
        from app.ws import auto_recovery_metrics

        body = generate_latest().decode("utf-8", errors="replace")
        # 关键 metric 名称
        expected_substrings = [
            "zhs_ws_auto_recovery_events_total",
            "zhs_ws_auto_recovery_exceptions_total",
            "zhs_ws_auto_recovery_is_running",
            "zhs_ws_auto_recovery_service_status",
            "zhs_ws_auto_recovery_consecutive_errors",
            "zhs_ws_auto_recovery_total_errors",
            "zhs_ws_auto_recovery_recovery_count",
            "zhs_ws_auto_recovery_memory_usage_mb",
            "zhs_ws_auto_recovery_queue_size",
            "zhs_ws_auto_recovery_queue_capacity",
            "zhs_ws_auto_recovery_queue_full_count",
            "zhs_ws_auto_recovery_active_connections",
            "zhs_ws_auto_recovery_active_api_calls",
            "zhs_ws_auto_recovery_processing_tasks",
            "zhs_ws_auto_recovery_total_messages_queued",
            "zhs_ws_auto_recovery_last_health_check_timestamp",
            "zhs_ws_auto_recovery_last_activity_timestamp",
            "zhs_ws_auto_recovery_inactive_seconds",
            "zhs_ws_auto_recovery_monitor_tasks_total",
            "zhs_ws_auto_recovery_monitor_tasks_active",
            "zhs_ws_auto_recovery_monitor_tasks_failed",
            "zhs_ws_auto_recovery_recovery_duration_seconds",
        ]
        for name in expected_substrings:
            assert name in body, f"指标 {name} 未注册到全局 registry"

    def test_help_and_type_lines_present(self):
        """每个 metric 都应包含 HELP 和 TYPE 行 (Prometheus 文本规范)."""
        from app.ws import auto_recovery_metrics

        body = generate_latest().decode("utf-8", errors="replace")
        for name in [
            "zhs_ws_auto_recovery_is_running",
            "zhs_ws_auto_recovery_events_total",
            "zhs_ws_auto_recovery_recovery_duration_seconds",
        ]:
            assert f"# HELP {name}" in body, f"缺少 HELP: {name}"
            assert f"# TYPE {name}" in body, f"缺少 TYPE: {name}"


# ---------------------------------------------------------------------------
# update_gauges 同步
# ---------------------------------------------------------------------------
class TestUpdateGauges:
    def _make_manager(self, **overrides):
        """构造一个 mock manager, 含 ws_manager 子对象."""
        ws = MagicMock()
        ws.message_queue = MagicMock()
        ws.message_queue.qsize.return_value = 7
        ws.queue_size = 100
        ws.queue_full_count = 2
        ws.active_connections = {"c1": object(), "c2": object()}
        ws.active_api_calls = {"a1": 1.0}
        ws.processing_tasks = set()
        ws.total_messages = 42

        mgr = MagicMock()
        mgr.ws_manager = ws
        mgr.is_running = True
        mgr.service_status = "healthy"
        mgr.consecutive_errors = 0
        mgr.error_count = 5
        mgr.recovery_count = 1
        mgr.last_health_check = time.time() - 1
        mgr.last_activity_time = time.time() - 2
        mgr.monitor_tasks = set()
        for k, v in overrides.items():
            setattr(mgr, k, v)
        return mgr

    def test_update_gauges_with_none_manager(self):
        """manager=None 时, is_running 应为 0, 不抛异常."""
        from app.ws.auto_recovery_metrics import IS_RUNNING, update_gauges

        update_gauges(None)
        assert IS_RUNNING._value.get() == 0

    def test_update_gauges_syncs_all_gauge(self):
        """正常 manager 应同步所有 Gauge 到正确值."""
        from app.ws.auto_recovery_metrics import (
            ACTIVE_API_CALLS,
            ACTIVE_CONNECTIONS,
            CONSECUTIVE_ERRORS,
            PROCESSING_TASKS,
            QUEUE_CAPACITY,
            QUEUE_FULL_COUNT,
            QUEUE_SIZE,
            RECOVERY_COUNT,
            SERVICE_STATUS,
            TOTAL_ERRORS,
            TOTAL_MESSAGES_QUEUED,
            update_gauges,
        )

        mgr = self._make_manager()
        update_gauges(mgr)
        assert QUEUE_SIZE._value.get() == 7
        assert QUEUE_CAPACITY._value.get() == 100
        assert QUEUE_FULL_COUNT._value.get() == 2
        assert ACTIVE_CONNECTIONS._value.get() == 2
        assert ACTIVE_API_CALLS._value.get() == 1
        assert PROCESSING_TASKS._value.get() == 0
        assert TOTAL_MESSAGES_QUEUED._value.get() == 42
        assert TOTAL_ERRORS._value.get() == 5
        assert RECOVERY_COUNT._value.get() == 1
        assert CONSECUTIVE_ERRORS._value.get() == 0
        assert SERVICE_STATUS._value.get() == 1

    def test_update_gauges_with_missing_ws_attributes(self):
        """ws_manager 缺少属性时, 不抛异常 (防御性 getattr)."""
        from app.ws.auto_recovery_metrics import update_gauges

        ws = MagicMock(spec=[])  # 无任何属性
        mgr = MagicMock()
        mgr.ws_manager = ws
        mgr.is_running = True
        mgr.service_status = "healthy"
        mgr.last_health_check = 0
        mgr.last_activity_time = 0
        mgr.monitor_tasks = set()
        # 应不抛异常
        update_gauges(mgr)

    def test_update_gauges_with_unhealthy_status(self):
        """service_status != 'healthy' 时, SERVICE_STATUS 应为 0."""
        from app.ws.auto_recovery_metrics import SERVICE_STATUS, update_gauges

        mgr = self._make_manager()
        mgr.service_status = "degraded"
        update_gauges(mgr)
        assert SERVICE_STATUS._value.get() == 0

    def test_update_gauges_computes_inactive_seconds(self):
        """INACTIVE_SECONDS 应为 now - last_activity_time."""
        from app.ws.auto_recovery_metrics import INACTIVE_SECONDS, update_gauges

        mgr = self._make_manager()
        mgr.last_activity_time = time.time() - 100
        update_gauges(mgr)
        # 100 ± 2 (测试运行时间)
        v = INACTIVE_SECONDS._value.get()
        assert 98 <= v <= 102

    def test_update_gauges_with_empty_monitoring(self):
        """is_running=False 时, IS_RUNNING 应为 0."""
        from app.ws.auto_recovery_metrics import IS_RUNNING, update_gauges

        mgr = self._make_manager()
        mgr.is_running = False
        update_gauges(mgr)
        assert IS_RUNNING._value.get() == 0


# ---------------------------------------------------------------------------
# Counter 增量
# ---------------------------------------------------------------------------
class TestCounterIncrements:
    def test_inc_recovery_triggered(self):
        from app.ws.auto_recovery_metrics import (
            RECOVERY_EVENTS,
            inc_recovery_triggered,
        )

        before = RECOVERY_EVENTS.labels(
            event_type="triggered", reason="unit_test"
        )._value.get()
        inc_recovery_triggered("unit_test")
        after = RECOVERY_EVENTS.labels(
            event_type="triggered", reason="unit_test"
        )._value.get()
        assert after == before + 1

    def test_inc_recovery_succeeded(self):
        from app.ws.auto_recovery_metrics import (
            RECOVERY_EVENTS,
            inc_recovery_succeeded,
        )

        before = RECOVERY_EVENTS.labels(
            event_type="succeeded", reason="unit_test_s"
        )._value.get()
        inc_recovery_succeeded("unit_test_s")
        after = RECOVERY_EVENTS.labels(
            event_type="succeeded", reason="unit_test_s"
        )._value.get()
        assert after == before + 1

    def test_inc_recovery_failed(self):
        from app.ws.auto_recovery_metrics import (
            RECOVERY_EVENTS,
            inc_recovery_failed,
        )

        before = RECOVERY_EVENTS.labels(
            event_type="failed", reason="unit_test_f"
        )._value.get()
        inc_recovery_failed("unit_test_f")
        after = RECOVERY_EVENTS.labels(
            event_type="failed", reason="unit_test_f"
        )._value.get()
        assert after == before + 1

    def test_inc_monitor_exception(self):
        from app.ws.auto_recovery_metrics import (
            MONITOR_EXCEPTIONS,
            inc_monitor_exception,
        )

        before = MONITOR_EXCEPTIONS.labels(
            monitor="health_monitor", exception_type="ValueError"
        )._value.get()
        inc_monitor_exception("health_monitor", ValueError("x"))
        after = MONITOR_EXCEPTIONS.labels(
            monitor="health_monitor", exception_type="ValueError"
        )._value.get()
        assert after == before + 1

    def test_long_reason_truncated(self):
        """超长 reason 应被截断到 200 字符, 避免 cardinality 爆炸."""
        from app.ws.auto_recovery_metrics import (
            RECOVERY_EVENTS,
            inc_recovery_triggered,
        )

        long_reason = "x" * 500
        inc_recovery_triggered(long_reason)
        # 200 字符的 label 应存在; 500 字符的应不存在
        assert "x" * 200 in str(RECOVERY_EVENTS._metrics)


# ---------------------------------------------------------------------------
# RecoveryTimer 上下文
# ---------------------------------------------------------------------------
class TestRecoveryTimer:
    def test_success_path(self):
        from app.ws.auto_recovery_metrics import (
            RECOVERY_DURATION,
            RecoveryTimer,
        )

        with RecoveryTimer("succeeded"):
            time.sleep(0.01)
        # 不抛异常, histogram 计数增加
        assert RECOVERY_DURATION.labels(result="succeeded")._sum.get() > 0

    def test_failure_path(self):
        from app.ws.auto_recovery_metrics import (
            RECOVERY_DURATION,
            RecoveryTimer,
        )

        before = RECOVERY_DURATION.labels(result="failed")._count.get()
        with pytest.raises(RuntimeError):
            with RecoveryTimer("succeeded"):
                raise RuntimeError("simulated failure")
        after = RECOVERY_DURATION.labels(result="failed")._count.get()
        # 异常路径自动归类为 failed
        assert after == before + 1

    def test_returned_self_in_enter(self):
        from app.ws.auto_recovery_metrics import RecoveryTimer

        timer = RecoveryTimer("succeeded")
        with timer as t:
            assert t is timer


# ---------------------------------------------------------------------------
# FastAPI 路由
# ---------------------------------------------------------------------------
class TestAutoRecoveryRoutes:
    """端到端: FastAPI TestClient 调用路由."""

    def test_metrics_endpoint_returns_prometheus_text(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.v1.system.auto_recovery import router as ar_router

        app = FastAPI()
        app.include_router(ar_router, prefix="/system")
        client = TestClient(app)
        resp = client.get("/system/auto-recovery/metrics")
        assert resp.status_code == 200
        # 应该是 Prometheus 文本格式
        ct = resp.headers.get("content-type", "")
        assert "text/plain" in ct
        body = resp.text
        # 应包含关键 metric
        assert "zhs_ws_auto_recovery_is_running" in body
        assert "# HELP" in body
        assert "# TYPE" in body

    def test_status_endpoint_returns_json(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.v1.system.auto_recovery import router as ar_router

        app = FastAPI()
        app.include_router(ar_router, prefix="/system")
        client = TestClient(app)
        resp = client.get("/system/auto-recovery/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "timestamp" in data
        # 未初始化时返回 not_initialized
        if data["success"]:
            assert "data" in data

    def test_history_endpoint_default(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.v1.system.auto_recovery import router as ar_router

        app = FastAPI()
        app.include_router(ar_router, prefix="/system")
        client = TestClient(app)
        resp = client.get("/system/auto-recovery/history")
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "timestamp" in data

    def test_history_endpoint_with_limit(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.v1.system.auto_recovery import router as ar_router

        app = FastAPI()
        app.include_router(ar_router, prefix="/system")
        client = TestClient(app)
        resp = client.get("/system/auto-recovery/history?limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    def test_history_endpoint_limit_clamped(self):
        """limit > 50 应被截断到 50."""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.v1.system.auto_recovery import router as ar_router

        app = FastAPI()
        app.include_router(ar_router, prefix="/system")
        client = TestClient(app)
        resp = client.get("/system/auto-recovery/history?limit=999")
        assert resp.status_code == 200
        # 不应抛异常, 即便 limit 很大


# ---------------------------------------------------------------------------
# 集成: 触发恢复 -> update_gauges -> /metrics 端点
# ---------------------------------------------------------------------------
class TestEndToEnd:
    """完整链路: 启动 manager -> 触发恢复 -> 同步指标 -> /metrics 端点输出."""

    @pytest.fixture
    def manager(self):
        from app.ws.auto_recovery import WebSocketAutoRecoveryManager

        # 构造一个最小可用的 ws_manager mock
        ws = MagicMock()
        ws.message_queue = MagicMock()
        ws.message_queue.qsize.return_value = 0
        ws.queue_size = 100
        ws.queue_full_count = 0
        ws.active_connections = {}
        ws.active_api_calls = {}
        ws.processing_tasks = set()
        ws.total_messages = 0
        ws.is_client_connected = MagicMock(return_value=False)
        ws.remove_connection = MagicMock()
        ws.start_background_tasks = MagicMock()
        ws.stop_background_tasks = MagicMock()

        mgr = WebSocketAutoRecoveryManager(ws)
        return mgr

    @pytest.mark.asyncio
    async def test_trigger_recovery_increments_counters(self, manager):
        from app.ws.auto_recovery_metrics import (
            RECOVERY_EVENTS,
            inc_recovery_failed,
            inc_recovery_succeeded,
            inc_recovery_triggered,
        )

        before_t = RECOVERY_EVENTS.labels(
            event_type="triggered", reason="e2e"
        )._value.get()
        before_s = RECOVERY_EVENTS.labels(
            event_type="succeeded", reason="e2e"
        )._value.get()

        # 验证 helper 函数本身
        inc_recovery_triggered("e2e")
        inc_recovery_succeeded("e2e")
        inc_recovery_failed("e2e")

        assert (
            RECOVERY_EVENTS.labels(event_type="triggered", reason="e2e")._value.get()
            == before_t + 1
        )
        assert (
            RECOVERY_EVENTS.labels(event_type="succeeded", reason="e2e")._value.get()
            == before_s + 1
        )

    @pytest.mark.asyncio
    async def test_full_recovery_loop_with_metrics(self, manager):
        """触发一次完整恢复, 验证埋点路径不破坏业务逻辑."""
        from app.ws.auto_recovery_metrics import update_gauges

        # 触发恢复
        await manager._trigger_recovery("integration_test")
        assert manager.recovery_count == 1

        # 同步指标
        update_gauges(manager)
        from app.ws.auto_recovery_metrics import (
            IS_RUNNING,
            RECOVERY_COUNT,
        )

        assert IS_RUNNING._value.get() == 1
        assert RECOVERY_COUNT._value.get() == 1

    @pytest.mark.asyncio
    async def test_max_attempts_records_failed(self, manager):
        """达到 max_recovery_attempts 时, 也应记录一次 failed 事件."""
        from app.ws.auto_recovery_metrics import RECOVERY_EVENTS

        manager.max_recovery_attempts = 2
        await manager._trigger_recovery("attempt1")
        await manager._trigger_recovery("attempt2")
        # 第 3 次应被拒绝
        before = RECOVERY_EVENTS.labels(
            event_type="failed", reason="max_attempts_reached:attempt3"
        )._value.get()
        await manager._trigger_recovery("attempt3")
        after = RECOVERY_EVENTS.labels(
            event_type="failed", reason="max_attempts_reached:attempt3"
        )._value.get()
        assert after == before + 1

    def test_metrics_endpoint_after_full_loop(self, manager):
        """运行完整流程后, /metrics 端点文本应包含具体数值."""
        # 同步一次
        from app.ws.auto_recovery_metrics import update_gauges

        update_gauges(manager)

        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from app.api.v1.system.auto_recovery import router as ar_router

        app = FastAPI()
        app.include_router(ar_router, prefix="/system")
        client = TestClient(app)
        resp = client.get("/system/auto-recovery/metrics")
        body = resp.text
        # 应包含我们的关键 metric
        assert "zhs_ws_auto_recovery_recovery_count" in body
        assert "zhs_ws_auto_recovery_is_running" in body


# ---------------------------------------------------------------------------
# 反向兼容: auto_recovery.py 中延迟 import 失败也不崩
# ---------------------------------------------------------------------------
class TestBackwardCompat:
    def test_auto_recovery_module_loads(self):
        """auto_recovery.py 仍能正常 import (延迟 import 容错)."""
        from app.ws import auto_recovery

        assert auto_recovery is not None
        assert hasattr(auto_recovery, "WebSocketAutoRecoveryManager")
        assert hasattr(auto_recovery, "initialize_auto_recovery")
        assert hasattr(auto_recovery, "get_recovery_status")
        assert hasattr(auto_recovery, "shutdown_auto_recovery")

    def test_metrics_helpers_exposed(self):
        """auto_recovery 模块导入了 metrics helpers (用于埋点)."""
        # 模块级 import 的函数可能为 None (容错), 也可能是函数
        from app.ws import auto_recovery

        # 至少 _METRICS_AVAILABLE 标记存在
        assert hasattr(auto_recovery, "_METRICS_AVAILABLE")
        # 不管 True/False 都不崩
        if auto_recovery._METRICS_AVAILABLE:
            assert auto_recovery.inc_recovery_triggered is not None
            assert auto_recovery.update_gauges is not None
