"""Bug-64: 慢请求上下文快照.

目标: 请求处理时长 > 阈值时, 自动保存:
  - HTTP 元数据 (method, path, headers, query)
  - 业务上下文 (request_id, user_id, tenant_id, trace_id)
  - 调用栈 (snapshot at slow point)
  - 已记录的 DB spans (前 N 个 db_span 名字)
  - 关联的 metric 计数 (in-memory)

存储:
  - 本地文件: snapshots/snapshot_<request_id>_<ts>.json (保留 1 周)
  - 同步: alert_warning 触发
  - 接口: /api/v1/diag/slow_snapshots (admin 查)

使用:
    from app.utils.slow_snapshot import slow_snapshot_middleware, capture_snapshot

    # 1) 安装中间件
    app.middleware("http")(slow_snapshot_middleware)

    # 2) 业务代码主动捕获
    capture_snapshot(label="payment.callback", extra={"order_no": "..."})
"""

import functools
import json
import logging
import os
import threading
import time
import traceback
from collections.abc import Callable
from contextlib import contextmanager
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_SLOW_THRESHOLD_MS = 1500.0  # 1.5s
DEFAULT_MAX_SNAPSHOTS = 1000
SNAPSHOT_DIR = os.environ.get("SLOW_SNAPSHOT_DIR", "snapshots")


@dataclass
class SlowSnapshot:
    label: str
    duration_ms: float
    timestamp: float
    request_id: str = ""
    user_uuid: str = ""
    tenant_id: str = ""
    trace_id: str = ""
    method: str = ""
    path: str = ""
    query: dict = field(default_factory=dict)
    headers: dict = field(default_factory=dict)
    stack: str = ""
    db_spans: list[dict] = field(default_factory=list)
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "label": self.label,
            "duration_ms": round(self.duration_ms, 2),
            "timestamp": self.timestamp,
            "request_id": self.request_id,
            "user_uuid": self.user_uuid,
            "tenant_id": self.tenant_id,
            "trace_id": self.trace_id,
            "method": self.method,
            "path": self.path,
            "query": self.query,
            "headers": _redact_headers(self.headers),
            "stack": self.stack[:3000],
            "db_spans": self.db_spans,
            "extra": self.extra,
        }


def _redact_headers(headers: dict) -> dict:
    """脱敏敏感头."""
    sensitive = {"authorization", "cookie", "x-api-key", "x-auth-token", "password"}
    out = {}
    for k, v in headers.items():
        kl = k.lower()
        if any(s in kl for s in sensitive):
            out[k] = "***"
        else:
            out[k] = v
    return out


class SlowSnapshotStore:
    """内存 + 文件 双写."""

    def __init__(self):
        self._items: list[SlowSnapshot] = []
        self._lock = threading.Lock()
        self._enabled = True
        try:
            os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        except Exception:
            logger.warning("Caught unexpected exception")

    def add(self, snap: SlowSnapshot) -> None:
        if not self._enabled:
            return
        with self._lock:
            self._items.append(snap)
            if len(self._items) > DEFAULT_MAX_SNAPSHOTS:
                self._items = self._items[-DEFAULT_MAX_SNAPSHOTS:]
        # 写文件
        self._write_file(snap)

    def _write_file(self, snap: SlowSnapshot) -> None:
        try:
            fn = f"snapshot_{snap.request_id or 'noid'}_{int(snap.timestamp * 1000)}.json"
            path = os.path.join(SNAPSHOT_DIR, fn)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(snap.to_dict(), f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.debug(f"slow_snapshot write file fail: {e}")

    def list(self, limit: int = 50) -> list[dict]:
        with self._lock:
            return [s.to_dict() for s in self._items[-limit:]]

    def clear(self) -> None:
        with self._lock:
            self._items.clear()

    def stats(self) -> dict:
        with self._lock:
            return {
                "stored": len(self._items),
                "enabled": self._enabled,
                "dir": SNAPSHOT_DIR,
            }


# 全局单例
slow_snapshot_store = SlowSnapshotStore()


# ---------------------------------------------------------------------------
# 中间件
# ---------------------------------------------------------------------------


def _hot_threshold_ms() -> float:
    try:
        from app.utils.hot_config import hot_get

        v = hot_get("SLOW_REQUEST_MS", DEFAULT_SLOW_THRESHOLD_MS)
        return float(v)
    except Exception:
        return DEFAULT_SLOW_THRESHOLD_MS


async def slow_snapshot_middleware(request, call_next):
    """FastAPI 中间件: 慢请求自动快照."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    threshold = _hot_threshold_ms()
    if duration_ms >= threshold:
        try:
            # 收集上下文
            request_id = ""
            user_uuid = ""
            tenant_id = ""
            trace_id = ""
            try:
                from app.telemetry import get_request_context

                ctx = get_request_context() or {}
                request_id = str(ctx.get("request_id", ""))
                user_uuid = str(ctx.get("user_uuid", ""))
                tenant_id = str(ctx.get("tenant_id", ""))
                trace_id = str(ctx.get("trace_id", ""))
            except Exception:
                logger.warning("Caught unexpected exception")
            snap = SlowSnapshot(
                label=f"http:{request.method} {request.url.path}",
                duration_ms=duration_ms,
                timestamp=time.time(),
                request_id=request_id,
                user_uuid=user_uuid,
                tenant_id=tenant_id,
                trace_id=trace_id,
                method=request.method,
                path=request.url.path,
                query=dict(request.query_params),
                headers=dict(request.headers),
                stack="".join(traceback.format_stack(limit=10)),
            )
            slow_snapshot_store.add(snap)
            # 触发告警 (Warning 级别)
            try:
                from app.utils.alert_router import alert_warning

                alert_warning(
                    f"slow_request:{request.url.path}",
                    f"{request.method} {request.url.path} took {duration_ms:.0f}ms "
                    f"(threshold {threshold:.0f}ms). req_id={request_id}",
                )
            except Exception:
                logger.warning("Caught unexpected exception")
        except Exception as e:
            logger.debug(f"slow_snapshot_middleware err: {e}")
    return response


# ---------------------------------------------------------------------------
# 业务主动捕获
# ---------------------------------------------------------------------------


_db_spans_buffer: list[dict] = []
_db_spans_lock = threading.Lock()


def record_db_span(name: str, attrs: dict | None = None) -> None:
    """业务侧 db_span 完成后调一次, 把名字存到线程本地."""
    with _db_spans_lock:
        _db_spans_buffer.append(
            {
                "name": name,
                "attrs": attrs or {},
                "ts": time.time(),
            }
        )
        if len(_db_spans_buffer) > 1000:
            del _db_spans_buffer[: len(_db_spans_buffer) - 1000]


def _consume_db_spans(limit: int = 50) -> list[dict]:
    with _db_spans_lock:
        spans = list(_db_spans_buffer[:limit])
        _db_spans_buffer.clear()
    return spans


@contextmanager
def capture_snapshot(label: str, extra: dict | None = None):
    """业务代码块: 任意耗时操作前后包一下, 超过阈值自动存快照.

    Example:
        with capture_snapshot("payment.callback", {"order_no": "x"}):
            do_payment_callback()
    """
    start = time.perf_counter()
    db_spans_before = len(_db_spans_buffer)
    try:
        yield
    finally:
        duration_ms = (time.perf_counter() - start) * 1000
        if duration_ms >= _hot_threshold_ms():
            try:
                request_id = ""
                user_uuid = ""
                tenant_id = ""
                trace_id = ""
                try:
                    from app.telemetry import get_request_context

                    ctx = get_request_context() or {}
                    request_id = str(ctx.get("request_id", ""))
                    user_uuid = str(ctx.get("user_uuid", ""))
                    tenant_id = str(ctx.get("tenant_id", ""))
                    trace_id = str(ctx.get("trace_id", ""))
                except Exception:
                    logger.warning("Caught unexpected exception")
                new_spans = _db_spans_buffer[db_spans_before:]
                snap = SlowSnapshot(
                    label=label,
                    duration_ms=duration_ms,
                    timestamp=time.time(),
                    request_id=request_id,
                    user_uuid=user_uuid,
                    tenant_id=tenant_id,
                    trace_id=trace_id,
                    stack="".join(traceback.format_stack(limit=10)),
                    db_spans=list(new_spans[:50]),
                    extra=extra or {},
                )
                slow_snapshot_store.add(snap)
            except Exception as e:
                logger.debug(f"capture_snapshot err: {e}")


def capture_snapshot_decorator(label: str | None = None):
    """装饰器版: 函数耗时超阈值时存快照.

    Example:
        @capture_snapshot_decorator("payment.refund")
        def refund_order(...): ...
    """

    def deco(fn: Callable) -> Callable:
        actual_label = label or f"func:{fn.__name__}"

        @functools.wraps(fn)
        async def async_wrapper(*args, **kwargs):
            with capture_snapshot(actual_label):
                return await fn(*args, **kwargs)

        @functools.wraps(fn)
        def sync_wrapper(*args, **kwargs):
            with capture_snapshot(actual_label):
                return fn(*args, **kwargs)

        import inspect

        if inspect.iscoroutinefunction(fn):
            return async_wrapper
        return sync_wrapper

    return deco
