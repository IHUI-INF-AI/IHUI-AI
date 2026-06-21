"""Bug-158: 指标基数控制.

高基数 (用户 ID / 手机号 / 邮箱) 会打爆 Prometheus,
需要限流 + 黑名单 + 自动截断 label.
"""

import hashlib
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass
class CardinalityConfig:
    max_label_values: int = 1000  # 单 label 不同值上限
    high_card_keys: frozenset[str] = frozenset({"user_id", "phone", "email", "id_card"})
    bucket_count: int = 64  # 高基数 key 桶数 (降低基数)
    evict_window_sec: int = 3600


@dataclass
class LabelPolicy:
    name: str
    bucket: bool = False
    redact: bool = False


class MetricRegistry:
    """指标注册 + 标签基数控制 + 桶化降基数."""

    def __init__(self, config: CardinalityConfig | None = None):
        self.config = config or CardinalityConfig()
        self._lock = threading.Lock()
        self._values: dict[str, dict[str, deque[float]]] = defaultdict(lambda: defaultdict(deque))
        self._evict_ts: dict[tuple[str, str], float] = {}
        self._dropped: dict[str, int] = defaultdict(int)
        self._max_samples = 1000

    def _key_of(self, metric: str, label: str, value: str) -> str:
        cfg = self.config
        if label in cfg.high_card_keys and cfg.bucket_count > 0:
            h = hashlib.md5(value.encode("utf-8")).digest()[0]
            return f"bucket_{h % cfg.bucket_count}"
        return value

    def _evict_if_needed(self, metric: str, label: str) -> None:
        cfg = self.config
        key = (metric, label)
        now = time.time()
        last = self._evict_ts.get(key, 0)
        if now - last < 60:
            return
        self._evict_ts[key] = now
        store = self._values[metric]
        if len(store) <= cfg.max_label_values:
            return
        # 删除最久未更新的 key
        items = sorted(store.items(), key=lambda kv: kv[1][-1] if kv[1] else 0)
        for k, _ in items[: len(store) - cfg.max_label_values]:
            del store[k]
            self._dropped[label] += 1

    def observe(self, metric: str, labels: dict[str, str], value: float) -> None:
        with self._lock:
            for label, raw in labels.items():
                v = self._key_of(metric, label, raw)
                q = self._values[metric][f"{label}={v}"]
                q.append(value)
                if len(q) > self._max_samples:
                    q.popleft()
                self._evict_if_needed(metric, label)

    def series_count(self, metric: str) -> int:
        with self._lock:
            return len(self._values.get(metric, {}))

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "tracked_metrics": len(self._values),
                "dropped": dict(self._dropped),
            }
