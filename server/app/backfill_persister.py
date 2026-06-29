"""Backfill 进度持久化 (建议 148) - app/backfill_persister.py.

设计:
  - 抽象接口 BackfillPersister: save_snapshot / load_snapshot / append_event / load_events
  - FileBackfillPersister: JSON 文件 (单进程)
  - SQLiteBackfillPersister: SQLite + WAL (跨进程, 默认)
  - 让 BackfillBroadcaster 重启可恢复: 启动时 load_snapshot, 后续每次状态变更 append_event

用法:
    from app.backfill_persister import SQLiteBackfillPersister

    persister = SQLiteBackfillPersister("/var/lib/zhs/backfill.db")
    broadcaster = BackfillBroadcaster(persister=persister)
    # 启动时自动恢复
    broadcaster.load_from_persister()
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import sqlite3
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path

from app.backfill_event import BackfillEvent, BackfillEventType

try:
    from app.canary_metrics import (
        BACKFILL_PERSISTER_DB_BYTES,
        BACKFILL_PERSISTER_READS_FAILED,
        BACKFILL_PERSISTER_TAIL_COUNT,
        BACKFILL_PERSISTER_WRITES,
    )
except Exception:  # prometheus_client 不可用时 None
    BACKFILL_PERSISTER_WRITES = None  # type: ignore[assignment]
    BACKFILL_PERSISTER_READS_FAILED = None  # type: ignore[assignment]
    BACKFILL_PERSISTER_TAIL_COUNT = None  # type: ignore[assignment]
    BACKFILL_PERSISTER_DB_BYTES = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)


def _inc_write(operation: str, result: str) -> None:
    if BACKFILL_PERSISTER_WRITES is None:
        return
    with contextlib.suppress(Exception):
        BACKFILL_PERSISTER_WRITES.labels(operation=operation, result=result).inc()


def _inc_read_failed(operation: str) -> None:
    if BACKFILL_PERSISTER_READS_FAILED is None:
        return
    with contextlib.suppress(Exception):
        BACKFILL_PERSISTER_READS_FAILED.labels(operation=operation).inc()


def _set_tail_count(value: int) -> None:
    if BACKFILL_PERSISTER_TAIL_COUNT is None:
        return
    with contextlib.suppress(Exception):
        BACKFILL_PERSISTER_TAIL_COUNT.set(value)


def _set_db_bytes(path: Path) -> None:
    if BACKFILL_PERSISTER_DB_BYTES is None:
        return
    try:
        if path.exists():
            BACKFILL_PERSISTER_DB_BYTES.set(path.stat().st_size)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# 抽象接口
# ---------------------------------------------------------------------------


class BackfillPersister(ABC):
    """持久化抽象接口."""

    @abstractmethod
    def save_snapshot(self, snapshot: dict) -> None: ...
    @abstractmethod
    def load_snapshot(self) -> dict | None: ...
    @abstractmethod
    def append_event(self, event: BackfillEvent) -> None: ...
    @abstractmethod
    def load_events(self, limit: int = 1000) -> list[BackfillEvent]: ...
    @abstractmethod
    def clear(self) -> None: ...


# ---------------------------------------------------------------------------
# 文件后端 (JSON, 单进程)
# ---------------------------------------------------------------------------


class FileBackfillPersister(BackfillPersister):
    """JSON 文件持久化.

    文件结构:
      /path/to/state.json = {
        "snapshot": {...},
        "events": [
          {"event_type": "started", "table": "users", "total": 1000, "ts": 1234567890.0, ...},
          ...
        ]
      }
    """

    def __init__(self, file_path: str = "backfill_state.json", max_events: int = 1000):
        self._file_path = Path(file_path)
        self._max_events = max_events
        self._lock = threading.Lock()

    def _read(self) -> dict:
        if not self._file_path.exists():
            return {"snapshot": {}, "events": []}
        try:
            return json.loads(self._file_path.read_text(encoding="utf-8"))
        except Exception as e:
            logger.warning(f"[_persister] 读失败: {e}")
            return {"snapshot": {}, "events": []}

    def _write(self, data: dict) -> None:
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        # 原子写
        tmp = self._file_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp.replace(self._file_path)

    def save_snapshot(self, snapshot: dict) -> None:
        with self._lock:
            data = self._read()
            data["snapshot"] = snapshot
            data["snapshot"]["_saved_at"] = time.time()
            self._write(data)

    def load_snapshot(self) -> dict | None:
        with self._lock:
            data = self._read()
            return data.get("snapshot") or None

    def append_event(self, event: BackfillEvent) -> None:
        with self._lock:
            data = self._read()
            evs = data.get("events", [])
            evs.append(event.to_dict())
            # 截断
            if len(evs) > self._max_events:
                cut = self._max_events // 10
                evs = evs[cut:]
            data["events"] = evs
            self._write(data)

    def load_events(self, limit: int = 1000) -> list[BackfillEvent]:
        with self._lock:
            data = self._read()
            evs = data.get("events", [])[-limit:]
            return [self._reconstruct(e) for e in evs]

    def clear(self) -> None:
        with self._lock:
            if self._file_path.exists():
                self._file_path.unlink()

    def _reconstruct(self, d: dict) -> BackfillEvent:
        d = dict(d)
        ev_type = d.pop("event_type", "heartbeat")
        try:
            d["event_type"] = BackfillEventType(ev_type)
        except ValueError:
            d["event_type"] = BackfillEventType.HEARTBEAT
        d.setdefault("timestamp", d.get("ts", time.time()))
        d.pop("ts", None)
        return BackfillEvent(**d)


# ---------------------------------------------------------------------------
# SQLite 后端 (跨进程, 默认)
# ---------------------------------------------------------------------------


class SQLiteBackfillPersister(BackfillPersister):
    """SQLite 持久化 (WAL 模式, 跨进程).

    2 张表:
      - backfill_snapshot: 单行, 存最近 snapshot
      - backfill_events: 时序, 存全部事件
    """

    def __init__(self, db_path: str = "backfill_state.db"):
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_lock = threading.Lock()
        self._initialized = False
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(
            str(self._db_path),
            timeout=10.0,
            check_same_thread=False,
        )
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        with self._init_lock:
            if self._initialized:
                return
            conn = self._connect()
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS backfill_snapshot (
                        id INTEGER PRIMARY KEY CHECK (id = 1),
                        snapshot_json TEXT NOT NULL,
                        saved_at REAL NOT NULL
                    )
                """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS backfill_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        event_type TEXT NOT NULL,
                        table_name TEXT NOT NULL,
                        tenant_id INTEGER,
                        processed INTEGER DEFAULT 0,
                        total INTEGER DEFAULT 0,
                        percent REAL DEFAULT 0,
                        eta_seconds REAL DEFAULT 0,
                        error TEXT DEFAULT '',
                        ts REAL NOT NULL
                    )
                """
                )
                conn.execute("CREATE INDEX IF NOT EXISTS idx_backfill_events_ts ON backfill_events(ts)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_backfill_events_table ON backfill_events(table_name)")
                conn.commit()
            finally:
                conn.close()
            self._initialized = True

    def save_snapshot(self, snapshot: dict) -> None:
        conn = self._connect()
        try:
            payload = json.dumps(snapshot, ensure_ascii=False)
            now = time.time()
            conn.execute(
                """
                INSERT OR REPLACE INTO backfill_snapshot (id, snapshot_json, saved_at)
                VALUES (1, ?, ?)
            """,
                (payload, now),
            )
            conn.commit()
            _inc_write("save_snapshot", "success")
        except Exception:
            _inc_write("save_snapshot", "failed")
            raise
        finally:
            conn.close()
            _set_db_bytes(self._db_path)

    def load_snapshot(self) -> dict | None:
        conn = self._connect()
        try:
            row = conn.execute("SELECT snapshot_json FROM backfill_snapshot WHERE id = 1").fetchone()
            if not row:
                return None
            return json.loads(row[0])
        except Exception as e:
            logger.warning(f"[sqlite_persister] load_snapshot 失败: {e}")
            _inc_read_failed("load_snapshot")
            return None
        finally:
            conn.close()

    def append_event(self, event: BackfillEvent) -> None:
        conn = self._connect()
        try:
            conn.execute(
                """
                INSERT INTO backfill_events
                  (event_type, table_name, tenant_id, processed, total, percent, eta_seconds, error, ts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    event.event_type.value,
                    event.table,
                    event.tenant_id,
                    event.processed,
                    event.total,
                    event.percent,
                    event.eta_seconds,
                    event.error,
                    event.timestamp,
                ),
            )
            conn.commit()
            # 截断: 保留最近 1000 条
            count = conn.execute("SELECT COUNT(*) FROM backfill_events").fetchone()[0]
            if count > 1500:  # 留余量
                conn.execute(
                    """
                    DELETE FROM backfill_events
                    WHERE id NOT IN (
                        SELECT id FROM backfill_events ORDER BY id DESC LIMIT 1000
                    )
                """
                )
                conn.commit()
                # 截断后重新统计
                count = conn.execute("SELECT COUNT(*) FROM backfill_events").fetchone()[0]
            _set_tail_count(count)
            _inc_write("append_event", "success")
        except Exception:
            _inc_write("append_event", "failed")
            raise
        finally:
            conn.close()
            _set_db_bytes(self._db_path)

    def load_events(self, limit: int = 1000) -> list[BackfillEvent]:
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT event_type, table_name, tenant_id, processed, total, percent, eta_seconds, error, ts "
                "FROM backfill_events ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            # 反转成时序顺序
            rows = list(reversed(rows))
            events: list[BackfillEvent] = []
            for r in rows:
                ev_type, table, tid, proc, total, pct, eta, err, ts = r
                try:
                    et = BackfillEventType(ev_type)
                except ValueError:
                    et = BackfillEventType.HEARTBEAT
                events.append(
                    BackfillEvent(
                        event_type=et,
                        table=table,
                        tenant_id=tid,
                        processed=proc,
                        total=total,
                        percent=pct,
                        eta_seconds=eta,
                        error=err or "",
                        timestamp=ts,
                    )
                )
            return events
        finally:
            conn.close()

    def clear(self) -> None:
        conn = self._connect()
        try:
            conn.execute("DELETE FROM backfill_snapshot")
            conn.execute("DELETE FROM backfill_events")
            conn.commit()
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# 工厂
# ---------------------------------------------------------------------------

DEFAULT_PERSISTER_PATH = os.environ.get(
    "BACKFILL_PERSISTER_PATH",
    "backfill_state.db",
)


def create_persister(backend: str = "sqlite", **kwargs) -> BackfillPersister:
    """工厂: 创建持久化器.

    Args:
        backend: "sqlite" | "file"
        kwargs: 传给具体后端
            sqlite: db_path
            file: file_path
    """
    if backend == "sqlite":
        return SQLiteBackfillPersister(
            db_path=kwargs.get("db_path", DEFAULT_PERSISTER_PATH),
        )
    elif backend == "file":
        return FileBackfillPersister(
            file_path=kwargs.get("file_path", DEFAULT_PERSISTER_PATH),
        )
    else:
        raise ValueError(f"unknown backend: {backend}")
