"""Bug-85: WebSocket 消息去重 (msg_id 幂等).

设计:
  - 客户端发消息时携带 msg_id (UUID)
  - 服务端用 LRU 缓存最近 N 分钟的 msg_id
  - 重复 msg_id 收到第二次时, 不再执行业务, 直接返回上次结果 (或 ack)
  - 防止网络重传 / 客户端重试导致的副作用
  - TTL 默认 5min, max 100k 条 (超出按 LRU 淘汰)

使用:
    from app.utils.ws_dedup import ws_deduper

    if ws_deduper.is_duplicate(msg_id="abc-123"):
        return cached_result
    result = await handle(...)
    ws_deduper.remember(msg_id="abc-123", result=result)
"""

import logging
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_TTL_SEC = 300.0
DEFAULT_MAX_ENTRIES = 100_000


@dataclass
class DedupEntry:
    msg_id: str
    result: Any
    stored_at: float
    expires_at: float
    hit_count: int = 0


class WsDeduper:
    """WS 消息去重器 (thread-safe LRU + TTL)."""

    def __init__(self, ttl_sec: float = DEFAULT_TTL_SEC, max_entries: int = DEFAULT_MAX_ENTRIES):
        self._lock = threading.Lock()
        self._ttl = ttl_sec
        self._max = max_entries
        self._cache: OrderedDict[str, DedupEntry] = OrderedDict()
        self._total_seen = 0
        self._total_dup = 0
        self._total_new = 0
        self._evicted_ttl = 0
        self._evicted_lru = 0

    def set_limits(self, ttl_sec: float | None = None, max_entries: int | None = None) -> None:
        with self._lock:
            if ttl_sec is not None:
                self._ttl = ttl_sec
            if max_entries is not None:
                self._max = max_entries

    def is_duplicate(self, msg_id: str) -> bool:
        """检查 msg_id 是否已见过 (且未过期). True=重复."""
        with self._lock:
            self._total_seen += 1
            entry = self._cache.get(msg_id)
            if entry is None:
                return False
            if entry.expires_at < time.time():
                # 已过期, 当作新消息
                self._cache.pop(msg_id, None)
                self._evicted_ttl += 1
                return False
            # 命中: 移到末尾 (LRU touch) + 计数
            self._cache.move_to_end(msg_id)
            entry.hit_count += 1
            self._total_dup += 1
            return True

    def remember(self, msg_id: str, result: Any = None) -> DedupEntry:
        """记住 msg_id 与结果. 重复 is_duplicate 时取这里存的 result."""
        with self._lock:
            now = time.time()
            entry = DedupEntry(
                msg_id=msg_id,
                result=result,
                stored_at=now,
                expires_at=now + self._ttl,
            )
            self._cache[msg_id] = entry
            self._cache.move_to_end(msg_id)
            self._total_new += 1
            # 容量控制: LRU 淘汰
            while len(self._cache) > self._max:
                self._cache.popitem(last=False)
                self._evicted_lru += 1
            return entry

    def get_cached(self, msg_id: str) -> Any | None:
        """取上次存的结果."""
        with self._lock:
            entry = self._cache.get(msg_id)
            if entry is None:
                return None
            if entry.expires_at < time.time():
                self._cache.pop(msg_id, None)
                return None
            return entry.result

    def cleanup_expired(self) -> int:
        """手动清理过期. 返回清理条数."""
        n = 0
        with self._lock:
            now = time.time()
            for k in list(self._cache.keys()):
                e = self._cache.get(k)
                if e is None or e.expires_at < now:
                    self._cache.pop(k, None)
                    n += 1
        return n

    def forget(self, msg_id: str) -> None:
        with self._lock:
            self._cache.pop(msg_id, None)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def stats(self) -> dict:
        with self._lock:
            return {
                "size": len(self._cache),
                "max_entries": self._max,
                "ttl_sec": self._ttl,
                "total_seen": self._total_seen,
                "total_dup": self._total_dup,
                "total_new": self._total_new,
                "dup_rate": round(self._total_dup / self._total_seen, 4) if self._total_seen else 0.0,
                "evicted_ttl": self._evicted_ttl,
                "evicted_lru": self._evicted_lru,
            }


# 全局单例
ws_deduper = WsDeduper()
