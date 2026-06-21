"""Bug-176: 地域路由 (geo DNS).

根据客户端 region 路由到最近 region, 失败时回退到默认 region.
支持: 健康 region 优先 + 距离权重 + 故障转移.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class Region:
    id: str
    healthy: bool = True
    weight: int = 100
    distance: dict[str, int] = field(default_factory=dict)  # from_region -> km


@dataclass
class GeoRoute:
    target_region: str
    reason: str


class GeoRouter:
    """按客户端 region 选最近健康 region."""

    def __init__(self):
        self._lock = threading.Lock()
        self._regions: dict[str, Region] = {}
        self._stats: dict[str, int] = {}
        self._events: deque = deque(maxlen=100)
        self._default = ""

    def add(self, region: Region) -> None:
        with self._lock:
            self._regions[region.id] = region
            if not self._default:
                self._default = region.id

    def set_health(self, region_id: str, healthy: bool) -> None:
        with self._lock:
            r = self._regions.get(region_id)
            if r and r.healthy != healthy:
                r.healthy = healthy
                self._events.append((time.time(), region_id, "down" if not healthy else "up"))

    def route(self, from_region: str) -> GeoRoute:
        with self._lock:
            if from_region in self._regions and self._regions[from_region].healthy:
                return GeoRoute(target_region=from_region, reason="local")
            # 选距离最近且健康的 region
            candidates = [r for r in self._regions.values() if r.healthy]
            if not candidates:
                raise RuntimeError("no healthy region")
            # 距离未知时按权重
            best = min(
                candidates,
                key=lambda r: (r.distance.get(from_region, 99999), -r.weight),
            )
            self._stats[best.id] = self._stats.get(best.id, 0) + 1
            return GeoRoute(target_region=best.id, reason="nearest-healthy")

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
