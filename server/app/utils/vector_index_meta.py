"""Bug-109: 向量索引元数据.

设计:
  - 集合 (collection) 元数据: 名称 / 维度 / 距离度量 / 索引类型 / 文档数
  - 漂移告警: 实际维度 / 实际文档数与元数据不一致
  - 重建策略: 标记 dirty / rebuild / verify 三态
  - 校验和: 集合 hash, 重建前后比对
  - 操作审计: create / drop / rebuild / verify
"""

import hashlib
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from enum import StrEnum

logger = logging.getLogger(__name__)


class IndexState(StrEnum):
    HEALTHY = "healthy"
    DIRTY = "dirty"
    REBUILDING = "rebuilding"
    MISSING = "missing"
    FAILED = "failed"


class DistanceMetric(StrEnum):
    COSINE = "cosine"
    L2 = "l2"
    IP = "ip"
    HAMMING = "hamming"


class IndexType(StrEnum):
    FLAT = "flat"
    IVF = "ivf"
    HNSW = "hnsw"
    ANNOY = "annoy"
    PQ = "pq"


@dataclass
class IndexMeta:
    name: str
    dimension: int = 0
    metric: str = "cosine"
    index_type: str = "hnsw"
    doc_count: int = 0
    state: str = IndexState.HEALTHY.value
    checksum: str = ""
    created_at: float = 0.0
    updated_at: float = 0.0
    last_rebuild_at: float = 0.0
    last_verify_at: float = 0.0
    extra: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return self.__dict__.copy()

    @classmethod
    def from_dict(cls, d: dict) -> "IndexMeta":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})

    def compute_checksum(self) -> str:
        body = f"{self.name}|{self.dimension}|{self.metric}|{self.index_type}|{self.doc_count}"
        return hashlib.sha256(body.encode("utf-8")).hexdigest()


@dataclass
class DriftRecord:
    name: str
    field_name: str
    expected: object
    actual: object
    ts: float


@dataclass
class IndexAuditEntry:
    name: str
    action: str
    detail: str
    ts: float
    actor: str = "system"


class VectorIndexMeta:
    """向量索引元数据管理."""

    def __init__(self, max_audit: int = 1000):
        self._lock = threading.Lock()
        self._metas: dict[str, IndexMeta] = {}
        self._drift: deque[DriftRecord] = deque(maxlen=500)
        self._audit: deque[IndexAuditEntry] = deque(maxlen=max_audit)
        self._drift_warnings = 0

    def _audit_log(self, name: str, action: str, detail: str, actor: str = "system") -> None:
        self._audit.append(IndexAuditEntry(name, action, detail, time.time(), actor))

    def create(
        self,
        name: str,
        dimension: int,
        metric: str = "cosine",
        index_type: str = "hnsw",
        actor: str = "system",
    ) -> IndexMeta:
        with self._lock:
            if name in self._metas:
                raise ValueError(f"index {name} already exists")
            m = IndexMeta(
                name=name,
                dimension=dimension,
                metric=metric,
                index_type=index_type,
                state=IndexState.HEALTHY.value,
                created_at=time.time(),
                updated_at=time.time(),
            )
            m.checksum = m.compute_checksum()
            self._metas[name] = m
            self._audit_log(name, "create", f"dim={dimension} metric={metric} type={index_type}", actor)
        return m

    def drop(self, name: str, actor: str = "system") -> bool:
        with self._lock:
            m = self._metas.pop(name, None)
            if m is None:
                return False
            self._audit_log(name, "drop", "ok", actor)
            return True

    def get(self, name: str) -> IndexMeta | None:
        with self._lock:
            return self._metas.get(name)

    def list_all(self) -> list[IndexMeta]:
        with self._lock:
            return list(self._metas.values())

    def update(
        self,
        name: str,
        doc_count: int | None = None,
        dimension: int | None = None,
        metric: str | None = None,
        index_type: str | None = None,
    ) -> IndexMeta:
        with self._lock:
            m = self._metas.get(name)
            if m is None:
                raise ValueError(f"index {name} not exists")
            if doc_count is not None:
                m.doc_count = doc_count
            if dimension is not None:
                m.dimension = dimension
            if metric is not None:
                m.metric = metric
            if index_type is not None:
                m.index_type = index_type
            m.updated_at = time.time()
            m.checksum = m.compute_checksum()
            return m

    def report_drift(
        self,
        name: str,
        field_name: str,
        expected: object,
        actual: object,
    ) -> bool:
        with self._lock:
            self._drift_warnings += 1
            self._drift.append(DriftRecord(name, field_name, expected, actual, time.time()))
        if expected != actual:
            logger.warning("index_drift: %s.%s expected=%s actual=%s", name, field_name, expected, actual)
        return expected != actual

    def get_drift(self, name: str | None = None, limit: int = 100) -> list[DriftRecord]:
        with self._lock:
            arr = list(self._drift)
        if name:
            arr = [d for d in arr if d.name == name]
        return arr[-limit:]

    def mark_state(self, name: str, state: str, actor: str = "system") -> bool:
        with self._lock:
            m = self._metas.get(name)
            if m is None:
                return False
            m.state = state
            m.updated_at = time.time()
            self._audit_log(name, "state_change", f"-> {state}", actor)
            return True

    def start_rebuild(self, name: str, actor: str = "system") -> bool:
        with self._lock:
            m = self._metas.get(name)
            if m is None:
                return False
            m.state = IndexState.REBUILDING.value
            m.last_rebuild_at = time.time()
            m.updated_at = m.last_rebuild_at
            self._audit_log(name, "rebuild_start", "ok", actor)
            return True

    def finish_rebuild(
        self,
        name: str,
        new_doc_count: int,
        new_dimension: int | None = None,
        actor: str = "system",
    ) -> bool:
        with self._lock:
            m = self._metas.get(name)
            if m is None:
                return False
            old_checksum = m.checksum
            m.doc_count = new_doc_count
            if new_dimension is not None:
                m.dimension = new_dimension
            m.state = IndexState.HEALTHY.value
            m.last_rebuild_at = time.time()
            m.updated_at = m.last_rebuild_at
            m.checksum = m.compute_checksum()
            self._audit_log(name, "rebuild_done", f"old={old_checksum[:8]} new={m.checksum[:8]}", actor)
            return True

    def fail_rebuild(self, name: str, reason: str, actor: str = "system") -> bool:
        with self._lock:
            m = self._metas.get(name)
            if m is None:
                return False
            m.state = IndexState.FAILED.value
            m.updated_at = time.time()
            self._audit_log(name, "rebuild_failed", reason, actor)
            return True

    def verify(self, name: str, actual_doc_count: int, actual_dimension: int) -> dict[str, object]:
        with self._lock:
            m = self._metas.get(name)
            if m is None:
                return {"ok": False, "error": "not_exists"}
            ok = m.dimension == actual_dimension and m.doc_count == actual_doc_count
            m.last_verify_at = time.time()
            self._audit_log(
                name, "verify", f"dim_ok={m.dimension == actual_dimension} cnt_ok={m.doc_count == actual_doc_count}"
            )
            return {
                "ok": ok,
                "expected_dimension": m.dimension,
                "actual_dimension": actual_dimension,
                "expected_doc_count": m.doc_count,
                "actual_doc_count": actual_doc_count,
            }

    def get_audit(self, name: str | None = None, limit: int = 100) -> list[IndexAuditEntry]:
        with self._lock:
            arr = list(self._audit)
        if name:
            arr = [a for a in arr if a.name == name]
        return arr[-limit:]

    def find_stale(self, max_age_sec: float) -> list[IndexMeta]:
        with self._lock:
            arr = list(self._metas.values())
        cutoff = time.time() - max_age_sec
        return [m for m in arr if m.last_verify_at and m.last_verify_at < cutoff]

    def stats(self) -> dict:
        with self._lock:
            by_state: dict[str, int] = {}
            for m in self._metas.values():
                by_state[m.state] = by_state.get(m.state, 0) + 1
            return {
                "index_count": len(self._metas),
                "by_state": by_state,
                "drift_count": len(self._drift),
                "drift_warnings": self._drift_warnings,
                "audit_count": len(self._audit),
            }

    def clear(self) -> None:
        with self._lock:
            self._metas.clear()
            self._drift.clear()
            self._audit.clear()
            self._drift_warnings = 0


# 全局单例
vector_index_meta = VectorIndexMeta()
