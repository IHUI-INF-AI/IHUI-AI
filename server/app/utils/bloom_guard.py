"""Bug-91: 智能缓存穿透保护 (布隆过滤器 + 空值缓存).

设计:
  - 布隆过滤器前置拦截不存在的 key, 防止缓存穿透
  - 空值缓存 (null cache) 短 TTL 防止同一 key 反复穿透
  - 多命名空间: 不同业务用不同 filter
  - 支持位图持久化 (二进制)
  - 误判率可配 (默认 1%)

使用:
    from app.utils.bloom_guard import bloom_guard

    if not bloom_guard.may_contain("users", uid):
        return None  # 一定不存在, 不打 DB
    if bloom_guard.is_null_cached("users", uid):
        return None
    user = db.get(uid)
    if user is None:
        bloom_guard.mark_null("users", uid, ttl=30)
    else:
        bloom_guard.add("users", uid)
"""

import hashlib
import math
import os
import threading
import time
from collections.abc import Iterable

logger = __import__("logging").getLogger(__name__)


class _BitArray:
    """简单位数组, 用 bytearray 存储."""

    __slots__ = ("_buf", "_size")

    def __init__(self, size_bits: int):
        self._size = size_bits
        self._buf = bytearray((size_bits + 7) // 8)

    def set(self, idx: int) -> None:
        self._buf[idx >> 3] |= 1 << (idx & 7)

    def get(self, idx: int) -> bool:
        return bool(self._buf[idx >> 3] & (1 << (idx & 7)))

    @property
    def size(self) -> int:
        return self._size

    def to_bytes(self) -> bytes:
        return bytes(self._buf)

    @classmethod
    def from_bytes(cls, raw: bytes, size_bits: int) -> "_BitArray":
        b = cls(size_bits)
        b._buf = bytearray(raw)
        return b


def _hashes(item: str, k: int, m: int) -> list[int]:
    """用 SHA256 派生 k 个 hash, 模 m 到位数组."""
    h = hashlib.sha256(item.encode("utf-8")).digest()
    out: list[int] = []
    # 每 8 字节取一个 uint64, 派生 k 个
    for i in range(k):
        offset = (i * 8) % (len(h) - 7)
        v = int.from_bytes(h[offset : offset + 8], "big")
        out.append(v % m)
    return out


class BloomFilter:
    """布隆过滤器 (固定大小)."""

    def __init__(self, capacity: int = 100_000, fpr: float = 0.01):
        # 根据 n 与 fpr 计算 m 与 k
        n = max(1, int(capacity))
        m = math.ceil(-n * math.log(fpr) / (math.log(2) ** 2))
        k = max(1, round((m / n) * math.log(2)))
        self.capacity = n
        self.fpr = fpr
        self.m = m
        self.k = k
        self._bits = _BitArray(m)
        self._lock = threading.Lock()
        self._count = 0

    def add(self, item: str) -> None:
        with self._lock:
            for i in _hashes(item, self.k, self.m):
                self._bits.set(i)
            self._count += 1

    def add_many(self, items: Iterable[str]) -> None:
        for it in items:
            self.add(it)

    def may_contain(self, item: str) -> bool:
        with self._lock:
            return all(self._bits.get(i) for i in _hashes(item, self.k, self.m))

    @property
    def count(self) -> int:
        with self._lock:
            return self._count

    def to_bytes(self) -> bytes:
        with self._lock:
            return self._bits.to_bytes()

    @classmethod
    def from_bytes(cls, raw: bytes, capacity: int, fpr: float) -> "BloomFilter":
        bf = cls(capacity=capacity, fpr=fpr)
        bf._bits = _BitArray.from_bytes(raw, bf.m)
        return bf


class NullCache:
    """空值缓存 (短 TTL). 防止同一不存在 key 反复穿透."""

    def __init__(self, default_ttl: float = 30.0, max_entries: int = 50_000):
        self._lock = threading.Lock()
        self._default_ttl = default_ttl
        self._max = max_entries
        self._data: dict[str, float] = {}  # key -> expires_at
        self._hit = 0
        self._miss = 0

    def set_ttl(self, sec: float) -> None:
        with self._lock:
            self._default_ttl = max(0.0, float(sec))

    def mark_null(self, key: str, ttl: float | None = None) -> None:
        with self._lock:
            self._data[key] = time.time() + (ttl if ttl is not None else self._default_ttl)
            if len(self._data) > self._max:
                # 简单: 删过期
                now = time.time()
                self._data = {k: v for k, v in self._data.items() if v > now}

    def is_null_cached(self, key: str) -> bool:
        with self._lock:
            exp = self._data.get(key)
            if exp is None:
                self._miss += 1
                return False
            if exp < time.time():
                self._data.pop(key, None)
                self._miss += 1
                return False
            self._hit += 1
            return True

    def clear(self) -> None:
        with self._lock:
            self._data.clear()

    def stats(self) -> dict:
        with self._lock:
            return {
                "size": len(self._data),
                "default_ttl": self._default_ttl,
                "max": self._max,
                "hit": self._hit,
                "miss": self._miss,
            }


class BloomGuard:
    """布隆防护器: 多命名空间 + 空值缓存 统一管理."""

    def __init__(self):
        self._lock = threading.RLock()
        self._filters: dict[str, BloomFilter] = {}
        self._nulls: dict[str, NullCache] = {}

    def _get_filter(self, ns: str) -> BloomFilter:
        f = self._filters.get(ns)
        if f is None:
            f = BloomFilter()
            self._filters[ns] = f
        return f

    def _get_null(self, ns: str) -> NullCache:
        n = self._nulls.get(ns)
        if n is None:
            n = NullCache()
            self._nulls[ns] = n
        return n

    def add(self, ns: str, key: str) -> None:
        with self._lock:
            self._get_filter(ns).add(key)

    def add_many(self, ns: str, keys: Iterable[str]) -> None:
        with self._lock:
            self._get_filter(ns).add_many(keys)

    def may_contain(self, ns: str, key: str) -> bool:
        with self._lock:
            return self._get_filter(ns).may_contain(key)

    def mark_null(self, ns: str, key: str, ttl: float | None = None) -> None:
        with self._lock:
            self._get_null(ns).mark_null(key, ttl=ttl)

    def is_null_cached(self, ns: str, key: str) -> bool:
        with self._lock:
            return self._get_null(ns).is_null_cached(key)

    def configure(self, ns: str, capacity: int = 100_000, fpr: float = 0.01, null_ttl: float = 30.0) -> None:
        """配置某个命名空间的容量/误判率/空值 TTL."""
        with self._lock:
            self._filters[ns] = BloomFilter(capacity=capacity, fpr=fpr)
            self._nulls[ns] = NullCache(default_ttl=null_ttl)

    def reset_ns(self, ns: str) -> None:
        with self._lock:
            self._filters.pop(ns, None)
            self._nulls.pop(ns, None)

    def save_to_file(self, ns: str, path: str) -> None:
        with self._lock:
            f = self._filters[ns]
            raw = f.to_bytes()
            with open(path, "wb") as fp:
                fp.write(b"BLM1")
                fp.write(f.capacity.to_bytes(8, "big"))
                fp.write(int(f.fpr * 1_000_000).to_bytes(8, "big"))
                fp.write(f.m.to_bytes(8, "big"))
                fp.write(f.k.to_bytes(4, "big"))
                fp.write(len(raw).to_bytes(8, "big"))
                fp.write(raw)

    def load_from_file(self, ns: str, path: str) -> bool:
        if not os.path.exists(path):
            return False
        try:
            with open(path, "rb") as fp:
                magic = fp.read(4)
                if magic != b"BLM1":
                    return False
                capacity = int.from_bytes(fp.read(8), "big")
                fpr = int.from_bytes(fp.read(8), "big") / 1_000_000.0
                _m = int.from_bytes(fp.read(8), "big")
                _k = int.from_bytes(fp.read(4), "big")
                size = int.from_bytes(fp.read(8), "big")
                raw = fp.read(size)
            with self._lock:
                self._filters[ns] = BloomFilter.from_bytes(raw, capacity, fpr)
            return True
        except Exception as e:
            logger.debug(f"bloom_guard load fail: {e!r}")
            return False

    def stats(self) -> dict:
        with self._lock:
            return {
                "namespaces": {
                    ns: {
                        "count": f.count,
                        "m": f.m,
                        "k": f.k,
                        "fpr": f.fpr,
                        "null_cache": self._nulls[ns].stats() if ns in self._nulls else None,
                    }
                    for ns, f in self._filters.items()
                }
            }


# 全局单例
bloom_guard = BloomGuard()
