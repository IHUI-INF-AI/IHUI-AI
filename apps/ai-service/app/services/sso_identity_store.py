# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SSO 身份映射库(provider, subject) → 本地 user_uuid。

存储:**PostgreSQL**(经 `app.core.pg_sync` 同步桥)。机主 2026-11-19 定档:数据层
只允许 PostgreSQL,禁止 sqlite(含测试库与本地状态库)。

设计要点
--------
- 幂等:`UNIQUE(provider, subject)` + `INSERT ... ON CONFLICT DO NOTHING`;
  首登跨进程竞态**不向上抛**:插入没落到行 ⇒ 回读既有行、刷 email/name、
  按复用身份返回(created=False);
- 非 (provider, subject) 的冲突(例如 `user_uuid` 撞车)**仍然抛**,由
  `IdentityConflict` 显式暴露,不伪装成复用 —— 这是 fail-closed;
- 后端只有两个实现:PG(生产)与进程内(测试隔离,不落任何文件);
  pytest 进程一律进程内(测试连生产库是本仓铁律)。
"""

from __future__ import annotations

import logging
import os
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

import asyncpg

from app.core.pg_sync import PgShim, SyncPgSession

logger = logging.getLogger(__name__)

# ==================== 常量 ====================

# 保留常量名:测试与既有调用方按 `DEFAULT_DB_PATH` 复位隔离态(它已不再是文件路径,
# 只是一个"回到默认选择"的哨兵值)。
DEFAULT_DB_PATH = Path("data/sso_identities.db")

_SCHEMA_DDL = """
CREATE TABLE IF NOT EXISTS sso_identities (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    provider   text NOT NULL,
    subject    text NOT NULL,
    email      text DEFAULT '',
    name       text DEFAULT '',
    user_uuid  text NOT NULL UNIQUE,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    CONSTRAINT sso_identities_provider_subject_key UNIQUE (provider, subject)
);
"""


class IdentityConflict(Exception):
    """非 (provider, subject) 的唯一键冲突(`user_uuid` 撞车等):绝不伪装成复用。"""


class _Backend(Protocol):
    def select(self, provider: str, subject: str) -> dict[str, Any] | None: ...

    def insert(
        self,
        provider: str,
        subject: str,
        email: str,
        name: str,
        user_uuid: str,
        now: str,
    ) -> bool: ...

    def touch(self, row_id: int, email: str, name: str, now: str) -> None: ...

    def close(self) -> None: ...


class _PgBackend:
    def __init__(self, dsn: str) -> None:
        self._session = SyncPgSession(dsn)
        self._shim = PgShim(self._session)
        self._shim.executescript(_SCHEMA_DDL)

    def select(self, provider: str, subject: str) -> dict[str, Any] | None:
        row = self._shim.execute(
            "SELECT id, user_uuid FROM sso_identities WHERE provider=? AND subject=?",
            (provider, subject),
        ).fetchone()
        return None if row is None else {"id": int(row["id"]), "user_uuid": str(row["user_uuid"])}

    def insert(
        self,
        provider: str,
        subject: str,
        email: str,
        name: str,
        user_uuid: str,
        now: str,
    ) -> bool:
        """返回是否真的插入了行;`(provider, subject)` 冲突 ⇒ False(不抛)。"""
        try:
            row = self._shim.execute(
                "INSERT INTO sso_identities"
                " (provider, subject, email, name, user_uuid, created_at, updated_at)"
                " VALUES (?,?,?,?,?,?,?)"
                " ON CONFLICT (provider, subject) DO NOTHING"
                " RETURNING id",
                (provider, subject, email, name, user_uuid, now, now),
            ).fetchone()
        except asyncpg.UniqueViolationError as e:
            # 走到这里说明撞的不是 (provider, subject) —— 那是另一条唯一约束,
            # 属于"身份不唯一"的硬错误,必须抛出去而不是当成并发复用。
            raise IdentityConflict(str(e)) from e
        return row is not None

    def touch(self, row_id: int, email: str, name: str, now: str) -> None:
        self._shim.execute(
            "UPDATE sso_identities SET email=?, name=?, updated_at=? WHERE id=?",
            (email, name, now, row_id),
        )

    def close(self) -> None:
        self._shim.close()


class _MemoryBackend:
    """进程内后端:测试隔离用(`set_db_path` 注入的路径只当"新实例"开关)。"""

    def __init__(self) -> None:
        self._rows: list[dict[str, Any]] = []

    def select(self, provider: str, subject: str) -> dict[str, Any] | None:
        for row in self._rows:
            if row["provider"] == provider and row["subject"] == subject:
                return {"id": int(row["id"]), "user_uuid": str(row["user_uuid"])}
        return None

    def insert(
        self,
        provider: str,
        subject: str,
        email: str,
        name: str,
        user_uuid: str,
        now: str,
    ) -> bool:
        if any(r["user_uuid"] == user_uuid for r in self._rows):
            raise IdentityConflict("user_uuid")
        if self.select(provider, subject) is not None:
            return False
        self._rows.append(
            {
                "id": len(self._rows) + 1,
                "provider": provider,
                "subject": subject,
                "email": email,
                "name": name,
                "user_uuid": user_uuid,
                "created_at": now,
                "updated_at": now,
            }
        )
        return True

    def touch(self, row_id: int, email: str, name: str, now: str) -> None:
        for row in self._rows:
            if int(row["id"]) == int(row_id):
                row["email"] = email
                row["name"] = name
                row["updated_at"] = now
                return

    def close(self) -> None:
        self._rows.clear()


# ==================== 模块级惰性单例 ====================

_DB_PATH: Path = DEFAULT_DB_PATH
# 可重入:公共 API 持锁后再在锁内惰性建后端(同 approval_persistence 的教训)。
_lock = threading.RLock()
_backend: _Backend | None = None


def set_db_path(path: str | Path) -> None:
    """注入独立存储(测试隔离用)。

    路径不再落任何文件:非默认路径 ⇒ 切到进程内后端;传回默认值 ⇒ 恢复默认选择。
    """
    global _DB_PATH, _backend
    with _lock:
        _DB_PATH = Path(path)
        if _backend is not None:
            _backend.close()
            _backend = None


def _now_iso() -> str:
    """UTC ISO 8601 定宽字符串(无小数秒),可字典序比较等价于时间先后。"""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sso_dsn() -> str:
    return (
        os.environ.get("SSO_PG_DSN", "").strip() or os.environ.get("DATABASE_URL", "").strip()
    )


def _running_under_pytest() -> bool:
    import sys

    return "PYTEST_CURRENT_TEST" in os.environ or "pytest" in sys.modules


def _get_backend() -> _Backend:
    global _backend
    with _lock:
        if _backend is None:
            if _DB_PATH != DEFAULT_DB_PATH or _running_under_pytest():
                _backend = _MemoryBackend()
            else:
                dsn = _sso_dsn()
                _backend = _PgBackend(dsn) if dsn else _MemoryBackend()
        return _backend


def _identity_view(
    *,
    user_uuid: str,
    created: bool,
    provider: str,
    subject: str,
    email: str,
    name: str,
) -> dict[str, Any]:
    return {
        "user_uuid": user_uuid,
        "created": created,
        "provider": provider,
        "subject": subject,
        "email": email,
        "name": name,
    }


# ==================== 核心 API ====================


def find_or_create_identity(
    provider: str, subject: str, email: str, name: str
) -> dict[str, Any]:
    """(provider, subject) → 本地身份行;不存在则 JIT 建号,存在则刷 email/name。

    JIT 语义:外部 IdP 首次登录(无本地映射行)即建号生成 user_uuid,
    无需预置账号;再次登录复用同一 user_uuid(created=False)。
    跨进程并发首登若在 SELECT 之后、INSERT 之前被别的进程插入同一
    (provider, subject),唯一冲突不向上抛:回读那一行,刷成本次 email/name,
    并按复用身份返回(created=False),调用方照常签发。
    非 (provider, subject) 的冲突(`user_uuid` 撞车)抛 `IdentityConflict`。

    返回:
        {"user_uuid": str, "created": bool,
         "provider": str, "subject": str, "email": str, "name": str}
        created=True 表示本次首次建号;False 表示复用既有映射,
        email/name 已被更新为本次登录的最新值。
    """
    now = _now_iso()
    with _lock:
        backend = _get_backend()
        row = backend.select(provider, subject)
        if row is not None:
            backend.touch(int(row["id"]), email, name, now)
            return _identity_view(
                user_uuid=str(row["user_uuid"]),
                created=False,
                provider=provider,
                subject=subject,
                email=email,
                name=name,
            )
        user_uuid = str(uuid.uuid4())
        if backend.insert(provider, subject, email, name, user_uuid, now):
            return _identity_view(
                user_uuid=user_uuid,
                created=True,
                provider=provider,
                subject=subject,
                email=email,
                name=name,
            )
        # 并发首登:插入没落到行 ⇒ 回读既有行、刷成本次值、按复用返回。
        raced = backend.select(provider, subject)
        if raced is None:
            raise IdentityConflict("插入未落行但读不到既有身份(状态不可判定)")
        logger.info(
            "sso 首登并发撞上已有身份,改为复用: provider=%s subject=%s",
            provider,
            subject,
        )
        backend.touch(int(raced["id"]), email, name, now)
        return _identity_view(
            user_uuid=str(raced["user_uuid"]),
            created=False,
            provider=provider,
            subject=subject,
            email=email,
            name=name,
        )


# ==================== 清理(可选,测试/关闭钩子) ====================


def close() -> None:
    """关闭模块级单例后端(用于进程退出/测试重置)。"""
    global _backend
    with _lock:
        if _backend is not None:
            _backend.close()
            _backend = None


__all__ = ["DEFAULT_DB_PATH", "IdentityConflict", "close", "find_or_create_identity", "set_db_path"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
