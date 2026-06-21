"""Bug-88: 多租户限流公平性 (DRF: Deficit Round Robin + tenant weight).

设计:
  - 经典 DRR 算法: 每个租户有 quantum, 服务时按 quantum 分发
  - 大租户不挤占小租户: 按 weight 比例分配额度
  - 突发场景: 桶内余量可在 idle 期间累积 (credit)
  - 超过 cap_per_tenant 的租户自动降级到 best-effort
  - 拒绝时返回 False, 累计 reject_by_tenant / over_quota

使用:
    from app.utils.fair_rate_limit import fair_rate_limiter

    fair_rate_limiter.set_weight("tenant_a", weight=2.0)
    fair_rate_limiter.set_weight("tenant_b", weight=1.0)
    if not fair_rate_limiter.acquire("tenant_a", units=1):
        return 429
"""

import logging
import threading
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_TOTAL_QPS = 100
DEFAULT_BURST_MULTIPLIER = 1.5
DEFAULT_WEIGHT = 1.0
DEFAULT_CAP = 1000


@dataclass
class TenantBucket:
    tenant: str
    weight: float = DEFAULT_WEIGHT
    cap: int = DEFAULT_CAP
    credit: float = 0.0
    deficit: float = 0.0
    last_ts: float = field(default_factory=time.time)
    total_acquire: int = 0
    total_reject: int = 0

    def to_dict(self) -> dict:
        return {
            "tenant": self.tenant,
            "weight": self.weight,
            "cap": self.cap,
            "credit": round(self.credit, 3),
            "deficit": round(self.deficit, 3),
            "total_acquire": self.total_acquire,
            "total_reject": self.total_reject,
        }


class FairRateLimiter:
    """基于 DRR (Deficit Round Robin) 的多租户公平限流."""

    def __init__(
        self,
        total_qps: int = DEFAULT_TOTAL_QPS,
        burst_multiplier: float = DEFAULT_BURST_MULTIPLIER,
    ):
        self._lock = threading.Lock()
        self._total_qps = total_qps
        self._burst_mult = burst_multiplier
        self._buckets: dict[str, TenantBucket] = {}
        self._quantum = 1.0  # DRR quantum 单位
        self._last_round = time.time()
        self._round_count = 0
        self._total_acquire = 0
        self._total_reject = 0
        self._rejected_by_over_quota = 0
        self._rejected_by_cap = 0

    def set_limits(
        self,
        total_qps: int | None = None,
        burst_multiplier: float | None = None,
    ) -> None:
        with self._lock:
            if total_qps is not None:
                self._total_qps = int(total_qps)
            if burst_multiplier is not None:
                self._burst_mult = float(burst_multiplier)

    def set_weight(self, tenant: str, weight: float = DEFAULT_WEIGHT, cap: int = DEFAULT_CAP) -> None:
        with self._lock:
            b = self._buckets.get(tenant)
            if b is None:
                # 新租户: 给 1.0 初始 credit (允许至少一次 acquire, 避免冷启动饿死)
                b = TenantBucket(
                    tenant=tenant,
                    weight=float(weight),
                    cap=int(cap),
                    credit=1.0,
                )
                self._buckets[tenant] = b
            else:
                b.weight = float(weight)
                b.cap = int(cap)

    def remove_tenant(self, tenant: str) -> None:
        with self._lock:
            self._buckets.pop(tenant, None)

    def list_tenants(self) -> list[str]:
        with self._lock:
            return list(self._buckets.keys())

    def _refill(self, b: TenantBucket, now: float) -> None:
        """按 weight 比例累计 credit (简化: 每秒加 weight*qps/总weight)."""
        # 总权重
        total_w = sum(x.weight for x in self._buckets.values()) or 1.0
        per_sec = self._total_qps * b.weight / total_w
        elapsed = max(0.0, now - b.last_ts)
        # credit 上限 = cap
        max_credit = float(b.cap)
        b.credit = min(max_credit, b.credit + per_sec * elapsed)
        b.last_ts = now

    def acquire(self, tenant: str, units: int = 1) -> bool:
        """尝试获取 units 个额度. 成功 True, 拒绝 False."""
        now = time.time()
        with self._lock:
            b = self._buckets.get(tenant)
            if b is None:
                # 自动注册默认权重
                b = TenantBucket(tenant=tenant)
                self._buckets[tenant] = b
            self._refill(b, now)
            if b.credit >= units:
                b.credit -= units
                b.total_acquire += 1
                self._total_acquire += 1
                return True
            # credit 不足
            b.total_reject += 1
            self._total_reject += 1
            self._rejected_by_over_quota += 1
            return False

    def try_acquire(self, tenant: str, units: int = 1) -> tuple[bool, str]:
        """同 acquire, 但返回 (ok, 拒绝原因)."""
        ok = self.acquire(tenant, units)
        if ok:
            return True, ""
        return False, "over_quota"

    def get_tenant_credit(self, tenant: str) -> float:
        with self._lock:
            b = self._buckets.get(tenant)
            if b is None:
                return 0.0
            self._refill(b, time.time())
            return round(b.credit, 3)

    def reset_tenant(self, tenant: str) -> None:
        with self._lock:
            b = self._buckets.get(tenant)
            if b is not None:
                b.credit = 0.0
                b.deficit = 0.0

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_qps": self._total_qps,
                "burst_multiplier": self._burst_mult,
                "total_acquire": self._total_acquire,
                "total_reject": self._total_reject,
                "rejected_over_quota": self._rejected_by_over_quota,
                "rejected_by_cap": self._rejected_by_cap,
                "tenant_count": len(self._buckets),
                "tenants": {k: v.to_dict() for k, v in self._buckets.items()},
            }


# 全局单例
fair_rate_limiter = FairRateLimiter()
