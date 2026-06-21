"""Bug-71: 灰度发布用户分桶.

功能:
  - 按 user_uuid (或 IP) 哈希到桶 (0-99)
  - 配置灰度规则: 版本 + 允许桶范围 (0-19 旧版, 20-99 新版)
  - 跨实例一致 (纯哈希, 无状态)
  - 支持多层叠加 (实验 A/B, 实验 B/C 同时跑)
  - 命中决策记录: get_bucket_assignment_log

使用:
    from app.utils.gradual_rollout import rollout

    rollout.add_experiment(
        "new_payment", version="v2",
        buckets=range(20, 100),  # 20% -> 80% 用户用 v2
    )

    if rollout.is_in_version("new_payment", user_uuid) == "v2":
        new_payment_flow()
    else:
        legacy_payment_flow()
"""

import hashlib
import logging
import threading
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

BUCKET_COUNT = 100
DEFAULT_VERSION = "v1"


@dataclass
class Experiment:
    name: str
    version: str
    buckets: set[int] = field(default_factory=set)
    enabled: bool = True
    created_at: float = field(default_factory=time.time)
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "version": self.version,
            "buckets": sorted(self.buckets),
            "enabled": self.enabled,
            "created_at": self.created_at,
            "description": self.description,
        }


class GradualRollout:
    """灰度发布控制器."""

    def __init__(self):
        self._experiments: dict[str, Experiment] = {}
        self._lock = threading.Lock()
        # 命中记录: 内存里只留最近 N 条
        self._hits: list[dict] = []
        self._hits_max = 1000

    def _bucket_of(self, key: str, exp_name: str) -> int:
        """稳定哈希: 同一 key 在同一实验下永远同一 bucket."""
        h = hashlib.sha256(f"{exp_name}:{key}".encode()).hexdigest()
        return int(h[:8], 16) % BUCKET_COUNT

    def add_experiment(
        self,
        name: str,
        version: str,
        buckets,
        description: str = "",
    ) -> None:
        """buckets 可以是 set / list / range."""
        bset = set(buckets) if not isinstance(buckets, set) else buckets
        with self._lock:
            self._experiments[name] = Experiment(
                name=name,
                version=version,
                buckets=bset,
                description=description,
            )

    def update_buckets(self, name: str, buckets) -> bool:
        with self._lock:
            exp = self._experiments.get(name)
            if exp is None:
                return False
            exp.buckets = set(buckets) if not isinstance(buckets, set) else buckets
            return True

    def set_enabled(self, name: str, enabled: bool) -> bool:
        with self._lock:
            exp = self._experiments.get(name)
            if exp is None:
                return False
            exp.enabled = enabled
            return True

    def remove_experiment(self, name: str) -> bool:
        with self._lock:
            return self._experiments.pop(name, None) is not None

    def is_in_version(self, name: str, key: str) -> str:
        """判断 key 是否命中实验新版本, 返回 version 字符串 (默认 DEFAULT_VERSION)."""
        with self._lock:
            exp = self._experiments.get(name)
        if exp is None or not exp.enabled:
            return DEFAULT_VERSION
        bucket = self._bucket_of(key, name)
        hit = bucket in exp.buckets
        self._record_hit(name, key, bucket, exp.version, hit)
        return exp.version if hit else DEFAULT_VERSION

    def in_bucket(self, name: str, key: str) -> int | None:
        """返回 key 命中的桶号 (用于调试)."""
        with self._lock:
            if name not in self._experiments:
                return None
        return self._bucket_of(key, name)

    def _record_hit(self, name: str, key: str, bucket: int, version: str, hit: bool) -> None:
        rec = {
            "ts": time.time(),
            "exp": name,
            "key": key[:32] if isinstance(key, str) else str(key)[:32],
            "bucket": bucket,
            "version": version,
            "hit": hit,
        }
        with self._lock:
            self._hits.append(rec)
            if len(self._hits) > self._hits_max:
                self._hits = self._hits[-self._hits_max :]

    def stats(self) -> dict:
        with self._lock:
            exps = {n: e.to_dict() for n, e in self._experiments.items()}
            recent = list(self._hits[-50:])
        # 命中统计
        per_exp: dict[str, dict] = {}
        for h in self._hits:
            d = per_exp.setdefault(h["exp"], {"total": 0, "hit": 0})
            d["total"] += 1
            if h["hit"]:
                d["hit"] += 1
        for d in per_exp.values():
            d["hit_rate"] = round(d["hit"] / max(1, d["total"]), 4)
        return {
            "experiments": exps,
            "recent_hits": recent,
            "per_exp_stats": per_exp,
        }

    def clear_hits(self) -> None:
        with self._lock:
            self._hits.clear()


# 全局单例
rollout = GradualRollout()


# ---------------------------------------------------------------------------
# 装饰器 / 决策工具
# ---------------------------------------------------------------------------


def versioned_route(name: str):
    """装饰器: 路由内根据实验名自动选择 v1/v2 handler.

    Example:
        @versioned_route("new_payment")
        def payment(request, version):
            if version == "v2":
                return new_payment_handler()
            return legacy_payment_handler()
    """

    def deco(fn):
        import inspect
        from functools import wraps

        if inspect.iscoroutinefunction(fn):

            @wraps(fn)
            async def async_w(*args, **kwargs):
                from app.telemetry import get_request_context

                ctx = get_request_context() or {}
                key = str(ctx.get("user_uuid", "")) or str(ctx.get("client_ip", "anon"))
                v = rollout.is_in_version(name, key)
                if "version" in kwargs:
                    kwargs["version"] = v
                elif args and callable(args[0]):
                    pass
                return await fn(*args, version=v, **kwargs)

            return async_w

        @wraps(fn)
        def sync_w(*args, **kwargs):
            from app.telemetry import get_request_context

            ctx = get_request_context() or {}
            key = str(ctx.get("user_uuid", "")) or str(ctx.get("client_ip", "anon"))
            v = rollout.is_in_version(name, key)
            return fn(*args, version=v, **kwargs)

        return sync_w

    return deco
