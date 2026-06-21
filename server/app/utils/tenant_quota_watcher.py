"""Bug-103: 多租户配额动态生效 (Watcher).

设计:
  - 注册租户配额 (QPS / 并发 / 总量) 持久化到 Redis (可选) / 内存
  - 监听变更: 外部源 (Nacos / Redis pub/sub / HTTP API)
  - 变更即时生效 (无需重启), 自动对比新旧值 + 通知回调
  - 变更审计: 记录到内存 ring buffer + 落盘
  - 漂移检测: 配额与限流器实际配额不一致时告警
"""

import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)


class ChangeSource(StrEnum):
    NACOS = "nacos"
    REDIS = "redis"
    HTTP = "http"
    INTERNAL = "internal"


@dataclass
class TenantQuota:
    tenant_id: str
    qps: int = 100
    concurrency: int = 50
    monthly: int = 1_000_000
    tier: str = "free"
    updated_at: float = 0.0
    updated_by: str = ""
    source: str = "internal"
    version: int = 0

    def to_dict(self) -> dict:
        return self.__dict__.copy()

    @classmethod
    def from_dict(cls, d: dict) -> "TenantQuota":
        return cls(**d)


@dataclass
class QuotaChangeRecord:
    tenant_id: str
    field_name: str
    old_value: object
    new_value: object
    source: str
    actor: str
    ts: float


# 哨兵: 表示字段未在调用中显式传入
_UNSET: Any = object()


class TenantQuotaWatcher:
    """租户配额动态生效器."""

    def __init__(self, audit_log_path: str = ""):
        self._lock = threading.Lock()
        self._quotas: dict[str, TenantQuota] = {}
        self._audit: deque[QuotaChangeRecord] = deque(maxlen=1000)
        self._callbacks: dict[str, list[Callable[[QuotaChangeRecord], None]]] = {}
        self._audit_log_path = audit_log_path
        self._drift_warnings = 0

    def upsert(
        self,
        tenant_id: str,
        qps: Any = _UNSET,
        concurrency: Any = _UNSET,
        monthly: Any = _UNSET,
        tier: Any = _UNSET,
        source: str = "internal",
        actor: str = "system",
    ) -> list[QuotaChangeRecord]:
        changes: list[QuotaChangeRecord] = []
        with self._lock:
            old = self._quotas.get(tenant_id)
            if old is None:
                old = TenantQuota(tenant_id=tenant_id, updated_at=time.time())
                self._quotas[tenant_id] = old
            new = TenantQuota(
                tenant_id=tenant_id,
                qps=qps if qps is not _UNSET else old.qps,
                concurrency=concurrency if concurrency is not _UNSET else old.concurrency,
                monthly=monthly if monthly is not _UNSET else old.monthly,
                tier=tier if tier is not _UNSET else old.tier,
                updated_at=time.time(),
                updated_by=actor,
                source=source,
                version=old.version + 1,
            )
            self._quotas[tenant_id] = new
            # 对比 (只对显式传入的字段比较)
            for fname, oval, nval, set_flag in [
                ("qps", old.qps, new.qps, qps is not _UNSET),
                ("concurrency", old.concurrency, new.concurrency, concurrency is not _UNSET),
                ("monthly", old.monthly, new.monthly, monthly is not _UNSET),
                ("tier", old.tier, new.tier, tier is not _UNSET),
            ]:
                if set_flag and oval != nval:
                    rec = QuotaChangeRecord(
                        tenant_id=tenant_id,
                        field_name=fname,
                        old_value=oval,
                        new_value=nval,
                        source=source,
                        actor=actor,
                        ts=new.updated_at,
                    )
                    self._audit.append(rec)
                    self._append_audit_file(rec)
                    changes.append(rec)
        # 触发回调 (锁外, 避免回调持锁死锁)
        for rec in changes:
            self._fire_callbacks(tenant_id, rec)
            logger.info(
                "quota_change: tenant=%s %s %s->%s source=%s actor=%s",
                tenant_id,
                rec.field_name,
                rec.old_value,
                rec.new_value,
                source,
                actor,
            )
        return changes

    def _append_audit_file(self, rec: QuotaChangeRecord) -> None:
        if not self._audit_log_path:
            return
        try:
            import json

            with open(self._audit_log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec.__dict__, ensure_ascii=False) + "\n")
        except OSError as e:
            logger.warning("quota audit append failed: %s", e)

    def get(self, tenant_id: str) -> TenantQuota | None:
        with self._lock:
            q = self._quotas.get(tenant_id)
            return q

    def list_all(self) -> list[TenantQuota]:
        with self._lock:
            return list(self._quotas.values())

    def remove(self, tenant_id: str) -> bool:
        with self._lock:
            return self._quotas.pop(tenant_id, None) is not None

    def on_change(self, tenant_id: str, cb: Callable[[QuotaChangeRecord], None]) -> None:
        with self._lock:
            self._callbacks.setdefault(tenant_id, []).append(cb)

    def _fire_callbacks(self, tenant_id: str, rec: QuotaChangeRecord) -> None:
        with self._lock:
            cbs = list(self._callbacks.get(tenant_id, []))
        for cb in cbs:
            try:
                cb(rec)
            except Exception as e:
                logger.warning("quota_change callback error: %s", e)

    def get_audit(self, tenant_id: str | None = None, limit: int = 100) -> list[QuotaChangeRecord]:
        with self._lock:
            arr = list(self._audit)
        if tenant_id:
            arr = [a for a in arr if a.tenant_id == tenant_id]
        return arr[-limit:]

    def report_drift(self, tenant_id: str, field_name: str, expected, actual) -> None:
        """实际限流器与配额不一致时调用, 计入漂移统计."""
        with self._lock:
            self._drift_warnings += 1
        logger.warning("quota_drift: tenant=%s %s expected=%s actual=%s", tenant_id, field_name, expected, actual)

    def sync_from(self, watcher: "TenantQuotaWatcher", source: str = "sync", actor: str = "sync") -> int:
        """从其它 watcher 同步配额 (集群场景)."""
        n = 0
        for q in watcher.list_all():
            self.upsert(
                tenant_id=q.tenant_id,
                qps=q.qps,
                concurrency=q.concurrency,
                monthly=q.monthly,
                tier=q.tier,
                source=source,
                actor=actor,
            )
            n += 1
        return n

    def stats(self) -> dict:
        with self._lock:
            return {
                "tenant_count": len(self._quotas),
                "audit_count": len(self._audit),
                "callback_count": sum(len(v) for v in self._callbacks.values()),
                "drift_warnings": self._drift_warnings,
            }

    def clear(self) -> None:
        with self._lock:
            self._quotas.clear()
            self._audit.clear()
            self._callbacks.clear()
            self._drift_warnings = 0


# 全局单例
quota_watcher = TenantQuotaWatcher()
