# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""审批持久层:两个后端的行为锁。

- 进程内后端(测试/无 DSN 场合):语义必须与 PG 完全一致 —— scope 优先级、
  session 过期即删、always 永久、撤销、统计、清理;
- PG 后端(本机 PG 可连时跑):真库往返 + 跨进程实例可见 + 幂等 upsert + 过期清理。

隔离口径:PG 面用唯一键前缀 `r136-*`,每例结束按前缀清理;测试进程一律不连生产库
(本模块的 `_get_backend()` 在 pytest 进程里直接选进程内后端,这里靠显式构造绕过)。
"""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest

from app.services import approval_persistence as ap
from app.services.approval_persistence import (
    KIND_EXEC_ONCE,
    KIND_EXEC_PREFIX,
    KIND_NET,
    SCOPE_ALWAYS,
    SCOPE_SESSION,
    _MemoryBackend,
    _PgBackend,
)

# ---------------- 进程内后端 ----------------


def test_memory_grant_check_session_ttl_and_expiry() -> None:
    b = _MemoryBackend()
    b.upsert(SCOPE_SESSION, "k", KIND_EXEC_PREFIX, "2020-01-01T00:00:00Z", "2099-01-01T00:00:00Z")
    assert b.find_always("k", KIND_EXEC_PREFIX, "2026-01-01T00:00:00Z") is False
    found, exp = b.find_session_expiry("k", KIND_EXEC_PREFIX)
    assert found is True
    assert exp == "2099-01-01T00:00:00Z"


def test_memory_always_wins_and_is_permanent() -> None:
    b = _MemoryBackend()
    b.upsert(SCOPE_ALWAYS, "k", KIND_NET, "2020-01-01T00:00:00Z", None)
    assert b.find_always("k", KIND_NET, "2099-01-01T00:00:00Z") is True
    # 有 expires_at 的 always 行到期即不再命中
    b.upsert(SCOPE_ALWAYS, "k2", KIND_NET, "2020-01-01T00:00:00Z", "2020-02-01T00:00:00Z")
    assert b.find_always("k2", KIND_NET, "2026-01-01T00:00:00Z") is False


def test_memory_upsert_is_idempotent_on_the_same_key() -> None:
    b = _MemoryBackend()
    b.upsert(SCOPE_ALWAYS, "k", KIND_EXEC_PREFIX, "t1", None)
    b.upsert(SCOPE_ALWAYS, "k", KIND_EXEC_PREFIX, "t2", "2099-01-01T00:00:00Z")
    rows = b.rows_for_kinds([KIND_EXEC_PREFIX])
    assert len(rows) == 1
    assert rows[0]["created_at"] == "t1"  # 后到不覆盖先到(对齐 ON CONFLICT DO NOTHING)


def test_memory_revoke_and_purge_and_stats() -> None:
    b = _MemoryBackend()
    b.upsert(SCOPE_SESSION, "old", KIND_EXEC_ONCE, "t", "2020-01-01T00:00:00Z")
    b.upsert(SCOPE_SESSION, "live", KIND_EXEC_ONCE, "t", None)
    b.upsert(SCOPE_ALWAYS, "forever", KIND_EXEC_PREFIX, "t", None)

    assert b.delete_expired("2026-01-01T00:00:00Z") == 1
    total, by_scope, by_kind = b.stats()
    assert total == 2
    assert by_scope[SCOPE_SESSION] == 1 and by_scope[SCOPE_ALWAYS] == 1
    assert by_kind[KIND_EXEC_ONCE] == 1 and by_kind[KIND_EXEC_PREFIX] == 1

    b.delete_key("live", KIND_EXEC_ONCE)
    assert b.rows_for_kinds([KIND_EXEC_ONCE]) == []


def test_memory_rows_for_kind_dedupes_by_cache_key() -> None:
    b = _MemoryBackend()
    b.upsert(SCOPE_SESSION, "k", KIND_EXEC_PREFIX, "t", None)
    b.upsert(SCOPE_ALWAYS, "k", KIND_EXEC_PREFIX, "t", None)
    rows = b.rows_for_kind(KIND_EXEC_PREFIX)
    assert len(rows) == 1  # DISTINCT cache_key
    assert rows[0]["cache_key"] == "k"


# ---------------- 模块级 API(进程内后端) ----------------


@pytest.fixture()
def isolated(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> object:
    ap.set_db_path(tmp_path / "grants.db")
    try:
        yield ap
    finally:
        ap.close()
        ap.set_db_path(ap.DEFAULT_DB_PATH)


def test_api_grant_check_revoke_roundtrip(isolated: object) -> None:
    ap.grant(SCOPE_SESSION, "k1", KIND_EXEC_PREFIX, ttl_seconds=3600)
    assert ap.check("k1", KIND_EXEC_PREFIX) == SCOPE_SESSION
    ap.grant(SCOPE_ALWAYS, "k1", KIND_EXEC_PREFIX)
    assert ap.check("k1", KIND_EXEC_PREFIX) == SCOPE_ALWAYS  # always 优先
    ap.revoke("k1", KIND_EXEC_PREFIX)
    assert ap.check("k1", KIND_EXEC_PREFIX) is None
    assert ap.stats()["total"] == 0


def test_api_always_ttl_days_expires(isolated: object) -> None:
    ap.grant(SCOPE_ALWAYS, "k2", KIND_NET, ttl_days=0)
    # ttl_days=0 ⇒ expires_at == created_at ⇒ 已过期(判据是严格大于 now)
    assert ap.check("k2", KIND_NET) is None


def test_api_rejects_illegal_scope_and_kind(isolated: object) -> None:
    with pytest.raises(ValueError):
        ap.grant("global", "k", KIND_EXEC_PREFIX)
    with pytest.raises(ValueError):
        ap.grant(SCOPE_SESSION, "k", "nope")
    with pytest.raises(ValueError):
        ap.list_keys("nope")


def test_api_list_keys_filters_expired_session_rows(isolated: object) -> None:
    ap.grant(SCOPE_SESSION, "dead", KIND_EXEC_PREFIX, ttl_seconds=0)
    ap.grant(SCOPE_SESSION, "alive", KIND_EXEC_PREFIX, ttl_seconds=3600)
    ap.grant(SCOPE_ALWAYS, "forever", KIND_EXEC_PREFIX)
    keys = ap.list_keys(KIND_EXEC_PREFIX)
    assert set(keys) == {"alive", "forever"}
    # list_keys 不顺手删,清理走 purge_expired
    assert ap.purge_expired() == 1
    assert ap.stats()["total"] == 2


def test_api_list_grant_rows_projects_details(isolated: object) -> None:
    ap.grant(SCOPE_SESSION, "a", KIND_EXEC_ONCE, ttl_seconds=60)
    rows = ap.list_grant_rows([KIND_EXEC_ONCE, KIND_NET])
    assert len(rows) == 1
    row = rows[0]
    assert row["cache_key"] == "a"
    assert row["scope"] == SCOPE_SESSION
    assert set(row) == {"kind", "cache_key", "scope", "created_at", "expires_at"}


# ---------------- PG 后端(真库) ----------------


def _live_dsn() -> str:
    dsn = os.environ.get("DATABASE_URL", "").strip()
    if dsn:
        return dsn
    env = Path(__file__).resolve().parents[1] / ".env"
    if not env.exists():
        return ""
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip()
    return ""


_LIVE = _live_dsn()


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_pg_backend_roundtrip_and_isolation_by_prefix() -> None:
    prefix = f"r136-{uuid4().hex[:8]}"
    b = _PgBackend(_LIVE)
    try:
        b.upsert(SCOPE_SESSION, f"{prefix}-k1", KIND_EXEC_PREFIX, "2026-01-01T00:00:00Z", "2099-01-01T00:00:00Z")
        assert b.find_session_expiry(f"{prefix}-k1", KIND_EXEC_PREFIX) == (True, "2099-01-01T00:00:00Z")
        # 幂等:同键再写不覆盖 created_at
        b.upsert(SCOPE_SESSION, f"{prefix}-k1", KIND_EXEC_PREFIX, "2027-01-01T00:00:00Z", None)
        rows = [r for r in b.rows_for_kinds([KIND_EXEC_PREFIX]) if str(r["cache_key"]).startswith(prefix)]
        assert len(rows) == 1
        assert rows[0]["created_at"] == "2026-01-01T00:00:00Z"
        # always 行 + session 过期清理
        b.upsert(SCOPE_ALWAYS, f"{prefix}-k2", KIND_NET, "t", None)
        assert b.find_always(f"{prefix}-k2", KIND_NET, "2099-01-01T00:00:00Z") is True
        b.upsert(SCOPE_SESSION, f"{prefix}-k3", KIND_NET, "t", "2020-01-01T00:00:00Z")
        assert b.delete_expired("2026-01-01T00:00:00Z") >= 1
    finally:
        b.close()


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_pg_backend_survives_a_new_instance_and_cleans_up() -> None:
    prefix = f"r136-{uuid4().hex[:8]}"
    key = f"{prefix}-k"
    first = _PgBackend(_LIVE)
    try:
        first.upsert(SCOPE_ALWAYS, key, KIND_EXEC_PREFIX, "t", None)
        assert first.delete_key(key, KIND_EXEC_PREFIX) is None
        first.upsert(SCOPE_ALWAYS, key, KIND_EXEC_PREFIX, "t", None)
    finally:
        first.close()

    second = _PgBackend(_LIVE)
    try:
        assert second.find_always(key, KIND_EXEC_PREFIX, "2099-01-01T00:00:00Z") is True
        total, by_scope, _ = second.stats()
        assert total >= 1
        assert by_scope[SCOPE_ALWAYS] >= 1
        second.delete_key(key, KIND_EXEC_PREFIX)
        assert second.find_always(key, KIND_EXEC_PREFIX, "2099-01-01T00:00:00Z") is False
    finally:
        second.close()


def test_ddl_is_postgres_flavoured_and_has_conflict_target() -> None:
    ddl = ap._SCHEMA_DDL
    assert "AUTOINCREMENT" not in ddl
    assert "GENERATED ALWAYS AS IDENTITY" in ddl
    assert "UNIQUE (scope, cache_key, kind)" in ddl


def test_module_has_no_sqlite_any_more() -> None:
    src = (Path(__file__).resolve().parents[1] / "app" / "services" / "approval_persistence.py").read_text(
        encoding="utf-8"
    )
    assert "sqlite" + "3" not in src
    assert "INSERT OR IGNORE" not in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
