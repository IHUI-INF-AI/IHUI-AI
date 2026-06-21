"""Bug-96: API Key 配额分层 (tier-based: free / pro / enterprise).

设计:
  - tier 字典: qps, daily_quota, monthly_quota
  - api_key -> tier + 已用量
  - QPS 用滑动窗口 + token bucket
  - 月配额按 UTC 月聚合
  - 拒绝时返回 reason (qps / daily / monthly)

使用:
    from app.utils.api_key_quota import api_key_quota

    api_key_quota.register_key("k1", tier="pro")
    ok, reason = api_key_quota.acquire("k1", units=1)
"""

import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# 内置 tier
TIER_FREE = "free"
TIER_PRO = "pro"
TIER_ENTERPRISE = "enterprise"

DEFAULT_TIERS: dict[str, dict[str, int]] = {
    TIER_FREE: {"qps": 1, "daily": 1000, "monthly": 10_000},
    TIER_PRO: {"qps": 20, "daily": 100_000, "monthly": 3_000_000},
    TIER_ENTERPRISE: {"qps": 200, "daily": 1_000_000, "monthly": 50_000_000},
}


@dataclass
class KeyState:
    api_key: str
    tier: str
    qps_used: deque[float] = field(default_factory=deque)
    daily_used: int = 0
    daily_reset_at: float = 0.0
    monthly_used: int = 0
    monthly_reset_at: float = 0.0
    total_acquire = 0  # 防止 dataclass 冻结
    total_reject = 0

    def __post_init__(self):
        self.total_acquire = 0
        self.total_reject = 0


def _month_start_ts(now: float) -> float:
    """返回本月 1 号 00:00 UTC 的时间戳."""
    t = time.gmtime(now)
    return time.mktime((t.tm_year, t.tm_mon, 1, 0, 0, 0, 0, 0, 0))


class ApiKeyQuota:
    """API Key 分层配额."""

    def __init__(self):
        self._lock = threading.RLock()
        self._tiers: dict[str, dict[str, int]] = {k: dict(v) for k, v in DEFAULT_TIERS.items()}
        self._keys: dict[str, KeyState] = {}
        self._total_acquire = 0
        self._total_reject = 0
        self._reject_by_qps = 0
        self._reject_by_daily = 0
        self._reject_by_monthly = 0

    def set_tier(self, tier: str, qps: int, daily: int, monthly: int) -> None:
        with self._lock:
            self._tiers[tier] = {"qps": int(qps), "daily": int(daily), "monthly": int(monthly)}

    def list_tiers(self) -> dict[str, dict[str, int]]:
        with self._lock:
            return {k: dict(v) for k, v in self._tiers.items()}

    def register_key(self, api_key: str, tier: str = TIER_FREE) -> None:
        with self._lock:
            if api_key in self._keys:
                self._keys[api_key].tier = tier
                return
            self._keys[api_key] = KeyState(api_key=api_key, tier=tier)

    def unregister_key(self, api_key: str) -> bool:
        with self._lock:
            return self._keys.pop(api_key, None) is not None

    def get_state(self, api_key: str) -> dict[str, int] | None:
        with self._lock:
            st = self._keys.get(api_key)
            if st is None:
                return None
            return {
                "tier": st.tier,
                "daily_used": st.daily_used,
                "monthly_used": st.monthly_used,
                "qps_window": len(st.qps_used),
                "total_acquire": st.total_acquire,
                "total_reject": st.total_reject,
            }

    def _maybe_reset_daily(self, st: KeyState, now: float) -> None:
        # 按本地午夜简化
        lt = time.localtime(now)
        day_start = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, 0))
        if day_start > st.daily_reset_at:
            st.daily_used = 0
            st.daily_reset_at = day_start + 86400  # 到次日 0 点

    def _maybe_reset_monthly(self, st: KeyState, now: float) -> None:
        m = _month_start_ts(now)
        if m > st.monthly_reset_at:
            st.monthly_used = 0
            st.monthly_reset_at = m + 31 * 86400  # 简化

    def acquire(self, api_key: str, units: int = 1) -> tuple[bool, str]:
        now = time.time()
        with self._lock:
            st = self._keys.get(api_key)
            if st is None:
                # 自动注册为 free
                st = KeyState(api_key=api_key, tier=TIER_FREE)
                self._keys[api_key] = st
            tier = self._tiers.get(st.tier, self._tiers[TIER_FREE])
            self._maybe_reset_daily(st, now)
            self._maybe_reset_monthly(st, now)
            # 月配额
            if st.monthly_used + units > tier["monthly"]:
                self._total_reject += 1
                self._reject_by_monthly += 1
                st.total_reject += 1
                return False, "monthly_quota"
            # 日配额
            if st.daily_used + units > tier["daily"]:
                self._total_reject += 1
                self._reject_by_daily += 1
                st.total_reject += 1
                return False, "daily_quota"
            # QPS 滑动窗口
            cutoff = now - 1.0
            while st.qps_used and st.qps_used[0] < cutoff:
                st.qps_used.popleft()
            if len(st.qps_used) + units > tier["qps"]:
                self._total_reject += 1
                self._reject_by_qps += 1
                st.total_reject += 1
                return False, "qps_quota"
            # 通过
            for _ in range(units):
                st.qps_used.append(now)
            st.daily_used += units
            st.monthly_used += units
            st.total_acquire += 1
            self._total_acquire += 1
        return True, "ok"

    def try_acquire(self, api_key: str, units: int = 1) -> tuple[bool, str]:
        return self.acquire(api_key, units)

    def reset_usage(self, api_key: str) -> None:
        with self._lock:
            st = self._keys.get(api_key)
            if st is None:
                return
            st.qps_used.clear()
            st.daily_used = 0
            st.monthly_used = 0
            st.daily_reset_at = 0
            st.monthly_reset_at = 0

    def stats(self) -> dict:
        with self._lock:
            return {
                "tier_count": len(self._tiers),
                "key_count": len(self._keys),
                "total_acquire": self._total_acquire,
                "total_reject": self._total_reject,
                "reject_by_qps": self._reject_by_qps,
                "reject_by_daily": self._reject_by_daily,
                "reject_by_monthly": self._reject_by_monthly,
                "tiers": {k: dict(v) for k, v in self._tiers.items()},
            }


# 全局单例
api_key_quota = ApiKeyQuota()
