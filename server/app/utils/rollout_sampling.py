"""Bug-79: 灰度实验 hit 采样上报.

设计:
  - 灰度 hit 默认全量记录, 但 10% 采样上报到埋点, 减少存储压力
  - 采样率可按实验名配置
  - 提供本地文件 JSONL 持久化 (供统计 / 调试)
  - 提供 stats() 给 Prometheus 抓取

使用:
    from app.utils.rollout_sampling import rollout_sampler

    rollout_sampler.record_hit("new_payment", bucket=23, version="v2", hit=True)
    rollout_sampler.set_sample_rate("new_payment", 0.1)  # 10% 采样
"""

import json
import logging
import os
import random
import threading
import time
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DEFAULT_SAMPLE_RATE = 0.1
DEFAULT_LOCAL_PATH = os.environ.get("ZHS_AUDIT_DIR", "audit") + "/rollout_sampling.jsonl"
MAX_LOCAL_RECORDS = 10000


@dataclass
class SamplingRecord:
    exp: str
    bucket: int
    version: str
    hit: bool
    sampled: bool
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "exp": self.exp,
            "bucket": self.bucket,
            "version": self.version,
            "hit": self.hit,
            "sampled": self.sampled,
            "ts": self.ts,
        }


@dataclass
class ExperimentStats:
    exp: str
    total: int = 0
    hits: int = 0
    sampled: int = 0
    last_hit_ts: float = 0.0
    sample_rate: float = DEFAULT_SAMPLE_RATE

    def to_dict(self) -> dict:
        return {
            "exp": self.exp,
            "total": self.total,
            "hits": self.hits,
            "hit_rate": round(self.hits / max(1, self.total), 4),
            "sampled": self.sampled,
            "sample_rate": self.sample_rate,
            "last_hit_ts": round(self.last_hit_ts, 3),
        }


class RolloutSampler:
    """灰度 hit 采样上报器."""

    def __init__(
        self,
        default_rate: float = DEFAULT_SAMPLE_RATE,
        local_path: str | None = None,
        write_local: bool = True,
    ):
        self._stats: dict[str, ExperimentStats] = {}
        self._rates: dict[str, float] = {}
        self._lock = threading.Lock()
        self._default_rate = default_rate
        self._local_path = local_path or DEFAULT_LOCAL_PATH
        self._write_local = write_local
        self._total_records = 0
        self._total_sampled = 0

    def set_sample_rate(self, exp: str, rate: float) -> None:
        with self._lock:
            self._rates[exp] = float(rate)
            if exp in self._stats:
                self._stats[exp].sample_rate = float(rate)

    def get_sample_rate(self, exp: str) -> float:
        with self._lock:
            return self._rates.get(exp, self._default_rate)

    def _should_sample(self, exp: str) -> bool:
        with self._lock:
            rate = self._rates.get(exp, self._default_rate)
        if rate <= 0:
            return False
        if rate >= 1.0:
            return True
        return random.random() < rate

    def _ensure_stats(self, exp: str) -> ExperimentStats:
        with self._lock:
            st = self._stats.get(exp)
            if st is None:
                st = ExperimentStats(exp=exp, sample_rate=self._rates.get(exp, self._default_rate))
                self._stats[exp] = st
            return st

    def record_hit(self, exp: str, bucket: int, version: str, hit: bool) -> bool:
        """记录一次 hit, 返回是否被采样."""
        st = self._ensure_stats(exp)
        sampled = self._should_sample(exp)
        with self._lock:
            st.total += 1
            if hit:
                st.hits += 1
            if sampled:
                st.sampled += 1
            st.last_hit_ts = time.time()
            self._total_records += 1
            if sampled:
                self._total_sampled += 1
        rec = SamplingRecord(exp=exp, bucket=bucket, version=version, hit=hit, sampled=sampled)
        if sampled and self._write_local:
            self._write_local_one(rec)
        return sampled

    def _write_local_one(self, rec: SamplingRecord) -> None:
        try:
            os.makedirs(os.path.dirname(self._local_path), exist_ok=True)
            with open(self._local_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec.to_dict(), ensure_ascii=False) + "\n")
        except Exception as e:
            logger.debug(f"rollout_sampler write local fail: {e}")

    def get_stats(self, exp: str) -> dict | None:
        with self._lock:
            st = self._stats.get(exp)
        return st.to_dict() if st else None

    def all_stats(self) -> dict:
        with self._lock:
            return {
                "experiments": {k: v.to_dict() for k, v in self._stats.items()},
                "total_records": self._total_records,
                "total_sampled": self._total_sampled,
                "default_rate": self._default_rate,
                "sample_rate": round(self._total_sampled / max(1, self._total_records), 4),
            }

    def reset(self, exp: str | None = None) -> None:
        with self._lock:
            if exp is None:
                self._stats.clear()
                self._total_records = 0
                self._total_sampled = 0
            else:
                self._stats.pop(exp, None)


# 全局单例
rollout_sampler = RolloutSampler()
