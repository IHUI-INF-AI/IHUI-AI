"""业务幂等键生成(Bug-126)
提供幂等键生成/冲突检测/TTL过期/租户隔离/快照绑定能力.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class KeyState(StrEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


@dataclass
class KeyRecord:
    key: str
    tenant_id: str
    request_hash: str
    state: KeyState = KeyState.PENDING
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0
    result: Any = None
    error: str | None = None
    attempts: int = 0
    locked_by: str | None = None
    locked_at: float = 0.0
    lock_ttl: float = 30.0
    metadata: dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        return self.expires_at > 0 and time.time() > self.expires_at

    def is_locked(self) -> bool:
        if not self.locked_by:
            return False
        return time.time() - self.locked_at < self.lock_ttl


@dataclass
class ConflictInfo:
    key: str
    reason: str
    existing: KeyRecord


def compute_request_hash(payload: Any) -> str:
    """对业务请求载荷计算稳定哈希,字段顺序无关"""
    if isinstance(payload, str):
        canonical = payload
    else:
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_idempotency_key(
    tenant_id: str,
    business_type: str,
    business_id: str,
    payload: Any = None,
    salt: str = "",
) -> str:
    """构造幂等键: tenant + 业务类型 + 业务ID + payload哈希"""
    parts = [tenant_id or "_", business_type or "_", business_id or "_"]
    if payload is not None:
        parts.append(compute_request_hash(payload))
    if salt:
        parts.append(salt)
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


@dataclass
class IdempotencyConfig:
    default_ttl: float = 86400.0
    lock_ttl: float = 30.0
    max_payload_size: int = 65536
    enable_tenant_isolation: bool = True
    snapshot_check: bool = True


class IdempotencyKeyManager:
    """幂等键管理器
    用法:
        mgr = IdempotencyKeyManager()
        key = mgr.acquire_or_conflict(tenant, "order", "O001", payload, owner="worker-1")
        if isinstance(key, KeyRecord):
            # 拿到锁,执行
            ...
            mgr.complete(key.key, result=...)
        else:
            # ConflictInfo 冲突
            ...
    """

    def __init__(self, config: IdempotencyConfig | None = None) -> None:
        self.config = config or IdempotencyConfig()
        self._store: dict[str, KeyRecord] = {}
        self._lock = threading.RLock()

    def _now(self) -> float:
        return time.time()

    def _purge_expired(self) -> None:
        with self._lock:
            expired = [k for k, r in self._store.items() if r.is_expired()]
            for k in expired:
                rec = self._store.pop(k, None)
                if rec is not None:
                    rec.state = KeyState.EXPIRED

    def get(self, key: str) -> KeyRecord | None:
        with self._lock:
            rec = self._store.get(key)
            if rec is None:
                return None
            if rec.is_expired():
                self._store.pop(key, None)
                rec.state = KeyState.EXPIRED
                return None
            return rec

    def acquire_or_conflict(
        self,
        tenant_id: str,
        business_type: str,
        business_id: str,
        payload: Any = None,
        owner: str = "",
        ttl: float | None = None,
    ):
        """获取幂等键锁,返回 KeyRecord 成功, ConflictInfo 冲突
        冲突条件:
            1. 已存在未过期且不同请求哈希(快照不一致)
            2. 已存在未过期且被他人锁
        """
        if self.config.enable_tenant_isolation and not tenant_id:
            raise ValueError("tenant_id 不能为空")
        if self.config.max_payload_size > 0 and payload is not None:
            raw = json.dumps(payload, ensure_ascii=False, default=str)
            if len(raw.encode("utf-8")) > self.config.max_payload_size:
                raise ValueError("payload 超出最大尺寸限制")
        self._purge_expired()
        request_hash = compute_request_hash(payload) if payload is not None else ""
        key = build_idempotency_key(tenant_id, business_type, business_id, payload)
        with self._lock:
            existing = self._store.get(key)
            if existing is not None and not existing.is_expired():
                if (
                    self.config.snapshot_check
                    and request_hash
                    and existing.request_hash
                    and existing.request_hash != request_hash
                ):
                    return ConflictInfo(key=key, reason="请求快照不一致", existing=existing)
                if existing.is_locked() and existing.locked_by != owner:
                    return ConflictInfo(key=key, reason=f"被 {existing.locked_by} 锁定中", existing=existing)
                # 续约同一owner
                existing.locked_by = owner or existing.locked_by
                existing.locked_at = self._now()
                existing.attempts += 1
                return existing
            rec = KeyRecord(
                key=key,
                tenant_id=tenant_id,
                request_hash=request_hash,
                expires_at=self._now() + (ttl or self.config.default_ttl),
                locked_by=owner or None,
                locked_at=self._now() if owner else 0.0,
                lock_ttl=self.config.lock_ttl,
                attempts=1,
            )
            self._store[key] = rec
            return rec

    def complete(self, key: str, result: Any = None, metadata: dict[str, Any] | None = None) -> bool:
        with self._lock:
            rec = self._store.get(key)
            if rec is None:
                return False
            rec.state = KeyState.COMPLETED
            rec.result = result
            rec.locked_by = None
            rec.locked_at = 0.0
            if metadata:
                rec.metadata.update(metadata)
            return True

    def fail(self, key: str, error: str, release_lock: bool = True) -> bool:
        with self._lock:
            rec = self._store.get(key)
            if rec is None:
                return False
            rec.error = error
            if release_lock:
                rec.locked_by = None
                rec.locked_at = 0.0
            return True

    def release_lock(self, key: str) -> bool:
        with self._lock:
            rec = self._store.get(key)
            if rec is None:
                return False
            rec.locked_by = None
            rec.locked_at = 0.0
            return True

    def force_expire(self, key: str) -> bool:
        with self._lock:
            rec = self._store.pop(key, None)
            if rec is None:
                return False
            rec.state = KeyState.EXPIRED
            return True

    def list_by_tenant(self, tenant_id: str) -> list[KeyRecord]:
        with self._lock:
            return [r for r in self._store.values() if r.tenant_id == tenant_id and not r.is_expired()]

    def list_by_state(self, state: KeyState) -> list[KeyRecord]:
        with self._lock:
            return [r for r in self._store.values() if r.state == state and not r.is_expired()]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {
                "total": len(self._store),
                "pending": sum(1 for r in self._store.values() if r.state == KeyState.PENDING),
                "completed": sum(1 for r in self._store.values() if r.state == KeyState.COMPLETED),
                "failed": sum(1 for r in self._store.values() if r.state == KeyState.FAILED),
                "locked": sum(1 for r in self._store.values() if r.is_locked()),
            }
