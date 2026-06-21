"""第十轮 8 项 P2 Bug 修复的回归测试 (Bug-91 ~ Bug-98)."""

import os
import time

# ---------------------------------------------------------------------------
# Bug-91: 布隆过滤器 + 空值缓存
# ---------------------------------------------------------------------------


class TestBug91BloomGuard:
    def test_bloom_basic(self):
        from app.utils.bloom_guard import BloomFilter

        bf = BloomFilter(capacity=1000, fpr=0.01)
        bf.add("a")
        bf.add("b")
        assert bf.may_contain("a") is True
        assert bf.may_contain("b") is True
        # 不存在的极小概率误判, 1000 个不可能都误判
        cnt = sum(1 for i in range(1000) if bf.may_contain(f"x_{i}"))
        # 1000 个 key 几乎不应被命中
        assert cnt < 50  # 误判率 < 5%

    def test_bloom_add_many(self):
        from app.utils.bloom_guard import BloomFilter

        bf = BloomFilter(capacity=100, fpr=0.01)
        bf.add_many([f"k{i}" for i in range(50)])
        for i in range(50):
            assert bf.may_contain(f"k{i}") is True

    def test_null_cache(self):
        from app.utils.bloom_guard import NullCache

        nc = NullCache(default_ttl=0.2)
        nc.mark_null("k1")
        assert nc.is_null_cached("k1") is True
        time.sleep(0.3)
        assert nc.is_null_cached("k1") is False

    def test_null_cache_set_ttl(self):
        from app.utils.bloom_guard import NullCache

        nc = NullCache()
        nc.set_ttl(0.1)
        nc.mark_null("k")
        assert nc.is_null_cached("k") is True
        time.sleep(0.15)
        assert nc.is_null_cached("k") is False

    def test_bloom_guard_add_may(self):
        from app.utils.bloom_guard import bloom_guard

        bloom_guard.reset_ns("test_ns1")
        bloom_guard.add("test_ns1", "key1")
        assert bloom_guard.may_contain("test_ns1", "key1") is True

    def test_bloom_guard_null_cache(self):
        from app.utils.bloom_guard import bloom_guard

        bloom_guard.reset_ns("test_ns2")
        assert bloom_guard.is_null_cached("test_ns2", "k") is False
        bloom_guard.mark_null("test_ns2", "k")
        assert bloom_guard.is_null_cached("test_ns2", "k") is True

    def test_configure(self):
        from app.utils.bloom_guard import bloom_guard

        bloom_guard.configure("test_ns3", capacity=500, fpr=0.005, null_ttl=60.0)
        s = bloom_guard.stats()
        assert "test_ns3" in s["namespaces"]
        assert s["namespaces"]["test_ns3"]["fpr"] == 0.005

    def test_save_load(self, tmp_path):
        from app.utils.bloom_guard import bloom_guard

        bloom_guard.reset_ns("test_ns4")
        for i in range(100):
            bloom_guard.add("test_ns4", f"key_{i}")
        p = str(tmp_path / "bf.bin")
        bloom_guard.save_to_file("test_ns4", p)
        assert os.path.exists(p)
        ok = bloom_guard.load_from_file("test_ns4", p)
        assert ok is True
        assert bloom_guard.may_contain("test_ns4", "key_50") is True

    def test_stats(self):
        from app.utils.bloom_guard import bloom_guard

        bloom_guard.reset_ns("test_ns5")
        bloom_guard.add("test_ns5", "a")
        s = bloom_guard.stats()
        assert "test_ns5" in s["namespaces"]

    def test_reset_ns(self):
        from app.utils.bloom_guard import bloom_guard

        bloom_guard.reset_ns("test_ns6")
        bloom_guard.add("test_ns6", "a")
        bloom_guard.reset_ns("test_ns6")
        # 重新建后, 旧 key 不应再被检测到
        assert bloom_guard.may_contain("test_ns6", "a") is False


# ---------------------------------------------------------------------------
# Bug-92: TTFT 监控
# ---------------------------------------------------------------------------


class TestBug92TtftMonitor:
    def test_record_basic(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor(window=100, alert_p95=10.0)
        rec = m.record("gpt-4o", "/chat", "t1", 0.5, 2.0, 100)
        assert rec.ttft_sec == 0.5
        assert rec.token_count == 100

    def test_percentiles(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor()
        for i in range(100):
            m.record("gpt-4o", "/chat", "t1", float(i) / 1000, 1.0, 10)
        p = m.percentiles()
        assert p["count"] == 100
        assert 0.0 <= p["p50"] <= 1.0
        assert p["p95"] >= p["p50"]

    def test_percentiles_by_model(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor()
        m.record("gpt-4o", "/chat", "t1", 0.1, 1.0, 10)
        m.record("claude-3-haiku", "/chat", "t1", 0.2, 1.0, 10)
        p = m.percentiles(model="gpt-4o")
        assert p["count"] == 1

    def test_alert_threshold(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor(window=100, alert_p95=0.1)
        # 制造 20 个超阈值的样本
        for _ in range(20):
            m.record("m", "/e", "t", 0.5, 1.0, 1)
        s = m.stats()
        assert s["alert_count"] >= 1

    def test_stream_ttft_context(self):
        from app.utils.ttft_monitor import StreamTTFT, ttft_monitor

        with StreamTTFT(model="gpt-4o", endpoint="/chat") as ctx:
            ctx.on_token()
            time.sleep(0.01)
            ctx.on_token()
        s = ttft_monitor.stats()
        # 至少一次成功
        assert s["total_calls"] is None or s["current"]["count"] >= 1

    def test_stream_ttft_with_error(self):
        from app.utils.ttft_monitor import StreamTTFT, ttft_monitor

        with StreamTTFT(model="m_err") as ctx:
            ctx.set_error("timeout")
        s = ttft_monitor.stats()
        assert s["error_calls"] >= 1

    def test_set_window(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor()
        m.set_window(50)
        assert m._window == 50

    def test_set_alert_p95(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor()
        m.set_alert_p95(5.0)
        assert m._alert_p95 == 5.0

    def test_clear(self):
        from app.utils.ttft_monitor import TtftMonitor

        m = TtftMonitor()
        m.record("m", "/", "t", 0.1, 1.0, 1)
        m.clear()
        s = m.stats()
        assert s["total_calls"] == 0

    def test_stats_shape(self):
        from app.utils.ttft_monitor import ttft_monitor

        s = ttft_monitor.stats()
        for k in ("total_calls", "error_calls", "current", "alert_count"):
            assert k in s


# ---------------------------------------------------------------------------
# Bug-93: WS 房间订阅广播
# ---------------------------------------------------------------------------


class TestBug93WsRoomBroker:
    def test_subscribe_publish(self):
        from app.utils.ws_room_broker import ws_room_broker

        # 重置
        ws_room_broker.unsubscribe_all("sub_91_a")
        ws_room_broker.subscribe("sub_91_a", "room:x")
        n = ws_room_broker.publish("room:x", {"text": "hi"})
        assert n == 1

    def test_subscribe_backlog(self):
        from app.utils.ws_room_broker import ws_room_broker

        topic = f"room:y_{int(time.time() * 1000)}"
        ws_room_broker.publish(topic, {"a": 1})
        ws_room_broker.publish(topic, {"b": 2})
        ws_room_broker.subscribe("sub_91_b", topic)
        backlog = ws_room_broker.get_backlog(topic)
        assert len(backlog) >= 2

    def test_unsubscribe(self):
        from app.utils.ws_room_broker import ws_room_broker

        topic = f"room:z_{int(time.time() * 1000)}"
        ws_room_broker.subscribe("sub_91_c", topic)
        assert ws_room_broker.unsubscribe("sub_91_c", topic) is True
        n = ws_room_broker.publish(topic, {"x": 1})
        assert n == 0

    def test_unsubscribe_all(self):
        from app.utils.ws_room_broker import ws_room_broker

        sub = f"sub_91_d_{int(time.time() * 1000)}"
        ws_room_broker.subscribe(sub, "t1")
        ws_room_broker.subscribe(sub, "t2")
        n = ws_room_broker.unsubscribe_all(sub)
        assert n >= 2

    def test_multiple_subscribers(self):
        from app.utils.ws_room_broker import ws_room_broker

        topic = f"room:m_{int(time.time() * 1000)}"
        ws_room_broker.subscribe("s1", topic)
        ws_room_broker.subscribe("s2", topic)
        n = ws_room_broker.publish(topic, "msg")
        assert n == 2

    def test_drain_pending(self):
        from app.utils.ws_room_broker import ws_room_broker

        sub = f"sub_drain_{int(time.time() * 1000)}"
        topic = f"room:d_{int(time.time() * 1000)}"
        ws_room_broker.subscribe(sub, topic)
        ws_room_broker.publish(topic, {"x": 1})
        delivered = []
        ws_room_broker.register_delivery_cb(sub, lambda item: delivered.append(item) or True)
        n = ws_room_broker.drain_pending(sub, max_items=10)
        assert n >= 1
        assert len(delivered) >= 1

    def test_drain_pending_cb_returns_false(self):
        from app.utils.ws_room_broker import ws_room_broker

        sub = f"sub_d2_{int(time.time() * 1000)}"
        topic = f"room:d2_{int(time.time() * 1000)}"
        ws_room_broker.subscribe(sub, topic)
        ws_room_broker.publish(topic, {"x": 1})
        ws_room_broker.register_delivery_cb(sub, lambda item: False)  # 失败
        n = ws_room_broker.drain_pending(sub)
        assert n == 0

    def test_overflow_drop(self):
        from app.utils.ws_room_broker import ws_room_broker

        ws_room_broker.configure(max_pending=2)
        sub = f"sub_o_{int(time.time() * 1000)}"
        topic = f"room:o_{int(time.time() * 1000)}"
        ws_room_broker.subscribe(sub, topic)
        for i in range(10):
            ws_room_broker.publish(topic, i)
        s = ws_room_broker.stats()
        assert s["dropped_overflow"] >= 1
        ws_room_broker.configure(max_pending=1000)  # 复位

    def test_list_subscribers(self):
        from app.utils.ws_room_broker import ws_room_broker

        topic = f"room:ls_{int(time.time() * 1000)}"
        ws_room_broker.subscribe("ls_1", topic)
        subs = ws_room_broker.list_subscribers(topic)
        assert "ls_1" in subs

    def test_list_topics(self):
        from app.utils.ws_room_broker import ws_room_broker

        sub = f"sub_lt_{int(time.time() * 1000)}"
        ws_room_broker.subscribe(sub, "t_a")
        ws_room_broker.subscribe(sub, "t_b")
        topics = ws_room_broker.list_topics(sub)
        assert "t_a" in topics and "t_b" in topics

    def test_stats(self):
        from app.utils.ws_room_broker import ws_room_broker

        s = ws_room_broker.stats()
        for k in ("topic_count", "subscriber_count", "total_publish"):
            assert k in s


# ---------------------------------------------------------------------------
# Bug-94: 连接池泄漏检测
# ---------------------------------------------------------------------------


class TestBug94PoolLeak:
    def test_checkout_checkin(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector()
        cid = d.checkout("eng1")
        d.checkin(cid)
        assert d.stats()["outstanding"] == 0

    def test_scan_leak(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector(leak_timeout_sec=0.05)
        cid = d.checkout("eng1")
        time.sleep(0.1)
        leaks = d.scan_leaks()
        assert len(leaks) == 1
        assert leaks[0]["conn_id"] == cid
        d.checkin(cid)

    def test_force_release(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector(leak_timeout_sec=0.05)
        cid = d.checkout("eng1")
        time.sleep(0.1)
        ok = d.force_release(cid)
        assert ok is True
        assert d.stats()["outstanding"] == 0

    def test_force_release_all(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector(leak_timeout_sec=0.05)
        for _ in range(3):
            d.checkout("eng1")
        time.sleep(0.1)
        n = d.force_release_all_leaked()
        assert n == 3

    def test_get_outstanding(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector()
        d.checkout("eng1", context="ctx1")
        arr = d.get_outstanding()
        assert len(arr) == 1
        assert arr[0]["engine"] == "eng1"
        assert arr[0]["context"] == "ctx1"

    def test_get_leaks(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector(leak_timeout_sec=0.05)
        d.checkout("eng1")
        time.sleep(0.1)
        d.scan_leaks()
        leaks = d.get_leaks()
        assert len(leaks) >= 1

    def test_set_timeout(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector()
        d.set_timeout(60.0)
        assert d._timeout == 60.0

    def test_checkin_unknown_id(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector()
        d.checkin(99999)  # 静默忽略
        s = d.stats()
        assert s["total_checkin"] == 0

    def test_install_sa_pool_hook(self):
        from sqlalchemy import create_engine

        from app.utils.pool_leak_detector import install_sa_pool_hook

        eng = create_engine("sqlite:///:memory:")
        install_sa_pool_hook(eng, engine_name="sa_test")
        with eng.connect() as conn:
            from sqlalchemy import text

            conn.execute(text("SELECT 1"))
        assert True

    def test_clear(self):
        from app.utils.pool_leak_detector import PoolLeakDetector

        d = PoolLeakDetector()
        d.checkout("eng1")
        d.clear()
        assert d.stats()["outstanding"] == 0


# ---------------------------------------------------------------------------
# Bug-95: 多级缓存一致性
# ---------------------------------------------------------------------------


class TestBug95CacheCoherence:
    def test_l1_basic(self):
        from app.utils.cache_coherence import cache_coherence

        cache_coherence.configure_l1(100)
        cache_coherence.set("k1", "v1", ttl=10)
        assert cache_coherence.get("k1") == "v1"

    def test_l1_ttl(self):
        from app.utils.cache_coherence import cache_coherence

        cache_coherence.set("k_ttl", "v", ttl=0.05)
        assert cache_coherence.get("k_ttl") == "v"
        time.sleep(0.1)
        assert cache_coherence.get("k_ttl") is None

    def test_l2_fallback(self):
        from app.utils.cache_coherence import cache_coherence

        # 注册 fake L2
        data = {}
        cache_coherence.register_l2(
            get_fn=lambda k: data.get(k),
            set_fn=lambda k, v, t: data.__setitem__(k, v),
            del_fn=lambda k: data.pop(k, None),
        )
        cache_coherence.set("k2", "v2", ttl=1.0)
        # 清 L1
        cache_coherence._l1.clear()
        # 应该从 L2 拉回
        assert cache_coherence.get("k2") == "v2"

    def test_invalidate(self):
        from app.utils.cache_coherence import cache_coherence

        cache_coherence.set("k_inv", "v", ttl=10)
        cache_coherence.invalidate("k_inv")
        assert cache_coherence.get("k_inv") is None

    def test_invalidation_broadcast(self):
        from app.utils.cache_coherence import cache_coherence

        cache_coherence.bind_invalidation_topic("k_bc", "topic_bc")
        received = []
        cache_coherence.subscribe_invalidation("topic_bc", lambda k: received.append(k))
        cache_coherence.set("k_bc", "v", ttl=10)
        cache_coherence.invalidate("k_bc")
        assert "k_bc" in received

    def test_receive_invalidation(self):
        from app.utils.cache_coherence import cache_coherence

        cache_coherence.set("k_recv", "v", ttl=10)
        assert cache_coherence.get_l1("k_recv") == "v"
        cache_coherence.receive_invalidation("topic_x", "k_recv")
        assert cache_coherence.get_l1("k_recv") is None

    def test_get_default(self):
        from app.utils.cache_coherence import cache_coherence

        assert cache_coherence.get("non_exist_k", default="d") == "d"

    def test_l1_lru_eviction(self):
        from app.utils.cache_coherence import cache_coherence

        cache_coherence.configure_l1(3)
        for i in range(5):
            cache_coherence.set(f"k_{i}", i, ttl=10)
        # 至少 5 个中最早的被淘汰
        assert cache_coherence.get_l1("k_4") == 4
        cache_coherence.configure_l1(5000)  # 复位

    def test_ttl_jitter(self):
        import random

        from app.utils.cache_coherence import _jitter

        random.seed(42)
        v1 = _jitter(100.0)
        assert 90.0 <= v1 <= 110.0

    def test_stats(self):
        from app.utils.cache_coherence import cache_coherence

        s = cache_coherence.stats()
        for k in ("l1", "total_get", "l1_hit", "l2_hit", "miss"):
            assert k in s


# ---------------------------------------------------------------------------
# Bug-96: API Key 配额分层
# ---------------------------------------------------------------------------


class TestBug96ApiKeyQuota:
    def test_register_and_acquire(self):
        from app.utils.api_key_quota import api_key_quota

        api_key_quota.register_key("k_free", "free")
        ok, reason = api_key_quota.acquire("k_free")
        assert ok is True
        assert reason == "ok"

    def test_qps_limit(self):
        from app.utils.api_key_quota import TIER_FREE, api_key_quota

        api_key_quota.set_tier(TIER_FREE, qps=1, daily=1000, monthly=10000)
        api_key_quota.register_key("k_qps", TIER_FREE)
        assert api_key_quota.acquire("k_qps")[0] is True
        ok, reason = api_key_quota.acquire("k_qps")
        assert ok is False
        assert reason == "qps_quota"

    def test_daily_limit(self):
        from app.utils.api_key_quota import TIER_FREE, api_key_quota

        api_key_quota.set_tier(TIER_FREE, qps=1000, daily=2, monthly=10000)
        api_key_quota.register_key("k_daily", TIER_FREE)
        assert api_key_quota.acquire("k_daily")[0] is True
        assert api_key_quota.acquire("k_daily")[0] is True
        ok, reason = api_key_quota.acquire("k_daily")
        assert ok is False
        assert reason == "daily_quota"

    def test_monthly_limit(self):
        from app.utils.api_key_quota import TIER_FREE, api_key_quota

        api_key_quota.set_tier(TIER_FREE, qps=1000, daily=10000, monthly=2)
        api_key_quota.register_key("k_month", TIER_FREE)
        assert api_key_quota.acquire("k_month")[0] is True
        assert api_key_quota.acquire("k_month")[0] is True
        ok, reason = api_key_quota.acquire("k_month")
        assert ok is False
        assert reason == "monthly_quota"

    def test_set_tier(self):
        from app.utils.api_key_quota import api_key_quota

        api_key_quota.set_tier("vip", qps=500, daily=1_000_000, monthly=10_000_000)
        assert "vip" in api_key_quota.list_tiers()

    def test_get_state(self):
        from app.utils.api_key_quota import api_key_quota

        api_key_quota.register_key("k_state", "free")
        api_key_quota.acquire("k_state")
        st = api_key_quota.get_state("k_state")
        assert st is not None
        assert st["tier"] == "free"

    def test_unregister(self):
        from app.utils.api_key_quota import api_key_quota

        api_key_quota.register_key("k_unreg", "free")
        assert api_key_quota.unregister_key("k_unreg") is True
        assert api_key_quota.unregister_key("k_unreg") is False

    def test_reset_usage(self):
        from app.utils.api_key_quota import api_key_quota

        api_key_quota.register_key("k_reset", "free")
        api_key_quota.acquire("k_reset")
        api_key_quota.reset_usage("k_reset")
        st = api_key_quota.get_state("k_reset")
        assert st["daily_used"] == 0

    def test_try_acquire_alias(self):
        from app.utils.api_key_quota import api_key_quota

        api_key_quota.register_key("k_try", "pro")
        ok, reason = api_key_quota.try_acquire("k_try")
        assert ok is True and reason == "ok"

    def test_stats(self):
        from app.utils.api_key_quota import api_key_quota

        s = api_key_quota.stats()
        for k in ("tier_count", "key_count", "tiers"):
            assert k in s


# ---------------------------------------------------------------------------
# Bug-97: 异步任务幂等
# ---------------------------------------------------------------------------


class TestBug97JobIdempotent:
    def test_begin_first_time(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j1.jsonl"), stale_after_sec=600)
        assert r.begin("j1", payload={"a": 1}) is True

    def test_begin_duplicate(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j2.jsonl"))
        r.begin("j2")
        # 第二次 (running 中) 应返回 False
        assert r.begin("j2") is False

    def test_finish_and_replay(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j3.jsonl"))
        r.begin("j3")
        r.finish("j3", result={"v": 1})
        # 已完成, begin 仍应跳过 (除非失败)
        assert r.begin("j3") is False
        cached = r.get_cached_result("j3")
        assert cached == {"v": 1}

    def test_fail_then_retry(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j4.jsonl"))
        r.begin("j4")
        r.fail("j4", error="oops")
        # 失败后允许重试
        assert r.begin("j4") is True

    def test_get_status(self, tmp_path):
        from app.utils.job_idempotent import JobRunner, JobStatus

        r = JobRunner(log_path=str(tmp_path / "j5.jsonl"))
        r.begin("j5")
        assert r.get_status("j5") == JobStatus.RUNNING
        r.finish("j5", result=1)
        assert r.get_status("j5") == JobStatus.SUCCESS

    def test_cancel(self, tmp_path):
        from app.utils.job_idempotent import JobRunner, JobStatus

        r = JobRunner(log_path=str(tmp_path / "j6.jsonl"))
        r.begin("j6")
        r.cancel("j6")
        assert r.get_status("j6") == JobStatus.CANCELLED

    def test_recover_stale(self, tmp_path):
        from app.utils.job_idempotent import JobRunner, JobStatus

        r = JobRunner(log_path=str(tmp_path / "j7.jsonl"), stale_after_sec=0.05)
        r.begin("j7")
        time.sleep(0.1)
        r._recover_stale()
        assert r.get_status("j7") == JobStatus.PENDING

    def test_get_record(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j8.jsonl"))
        r.begin("j8", payload={"k": "v"})
        rec = r.get_record("j8")
        assert rec is not None
        assert rec["payload"] == {"k": "v"}

    def test_list_records(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j9.jsonl"))
        r.begin("a")
        r.begin("b")
        r.finish("a", result=1)
        all_ = r.list_records()
        assert len(all_) >= 2
        success = r.list_records(status="success")
        assert any(x["job_id"] == "a" for x in success)

    def test_set_stale_after(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j10.jsonl"))
        r.set_stale_after(60.0)
        assert r._stale_after == 60.0

    def test_stats(self, tmp_path):
        from app.utils.job_idempotent import JobRunner

        r = JobRunner(log_path=str(tmp_path / "j11.jsonl"))
        r.begin("k1")
        s = r.stats()
        assert s["total_begin"] >= 1


# ---------------------------------------------------------------------------
# Bug-98: schema 迁移灰度
# ---------------------------------------------------------------------------


class TestBug98SchemaMigration:
    def test_register(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("users", "name", "full_name")
        st = migration_controller.get_state("users")
        assert st is not None
        assert st["old_col"] == "name"

    def test_set_phase(self):
        from app.utils.schema_migration import PHASE_DUAL_WRITE, migration_controller

        migration_controller.register("t1", "a", "b")
        assert migration_controller.set_phase("t1", PHASE_DUAL_WRITE) is True
        assert migration_controller.get_phase("t1") == PHASE_DUAL_WRITE

    def test_set_phase_invalid(self):
        from app.utils.schema_migration import migration_controller

        assert migration_controller.set_phase("nope", 99) is False

    def test_record_dual_write(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t2", "a", "b")
        migration_controller.record_dual_write("t2")
        st = migration_controller.get_state("t2")
        assert st["dual_write_count"] == 1

    def test_record_read(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t3", "a", "b")
        migration_controller.record_read("t3", used_new=True)
        migration_controller.record_read("t3", used_new=False)
        st = migration_controller.get_state("t3")
        assert st["new_read_count"] == 1
        assert st["old_read_count"] == 1

    def test_record_inconsistency(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t4", "a", "b")
        migration_controller.record_inconsistency("t4")
        assert migration_controller.get_state("t4")["inconsistency_count"] == 1

    def test_can_cutover_false_low_sample(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t5", "a", "b")
        assert migration_controller.can_cutover("t5") is False

    def test_can_cutover_true(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t6", "a", "b")
        for _ in range(200):
            migration_controller.record_read("t6", used_new=True)
        assert migration_controller.can_cutover("t6") is True

    def test_maybe_cutover(self):
        from app.utils.schema_migration import PHASE_DUAL_WRITE, PHASE_OLD_ONLY, migration_controller

        migration_controller.register("t7", "a", "b")
        for _ in range(200):
            migration_controller.record_read("t7", used_new=True)
        assert migration_controller.get_phase("t7") == PHASE_OLD_ONLY
        ok = migration_controller.maybe_cutover("t7")
        assert ok is True
        assert migration_controller.get_phase("t7") == PHASE_DUAL_WRITE

    def test_maybe_cutover_force(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t8", "a", "b")
        # 样本不足, 但 force=True 也切
        ok = migration_controller.maybe_cutover("t8", force=True)
        assert ok is True

    def test_rollback(self):
        from app.utils.schema_migration import PHASE_OLD_ONLY, migration_controller

        migration_controller.register("t9", "a", "b")
        migration_controller.set_phase("t9", 2)
        assert migration_controller.rollback("t9") is True
        assert migration_controller.get_phase("t9") == 1
        # 再 roll 一次到 0
        migration_controller.rollback("t9")
        assert migration_controller.get_phase("t9") == PHASE_OLD_ONLY
        # 不能 roll 回 -1
        assert migration_controller.rollback("t9") is False

    def test_confirm_cutover(self):
        from app.utils.schema_migration import PHASE_DUAL_READ, PHASE_NEW_ONLY, migration_controller

        migration_controller.register("t10", "a", "b")
        migration_controller.set_phase("t10", PHASE_DUAL_READ)
        for _ in range(200):
            migration_controller.record_read("t10", used_new=True)
        assert migration_controller.confirm_cutover("t10") is True
        assert migration_controller.get_phase("t10") == PHASE_NEW_ONLY

    def test_list_all(self):
        from app.utils.schema_migration import migration_controller

        all_ = migration_controller.list_all()
        assert isinstance(all_, list)

    def test_unregister(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.register("t_rm", "a", "b")
        migration_controller.unregister("t_rm")
        assert migration_controller.get_state("t_rm") is None

    def test_stats(self):
        from app.utils.schema_migration import migration_controller

        s = migration_controller.stats()
        for k in ("tables", "by_phase", "read_ratio_threshold"):
            assert k in s

    def test_set_thresholds(self):
        from app.utils.schema_migration import migration_controller

        migration_controller.set_thresholds(read_ratio=0.95, inconsistency_tolerance=0.01)
        s = migration_controller.stats()
        assert s["read_ratio_threshold"] == 0.95
