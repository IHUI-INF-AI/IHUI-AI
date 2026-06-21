"""Canary 阶段事件审计落库 (建议 151) - app/canary_audit_store.py.

设计:
  - 持久化所有 canary 阶段变化事件 + promoter 决策 + 人工 override
  - 来源: 'controller' (CanaryStageController) / 'promoter' (CanaryAutoPromoter 决策) /
          'override' (人工 override 操作)
  - 存储: SQLite + WAL (复用 148 的模式, 跨进程安全)
  - 保留期: 默认 1 年 (可配置), 自动清理
  - 失败隔离: 写库失败不影响主流程

Schema:
    CREATE TABLE canary_audit (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        ts          REAL NOT NULL,        -- 时间戳
        source      TEXT NOT NULL,        -- controller / promoter / override
        action      TEXT NOT NULL,        -- promote / rollback / auto_rollback / pause / resume / force_promote / force_rollback / promote_dry_run / ...
        from_stage  TEXT,                -- 原阶段 (NULL=初始)
        to_stage    TEXT,                -- 目标阶段
        actor       TEXT NOT NULL,        -- 操作者 (admin / auto-promoter / system / admin_xxx)
        reason      TEXT,                -- 原因
        detail      TEXT,                -- 额外 JSON
        created_at  TEXT NOT NULL         -- 落库 ISO 时间
    );
    CREATE INDEX idx_canary_audit_ts ON canary_audit(ts DESC);
    CREATE INDEX idx_canary_audit_source ON canary_audit(source, ts DESC);

用法:
    from app.canary_audit_store import get_default_audit_store

    store = get_default_audit_store()
    store.append(
        source="controller",
        action="promote",
        from_stage="0%",
        to_stage="1%",
        actor="admin",
        reason="测试",
    )
    items = store.query(limit=100, source="override")
"""

from __future__ import annotations

import contextlib
import json
import logging
import os
import sqlite3
import threading
import time
from datetime import UTC, datetime

try:
    from app.canary_metrics import (
        CANARY_AUDIT_RETENTION_CLEANED,
        CANARY_AUDIT_ROWS,
        CANARY_AUDIT_WRITES,
    )
except Exception:
    CANARY_AUDIT_WRITES = None
    CANARY_AUDIT_RETENTION_CLEANED = None
    CANARY_AUDIT_ROWS = None

logger = logging.getLogger(__name__)
DEFAULT_DB_PATH = os.environ.get("ZHS_CANARY_AUDIT_DB", "canary_audit.db")
DEFAULT_RETENTION_DAYS = 365  # 1 年


def _inc_write(result: str) -> None:
    if CANARY_AUDIT_WRITES is None:
        return
    with contextlib.suppress(Exception):
        CANARY_AUDIT_WRITES.labels(result=result).inc()


def _inc_retention(n: int) -> None:
    if CANARY_AUDIT_RETENTION_CLEANED is None or n <= 0:
        return
    with contextlib.suppress(Exception):
        CANARY_AUDIT_RETENTION_CLEANED.inc(n)


def _set_rows(value: int) -> None:
    if CANARY_AUDIT_ROWS is None:
        return
    with contextlib.suppress(Exception):
        CANARY_AUDIT_ROWS.set(value)


# ---------------------------------------------------------------------------
# 数据访问层 (单例 + 线程锁, 写库串行化避免锁冲突)
# ---------------------------------------------------------------------------


class CanaryAuditStore:
    """Canary 审计 SQLite 存储."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH, retention_days: int = DEFAULT_RETENTION_DAYS):
        self._db_path = db_path
        self._retention_days = retention_days
        self._lock = threading.Lock()
        self._init_schema()

    def _init_schema(self) -> None:
        """建表 + 索引 (幂等)."""
        with self._lock:
            conn = sqlite3.connect(self._db_path, timeout=10.0)
            try:
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS canary_audit (
                        id          INTEGER PRIMARY KEY AUTOINCREMENT,
                        ts          REAL NOT NULL,
                        source      TEXT NOT NULL,
                        action      TEXT NOT NULL,
                        from_stage  TEXT,
                        to_stage    TEXT,
                        actor       TEXT NOT NULL,
                        reason      TEXT,
                        detail      TEXT,
                        created_at  TEXT NOT NULL
                    )
                """
                )
                conn.execute("CREATE INDEX IF NOT EXISTS idx_canary_audit_ts ON canary_audit(ts DESC)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_canary_audit_source ON canary_audit(source, ts DESC)")
                conn.commit()
            finally:
                conn.close()

    def append(
        self,
        source: str,
        action: str,
        actor: str,
        from_stage: str | None = None,
        to_stage: str | None = None,
        reason: str = "",
        detail: dict | None = None,
        ts: float | None = None,
    ) -> int:
        """追加一条审计. 失败返回 -1, 不抛异常 (写库失败不影响主流程)."""
        ts = ts if ts is not None else time.time()
        created_at = datetime.now(UTC).isoformat()
        detail_json = json.dumps(detail, ensure_ascii=False) if detail else None
        rid = -1
        try:
            with self._lock:
                conn = sqlite3.connect(self._db_path, timeout=10.0)
                try:
                    cur = conn.execute(
                        """INSERT INTO canary_audit
                           (ts, source, action, from_stage, to_stage, actor, reason, detail, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (ts, source, action, from_stage, to_stage, actor, reason, detail_json, created_at),
                    )
                    conn.commit()
                    rid = cur.lastrowid or -1
                    # 统计行数 (轻量查询)
                    try:
                        cnt = conn.execute("SELECT COUNT(*) FROM canary_audit").fetchone()[0]
                        _set_rows(int(cnt))
                    except Exception:
                        pass
                finally:
                    conn.close()
        except Exception as e:
            logger.debug(f"canary_audit append failed: {e}")
            _inc_write("failed")
            return -1
        if rid > 0:
            _inc_write("success")
        return rid

    def query(
        self,
        limit: int = 100,
        source: str | None = None,
        action: str | None = None,
        since_ts: float | None = None,
        until_ts: float | None = None,
    ) -> list[dict]:
        """查询审计日志 (按时间倒序)."""
        sql = "SELECT id, ts, source, action, from_stage, to_stage, actor, reason, detail, created_at FROM canary_audit"
        params: list = []
        conds: list[str] = []
        if source:
            conds.append("source = ?")
            params.append(source)
        if action:
            conds.append("action = ?")
            params.append(action)
        if since_ts is not None:
            conds.append("ts >= ?")
            params.append(since_ts)
        if until_ts is not None:
            conds.append("ts <= ?")
            params.append(until_ts)
        if conds:
            sql += " WHERE " + " AND ".join(conds)
        sql += " ORDER BY ts DESC LIMIT ?"
        params.append(max(1, min(limit, 1000)))
        try:
            conn = sqlite3.connect(self._db_path, timeout=10.0)
            try:
                rows = conn.execute(sql, params).fetchall()
                items = []
                for r in rows:
                    items.append(
                        {
                            "id": r[0],
                            "ts": r[1],
                            "source": r[2],
                            "action": r[3],
                            "from_stage": r[4],
                            "to_stage": r[5],
                            "actor": r[6],
                            "reason": r[7],
                            "detail": json.loads(r[8]) if r[8] else None,
                            "created_at": r[9],
                        }
                    )
                return items
            finally:
                conn.close()
        except Exception as e:
            logger.debug(f"canary_audit query failed: {e}")
            return []

    def count(self, source: str | None = None) -> int:
        """总数 (调试用)."""
        sql = "SELECT COUNT(*) FROM canary_audit"
        params: list = []
        if source:
            sql += " WHERE source = ?"
            params.append(source)
        try:
            conn = sqlite3.connect(self._db_path, timeout=10.0)
            try:
                row = conn.execute(sql, params).fetchone()
                return int(row[0]) if row else 0
            finally:
                conn.close()
        except Exception:
            return 0

    def cleanup_expired(self) -> int:
        """清理超过 retention_days 的记录. 返回清理条数. 失败返回 0."""
        cutoff = time.time() - self._retention_days * 24 * 3600
        try:
            with self._lock:
                conn = sqlite3.connect(self._db_path, timeout=10.0)
                try:
                    cur = conn.execute("DELETE FROM canary_audit WHERE ts < ?", (cutoff,))
                    conn.commit()
                    deleted = cur.rowcount
                    try:
                        cnt = conn.execute("SELECT COUNT(*) FROM canary_audit").fetchone()[0]
                        _set_rows(int(cnt))
                    except Exception:
                        pass
                    _inc_retention(deleted)
                    return deleted
                finally:
                    conn.close()
        except Exception as e:
            logger.debug(f"canary_audit cleanup failed: {e}")
            return 0

    def clear(self) -> None:
        """测试用: 清空表."""
        with self._lock:
            conn = sqlite3.connect(self._db_path, timeout=10.0)
            try:
                conn.execute("DELETE FROM canary_audit")
                conn.commit()
                _set_rows(0)
            finally:
                conn.close()


# ---------------------------------------------------------------------------
# 全局默认实例
# ---------------------------------------------------------------------------

_DEFAULT_STORE: CanaryAuditStore | None = None
_STORE_LOCK = threading.Lock()


def get_default_audit_store(db_path: str | None = None, retention_days: int | None = None) -> CanaryAuditStore:
    """获取/创建默认 audit store."""
    global _DEFAULT_STORE
    with _STORE_LOCK:
        if _DEFAULT_STORE is None:
            _DEFAULT_STORE = CanaryAuditStore(
                db_path=db_path or DEFAULT_DB_PATH,
                retention_days=retention_days if retention_days is not None else DEFAULT_RETENTION_DAYS,
            )
        return _DEFAULT_STORE


def set_default_audit_store(store: CanaryAuditStore) -> None:
    """测试用: 注入自定义 store."""
    global _DEFAULT_STORE
    with _STORE_LOCK:
        _DEFAULT_STORE = store


def reset_default_audit_store() -> None:
    """测试用: 重置默认 store."""
    global _DEFAULT_STORE
    with _STORE_LOCK:
        _DEFAULT_STORE = None
