# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工单账的 PG 存储面(机主 2026-11-19 定档:数据层只允许 PostgreSQL)。

不连真库的判据:用一个**按我们自己的 SQL 常量**分派的假连接,钉住
「列序 / 淘汰顺序 / update-first-then-insert / 唯一键回改」这几条语义 ——
SQL 常量与模块同一份(import 过来),不复制字符串,常量一改这里立刻红。
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from pathlib import Path
from typing import Any
from uuid import uuid4

import pytest

from app.core.pg_sync import SyncPgError, SyncPgSession
from app.services import work_admission as wa
from app.services.work_admission import (
    _INSERT_TICKET,
    _SELECT_BY_TICKET,
    _SELECT_BY_TRIGGER,
    _SELECT_COUNT,
    _SELECT_OLDEST_CLOSED,
    _UPDATE_BY_TRIGGER,
    _UPDATE_TICKET,
    Mandate,
    MemoryTicketStore,
    PgTicketStore,
    TicketRec,
)

_INSERT_MARK = '$1'


def _rec(ticket_id: str, trigger_id: str, *, open_: bool = True) -> TicketRec:
    return TicketRec(
        ticket_id=ticket_id,
        trigger_id=trigger_id,
        mandate=Mandate(
            policy_version="pv-1",
            scope="chat",
            strength="explicit",
            matched_rule_ids=("r1",),
            actor_id="u1",
            source="chat",
        ),
        open=open_,
        stopped_by_person=False,
        assignment="pending",
        allowed_actors=frozenset({"u1"}),
        last_report=None,
        simulation=False,
    )


_UPDATE_TICKET_KEYS = (
    "trigger_id",
    "policy_version",
    "scope",
    "strength",
    "matched_rule_ids",
    "actor_id",
    "source",
    "is_open",
    "stopped_by_person",
    "assignment",
    "allowed_actors",
    "last_report",
    "simulation",
    "ticket_id",
)

_UPDATE_BY_TRIGGER_KEYS = (
    "ticket_id",
    "policy_version",
    "scope",
    "strength",
    "matched_rule_ids",
    "actor_id",
    "source",
    "is_open",
    "stopped_by_person",
    "assignment",
    "allowed_actors",
    "last_report",
    "simulation",
    "trigger_id",
)


class _FakeSession:
    """按本模块 SQL 常量分派的假连接:只实现被调到的几型。"""

    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
        self.inserts: list[tuple[Any, ...]] = []
        self.updated = 0
        self.closed = 0

    def fetchrow(self, sql: str, params: Sequence[Any] = ()) -> dict[str, Any] | None:
        if sql == _SELECT_BY_TRIGGER:
            for row in self.rows.values():
                if row["trigger_id"] == params[0]:
                    return dict(row)
            return None
        if sql == _SELECT_BY_TICKET:
            row = self.rows.get(str(params[0]))
            return dict(row) if row is not None else None
        raise AssertionError(f'fetchrow 收到未登记的 SQL: {sql[:40]}')

    def fetchval(self, sql: str, params: Sequence[Any] = ()) -> Any:
        if sql == _SELECT_COUNT:
            return len(self.rows)
        raise AssertionError(f'fetchval 收到未登记的 SQL: {sql[:40]}')

    def execute(self, sql: str, params: Sequence[Any] = ()) -> str:
        if sql == _INSERT_TICKET:
            vals = tuple(params)
            self.inserts.append(vals)
            if _INSERT_MARK not in sql:
                raise AssertionError('插入语句的占位符不是 PG 形态')
            ticket_id = str(vals[0])
            if ticket_id in self.rows:
                raise ValueError('duplicate ticket_id')
            for row in self.rows.values():
                if row["trigger_id"] == vals[1]:
                    raise ValueError('duplicate trigger_id')
            keys = (
                "ticket_id",
                "trigger_id",
                "policy_version",
                "scope",
                "strength",
                "matched_rule_ids",
                "actor_id",
                "source",
                "is_open",
                "stopped_by_person",
                "assignment",
                "allowed_actors",
                "last_report",
                "simulation",
            )
            self.rows[ticket_id] = dict(zip(keys, vals, strict=True))
            return 'INSERT 0 1'
        if sql == _UPDATE_TICKET:
            ticket_id = str(params[13])
            row = self.rows.get(ticket_id)
            if row is None:
                return 'UPDATE 0'
            row.update(dict(zip(_UPDATE_TICKET_KEYS, params, strict=True)))
            self.updated += 1
            return 'UPDATE 1'
        if sql == _UPDATE_BY_TRIGGER:
            trigger_id = str(params[13])
            for row in self.rows.values():
                if row["trigger_id"] == trigger_id:
                    row.update(dict(zip(_UPDATE_BY_TRIGGER_KEYS, params, strict=True)))
                    self.updated += 1
                    return 'UPDATE 1'
            return 'UPDATE 0'
        if sql == _SELECT_OLDEST_CLOSED:
            for ticket_id, row in list(self.rows.items()):
                if int(row["is_open"]) == 0:
                    self.rows.pop(ticket_id)
                    return 'DELETE 1'
            return 'DELETE 0'
        raise AssertionError(f'execute 收到未登记的 SQL: {sql[:40]}')

    def close(self) -> None:
        self.closed += 1


def _store(limit: int = wa._LEDGER_LIMIT) -> tuple[PgTicketStore, _FakeSession]:
    store = PgTicketStore("postgresql://fake/db", limit=limit)
    fake = _FakeSession()
    store._session = fake  # type: ignore[assignment]  # 只为不连库
    return store, fake


def test_module_no_longer_imports_sqlite() -> None:
    src = Path(wa.__file__).read_text(encoding="utf-8")
    assert "import sqlite3" not in src
    assert "sqlite3.connect(" not in src
    assert "class SqliteTicketStore" not in src
    assert "class PgTicketStore" in src


def test_add_then_find_trigger_roundtrips() -> None:
    store, fake = _store()
    rec = _rec("tk1", "tr1")
    assert store.add(rec) is True
    got = store.find_trigger("tr1")
    assert got is not None
    assert got.ticket_id == "tk1"
    assert got.mandate.policy_version == "pv-1"
    assert store.get("tk1") is not None
    assert len(store) == 1
    assert fake.inserts and fake.inserts[0][0] == "tk1"


def test_add_same_ticket_id_is_idempotent_true() -> None:
    store, _ = _store()
    assert store.add(_rec("tk1", "tr1")) is True
    assert store.add(_rec("tk1", "tr1")) is True
    assert len(store) == 1


def test_full_ledger_with_only_open_tickets_refuses_new() -> None:
    store, _ = _store(limit=2)
    assert store.add(_rec("tk1", "tr1")) is True
    assert store.add(_rec("tk2", "tr2")) is True
    assert store.add(_rec("tk3", "tr3")) is False
    assert len(store) == 2


def test_full_ledger_evicts_oldest_closed_then_accepts() -> None:
    store, _ = _store(limit=2)
    assert store.add(_rec("tk1", "tr1", open_=False)) is True
    assert store.add(_rec("tk2", "tr2")) is True
    assert store.add(_rec("tk3", "tr3")) is True
    assert store.get("tk1") is None
    assert store.get("tk3") is not None


def test_save_updates_existing_row_and_does_not_insert() -> None:
    store, fake = _store()
    store.add(_rec("tk1", "tr1"))
    before = len(fake.inserts)
    changed = _rec("tk1", "tr1", open_=False)
    store.save(changed)
    assert store.get("tk1") is not None
    assert store.get("tk1").open is False  # type: ignore[union-attr]
    assert len(fake.inserts) == before
    assert fake.updated == 1


def test_save_inserts_when_row_absent() -> None:
    store, fake = _store()
    store.save(_rec("tk9", "tr9"))
    assert len(fake.inserts) == 1
    assert store.get("tk9") is not None


def test_close_is_idempotent_and_releases_session() -> None:
    store, fake = _store()
    store.add(_rec("tk1", "tr1"))
    store.close()
    assert fake.closed == 1
    store.close()
    assert fake.closed == 1


def test_memory_store_still_used_without_dsn() -> None:
    assert isinstance(wa._default_store(), MemoryTicketStore)


def test_sync_session_refuses_empty_dsn() -> None:
    with pytest.raises(SyncPgError, match="非空 DSN"):
        SyncPgSession("")
    with pytest.raises(SyncPgError, match="非空 DSN"):
        SyncPgSession("   ")


def test_sync_session_close_before_open_is_safe() -> None:
    session = SyncPgSession("postgresql://fake/db")
    session.close()
    session.close()
    with pytest.raises(SyncPgError, match="已关闭"):
        session.fetchval("SELECT 1")


# ---------------- 真库往返(本机 PG 可连时跑)----------------


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

_SELECT_TRIGGERS_LIKE = (
    "SELECT trigger_id FROM work_admission_tickets WHERE trigger_id LIKE $1"
)
_DELETE_TRIGGER = "DELETE FROM work_admission_tickets WHERE trigger_id = $1"


@pytest.mark.skipif(not _LIVE, reason="无 DATABASE_URL:本机没有可连的 PostgreSQL")
def test_live_roundtrip_survives_a_new_store_instance() -> None:
    """换一个 store 实例(等价于重启进程)后,同一 trigger 的终态还在,且不会再派一次。"""
    prefix = f"r134-rt-{uuid4().hex[:8]}"
    store = PgTicketStore(_LIVE)
    try:
        assert store.add(_rec(f"{prefix}-t1", f"{prefix}-g1")) is True
        dropped = _rec(f"{prefix}-t2", f"{prefix}-g2", open_=False)
        assert store.add(dropped) is True
        store.save(_rec(f"{prefix}-t2", f"{prefix}-g2", open_=False))
    finally:
        store.close()

    fresh = PgTicketStore(_LIVE)
    try:
        run = fresh.find_trigger(f"{prefix}-g1")
        gone = fresh.find_trigger(f"{prefix}-g2")
        assert run is not None
        assert run.open is True
        assert run.mandate.policy_version == "pv-1"
        assert gone is not None
        assert gone.open is False
    finally:
        session = fresh._session_()
        for row in session.fetchall(_SELECT_TRIGGERS_LIKE, (f"{prefix}-%",)):
            session.execute(_DELETE_TRIGGER, (row["trigger_id"],))
        fresh.close()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
