# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MemorySweeper 迁到 PostgreSQL 后的行为锁。

两层断面:
- 纯判据(不起连接):`PgShim` 的 `?`→`$n` 翻译、切句、DDL 必须是 PG 方言;
- 真库往返(本机 PG 可连时跑):增删改查 + 两层清扫策略 + 复活 + 审计日志。

真库面的用户前缀唯一(`r135-*`),每例结束按前缀清理,不污染既有数据。
"""

from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

import pytest

from app.core.pg_sync import PgShim, SyncPgError, _bind_placeholders, _split_statements
from app.services import memory_sweeper as ms
from app.services.memory_sweeper import MemorySweeper

_SRC = Path(__file__).resolve().parents[1] / "app" / "services" / "memory_sweeper.py"
_SQLITE_MOD = "sqlite" + "3"  # 拆写:整串不进源码,免得把本文件自己变成命中项

_SELECT_IDS_LIKE = "SELECT memory_id FROM memory_sweeper_memories WHERE user_id LIKE $1"
_DELETE_IDS_LIKE = "DELETE FROM memory_sweeper_memories WHERE user_id = $1"
_DELETE_LOGS_LIKE = "DELETE FROM memory_sweeper_logs WHERE user_id = $1"
_BACKDATE = (
    "UPDATE memory_sweeper_memories SET created_at = ?, last_accessed_at = ?"
    " WHERE memory_id = ?"
)


# ---------------- 纯判据 ----------------


def test_placeholders_become_pg_style_in_order() -> None:
    assert _bind_placeholders("VALUES (?,?,?)", 3) == "VALUES ($1,$2,$3)"
    assert _bind_placeholders("SELECT 1", 0) == "SELECT 1"


def test_placeholder_count_mismatch_fails_loudly() -> None:
    """个数不符必须当场抛:静默错位会把参数塞进别的列,比报错难查得多。"""
    with pytest.raises(SyncPgError):
        _bind_placeholders("VALUES (?,?)", 3)


def test_split_statements_cuts_on_semicolons_and_drops_blanks() -> None:
    parts = _split_statements("CREATE TABLE a (x int);\n;  SELECT 1 ;")
    assert len(parts) == 2
    assert parts[0].startswith("CREATE TABLE a")
    assert parts[1] == "SELECT 1"


def test_ddl_is_postgres_flavoured() -> None:
    ddl = ms._SCHEMA_V1
    assert "AUTOINCREMENT" not in ddl
    assert "GENERATED ALWAYS AS IDENTITY" in ddl
    assert "double precision" in ddl
    assert ddl.count("CREATE TABLE IF NOT EXISTS") == 3
    # 三张表一律加前缀:与同库既有的 session / sso / approval 表互不撞名
    for table in ("memory_sweeper_schema_version", "memory_sweeper_memories", "memory_sweeper_logs"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in ddl


def test_module_no_longer_opens_a_sqlite_file() -> None:
    src = _SRC.read_text(encoding="utf-8")
    assert f"import {_SQLITE_MOD}" not in src
    assert f"{_SQLITE_MOD}.connect" not in src
    assert "PRAGMA" not in src
    assert '"BEGIN IMMEDIATE"' not in src


def test_shim_delegates_select_to_fetchall_and_writes_to_execute() -> None:
    """分派规则要钉住:SELECT 取行,写走 execute,`RETURNING` 也算取行。"""

    class _S:
        def __init__(self) -> None:
            self.calls: list[tuple[str, str]] = []

        def fetchall(self, sql: str, params: object = ()) -> list[dict[str, object]]:
            self.calls.append(("fetch", sql))
            return [{"x": 1}]

        def execute(self, sql: str, params: object = ()) -> None:
            self.calls.append(("exec", sql))

        def close(self) -> None:
            pass

    session = _S()
    shim = PgShim(session)  # type: ignore[arg-type]
    assert shim.execute("SELECT 1 AS x", ()).fetchone() == {"x": 1}
    assert shim.execute("UPDATE t SET a = ?", (1,)).fetchall() == []
    assert shim.execute("INSERT INTO t (a) VALUES (?) RETURNING id", (1,)) .fetchall() == [{"x": 1}]
    assert [c[0] for c in session.calls] == ["fetch", "exec", "fetch"]


# ---------------- 真库往返 ----------------


def _live_dsn() -> str:
    """优先 env,其次 ai-service/.env 的 DATABASE_URL;都没有则跳过这一面。"""
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


@pytest.fixture()
def sweeper() -> object:
    if not _LIVE:
        pytest.skip("无 DATABASE_URL:本机没有可连的 PostgreSQL")
    user = f"r135-{uuid4().hex[:8]}"
    s = MemorySweeper(_LIVE)
    s._test_user = user  # type: ignore[attr-defined]
    try:
        yield s
    finally:
        s._session.execute(_DELETE_IDS_LIKE, (user,))
        s._session.execute(_DELETE_LOGS_LIKE, (user,))
        s.close()


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_add_and_read_back(sweeper: MemorySweeper) -> None:
    user = sweeper._test_user  # type: ignore[attr-defined]
    rec = sweeper.add_memory(user, "hello", importance=1.7, metadata={"k": "v"})
    assert rec["importance"] == 1.0  # 夹到 [0,1]
    got = sweeper.get_memory(rec["memory_id"])
    assert got is not None
    assert got["content"] == "hello"
    assert got["swept"] is False
    assert got["metadata"] == {"k": "v"}
    assert sweeper.get_memory("r135-nope") is None


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_access_bumps_and_revives(sweeper: MemorySweeper) -> None:
    user = sweeper._test_user  # type: ignore[attr-defined]
    mid = sweeper.add_memory(user, "a", importance=0.3)["memory_id"]
    bumped = sweeper.access_memory(mid, boost=0.1)
    assert bumped is not None
    assert bumped["access_count"] == 1
    assert abs(bumped["importance"] - 0.4) < 1e-9

    # 手工打成已 sweep,再 access 应当复活
    sweeper._shim.execute(
        "UPDATE memory_sweeper_memories SET swept = 1, swept_at = ?, swept_reason = ?"
        " WHERE memory_id = ?",
        (1.0, "stale_low_importance", mid),
    )
    revived = sweeper.access_memory(mid, boost=0.01)
    assert revived is not None
    assert revived["swept"] is False
    assert revived["swept_reason"] is None


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_list_filters_swept_and_reports_totals(sweeper: MemorySweeper) -> None:
    user = sweeper._test_user  # type: ignore[attr-defined]
    for i in range(3):
        sweeper.add_memory(user, f"m{i}")
    first = sweeper.list_memories(user)["memories"][0]["memory_id"]
    sweeper._shim.execute(
        "UPDATE memory_sweeper_memories SET swept = 1 WHERE memory_id = ?", (first,)
    )

    loose = sweeper.list_memories(user)
    assert loose["total"] == 2
    assert loose["has_more"] is False
    all_rows = sweeper.list_memories(user, include_swept=True)
    assert all_rows["total"] == 3

    page = sweeper.list_memories(user, limit=1)
    assert len(page["memories"]) == 1
    # has_more 口径 = offset + 本页行数 < total(既有语义,不在迁移里改)
    assert page["has_more"] is True
    last = sweeper.list_memories(user, limit=1, offset=1)
    assert last["has_more"] is False


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_sweep_layer1_stale_then_layer2_overflow(sweeper: MemorySweeper) -> None:
    user = sweeper._test_user  # type: ignore[attr-defined]
    old = 1_000_000.0  # 远早于 30 天窗口
    stale = sweeper.add_memory(user, "stale", importance=0.1)["memory_id"]
    sweeper._shim.execute(_BACKDATE, (old, old, stale))
    # 4 条新鲜记忆,importance 0.9/0.8/0.7/0.6;cap=2 ⇒ 溢出应淘汰最冷 0.6 与 0.7
    warm = [sweeper.add_memory(user, f"w{i}", importance=v)["memory_id"] for i, v in enumerate((0.9, 0.8, 0.7, 0.6))]

    report = sweeper.sweep(user, max_memories_per_user=2)
    assert report["unswept_before"] == 5
    assert set(report["swept_ids"]) == {stale, warm[2], warm[3]}
    assert report["swept"] == 3

    reasons = {
        r["memory_id"]: r["swept_reason"]
        for r in sweeper.list_memories(user, include_swept=True)["memories"]
    }
    assert reasons[stale] == "stale_low_importance"
    assert reasons[warm[2]] == "capacity_overflow"
    assert reasons[warm[0]] is None


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_dry_run_persists_nothing(sweeper: MemorySweeper) -> None:
    user = sweeper._test_user  # type: ignore[attr-defined]
    stale = sweeper.add_memory(user, "stale", importance=0.1)["memory_id"]
    sweeper._shim.execute(_BACKDATE, (1_000_000.0, 1_000_000.0, stale))

    dry = sweeper.sweep(user, dry_run=True)
    assert dry["would_sweep"] == 1
    assert dry["swept"] == 0
    assert dry["swept_at"] is None
    assert sweeper.get_memory(stale)["swept"] is False  # type: ignore[index]
    assert sweeper.recent_sweeps(user) == []  # dry_run 不写审计


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_sweep_logs_are_audited_and_survive_reopen(sweeper: MemorySweeper) -> None:
    user = sweeper._test_user  # type: ignore[attr-defined]
    mid = sweeper.add_memory(user, "x", importance=0.1)["memory_id"]
    sweeper._shim.execute(_BACKDATE, (1_000_000.0, 1_000_000.0, mid))
    sweeper.sweep(user)

    logs = sweeper.recent_sweeps(user)
    assert len(logs) == 1
    assert logs[0]["swept_count"] == 1
    assert logs[0]["strategy"]["max_age_days"] == 30
    assert isinstance(logs[0]["id"], int)

    fresh = MemorySweeper(_LIVE)  # 等价于重启进程:DDL 幂等、版本行不重复、审计还在
    try:
        assert fresh.recent_sweeps(user)[0]["swept_count"] == 1
        rows = fresh._shim.execute(
            "SELECT COUNT(*) AS c FROM memory_sweeper_schema_version WHERE version = ?",
            (1,),
        ).fetchall()
        assert int(rows[0]["c"]) == 1
    finally:
        fresh.close()


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_missing_dsn_fails_closed() -> None:
    with pytest.raises(SyncPgError):
        MemorySweeper("   ")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
