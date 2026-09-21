# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Memory Sweeper — 长期记忆的 SQLite 存储 + 记忆清扫策略引擎。

对标 Codex / Claude Code 的长期记忆衰减与清扫机制(2026-09-13 立):
- 每条记忆(memory)带 `importance` 权重(0~1)与 `last_accessed_at` 时间戳;
- 访问某记忆时 bump 其热度(importance += boost,有上限)+ 访问计数;
- sweep(清扫)按策略淘汰过期/低价值记忆:
    * 时间衰减:created_at 超过 `max_age_days` 且 importance 低于 `min_importance`
      的记忆标记为 swept;
    * 容量上限:某用户未 sweep 记忆数超过 `max_memories_per_user` 时,
      按 (importance ASC, last_accessed_at ASC) 排序淘汰最冷(最久未访问 + 最低
      importance)的溢出部分;
- 被 sweep 的记忆**软删除**(swept=1 + swept_at + swept_reason),保留审计可查;
  被 sweep 的记忆再次 access 时自动"复活"(swept=0),体现"被再次需要则保留"。

设计要点(对齐 session_store.py 的 SQLite 模式):
- 纯标准库 sqlite3:WAL + synchronous=FULL + busy_timeout + foreign_keys=ON;
- threading.RLock + BEGIN IMMEDIATE 每条写操作独立事务(崩溃安全);
- 数据文件默认落在 <ai-service>/data/memory_sweeper.db(可配置 db_path);
- 模块导出单例获取器 `get_memory_sweeper()`,路由层直接调用;SQLite 连接惰性
  初始化,close() 幂等,可在 lifespan shutdown 显式调用(不强制)。
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_DEFAULT_DB_PATH = str(_DATA_DIR / "memory_sweeper.db")

_SCHEMA_V1 = """
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  REAL    NOT NULL,
    description TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS memories (
    memory_id        TEXT    PRIMARY KEY,
    user_id          TEXT    NOT NULL,
    content          TEXT    NOT NULL,
    importance       REAL    NOT NULL DEFAULT 0.5,
    access_count     INTEGER NOT NULL DEFAULT 0,
    created_at       REAL    NOT NULL,
    last_accessed_at REAL    NOT NULL,
    swept            INTEGER NOT NULL DEFAULT 0,
    swept_at         REAL,
    swept_reason     TEXT,
    metadata         TEXT    NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, swept, last_accessed_at DESC);

CREATE TABLE IF NOT EXISTS sweep_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT    NOT NULL,
    swept_count INTEGER NOT NULL,
    strategy    TEXT    NOT NULL DEFAULT '{}',
    created_at  REAL    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sweep_logs_user ON sweep_logs(user_id, created_at DESC);
"""


def _now() -> float:
    return time.time()


def _json_dict(raw: Any) -> dict[str, Any]:
    data = json.loads(raw) if isinstance(raw, str) else raw
    return data if isinstance(data, dict) else {}


class MemorySweeper:
    """长期记忆存储 + 清扫策略引擎(纯 sqlite3 实现,对齐 session_store 模式)。"""

    SCHEMA_VERSION = 1

    def __init__(
        self,
        db_path: str | Path = _DEFAULT_DB_PATH,
        *,
        busy_timeout_ms: int = 5000,
        synchronous: str = "FULL",
        max_age_days: int = 30,
        min_importance: float = 0.2,
        max_memories_per_user: int = 500,
    ) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._closed = False
        self._conn = sqlite3.connect(
            str(self._path),
            check_same_thread=False,
            isolation_level=None,
        )
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(f"PRAGMA busy_timeout={int(busy_timeout_ms)}")
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(f"PRAGMA synchronous={synchronous}")
        self._conn.execute("PRAGMA foreign_keys=ON")

        # 清扫策略默认参数(保守:30 天 + importance<0.2 才判过期;每用户 500 条软上限)
        self._max_age_days = int(max_age_days)
        self._min_importance = float(min_importance)
        self._max_memories_per_user = int(max_memories_per_user)

        self._migrate()

    # ==================== Lifecycle ====================

    @property
    def db_path(self) -> Path:
        return self._path

    @property
    def closed(self) -> bool:
        return self._closed

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            self._conn.close()

    def __enter__(self) -> MemorySweeper:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ==================== Migration ====================

    def _migrate(self) -> None:
        with self._lock:
            self._conn.executescript(_SCHEMA_V1)
            if not self._has_version(1):
                self._add_version(1, "baseline: memories + sweep_logs")

    def _has_version(self, version: int) -> bool:
        row = self._conn.execute(
            "SELECT 1 AS x FROM schema_version WHERE version = ?", (version,)
        ).fetchone()
        return row is not None

    def _add_version(self, version: int, description: str) -> None:
        self._conn.execute(
            "INSERT INTO schema_version (version, applied_at, description) VALUES (?,?,?)",
            (version, _now(), description),
        )

    # ==================== Memory CRUD ====================

    def add_memory(
        self,
        user_id: str,
        content: str,
        *,
        importance: float = 0.5,
        memory_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """写入一条记忆,返回落库后的完整记录。importance 自动夹在 [0,1]。"""
        mid = memory_id or uuid.uuid4().hex
        importance = min(1.0, max(0.0, float(importance)))
        now = _now()
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO memories (memory_id, user_id, content, importance,"
                " access_count, created_at, last_accessed_at, swept, swept_at,"
                " swept_reason, metadata)"
                " VALUES (?,?,?,?,0,?,?,0,?,?,?)",
                (
                    mid,
                    user_id,
                    content,
                    importance,
                    now,
                    now,
                    None,
                    None,
                    json.dumps(metadata or {}, ensure_ascii=False),
                ),
            )
        return {
            "memory_id": mid,
            "user_id": user_id,
            "content": content,
            "importance": importance,
            "access_count": 0,
            "created_at": now,
            "last_accessed_at": now,
            "swept": False,
            "swept_at": None,
            "swept_reason": None,
            "metadata": dict(metadata or {}),
        }

    def access_memory(
        self, memory_id: str, *, boost: float = 0.05
    ) -> dict[str, Any] | None:
        """访问某记忆:计数 +1,热度提升(importance += boost,上限 1.0)。

        若该记忆已被 sweep(软删除),再次访问自动复活(swept=0)。
        返回刷新后的记录;记忆不存在返回 None。
        """
        now = _now()
        with self._tx() as conn:
            row = conn.execute(
                "SELECT * FROM memories WHERE memory_id = ?", (memory_id,)
            ).fetchone()
            if row is None:
                return None
            new_importance = min(1.0, float(row["importance"]) + float(boost))
            conn.execute(
                "UPDATE memories SET access_count = access_count + 1,"
                " last_accessed_at = ?, importance = ? WHERE memory_id = ?",
                (now, new_importance, memory_id),
            )
            if row["swept"]:
                conn.execute(
                    "UPDATE memories SET swept = 0, swept_at = NULL, swept_reason = NULL"
                    " WHERE memory_id = ?",
                    (memory_id,),
                )
        return self.get_memory(memory_id)

    def get_memory(self, memory_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM memories WHERE memory_id = ?", (memory_id,)
            ).fetchone()
        return self._row_to_memory(row) if row else None

    def list_memories(
        self,
        user_id: str,
        *,
        include_swept: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """列出某用户的记忆(默认仅未 sweep 的,按 last_accessed_at 倒序)。"""
        where = " WHERE user_id = ?"
        if not include_swept:
            where += " AND swept = 0"
        with self._lock:
            total_row = self._conn.execute(
                f"SELECT COUNT(*) AS c FROM memories{where}", (user_id,)
            ).fetchone()
            rows = self._conn.execute(
                f"SELECT * FROM memories{where} ORDER BY last_accessed_at DESC"
                " LIMIT ? OFFSET ?",
                (user_id, max(0, int(limit)), max(0, int(offset))),
            ).fetchall()
        total = int(total_row["c"]) if total_row else 0
        return {
            "memories": [self._row_to_memory(r) for r in rows],
            "total": total,
            "limit": int(limit),
            "offset": int(offset),
            "has_more": offset + len(rows) < total,
        }

    # ==================== Sweep 策略 ====================

    def sweep(
        self,
        user_id: str,
        *,
        max_age_days: int | None = None,
        min_importance: float | None = None,
        max_memories_per_user: int | None = None,
        dry_run: bool = False,
    ) -> dict[str, Any]:
        """对某用户执行一次记忆清扫,返回清扫报告。

        两层策略(命中即软删除,reason 标注来源):
        1. 过期 + 低价值:created_at < now - max_age_days 且 importance < min_importance
           → swept_reason='stale_low_importance';
        2. 容量溢出:未 sweep 记忆数 - 第 1 层已淘汰数 仍 > max_memories_per_user 时,
           按 (importance ASC, last_accessed_at ASC) 淘汰最冷的溢出部分
           → swept_reason='capacity_overflow'。
        dry_run=true 时只统计 would_sweep,不落库;正常落库时写入 sweep_logs 审计。
        """
        age_days = int(max_age_days) if max_age_days is not None else self._max_age_days
        min_imp = (
            float(min_importance)
            if min_importance is not None
            else self._min_importance
        )
        cap = (
            int(max_memories_per_user)
            if max_memories_per_user is not None
            else self._max_memories_per_user
        )
        now = _now()
        age_cutoff = now - age_days * 86400

        stale_ids: list[str] = []
        overflow_ids: list[str] = []
        unswept = 0
        strategy_payload = json.dumps(
            {
                "max_age_days": age_days,
                "min_importance": min_imp,
                "max_memories_per_user": cap,
            },
            ensure_ascii=False,
        )

        with self._tx() as conn:
            cnt_row = conn.execute(
                "SELECT COUNT(*) AS c FROM memories WHERE user_id = ? AND swept = 0",
                (user_id,),
            ).fetchone()
            unswept = int(cnt_row["c"]) if cnt_row else 0

            stale_ids = [
                str(r["memory_id"])
                for r in conn.execute(
                    "SELECT memory_id FROM memories WHERE user_id = ? AND swept = 0"
                    " AND created_at < ? AND importance < ?",
                    (user_id, age_cutoff, min_imp),
                ).fetchall()
            ]
            remaining_after_stale = unswept - len(stale_ids)
            if remaining_after_stale > cap:
                overflow_ids = [
                    str(r["memory_id"])
                    for r in conn.execute(
                        "SELECT memory_id FROM memories WHERE user_id = ? AND swept = 0"
                        " AND created_at >= ? AND importance >= ?"
                        " ORDER BY importance ASC, last_accessed_at ASC LIMIT ?",
                        (user_id, age_cutoff, min_imp, remaining_after_stale - cap),
                    ).fetchall()
                ]

            swept_ids = list(dict.fromkeys(stale_ids + overflow_ids))
            reason_by_id: dict[str, str] = {}
            for mid in stale_ids:
                reason_by_id[mid] = "stale_low_importance"
            for mid in overflow_ids:
                reason_by_id[mid] = "capacity_overflow"

            if swept_ids and not dry_run:
                for mid in swept_ids:
                    conn.execute(
                        "UPDATE memories SET swept = 1, swept_at = ?, swept_reason = ?"
                        " WHERE memory_id = ? AND swept = 0",
                        (now, reason_by_id.get(mid, "stale_low_importance"), mid),
                    )
                conn.execute(
                    "INSERT INTO sweep_logs (user_id, swept_count, strategy, created_at)"
                    " VALUES (?,?,?,?)",
                    (user_id, len(swept_ids), strategy_payload, now),
                )

        return {
            "user_id": user_id,
            "dry_run": bool(dry_run),
            "unswept_before": unswept,
            "would_sweep": len(swept_ids),
            "swept": 0 if dry_run else len(swept_ids),
            "swept_ids": swept_ids,
            "strategy": {
                "max_age_days": age_days,
                "min_importance": min_imp,
                "max_memories_per_user": cap,
            },
            "swept_at": None if dry_run else now,
        }

    def recent_sweeps(self, user_id: str, *, limit: int = 20) -> list[dict[str, Any]]:
        """列出某用户最近的清扫日志(created_at 倒序)。"""
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM sweep_logs WHERE user_id = ?"
                " ORDER BY created_at DESC LIMIT ?",
                (user_id, max(0, int(limit))),
            ).fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            out.append(
                {
                    "id": int(r["id"]),
                    "user_id": str(r["user_id"]),
                    "swept_count": int(r["swept_count"]),
                    "strategy": _json_dict(r["strategy"]),
                    "created_at": float(r["created_at"]),
                }
            )
        return out

    # ==================== 内部 ====================

    @staticmethod
    def _row_to_memory(row: sqlite3.Row) -> dict[str, Any]:
        return {
            "memory_id": str(row["memory_id"]),
            "user_id": str(row["user_id"]),
            "content": str(row["content"]),
            "importance": float(row["importance"]),
            "access_count": int(row["access_count"]),
            "created_at": float(row["created_at"]),
            "last_accessed_at": float(row["last_accessed_at"]),
            "swept": bool(row["swept"]),
            "swept_at": None if row["swept_at"] is None else float(row["swept_at"]),
            "swept_reason": None
            if row["swept_reason"] is None
            else str(row["swept_reason"]),
            "metadata": _json_dict(row["metadata"]),
        }

    @contextmanager
    def _tx(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            self._conn.execute("BEGIN IMMEDIATE")
            try:
                yield self._conn
            except BaseException:
                self._conn.execute("ROLLBACK")
                raise
            self._conn.execute("COMMIT")


# ==================== 单例 ====================

_sweeper: MemorySweeper | None = None
_sweeper_lock = threading.Lock()


def get_memory_sweeper() -> MemorySweeper:
    """获取全局 MemorySweeper 单例(惰性初始化,线程安全)。"""
    global _sweeper
    if _sweeper is None:
        with _sweeper_lock:
            if _sweeper is None:
                _sweeper = MemorySweeper(_DEFAULT_DB_PATH)
    return _sweeper


__all__ = [
    "MemorySweeper",
    "get_memory_sweeper",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
