"""Bug-99: DDL 审计链.

设计:
  - 记录 DDL 操作 (CREATE / ALTER / DROP) 到追加日志
  - 每条记录包含前一记录的 SHA-256 哈希 (链式防篡改)
  - 启动时可校验整条链完整性
  - 支持内存索引按表名 / 操作者 / 时间范围查询
  - 持久化到 JSONL, 异常恢复
"""

import hashlib
import json
import logging
import os
import threading
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from enum import StrEnum

logger = logging.getLogger(__name__)

GENESIS_HASH = "0" * 64


class DdlOp(StrEnum):
    CREATE = "CREATE"
    ALTER = "ALTER"
    DROP = "DROP"
    RENAME = "RENAME"
    TRUNCATE = "TRUNCATE"
    INDEX = "INDEX"


@dataclass
class DdlEntry:
    op: str
    obj_type: str  # TABLE / INDEX / VIEW / ...
    obj_name: str
    actor: str
    ts: float
    sql: str
    prev_hash: str = GENESIS_HASH
    hash: str = ""
    extra: dict = field(default_factory=dict)

    def compute_hash(self) -> str:
        body = f"{self.op}|{self.obj_type}|{self.obj_name}|{self.actor}|{self.ts}|{self.sql}|{self.prev_hash}"
        h = hashlib.sha256(body.encode("utf-8")).hexdigest()
        return h

    def to_dict(self) -> dict:
        d = asdict(self)
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "DdlEntry":
        return cls(**d)


class DdlAuditTrail:
    """DDL 审计链: 追加 + 哈希链 + 校验."""

    def __init__(self, log_path: str = "", max_in_mem: int = 5000):
        self._lock = threading.Lock()
        self._log_path = log_path
        self._entries: deque[DdlEntry] = deque(maxlen=max_in_mem)
        self._tail_hash: str = GENESIS_HASH
        if log_path and os.path.exists(log_path):
            self._load_from_file()

    def _load_from_file(self) -> None:
        try:
            with open(self._log_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        d = json.loads(line)
                        e = DdlEntry.from_dict(d)
                        self._entries.append(e)
                        self._tail_hash = e.hash
                    except Exception:
                        continue
        except OSError as e:
            logger.warning("ddl_audit load failed: %s", e)

    def _append_to_file(self, entry: DdlEntry) -> None:
        if not self._log_path:
            return
        try:
            with open(self._log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry.to_dict(), ensure_ascii=False) + "\n")
        except OSError as e:
            logger.warning("ddl_audit append failed: %s", e)

    def record(
        self,
        op: str,
        obj_type: str,
        obj_name: str,
        actor: str,
        sql: str,
        extra: dict | None = None,
    ) -> DdlEntry:
        op = str(op).upper()
        with self._lock:
            entry = DdlEntry(
                op=op,
                obj_type=obj_type,
                obj_name=obj_name,
                actor=actor,
                ts=time.time(),
                sql=sql,
                prev_hash=self._tail_hash,
                extra=extra or {},
            )
            entry.hash = entry.compute_hash()
            self._entries.append(entry)
            self._tail_hash = entry.hash
            self._append_to_file(entry)
            logger.info("ddl_audit: op=%s obj=%s.%s actor=%s", op, obj_type, obj_name, actor)
            return entry

    def verify(self) -> dict[str, object]:
        """校验整条链, 返回 (ok, broken_at, total)."""
        with self._lock:
            prev = GENESIS_HASH
            broken_at: int | None = None
            for idx, e in enumerate(self._entries):
                if e.prev_hash != prev:
                    broken_at = idx
                    break
                recomputed = e.compute_hash()
                if recomputed != e.hash:
                    broken_at = idx
                    break
                prev = e.hash
            total = len(self._entries)
            return {
                "ok": broken_at is None,
                "broken_at": broken_at,
                "total": total,
                "tail_hash": self._tail_hash if self._entries else GENESIS_HASH,
            }

    def list_recent(self, n: int = 50, obj_name: str | None = None) -> list[DdlEntry]:
        with self._lock:
            arr = list(self._entries)
        if obj_name:
            arr = [e for e in arr if e.obj_name == obj_name]
        return arr[-n:]

    def query(
        self,
        obj_name: str | None = None,
        actor: str | None = None,
        op: str | None = None,
        since_ts: float = 0.0,
        limit: int = 200,
    ) -> list[DdlEntry]:
        with self._lock:
            arr = list(self._entries)
        out: list[DdlEntry] = []
        for e in arr:
            if obj_name and e.obj_name != obj_name:
                continue
            if actor and e.actor != actor:
                continue
            if op and e.op != op.upper():
                continue
            if e.ts < since_ts:
                continue
            out.append(e)
            if len(out) >= limit:
                break
        return out

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
            self._tail_hash = GENESIS_HASH
        if self._log_path and os.path.exists(self._log_path):
            try:
                os.remove(self._log_path)
            except OSError:
                logger.warning("Caught unexpected exception")

    def stats(self) -> dict:
        with self._lock:
            total = len(self._entries)
            by_op: dict[str, int] = {}
            for e in self._entries:
                by_op[e.op] = by_op.get(e.op, 0) + 1
            return {
                "total": total,
                "by_op": by_op,
                "tail_hash": self._tail_hash,
                "log_path": self._log_path,
            }

    def set_log_path(self, p: str) -> None:
        with self._lock:
            self._log_path = p


# 全局单例
ddl_audit = DdlAuditTrail()
