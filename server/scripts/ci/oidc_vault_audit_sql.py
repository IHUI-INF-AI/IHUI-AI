"""Phase 12 建议 1: OIDC Vault 审计 SQL 后端 (SQLAlchemy).

目的:
  原 oidc_vault_audit.py 是 SQLite 原生, 改用 SQLAlchemy 2.0 抽象层.
  支持:
  1. SQLite (本地, 默认, 无依赖)
  2. PostgreSQL (生产, 需 psycopg2)
  3. 自动建表/索引
  4. 连接池 + 线程安全
  5. 批量插入

用法:
  from oidc_vault_audit_sql import SqlAuditStore
  store = SqlAuditStore("sqlite:///logs/audit.db")
  store = SqlAuditStore("postgresql://user:pass@host:5432/zhs")
  store.append({"ts": "...", "provider": "grafana", "github_sub": "...", "ttl_min": 30})
  rows = store.query(provider="grafana", since="2026-06-16T00:00:00Z", limit=50)
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

try:
    from sqlalchemy import (
        Column,
        DateTime,
        Index,
        Integer,
        String,
        Text,
        create_engine,
        select,
    )
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session, declarative_base, sessionmaker

    SQLA_AVAILABLE = True
except ImportError:
    SQLA_AVAILABLE = False

Base = declarative_base() if SQLA_AVAILABLE else None  # type: ignore


class AuditLog(Base if Base is not None else object):  # type: ignore
    """SQLAlchemy 模型: 审计日志表."""

    __tablename__ = "audit_log"
    id = Column(Integer, primary_key=True, autoincrement=True) if SQLA_AVAILABLE else None
    ts = Column(String(64), nullable=False, index=True) if SQLA_AVAILABLE else None
    github_sub = Column(String(256), index=True) if SQLA_AVAILABLE else None
    provider = Column(String(64), index=True) if SQLA_AVAILABLE else None
    ttl_min = Column(Integer) if SQLA_AVAILABLE else None
    client_ip = Column(String(64)) if SQLA_AVAILABLE else None
    action = Column(String(64), default="exchange") if SQLA_AVAILABLE else None
    raw_json = Column(Text) if SQLA_AVAILABLE else None


class SqlAuditStore:
    """SQLAlchemy 持久化审计存储.

    支持 URL 形式:
      - sqlite:///path/to.db
      - sqlite:///:memory:
      - postgresql://user:pass@host:port/dbname
    """

    def __init__(self, url: str):
        if not SQLA_AVAILABLE:
            raise ImportError("SQLAlchemy 未安装: pip install sqlalchemy")
        if url.startswith("sqlite:///"):
            db_path = url.replace("sqlite:///", "", 1)
            if db_path and db_path != ":memory:":
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        # SQLite 需要 check_same_thread=False 以支持多线程
        connect_args = {}
        if url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        self.engine: Engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine, expire_on_commit=False)

    def append(self, entry: dict[str, Any]) -> int:
        """追加一条审计, 返回 id."""
        with self.SessionLocal() as session:
            row = AuditLog(
                ts=entry.get("ts") or datetime.now(UTC).isoformat(),
                github_sub=entry.get("github_sub", ""),
                provider=entry.get("provider", ""),
                ttl_min=int(entry.get("ttl_min", 0)),
                client_ip=entry.get("client_ip", ""),
                action=entry.get("action", "exchange"),
                raw_json=json.dumps(entry, ensure_ascii=False, separators=(",", ":")),
            )
            session.add(row)
            session.commit()
            return int(row.id)

    def append_batch(self, entries: list[dict[str, Any]]) -> list[int]:
        """批量追加, 返回 id 列表."""
        with self.SessionLocal() as session:
            rows = [
                AuditLog(
                    ts=e.get("ts") or datetime.now(UTC).isoformat(),
                    github_sub=e.get("github_sub", ""),
                    provider=e.get("provider", ""),
                    ttl_min=int(e.get("ttl_min", 0)),
                    client_ip=e.get("client_ip", ""),
                    action=e.get("action", "exchange"),
                    raw_json=json.dumps(e, ensure_ascii=False, separators=(",", ":")),
                )
                for e in entries
            ]
            session.add_all(rows)
            session.commit()
            return [int(r.id) for r in rows]

    def query(
        self,
        provider: str | None = None,
        since: str | None = None,
        until: str | None = None,
        action: str | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """查询审计日志, 按 id 倒序."""
        with self.SessionLocal() as session:
            stmt = select(AuditLog)
            if provider:
                stmt = stmt.where(AuditLog.provider == provider)
            if action:
                stmt = stmt.where(AuditLog.action == action)
            if since:
                stmt = stmt.where(AuditLog.ts >= since)
            if until:
                stmt = stmt.where(AuditLog.ts <= until)
            stmt = stmt.order_by(AuditLog.id.desc()).limit(limit)
            rows = session.execute(stmt).scalars().all()
            return [
                {
                    "id": r.id,
                    "ts": r.ts,
                    "github_sub": r.github_sub,
                    "provider": r.provider,
                    "ttl_min": r.ttl_min,
                    "client_ip": r.client_ip,
                    "action": r.action,
                    "raw_json": r.raw_json,
                }
                for r in rows
            ]

    def count(self, provider: str | None = None) -> int:
        """统计行数."""
        with self.SessionLocal() as session:
            stmt = select(AuditLog)
            if provider:
                stmt = stmt.where(AuditLog.provider == provider)
            return len(session.execute(stmt).scalars().all())

    def truncate(self) -> None:
        """清空 (测试用)."""
        with self.SessionLocal() as session:
            session.execute(AuditLog.__table__.delete())
            session.commit()

    def close(self) -> None:
        self.engine.dispose()
