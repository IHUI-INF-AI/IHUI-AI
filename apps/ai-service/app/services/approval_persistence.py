# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审批决策持久化(批 51:审批策略面,对标 OpenAI codex-rs approvals.rs)。

背景
----
codex 的审批键(ApprovalCacheKey)支持「审批决策持久化」:用户批准一次后,
同键请求在 *本会话内*('PERSIST_SESSION') 或 *永久*('PERSIST_ALWAYS') 两个
层级不再重复弹审批。ihui 现状:`mcp_server.py` 的 `_exec_allowed_prefixes`
(长期前缀放行) 与一次性放行登记表(`approve_exec_command` /
`_consume_exec_approval`) 全是进程内存 —— 服务重启即丢,且无「会话」层概念。

本模块把审批授权落盘到 SQLite(纯标准库 sqlite3,表结构写法对齐
`session_store.py` 的 `_tx` / 锁模式),使授权可跨重启保留,并显式区分
session / always 两级 scope。

设计要点
--------
- 崩溃安全:WAL + 写串行化(BEGIN IMMEDIATE 事务);
- 线程安全:`threading.Lock` 串行化所有连接访问;`check_same_thread=False`;
- 幂等:`UNIQUE(scope, cache_key, kind)` 约束 + `INSERT OR IGNORE`;
- scope 优先级:`always` 优先于 `session`;session 级带过期,过期即删并返回 None;
- db 路径模块级惰性单例、可注入(默认 `data/approval_grants.db`,目录自建),
  便于测试用 tmp_path 隔离;
- 仅同步 API(无 async),符合本仓 mcp_server 既有同步风格。
"""

from __future__ import annotations

import re
import sqlite3
import threading
from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

# ==================== 常量 ====================

DEFAULT_DB_PATH = Path("data/approval_grants.db")

SCOPE_SESSION = "session"
SCOPE_ALWAYS = "always"
_SCOPES = frozenset({SCOPE_SESSION, SCOPE_ALWAYS})

KIND_EXEC_PREFIX = "exec_prefix"  # 前缀放行类(对齐 _exec_allowed_prefixes)
KIND_EXEC_ONCE = "exec_once"      # 一次性放行(对齐 approve_exec_command)
KIND_MCP_TOOL = "mcp_tool"        # MCP 工具调用(对齐 protocol mcp_approval_meta)
KIND_NET = "network"              # 网络访问审批(批 52,对标 codex NetworkAccess;键前缀 net\x1f 区分)
_KINDS = frozenset({KIND_EXEC_PREFIX, KIND_EXEC_ONCE, KIND_MCP_TOOL, KIND_NET})

# 规范化键用的单元分隔符(与 shlex.join 不同,此处用不可打印分隔符避免 token
# 内出现空格/引号造成歧义;语义对齐 mcp_server 既有 `_canonical_approval_key`)
_UNIT_SEP = "\x1f"

# env 赋值 token 判定:VAR=val 形态(等号前为合法标识符)
_ENV_ASSIGN_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")

# ==================== 模块级惰性单例 ====================

_DB_PATH: Path = DEFAULT_DB_PATH
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def set_db_path(path: str | Path) -> None:
    """注入独立 db 路径(测试隔离用)。

    会关闭已存在的连接并置空,使下一次写/读操作惰性重建到新路径
    (目录自动创建)。生产代码无需调用,默认 `data/approval_grants.db`。
    """
    global _DB_PATH, _conn
    with _lock:
        _DB_PATH = Path(path)
        if _conn is not None:
            _conn.close()
            _conn = None


def _now_iso() -> str:
    """UTC ISO 8601 定宽字符串(无小数秒),可字典序比较等价于时间先后。"""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _iso_plus_ttl(ttl_seconds: int) -> str:
    return (datetime.now(UTC) + timedelta(seconds=ttl_seconds)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


def _open(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(
        str(db_path),
        check_same_thread=False,
        isolation_level=None,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=FULL")
    conn.execute(_SCHEMA_DDL)
    return conn


_SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS approval_grants (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    scope       TEXT NOT NULL,
    cache_key   TEXT NOT NULL,
    kind        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NULL,
    UNIQUE(scope, cache_key, kind)
);
"""


def _get_conn() -> sqlite3.Connection:
    """惰性返回模块级单例连接(线程安全)。"""
    global _conn
    with _lock:
        if _conn is None:
            _conn = _open(_DB_PATH)
        return _conn


# ==================== 规范化键辅助 ====================


def normalize_exec_key(command_tokens: Sequence[str]) -> str:
    """把命令 argv 规范化为稳定审批键(对齐 mcp_server 现有规范化语义)。

    规则:
    1. 全部小写(大小写归一);
    2. 剥去首部 env 赋值 token(`VAR=val` 形态),可连续多个(如
       `FOO=1 BAR=2 git status` → 剥 `FOO=1` `BAR=2`);
    3. 剥去首部 `sudo` / `doas` 前缀(可紧跟在 env 赋值之后);
    4. 用单元分隔符 `\\x1f` 连接剩余 token。

    command_tokens 约定为已切词形态(消费方负责切词,本函数不做 shell 解析)。

    >>> normalize_exec_key(["SUDO", "Git", "Status"])
    'git\\x1fstatus'
    >>> normalize_exec_key(["FOO=bar", "Git", "Status"])
    'git\\x1fstatus'
    """
    lowered = [t.lower() for t in command_tokens]
    i = 0
    changed = True
    while changed and i < len(lowered):
        changed = False
        tok = lowered[i]
        if _ENV_ASSIGN_RE.match(tok):
            i += 1
            changed = True
            continue
        if tok in ("sudo", "doas"):
            i += 1
            changed = True
            continue
        break
    return _UNIT_SEP.join(lowered[i:])


# ==================== 核心 API ====================


def grant(
    scope: str,
    cache_key: str,
    kind: str,
    *,
    ttl_seconds: int | None = None,
) -> None:
    """登记一次审批授权(幂等 INSERT OR IGNORE)。

    scope: 'session' | 'always';
    cache_key: 规范化键(normalize_exec_key 产物 / 工具名+参数摘要);
    kind: 'exec_prefix' | 'exec_once' | 'mcp_tool';
    ttl_seconds: 仅 session 级有意义,给定则在 created_at 基础上设 expires_at;
        always 级忽略 ttl(永久)。
    """
    if scope not in _SCOPES:
        raise ValueError(f"非法 scope: {scope!r} (允许: {sorted(_SCOPES)})")
    if kind not in _KINDS:
        raise ValueError(f"非法 kind: {kind!r} (允许: {sorted(_KINDS)})")

    created_at = _now_iso()
    expires_at = None if (scope == SCOPE_ALWAYS or ttl_seconds is None) else _iso_plus_ttl(
        int(ttl_seconds)
    )
    conn = _get_conn()
    with _lock:
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                "INSERT OR IGNORE INTO approval_grants "
                "(scope, cache_key, kind, created_at, expires_at) "
                "VALUES (?,?,?,?,?)",
                (scope, cache_key, kind, created_at, expires_at),
            )
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise


def check(cache_key: str, kind: str) -> str | None:
    """查询命中 scope;'always' 优先于 'session'。

    返回:
        'always' 命中永久授权;
        'session' 命中会话授权且未过期;
        None 两 scope 均未命中,或 session 级已过期(过期记录会被顺手删除)。
    """
    conn = _get_conn()
    now = _now_iso()
    with _lock:
        # always 优先
        row = conn.execute(
            "SELECT 1 FROM approval_grants "
            "WHERE cache_key=? AND kind=? AND scope='always'",
            (cache_key, kind),
        ).fetchone()
        if row is not None:
            return SCOPE_ALWAYS
        # session:判过期
        row = conn.execute(
            "SELECT expires_at FROM approval_grants "
            "WHERE cache_key=? AND kind=? AND scope='session'",
            (cache_key, kind),
        ).fetchone()
        if row is None:
            return None
        expires = row["expires_at"]
        if expires is None or expires > now:
            return SCOPE_SESSION
        # 已过期 → 删
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                "DELETE FROM approval_grants "
                "WHERE cache_key=? AND kind=? AND scope='session'",
                (cache_key, kind),
            )
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        return None


def revoke(cache_key: str, kind: str) -> None:
    """撤销某 cache_key+kind 在两 scope 上的全部授权。"""
    conn = _get_conn()
    with _lock:
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                "DELETE FROM approval_grants WHERE cache_key=? AND kind=?",
                (cache_key, kind),
            )
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise


def list_keys(kind: str) -> list[str]:
    """枚举某 kind 下未过期的全部 cache_key(前缀放行匹配用;未排序)。

    session 级已过期记录不返回(但不顺手删,清理走 purge_expired)。
    查询失败抛sqlite3 异常,由调用方决定降级策略(审批链路必须 fail-closed)。
    """
    if kind not in _KINDS:
        raise ValueError(f"非法 kind: {kind!r} (允许: {sorted(_KINDS)})")
    conn = _get_conn()
    now = _now_iso()
    with _lock:
        rows = conn.execute(
            "SELECT DISTINCT cache_key, scope, expires_at FROM approval_grants WHERE kind=?",
            (kind,),
        ).fetchall()
    keys: list[str] = []
    for row in rows:
        if row["scope"] == SCOPE_ALWAYS:
            keys.append(row["cache_key"])
        else:
            expires = row["expires_at"]
            if expires is None or expires > now:
                keys.append(row["cache_key"])
    return keys


def purge_expired() -> int:
    """清理过期的 session 级记录,返回被删除条数。"""
    conn = _get_conn()
    now = _now_iso()
    with _lock:
        conn.execute("BEGIN IMMEDIATE")
        try:
            cur = conn.execute(
                "DELETE FROM approval_grants "
                "WHERE scope='session' AND expires_at IS NOT NULL AND expires_at <= ?",
                (now,),
            )
            deleted = cur.rowcount
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        return deleted


def stats() -> dict[str, Any]:
    """统计:{'total': int, 'byScope': {...}, 'byKind': {...}}。"""
    conn = _get_conn()
    with _lock:
        total = conn.execute("SELECT COUNT(*) AS c FROM approval_grants").fetchone()["c"]
        by_scope: dict[str, int] = dict.fromkeys(_SCOPES, 0)
        for row in conn.execute(
            "SELECT scope, COUNT(*) AS c FROM approval_grants GROUP BY scope"
        ).fetchall():
            by_scope[row["scope"]] = row["c"]
        by_kind: dict[str, int] = dict.fromkeys(_KINDS, 0)
        for row in conn.execute(
            "SELECT kind, COUNT(*) AS c FROM approval_grants GROUP BY kind"
        ).fetchall():
            by_kind[row["kind"]] = row["c"]
    return {
        "total": total,
        "byScope": by_scope,
        "byKind": by_kind,
    }


# ==================== 清理(可选,测试/关闭钩子) ====================


def close() -> None:
    """关闭模块级单例连接(用于进程退出/测试重置)。"""
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None


__all__ = [
    "DEFAULT_DB_PATH",
    "SCOPE_SESSION",
    "SCOPE_ALWAYS",
    "KIND_EXEC_PREFIX",
    "KIND_EXEC_ONCE",
    "KIND_MCP_TOOL",
    "KIND_NET",
    "set_db_path",
    "normalize_exec_key",
    "grant",
    "check",
    "revoke",
    "list_keys",
    "purge_expired",
    "stats",
    "close",
]
