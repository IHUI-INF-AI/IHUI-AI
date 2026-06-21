"""Alembic 迁移审计日志测试 (建议 5.2).

覆盖:
  - audit_alembic 写 JSONL 到 deploy/logs/alembic_audit.jsonl
  - 密码字段被脱敏 (db_url_safe 不含明文密码)
  - AlembicAuditTimer 上下文管理器: 成功时 status=success, 失败时 status=failure
  - 异常会重新抛出 (不吞)
  - log_to_db 在 SQLite 写入 audit 表
  - log_to_db 失败不抛异常
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy import text

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


@pytest.fixture()
def fresh_audit(monkeypatch, tmp_path):
    """重定向 audit log 文件到 tmp 目录, 测试后清理."""
    from scripts.ci import alembic_audit

    monkeypatch.setattr(alembic_audit, "LOG_DIR", tmp_path)
    monkeypatch.setattr(alembic_audit, "LOG_FILE", tmp_path / "alembic_audit.jsonl")
    # 也重定向模块内 _ensure_log_dir 引用的全局
    monkeypatch.setattr(alembic_audit, "_ensure_log_dir", lambda: tmp_path.mkdir(parents=True, exist_ok=True))
    return tmp_path / "alembic_audit.jsonl"


def test_audit_alembic_writes_jsonl(fresh_audit):
    """audit_alembic 必须写一行 JSONL 到文件."""
    from scripts.ci.alembic_audit import audit_alembic

    audit_alembic(
        action="upgrade",
        from_rev="001",
        to_rev="002_admin_job",
        db_url="sqlite:///./test.db",
        status="success",
        duration_ms=123.4,
    )
    assert fresh_audit.exists()
    lines = fresh_audit.read_text(encoding="utf-8").strip().split("\n")
    assert len(lines) == 1
    rec = json.loads(lines[0])
    assert rec["action"] == "upgrade"
    assert rec["from_rev"] == "001"
    assert rec["to_rev"] == "002_admin_job"
    assert rec["status"] == "success"
    assert rec["duration_ms"] == 123.4


def test_audit_alembic_scrubs_password(fresh_audit):
    """密码字段必须脱敏 (postgresql://u:pwd@host → postgresql://u:***@host)."""
    from scripts.ci.alembic_audit import audit_alembic

    audit_alembic(
        action="upgrade",
        from_rev=None,
        to_rev="head",
        db_url="postgresql+psycopg2://zhs:secret_pwd@127.0.0.1:5432/zhs_platform",
        status="success",
        duration_ms=10.0,
    )
    rec = json.loads(fresh_audit.read_text(encoding="utf-8").strip())
    assert "secret_pwd" not in rec["db_url_safe"]
    assert "***" in rec["db_url_safe"]
    assert "127.0.0.1" in rec["db_url_safe"]


def test_audit_alembic_records_operator(fresh_audit, monkeypatch):
    """operator 字段从 env 读取 ZHS_OPERATOR."""
    monkeypatch.setenv("ZHS_OPERATOR", "ci-runner-42")
    from scripts.ci.alembic_audit import audit_alembic

    audit_alembic(
        action="upgrade",
        from_rev=None,
        to_rev="head",
        db_url="sqlite:///./x.db",
        status="success",
    )
    rec = json.loads(fresh_audit.read_text(encoding="utf-8").strip())
    assert rec["operator"] == "ci-runner-42"


def test_alembic_audit_timer_success(fresh_audit):
    """AlembicAuditTimer 成功路径: status=success, duration_ms > 0."""
    from scripts.ci.alembic_audit import AlembicAuditTimer

    with AlembicAuditTimer("upgrade", from_rev="001", to_rev="002", db_url="sqlite:///./x.db"):
        pass  # noop
    lines = fresh_audit.read_text(encoding="utf-8").strip().split("\n")
    # 应该有 started + success 两条
    assert len(lines) == 2
    started = json.loads(lines[0])
    success = json.loads(lines[1])
    assert started["status"] == "started"
    assert success["status"] == "success"
    assert success["duration_ms"] >= 0


def test_alembic_audit_timer_failure(fresh_audit):
    """AlembicAuditTimer 失败路径: status=failure, 异常会重新抛出."""
    from scripts.ci.alembic_audit import AlembicAuditTimer

    with pytest.raises(RuntimeError, match="simulated"):
        with AlembicAuditTimer("downgrade", from_rev="head", to_rev="base", db_url="sqlite:///./x.db"):
            raise RuntimeError("simulated alembic failure")
    lines = fresh_audit.read_text(encoding="utf-8").strip().split("\n")
    assert len(lines) == 2
    failure = json.loads(lines[1])
    assert failure["status"] == "failure"
    assert "simulated" in failure["error"]
    assert failure["duration_ms"] >= 0


def test_log_to_db_writes_audit_table():
    """log_to_db 必须能在 SQLite 写入 alembic_audit_log 表."""
    from scripts.ci.alembic_audit import log_to_db

    fd, path = tempfile.mkstemp(suffix=".db", prefix="zhs_audit_test_")
    os.close(fd)
    try:
        eng = sa.create_engine(f"sqlite:///{path}")
        record = {
            "ts": "2026-06-13T12:00:00+00:00",
            "action": "upgrade",
            "from_rev": "001",
            "to_rev": "002_admin_job",
            "duration_ms": 100.0,
            "status": "success",
            "error": None,
            "db_url_safe": "sqlite:///./x.db",
            "operator": "tester",
        }
        log_to_db(eng, record)
        with eng.connect() as conn:
            row = conn.execute(
                text("SELECT action, from_rev, to_rev, status, operator FROM alembic_audit_log")
            ).fetchone()
        assert row[0] == "upgrade"
        assert row[1] == "001"
        assert row[2] == "002_admin_job"
        assert row[3] == "success"
        assert row[4] == "tester"
        eng.dispose()
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


def test_log_to_db_failure_does_not_raise():
    """log_to_db 失败时必须不抛异常 (审计不应阻塞主流程)."""
    from scripts.ci.alembic_audit import log_to_db

    # 构造一个不存在的 db url
    bad_eng = sa.create_engine("sqlite:///nonexistent_dir_xyz/db.db")
    record = {
        "ts": "2026-06-13T12:00:00+00:00",
        "action": "upgrade",
        "from_rev": None,
        "to_rev": "head",
        "duration_ms": 0.0,
        "status": "started",
        "error": None,
        "db_url_safe": "sqlite:///x.db",
        "operator": "tester",
    }
    # 不应抛异常
    log_to_db(bad_eng, record)
    bad_eng.dispose()
