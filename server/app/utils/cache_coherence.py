"""Bug-95: 多级缓存一致性 (L1 in-mem + L2 Redis + 失效广播).

设计:
  - L1: 进程内 LRU 缓存 (ThreadSafe)
  - L2: 远程 (Redis, 可选) - 这里用 callback 抽象
  - 失效广播: 本地订阅, 收到失效消息清 L1
  - 防脏读: write-through (L1 与 L2 同时写)
  - 防雪崩: TTL 抖动 (random ±10%)

使用:
    from app.utils.cache_coherence import l1_cache, register_l2

    def my_l2_get(key): return redis.get(key)
    def my_l2_set(key, val, ttl): redis.setex(key, ttl, val)
    def my_l2_delete(key): redis.delete(key)
    register_l2(my_l2_get, my_l2_set, my_l2_delete)
"""

import logging
import random
import threading
import time
from collections import OrderedDict, defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_L1_MAX = 5000
DEFAULT_TTL_JITTER = 0.1  # ±10%


@dataclass
class CacheEntry:
    key: str
    value: Any
    expires_at: float
    inserted_at: float = field(default_factory=time.time)
    hits: int = 0


class LRUCache:
    """线程安全 LRU."""

    def __init__(self, max_size: int = DEFAULT_L1_MAX):
        self._max = max_size
        self._data: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> CacheEntry | None:
        with self._lock:
            e = self._data.get(key)
            if e is None:
                return None
            if e.expires_at < time.time():
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            e.hits += 1
            return e

    def set(self, key: str, value: Any, ttl: float) -> None:
        with self._lock:
            if key in self._data:
                self._data.pop(key, None)
            self._data[key] = CacheEntry(key=key, value=value, expires_at=time.time() + ttl)
            self._data.move_to_end(key)
            while len(self._data) > self._max:
                self._data.popitem(last=False)

    def delete(self, key: str) -> None:
        with self._lock:
            self._data.pop(key, None)

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict:
        with self._lock:
            return {"size": len(self._data), "max": self._max}


def _jitter(ttl: float, ratio: float = DEFAULT_TTL_JITTER) -> float:
    return ttl * (1.0 + random.uniform(-ratio, ratio))


class CacheCoherence:
    """多级缓存一致性协调器."""

    def __init__(self):
        self._lock = threading.RLock()
        self._l1 = LRUCache()
        self._l2_get: Callable[[str], Any] | None = None
        self._l2_set: Callable[[str, Any, float], None] | None = None
        self._l2_del: Callable[[str], None] | None = None
        # 失效广播 channel 订阅
        self._local_subs: dict[str, list[Callable[[str], None]]] = defaultdict(list)
        self._invalidation_topics: dict[str, str] = {}  # key -> topic
        self._total_get = 0
        self._total_l1_hit = 0
        self._total_l2_hit = 0
        self._total_miss = 0
        self._total_set = 0
        self._total_invalidate = 0
        self._total_invalidate_received = 0

    def configure_l1(self, max_size: int) -> None:
        with self._lock:
            self._l1 = LRUCache(max_size=max_size)

    def register_l2(self, get_fn=None, set_fn=None, del_fn=None) -> None:
        """注册 L2 (Redis) 后端."""
        with self._lock:
            if get_fn is not None:
                self._l2_get = get_fn
            if set_fn is not None:
                self._l2_set = set_fn
            if del_fn is not None:
                self._l2_del = del_fn

    def bind_invalidation_topic(self, key: str, topic: str) -> None:
        """把 key 关联到失效广播 topic."""
        with self._lock:
            self._invalidation_topics[key] = topic

    def subscribe_invalidation(self, topic: str, cb: Callable[[str], None]) -> None:
        """订阅失效广播."""
        with self._lock:
            self._local_subs[topic].append(cb)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            self._total_get += 1
        # L1
        e = self._l1.get(key)
        if e is not None:
            with self._lock:
                self._total_l1_hit += 1
            return e.value
        # L2
        with self._lock:
            get_fn = self._l2_get
        if get_fn is not None:
            try:
                v = get_fn(key)
                if v is not None:
                    with self._lock:
                        self._total_l2_hit += 1
                    # 回填 L1 (短 TTL)
                    self._l1.set(key, v, ttl=_jitter(30.0))
                    return v
            except Exception as e:
                logger.debug(f"l2 get fail: {e!r}")
        with self._lock:
            self._total_miss += 1
        return default

    def set(self, key: str, value: Any, ttl: float = 60.0, write_through: bool = True) -> None:
        actual_ttl = _jitter(ttl)
        self._l1.set(key, value, ttl=actual_ttl)
        with self._lock:
            self._total_set += 1
            set_fn = self._l2_set
        if write_through and set_fn is not None:
            try:
                set_fn(key, value, actual_ttl)
            except Exception as e:
                logger.debug(f"l2 set fail: {e!r}")

    def invalidate(self, key: str, broadcast: bool = True) -> None:
        """失效 L1 + L2, 可选广播."""
        self._l1.delete(key)
        with self._lock:
            self._total_invalidate += 1
            del_fn = self._l2_del
            topic = self._invalidation_topics.get(key)
        if del_fn is not None:
            try:
                del_fn(key)
            except Exception as e:
                logger.debug(f"l2 del fail: {e!r}")
        if broadcast and topic is not None:
            self._broadcast_invalidation(topic, key)

    def _broadcast_invalidation(self, topic: str, key: str) -> None:
        with self._lock:
            subs = list(self._local_subs.get(topic, []))
        for cb in subs:
            try:
                cb(key)
            except Exception as e:
                logger.warning(f"invalidate cb fail: {e!r}")

    def receive_invalidation(self, topic: str, key: str) -> None:
        """从外部收到失效广播. 清 L1."""
        self._l1.delete(key)
        with self._lock:
            self._total_invalidate_received += 1

    def get_l1(self, key: str) -> Any:
        e = self._l1.get(key)
        return e.value if e else None

    def stats(self) -> dict:
        with self._lock:
            total = self._total_get
            return {
                "l1": self._l1.stats(),
                "total_get": total,
                "l1_hit": self._total_l1_hit,
                "l2_hit": self._total_l2_hit,
                "miss": self._total_miss,
                "hit_rate": round((self._total_l1_hit + self._total_l2_hit) / total, 4) if total else 0.0,
                "total_set": self._total_set,
                "total_invalidate": self._total_invalidate,
                "received_invalidate": self._total_invalidate_received,
                "subs_topics": len(self._local_subs),
            }


# 全局单例
cache_coherence = CacheCoherence()
