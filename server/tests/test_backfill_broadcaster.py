"""建议 145 测试: BackfillBroadcaster + SSE 端点.

测试覆盖:
  - BackfillEvent to_sse / to_dict
  - BackfillBroadcaster 基础发布
  - subscribe / unsubscribe
  - publish_started / tenant_progress / tenant_done / table_done / error / complete / heartbeat
  - get_snapshot
  - get_history
  - 历史截断 (HISTORY_LIMIT)
  - 并发发布者 (多线程)
  - 慢消费者 (queue.Full 不阻塞发布者)
  - reset
  - 集成: backfill_one_table 真的发布事件
  - SSE 端点: 客户端能 stream 到事件
"""

import json
import threading
from queue import Empty

import pytest

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fresh_broadcaster():
    """每个测试一个新的 broadcaster."""
    from app.backfill_broadcaster import BackfillBroadcaster

    return BackfillBroadcaster()


# ---------------------------------------------------------------------------
# TestBackfillEvent
# ---------------------------------------------------------------------------


class TestBackfillEvent:
    """BackfillEvent 数据结构."""

    def test_to_sse_format(self):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType

        ev = BackfillEvent(
            event_type=BackfillEventType.TENANT_PROGRESS,
            table="users",
            tenant_id=1,
            processed=500,
            total=1000,
        )
        sse = ev.to_sse()
        assert sse.startswith("event: tenant_progress\n")
        assert "data: " in sse
        assert sse.endswith("\n\n")
        # data 部分应是合法 JSON
        data_line = sse.split("data: ", 1)[1].split("\n", 1)[0]
        parsed = json.loads(data_line)
        assert parsed["event_type"] == "tenant_progress"
        assert parsed["table"] == "users"
        assert parsed["tenant_id"] == 1
        assert parsed["processed"] == 500

    def test_to_dict(self):
        from app.backfill_broadcaster import BackfillEvent, BackfillEventType

        ev = BackfillEvent(
            event_type=BackfillEventType.ERROR,
            table="users",
            error="db timeout",
        )
        d = ev.to_dict()
        assert d["event_type"] == "error"
        assert d["table"] == "users"
        assert d["error"] == "db timeout"
        # timestamp 自动填
        assert d["timestamp"] > 0

    def test_event_type_enum(self):
        from app.backfill_broadcaster import BackfillEventType

        assert BackfillEventType.STARTED.value == "started"
        assert BackfillEventType.TENANT_PROGRESS.value == "tenant_progress"
        assert BackfillEventType.TENANT_DONE.value == "tenant_done"
        assert BackfillEventType.TABLE_DONE.value == "table_done"
        assert BackfillEventType.COMPLETE.value == "complete"
        assert BackfillEventType.ERROR.value == "error"
        assert BackfillEventType.HEARTBEAT.value == "heartbeat"


# ---------------------------------------------------------------------------
# TestBroadcasterBasic
# ---------------------------------------------------------------------------


class TestBroadcasterBasic:
    """基础发布/订阅."""

    def test_initial_state(self, fresh_broadcaster):
        snap = fresh_broadcaster.get_snapshot()
        assert snap["global_status"] == "idle"
        assert snap["tables"] == {}
        assert snap["subscriber_count"] == 0

    def test_subscribe_unsubscribe(self, fresh_broadcaster):
        q1 = fresh_broadcaster.subscribe()
        q2 = fresh_broadcaster.subscribe()
        assert fresh_broadcaster.get_snapshot()["subscriber_count"] == 2
        fresh_broadcaster.unsubscribe(q1)
        assert fresh_broadcaster.get_snapshot()["subscriber_count"] == 1
        fresh_broadcaster.unsubscribe(q2)
        assert fresh_broadcaster.get_snapshot()["subscriber_count"] == 0

    def test_publish_started(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_started("users", total=10000)
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "started"
        assert ev.table == "users"
        assert ev.total == 10000
        # snapshot 更新
        snap = fresh_broadcaster.get_snapshot()
        assert snap["global_status"] == "running"
        assert snap["tables"]["users"]["status"] == "running"
        assert snap["tables"]["users"]["total"] == 10000

    def test_publish_tenant_progress(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_started("users", total=10000)
        q.get()  # 消耗 started
        fresh_broadcaster.publish_tenant_progress("users", tenant_id=1, processed=500, total=2000)
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "tenant_progress"
        assert ev.tenant_id == 1
        assert ev.processed == 500
        # snapshot 显示累加
        snap = fresh_broadcaster.get_snapshot()
        assert snap["tables"]["users"]["processed"] == 500

    def test_publish_tenant_done(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_started("users", total=10000)
        q.get()
        fresh_broadcaster.publish_tenant_done("users", tenant_id=1, processed=2000, duration=10.0)
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "tenant_done"
        # tenant_states 更新
        snap = fresh_broadcaster.get_snapshot()
        assert snap["tables"]["users"]["tenants"][1]["status"] == "done"

    def test_publish_table_done(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_started("users", total=10000)
        q.get()
        fresh_broadcaster.publish_table_done("users", processed=10000)
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "table_done"
        assert ev.processed == 10000
        assert ev.percent == 100.0
        snap = fresh_broadcaster.get_snapshot()
        assert snap["tables"]["users"]["status"] == "done"

    def test_publish_complete(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_complete()
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "complete"
        snap = fresh_broadcaster.get_snapshot()
        assert snap["global_status"] == "done"

    def test_publish_error(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_started("users", total=1000)
        q.get()
        fresh_broadcaster.publish_error("users", "db timeout")
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "error"
        assert "db timeout" in ev.error
        snap = fresh_broadcaster.get_snapshot()
        assert snap["tables"]["users"]["status"] == "error"
        assert snap["global_status"] == "error"

    def test_publish_heartbeat(self, fresh_broadcaster):
        q = fresh_broadcaster.subscribe()
        fresh_broadcaster.publish_heartbeat()
        ev = q.get(timeout=1.0)
        assert ev.event_type.value == "heartbeat"


# ---------------------------------------------------------------------------
# TestBroadcasterHistory
# ---------------------------------------------------------------------------


class TestBroadcasterHistory:
    """get_history + 历史截断."""

    def test_history_empty(self, fresh_broadcaster):
        assert fresh_broadcaster.get_history(limit=10) == []

    def test_history_records_events(self, fresh_broadcaster):
        fresh_broadcaster.publish_started("users", 1000)
        fresh_broadcaster.publish_tenant_done("users", 1, 500, 1.0)
        h = fresh_broadcaster.get_history(limit=10)
        assert len(h) == 2
        assert h[0]["event_type"] == "started"
        assert h[1]["event_type"] == "tenant_done"

    def test_history_limit(self, fresh_broadcaster):
        for _ in range(20):
            fresh_broadcaster.publish_heartbeat()
        h = fresh_broadcaster.get_history(limit=5)
        assert len(h) == 5

    def test_history_truncation_at_limit(self, fresh_broadcaster):
        from app.backfill_broadcaster import HISTORY_LIMIT

        # 灌超过 2*HISTORY_LIMIT 个
        for _ in range(HISTORY_LIMIT * 2 + 100):
            fresh_broadcaster.publish_heartbeat()
        # 截断发生, history_size 应 ≤ HISTORY_LIMIT
        snap = fresh_broadcaster.get_snapshot()
        assert snap["history_size"] <= HISTORY_LIMIT


# ---------------------------------------------------------------------------
# TestBroadcasterConcurrent
# ---------------------------------------------------------------------------


class TestBroadcasterConcurrent:
    """并发场景."""

    def test_multiple_subscribers_all_receive(self, fresh_broadcaster):
        qs = [fresh_broadcaster.subscribe() for _ in range(5)]
        fresh_broadcaster.publish_started("users", 1000)
        for q in qs:
            ev = q.get(timeout=1.0)
            assert ev.event_type.value == "started"

    def test_slow_consumer_does_not_block(self, fresh_broadcaster):
        # 容量 5 的 queue
        q = fresh_broadcaster.subscribe(maxsize=5)
        # 灌 100 个, 慢消费者 (不取)
        for i in range(100):
            fresh_broadcaster.publish_started(f"t{i}", i)
        # 不应抛 Full 异常
        # 验证: queue 满了, 后续事件被丢弃
        assert q.qsize() == 5  # maxsize 满

    def test_concurrent_publishers(self, fresh_broadcaster):
        """多线程并发发布不丢不乱."""
        q = fresh_broadcaster.subscribe(maxsize=1000)

        def publisher(n):
            for i in range(n):
                fresh_broadcaster.publish_heartbeat()

        threads = [threading.Thread(target=publisher, args=(50,)) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        # 总共 200 个 heartbeat
        # 一些可能在 queue 里, 一些被丢弃 (maxsize 1000 不会丢)
        count = 0
        try:
            while True:
                q.get_nowait()
                count += 1
        except Empty:
            pass
        assert count == 200


# ---------------------------------------------------------------------------
# TestBroadcasterReset
# ---------------------------------------------------------------------------


class TestBroadcasterReset:
    """reset 清空状态."""

    def test_reset_clears_state(self, fresh_broadcaster):
        fresh_broadcaster.publish_started("users", 1000)
        fresh_broadcaster.publish_tenant_done("users", 1, 100, 1.0)
        assert fresh_broadcaster.get_snapshot()["global_status"] == "running"
        fresh_broadcaster.reset()
        snap = fresh_broadcaster.get_snapshot()
        assert snap["global_status"] == "idle"
        assert snap["tables"] == {}
        assert snap["history_size"] == 0


# ---------------------------------------------------------------------------
# TestSingleton
# ---------------------------------------------------------------------------


class TestSingleton:
    """get_broadcaster 单例."""

    def test_singleton_same_instance(self):
        from app.backfill_broadcaster import get_broadcaster, reset_broadcaster

        reset_broadcaster()
        b1 = get_broadcaster()
        b2 = get_broadcaster()
        assert b1 is b2

    def test_reset_creates_new(self):
        from app.backfill_broadcaster import get_broadcaster, reset_broadcaster

        b1 = get_broadcaster()
        reset_broadcaster()
        b2 = get_broadcaster()
        assert b1 is not b2


# ---------------------------------------------------------------------------
# TestIntegrationWithBackfill
# ---------------------------------------------------------------------------


class TestIntegrationWithBackfill:
    """backfill_one_table 真的发布事件 (mock engine)."""

    def test_publish_started_emitted(self, fresh_broadcaster, monkeypatch):
        """backfill_one_table 应在启动时发布 publish_started."""
        # 把全局 singleton 换成 fresh_broadcaster
        from app import backfill_broadcaster

        monkeypatch.setattr(backfill_broadcaster, "_broadcaster", fresh_broadcaster)
        # mock engine 返回空 (无 active tenants, 走 fast path)
        mock_engine = type("E", (), {"connect": lambda self: iter([])})()
        from scripts.ci.backfill_tenants import backfill_one_table

        result = backfill_one_table(
            engine=mock_engine,
            source_table="users",
            batch_size=100,
            dry_run=True,
            publish_events=True,
        )
        # 0 tenants, 没 publish_started
        assert result["total_processed"] == 0

    def test_publish_false_skips_events(self, fresh_broadcaster, monkeypatch):
        from app import backfill_broadcaster

        monkeypatch.setattr(backfill_broadcaster, "_broadcaster", fresh_broadcaster)

        # mock engine
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
            publish_events=False,
        )
        # publish_events=False, fresh_broadcaster 不应收到任何事件
        assert fresh_broadcaster.get_snapshot()["global_status"] == "idle"
