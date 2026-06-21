"""Bug-177: 跨地域复制.

模拟 binlog 同步 + 乱序解决 (version vector) + 冲突检测.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class ReplicaLog:
    key: str
    value: object
    version: int
    ts: float = field(default_factory=time.time)
    source: str = ""


class CrossRegionReplicator:
    """跨地域复制: version vector + 冲突日志."""

    def __init__(self):
        self._lock = threading.Lock()
        self._local: dict[str, ReplicaLog] = {}
        self._versions: dict[str, dict[str, int]] = {}  # key -> {region: ver}
        self._conflicts: deque = deque(maxlen=200)
        self._stats = {"applied": 0, "dropped": 0, "conflicts": 0}

    def write(self, key: str, value: object, region: str) -> ReplicaLog:
        with self._lock:
            v = self._versions.setdefault(key, {})
            ver = v.get(region, 0) + 1
            v[region] = ver
            log = ReplicaLog(key=key, value=value, version=ver, source=region)
            self._local[key] = log
            self._stats["applied"] += 1
            return log

    def replicate(self, log: ReplicaLog) -> bool:
        """接收远端日志, 判断是否能 apply."""
        with self._lock:
            v = self._versions.setdefault(log.key, {})
            cur_local = self._local.get(log.key)
            cur_ver = v.get(log.source, 0)
            if log.version <= cur_ver:
                self._stats["dropped"] += 1
                return False
            # 冲突检测: 同 key 多 region 都已有版本, 且远端日志值与当前不同
            other_regions = [reg for reg in v if reg != log.source and v[reg] > 0]
            if cur_local and other_regions and log.value != cur_local.value:
                self._conflicts.append(
                    (time.time(), log.key, cur_local.source, log.source, cur_local.version, log.version)
                )
                self._stats["conflicts"] += 1
            v[log.source] = log.version
            self._local[log.key] = log
            self._stats["applied"] += 1
            return True

    def read(self, key: str) -> ReplicaLog | None:
        with self._lock:
            return self._local.get(key)

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._stats)
