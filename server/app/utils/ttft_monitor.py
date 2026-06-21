"""Bug-92: LLM 流式首 token 时间 (TTFT) 监控 + P50/P95/P99.

设计:
  - 记录每次流式 LLM 调用的首 token 延迟
  - 同时记录总耗时 / token 数 / 速率
  - 维度: model / tenant / endpoint
  - 滑动窗口 + 简单分位数
  - 超阈值告警阈值 (默认 P95 > 2s 告警)

使用:
    from app.utils.ttft_monitor import ttft_monitor, StreamTTFT

    with StreamTTFT(model="gpt-4o", endpoint="/chat", tenant_id="t1") as ctx:
        async for token in stream:
            ctx.on_token()
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DEFAULT_WINDOW = 200  # 滑动窗口大小
DEFAULT_ALERT_P95_SEC = 2.0


@dataclass
class TtftRecord:
    model: str
    endpoint: str
    tenant_id: str
    ttft_sec: float
    total_sec: float
    token_count: int
    ts: float
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "ts": round(self.ts, 3),
            "model": self.model,
            "endpoint": self.endpoint,
            "tenant_id": self.tenant_id,
            "ttft_sec": round(self.ttft_sec, 4),
            "total_sec": round(self.total_sec, 4),
            "token_count": self.token_count,
            "tps": round(self.token_count / self.total_sec, 2) if self.total_sec > 0 else 0.0,
            "error": self.error,
        }


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = (len(s) - 1) * p
    f = int(k)
    c = min(f + 1, len(s) - 1)
    if f == c:
        return s[f]
    return s[f] + (s[c] - s[f]) * (k - f)


class TtftMonitor:
    """TTFT 监控器."""

    def __init__(self, window: int = DEFAULT_WINDOW, alert_p95: float = DEFAULT_ALERT_P95_SEC):
        self._lock = threading.Lock()
        self._window = window
        self._alert_p95 = alert_p95
        self._records: deque[TtftRecord] = deque(maxlen=window * 4)
        self._alert_count = 0
        self._total_calls = 0
        self._error_calls = 0

    def set_window(self, w: int) -> None:
        with self._lock:
            self._window = max(10, int(w))

    def set_alert_p95(self, sec: float) -> None:
        with self._lock:
            self._alert_p95 = max(0.0, float(sec))

    def record(
        self,
        model: str,
        endpoint: str,
        tenant_id: str,
        ttft_sec: float,
        total_sec: float,
        token_count: int,
        error: str = "",
    ) -> TtftRecord:
        rec = TtftRecord(
            model=model,
            endpoint=endpoint,
            tenant_id=tenant_id,
            ttft_sec=ttft_sec,
            total_sec=total_sec,
            token_count=token_count,
            ts=time.time(),
            error=error,
        )
        with self._lock:
            self._records.append(rec)
            self._total_calls += 1
            if error:
                self._error_calls += 1
            # 检查 P95 告警
            cutoff = time.time() - 300  # 5min 窗口
            recent = [r.ttft_sec for r in self._records if r.ts >= cutoff]
            if len(recent) >= 20:
                p95 = _percentile(recent, 0.95)
                if p95 > self._alert_p95:
                    self._alert_count += 1
                    logger.warning(
                        f"ttft_alert: p95={p95:.3f}s > {self._alert_p95}s " f"model={model} endpoint={endpoint}"
                    )
        return rec

    def percentiles(self, model: str | None = None, last_n: int = 200) -> dict[str, float]:
        with self._lock:
            if model is None:
                vals = [r.ttft_sec for r in list(self._records)[-last_n:]]
            else:
                vals = [r.ttft_sec for r in list(self._records)[-last_n:] if r.model == model]
        return self._percentiles_from(vals)

    def _percentiles_from(self, vals: list[float]) -> dict[str, float]:
        """无锁计算分位数 (内部用, 避免 stats() 持锁重入)."""
        return {
            "p50": round(_percentile(vals, 0.50), 4),
            "p90": round(_percentile(vals, 0.90), 4),
            "p95": round(_percentile(vals, 0.95), 4),
            "p99": round(_percentile(vals, 0.99), 4),
            "count": len(vals),
        }

    def stats(self) -> dict:
        # 不在持锁时调用 percentiles, 避免 self._lock 重入死锁
        with self._lock:
            total_calls = self._total_calls
            error_calls = self._error_calls
            alert_count = self._alert_count
            alert_p95 = self._alert_p95
            window = self._window
            vals = [r.ttft_sec for r in list(self._records)[-200:]]
        return {
            "total_calls": total_calls,
            "error_calls": error_calls,
            "error_rate": round(error_calls / total_calls, 4) if total_calls else 0.0,
            "alert_count": alert_count,
            "alert_p95_sec": alert_p95,
            "window": window,
            "current": self._percentiles_from(vals),
        }

    def clear(self) -> None:
        with self._lock:
            self._records.clear()
            self._total_calls = 0
            self._error_calls = 0
            self._alert_count = 0


# 全局单例
ttft_monitor = TtftMonitor()


class StreamTTFT:
    """with TtftMonitor.StreamTTFT(...) as ctx:"""

    def __init__(self, model: str, endpoint: str = "", tenant_id: str = ""):
        self.model = model
        self.endpoint = endpoint
        self.tenant_id = tenant_id
        self._start = 0.0
        self._first = 0.0
        self._end = 0.0
        self._token_count = 0
        self._error = ""
        self._got_first = False

    def on_token(self) -> None:
        """每个 token 调用. 第一次调用记录 TTFT."""
        if not self._got_first:
            self._first = time.time()
            self._got_first = True
        self._token_count += 1

    def set_error(self, err: str) -> None:
        self._error = err

    def __enter__(self) -> "StreamTTFT":
        self._start = time.time()
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is not None and not self._error:
            self._error = exc_type.__name__
        self._end = time.time()
        if not self._got_first:
            # 没有收到任何 token
            self._first = self._end
        ttft_monitor.record(
            model=self.model,
            endpoint=self.endpoint,
            tenant_id=self.tenant_id,
            ttft_sec=self._first - self._start,
            total_sec=self._end - self._start,
            token_count=self._token_count,
            error=self._error,
        )
        return False
