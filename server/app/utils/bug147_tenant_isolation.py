"""Bug-147: 多租户数据隔离泄漏.
设计:
  - 租户上下文 (tenant context) 强制注入
  - SQL 生成器: 自动追加 tenant_id 过滤
  - 行级校验: 返回前再校验
  - 白名单: 系统级查询不绑定租户
  - 异常: 跨租户访问直接拒绝
"""

from __future__ import annotations

import hashlib
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class IsolationMode(StrEnum):
    SHARED_SCHEMA = "SHARED_SCHEMA"  # 共享表 + tenant_id 列
    SCHEMA_PER_TENANT = "SCHEMA_PER_TENANT"  # 每租户 schema
    DB_PER_TENANT = "DB_PER_TENANT"  # 每租户独立库


class IsolationError(Exception):
    pass


@dataclass
class TenantContext:
    tenant_id: str
    user_id: str = ""
    roles: set[str] = field(default_factory=set)
    is_system: bool = False

    def can_cross(self, target_tenant: str) -> bool:
        return self.is_system or self.tenant_id == target_tenant


@dataclass
class TenantRecord:
    """带租户标记的记录."""

    tenant_id: str
    data: dict[str, Any] = field(default_factory=dict)
    record_id: str = ""


@dataclass
class TenantConfig:
    mode: IsolationMode = IsolationMode.SHARED_SCHEMA
    tenant_column: str = "tenant_id"
    enforce_on_query: bool = True
    enforce_on_write: bool = True
    enforce_on_read: bool = True
    system_tenants: set[str] = field(default_factory=lambda: {"_system_", "_admin_"})


_TLS = threading.local()


def current_tenant() -> TenantContext | None:
    return getattr(_TLS, "ctx", None)


def set_current_tenant(ctx: TenantContext | None) -> None:
    if ctx is None:
        if hasattr(_TLS, "ctx"):
            delattr(_TLS, "ctx")
    else:
        _TLS.ctx = ctx


@contextmanager
def tenant_scope(ctx: TenantContext) -> Iterator[TenantContext]:
    prev = current_tenant()
    set_current_tenant(ctx)
    try:
        yield ctx
    finally:
        set_current_tenant(prev)


def require_tenant() -> TenantContext:
    ctx = current_tenant()
    if ctx is None:
        raise IsolationError("缺少租户上下文")
    return ctx


class TenantGuard:
    """多租户隔离防护器."""

    def __init__(self, config: TenantConfig | None = None) -> None:
        self.config = config or TenantConfig()
        self._lock = threading.RLock()
        self._tables: set[str] = set()
        self._records: list[TenantRecord] = []
        self._stats = {"queries": 0, "writes": 0, "reads": 0, "cross_tenant_blocked": 0, "missing_context": 0}

    def register_table(self, table: str) -> None:
        with self._lock:
            self._tables.add(table)

    def _validate_ctx(self) -> TenantContext:
        ctx = current_tenant()
        if ctx is None:
            with self._lock:
                self._stats["missing_context"] += 1
            raise IsolationError("缺少租户上下文")
        return ctx

    def check_cross_tenant(self, target_tenant: str) -> bool:
        """返回 True 表示允许, False 表示禁止."""
        ctx = self._validate_ctx()
        if ctx.can_cross(target_tenant):
            return True
        with self._lock:
            self._stats["cross_tenant_blocked"] += 1
        return False

    def build_where(self, table: str, conditions: dict[str, Any] | None = None) -> dict[str, Any]:
        """构造查询条件, 自动注入 tenant_id."""
        with self._lock:
            self._stats["queries"] += 1
        ctx = self._validate_ctx()
        if self.config.enforce_on_query and table in self._tables and not ctx.is_system:
            conds = dict(conditions or {})
            conds[self.config.tenant_column] = ctx.tenant_id
            return conds
        return dict(conditions or {})

    def write(self, table: str, data: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self._stats["writes"] += 1
        ctx = self._validate_ctx()
        if self.config.enforce_on_write and table in self._tables and not ctx.is_system:
            data = dict(data)
            existing_tid = data.get(self.config.tenant_column)
            if existing_tid and existing_tid != ctx.tenant_id and not ctx.can_cross(existing_tid):
                self._stats["cross_tenant_blocked"] += 1
                raise IsolationError(f"禁止跨租户写入 {table}: {existing_tid} != {ctx.tenant_id}")
            data[self.config.tenant_column] = ctx.tenant_id
        rec = TenantRecord(
            tenant_id=data.get(self.config.tenant_column, ctx.tenant_id),
            data=data,
            record_id=hashlib.md5(f"{table}:{time.time_ns()}:{len(self._records)}".encode()).hexdigest()[:12],
        )
        with self._lock:
            self._records.append(rec)
        return data

    def read_filter(self, table: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        with self._lock:
            self._stats["reads"] += 1
        ctx = self._validate_ctx()
        if not self.config.enforce_on_read or table not in self._tables or ctx.is_system:
            return list(records)
        col = self.config.tenant_column
        result = []
        for r in records:
            t = r.get(col)
            if t == ctx.tenant_id:
                result.append(r)
            else:
                self._stats["cross_tenant_blocked"] += 1
        return result

    def assert_same_tenant(self, *records: dict[str, Any]) -> bool:
        ctx = self._validate_ctx()
        col = self.config.tenant_column
        for r in records:
            t = r.get(col)
            if t and t != ctx.tenant_id and not ctx.can_cross(t):
                raise IsolationError(f"记录租户 {t} 与上下文 {ctx.tenant_id} 不一致")
        return True

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {**self._stats, "tables": len(self._tables), "records": len(self._records)}
