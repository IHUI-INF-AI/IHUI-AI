"""Phase 11 建议 1: OIDC Vault 审计日志持久化.

目的:
  原 _AUDIT_LOG 是内存 list, 重启即丢
  这里用 SQLite 持久化, 支持:
  1. append 写入
  2. query 过滤 (since/provider/github_sub)
  3. count / truncate
  4. 多进程安全 (WAL 模式)
  5. 线程安全 (同连接串行写)

用法:
  from oidc_vault_audit import AuditStore
  store = AuditStore("logs/oidc_vault_audit.db")
  store.append({"ts": "...", "github_sub": "repo:owner/x:ref:refs/heads/main",
                "provider": "grafana", "ttl_min": 30, "client_ip": "1.2.3.4"})
  rows = store.query(provider="grafana", since="2026-06-16T00:00:00Z")
"""

from __future__ import annotations

import json
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any


class AuditStore:
    """SQLite 持久化审计存储."""

    def __init__(self, db_path: str | Path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_schema()

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=5.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._conn() as c, self._lock:
            c.execute("PRAGMA journal_mode=WAL")
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT NOT NULL,
                    github_sub TEXT,
                    provider TEXT,
                    ttl_min INTEGER,
                    client_ip TEXT,
                    action TEXT DEFAULT 'exchange',
                    raw_json TEXT
                )
            """
            )
            c.execute("CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts)")
            c.execute("CREATE INDEX IF NOT EXISTS idx_audit_provider ON audit_log(provider)")
            c.commit()

    def append(self, entry: dict[str, Any]) -> int:
        """追加一条审计, 返回 id."""
        ts = entry.get("ts", "")
        github_sub = entry.get("github_sub", "")
        provider = entry.get("provider", "")
        ttl_min = int(entry.get("ttl_min", 0))
        client_ip = entry.get("client_ip", "")
        action = entry.get("action", "exchange")
        raw_json = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
        with self._conn() as c, self._lock:
            cur = c.execute(
                "INSERT INTO audit_log (ts, github_sub, provider, ttl_min, client_ip, action, raw_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ts, github_sub, provider, ttl_min, client_ip, action, raw_json),
            )
            c.commit()
            return int(cur.lastrowid or 0)

    def query(
        self,
        provider: str | None = None,
        since: str | None = None,
        until: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """查询审计日志."""
        clauses = []
        params: list[Any] = []
        if provider:
            clauses.append("provider = ?")
            params.append(provider)
        if since:
            clauses.append("ts >= ?")
            params.append(since)
        if until:
            clauses.append("ts <= ?")
            params.append(until)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = f"SELECT * FROM audit_log {where} ORDER BY id DESC LIMIT ?"
        params.append(limit)
        with self._conn() as c:
            rows = c.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

    def count(self, provider: str | None = None) -> int:
        """统计行数."""
        with self._conn() as c:
            if provider:
                row = c.execute("SELECT COUNT(*) AS n FROM audit_log WHERE provider = ?", (provider,)).fetchone()
            else:
                row = c.execute("SELECT COUNT(*) AS n FROM audit_log").fetchone()
            return int(row["n"] or 0)

    def truncate(self) -> None:
        """清空 (测试用)."""
        with self._conn() as c, self._lock:
            c.execute("DELETE FROM audit_log")
            c.commit()
