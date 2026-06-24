"""Canary 切流 controller (建议 123) - app/canary.py.

设计:
  - v1 (旧) : v2 (新) = 9 : 1 配比
  - 切流维度: 租户级 (按 tenant_id 加权)
  - 加权策略: 4 种
      - hash  (默认, 同一 tenant 永远走同一边)
      - random (每次随机)
      - sticky_tenant (按租户粘性, 一致性哈希)
      - round_robin (轮询, 仅单租户用)
  - 切流开关: ZHS_CANARY_ENABLED (默认 0)
  - 切流比例: ZHS_CANARY_V2_RATIO (默认 0.1, 即 10%)
  - 紧急回滚: ZHS_CANARY_ROLLBACK=true → 100% 走 v1
  - 命中记录: canary_metrics 上报
  - 白名单: ZHS_CANARY_V2_TENANTS (逗号分隔) → 这些 tenant 强制走 v2
  - 黑名单: ZHS_CANARY_V1_TENANTS (逗号分隔) → 这些 tenant 强制走 v1 (不出 canary)

用法:
    from app.canary import get_default_canary, choose_version

    canary = get_default_canary()
    version = choose_version(tenant_id=1, endpoint="GET /api/v1/orders")
    if version == "v2":
        # 走新代码
    else:
        # 走旧代码
"""

from __future__ import annotations

import contextlib
import hashlib
import os
import random
import threading
import time
from enum import StrEnum


class CanaryVersion(StrEnum):
    V1 = "v1"
    V2 = "v2"


class CanaryStrategy(StrEnum):
    HASH = "hash"
    RANDOM = "random"
    STICKY_TENANT = "sticky_tenant"
    ROUND_ROBIN = "round_robin"


# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------


def _enabled() -> bool:
    try:
        from app.config import settings

        if getattr(settings, "ZHS_CANARY_ENABLED", None) is not None:
            return bool(settings.ZHS_CANARY_ENABLED)
    except Exception:
        pass
    return os.getenv("ZHS_CANARY_ENABLED", "0") == "1"


def _v2_ratio() -> float:
    try:
        from app.config import settings

        if getattr(settings, "ZHS_CANARY_V2_RATIO", None) is not None:
            return float(settings.ZHS_CANARY_V2_RATIO)
    except Exception:
        pass
    try:
        return float(os.getenv("ZHS_CANARY_V2_RATIO", "0.1"))
    except Exception:
        return 0.1


def _rollback() -> bool:
    return os.getenv("ZHS_CANARY_ROLLBACK", "0") == "1"


def _strategy() -> CanaryStrategy:
    s = os.getenv("ZHS_CANARY_STRATEGY", "hash").lower().strip()
    try:
        return CanaryStrategy(s)
    except ValueError:
        return CanaryStrategy.HASH


def _parse_tids(name: str) -> set[int]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return set()
    out = set()
    for x in raw.split(","):
        with contextlib.suppress(ValueError, TypeError):
            out.add(int(x.strip()))
    return out


# ---------------------------------------------------------------------------
# Canary Controller
# ---------------------------------------------------------------------------


class CanaryController:
    """Canary 切流控制器.

    Args:
        v2_ratio: v2 流量比例 (0.0 - 1.0)
        enabled: 是否启用
        strategy: 切流策略
        v2_tenants: 强制走 v2 的 tenant 集合
        v1_tenants: 强制走 v1 的 tenant 集合
    """

    def __init__(
        self,
        v2_ratio: float | None = None,
        enabled: bool | None = None,
        strategy: CanaryStrategy | None = None,
        v2_tenants: set[int] | None = None,
        v1_tenants: set[int] | None = None,
        rollback: bool | None = None,
    ):
        self._v2_ratio = v2_ratio if v2_ratio is not None else _v2_ratio()
        self._enabled = enabled if enabled is not None else _enabled()
        # 接受 str 或 CanaryStrategy
        _st = strategy if strategy is not None else _strategy()
        self._strategy = _st if isinstance(_st, CanaryStrategy) else CanaryStrategy(_st)
        self._v2_tenants = v2_tenants if v2_tenants is not None else _parse_tids("ZHS_CANARY_V2_TENANTS")
        self._v1_tenants = v1_tenants if v1_tenants is not None else _parse_tids("ZHS_CANARY_V1_TENANTS")
        self._rollback = rollback if rollback is not None else _rollback()
        self._lock = threading.RLock()
        # round_robin 计数
        self._rr_counter = 0
        # 历史 (排障)
        self._decisions: list[dict] = []
        self._max_history = 200

    # ---------- 属性 ----------
    @property
    def enabled(self) -> bool:
        with self._lock:
            return self._enabled and not self._rollback

    @property
    def v2_ratio(self) -> float:
        with self._lock:
            return self._v2_ratio

    @property
    def strategy(self) -> CanaryStrategy:
        with self._lock:
            return self._strategy

    @property
    def rollback(self) -> bool:
        with self._lock:
            return self._rollback

    @property
    def v2_tenants(self) -> set[int]:
        with self._lock:
            return set(self._v2_tenants)

    @property
    def v1_tenants(self) -> set[int]:
        with self._lock:
            return set(self._v1_tenants)

    # ---------- 配置变更 ----------
    def set_enabled(self, enabled: bool) -> None:
        with self._lock:
            self._enabled = bool(enabled)

    def set_v2_ratio(self, ratio: float) -> None:
        ratio = max(0.0, min(1.0, float(ratio)))
        with self._lock:
            self._v2_ratio = ratio
            self._record("set_v2_ratio", old=None, new=ratio, tenant_id=None, endpoint=None, version=None)

    def set_rollback(self, rollback: bool) -> None:
        with self._lock:
            self._rollback = bool(rollback)
            self._record("set_rollback", old=None, new=rollback, tenant_id=None, endpoint=None, version=None)

    def set_strategy(self, strategy: CanaryStrategy) -> None:
        with self._lock:
            self._strategy = strategy if isinstance(strategy, CanaryStrategy) else CanaryStrategy(strategy)

    def add_v2_tenant(self, tenant_id: int) -> None:
        with self._lock:
            self._v2_tenants.add(int(tenant_id))

    def add_v1_tenant(self, tenant_id: int) -> None:
        with self._lock:
            self._v1_tenants.add(int(tenant_id))

    def remove_v2_tenant(self, tenant_id: int) -> None:
        with self._lock:
            self._v2_tenants.discard(int(tenant_id))

    def remove_v1_tenant(self, tenant_id: int) -> None:
        with self._lock:
            self._v1_tenants.discard(int(tenant_id))

    # ---------- 切流判定 ----------
    def choose_version(self, tenant_id: int | None = None, endpoint: str | None = None) -> CanaryVersion:
        """决定本次请求走 v1 还是 v2.

        优先级:
          1. 全局关闭 / rollback → v1
          2. 租户白名单 (v2_tenants) → v2
          3. 租户黑名单 (v1_tenants) → v1
          4. 按 strategy 决定
        """
        try:
            tid = int(tenant_id) if tenant_id is not None else 1
        except (ValueError, TypeError):
            tid = 1

        with self._lock:
            enabled = self._enabled
            rollback = self._rollback
            v2_ratio = self._v2_ratio
            strategy = self._strategy
            v2_tenants = self._v2_tenants
            v1_tenants = self._v1_tenants

        # 1) 全局关闭
        if not enabled or rollback:
            v = CanaryVersion.V1
            self._record("decide", old=None, new=None, tenant_id=tid, endpoint=endpoint, version=v)
            return v

        # 2) v2 白名单
        if tid in v2_tenants:
            v = CanaryVersion.V2
            self._record("decide", old=None, new=None, tenant_id=tid, endpoint=endpoint, version=v)
            return v

        # 3) v1 黑名单
        if tid in v1_tenants:
            v = CanaryVersion.V1
            self._record("decide", old=None, new=None, tenant_id=tid, endpoint=endpoint, version=v)
            return v

        # 4) 按 strategy
        if strategy == CanaryStrategy.HASH:
            v = self._hash_decision(tid, v2_ratio)
        elif strategy == CanaryStrategy.RANDOM:
            v = self._random_decision(v2_ratio)
        elif strategy == CanaryStrategy.STICKY_TENANT:
            # 当前实现等同 HASH, 一致性哈希环待实现
            v = self._hash_decision(tid, v2_ratio)  # 同 hash
        elif strategy == CanaryStrategy.ROUND_ROBIN:
            v = self._rr_decision(v2_ratio)
        else:
            v = CanaryVersion.V1

        self._record("decide", old=None, new=None, tenant_id=tid, endpoint=endpoint, version=v)
        return v

    def _hash_decision(self, tenant_id: int, v2_ratio: float) -> CanaryVersion:
        """一致性 hash: 同一 tenant_id 永远走同一边."""
        h = hashlib.md5(str(tenant_id).encode("utf-8")).hexdigest()
        # 取前 8 位 hex 解析为 [0, 1) 浮点
        bucket = int(h[:8], 16) / 0xFFFFFFFF
        return CanaryVersion.V2 if bucket < v2_ratio else CanaryVersion.V1

    def _random_decision(self, v2_ratio: float) -> CanaryVersion:
        """纯随机."""
        return CanaryVersion.V2 if random.random() < v2_ratio else CanaryVersion.V1

    def _rr_decision(self, v2_ratio: float) -> CanaryVersion:
        """轮询: 累计访问数, 按比例分配."""
        with self._lock:
            self._rr_counter += 1
            n = self._rr_counter
        # 累计到一定次数, 用比例做"每 10 次分配"
        if v2_ratio <= 0:
            return CanaryVersion.V1
        if v2_ratio >= 1:
            return CanaryVersion.V2
        # 找最近的 1/ratio 整数, 累计到此值切 v2
        n_per_cycle = max(1, round(1.0 / v2_ratio))
        return CanaryVersion.V2 if (n % n_per_cycle == 0) else CanaryVersion.V1

    # ---------- 内部 ----------
    def _record(
        self,
        action: str,
        old: object,
        new: object,
        tenant_id: int | None,
        endpoint: str | None,
        version: CanaryVersion | None,
    ) -> None:
        with self._lock:
            self._decisions.append(
                {
                    "ts": time.time(),
                    "action": action,
                    "old": old,
                    "new": new,
                    "tenant_id": tenant_id,
                    "endpoint": endpoint,
                    "version": version.value if isinstance(version, CanaryVersion) else version,
                }
            )
            if len(self._decisions) > self._max_history:
                self._decisions = self._decisions[-self._max_history :]

    # ---------- 快照 ----------
    def snapshot(self) -> dict:
        with self._lock:
            # 统计 v1 / v2 命中
            v1 = 0
            v2 = 0
            for d in self._decisions:
                if d["action"] != "decide":
                    continue
                ver = d["version"]
                if isinstance(ver, CanaryVersion):
                    ver = ver.value
                if ver == "v1":
                    v1 += 1
                elif ver == "v2":
                    v2 += 1
            total = v1 + v2
            return {
                "enabled": self._enabled,
                "rollback": self._rollback,
                "v2_ratio": self._v2_ratio,
                "strategy": self._strategy.value,
                "v2_tenants": sorted(self._v2_tenants),
                "v1_tenants": sorted(self._v1_tenants),
                "rr_counter": self._rr_counter,
                "decisions": {
                    "total": total,
                    "v1": v1,
                    "v2": v2,
                    "v2_actual_ratio": v2 / total if total > 0 else 0.0,
                },
                "history_sample": self._decisions[-10:],
            }

    def clear_history(self) -> None:
        with self._lock:
            self._decisions.clear()
            self._rr_counter = 0


# ---------------------------------------------------------------------------
# 全局默认
# ---------------------------------------------------------------------------

_DEFAULT_CANARY: CanaryController | None = None
_DEFAULT_LOCK = threading.Lock()


def get_default_canary() -> CanaryController:
    global _DEFAULT_CANARY
    with _DEFAULT_LOCK:
        if _DEFAULT_CANARY is None:
            _DEFAULT_CANARY = CanaryController()
        return _DEFAULT_CANARY


def reset_default_canary() -> None:
    global _DEFAULT_CANARY
    with _DEFAULT_LOCK:
        _DEFAULT_CANARY = None


def choose_version(tenant_id: int | None = None, endpoint: str | None = None) -> CanaryVersion:
    """便捷函数: 走默认 canary controller."""
    return get_default_canary().choose_version(tenant_id, endpoint)
