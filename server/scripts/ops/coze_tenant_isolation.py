"""Phase 17 建议 2: Coze 多租户隔离 (API key + 配额 + 限流 + 审计).

目的:
  - 租户级 API key 管理 (生成/吊销/轮换)
  - 每租户配额 (RPM/TPM/日请求/月成本)
  - 限流 (滑动窗口 + 令牌桶)
  - 审计日志 (谁/何时/调用什么/结果)

设计:
  Tenant:
    id, name, tier, status, created_at, metadata

  ApiKey:
    key_id, key_hash, tenant_id, scopes, created_at, expires_at, revoked

  TenantQuota:
    rpm, tpm, daily_requests, monthly_cost_usd, max_concurrent

  QuotaTracker:
    record(token_count) / check()
    滑动窗口 (60s RPM)

  RateLimiter:
    令牌桶, 线程安全

  AuditLog:
    append(tenant, action, ...)
    query(tenant) / export_json()

  TenantManager:
    create_tenant / get_tenant / list_tenants
    create_api_key / revoke_api_key
    set_quota / get_quota
    check_rate_limit / record_usage
    audit_query / audit_export
"""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum

# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


class TenantTier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class AuditAction(str, Enum):
    API_KEY_CREATED = "api_key_created"
    API_KEY_REVOKED = "api_key_revoked"
    API_KEY_USED = "api_key_used"
    QUOTA_EXCEEDED = "quota_exceeded"
    RATE_LIMITED = "rate_limited"
    AUTH_FAILED = "auth_failed"
    TENANT_CREATED = "tenant_created"
    TENANT_SUSPENDED = "tenant_suspended"
    COST_ALERT = "cost_alert"


# ---------------------------------------------------------------------------
# 2. 数据类
# ---------------------------------------------------------------------------


@dataclass
class Tenant:
    id: str
    name: str
    tier: TenantTier = TenantTier.FREE
    status: TenantStatus = TenantStatus.ACTIVE
    created_at: float = field(default_factory=time.time)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "tier": self.tier.value if isinstance(self.tier, TenantTier) else self.tier,
            "status": self.status.value if isinstance(self.status, TenantStatus) else self.status,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }


@dataclass
class ApiKey:
    key_id: str
    key_hash: str  # 存 hash, 不存明文
    tenant_id: str
    scopes: list[str] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    expires_at: float | None = None
    revoked: bool = False
    last_used: float | None = None

    def is_valid(self, now: float | None = None) -> bool:
        if self.revoked:
            return False
        if self.expires_at is not None:
            if (now or time.time()) > self.expires_at:
                return False
        return True


@dataclass
class TenantQuota:
    """租户配额."""

    rpm: int = 60  # requests per minute
    tpm: int = 100_000  # tokens per minute
    daily_requests: int = 10_000
    monthly_cost_usd: float = 100.0
    max_concurrent: int = 10


@dataclass
class AuditEntry:
    ts: float
    tenant_id: str
    api_key_id: str
    action: str
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": datetime.fromtimestamp(self.ts, tz=UTC).isoformat(),
            "tenant_id": self.tenant_id,
            "api_key_id": self.api_key_id,
            "action": self.action,
            **self.details,
        }


# ---------------------------------------------------------------------------
# 3. QuotaTracker (滑动窗口)
# ---------------------------------------------------------------------------


class QuotaTracker:
    """滑动窗口配额跟踪.

    记录每租户的最近请求时间戳, 用于:
      - 限流 (60s 内 N 次)
      - 日配额
      - 月成本
    """

    def __init__(self, window_seconds: int = 60):
        self.window = window_seconds
        self._lock = threading.Lock()
        # tenant_id -> deque[float] (请求时间戳)
        self._requests: dict[str, deque[float]] = defaultdict(deque)
        # tenant_id -> 当天请求数
        self._daily: dict[str, int] = defaultdict(int)
        # tenant_id -> 当月成本
        self._monthly_cost: dict[str, float] = defaultdict(float)
        # tenant_id -> 当前并发数
        self._concurrent: dict[str, int] = defaultdict(int)
        self._current_day = time.strftime("%Y-%m-%d")
        self._current_month = time.strftime("%Y-%m")

    def _cleanup_window(self, tid: str, now: float) -> None:
        dq = self._requests.get(tid)
        if not dq:
            return
        cutoff = now - self.window
        while dq and dq[0] < cutoff:
            dq.popleft()

    def _maybe_reset(self) -> None:
        day = time.strftime("%Y-%m-%d")
        month = time.strftime("%Y-%m")
        if day != self._current_day:
            self._daily.clear()
            self._current_day = day
        if month != self._current_month:
            self._monthly_cost.clear()
            self._current_month = month

    def acquire_slot(self, tid: str) -> bool:
        """尝试获取一个请求 slot (线程安全)."""
        with self._lock:
            self._maybe_reset()
            self._cleanup_window(tid, time.time())
            self._concurrent[tid] += 1
            return True

    def release_slot(self, tid: str) -> None:
        with self._lock:
            if self._concurrent[tid] > 0:
                self._concurrent[tid] -= 1

    def record_request(self, tid: str, tokens: int = 0, cost: float = 0.0, ts: float | None = None) -> None:
        with self._lock:
            self._maybe_reset()
            now = ts if ts is not None else time.time()
            self._cleanup_window(tid, now)
            self._requests[tid].append(now)
            self._daily[tid] += 1
            self._monthly_cost[tid] += cost

    def check_rpm(self, tid: str, quota: TenantQuota) -> bool:
        with self._lock:
            self._cleanup_window(tid, time.time())
            return len(self._requests.get(tid, [])) < quota.rpm

    def check_concurrent(self, tid: str, quota: TenantQuota) -> bool:
        with self._lock:
            return self._concurrent.get(tid, 0) < quota.max_concurrent

    def check_daily(self, tid: str, quota: TenantQuota) -> bool:
        with self._lock:
            return self._daily.get(tid, 0) < quota.daily_requests

    def check_monthly_cost(self, tid: str, quota: TenantQuota) -> bool:
        with self._lock:
            return self._monthly_cost.get(tid, 0.0) < quota.monthly_cost_usd

    def concurrent_count(self, tid: str) -> int:
        with self._lock:
            return self._concurrent.get(tid, 0)

    def daily_count(self, tid: str) -> int:
        with self._lock:
            return self._daily.get(tid, 0)

    def monthly_cost(self, tid: str) -> float:
        with self._lock:
            return self._monthly_cost.get(tid, 0.0)

    def rpm_current(self, tid: str) -> int:
        """当前窗口内的请求数."""
        with self._lock:
            self._cleanup_window(tid, time.time())
            return len(self._requests.get(tid, []))


# ---------------------------------------------------------------------------
# 4. RateLimiter (令牌桶)
# ---------------------------------------------------------------------------


class RateLimiter:
    """令牌桶限流器."""

    def __init__(self, capacity: int = 60, refill_rate: float = 1.0):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self._tokens = float(capacity)
        self._last_refill = time.time()
        self._lock = threading.Lock()

    def acquire(self, tokens: int = 1) -> bool:
        with self._lock:
            now = time.time()
            elapsed = now - self._last_refill
            self._tokens = min(self.capacity, self._tokens + elapsed * self.refill_rate)
            self._last_refill = now
            if self._tokens >= tokens:
                self._tokens -= tokens
                return True
            return False

    def available(self) -> float:
        with self._lock:
            now = time.time()
            elapsed = now - self._last_refill
            return min(self.capacity, self._tokens + elapsed * self.refill_rate)


# ---------------------------------------------------------------------------
# 5. AuditLog
# ---------------------------------------------------------------------------


class AuditLog:
    """审计日志 (内存版)."""

    def __init__(self, max_entries: int = 50_000):
        self._entries: list[AuditEntry] = []
        self._max = max_entries
        self._lock = threading.Lock()

    def append(
        self,
        tenant_id: str,
        api_key_id: str,
        action: AuditAction | str,
        details: dict | None = None,
    ) -> None:
        with self._lock:
            self._entries.append(
                AuditEntry(
                    ts=time.time(),
                    tenant_id=tenant_id,
                    api_key_id=api_key_id,
                    action=action.value if isinstance(action, AuditAction) else action,
                    details=details or {},
                )
            )
            if len(self._entries) > self._max:
                self._entries = self._entries[-self._max :]

    def query(
        self,
        tenant_id: str | None = None,
        action: str | None = None,
        since: float | None = None,
        limit: int = 100,
    ) -> list[dict]:
        with self._lock:
            out: list[dict] = []
            for e in reversed(self._entries):
                if tenant_id is not None and e.tenant_id != tenant_id:
                    continue
                if action is not None and e.action != action:
                    continue
                if since is not None and e.ts < since:
                    continue
                out.append(e.to_dict())
                if len(out) >= limit:
                    break
            return out

    def to_json(self) -> str:
        with self._lock:
            return json.dumps([e.to_dict() for e in self._entries], ensure_ascii=False, default=str)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


# ---------------------------------------------------------------------------
# 6. TenantManager
# ---------------------------------------------------------------------------


class TenantManager:
    """租户管理器 (整合所有组件)."""

    KEY_PREFIX = "zhs_"
    KEY_BYTES = 32

    def __init__(self):
        self._tenants: dict[str, Tenant] = {}
        self._api_keys: dict[str, ApiKey] = {}  # key_id -> ApiKey
        self._key_to_id: dict[str, str] = {}  # key_hash -> key_id (查找)
        self._quotas: dict[str, TenantQuota] = {}
        self._quota_tracker = QuotaTracker()
        self._rate_limiters: dict[str, RateLimiter] = {}
        self.audit = AuditLog()
        self._lock = threading.Lock()

    # --- 租户管理 ---

    def create_tenant(
        self,
        name: str,
        tier: TenantTier | str = TenantTier.FREE,
        tenant_id: str | None = None,
        metadata: dict | None = None,
    ) -> Tenant:
        with self._lock:
            tid = tenant_id or f"tenant-{secrets.token_hex(4)}"
            if tid in self._tenants:
                raise ValueError(f"tenant {tid} 已存在")
            t = Tenant(
                id=tid,
                name=name,
                tier=TenantTier(tier) if isinstance(tier, str) else tier,
                metadata=metadata or {},
            )
            self._tenants[tid] = t
            self._quotas[tid] = self._default_quota(t.tier)
            self._rate_limiters[tid] = RateLimiter(capacity=60, refill_rate=1.0)
            self.audit.append(tid, "", AuditAction.TENANT_CREATED, {"name": name, "tier": t.tier.value})
            return t

    def get_tenant(self, tid: str) -> Tenant | None:
        return self._tenants.get(tid)

    def list_tenants(self, status: TenantStatus | None = None) -> list[Tenant]:
        ts = list(self._tenants.values())
        if status is not None:
            ts = [t for t in ts if t.status == status]
        return ts

    def suspend_tenant(self, tid: str) -> bool:
        with self._lock:
            t = self._tenants.get(tid)
            if t is None:
                return False
            t.status = TenantStatus.SUSPENDED
            self.audit.append(tid, "", AuditAction.TENANT_SUSPENDED)
            return True

    # --- API key ---

    def create_api_key(
        self,
        tenant_id: str,
        scopes: list[str] | None = None,
        expires_in_s: float | None = None,
    ) -> tuple[str, ApiKey]:
        """生成 API key. 返回 (明文 key, ApiKey 对象).

        明文 key 仅此一次返回, 之后只存 hash.
        """
        with self._lock:
            if tenant_id not in self._tenants:
                raise ValueError(f"tenant {tenant_id} 不存在")
            plaintext = self.KEY_PREFIX + secrets.token_urlsafe(self.KEY_BYTES)
            key_hash = hashlib.sha256(plaintext.encode("utf-8")).hexdigest()
            key_id = f"key-{secrets.token_hex(4)}"
            key = ApiKey(
                key_id=key_id,
                key_hash=key_hash,
                tenant_id=tenant_id,
                scopes=scopes or ["read", "write"],
                expires_at=time.time() + expires_in_s if expires_in_s else None,
            )
            self._api_keys[key_id] = key
            self._key_to_id[key_hash] = key_id
            self.audit.append(tenant_id, key_id, AuditAction.API_KEY_CREATED, {"scopes": key.scopes})
            return plaintext, key

    def revoke_api_key(self, key_id: str) -> bool:
        with self._lock:
            k = self._api_keys.get(key_id)
            if k is None:
                return False
            k.revoked = True
            self.audit.append(k.tenant_id, key_id, AuditAction.API_KEY_REVOKED)
            return True

    def authenticate(self, plaintext_key: str) -> tuple[ApiKey, Tenant] | None:
        """认证: 明文 key -> (ApiKey, Tenant)."""
        if not plaintext_key.startswith(self.KEY_PREFIX):
            self.audit.append(", ", AuditAction.AUTH_FAILED, {"reason": "invalid_prefix"})
            return None
        key_hash = hashlib.sha256(plaintext_key.encode("utf-8")).hexdigest()
        key_id = self._key_to_id.get(key_hash)
        if key_id is None:
            self.audit.append(", ", AuditAction.AUTH_FAILED, {"reason": "unknown_key"})
            return None
        k = self._api_keys[key_id]
        if not k.is_valid():
            self.audit.append(k.tenant_id, key_id, AuditAction.AUTH_FAILED, {"reason": "expired_or_revoked"})
            return None
        t = self._tenants.get(k.tenant_id)
        if t is None or t.status != TenantStatus.ACTIVE:
            self.audit.append(k.tenant_id, key_id, AuditAction.AUTH_FAILED, {"reason": "tenant_inactive"})
            return None
        # 记录使用
        k.last_used = time.time()
        self.audit.append(k.tenant_id, key_id, AuditAction.API_KEY_USED)
        return k, t

    # --- 配额 ---

    def get_quota(self, tid: str) -> TenantQuota | None:
        return self._quotas.get(tid)

    def set_quota(self, tid: str, quota: TenantQuota) -> None:
        with self._lock:
            self._quotas[tid] = quota

    def _default_quota(self, tier: TenantTier) -> TenantQuota:
        if tier == TenantTier.FREE:
            return TenantQuota(rpm=10, tpm=10_000, daily_requests=100, monthly_cost_usd=1.0, max_concurrent=2)
        if tier == TenantTier.PRO:
            return TenantQuota(rpm=60, tpm=100_000, daily_requests=10_000, monthly_cost_usd=100.0, max_concurrent=10)
        if tier == TenantTier.ENTERPRISE:
            return TenantQuota(
                rpm=600, tpm=1_000_000, daily_requests=1_000_000, monthly_cost_usd=10_000.0, max_concurrent=100
            )
        return TenantQuota()

    # --- 限流 + 配额检查 ---

    def check_request_allowed(
        self,
        tid: str,
        tokens: int = 0,
        cost: float = 0.0,
    ) -> tuple[bool, str]:
        """检查请求是否允许: (allowed, reason)."""
        quota = self._quotas.get(tid)
        if quota is None:
            return False, "no_quota"
        if not self._quota_tracker.check_rpm(tid, quota):
            self.audit.append(tid, "", AuditAction.RATE_LIMITED, {"reason": "rpm_exceeded"})
            return False, "rpm_exceeded"
        if not self._quota_tracker.check_concurrent(tid, quota):
            self.audit.append(tid, "", AuditAction.RATE_LIMITED, {"reason": "concurrent_exceeded"})
            return False, "concurrent_exceeded"
        if not self._quota_tracker.check_daily(tid, quota):
            self.audit.append(tid, "", AuditAction.QUOTA_EXCEEDED, {"reason": "daily_exceeded"})
            return False, "daily_exceeded"
        if not self._quota_tracker.check_monthly_cost(tid, quota):
            self.audit.append(tid, "", AuditAction.QUOTA_EXCEEDED, {"reason": "monthly_cost_exceeded"})
            return False, "monthly_cost_exceeded"
        return True, "ok"

    def record_usage(self, tid: str, tokens: int = 0, cost: float = 0.0) -> None:
        self._quota_tracker.record_request(tid, tokens=tokens, cost=cost)

    def get_usage(self, tid: str) -> dict:
        return {
            "concurrent": self._quota_tracker.concurrent_count(tid),
            "rpm_current": self._quota_tracker.rpm_current(tid),
            "daily": self._quota_tracker.daily_count(tid),
            "monthly_cost_usd": round(self._quota_tracker.monthly_cost(tid), 4),
        }

    # --- 审计 ---

    def audit_query(self, tid: str | None = None, action: str | None = None, limit: int = 100) -> list[dict]:
        return self.audit.query(tenant_id=tid, action=action, limit=limit)

    def audit_export_json(self) -> str:
        return self.audit.to_json()


# ---------------------------------------------------------------------------
# 7. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None, mgr: TenantManager | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="Coze 多租户隔离")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_create = sub.add_parser("create-tenant")
    p_create.add_argument("--name", required=True)
    p_create.add_argument("--tier", default="free", choices=["free", "pro", "enterprise"])
    p_create.add_argument("--id", default="")

    p_key = sub.add_parser("create-key")
    p_key.add_argument("--tenant", required=True)
    p_key.add_argument("--expires-in", type=float, default=0)

    p_auth = sub.add_parser("auth")
    p_auth.add_argument("--key", required=True)

    p_check = sub.add_parser("check")
    p_check.add_argument("--tenant", required=True)
    p_check.add_argument("--tokens", type=int, default=0)
    p_check.add_argument("--cost", type=float, default=0.0)

    p_audit = sub.add_parser("audit")
    p_audit.add_argument("--tenant", default="")
    p_audit.add_argument("--limit", type=int, default=20)

    sub.add_parser("list-tenants")

    args = p.parse_args(argv)
    if mgr is None:
        mgr = TenantManager()

    if args.cmd == "create-tenant":
        t = mgr.create_tenant(args.name, tier=args.tier, tenant_id=args.id or None)
        print(json.dumps(t.to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "create-key":
        plaintext, k = mgr.create_api_key(args.tenant, expires_in_s=args.expires_in or None)
        print(f"明文 key (仅此一次): {plaintext}")
        print(f"key_id: {k.key_id}")
        return 0
    if args.cmd == "auth":
        result = mgr.authenticate(args.key)
        if result is None:
            print("认证失败")
            return 1
        k, t = result
        print(
            json.dumps(
                {"tenant_id": t.id, "name": t.name, "tier": t.tier.value, "key_id": k.key_id},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.cmd == "check":
        allowed, reason = mgr.check_request_allowed(args.tenant, tokens=args.tokens, cost=args.cost)
        print(
            json.dumps(
                {"allowed": allowed, "reason": reason, "usage": mgr.get_usage(args.tenant)},
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if allowed else 2
    if args.cmd == "audit":
        entries = mgr.audit_query(args.tenant or None, limit=args.limit)
        print(json.dumps(entries, ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "list-tenants":
        tenants = mgr.list_tenants()
        print(json.dumps([t.to_dict() for t in tenants], ensure_ascii=False, indent=2))
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
