"""Bug-46 + Bug-54: 关键数据库 query 显式标注 OpenTelemetry span + 慢查询阈值热加载.

让 APM 上能区分关键业务查询 (order 查询, payment 查询, user 查询) vs 普通 ORM 调用.

用法 1 - 装饰器:
    @trace_db_query("order.payment_status_update")
    def update_payment_status(order_id, status):
        ...

用法 2 - context manager:
    with db_span("user.find_active_users", table="users") as span:
        span.set_attribute("filter.status", 1)
        rows = session.query(User).filter(...)

Bug-54: 慢查询阈值 (slow_query_threshold_ms) 从 hot_config 热加载, 默认 500ms,
业务代码调整 HOT_SLOW_QUERY_MS=1000 即可生效, 无需重启.
"""

import functools
import logging
import time
from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

logger = logging.getLogger(__name__)

try:
    from opentelemetry import trace
    from opentelemetry.trace import Status, StatusCode
except Exception:  # opentelemetry 未安装时优雅降级
    trace = None  # type: ignore[assignment]
    Status = None  # type: ignore[assignment]
    StatusCode = None  # type: ignore[assignment]


# Bug-54: 默认慢查询阈值 (可被 hot_config 覆盖)
DEFAULT_SLOW_QUERY_MS = 500


def _get_slow_threshold_ms() -> float:
    """Bug-54: 从 hot_config 读, 缺失则回退默认."""
    try:
        from app.utils.hot_config import hot_get

        v = hot_get("SLOW_QUERY_MS")
        if v is not None:
            return float(v)
    except Exception:
        logger.warning("Caught unexpected exception")
    return DEFAULT_SLOW_QUERY_MS


def _get_tracer():
    if trace is None:
        return None
    return trace.get_tracer("zhs-platform.db")


@contextmanager
def db_span(
    name: str,
    *,
    table: str | None = None,
    engine: str | None = None,
    attributes: dict[str, Any] | None = None,
    record_exception: bool = True,
    slow_threshold_ms: float | None = None,
):
    """为关键 DB 操作打 OpenTelemetry span.

    Args:
        name: 操作名 (如 "order.find_unpaid", "payment.refund")
        table: 操作的表名 (用于搜索)
        engine: 库名 ai/center/course
        attributes: 额外属性 (敏感数据先脱敏!)
        record_exception: 出错时是否把异常计入 span
        slow_threshold_ms: 覆盖默认阈值, 优先级 HOT_SLOW_QUERY_MS < 参数
    """
    tracer = _get_tracer()
    threshold = slow_threshold_ms or _get_slow_threshold_ms()
    if tracer is None:
        # 降级: 用本地 timer 输出
        start = time.perf_counter()
        try:
            yield _NoopSpan()
        finally:
            dur = (time.perf_counter() - start) * 1000
            if dur > threshold:
                from loguru import logger

                logger.warning(f"slow_db_op {name} dur={dur:.1f}ms threshold={threshold}ms")
        return

    with tracer.start_as_current_span(name) as span:
        if table:
            span.set_attribute("db.table", table)
        if engine:
            span.set_attribute("db.engine", engine)
        span.set_attribute("db.system", "postgresql")
        if attributes:
            for k, v in attributes.items():
                # 屏蔽敏感字段
                if any(s in k.lower() for s in ("password", "secret", "token", "phone", "idcard", "cardno")):
                    span.set_attribute(k, "***")
                else:
                    span.set_attribute(k, v)
        start = time.perf_counter()
        try:
            yield span
        except Exception as e:
            if record_exception:
                span.record_exception(e)
                if StatusCode is not None:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
            raise
        finally:
            dur_ms = (time.perf_counter() - start) * 1000
            span.set_attribute("db.duration_ms", round(dur_ms, 2))
            if dur_ms > threshold:
                span.set_attribute("db.slow", True)
                span.set_attribute("db.slow_threshold_ms", threshold)


def trace_db_query(
    name: str | None = None,
    *,
    table: str | None = None,
    engine: str | None = None,
) -> Callable:
    """装饰器版 db_span: 给关键 DB 函数加自动 span.

    用法:
        @trace_db_query("order.update_status", table="zhs_order", engine="ai")
        def update_order_status(out_trade_no, status):
            ...
    """

    def deco(fn: Callable) -> Callable:
        op_name = name or f"db.{fn.__name__}"

        @functools.wraps(fn)
        def sync_wrapper(*args, **kwargs):
            with db_span(op_name, table=table, engine=engine):
                return fn(*args, **kwargs)

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            with db_span(op_name, table=table, engine=engine):
                return await fn(*args, **kwargs)

        if _is_coro(fn):
            return async_wrapper
        return sync_wrapper

    return deco


def _is_coro(fn: Callable) -> bool:
    """判断函数是否 async (heuristic, 不调用)."""
    import inspect

    return inspect.iscoroutinefunction(fn)


class _NoopSpan:
    """otel 未安装时的占位 span."""

    def set_attribute(self, key, value):
        pass

    def set_status(self, *args, **kwargs):
        pass

    def record_exception(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False
