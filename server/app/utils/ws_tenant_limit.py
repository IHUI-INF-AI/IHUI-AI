"""Bug-82: WebSocket 连接数限流 (按租户).

设计:
  - 限制每个 tenant (or user) 最大同时 WS 连接数, 防止单租户挤占
  - 全局最大连接数保护
  - 连接时 acquire, 断开时 release
  - 提供 IP 维度限流
  - 拒绝时返回 429 + Retry-After

使用:
    from app.utils.ws_tenant_limit import ws_conn_limiter

    if not ws_conn_limiter.acquire(tenant_id="t1", client_ip="1.2.3.4"):
        await ws.close(code=1013, reason="too many connections")
    try:
        await listen()
    finally:
        ws_conn_limiter.release(tenant_id="t1", client_ip="1.2.3.4")
"""

import logging
import threading
from dataclasses import dataclass

logger = logging.getLogger(__name__)

DEFAULT_MAX_PER_TENANT = 100
DEFAULT_MAX_PER_USER = 5
DEFAULT_MAX_PER_IP = 20
DEFAULT_MAX_GLOBAL = 5000
DEFAULT_REJECT_TTL = 60  # 拒绝某 IP 的冷却秒数


@dataclass
class ConnectionStats:
    total_acquire: int = 0
    total_released: int = 0
    total_rejected: int = 0
    reject_by_tenant: int = 0
    reject_by_user: int = 0
    reject_by_ip: int = 0
    reject_by_global: int = 0
    current_total: int = 0
    peak_total: int = 0

    def to_dict(self) -> dict:
        return {
            "total_acquire": self.total_acquire,
            "total_released": self.total_released,
            "total_rejected": self.total_rejected,
            "reject_by_tenant": self.reject_by_tenant,
            "reject_by_user": self.reject_by_user,
            "reject_by_ip": self.reject_by_ip,
            "reject_by_global": self.reject_by_global,
            "current_total": self.current_total,
            "peak_total": self.peak_total,
        }


class WsConnLimiter:
    """WS 多维度并发限流."""

    def __init__(
        self,
        max_per_tenant: int = DEFAULT_MAX_PER_TENANT,
        max_per_user: int = DEFAULT_MAX_PER_USER,
        max_per_ip: int = DEFAULT_MAX_PER_IP,
        max_global: int = DEFAULT_MAX_GLOBAL,
    ):
        self._tenants: dict[str, int] = {}
        self._users: dict[str, int] = {}
        self._ips: dict[str, int] = {}
        self._lock = threading.Lock()
        self._max_tenant = max_per_tenant
        self._max_user = max_per_user
        self._max_ip = max_per_ip
        self._max_global = max_global
        self._stats = ConnectionStats()
        self._tenant_peaks: dict[str, int] = {}

    def set_limits(
        self,
        max_per_tenant: int | None = None,
        max_per_user: int | None = None,
        max_per_ip: int | None = None,
        max_global: int | None = None,
    ) -> None:
        with self._lock:
            if max_per_tenant is not None:
                self._max_tenant = max_per_tenant
            if max_per_user is not None:
                self._max_user = max_per_user
            if max_per_ip is not None:
                self._max_ip = max_per_ip
            if max_global is not None:
                self._max_global = max_global
            # 重新配置时清空运行时状态, 避免旧连接污染新 limit 校验
            self._tenants.clear()
            self._users.clear()
            self._ips.clear()
            self._stats.current_total = 0
            self._tenant_peaks.clear()

    def acquire(
        self,
        tenant_id: str | None = None,
        user_id: str | None = None,
        client_ip: str | None = None,
    ) -> bool:
        """尝试建立连接, 成功返回 True, 失败返回 False."""
        tid = str(tenant_id) if tenant_id else ""
        uid = str(user_id) if user_id else ""
        ip = str(client_ip) if client_ip else ""

        with self._lock:
            # 全局
            if self._stats.current_total >= self._max_global:
                self._stats.total_rejected += 1
                self._stats.reject_by_global += 1
                return False
            # tenant
            if tid and self._tenants.get(tid, 0) >= self._max_tenant:
                self._stats.total_rejected += 1
                self._stats.reject_by_tenant += 1
                return False
            # user
            if uid and self._users.get(uid, 0) >= self._max_user:
                self._stats.total_rejected += 1
                self._stats.reject_by_user += 1
                return False
            # ip
            if ip and self._ips.get(ip, 0) >= self._max_ip:
                self._stats.total_rejected += 1
                self._stats.reject_by_ip += 1
                return False
            # 通过
            if tid:
                self._tenants[tid] = self._tenants.get(tid, 0) + 1
                peak = self._tenant_peaks.get(tid, 0)
                if self._tenants[tid] > peak:
                    self._tenant_peaks[tid] = self._tenants[tid]
            if uid:
                self._users[uid] = self._users.get(uid, 0) + 1
            if ip:
                self._ips[ip] = self._ips.get(ip, 0) + 1
            self._stats.total_acquire += 1
            self._stats.current_total += 1
            if self._stats.current_total > self._stats.peak_total:
                self._stats.peak_total = self._stats.current_total
        return True

    def release(
        self,
        tenant_id: str | None = None,
        user_id: str | None = None,
        client_ip: str | None = None,
    ) -> None:
        tid = str(tenant_id) if tenant_id else ""
        uid = str(user_id) if user_id else ""
        ip = str(client_ip) if client_ip else ""
        with self._lock:
            if tid and self._tenants.get(tid, 0) > 0:
                self._tenants[tid] -= 1
                if self._tenants[tid] == 0:
                    self._tenants.pop(tid, None)
            if uid and self._users.get(uid, 0) > 0:
                self._users[uid] -= 1
                if self._users[uid] == 0:
                    self._users.pop(uid, None)
            if ip and self._ips.get(ip, 0) > 0:
                self._ips[ip] -= 1
                if self._ips[ip] == 0:
                    self._ips.pop(ip, None)
            if self._stats.current_total > 0:
                self._stats.current_total -= 1
            self._stats.total_released += 1

    def current(self) -> dict:
        with self._lock:
            return {
                "tenants": dict(self._tenants),
                "users": dict(self._users),
                "ips": dict(self._ips),
                "tenant_count": len(self._tenants),
                "total": self._stats.current_total,
            }

    def get_tenant_peak(self, tenant_id: str) -> int:
        with self._lock:
            return self._tenant_peaks.get(str(tenant_id), 0)

    def stats(self) -> dict:
        with self._lock:
            return {
                "limits": {
                    "max_per_tenant": self._max_tenant,
                    "max_per_user": self._max_user,
                    "max_per_ip": self._max_ip,
                    "max_global": self._max_global,
                },
                **self._stats.to_dict(),
                "tenant_count": len(self._tenants),
            }


# 全局单例
ws_conn_limiter = WsConnLimiter()
