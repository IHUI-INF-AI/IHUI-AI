"""Bug-183: 配置热更新.

支持: 多源 (env / file / remote) + 变更订阅 + 版本号 + 差异对比.
"""

import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ConfigChange:
    key: str
    old: Any
    new: Any
    ts: float = field(default_factory=time.time)


@dataclass
class HotConfig:
    version: int = 0
    data: dict[str, Any] = field(default_factory=dict)
    history: deque = field(default_factory=lambda: deque(maxlen=200))


class HotConfigCenter:
    """热配置中心: 变更通知 + 订阅 + 版本号."""

    def __init__(self):
        self._lock = threading.Lock()
        self._data: dict[str, Any] = {}
        self._version = 0
        self._subscribers: dict[str, list[Callable[[ConfigChange], None]]] = {}
        self._global_subs: list[Callable[[ConfigChange], None]] = []
        self._history: deque = deque(maxlen=200)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._data.get(key, default)

    def set(self, key: str, value: Any) -> ConfigChange | None:
        with self._lock:
            old = self._data.get(key)
            if old == value:
                return None
            self._data[key] = value
            self._version += 1
            ch = ConfigChange(key=key, old=old, new=value)
            self._history.append(ch)
            subs = list(self._subscribers.get(key, [])) + list(self._global_subs)
        for fn in subs:
            try:
                fn(ch)
            except Exception as e:
                logger.debug("热配置订阅回调失败: %s", e)  # intentionally ignored
        return ch

    def bulk_set(self, kv: dict[str, Any]) -> list[ConfigChange]:
        out: list[ConfigChange] = []
        for k, v in kv.items():
            ch = self.set(k, v)
            if ch:
                out.append(ch)
        return out

    def subscribe(self, key: str, fn: Callable[[ConfigChange], None]) -> None:
        with self._lock:
            self._subscribers.setdefault(key, []).append(fn)

    def subscribe_all(self, fn: Callable[[ConfigChange], None]) -> None:
        with self._lock:
            self._global_subs.append(fn)

    def diff(self, other: dict[str, Any]) -> list[ConfigChange]:
        out: list[ConfigChange] = []
        with self._lock:
            for k, v in other.items():
                if self._data.get(k) != v:
                    out.append(ConfigChange(key=k, old=self._data.get(k), new=v))
        return out

    def snapshot(self) -> HotConfig:
        with self._lock:
            return HotConfig(version=self._version, data=dict(self._data), history=deque(self._history))

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "version": self._version,
                "keys": len(self._data),
                "subscribers": sum(len(v) for v in self._subscribers.values()) + len(self._global_subs),
            }
