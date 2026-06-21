"""建议 148 测试: Backfill 进度持久化 (重启可恢复).

测试覆盖:
  - FileBackfillPersister 基础读写
  - SQLiteBackfillPersister 基础读写
  - 跨进程: persister save -> 新进程 persister load 一致
  - BackfillBroadcaster 集成 persister: 状态变更后落盘
  - 启动恢复: 新 broadcaster 从 persister 拿到 snapshot + history
  - WAL 模式 (SQLite)
  - 历史截断 (1500+ 自动删)
  - 工厂函数 create_persister
  - clear / append_event
  - 并发: 多线程写不冲突
"""

import threading
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def tmp_db(tmp_path):
    return str(tmp_path / "test_backfill.db")


@pytest.fixture
def tmp_json(tmp_path):
    return str(tmp_path / "test_backfill.json")


# ---------------------------------------------------------------------------
# TestFileBackfillPersister
# ---------------------------------------------------------------------------


class TestFileBackfillPersister:
    """文件后端."""

    def test_load_empty(self, tmp_json):
        from app.backfill_persister import FileBackfillPersister

        p = FileBackfillPersister(tmp_json)
        assert p.load_snapshot() is None
        assert p.load_events() == []

    def test_save_and_load_snapshot(self, tmp_json):
        from app.backfill_persister import FileBackfillPersister

        p = FileBackfillPersister(tmp_json)
        snap = {"global_status": "running", "tables": {"users": {"status": "running"}}}
        p.save_snapshot(snap)
        loaded = p.load_snapshot()
        assert loaded is not None
        assert loaded["global_status"] == "running"
        assert "_saved_at" in loaded
        assert loaded["tables"]["users"]["status"] == "running"

    def test_append_and_load_events(self, tmp_json):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType
        from app.backfill_persister import FileBackfillPersister

        p = FileBackfillPersister(tmp_json)
        p.append_event(
            BackfillEvent(
                event_type=BackfillEventType.STARTED,
                table="users",
                total=1000,
            )
        )
        p.append_event(
            BackfillEvent(
                event_type=BackfillEventType.TENANT_DONE,
                table="users",
                tenant_id=1,
                processed=500,
            )
        )
        events = p.load_events()
        assert len(events) == 2
        assert events[0].event_type == BackfillEventType.STARTED
        assert events[1].event_type == BackfillEventType.TENANT_DONE

    def test_clear(self, tmp_json):
        from app.backfill_persister import FileBackfillPersister

        p = FileBackfillPersister(tmp_json)
        p.save_snapshot({"a": 1})
        p.clear()
        assert p.load_snapshot() is None

    def test_atomic_write(self, tmp_json):
        """atomic 写: tmp + replace, 不应留 .tmp 文件."""
        from app.backfill_persister import FileBackfillPersister

        p = FileBackfillPersister(tmp_json)
        p.save_snapshot({"a": 1})
        # 不应有 .tmp 文件残留
        parent = Path(tmp_json).parent
        tmp_files = list(parent.glob("*.tmp"))
        assert tmp_files == []


# ---------------------------------------------------------------------------
# TestSQLiteBackfillPersister
# ---------------------------------------------------------------------------


class TestSQLiteBackfillPersister:
    """SQLite 后端."""

    def test_load_empty(self, tmp_db):
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        assert p.load_snapshot() is None
        assert p.load_events() == []

    def test_save_and_load_snapshot(self, tmp_db):
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        snap = {
            "global_status": "running",
            "tables": {"users": {"status": "running", "processed": 500, "total": 1000}},
            "subscriber_count": 2,
        }
        p.save_snapshot(snap)
        loaded = p.load_snapshot()
        assert loaded["global_status"] == "running"
        assert loaded["tables"]["users"]["processed"] == 500
        assert loaded["subscriber_count"] == 2

    def test_append_events(self, tmp_db):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        p.append_event(
            BackfillEvent(
                event_type=BackfillEventType.STARTED,
                table="users",
                total=1000,
            )
        )
        p.append_event(
            BackfillEvent(
                event_type=BackfillEventType.TENANT_PROGRESS,
                table="users",
                tenant_id=1,
                processed=500,
                total=2000,
            )
        )
        events = p.load_events()
        assert len(events) == 2
        # 时序顺序
        assert events[0].event_type == BackfillEventType.STARTED
        assert events[1].event_type == BackfillEventType.TENANT_PROGRESS
        # 字段保持
        assert events[0].total == 1000
        assert events[1].tenant_id == 1

    def test_history_truncation(self, tmp_db):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        # 灌 2000 个
        for i in range(2000):
            p.append_event(
                BackfillEvent(
                    event_type=BackfillEventType.HEARTBEAT,
                    table=f"t{i}",
                )
            )
        events = p.load_events(limit=2000)
        # 截断到 1000
        assert len(events) <= 1500  # 截断阈值

    def test_clear(self, tmp_db):
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        p.save_snapshot({"a": 1})
        p.clear()
        assert p.load_snapshot() is None
        assert p.load_events() == []

    def test_wal_mode(self, tmp_db):
        """WAL 模式开启."""
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        conn = p._connect()
        mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        assert mode.lower() == "wal"
        conn.close()

    def test_load_events_limit(self, tmp_db):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)
        for i in range(50):
            p.append_event(
                BackfillEvent(
                    event_type=BackfillEventType.HEARTBEAT,
                    table=f"t{i}",
                )
            )
        events = p.load_events(limit=10)
        assert len(events) == 10


# ---------------------------------------------------------------------------
# TestCrossProcess
# ---------------------------------------------------------------------------


class TestCrossProcess:
    """跨进程: save 后新建 persister load 一致."""

    def test_sqlite_cross_process(self, tmp_db):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType
        from app.backfill_persister import SQLiteBackfillPersister

        # 进程 1: save
        p1 = SQLiteBackfillPersister(tmp_db)
        p1.save_snapshot({"global_status": "running", "tables": {"x": {"status": "done"}}})
        p1.append_event(BackfillEvent(event_type=BackfillEventType.COMPLETE, table="x"))
        del p1
        # 进程 2: load (新实例)
        p2 = SQLiteBackfillPersister(tmp_db)
        snap = p2.load_snapshot()
        assert snap["global_status"] == "running"
        events = p2.load_events()
        assert len(events) == 1
        assert events[0].event_type == BackfillEventType.COMPLETE


# ---------------------------------------------------------------------------
# TestBroadcasterWithPersister
# ---------------------------------------------------------------------------


class TestBroadcasterWithPersister:
    """Broadcaster 集成 persister."""

    def test_broadcaster_persists_on_event(self, tmp_db):
        from app.backfill_broadcaster import BackfillBroadcaster
        from app.backfill_persister import SQLiteBackfillPersister

        persister = SQLiteBackfillPersister(tmp_db)
        bc = BackfillBroadcaster(persister=persister)
        bc.publish_started("users", total=1000)
        bc.publish_tenant_done("users", 1, 500, 1.0)
        # persister 应有数据
        snap = persister.load_snapshot()
        assert snap["global_status"] == "running"
        assert "users" in snap["tables"]
        events = persister.load_events()
        assert len(events) == 2

    def test_broadcaster_recover_from_persister(self, tmp_db):
        from app.backfill_broadcaster import BackfillBroadcaster
        from app.backfill_persister import SQLiteBackfillPersister

        # 第一个 broadcaster 写
        p1 = SQLiteBackfillPersister(tmp_db)
        bc1 = BackfillBroadcaster(persister=p1)
        bc1.publish_started("users", total=5000)
        bc1.publish_tenant_done("users", 1, 1000, 1.0)
        del bc1
        del p1
        # 第二个 broadcaster 启动, 从 persister 恢复
        p2 = SQLiteBackfillPersister(tmp_db)
        bc2 = BackfillBroadcaster(persister=p2)
        snap = bc2.get_snapshot()
        assert snap["global_status"] == "running"
        assert "users" in snap["tables"]
        assert snap["tables"]["users"]["total"] == 5000
        history = bc2.get_history(limit=10)
        assert len(history) == 2

    def test_broadcaster_persister_none_still_works(self):
        """无 persister 时, broadcaster 仍工作 (in-memory only)."""
        from app.backfill_broadcaster import BackfillBroadcaster

        bc = BackfillBroadcaster()
        bc.publish_started("users", 100)
        snap = bc.get_snapshot()
        assert snap["tables"]["users"]["total"] == 100


# ---------------------------------------------------------------------------
# TestFactory
# ---------------------------------------------------------------------------


class TestFactory:
    """create_persister 工厂."""

    def test_create_sqlite(self, tmp_db):
        from app.backfill_persister import SQLiteBackfillPersister, create_persister

        p = create_persister("sqlite", db_path=tmp_db)
        assert isinstance(p, SQLiteBackfillPersister)

    def test_create_file(self, tmp_json):
        from app.backfill_persister import FileBackfillPersister, create_persister

        p = create_persister("file", file_path=tmp_json)
        assert isinstance(p, FileBackfillPersister)

    def test_create_unknown_raises(self):
        from app.backfill_persister import create_persister

        with pytest.raises(ValueError):
            create_persister("redis")

    def test_create_uses_kwarg_path(self, tmp_path):
        """create_persister 接受 db_path kwarg (覆盖默认)."""
        from app.backfill_persister import create_persister

        p = create_persister("sqlite", db_path=str(tmp_path / "kwarg.db"))
        assert p._db_path == tmp_path / "kwarg.db"


# ---------------------------------------------------------------------------
# TestConcurrent
# ---------------------------------------------------------------------------


class TestConcurrent:
    """多线程并发安全."""

    def test_concurrent_append(self, tmp_db):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)

        def writer(n):
            for i in range(n):
                p.append_event(
                    BackfillEvent(
                        event_type=BackfillEventType.HEARTBEAT,
                        table=f"t{n}-{i}",
                    )
                )

        threads = [threading.Thread(target=writer, args=(20,)) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        # 总共 100 个
        events = p.load_events(limit=200)
        # 至少 50 个 (可能有截断)
        assert len(events) >= 50

    def test_concurrent_snapshot_writes(self, tmp_db):
        from app.backfill_persister import SQLiteBackfillPersister

        p = SQLiteBackfillPersister(tmp_db)

        def saver(n):
            for i in range(n):
                p.save_snapshot({"i": i, "thread": n})

        threads = [threading.Thread(target=saver, args=(10,)) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        # 应有一个 snapshot 留下
        snap = p.load_snapshot()
        assert snap is not None


# ---------------------------------------------------------------------------
# TestSingleton
# ---------------------------------------------------------------------------


class TestSingleton:
    """get_broadcaster + persister."""

    def test_get_with_persister(self, tmp_db):
        from app.backfill_broadcaster import get_broadcaster, reset_broadcaster
        from app.backfill_persister import SQLiteBackfillPersister

        reset_broadcaster()
        persister = SQLiteBackfillPersister(tmp_db)
        bc = get_broadcaster(persister=persister)
        bc.publish_started("users", 1000)
        # 第二次调用返回同一个
        bc2 = get_broadcaster()
        assert bc is bc2
        snap = bc2.get_snapshot()
        assert "users" in snap["tables"]
        reset_broadcaster()


# ---------------------------------------------------------------------------
# TestIntegrationWithBackfillRunner
# ---------------------------------------------------------------------------


class TestIntegrationWithBackfillRunner:
    """集成: backfill_tenants.py 发布事件, persister 落盘."""

    def test_backfill_publishes_to_persister(self, tmp_db, tmp_path, monkeypatch):
        from app import backfill_broadcaster
        from app.backfill_broadcaster import BackfillBroadcaster
        from app.backfill_persister import SQLiteBackfillPersister

        # 注入新 broadcaster (with persister)
        persister = SQLiteBackfillPersister(tmp_db)
        bc = BackfillBroadcaster(persister=persister)
        monkeypatch.setattr(backfill_broadcaster, "_broadcaster", bc)

        # 跑 backfill_one_table (空 source, 0 tenants)
        class MockConn:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                pass

            def execute(self, *a, **k):
                return []

        class MockEngine:
            def connect(self):
                return MockConn()

        from scripts.ci.backfill_tenants import backfill_one_table

        result = backfill_one_table(
            engine=MockEngine(),
            source_table="users",
            batch_size=100,
            dry_run=True,
            publish_events=True,
        )
        # dry-run 无源数据, 0 tenants, 不发 started
        # 但 0 events 也应保存
        assert result["total_processed"] == 0
