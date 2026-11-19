# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815919 测试:会话"归档"是一等列,不是删除的副产品。

验收判据(零生产库,全部落 tmp_path 独立 PostgreSQL schema,照 conftest 的隔离形态):
1. 删除后原表该行按业务读路径不可读;
2. 同一行的归档标记可查且带时刻;
3. 归档标记不会被普通列表查询当成活会话;
4. 正向对照:未删除的会话归档列为空(逐行判列,不是只看列表前几条 ——
   否则"整表都标归档"也算通过)。
判据成对:归档落列 / 读过滤 / 删除入口接线任一处被删掉,本文件必有红。
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Any

from app.services.agent_engine import AgentEngine
from app.services.session_store import SessionStore, UserMessageItem


class _FakeLoop:
    async def run(self, messages):  # pragma: no cover - 不跑到
        raise AssertionError("G-815919 测试不应触发 LLM 运行")

    async def resume_from_checkpoint(self, checkpoint_id):  # pragma: no cover
        raise AssertionError

    async def interrupt(self, mode="cancel"):  # pragma: no cover
        return None


async def _rpc(engine, method, params, req_id=1, emit=None):
    response = await engine.handle_message(
        {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params},
        emit=emit,
    )
    assert response is not None and "error" not in response, response
    return response["result"]


class _Collector:
    def __init__(self):
        self.events: list[tuple[str, dict]] = []

    async def __call__(self, message):
        params = message.get("params") or {}
        self.events.append((params.get("event", ""), params.get("payload") or {}))

    def payloads(self, name):
        return [p for e, p in self.events if e == name]


def _engine_with_store(tmp_path):
    async def factory(spec, host_tools):
        return _FakeLoop()

    store = SessionStore(str(tmp_path / "g815919.db"))
    return AgentEngine(loop_factory=factory, store=store), store


def _raw_thread_row(store: SessionStore, thread_id: str) -> Any | None:
    """直读原表那一行的归档列(判"列"本身,不经业务读路径)。"""
    with store._lock:
        return store._conn.execute(
            "SELECT archived, archived_at FROM threads WHERE thread_id = ?",
            (thread_id,),
        ).fetchone()


def _seed_thread(store: SessionStore, thread_id: str, content: str = "q") -> None:
    store.create_thread(thread_id=thread_id, title=thread_id)
    t = store.start_turn(thread_id)
    store.append_item(t.turn_id, UserMessageItem(content=content), thread_id=thread_id)
    store.end_turn(t.turn_id)


# =============================================================================
# 迁移:v4 落列 + 进 journal(离线判据:临时库,不连任何生产库)
# =============================================================================


def test_migration_v4_archived_at_in_journal_offline(tmp_path):
    """全新临时库:打开即迁移到 v4,archived_at 列存在且 journal 有 v4 记录。"""
    store = SessionStore(str(tmp_path / "mig.db"))
    assert store.schema_version == 4
    with store._lock:
        cols = {
            r["name"]
            for r in store._conn.execute(
                "SELECT column_name AS name FROM information_schema.columns"
                " WHERE table_schema = current_schema() AND table_name = 'threads'"
            ).fetchall()
        }
        journal = store._conn.execute(
            "SELECT applied_at FROM schema_version WHERE version = 4"
        ).fetchone()
    assert "archived_at" in cols
    assert journal is not None
    store.close()


def test_migration_v4_upgrades_legacy_v3_db(tmp_path):
    """v3 旧库(无 archived_at / row_ord 列)打开即补列并记 journal,既有数据行保留。

    2026-11-19 起引擎是 PostgreSQL:legacy 库按"v1 基线形状"直接建在 PG 的独立
    schema 里(与 sqlite 时代的冻结历史形状等价 —— schema 名由 db_path 派生,
    所以预建的表会被同一个 SessionStore 打开并迁移)。
    """
    db = tmp_path / "legacy_v3.db"
    from app.core.pg_sync import SyncPgSession
    from app.services.session_store import _resolve_dsn, _schema_name_for

    dsn = _resolve_dsn()
    session = SyncPgSession(dsn)
    schema = _schema_name_for(db)
    session.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    session.execute(f'CREATE SCHEMA "{schema}"')
    session.execute(f'SET search_path TO "{schema}"')
    session.execute(
        """
        CREATE TABLE schema_version (
            version     integer PRIMARY KEY,
            applied_at  double precision NOT NULL,
            description text NOT NULL DEFAULT ''
        )
        """
    )
    session.execute("CREATE TABLE meta (key text PRIMARY KEY, value text NOT NULL)")
    session.execute("INSERT INTO meta (key, value) VALUES ('last_seq', '0')")
    session.execute(
        """
        CREATE TABLE threads (
            thread_id         text PRIMARY KEY,
            title             text NOT NULL DEFAULT '',
            created_at        double precision NOT NULL,
            updated_at        double precision NOT NULL,
            metadata          text NOT NULL DEFAULT '{}',
            parent_thread_id  text,
            fork_point_seq    integer,
            fork_mode         text,
            archived          integer NOT NULL DEFAULT 0,
            FOREIGN KEY (parent_thread_id) REFERENCES threads(thread_id)
        )
        """
    )
    session.execute(
        "INSERT INTO threads (thread_id, title, created_at, updated_at)"
        " VALUES ('thr_legacy', '旧会话', 1.0, 1.0)"
    )
    for version, desc in ((1, 'legacy baseline'), (2, 'legacy fts5'), (3, 'legacy relay')):
        session.execute(
            "INSERT INTO schema_version (version, applied_at, description) VALUES ($1,$2,$3)",
            (version, 0.0, desc),
        )
    session.close()

    store = SessionStore(str(db))  # 打开即迁移(独立 schema)
    assert store.schema_version == 4
    row = store.get_thread("thr_legacy", include_archived=True)
    assert row is not None
    assert row.archived is False and row.archived_at is None
    store.close()


# =============================================================================
# store 层主判据
# =============================================================================


def test_delete_tombstone_unreadable_but_marked_with_time(tmp_path):
    """判据1+2:删除后业务读路径不可读;同一行墓碑可查且带时刻;行未消失。"""
    store = SessionStore(str(tmp_path / "a.db"))
    _seed_thread(store, "thr_doomed")
    assert store.get_thread("thr_doomed") is not None  # 前置:删除前业务可读

    assert store.archive_thread("thr_doomed") == 1

    # 判据1:业务读路径(get_thread)不可读
    assert store.get_thread("thr_doomed") is None
    # 判据2:同一行的归档标记可查且带时刻(include_archived=恢复面专用读)
    tomb = store.get_thread("thr_doomed", include_archived=True)
    assert tomb is not None
    assert tomb.archived is True
    assert isinstance(tomb.archived_at, float) and tomb.archived_at > 0
    # 行没有消失:items 保留,"这条会话当时是什么状态"问库可答
    assert store.list_items("thr_doomed") != []
    # 重复归档幂等返回 0(引擎第二次删 deleted=False 的地基)
    assert store.archive_thread("thr_doomed") == 0


def test_list_threads_never_treats_tombstone_as_active(tmp_path):
    """判据3:普通列表查询不把墓碑当活会话;include_archived 才可见。"""
    store = SessionStore(str(tmp_path / "b.db"))
    _seed_thread(store, "thr_live")
    _seed_thread(store, "thr_gone")
    assert store.archive_thread("thr_gone") == 1

    page = store.list_threads()
    ids = [t.thread_id for t in page.threads]
    assert "thr_gone" not in ids
    assert "thr_live" in ids
    assert page.total == 1

    full = store.list_threads(include_archived=True)
    assert full.total == 2
    assert {"thr_live", "thr_gone"} <= {t.thread_id for t in full.threads}


def test_untouched_thread_archive_column_is_null(tmp_path):
    """判据4 正向对照:未删除的会话归档列为空,逐行判列。"""
    store = SessionStore(str(tmp_path / "c.db"))
    _seed_thread(store, "thr_fresh")
    _seed_thread(store, "thr_also_fresh")
    for tid in ("thr_fresh", "thr_also_fresh"):
        row = _raw_thread_row(store, tid)
        assert row is not None
        assert row["archived"] == 0 and row["archived_at"] is None
        t = store.get_thread(tid, include_archived=True)
        assert t is not None and t.archived_at is None


def test_set_thread_archived_keeps_marker_in_sync(tmp_path):
    """thread/archive 布尔入口与墓碑时刻同写同清:置档带时刻,恢复清空。"""
    store = SessionStore(str(tmp_path / "d.db"))
    _seed_thread(store, "thr_toggle")
    assert store.set_thread_archived("thr_toggle", True) is True
    row = _raw_thread_row(store, "thr_toggle")
    assert row is not None
    assert row["archived"] == 1 and row["archived_at"] is not None
    assert store.get_thread("thr_toggle") is None  # 布尔归档同样退出业务读

    assert store.set_thread_archived("thr_toggle", False) is True
    row2 = _raw_thread_row(store, "thr_toggle")
    assert row2 is not None
    assert row2["archived"] == 0 and row2["archived_at"] is None
    assert store.get_thread("thr_toggle") is not None


# =============================================================================
# 引擎层:删除入口(thread/delete)接线
# =============================================================================


async def test_engine_thread_delete_leaves_tombstone(tmp_path):
    """删除入口落墓碑而非物理级联;幂等契约(第二次删 deleted=False)保持。"""
    engine, store = _engine_with_store(tmp_path)
    collector = _Collector()
    tid = (await _rpc(engine, "thread.start", {"model": "test"}, emit=collector))[
        "threadId"
    ]
    t = store.start_turn(tid)
    store.append_item(
        t.turn_id, UserMessageItem(content="要被删的会话"), thread_id=tid
    )
    store.end_turn(t.turn_id)

    r = await _rpc(engine, "thread.delete", {"threadId": tid}, emit=collector)
    assert r["deleted"] is True
    assert tid not in engine._threads  # 内存摘除
    assert collector.payloads("thread.deleted")

    # 墓碑在原表、带时刻;业务读不可读;数据可追认
    row = _raw_thread_row(store, tid)
    assert row is not None
    assert row["archived"] == 1 and row["archived_at"] is not None
    assert store.get_thread(tid) is None
    assert store.list_items(tid) != []

    # 幂等:再删返回 deleted=False(批45 契约不变)
    r2 = await _rpc(engine, "thread.delete", {"threadId": tid}, emit=collector)
    assert r2["deleted"] is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
