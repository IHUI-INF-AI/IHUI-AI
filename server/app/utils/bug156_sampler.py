"""Bug-156: 采样策略.

按 trace_id 尾字节 + 比例 + 重要等级 (root/parent) 自适应采样.
"""

import hashlib
import threading
from dataclasses import dataclass, field
from enum import StrEnum


class Priority(StrEnum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class SamplerConfig:
    base_rate: float = 0.1  # 基础采样率 10%
    high_rate: float = 1.0  # 高级必采
    critical_rate: float = 1.0
    rate_by_priority: dict[str, float] = field(
        default_factory=lambda: {
            "LOW": 0.0,
            "NORMAL": 0.1,
            "HIGH": 1.0,
            "CRITICAL": 1.0,
        }
    )


class TraceSampler:
    """采样器: 比例 + 重要等级 + 尾字节稳定抽样."""

    def __init__(self, config: SamplerConfig | None = None):
        self.config = config or SamplerConfig()
        self._lock = threading.Lock()
        self._evaluated = 0
        self._sampled = 0
        self._by_priority: dict[str, int] = {p.value: 0 for p in Priority}

    @staticmethod
    def _bucket(trace_id: str) -> int:
        if not trace_id:
            return 0
        h = hashlib.md5(trace_id.encode("utf-8")).digest()[-1]
        return h

    def should_sample(self, trace_id: str, priority: Priority) -> bool:
        rate = self.config.rate_by_priority.get(priority.value, self.config.base_rate)
        if rate >= 1.0:
            keep = True
        elif rate <= 0.0:
            keep = False
        else:
            keep = self._bucket(trace_id) / 255.0 < rate
        with self._lock:
            self._evaluated += 1
            if keep:
                self._sampled += 1
                self._by_priority[priority.value] = self._by_priority.get(priority.value, 0) + 1
        return keep

    def stats(self) -> dict[str, object]:
        with self._lock:
            return {
                "evaluated": self._evaluated,
                "sampled": self._sampled,
                "sampling_rate": self._sampled / self._evaluated if self._evaluated else 0.0,
                "by_priority": dict(self._by_priority),
            }
