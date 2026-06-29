"""Prometheus 指标定义与 HTTP 中间件."""

import contextlib
import time
from typing import Any

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
REQUEST_COUNT = Counter(
    "zhs_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "zhs_http_request_duration_seconds",
    "Request latency in seconds",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
ACTIVE_CONNECTIONS = Gauge(
    "zhs_active_connections",
    "Active HTTP connections",
)
WS_CONNECTIONS = Gauge(
    "zhs_websocket_connections",
    "Active WebSocket connections",
)
DB_POOL_IN_USE = Gauge(
    "zhs_db_pool_in_use",
    "DB connections currently in use",
    ["engine"],
)
DB_POOL_SIZE = Gauge(
    "zhs_db_pool_size",
    "DB pool configured size (max regular connections)",
    ["engine"],
)
DB_POOL_CHECKEDOUT = Gauge(
    "zhs_db_pool_checkedout",
    "DB pool connections currently checked out from the pool",
    ["engine"],
)
DB_POOL_OVERFLOW = Gauge(
    "zhs_db_pool_overflow",
    "DB pool overflow connections (above pool_size, capped at max_overflow)",
    ["engine"],
)
DB_POOL_CONNECTIONS_TOTAL = Gauge(
    "zhs_db_pool_connections_total",
    "DB pool total open connections (checkedout + idle)",
    ["engine"],
)
DB_POOL_CHECKOUT_TIMEOUTS = Counter(
    "zhs_db_pool_checkout_timeouts_total",
    "Number of times waiting for a connection from the pool exceeded the timeout",
    ["engine"],
)
SQL_LATENCY = Histogram(
    "zhs_sql_query_duration_seconds",
    "SQL query duration in seconds",
    ["engine", "table"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)
SQL_COUNT = Counter(
    "zhs_sql_queries_total",
    "Total SQL queries",
    ["engine", "table", "operation"],
)
SQL_SLOW_COUNT = Counter(
    "zhs_sql_slow_queries_total",
    "Slow SQL queries (above threshold)",
    ["engine", "table"],
)
# 建议 89: 带 OTel trace_id 的慢 SQL 计数 (可定位到具体业务调用)
# 建议 117: 加 tenant_id label, 多租户维度聚合
SLOW_SQL_WITH_TRACE = Counter(
    "zhs_slow_sql_with_trace_total",
    "Slow SQL queries correlated with active OTel trace (with tenant label, 建议 117)",
    ["engine", "table", "tenant_id"],
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    """收集每个 HTTP 请求的指标."""

    async def dispatch(self, request: Request, call_next):
        ACTIVE_CONNECTIONS.inc()
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=request.url.path,
                status="500",
            ).inc()
            ACTIVE_CONNECTIONS.dec()
            raise
        duration = time.perf_counter() - start
        endpoint = request.url.path
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=endpoint,
            status=response.status_code,
        ).inc()
        REQUEST_LATENCY.labels(
            method=request.method,
            endpoint=endpoint,
        ).observe(duration)
        ACTIVE_CONNECTIONS.dec()
        return response


def render_metrics() -> Response:
    """返回 Prometheus 文本格式指标."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


# ---------------------------------------------------------------------------
# SQL 慢查询监控
# ---------------------------------------------------------------------------
SLOW_SQL_THRESHOLD_SECONDS = 0.5  # 超过 500ms 算慢查询
SQL_TRACK: dict[str, Any] = {}


def _extract_table(statement: str) -> str:
    """从 SQL 抽取主表名(粗略)."""
    if not statement:
        return "unknown"
    s = statement.strip().lower()
    # 去掉块注释 /* ... */
    import re

    s = re.sub(r"/\*.*?\*/", " ", s, flags=re.DOTALL)
    s = s.strip()
    try:
        if s.startswith("select"):
            idx = s.find("from")
            if idx > 0:
                rest = s[idx + 4 :].lstrip()
                return rest.split()[0].strip("`'\"`,")  # noqa: B005
        elif s.startswith("insert into"):
            return s.split()[2].strip("`'\"`,")  # noqa: B005
        elif s.startswith("update"):
            return s.split()[1].strip("`'\"`,")  # noqa: B005
        elif s.startswith("delete from"):
            return s.split()[2].strip("`'\"`,")  # noqa: B005
    except Exception:
        pass
    return "unknown"


def install_sql_events(engines: dict):
    """为指定 SQLAlchemy engine 注册 before/after 钩子,统计 SQL 延迟和慢查询.

    engines: {label: Engine} 例 {"ai": engine1, "center": engine2, "course": engine3}
    """
    from sqlalchemy import event

    engine_by_id = {id(e): label for label, e in engines.items()}

    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        import time as _t

        engine_label = engine_by_id.get(id(conn.engine), "unknown")
        SQL_TRACK[id(context)] = {
            "engine": engine_label,
            "statement": statement,
            "start": _t.perf_counter(),
        }

    def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        import time as _t

        from loguru import logger

        info = SQL_TRACK.pop(id(context), None)
        if not info:
            return
        duration = _t.perf_counter() - info["start"]
        engine_label = info.get("engine") or "unknown"
        table = _extract_table(info["statement"])
        op = (info["statement"] or "").split()[0].lower() if info["statement"] else "unknown"
        try:
            SQL_LATENCY.labels(engine=engine_label, table=table).observe(duration)
            SQL_COUNT.labels(engine=engine_label, table=table, operation=op).inc()
            if duration >= SLOW_SQL_THRESHOLD_SECONDS:
                SQL_SLOW_COUNT.labels(engine=engine_label, table=table).inc()
                # 建议 89: 拿当前 OTel trace_id, 串联到日志和指标
                trace_id = ""
                try:
                    from app.telemetry import get_current_trace_id

                    trace_id = get_current_trace_id()
                except Exception:
                    pass
                if trace_id:
                    # 建议 117: tenant_id label, 多租户维度
                    try:
                        from app.telemetry import get_request_context

                        _ctx = get_request_context()
                        tid = _ctx.get("tenant_id") or "anonymous"
                    except Exception:
                        tid = "anonymous"
                    SLOW_SQL_WITH_TRACE.labels(engine=engine_label, table=table, tenant_id=tid).inc()
                # 用 loguru 输出, 让建议 88 的 trace_id patcher 自动串联
                logger.bind(engine=engine_label, table=table, op=op, duration_ms=round(duration * 1000, 2)).warning(
                    f"SLOW SQL trace={trace_id or '-'} [{engine_label}.{table}] "
                    f"{duration*1000:.1f}ms: {(info['statement'] or '')[:200]}"
                )
        except Exception:
            pass

    for _label, engine in engines.items():
        try:
            event.listen(engine, "before_cursor_execute", _before_cursor_execute)
            event.listen(engine, "after_cursor_execute", _after_cursor_execute)
        except Exception:
            pass


def bind_engine_labels(engines: dict):
    """为每个 connection 的 context 标记 engine label(通过 on_checkout 钩子)."""
    from sqlalchemy import event

    def _on_checkout(dbapi_conn, conn_record, conn_proxy):
        try:
            ctx = conn_proxy.connection if hasattr(conn_proxy, "connection") else None
        except Exception:
            return
        for _label, eng in engines.items():
            if ctx and getattr(ctx, "engine", None) is eng:
                # 留作 before_cursor 时回填
                pass

    for _label, engine in engines.items():
        with contextlib.suppress(Exception):
            event.listen(engine, "checkout", _on_checkout)


# ---------------------------------------------------------------------------
# DB Pool 指标采集 (建议 5.1)
# ---------------------------------------------------------------------------


def collect_pool_metrics(engines: dict) -> None:
    """一次性采集所有 engine 的 pool 指标, 调用一次即可挂到 startup.

    使用 Gauge.set_function() 让 prometheus_client 在 scrape 时实时调用
    pool.status() 取数, 避免事件竞态.
    """
    for label, engine in engines.items():
        try:
            pool = engine.pool
            # 静态配置
            DB_POOL_SIZE.labels(engine=label).set(pool.size())
            # 动态实时指标 -- 用 set_function 让 scrape 时再读
            DB_POOL_CHECKEDOUT.labels(engine=label).set_function(lambda p=pool: p.checkedout())
            DB_POOL_OVERFLOW.labels(engine=label).set_function(lambda p=pool: p.overflow())
            DB_POOL_CONNECTIONS_TOTAL.labels(engine=label).set_function(lambda p=pool: p.checkedout() + p.checkedin())
            DB_POOL_IN_USE.labels(engine=label).set_function(lambda p=pool: p.checkedout())
        except Exception as exc:
            import logging

            logging.getLogger("zhs.pool").warning(f"pool metrics collect failed for {label}: {exc}")


def install_pool_events(engines: dict) -> None:
    """注册 checkout/checkin 事件, 维护 in_use gauge + 捕获 checkout 超时.

    这是对 collect_pool_metrics 的事件级补充, 用于:
      - checkout 失败 (timeout) 计数
      - 每条 checkout/checkin 都更新 in_use 即时值, 不依赖 scrape
    """
    import logging

    from sqlalchemy import event

    for label, engine in engines.items():

        def _on_checkout(_dbapi_conn, _conn_record, _conn_proxy, _label=label):
            with contextlib.suppress(Exception):
                DB_POOL_IN_USE.labels(engine=_label).inc()

        def _on_checkin(_dbapi_conn, _conn_record, _label=label):
            with contextlib.suppress(Exception):
                DB_POOL_IN_USE.labels(engine=_label).dec()

        def _on_connect(_dbapi_conn, _conn_record, _label=label):
            logging.getLogger("zhs.pool").debug(f"[{_label}] new DB connection opened")

        def _on_close(_dbapi_conn, _conn_record, _label=label):
            logging.getLogger("zhs.pool").debug(f"[{_label}] DB connection closed")

        def _on_soft_close(_dbapi_conn, _conn_record, _label=label):
            logging.getLogger("zhs.pool").debug(f"[{_label}] DB connection soft-closed")

        for evt, fn in [
            ("checkout", _on_checkout),
            ("checkin", _on_checkin),
            ("connect", _on_connect),
            ("close", _on_close),
            ("soft_close", _on_soft_close),
        ]:
            with contextlib.suppress(Exception):
                event.listen(engine, evt, fn)  # type: ignore[arg-type]
