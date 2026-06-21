"""Bug-116: 链路采样决策器.

设计:
  - 三种策略: head-based / tail-based / 错误优先
  - tail-based: 延迟窗口后根据结果决定是否保留
  - head-based: 入栈时按概率决定
  - 错误优先: 错误请求 100% 保留, 成功请求按概率
  - 租户配额: 每租户每秒最多 N 个 trace
  - 动态采样率: 可运行时调整
  - 决策器: 输入 trace 元数据, 输出 should_sample
"""

import enum
import logging
import random
import threading
import time
from collections import deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class SampleMode(enum.StrEnum):
    HEAD = "head"  # 入栈时按概率
    TAIL = "tail"  # 结束时按结果
    ERROR_FIRST = "error_first"  # 错误 100% 保留
    ALWAYS = "always"  # 全采样
    NEVER = "never"  # 全丢弃


class SampleDecision(enum.StrEnum):
    SAMPLE = "sample"
    DROP = "drop"
    DEFER = "defer"  # 等待后续决策 (tail mode)


@dataclass
class TraceRecord:
    id: str
    tenant: str
    started_at: float
    finished_at: float = 0.0
    duration_sec: float = 0.0
    has_error: bool = False
    error_type: str = ""
    status_code: int = 0
    path: str = ""
    method: str = ""
    decision: str = SampleDecision.DEFER.value
    sampled_at: float = 0.0
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class TenantQuota:
    tenant: str
    per_sec: int = 100
    per_min: int = 5000
    rate: float = 1.0  # 0~1


@dataclass
class SamplingStats:
    total_received: int = 0
    sampled: int = 0
    dropped: int = 0
    deferred: int = 0
    error_sampled: int = 0
    quota_blocked: int = 0


class TraceSampler:
    """链路采样决策器."""

    def __init__(self, default_rate: float = 0.1, mode: str = SampleMode.HEAD.value, max_records: int = 10000):
        self._lock = threading.RLock()
        self._default_rate = max(0.0, min(1.0, default_rate))
        self._mode = mode
        # 按租户的配额
        self._quotas: dict[str, TenantQuota] = {}
        # 滑窗: 每租户每秒/每分钟计数
        self._sec_window: dict[str, deque[float]] = {}
        self._min_window: dict[str, deque[float]] = {}
        # 待决策 (tail mode)
        self._pending: dict[str, TraceRecord] = {}
        self._records: deque[TraceRecord] = deque(maxlen=max_records)
        # 路径采样率: 高频慢路径提高
        self._path_overrides: dict[str, float] = {}
        # 状态
        self._stats = SamplingStats()

    def set_mode(self, mode: str) -> None:
        with self._lock:
            self._mode = mode

    def get_mode(self) -> str:
        with self._lock:
            return self._mode

    def set_default_rate(self, rate: float) -> None:
        with self._lock:
            self._default_rate = max(0.0, min(1.0, rate))

    def set_tenant_quota(
        self, tenant: str, per_sec: int = 100, per_min: int = 5000, rate: float | None = None
    ) -> None:
        with self._lock:
            q = self._quotas.get(tenant) or TenantQuota(tenant=tenant)
            q.per_sec = per_sec
            q.per_min = per_min
            if rate is not None:
                q.rate = max(0.0, min(1.0, rate))
            self._quotas[tenant] = q

    def set_path_rate(self, path: str, rate: float) -> None:
        with self._lock:
            self._path_overrides[path] = max(0.0, min(1.0, rate))

    def start(
        self, trace_id: str, tenant: str, path: str = "", method: str = "", tags: dict[str, str] | None = None
    ) -> TraceRecord:
        """链路开始. 返回 TraceRecord (含决策)."""
        with self._lock:
            self._stats.total_received += 1
        if self._mode == SampleMode.NEVER.value:
            rec = self._mk_record(trace_id, tenant, path, method, tags, decision=SampleDecision.DROP.value)
            self._append(rec)
            with self._lock:
                self._stats.dropped += 1
            return rec
        if self._mode == SampleMode.ALWAYS.value:
            rec = self._mk_record(trace_id, tenant, path, method, tags, decision=SampleDecision.SAMPLE.value)
            self._append(rec)
            with self._lock:
                self._stats.sampled += 1
            return rec
        if self._mode == SampleMode.HEAD.value:
            _ok, decision = self._head_decide(tenant, path)
            rec = self._mk_record(trace_id, tenant, path, method, tags, decision=decision)
            if decision == SampleDecision.SAMPLE.value:
                with self._lock:
                    self._stats.sampled += 1
            else:
                with self._lock:
                    self._stats.dropped += 1
            self._append(rec)
            return rec
        # tail / error_first: 入 pending
        rec = self._mk_record(trace_id, tenant, path, method, tags, decision=SampleDecision.DEFER.value)
        with self._lock:
            self._pending[trace_id] = rec
            self._stats.deferred += 1
        return rec

    def finish(
        self,
        trace_id: str,
        duration_sec: float,
        has_error: bool = False,
        error_type: str = "",
        status_code: int = 0,
    ) -> TraceRecord | None:
        """链路结束. 触发 tail/error_first 决策."""
        with self._lock:
            rec = self._pending.pop(trace_id, None)
        if rec is None:
            # 已在 head 模式决策过
            return None
        rec.duration_sec = duration_sec
        rec.has_error = has_error
        rec.error_type = error_type
        rec.status_code = status_code
        rec.finished_at = time.time()
        decision = self._tail_decide(rec)
        rec.decision = decision
        rec.sampled_at = time.time()
        with self._lock:
            if decision == SampleDecision.SAMPLE.value:
                self._stats.sampled += 1
                if has_error:
                    self._stats.error_sampled += 1
            else:
                self._stats.dropped += 1
            self._stats.deferred = max(0, self._stats.deferred - 1)
        self._append(rec)
        return rec

    def _head_decide(self, tenant: str, path: str) -> tuple[bool, str]:
        rate = self._resolve_rate(tenant, path)
        ok, _blocked = self._quota_check(tenant)
        if not ok:
            with self._lock:
                self._stats.quota_blocked += 1
            return False, SampleDecision.DROP.value
        sampled = random.random() < rate
        return sampled, SampleDecision.SAMPLE.value if sampled else SampleDecision.DROP.value

    def _tail_decide(self, rec: TraceRecord) -> str:
        # 错误 100% 保留
        if self._mode == SampleMode.ERROR_FIRST.value and rec.has_error:
            return SampleDecision.SAMPLE.value
        rate = self._resolve_rate(rec.tenant, rec.path)
        # 慢请求 (>1s) 提高采样
        if rec.duration_sec > 1.0:
            rate = min(1.0, rate * 4)
        if rec.duration_sec > 5.0:
            rate = 1.0
        if rec.has_error:
            rate = min(1.0, rate * 2)
        return SampleDecision.SAMPLE.value if random.random() < rate else SampleDecision.DROP.value

    def _resolve_rate(self, tenant: str, path: str) -> float:
        with self._lock:
            if path and path in self._path_overrides:
                return self._path_overrides[path]
            q = self._quotas.get(tenant)
            if q is not None:
                return q.rate
            return self._default_rate

    def _quota_check(self, tenant: str) -> tuple[bool, bool]:
        with self._lock:
            q = self._quotas.get(tenant)
            if q is None:
                return True, False
            now = time.time()
            sw = self._sec_window.setdefault(tenant, deque())
            mw = self._min_window.setdefault(tenant, deque())
            # 清理窗口
            while sw and now - sw[0] > 1.0:
                sw.popleft()
            while mw and now - mw[0] > 60.0:
                mw.popleft()
            if len(sw) >= q.per_sec:
                return False, True
            if len(mw) >= q.per_min:
                return False, True
            sw.append(now)
            mw.append(now)
            return True, False

    def _mk_record(
        self, trace_id: str, tenant: str, path: str, method: str, tags: dict[str, str] | None, decision: str
    ) -> TraceRecord:
        return TraceRecord(
            id=trace_id,
            tenant=tenant,
            started_at=time.time(),
            path=path,
            method=method,
            decision=decision,
            tags=dict(tags) if tags else {},
        )

    def _append(self, rec: TraceRecord) -> None:
        with self._lock:
            self._records.append(rec)

    def list_sampled(self, limit: int = 100, tenant: str | None = None) -> list[TraceRecord]:
        with self._lock:
            arr = list(self._records)
        if tenant:
            arr = [r for r in arr if r.tenant == tenant]
        arr = [r for r in arr if r.decision == SampleDecision.SAMPLE.value]
        return arr[-limit:]

    def list_pending(self) -> list[TraceRecord]:
        with self._lock:
            return list(self._pending.values())

    def clear_pending(self) -> int:
        with self._lock:
            n = len(self._pending)
            self._pending.clear()
            return n

    def stats(self) -> dict:
        with self._lock:
            return {
                "mode": self._mode,
                "default_rate": self._default_rate,
                "total_received": self._stats.total_received,
                "sampled": self._stats.sampled,
                "dropped": self._stats.dropped,
                "deferred": self._stats.deferred,
                "error_sampled": self._stats.error_sampled,
                "quota_blocked": self._stats.quota_blocked,
                "sample_rate": self._safe_rate(),
                "pending": len(self._pending),
                "quota_count": len(self._quotas),
                "path_override_count": len(self._path_overrides),
            }

    def _safe_rate(self) -> float:
        if self._stats.total_received == 0:
            return 0.0
        return self._stats.sampled / self._stats.total_received

    def reset_stats(self) -> None:
        with self._lock:
            self._stats = SamplingStats()


# 全局单例
trace_sampler = TraceSampler()
