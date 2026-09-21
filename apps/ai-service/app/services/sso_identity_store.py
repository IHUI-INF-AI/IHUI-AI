# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​‌​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO JIT provisioning 身份映射存储(纯标准库 sqlite3,SSO-P2,2026-09-20 立)。

设计
----
外部 IdP 登录成功后,router 层以 (provider, subject) 为业务键做 **JIT 建号**:
首次登录即在 sso_identities 表落一条映射行并生成稳定 user_uuid(uuid4);
后续同 (provider, subject) 登录复用同一行(created=False)。email/name
在外部 IdP 侧可能跨会话变化,命中已有行时以最新值覆盖更新。

user_uuid 是 ai-service 本地稳定标识,签发的 JWT 以它作 sub/userId/familyId,
可被本服务 JWTAuthMiddleware 原样接受;与 apps/api 的用户 ID 域是否互通
由后续跨域映射阶段决定,本模块不做。

工程模式对齐 approval_persistence.py:
- 崩溃安全:WAL + BEGIN IMMEDIATE 写事务 + synchronous=FULL;
- 线程安全:threading.Lock 串行化所有连接访问,check_same_thread=False
  (find_or_create 全程持锁,SELECT→INSERT 无进程内竞态);
- 幂等:UNIQUE(provider, subject) 约束,存在即更新返回;
- db 路径模块级惰性单例、可注入(默认 data/sso_identities.db,目录自建),
  测试用 set_db_path(tmp_path / ...) 隔离;
- 仅同步 API(无 async),符合本仓"同步 sqlite 函数被 async 路由直接调用"
  惯例(参照 approval_persistence)。
"""

from __future__ import annotations

import sqlite3
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# ==================== 常量 ====================

DEFAULT_DB_PATH = Path("data/sso_identities.db")

_SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS sso_identities (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    provider   TEXT NOT NULL,
    subject    TEXT NOT NULL,
    email      TEXT DEFAULT '',
    name       TEXT DEFAULT '',
    user_uuid  TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(provider, subject)
);
"""


# ==================== 模块级惰性单例 ====================

_DB_PATH: Path = DEFAULT_DB_PATH
_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def set_db_path(path: str | Path) -> None:
    """注入独立 db 路径(测试隔离用)。

    会关闭已存在的连接并置空,使下一次写/读操作惰性重建到新路径
    (目录自动创建)。生产代码无需调用,默认 data/sso_identities.db。
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


def _get_conn() -> sqlite3.Connection:
    """惰性返回模块级单例连接(线程安全)。"""
    global _conn
    with _lock:
        if _conn is None:
            _conn = _open(_DB_PATH)
        return _conn


# ==================== 核心 API ====================


def find_or_create_identity(
    provider: str, subject: str, email: str, name: str
) -> dict[str, Any]:
    """(provider, subject) → 本地身份行;不存在则 JIT 建号,存在则刷 email/name。

    JIT 语义:外部 IdP 首次登录(无本地映射行)即建号生成 user_uuid,
    无需预置账号;再次登录复用同一 user_uuid(created=False)。

    返回:
        {"user_uuid": str, "created": bool,
         "provider": str, "subject": str, "email": str, "name": str}
        created=True 表示本次首次建号;False 表示复用既有映射,
        email/name 已被更新为本次登录的最新值。
    """
    now = _now_iso()
    conn = _get_conn()
    with _lock:
        row = conn.execute(
            "SELECT id, user_uuid FROM sso_identities "
            "WHERE provider=? AND subject=?",
            (provider, subject),
        ).fetchone()
        if row is not None:
            conn.execute("BEGIN IMMEDIATE")
            try:
                conn.execute(
                    "UPDATE sso_identities SET email=?, name=?, updated_at=? WHERE id=?",
                    (email, name, now, row["id"]),
                )
                conn.execute("COMMIT")
            except BaseException:
                conn.execute("ROLLBACK")
                raise
            return {
                "user_uuid": str(row["user_uuid"]),
                "created": False,
                "provider": provider,
                "subject": subject,
                "email": email,
                "name": name,
            }
        user_uuid = str(uuid.uuid4())
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                "INSERT INTO sso_identities "
                "(provider, subject, email, name, user_uuid, created_at, updated_at) "
                "VALUES (?,?,?,?,?,?,?)",
                (provider, subject, email, name, user_uuid, now, now),
            )
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        return {
            "user_uuid": user_uuid,
            "created": True,
            "provider": provider,
            "subject": subject,
            "email": email,
            "name": name,
        }


# ==================== 清理(可选,测试/关闭钩子) ====================


def close() -> None:
    """关闭模块级单例连接(用于进程退出/测试重置)。"""
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None


__all__ = ["DEFAULT_DB_PATH", "close", "find_or_create_identity", "set_db_path"]
