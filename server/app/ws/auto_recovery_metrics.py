"""WebSocket 自动恢复 Prometheus 指标 (2026-06-26 新增).

目标:
- 将 WebSocketAutoRecoveryManager 的运行时状态暴露为 Prometheus 指标
- 供 Grafana 仪表盘 / Alertmanager 告警使用
- 与现有 zhs_http_* / zhs_biz_* / zhs_ws_* 命名空间保持一致

命名空间: zhs_ws_auto_recovery_*
  - zhs_ws_auto_recovery_events_total{event_type, reason}
        Counter  - 恢复事件计数 (triggered / succeeded / failed)
  - zhs_ws_auto_recovery_exceptions_total{monitor, exception_type}
        Counter  - 监控协程异常计数 (5 个监控器维度)
  - zhs_ws_auto_recovery_is_running
        Gauge    - 自动恢复系统是否运行中 (1=运行, 0=停止)
  - zhs_ws_auto_recovery_service_status
        Gauge    - 服务状态 (1=healthy, 0=其他)
  - zhs_ws_auto_recovery_consecutive_errors
        Gauge    - 连续错误数
  - zhs_ws_auto_recovery_total_errors
        Gauge    - 累计错误总数
  - zhs_ws_auto_recovery_recovery_count
        Gauge    - 累计恢复次数
  - zhs_ws_auto_recovery_memory_usage_mb
        Gauge    - 进程 RSS 内存 (MB)
  - zhs_ws_auto_recovery_queue_size
        Gauge    - 出箱消息队列当前大小
  - zhs_ws_auto_recovery_queue_capacity
        Gauge    - 出箱消息队列容量
  - zhs_ws_auto_recovery_queue_full_count
        Gauge    - 队列满累计次数
  - zhs_ws_auto_recovery_active_connections
        Gauge    - 活跃 WS 连接数
  - zhs_ws_auto_recovery_active_api_calls
        Gauge    - 在飞 API 调用数
  - zhs_ws_auto_recovery_processing_tasks
        Gauge    - 处理中后台任务数
  - zhs_ws_auto_recovery_total_messages_queued
        Gauge    - 累计入队消息数
  - zhs_ws_auto_recovery_last_health_check_timestamp
        Gauge    - 上次健康检查 unix 时间戳
  - zhs_ws_auto_recovery_last_activity_timestamp
        Gauge    - 上次业务活动 unix 时间戳
  - zhs_ws_auto_recovery_inactive_seconds
        Gauge    - 距上次活动秒数
  - zhs_ws_auto_recovery_monitor_tasks_total
        Gauge    - 监控任务总数
  - zhs_ws_auto_recovery_monitor_tasks_active
        Gauge    - 活跃监控任务数
  - zhs_ws_auto_recovery_monitor_tasks_failed
        Gauge    - 失败监控任务数
  - zhs_ws_auto_recovery_recovery_duration_seconds
        Histogram- 单次恢复操作耗时分布 (result=succeeded|failed)

埋点策略:
- Counter: 在 _trigger_recovery / _exception_wrapper 节点 inc
- Gauge: 由 update_gauges(manager) 周期性从 manager 状态同步
- Histogram: 在 _perform_recovery 入口和出口观测

import 副作用:
  本文件被 import 即注册 Counter/Gauge/Histogram 到 prometheus_client 全局 registry,
  /metrics 端点会一并输出. 因此只需 from app.ws.auto_recovery_metrics import ...
  即可激活, 无需显式 init.
"""
from __future__ import annotations

import time
from typing import TYPE_CHECKING, Any

from prometheus_client import Counter, Gauge, Histogram

if TYPE_CHECKING:
    # 仅类型检查, 避免运行时循环 import
    from app.ws.auto_recovery import WebSocketAutoRecoveryManager


# ---------------------------------------------------------------------------
# Counter - 累计事件
# ---------------------------------------------------------------------------
RECOVERY_EVENTS = Counter(
    "zhs_ws_auto_recovery_events_total",
    "WebSocket auto-recovery events",
    ["event_type", "reason"],
)

MONITOR_EXCEPTIONS = Counter(
    "zhs_ws_auto_recovery_exceptions_total",
    "WebSocket auto-recovery monitor coroutine exceptions",
    ["monitor", "exception_type"],
)


# ---------------------------------------------------------------------------
# Gauge - 实时状态 (周期性从 manager 状态同步)
# ---------------------------------------------------------------------------
IS_RUNNING = Gauge(
    "zhs_ws_auto_recovery_is_running",
    "Auto-recovery system running (1) or stopped (0)",
)
SERVICE_STATUS = Gauge(
    "zhs_ws_auto_recovery_service_status",
    "Service status (1=healthy, 0=degraded/unknown)",
)
CONSECUTIVE_ERRORS = Gauge(
    "zhs_ws_auto_recovery_consecutive_errors",
    "Consecutive error count (reset on success)",
)
TOTAL_ERRORS = Gauge(
    "zhs_ws_auto_recovery_total_errors",
    "Cumulative error count",
)
RECOVERY_COUNT = Gauge(
    "zhs_ws_auto_recovery_recovery_count",
    "Cumulative recovery attempt count",
)
MEMORY_USAGE_MB = Gauge(
    "zhs_ws_auto_recovery_memory_usage_mb",
    "Process RSS memory in MB",
)
QUEUE_SIZE = Gauge(
    "zhs_ws_auto_recovery_queue_size",
    "Outbox message queue current size",
)
QUEUE_CAPACITY = Gauge(
    "zhs_ws_auto_recovery_queue_capacity",
    "Outbox message queue capacity",
)
QUEUE_FULL_COUNT = Gauge(
    "zhs_ws_auto_recovery_queue_full_count",
    "Outbox message queue full event count",
)
ACTIVE_CONNECTIONS = Gauge(
    "zhs_ws_auto_recovery_active_connections",
    "Active WebSocket connections",
)
ACTIVE_API_CALLS = Gauge(
    "zhs_ws_auto_recovery_active_api_calls",
    "In-flight API calls",
)
PROCESSING_TASKS = Gauge(
    "zhs_ws_auto_recovery_processing_tasks",
    "Background processing tasks",
)
TOTAL_MESSAGES_QUEUED = Gauge(
    "zhs_ws_auto_recovery_total_messages_queued",
    "Cumulative enqueued message count",
)
LAST_HEALTH_CHECK = Gauge(
    "zhs_ws_auto_recovery_last_health_check_timestamp",
    "Unix timestamp of last health check",
)
LAST_ACTIVITY = Gauge(
    "zhs_ws_auto_recovery_last_activity_timestamp",
    "Unix timestamp of last business activity",
)
INACTIVE_SECONDS = Gauge(
    "zhs_ws_auto_recovery_inactive_seconds",
    "Seconds since last business activity",
)
MONITOR_TASKS_TOTAL = Gauge(
    "zhs_ws_auto_recovery_monitor_tasks_total",
    "Total monitor tasks (active + failed)",
)
MONITOR_TASKS_ACTIVE = Gauge(
    "zhs_ws_auto_recovery_monitor_tasks_active",
    "Active monitor task count",
)
MONITOR_TASKS_FAILED = Gauge(
    "zhs_ws_auto_recovery_monitor_tasks_failed",
    "Failed monitor task count",
)


# ---------------------------------------------------------------------------
# Histogram - 分布
# ---------------------------------------------------------------------------
RECOVERY_DURATION = Histogram(
    "zhs_ws_auto_recovery_recovery_duration_seconds",
    "Recovery operation duration in seconds",
    ["result"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)


# ---------------------------------------------------------------------------
# 同步函数 - 从 manager 状态拉取到 Gauge
# ---------------------------------------------------------------------------
def _safe_get(obj: Any, attr: str, default: Any = None) -> Any:
    """getattr 防御, 防止 manager 缺少字段时崩."""
    return getattr(obj, attr, default) if obj is not None else default


def _read_memory_mb() -> float:
    """读取进程 RSS 内存 MB, psutil 不可用时返回 0.0."""
    try:
        import psutil

        return psutil.Process().memory_info().rss / 1024 / 1024
    except Exception:
        return 0.0


def update_gauges(manager: "WebSocketAutoRecoveryManager | None") -> None:
    """周期性从 manager 拉取状态写入 Gauge.

    应在 health_monitor 主循环中调用 (与现有 5 个监控器解耦,
    失败不应影响主循环). 本函数所有内部异常均吞掉, 仅记录 logger.debug.
    """
    if manager is None:
        # 系统未初始化, 标记 is_running=0
        try:
            IS_RUNNING.set(0)
            SERVICE_STATUS.set(0)
        except Exception:
            pass
        return
    try:
        ws = manager.ws_manager
        IS_RUNNING.set(1 if _safe_get(manager, "is_running", False) else 0)
        SERVICE_STATUS.set(1 if _safe_get(manager, "service_status", "") == "healthy" else 0)
        CONSECUTIVE_ERRORS.set(_safe_get(manager, "consecutive_errors", 0) or 0)
        TOTAL_ERRORS.set(_safe_get(manager, "error_count", 0) or 0)
        RECOVERY_COUNT.set(_safe_get(manager, "recovery_count", 0) or 0)

        # 内存
        MEMORY_USAGE_MB.set(_read_memory_mb())

        # 出箱消息队列
        q = _safe_get(ws, "message_queue")
        if q is not None:
            try:
                QUEUE_SIZE.set(q.qsize())
            except Exception:
                QUEUE_SIZE.set(0)
        else:
            QUEUE_SIZE.set(0)
        QUEUE_CAPACITY.set(_safe_get(ws, "queue_size", 0) or 0)
        QUEUE_FULL_COUNT.set(_safe_get(ws, "queue_full_count", 0) or 0)

        # WS 连接 / API 调用 / 处理任务
        ACTIVE_CONNECTIONS.set(
            len(_safe_get(ws, "active_connections", {}) or {})
        )
        ACTIVE_API_CALLS.set(
            len(_safe_get(ws, "active_api_calls", {}) or {})
        )
        tasks = _safe_get(ws, "processing_tasks", set()) or set()
        if isinstance(tasks, set):
            PROCESSING_TASKS.set(sum(1 for t in tasks if not t.done()))
        else:
            PROCESSING_TASKS.set(0)
        TOTAL_MESSAGES_QUEUED.set(_safe_get(ws, "total_messages", 0) or 0)

        # 时间戳
        now = time.time()
        last_health = _safe_get(manager, "last_health_check", 0) or 0
        last_activity = _safe_get(manager, "last_activity_time", 0) or 0
        LAST_HEALTH_CHECK.set(last_health)
        LAST_ACTIVITY.set(last_activity)
        INACTIVE_SECONDS.set(max(0.0, now - last_activity) if last_activity > 0 else 0.0)

        # 监控任务
        monitor_tasks = _safe_get(manager, "monitor_tasks", set()) or set()
        if isinstance(monitor_tasks, set):
            active = sum(1 for t in monitor_tasks if not t.done())
            failed = sum(
                1
                for t in monitor_tasks
                if t.done() and t.exception() is not None
            )
            MONITOR_TASKS_TOTAL.set(len(monitor_tasks))
            MONITOR_TASKS_ACTIVE.set(active)
            MONITOR_TASKS_FAILED.set(failed)
        else:
            MONITOR_TASKS_TOTAL.set(0)
            MONITOR_TASKS_ACTIVE.set(0)
            MONITOR_TASKS_FAILED.set(0)
    except Exception as e:
        # 防御: 任何异常都不应影响主监控循环
        # 但根据项目记忆, 吞 except Exception 必须加 logger.debug
        from loguru import logger as _logger

        _logger.debug(f"[auto_recovery_metrics] update_gauges 异常: {e}")


# ---------------------------------------------------------------------------
# Counter 增量 - 供 auto_recovery.py 显式调用
# ---------------------------------------------------------------------------
def inc_recovery_triggered(reason: str) -> None:
    """恢复触发计数."""
    try:
        RECOVERY_EVENTS.labels(event_type="triggered", reason=reason[:200]).inc()
    except Exception:
        pass


def inc_recovery_succeeded(reason: str) -> None:
    """恢复成功计数."""
    try:
        RECOVERY_EVENTS.labels(event_type="succeeded", reason=reason[:200]).inc()
    except Exception:
        pass


def inc_recovery_failed(reason: str) -> None:
    """恢复失败计数."""
    try:
        RECOVERY_EVENTS.labels(event_type="failed", reason=reason[:200]).inc()
    except Exception:
        pass


def inc_monitor_exception(monitor: str, exc: BaseException) -> None:
    """监控协程异常计数."""
    try:
        MONITOR_EXCEPTIONS.labels(
            monitor=monitor, exception_type=type(exc).__name__
        ).inc()
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Histogram 计时上下文
# ---------------------------------------------------------------------------
class RecoveryTimer:
    """恢复操作计时上下文管理器.

    用法:
        with RecoveryTimer("succeeded"):
            await do_recovery()
    异常路径自动以 result="failed" 结束.
    """

    __slots__ = ("_result", "_start")

    def __init__(self, result: str = "succeeded") -> None:
        self._result = result
        self._start = 0.0

    def __enter__(self) -> "RecoveryTimer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        elapsed = time.perf_counter() - self._start
        if exc is not None:
            self._result = "failed"
        try:
            RECOVERY_DURATION.labels(result=self._result).observe(elapsed)
        except Exception:
            pass


def get_histogram_count(hist: Histogram, **labels: Any) -> float:
    """读取 Histogram 在指定 label 组合下的观测次数.

    实现说明:
    - prometheus_client 的 Histogram 没有 _count 属性 (那是 Counter 专属)
    - 公开 API: hist.labels(**labels)._samples() 返回所有 sample, 其中
      name 以 _count 结尾的那条就是观测次数
    - 防御性: 任何异常 (标签不存在 / 尚未 observe) 返回 0.0

    Args:
        hist: Histogram 实例 (如 RECOVERY_DURATION)
        **labels: 标签键值对 (如 result="failed")

    Returns:
        该 label 组合的累计观测次数, 失败返回 0.0
    """
    try:
        labeled = hist.labels(**labels)
        # _samples() 是 prometheus_client 公开的内部 API, 返回全部 sample
        # 含 _bucket / _count / _sum / _created
        for sample in labeled._samples():
            if sample.name.endswith("_count"):
                return float(sample.value)
        return 0.0
    except Exception:
        # 项目记忆: 吞 except Exception 必须加 logger.debug
        from loguru import logger as _logger

        _logger.debug(f"[auto_recovery_metrics] get_histogram_count 异常: labels={labels}")
        return 0.0


__all__ = [
    "RECOVERY_EVENTS",
    "MONITOR_EXCEPTIONS",
    "IS_RUNNING",
    "SERVICE_STATUS",
    "CONSECUTIVE_ERRORS",
    "TOTAL_ERRORS",
    "RECOVERY_COUNT",
    "MEMORY_USAGE_MB",
    "QUEUE_SIZE",
    "QUEUE_CAPACITY",
    "QUEUE_FULL_COUNT",
    "ACTIVE_CONNECTIONS",
    "ACTIVE_API_CALLS",
    "PROCESSING_TASKS",
    "TOTAL_MESSAGES_QUEUED",
    "LAST_HEALTH_CHECK",
    "LAST_ACTIVITY",
    "INACTIVE_SECONDS",
    "MONITOR_TASKS_TOTAL",
    "MONITOR_TASKS_ACTIVE",
    "MONITOR_TASKS_FAILED",
    "RECOVERY_DURATION",
    "RecoveryTimer",
    "update_gauges",
    "inc_recovery_triggered",
    "inc_recovery_succeeded",
    "inc_recovery_failed",
    "inc_monitor_exception",
    "get_histogram_count",
]
