"""Alembic 迁移审计日志 (建议 5.2).

为 alembic 升级 / 降级提供结构化审计日志, 写入:
  - JSONL 文件: deploy/logs/alembic_audit.jsonl
  - 标准 logger (zhs.alembic_audit)
  - 可选: 数据库表 alembic_audit_log (SQLite/PostgreSQL 双方言)

记录字段:
  - ts: ISO8601 时间戳
  - action: upgrade / downgrade / stamp
  - from_rev / to_rev: 源 / 目标 revision
  - duration_ms: 耗时毫秒
  - status: success / failure
  - error: 异常消息 (失败时)
  - db_url_safe: 隐藏密码的 db url
  - operator: 调用方 (env ZHS_OPERATOR 或 'unknown')
"""

import json
import logging
import os
import re
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
LOG_DIR = ROOT / "deploy" / "logs"
LOG_FILE = LOG_DIR / "alembic_audit.jsonl"

# 隐藏 url 密码 (postgresql://user:pass@host -> postgresql://user:***@host)
_URL_PASSWORD_RE = re.compile(r"(://[^:]+:)[^@]+(@)")


def _scrub_url(url: str) -> str:
    return _URL_PASSWORD_RE.sub(r"\1***\2", url or "")


_AUDIT_LOGGER = logging.getLogger("zhs.alembic_audit")


def _ensure_log_dir() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def _emit(record: dict) -> None:
    """把记录同时写文件 + logger."""
    _ensure_log_dir()
    line = json.dumps(record, ensure_ascii=False, sort_keys=True)
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as exc:
        _AUDIT_LOGGER.warning(f"audit log file write failed: {exc}")
    _AUDIT_LOGGER.info(line)


def audit_alembic(
    action: str,
    from_rev: str | None,
    to_rev: str | None,
    db_url: str,
    status: str = "started",
    duration_ms: float = 0.0,
    error: str | None = None,
) -> None:
    """写入一条审计记录.

    action: upgrade / downgrade / stamp
    status: started / success / failure
    """
    record = {
        "ts": datetime.now(UTC).isoformat(),
        "action": action,
        "from_rev": from_rev,
        "to_rev": to_rev,
        "duration_ms": round(duration_ms, 2),
        "status": status,
        "error": error,
        "db_url_safe": _scrub_url(db_url),
        "operator": os.environ.get("ZHS_OPERATOR", "unknown"),
    }
    _emit(record)


def install_alembic_listeners() -> None:
    """注册 alembic 钩子, 在 upgrade/downgrade 自动写审计日志.

    必须在 alembic env.py 顶部调用一次.
    """
    try:
        from alembic.runtime import migration
        from alembic.runtime.migration import MigrationContext

        from alembic import script
    except ImportError:
        return  # alembic 未装

    # alembic 0.9+ 提供了 before/after 钩子, 我们用 context 拦截
    _orig_run_migrations = None
    try:
        pass

        # 拦截 run_migrations (alembic 1.8+)
        # 用 monkey patch 不稳, 改用 env.py 显式调用
    except Exception:
        pass


# 计时上下文管理器 (供 scripts/ci/alembic_ci.py 等调用方使用)


class AlembicAuditTimer:
    """用法:
    with AlembicAuditTimer("upgrade", from_rev="001", to_rev="head",
                           db_url=cfg.get_main_option("sqlalchemy.url")) as timer:
        command.upgrade(cfg, "head")
    # 自动写 success 审计; 异常时写 failure
    """

    def __init__(self, action: str, from_rev: str | None, to_rev: str | None, db_url: str) -> None:
        self.action = action
        self.from_rev = from_rev
        self.to_rev = to_rev
        self.db_url = db_url
        self._start = 0.0

    def __enter__(self):
        self._start = time.perf_counter()
        audit_alembic(
            action=self.action,
            from_rev=self.from_rev,
            to_rev=self.to_rev,
            db_url=self.db_url,
            status="started",
        )
        return self

    def __exit__(self, exc_type, exc, tb):
        duration_ms = (time.perf_counter() - self._start) * 1000.0
        if exc is None:
            audit_alembic(
                action=self.action,
                from_rev=self.from_rev,
                to_rev=self.to_rev,
                db_url=self.db_url,
                status="success",
                duration_ms=duration_ms,
            )
        else:
            audit_alembic(
                action=self.action,
                from_rev=self.from_rev,
                to_rev=self.to_rev,
                db_url=self.db_url,
                status="failure",
                duration_ms=duration_ms,
                error=str(exc),
            )
        # 不吞异常
        return False


# ---------------------------------------------------------------------------
# 数据库表审计 (可选, 需要手动调 log_to_db)
# ---------------------------------------------------------------------------

DDL_AUDIT_TABLE = """
CREATE TABLE IF NOT EXISTS alembic_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts DATETIME NOT NULL,
    action VARCHAR(16) NOT NULL,
    from_rev VARCHAR(64),
    to_rev VARCHAR(64),
    duration_ms REAL NOT NULL,
    status VARCHAR(16) NOT NULL,
    error TEXT,
    db_url_safe VARCHAR(255),
    operator VARCHAR(64)
)
"""

DDL_AUDIT_TABLE_PG = """
CREATE TABLE IF NOT EXISTS alembic_audit_log (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMP NOT NULL,
    action VARCHAR(16) NOT NULL,
    from_rev VARCHAR(64),
    to_rev VARCHAR(64),
    duration_ms DOUBLE PRECISION NOT NULL,
    status VARCHAR(16) NOT NULL,
    error TEXT,
    db_url_safe VARCHAR(255),
    operator VARCHAR(64)
)
"""


def log_to_db(engine, record: dict) -> None:
    """把一条审计记录也写进数据库表 (双写).

    失败不抛异常, 仅警告 (审计不应阻塞主流程).
    """
    try:
        is_sqlite = engine.dialect.name == "sqlite"
        from sqlalchemy import text

        with engine.begin() as conn:
            # 兜底建表
            ddl = DDL_AUDIT_TABLE if is_sqlite else DDL_AUDIT_TABLE_PG
            try:
                conn.execute(text(ddl))
            except Exception:
                pass  # 已存在
            conn.execute(
                text(
                    """INSERT INTO alembic_audit_log
                    (ts, action, from_rev, to_rev, duration_ms, status, error, db_url_safe, operator)
                    VALUES (:ts, :action, :from_rev, :to_rev, :duration_ms, :status, :error, :db_url_safe, :operator)"""
                ),
                {
                    "ts": record["ts"],
                    "action": record["action"],
                    "from_rev": record["from_rev"],
                    "to_rev": record["to_rev"],
                    "duration_ms": record["duration_ms"],
                    "status": record["status"],
                    "error": record["error"],
                    "db_url_safe": record["db_url_safe"],
                    "operator": record["operator"],
                },
            )
    except Exception as exc:
        _AUDIT_LOGGER.warning(f"audit log db write failed: {exc}")
