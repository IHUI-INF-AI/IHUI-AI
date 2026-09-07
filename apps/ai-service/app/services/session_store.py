# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Codex 级（更完整）agent 会话持久化引擎 —— 纯标准库 sqlite3 实现。

三级会话模型:Thread（跨进程持久会话）/ Turn（一次用户输入触发的完整往返）/
Item（回合内原子事件）。

设计要点(2026-09-06 立):
- 崩溃安全:WAL + synchronous=FULL + 每条写操作独立 BEGIN IMMEDIATE 事务;
- 全局单调 seq + client_item_id 幂等去重;
- FTS5 全文索引(不可用时自动降级 LIKE);
- JSON1 半结构化 payload;
- 版本化 migration 框架(schema_version 表 + 顺序迁移);
- turn 状态机:running → completed/interrupted/failed,非法迁移拒绝;
- resume 时自动修复悬挂 tool_call(补 synthetic interrupted result);
- fork 从某 item 处分支出新 thread,复制前缀;
- rollback 软删除标记,保留审计;
- compact 压缩边界 item,resume 时只回放边界后内容+摘要。

mypy --strict 通过;仅依赖标准库 sqlite3 + pydantic(项目已有)。
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Literal, cast

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

# ==================== Item 类型族 ====================

ITEM_ENVELOPE_FIELDS: frozenset[str] = frozenset(
    {"seq", "thread_id", "turn_id", "parent_seq", "created_at", "item_type", "client_item_id"}
)


class ItemBase(BaseModel):
    """所有 Item 的公共信封。"""

    model_config = ConfigDict(extra="forbid")

    seq: int = 0
    thread_id: str = ""
    turn_id: str | None = None
    parent_seq: int | None = None
    created_at: float = Field(default_factory=time.time)
    client_item_id: str | None = None  # 客户端提供的幂等键
    item_type: str

    def search_text(self) -> str:
        return ""

    def body_payload(self) -> dict[str, Any]:
        return self.model_dump(mode="json", exclude=set(ITEM_ENVELOPE_FIELDS))


class UserMessageItem(ItemBase):
    item_type: Literal["user_message"] = "user_message"
    content: str = ""

    def search_text(self) -> str:
        return self.content


class AgentMessageItem(ItemBase):
    item_type: Literal["agent_message"] = "agent_message"
    content: str = ""
    model: str | None = None

    def search_text(self) -> str:
        return self.content


class ReasoningItem(ItemBase):
    item_type: Literal["reasoning"] = "reasoning"
    content: str = ""
    summary: str | None = None

    def search_text(self) -> str:
        return self.summary or self.content


class ToolCallItem(ItemBase):
    item_type: Literal["tool_call"] = "tool_call"
    call_id: str = ""
    tool: str = ""
    arguments: dict[str, Any] = Field(default_factory=dict)

    def search_text(self) -> str:
        return f"{self.tool} {self.arguments}"


class ToolResultItem(ItemBase):
    item_type: Literal["tool_result"] = "tool_result"
    call_id: str = ""
    ok: bool = True
    output: str = ""
    error: str | None = None

    def search_text(self) -> str:
        return self.output if self.ok else (self.error or self.output)


class FileEditItem(ItemBase):
    item_type: Literal["file_edit"] = "file_edit"
    path: str = ""
    op: Literal["create", "update", "delete"] = "update"
    before: str | None = None
    after: str | None = None
    diff: str | None = None

    def search_text(self) -> str:
        return self.path


class ApprovalRequestItem(ItemBase):
    item_type: Literal["approval_request"] = "approval_request"
    request_id: str = ""
    tool: str = ""
    arguments: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""

    def search_text(self) -> str:
        return f"{self.tool} {self.reason}"


class ApprovalResponseItem(ItemBase):
    item_type: Literal["approval_response"] = "approval_response"
    request_id: str = ""
    approved: bool = False
    decided_by: str = "user"
    comment: str | None = None

    def search_text(self) -> str:
        return self.comment or ""


class ErrorItem(ItemBase):
    """错误事件。"""

    item_type: Literal["error"] = "error"
    message: str = ""
    code: str | None = None

    def search_text(self) -> str:
        return self.message


class CompactionBoundaryItem(ItemBase):
    """压缩边界:此前条目被 summary 取代。"""

    item_type: Literal["compaction_boundary"] = "compaction_boundary"
    summary: str = ""
    first_seq: int = 0
    tokens_before: int = 0
    tokens_after: int = 0

    def search_text(self) -> str:
        return self.summary


Item = (
    UserMessageItem
    | AgentMessageItem
    | ReasoningItem
    | ToolCallItem
    | ToolResultItem
    | FileEditItem
    | ApprovalRequestItem
    | ApprovalResponseItem
    | ErrorItem
    | CompactionBoundaryItem
)

ItemKind = Literal[
    "user_message",
    "agent_message",
    "reasoning",
    "tool_call",
    "tool_result",
    "file_edit",
    "approval_request",
    "approval_response",
    "error",
    "compaction_boundary",
]

ITEM_ADAPTER: TypeAdapter[Any] = TypeAdapter(
    UserMessageItem
    | AgentMessageItem
    | ReasoningItem
    | ToolCallItem
    | ToolResultItem
    | FileEditItem
    | ApprovalRequestItem
    | ApprovalResponseItem
    | ErrorItem
    | CompactionBoundaryItem
)

ForkMode = Literal["shared", "copy"]
TurnStatus = Literal["running", "completed", "interrupted", "failed"]

# 合法状态迁移表
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "running": {"completed", "interrupted", "failed"},
    "completed": set(),
    "interrupted": set(),
    "failed": set(),
}


# ==================== Thread / Turn / 辅助模型 ====================


class Turn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    turn_id: str
    thread_id: str
    turn_seq: int
    status: TurnStatus = "running"
    started_at: float = Field(default_factory=time.time)
    ended_at: float | None = None
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class Thread(BaseModel):
    model_config = ConfigDict(extra="forbid")

    thread_id: str
    title: str = ""
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)
    metadata: dict[str, Any] = Field(default_factory=dict)
    parent_thread_id: str | None = None
    fork_point_seq: int | None = None
    fork_mode: ForkMode | None = None
    archived: bool = False
    item_count: int = 0
    last_seq: int | None = None


class ThreadPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    threads: list[Thread] = Field(default_factory=list)
    total: int = 0
    limit: int = 0
    offset: int = 0
    has_more: bool = False


class SearchHit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    seq: int
    thread_id: str
    item_type: ItemKind
    snippet: str
    score: float | None = None


class LLMMessage(BaseModel):
    """OpenAI 风格消息(replay 出口)。"""

    model_config = ConfigDict(extra="allow")

    role: str
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    tool_call_id: str | None = None
    name: str | None = None


# ==================== 异常 ====================


class ThreadNotFoundError(KeyError):
    pass


class TurnNotFoundError(KeyError):
    pass


class TurnMismatchError(ValueError):
    pass


class InvalidTurnTransitionError(ValueError):
    """非法 turn 状态迁移。"""

    pass


class DuplicateItemError(ValueError):
    """client_item_id 重复(幂等去重)。"""

    pass


# ==================== Schema DDL ====================

_SCHEMA_V1 = """
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    applied_at  REAL    NOT NULL,
    description TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta (key, value) VALUES ('last_seq', '0');

CREATE TABLE IF NOT EXISTS threads (
    thread_id         TEXT    PRIMARY KEY,
    title             TEXT    NOT NULL DEFAULT '',
    created_at        REAL    NOT NULL,
    updated_at        REAL    NOT NULL,
    metadata          TEXT    NOT NULL DEFAULT '{}',
    parent_thread_id  TEXT,
    fork_point_seq    INTEGER,
    fork_mode         TEXT,
    archived          INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (parent_thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updated_at DESC);

CREATE TABLE IF NOT EXISTS turns (
    turn_id    TEXT    PRIMARY KEY,
    thread_id  TEXT    NOT NULL,
    turn_seq   INTEGER NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'running',
    started_at REAL    NOT NULL,
    ended_at   REAL,
    error      TEXT,
    metadata   TEXT    NOT NULL DEFAULT '{}',
    UNIQUE(thread_id, turn_seq),
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_turns_thread ON turns(thread_id, turn_seq);

CREATE TABLE IF NOT EXISTS items (
    seq            INTEGER PRIMARY KEY,
    thread_id      TEXT    NOT NULL,
    turn_id        TEXT,
    parent_seq     INTEGER,
    item_type      TEXT    NOT NULL,
    created_at     REAL    NOT NULL,
    payload        TEXT    NOT NULL,
    search_text    TEXT    NOT NULL DEFAULT '',
    client_item_id TEXT,
    content_hash   TEXT,
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id),
    FOREIGN KEY (turn_id) REFERENCES turns(turn_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_client_id
    ON items(client_item_id) WHERE client_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_thread ON items(thread_id, seq);
CREATE INDEX IF NOT EXISTS idx_items_turn ON items(turn_id, seq);

CREATE TABLE IF NOT EXISTS rollbacks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id    TEXT    NOT NULL,
    to_seq       INTEGER NOT NULL,
    reason       TEXT    NOT NULL DEFAULT '',
    created_at   REAL    NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_rollbacks_thread ON rollbacks(thread_id, to_seq DESC);
"""

_FTS5_DDL = """
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    search_text,
    seq UNINDEXED,
    thread_id UNINDEXED,
    item_type UNINDEXED,
    tokenize='unicode61'
);
"""


_RELAY_DDL = """
CREATE TABLE IF NOT EXISTS relay_summaries (
    summary_id      TEXT    PRIMARY KEY,
    thread_id       TEXT    NOT NULL,
    prev_thread_id  TEXT,
    objective       TEXT    NOT NULL DEFAULT '',
    payload         TEXT    NOT NULL,
    refined         INTEGER NOT NULL DEFAULT 0,
    created_at      REAL    NOT NULL,
    FOREIGN KEY (thread_id) REFERENCES threads(thread_id)
);
CREATE INDEX IF NOT EXISTS idx_relay_thread ON relay_summaries(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relay_created ON relay_summaries(created_at DESC);
"""


# ==================== 工具函数 ====================


def _now() -> float:
    return time.time()


def _content_hash(item: ItemBase) -> str:
    """基于 item_type + body_payload 的内容哈希(用于去重辅助)。"""
    raw = json.dumps(item.body_payload(), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _row_str(row: sqlite3.Row, key: str) -> str:
    return str(row[key])


def _row_float(row: sqlite3.Row, key: str) -> float:
    return float(row[key])


def _row_int(row: sqlite3.Row, key: str) -> int:
    return int(row[key])


def _row_opt_int(row: sqlite3.Row, key: str) -> int | None:
    v = row[key]
    return None if v is None else int(v)


def _row_opt_str(row: sqlite3.Row, key: str) -> str | None:
    v = row[key]
    return None if v is None else str(v)


def _json_dict(raw: str) -> dict[str, Any]:
    data = json.loads(raw)
    return data if isinstance(data, dict) else {}


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _probe_fts5(conn: sqlite3.Connection) -> bool:
    try:
        conn.execute("CREATE VIRTUAL TABLE temp._fts_probe USING fts5(x)")
        conn.execute("DROP TABLE temp._fts_probe")
        return True
    except sqlite3.OperationalError:
        return False


def _row_to_thread(row: sqlite3.Row) -> Thread:
    return Thread(
        thread_id=_row_str(row, "thread_id"),
        title=_row_str(row, "title"),
        created_at=_row_float(row, "created_at"),
        updated_at=_row_float(row, "updated_at"),
        metadata=_json_dict(_row_str(row, "metadata")),
        parent_thread_id=_row_opt_str(row, "parent_thread_id"),
        fork_point_seq=_row_opt_int(row, "fork_point_seq"),
        fork_mode=cast(ForkMode | None, _row_opt_str(row, "fork_mode")),
        archived=bool(row["archived"]),
    )


def _row_to_turn(row: sqlite3.Row) -> Turn:
    return Turn(
        turn_id=_row_str(row, "turn_id"),
        thread_id=_row_str(row, "thread_id"),
        turn_seq=_row_int(row, "turn_seq"),
        status=cast(TurnStatus, _row_str(row, "status")),
        started_at=_row_float(row, "started_at"),
        ended_at=None if row["ended_at"] is None else _row_float(row, "ended_at"),
        error=_row_opt_str(row, "error"),
        metadata=_json_dict(_row_str(row, "metadata")),
    )


def _row_to_item(row: sqlite3.Row) -> ItemBase:
    envelope: dict[str, Any] = {
        "seq": _row_int(row, "seq"),
        "thread_id": _row_str(row, "thread_id"),
        "turn_id": _row_opt_str(row, "turn_id"),
        "parent_seq": _row_opt_int(row, "parent_seq"),
        "created_at": _row_float(row, "created_at"),
        "item_type": _row_str(row, "item_type"),
        "client_item_id": _row_opt_str(row, "client_item_id"),
    }
    data: dict[str, Any] = dict(json.loads(_row_str(row, "payload")))
    data.update(envelope)
    obj = ITEM_ADAPTER.validate_python(data)
    if not isinstance(obj, ItemBase):
        raise ValueError(f"非法 item: {envelope['item_type']}")
    return obj


# ==================== SessionStore ====================


class SessionStore:
    """Codex 级会话持久化引擎。"""

    SCHEMA_VERSION = 3  # v1=基线, v2=FTS5, v3=跨会话接力摘要

    def __init__(
        self,
        db_path: str | Path,
        *,
        busy_timeout_ms: int = 5000,
        synchronous: str = "FULL",
    ) -> None:
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
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
        self._fts_enabled = False
        self._migrate()

    @property
    def db_path(self) -> Path:
        return self._path

    @property
    def fts_enabled(self) -> bool:
        return self._fts_enabled

    @property
    def schema_version(self) -> int:
        with self._lock:
            row = self._conn.execute(
                "SELECT MAX(version) AS v FROM schema_version"
            ).fetchone()
        return 0 if row is None or row["v"] is None else _row_int(row, "v")

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def __enter__(self) -> SessionStore:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ==================== Migration ====================

    def _migrate(self) -> None:
        with self._lock:
            self._conn.executescript(_SCHEMA_V1)
            if not self._has_version(1):
                self._add_version(1, "baseline: threads/turns/items/rollbacks")
            if _probe_fts5(self._conn):
                self._conn.executescript(_FTS5_DDL)
                if not self._has_version(2):
                    # 回填已有数据
                    self._conn.execute(
                        "INSERT OR IGNORE INTO items_fts (search_text, seq, thread_id, item_type)"
                        " SELECT search_text, seq, thread_id, item_type FROM items"
                        " WHERE search_text <> ''"
                    )
                    self._add_version(2, "fts5: items_fts virtual table")
                self._fts_enabled = True
            # v3: 跨会话接力摘要表(复用现有 sqlite 引擎,不另造存储层)
            self._conn.executescript(_RELAY_DDL)
            if not self._has_version(3):
                self._add_version(3, "relay_summaries: cross-session relay summary")

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

    # ==================== Thread CRUD ====================

    def create_thread(
        self,
        *,
        title: str = "",
        metadata: dict[str, Any] | None = None,
        thread_id: str | None = None,
        parent_thread_id: str | None = None,
        fork_point_seq: int | None = None,
        fork_mode: ForkMode | None = None,
    ) -> Thread:
        import uuid

        tid = thread_id or uuid.uuid4().hex
        now = _now()
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO threads (thread_id, title, created_at, updated_at, metadata,"
                " parent_thread_id, fork_point_seq, fork_mode, archived)"
                " VALUES (?,?,?,?,?,?,?,?,0)",
                (
                    tid,
                    title,
                    now,
                    now,
                    json.dumps(metadata or {}, ensure_ascii=False),
                    parent_thread_id,
                    fork_point_seq,
                    fork_mode,
                ),
            )
        return Thread(
            thread_id=tid,
            title=title,
            created_at=now,
            updated_at=now,
            metadata=dict(metadata or {}),
            parent_thread_id=parent_thread_id,
            fork_point_seq=fork_point_seq,
            fork_mode=fork_mode,
        )

    def get_thread(self, thread_id: str) -> Thread | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM threads WHERE thread_id = ?", (thread_id,)
            ).fetchone()
            if row is None:
                return None
            cnt = self._conn.execute(
                "SELECT COUNT(*) AS c, MAX(seq) AS m FROM items WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
        t = _row_to_thread(row)
        t.item_count = _row_int(cnt, "c") if cnt else 0
        t.last_seq = _row_opt_int(cnt, "m") if cnt else None
        return t

    def list_threads(
        self,
        *,
        limit: int = 50,
        offset: int = 0,
        include_archived: bool = False,
    ) -> ThreadPage:
        where = "" if include_archived else " WHERE archived = 0"
        with self._lock:
            total_row = self._conn.execute(
                f"SELECT COUNT(*) AS c FROM threads{where}"
            ).fetchone()
            rows = self._conn.execute(
                f"SELECT * FROM threads{where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
                [max(0, int(limit)), max(0, int(offset))],
            ).fetchall()
        threads = [_row_to_thread(r) for r in rows]
        total = _row_int(total_row, "c")
        return ThreadPage(
            threads=threads,
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + len(threads) < total,
        )

    # ==================== Turn CRUD + 状态机 ====================

    def start_turn(
        self,
        thread_id: str,
        *,
        turn_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Turn:
        import uuid

        tid = turn_id or uuid.uuid4().hex
        now = _now()
        with self._tx() as conn:
            if conn.execute(
                "SELECT 1 FROM threads WHERE thread_id = ?", (thread_id,)
            ).fetchone() is None:
                raise ThreadNotFoundError(thread_id)
            seq_row = conn.execute(
                "SELECT COALESCE(MAX(turn_seq), 0) + 1 AS n FROM turns WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
            turn_seq = _row_int(cast(sqlite3.Row, seq_row), "n")
            conn.execute(
                "INSERT INTO turns (turn_id, thread_id, turn_seq, status, started_at, metadata)"
                " VALUES (?,?,?,'running',?,?)",
                (tid, thread_id, turn_seq, now, json.dumps(metadata or {}, ensure_ascii=False)),
            )
            conn.execute(
                "UPDATE threads SET updated_at = ? WHERE thread_id = ?", (now, thread_id)
            )
        return Turn(
            turn_id=tid,
            thread_id=thread_id,
            turn_seq=turn_seq,
            status="running",
            started_at=now,
            metadata=dict(metadata or {}),
        )

    def end_turn(
        self,
        turn_id: str,
        *,
        status: TurnStatus = "completed",
        error: str | None = None,
    ) -> Turn:
        now = _now()
        with self._tx() as conn:
            row = conn.execute(
                "SELECT thread_id, status FROM turns WHERE turn_id = ?", (turn_id,)
            ).fetchone()
            if row is None:
                raise TurnNotFoundError(turn_id)
            current = _row_str(row, "status")
            allowed = _VALID_TRANSITIONS.get(current, set())
            if status not in allowed:
                raise InvalidTurnTransitionError(
                    f"turn {turn_id}: {current} → {status} 不合法(允许: {allowed})"
                )
            conn.execute(
                "UPDATE turns SET status = ?, ended_at = ?, error = ? WHERE turn_id = ?",
                (status, now, error, turn_id),
            )
            conn.execute(
                "UPDATE threads SET updated_at = ? WHERE thread_id = ?",
                (now, _row_str(row, "thread_id")),
            )
        return self.get_turn(turn_id) or self._ensure_turn(turn_id)

    def get_turn(self, turn_id: str) -> Turn | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM turns WHERE turn_id = ?", (turn_id,)
            ).fetchone()
        return _row_to_turn(row) if row else None

    def list_turns(
        self,
        thread_id: str,
        *,
        status: TurnStatus | None = None,
    ) -> list[Turn]:
        sql = "SELECT * FROM turns WHERE thread_id = ?"
        args: list[Any] = [thread_id]
        if status:
            sql += " AND status = ?"
            args.append(status)
        sql += " ORDER BY turn_seq ASC"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [_row_to_turn(r) for r in rows]

    # ==================== Item 追加(幂等 + 内容哈希) ====================

    def append_item(
        self,
        turn_id: str,
        item: ItemBase,
        *,
        thread_id: str | None = None,
    ) -> ItemBase:
        """追加单个 item。turn_id 必填;thread_id 可从 turn 推断。"""
        with self._tx() as conn:
            trow = conn.execute(
                "SELECT thread_id FROM turns WHERE turn_id = ?", (turn_id,)
            ).fetchone()
            if trow is None:
                raise TurnNotFoundError(turn_id)
            effective_thread = thread_id or _row_str(trow, "thread_id")
            if thread_id and _row_str(trow, "thread_id") != thread_id:
                raise TurnMismatchError(
                    f"turn {turn_id} 不属于 thread {thread_id}"
                )
            # 幂等去重
            if item.client_item_id is not None:
                existing = conn.execute(
                    "SELECT seq FROM items WHERE client_item_id = ?",
                    (item.client_item_id,),
                ).fetchone()
                if existing is not None:
                    raise DuplicateItemError(
                        f"client_item_id={item.client_item_id} 已存在(seq={existing['seq']})"
                    )
            seq = self._next_seq(conn)
            chash = _content_hash(item)
            payload = json.dumps(item.body_payload(), ensure_ascii=False)
            search = item.search_text()
            conn.execute(
                "INSERT INTO items (seq, thread_id, turn_id, parent_seq, item_type,"
                " created_at, payload, search_text, client_item_id, content_hash)"
                " VALUES (?,?,?,?,?,?,?,?,?,?)",
                (
                    seq,
                    effective_thread,
                    turn_id,
                    item.parent_seq,
                    item.item_type,
                    _now(),
                    payload,
                    search,
                    item.client_item_id,
                    chash,
                ),
            )
            if self._fts_enabled and search:
                conn.execute(
                    "INSERT INTO items_fts (search_text, seq, thread_id, item_type)"
                    " VALUES (?,?,?,?)",
                    (search, seq, effective_thread, item.item_type),
                )
            conn.execute(
                "UPDATE threads SET updated_at = ? WHERE thread_id = ?",
                (_now(), effective_thread),
            )
        return item.model_copy(
            update={"seq": seq, "thread_id": effective_thread, "turn_id": turn_id}
        )

    # ==================== Resume(重建消息历史 + 配对修复) ====================

    def resume(self, thread_id: str) -> list[LLMMessage]:
        """重建消息历史。中断的 tool_call 自动补 synthetic interrupted result。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            raise ThreadNotFoundError(thread_id)
        # 找到最新 compaction boundary
        with self._lock:
            boundary_row = self._conn.execute(
                "SELECT seq, payload FROM items WHERE thread_id = ?"
                " AND item_type = 'compaction_boundary'"
                " ORDER BY seq DESC LIMIT 1",
                (thread_id,),
            ).fetchone()
        messages: list[LLMMessage] = []
        if boundary_row is not None:
            bseq = (
                _row_int(boundary_row, "boundary_seq")
                if "boundary_seq" in dict(boundary_row)
                else _row_int(boundary_row, "seq")
            )
            bpayload = json.loads(_row_str(boundary_row, "payload"))
            summary = bpayload.get("summary", "")
            messages.append(
                LLMMessage(role="system", content=f"[Previous context summary] {summary}")
            )
            after_seq = bseq
        else:
            after_seq = 0
        items = self._list_items_after(thread_id, after_seq)
        # 配对修复:找出没有对应 tool_result 的 tool_call
        pending_calls: dict[str, ToolCallItem] = {}
        resolved_calls: set[str] = set()
        for it in items:
            if isinstance(it, ToolCallItem):
                pending_calls[it.call_id] = it
            elif isinstance(it, ToolResultItem):
                resolved_calls.add(it.call_id)
        dangling_ids = set(pending_calls.keys()) - resolved_calls
        # 构建消息列表
        for it in items:
            if isinstance(it, UserMessageItem):
                messages.append(LLMMessage(role="user", content=it.content))
            elif isinstance(it, AgentMessageItem):
                messages.append(LLMMessage(role="assistant", content=it.content))
            elif isinstance(it, ToolCallItem):
                tc = {
                    "id": it.call_id,
                    "type": "function",
                    "function": {
                        "name": it.tool,
                        "arguments": json.dumps(it.arguments, ensure_ascii=False),
                    },
                }
                # 检查是否已有 assistant 消息可以附加 tool_calls
                if messages and messages[-1].role == "assistant":
                    existing = messages[-1]
                    tcs = list(existing.tool_calls or [])
                    tcs.append(tc)
                    messages[-1] = LLMMessage(
                        role="assistant",
                        content=existing.content,
                        tool_calls=tcs,
                    )
                else:
                    messages.append(
                        LLMMessage(role="assistant", content="", tool_calls=[tc])
                    )
            elif isinstance(it, ToolResultItem):
                messages.append(
                    LLMMessage(
                        role="tool",
                        content=it.output if it.ok else (it.error or it.output),
                        tool_call_id=it.call_id,
                    )
                )
        # 为悬挂的 tool_call 补 synthetic interrupted result
        for cid in sorted(dangling_ids):
            messages.append(
                LLMMessage(
                    role="tool",
                    content="[interrupted] tool execution was interrupted",
                    tool_call_id=cid,
                )
            )
        return messages

    # ==================== Fork ====================

    def fork(
        self,
        thread_id: str,
        at_response_id: int,
        *,
        title: str = "",
    ) -> Thread:
        """从某 item seq 处分支出新 thread,复制前缀。"""
        source = self.get_thread(thread_id)
        if source is None:
            raise ThreadNotFoundError(thread_id)
        # 验证 at_response_id 属于该 thread
        with self._lock:
            item_row = self._conn.execute(
                "SELECT seq FROM items WHERE thread_id = ? AND seq = ?",
                (thread_id, at_response_id),
            ).fetchone()
        if item_row is None:
            raise ValueError(f"seq={at_response_id} 不属于 thread {thread_id}")
        new_thread = self.create_thread(
            title=title or f"Fork of {source.title}",
            parent_thread_id=thread_id,
            fork_point_seq=at_response_id,
            fork_mode="copy",
        )
        # 复制前缀 items(<=at_response_id)到新 thread
        with self._tx() as conn:
            rows = conn.execute(
                "SELECT * FROM items WHERE thread_id = ? AND seq <= ? ORDER BY seq ASC",
                (thread_id, at_response_id),
            ).fetchall()
            for row in rows:
                new_seq = self._next_seq(conn)
                conn.execute(
                    "INSERT INTO items (seq, thread_id, turn_id, parent_seq, item_type,"
                    " created_at, payload, search_text, client_item_id, content_hash)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?)",
                    (
                        new_seq,
                        new_thread.thread_id,
                        _row_opt_str(row, "turn_id"),
                        _row_opt_int(row, "parent_seq"),
                        _row_str(row, "item_type"),
                        _row_float(row, "created_at"),
                        _row_str(row, "payload"),
                        _row_str(row, "search_text"),
                        None,  # fork 后清除 client_item_id 避免冲突
                        _row_opt_str(row, "content_hash"),
                    ),
                )
                if self._fts_enabled and _row_str(row, "search_text"):
                    conn.execute(
                        "INSERT INTO items_fts (search_text, seq, thread_id, item_type)"
                        " VALUES (?,?,?,?)",
                        (
                            _row_str(row, "search_text"),
                            new_seq,
                            new_thread.thread_id,
                            _row_str(row, "item_type"),
                        ),
                    )
            conn.execute(
                "UPDATE threads SET updated_at = ? WHERE thread_id = ?",
                (_now(), new_thread.thread_id),
            )
        return new_thread

    # ==================== Rollback(软删除) ====================

    def rollback(
        self,
        thread_id: str,
        to_turn_id: str,
        *,
        reason: str = "",
    ) -> int:
        """软回滚到指定 turn 的最后一条 item。返回截断上界 seq。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            raise ThreadNotFoundError(thread_id)
        turn = self.get_turn(to_turn_id)
        if turn is None:
            raise TurnNotFoundError(to_turn_id)
        if turn.thread_id != thread_id:
            raise TurnMismatchError(f"turn {to_turn_id} 不属于 thread {thread_id}")
        # 找该 turn 最后一条 item 的 seq
        with self._lock:
            last_item = self._conn.execute(
                "SELECT MAX(seq) AS m FROM items WHERE turn_id = ?",
                (to_turn_id,),
            ).fetchone()
        to_seq = _row_opt_int(last_item, "m") if last_item else 0
        if to_seq is None:
            to_seq = 0
        now = _now()
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO rollbacks (thread_id, to_seq, reason, created_at)"
                " VALUES (?,?,?,?)",
                (thread_id, to_seq, reason, now),
            )
        return to_seq

    # ==================== Compact ====================

    def compact(
        self,
        thread_id: str,
        summary_item: CompactionBoundaryItem,
        *,
        turn_id: str | None = None,
    ) -> CompactionBoundaryItem:
        """插入压缩边界 item。resume 时只回放此边界后内容+摘要。"""
        thread = self.get_thread(thread_id)
        if thread is None:
            raise ThreadNotFoundError(thread_id)
        if turn_id is None:
            # 自动开一个 turn
            t = self.start_turn(thread_id)
            turn_id = t.turn_id
        appended = self.append_item(turn_id, summary_item, thread_id=thread_id)
        assert isinstance(appended, CompactionBoundaryItem)
        return appended

    # ==================== 全文检索 ====================

    def full_text_search(
        self,
        query: str,
        *,
        thread_id: str | None = None,
        limit: int = 20,
    ) -> list[SearchHit]:
        if not query.strip():
            return []
        if self._fts_enabled:
            hits = self._search_fts(query, thread_id, limit)
            if hits is not None:
                return hits
        return self._search_like(query, thread_id, limit)

    def _search_fts(
        self, query: str, thread_id: str | None, limit: int
    ) -> list[SearchHit] | None:
        scope_sql = ""
        scope_args: list[Any] = []
        if thread_id:
            scope_sql = " AND thread_id = ?"
            scope_args = [thread_id]
        sql = (
            "SELECT seq, thread_id, item_type,"
            " snippet(items_fts, 0, '', '', ' … ', 24) AS snip,"
            " bm25(items_fts) AS score"
            " FROM items_fts WHERE items_fts MATCH ?"
            f"{scope_sql} ORDER BY score LIMIT ?"
        )
        try:
            with self._lock:
                rows = self._conn.execute(
                    sql, [query, *scope_args, int(limit)]
                ).fetchall()
        except sqlite3.OperationalError:
            return None
        return [
            SearchHit(
                seq=_row_int(r, "seq"),
                thread_id=_row_str(r, "thread_id"),
                item_type=cast(ItemKind, _row_str(r, "item_type")),
                snippet=_row_str(r, "snip"),
                score=_row_float(r, "score"),
            )
            for r in rows
        ]

    def _search_like(
        self, query: str, thread_id: str | None, limit: int
    ) -> list[SearchHit]:
        term = query.strip()
        pattern = "%" + _escape_like(term) + "%"
        scope_sql = ""
        scope_args: list[Any] = []
        if thread_id:
            scope_sql = " AND thread_id = ?"
            scope_args = [thread_id]
        sql = (
            "SELECT seq, thread_id, item_type, search_text FROM items"
            " WHERE search_text LIKE ? ESCAPE '\\'"
            f"{scope_sql} ORDER BY seq DESC LIMIT ?"
        )
        with self._lock:
            rows = self._conn.execute(
                sql, [pattern, *scope_args, int(limit)]
            ).fetchall()
        hits: list[SearchHit] = []
        low = term.lower()
        for r in rows:
            text = _row_str(r, "search_text")
            pos = text.lower().find(low)
            start = max(0, pos - 40) if pos >= 0 else 0
            snippet = ("…" if start > 0 else "") + text[start : start + 120]
            hits.append(
                SearchHit(
                    seq=_row_int(r, "seq"),
                    thread_id=_row_str(r, "thread_id"),
                    item_type=cast(ItemKind, _row_str(r, "item_type")),
                    snippet=snippet,
                    score=None,
                )
            )
        return hits

    # ==================== 跨会话接力摘要(P2-7) ====================

    def save_relay_summary(
        self,
        thread_id: str,
        *,
        objective: str,
        completed_steps: list[str],
        key_decisions: list[str],
        unfinished: list[str],
        files: list[str],
        refined: bool = False,
        prev_thread_id: str | None = None,
    ) -> str:
        """持久化一条接力摘要,返回 summary_id(同 thread 允许多条,取最新为权威)。"""
        import uuid

        if self.get_thread(thread_id) is None:
            raise ThreadNotFoundError(thread_id)
        sid = uuid.uuid4().hex
        payload = json.dumps(
            {
                "completed_steps": list(completed_steps or []),
                "key_decisions": list(key_decisions or []),
                "unfinished": list(unfinished or []),
                "files": list(files or []),
            },
            ensure_ascii=False,
        )
        now = _now()
        with self._tx() as conn:
            conn.execute(
                "INSERT INTO relay_summaries (summary_id, thread_id, prev_thread_id,"
                " objective, payload, refined, created_at) VALUES (?,?,?,?,?,?,?)",
                (
                    sid,
                    thread_id,
                    prev_thread_id,
                    objective,
                    payload,
                    int(bool(refined)),
                    now,
                ),
            )
        return sid

    def get_relay_summary(self, thread_id: str) -> dict[str, Any] | None:
        """取某 thread 最新一条接力摘要(含 payload 各段列表);无则 None。"""
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM relay_summaries WHERE thread_id = ?"
                " ORDER BY created_at DESC LIMIT 1",
                (thread_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_relay(row)

    def list_relay_summaries(
        self, *, limit: int = 50, offset: int = 0
    ) -> list[dict[str, Any]]:
        """跨 thread 列出接力摘要(created_at 倒序)。"""
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM relay_summaries ORDER BY created_at DESC"
                " LIMIT ? OFFSET ?",
                (max(0, int(limit)), max(0, int(offset))),
            ).fetchall()
        return [self._row_to_relay(r) for r in rows]

    def _row_to_relay(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "summary_id": _row_str(row, "summary_id"),
            "thread_id": _row_str(row, "thread_id"),
            "prev_thread_id": _row_opt_str(row, "prev_thread_id"),
            "objective": _row_str(row, "objective"),
            "payload": _row_str(row, "payload"),
            "refined": bool(row["refined"]),
            "created_at": _row_float(row, "created_at"),
        }

    # ==================== 内部 ====================

    def _next_seq(self, conn: sqlite3.Connection) -> int:
        conn.execute(
            "UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'last_seq'"
        )
        row = conn.execute("SELECT value FROM meta WHERE key = 'last_seq'").fetchone()
        return int(str(row["value"]))

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

    def _list_items_after(self, thread_id: str, after_seq: int) -> list[ItemBase]:
        """列出 thread 中 seq > after_seq 的所有 items(考虑 rollback ceiling)。"""
        ceiling = self._get_rollback_ceiling(thread_id)
        sql = "SELECT * FROM items WHERE thread_id = ? AND seq > ?"
        args: list[Any] = [thread_id, after_seq]
        if ceiling is not None:
            sql += " AND seq <= ?"
            args.append(ceiling)
        sql += " ORDER BY seq ASC"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [_row_to_item(r) for r in rows]

    def _get_rollback_ceiling(self, thread_id: str) -> int | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT MIN(to_seq) AS m FROM rollbacks WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
        return _row_opt_int(row, "m") if row else None

    def _ensure_turn(self, turn_id: str) -> Turn:
        """兜底获取 turn(不应失败)。"""
        t = self.get_turn(turn_id)
        if t is None:
            raise TurnNotFoundError(turn_id)
        return t

    def list_items(
        self,
        thread_id: str,
        *,
        after_seq: int | None = None,
        upto_seq: int | None = None,
        kinds: Sequence[ItemKind] | None = None,
    ) -> list[ItemBase]:
        """列出 thread 中的 items(考虑 rollback ceiling)。"""
        ceiling = self._get_rollback_ceiling(thread_id)
        sql = "SELECT * FROM items WHERE thread_id = ?"
        args: list[Any] = [thread_id]
        if after_seq is not None:
            sql += " AND seq > ?"
            args.append(after_seq)
        if upto_seq is not None:
            sql += " AND seq <= ?"
            args.append(upto_seq)
        if ceiling is not None:
            sql += " AND seq <= ?"
            args.append(ceiling)
        if kinds:
            placeholders = ", ".join("?" for _ in kinds)
            sql += f" AND item_type IN ({placeholders})"
            args.extend(list(kinds))
        sql += " ORDER BY seq ASC"
        with self._lock:
            rows = self._conn.execute(sql, args).fetchall()
        return [_row_to_item(r) for r in rows]


__all__ = [
    "AgentMessageItem",
    "ApprovalRequestItem",
    "ApprovalResponseItem",
    "CompactionBoundaryItem",
    "DuplicateItemError",
    "ErrorItem",
    "FileEditItem",
    "ForkMode",
    "InvalidTurnTransitionError",
    "ItemBase",
    "ItemKind",
    "LLMMessage",
    "ReasoningItem",
    "SearchHit",
    "SessionStore",
    "Thread",
    "ThreadNotFoundError",
    "ThreadPage",
    "ToolCallItem",
    "ToolResultItem",
    "Turn",
    "TurnMismatchError",
    "TurnNotFoundError",
    "TurnStatus",
    "UserMessageItem",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
