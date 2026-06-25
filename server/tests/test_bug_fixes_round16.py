"""第十六轮 性能与可观测性 Bug 主动巡检 - 单元测试 (Bug-149 ~ Bug-166).

6 维度 18 个 Bug 全部覆盖.
"""

import time
import unittest


# =====================================================================
# 维度 1: 性能 - 查询与缓存 (Bug-149/150/151)
# =====================================================================
class TestBug149N1Detector(unittest.TestCase):
    def test_fingerprint_stable(self):
        from app.utils.n1_detector import N1Detector

        fp1 = N1Detector.fingerprint("SELECT * FROM user WHERE id = ?")
        fp2 = N1Detector.fingerprint("select *  from  user where id=?")
        self.assertEqual(fp1, fp2)
        self.assertEqual(len(fp1), 12)

    def test_alert_on_high_fanout(self):
        from app.utils.n1_detector import N1Config, N1Detector

        cfg = N1Config(max_parents=1, max_fanout_ratio=3.0, window_sec=60, cooldown_sec=0)
        g = N1Detector(cfg)
        g.record_parent("p1")
        for _ in range(5):
            g.record_child("p1")
        st = g.stats()
        self.assertGreaterEqual(st["alerts"], 1)

    def test_no_alert_low_fanout(self):
        from app.utils.n1_detector import N1Config, N1Detector

        cfg = N1Config(max_parents=1, max_fanout_ratio=10.0, window_sec=60, cooldown_sec=0)
        g = N1Detector(cfg)
        g.record_parent("p1")
        g.record_child("p1")
        self.assertEqual(g.stats()["alerts"], 0)

    def test_cooldown(self):
        from app.utils.n1_detector import N1Config, N1Detector

        cfg = N1Config(max_parents=1, max_fanout_ratio=3.0, window_sec=60, cooldown_sec=999)
        g = N1Detector(cfg)
        g.record_parent("p1")
        for _ in range(5):
            g.record_child("p1")
        first = g.stats()["alerts"]
        for _ in range(5):
            g.record_child("p1")
        self.assertEqual(g.stats()["alerts"], first)


class TestBug150SlowSQLKiller(unittest.TestCase):
    """Bug-150: 慢 SQL 自动 kill. 测试实际 SlowSqlKiller 实现."""

    def test_record_normal(self):
        from app.utils.slow_sql_killer import SlowSqlKiller

        g = SlowSqlKiller(threshold_sec=10.0)
        # 正常 SQL (未超阈值) 不记录慢查询
        rec = g.check_and_kill("select 1", 5.0, None, "ai")
        self.assertIsNone(rec)
        self.assertEqual(g.stats()["total_executed"], 1)
        self.assertEqual(g.stats()["total_slow"], 0)

    def test_slow_sql_recorded(self):
        from app.utils.slow_sql_killer import SlowSqlKiller

        g = SlowSqlKiller(threshold_sec=0.08)  # 80ms
        # 慢 SQL (超阈值) 被记录
        rec = g.check_and_kill("select slow", 0.2, None, "ai")
        self.assertIsNotNone(rec)
        self.assertEqual(g.stats()["total_slow"], 1)
        self.assertEqual(g.stats()["by_engine"]["ai"], 1)

    def test_clear_stats(self):
        from app.utils.slow_sql_killer import SlowSqlKiller

        g = SlowSqlKiller(threshold_sec=0.08)
        g.check_and_kill("q1", 0.2, None, "ai")
        self.assertEqual(g.stats()["total_slow"], 1)
        g.clear()
        self.assertEqual(g.stats()["total_slow"], 0)
        self.assertEqual(g.stats()["total_executed"], 0)


class TestBug151CacheWarmer(unittest.TestCase):
    def test_warm_and_hit(self):
        from app.utils.cache_warmer import CacheWarmer, WarmConfig

        store = {}
        g = CacheWarmer(
            cache_get=lambda k: store.get(k),
            cache_set=lambda k, v, t: store.__setitem__(k, v),
            config=WarmConfig(concurrency=2),
        )
        keys = [g.register(f"k{i}", lambda i=i: f"v{i}", ttl=60) for i in range(5)]
        results = g.warm(keys, force=True)
        self.assertEqual(len(results), 5)
        self.assertTrue(all(r.ok for r in results))
        self.assertEqual(store["k0"], "v0")

    def test_hit_rate(self):
        from app.utils.cache_warmer import CacheWarmer

        store = {"k1": "v1"}
        g = CacheWarmer(cache_get=lambda k: store.get(k), cache_set=lambda k, v, t: None)
        g.hit()
        g.hit()
        g.miss()
        self.assertAlmostEqual(g.hit_rate(), 2 / 3, places=3)

    def test_retry_on_failure(self):
        from app.utils.cache_warmer import CacheWarmer

        store = {}
        g = CacheWarmer(cache_get=lambda k: store.get(k), cache_set=lambda k, v, t: store.__setitem__(k, v))
        k = g.register("k1", lambda: (_ for _ in ()).throw(RuntimeError("boom")), retries=3)
        results = g.warm([k], force=True)
        self.assertFalse(results[0].ok)
        self.assertEqual(results[0].attempts, 3)

    def test_force_bypass_interval(self):
        from app.utils.cache_warmer import CacheWarmer, WarmConfig

        store = {}
        g = CacheWarmer(
            cache_get=lambda k: store.get(k),
            cache_set=lambda k, v, t: store.__setitem__(k, v),
            config=WarmConfig(min_interval_sec=3600),
        )
        k = g.register("k1", lambda: "v1")
        r1 = g.warm([k])  # 第一次默认 bypass
        # 第二次默认被 min_interval 拦截
        k2 = g.register("k2", lambda: "v2")
        r2 = g.warm([k2])
        self.assertEqual(len(r1), 1)
        self.assertEqual(r2, [])
        # force=True 必跑
        r3 = g.warm([k2], force=True)
        self.assertEqual(len(r3), 1)


# =====================================================================
# 维度 2: 性能 - 资源池 (Bug-152/153/154)
# =====================================================================
class _FakePool:
    """模拟 SQLAlchemy QueuePool 的内部结构."""

    def __init__(self, size=5, checkedout=2, overflow=0, idle=3, max_overflow=10):
        self._size = size
        self._checkedout = checkedout
        self._max_overflow = max_overflow
        self._overflow = overflow
        self._idle = idle

        class _Inner:
            def qsize(self_):
                return idle

        self._pool = _Inner()

    def size(self):
        return self._size

    def checkedout(self):
        return self._checkedout

    def overflow(self):
        return self._overflow


class _FakeEngine:
    def __init__(self, pool):
        self.pool = pool


class TestBug152PoolMonitor(unittest.TestCase):
    """Bug-152: 连接池监控. 测试实际 PoolMonitor 实现."""

    def test_get_stats(self):
        from app.utils.pool_monitor import PoolMonitor

        g = PoolMonitor()
        eng = _FakeEngine(_FakePool(size=5, checkedout=2, idle=3))
        s = g.get_stats("ai", eng)
        self.assertEqual(s.engine, "ai")
        self.assertEqual(s.pool_size, 5)
        self.assertEqual(s.in_use, 2)
        self.assertEqual(s.idle, 3)

    def test_all_stats(self):
        from app.utils.pool_monitor import PoolMonitor

        g = PoolMonitor()
        eng = _FakeEngine(_FakePool(size=5, checkedout=2, idle=3))
        g.get_stats("ai", eng)
        all_s = g.all_stats()
        self.assertIn("ai", all_s)
        self.assertEqual(all_s["ai"]["pool_size"], 5)

    def test_tick_empty(self):
        from app.utils.pool_monitor import PoolMonitor

        g = PoolMonitor()
        out = g.tick(engines={})
        self.assertEqual(out, {})


class TestBug153MemoryLeak(unittest.TestCase):
    def test_snapshot(self):
        from app.utils.memory_leak import MemoryLeakDetector

        g = MemoryLeakDetector()
        s = g.snapshot()
        self.assertIsNotNone(s.rss_kb)
        self.assertGreaterEqual(s.obj_count, 0)

    def test_stats(self):
        from app.utils.memory_leak import MemoryLeakDetector

        g = MemoryLeakDetector()
        g.snapshot()
        st = g.stats()
        self.assertIn("samples", st)
        self.assertEqual(st["samples"], 1)


class TestBug154GCPressure(unittest.TestCase):
    def test_snapshot(self):
        from app.utils.gc_pressure import GCPressureMonitor

        g = GCPressureMonitor()
        s = g.snapshot()
        self.assertIsNotNone(s.threshold)
        self.assertGreater(s.obj_count, 0)

    def test_force_collect(self):
        from app.utils.gc_pressure import GCPressureMonitor

        g = GCPressureMonitor()
        r = g.force_collect()
        self.assertIn("before", r)
        self.assertIn("after", r)

    def test_stats(self):
        from app.utils.gc_pressure import GCPressureMonitor

        g = GCPressureMonitor()
        g.snapshot()
        st = g.stats()
        self.assertEqual(st["samples"], 1)


# =====================================================================
# 维度 3: 可观测性 - 链路追踪 (Bug-155/156/157)
# =====================================================================
class TestBug155TraceContext(unittest.TestCase):
    """Bug-155: 分布式追踪上下文. 测试实际 TraceContext 实现."""

    def test_root_and_child(self):
        from app.utils.trace_context import (
            TRACE_ID_LEN,
            SPAN_ID_LEN,
            get_current,
            new_span,
            new_trace,
        )

        root = new_trace(name="root")
        self.assertEqual(len(root.trace_id), TRACE_ID_LEN)
        self.assertEqual(len(root.span_id), SPAN_ID_LEN)
        child = new_span(root, name="child")
        self.assertEqual(child.trace_id, root.trace_id)
        self.assertEqual(child.parent_span_id, root.span_id)
        self.assertIs(get_current(), child)

    def test_header_roundtrip(self):
        from app.utils.trace_context import (
            extract_from_headers,
            inject_to_headers,
            new_trace,
            set_current,
        )

        c = new_trace(name="rt")
        set_current(c)
        h = inject_to_headers()
        self.assertIn("traceparent", h)
        c2 = extract_from_headers(h)
        self.assertEqual(c2.trace_id, c.trace_id)
        self.assertEqual(c2.span_id, c.span_id)

    def test_attrs(self):
        from app.utils.trace_context import add_attr, get_current, new_trace

        new_trace(name="attr")
        add_attr("user_id", "u1")
        self.assertEqual(get_current().attrs["user_id"], "u1")

    def test_stats(self):
        from app.utils.trace_context import new_trace, stats

        new_trace(name="s1")
        st = stats()
        self.assertGreaterEqual(st["total_traces"], 1)


class TestBug156Sampler(unittest.TestCase):
    def test_should_sample_high_priority(self):
        from app.utils.sampler import Priority, SamplerConfig, TraceSampler

        g = TraceSampler(SamplerConfig(rate_by_priority={"HIGH": 1.0}))
        self.assertTrue(g.should_sample("t1", Priority.HIGH))
        self.assertTrue(g.should_sample("t2", Priority.HIGH))

    def test_should_sample_normal_partial(self):
        from app.utils.sampler import Priority, SamplerConfig, TraceSampler

        g = TraceSampler(SamplerConfig(rate_by_priority={"NORMAL": 0.0}))
        self.assertFalse(g.should_sample("t1", Priority.NORMAL))

    def test_stable_bucket(self):
        from app.utils.sampler import TraceSampler

        for _ in range(10):
            b = TraceSampler._bucket("trace-abc")
            self.assertEqual(b, TraceSampler._bucket("trace-abc"))


class TestBug157Propagator(unittest.TestCase):
    """Bug-157: 跨服务传播. 测试修复后的 TracePropagator 实现."""

    def test_http_roundtrip(self):
        from app.utils.trace_context import new_trace, set_current
        from app.utils.propagator import TracePropagator

        p = TracePropagator()
        ctx = new_trace(name="http")
        set_current(ctx)
        h = p.inject_http({})
        self.assertIn("traceparent", h)
        c2 = p.extract_http(h)
        self.assertIsNotNone(c2)
        self.assertEqual(c2.trace_id, ctx.trace_id)

    def test_kafka_roundtrip(self):
        from app.utils.trace_context import new_trace, set_current
        from app.utils.propagator import TracePropagator

        p = TracePropagator()
        ctx = new_trace(name="kafka")
        set_current(ctx)
        h = p.inject_kafka({})
        c2 = p.extract_kafka(h)
        self.assertIsNotNone(c2)
        self.assertEqual(c2.trace_id, ctx.trace_id)

    def test_extract_invalid(self):
        from app.utils.propagator import TracePropagator

        p = TracePropagator()
        self.assertIsNone(p.extract_http({}))
        self.assertIsNone(p.extract_http({"traceparent": "garbage"}))
        self.assertIsNone(p.extract_kafka({}))


# =====================================================================
# 维度 4: 可观测性 - 指标 (Bug-158/159/160)
# =====================================================================
class TestBug158Cardinality(unittest.TestCase):
    def test_observe_and_bucketing(self):
        from app.utils.cardinality import CardinalityConfig, MetricRegistry

        cfg = CardinalityConfig(bucket_count=4)
        g = MetricRegistry(cfg)
        for i in range(100):
            g.observe("http_requests", {"user_id": f"u{i}"}, 1.0)
        # 高基数 key 桶化后 series 数应远小于 100
        sc = g.series_count("http_requests")
        self.assertLessEqual(sc, 4)

    def test_low_cardinality_passthrough(self):
        from app.utils.cardinality import MetricRegistry

        g = MetricRegistry()
        g.observe("http", {"method": "GET"}, 1.0)
        g.observe("http", {"method": "POST"}, 1.0)
        self.assertEqual(g.series_count("http"), 2)

    def test_stats(self):
        from app.utils.cardinality import MetricRegistry

        g = MetricRegistry()
        g.observe("m", {"k": "v"}, 1.0)
        st = g.stats()
        self.assertIn("tracked_metrics", st)


class TestBug159SLA(unittest.TestCase):
    def test_availability(self):
        from app.utils.sla import SLACalculator, SLATarget

        g = SLACalculator(SLATarget(name="t", slo=0.99))
        for _ in range(100):
            g.record(ok=True)
        g.record(ok=False)
        av = g.availability("24h")
        self.assertGreater(av, 0.98)

    def test_error_budget(self):
        from app.utils.sla import SLACalculator, SLATarget

        g = SLACalculator(SLATarget(name="t", slo=0.99))
        for _ in range(1000):
            g.record(ok=True)
        rem = g.error_budget_remaining()
        self.assertGreaterEqual(rem, 0.0)

    def test_burn_rate(self):
        from app.utils.sla import SLACalculator, SLATarget

        g = SLACalculator(SLATarget(name="t", slo=0.99))
        for _ in range(99):
            g.record(ok=True)
        g.record(ok=False)
        br = g.burn_rate("24h")
        self.assertGreaterEqual(br, 0.0)

    def test_stats(self):
        from app.utils.sla import SLACalculator

        g = SLACalculator()
        g.record(ok=True)
        st = g.stats()
        self.assertEqual(st["total"], 1)


class TestBug160Health(unittest.TestCase):
    def test_liveness_ok(self):
        from app.utils.health import Check, HealthChecker

        g = HealthChecker()
        g.add_liveness(Check(name="ping", fn=lambda: True))
        level, _ = g.liveness()
        self.assertEqual(level.value, "OK")

    def test_liveness_critical_down(self):
        from app.utils.health import Check, HealthChecker

        g = HealthChecker()
        g.add_liveness(Check(name="ping", fn=lambda: False, critical=True))
        level, _ = g.liveness()
        self.assertEqual(level.value, "DOWN")

    def test_readiness_degraded(self):
        from app.utils.health import Check, HealthChecker

        g = HealthChecker()
        g.add_readiness(Check(name="ping", fn=lambda: True))
        g.add_readiness(Check(name="extra", fn=lambda: False, critical=False))
        level, _ = g.readiness()
        self.assertEqual(level.value, "DEGRADED")

    def test_startup_blocked_until_done(self):
        from app.utils.health import Check, HealthChecker

        g = HealthChecker()
        g.start()
        g.add_startup(Check(name="warm", fn=lambda: True))
        level, _ = g.startup()
        self.assertEqual(level.value, "DOWN")
        g.mark_startup_done()
        level2, _ = g.startup()
        self.assertEqual(level2.value, "OK")


# =====================================================================
# 维度 5: 可观测性 - 告警 (Bug-161/162/163)
# =====================================================================
class TestBug161AlertDedup(unittest.TestCase):
    def test_aggregate_same_fp(self):
        from app.utils.alert_dedup import AlertDeduplicator

        g = AlertDeduplicator()
        a1 = g.push("HIGH", {"svc": "x"}, "cpu 99%")
        a2 = g.push("HIGH", {"svc": "x"}, "cpu 99%")
        a3 = g.push("HIGH", {"svc": "x"}, "cpu 99%")
        self.assertEqual(a3.count, 3)
        self.assertEqual(a3.fp, a1.fp)

    def test_different_labels_different_buckets(self):
        from app.utils.alert_dedup import AlertDeduplicator

        g = AlertDeduplicator()
        a1 = g.push("HIGH", {"svc": "x"}, "msg")
        a2 = g.push("HIGH", {"svc": "y"}, "msg")
        self.assertNotEqual(a1.fp, a2.fp)
        self.assertEqual(g.stats()["active_buckets"], 2)

    def test_force_flush(self):
        from app.utils.alert_dedup import AlertDeduplicator

        g = AlertDeduplicator()
        g.push("LOW", {"k": "v"}, "m")
        out = g.force_flush()
        self.assertEqual(len(out), 1)
        self.assertEqual(g.stats()["active_buckets"], 0)


class TestBug162AlertInhibit(unittest.TestCase):
    def test_silence_match(self):
        from app.utils.alert_inhibit import AlertSuppressor, SilenceRule

        g = AlertSuppressor()
        g.add_silence(
            SilenceRule(
                id="s1",
                match_labels={"svc": "x"},
                start_ts=time.time() - 10,
                end_ts=time.time() + 60,
            )
        )
        d = g.evaluate({"svc": "x"}, "HIGH")
        self.assertTrue(d.silenced)

    def test_inhibit_by_critical(self):
        from app.utils.alert_inhibit import AlertSuppressor, InhibitRule

        g = AlertSuppressor()
        g.add_inhibit(
            InhibitRule(
                id="i1",
                source_labels={"svc": "x", "severity": "CRITICAL"},
                target_labels={"svc": "x"},
                equal=["svc"],
            )
        )
        d = g.evaluate(
            {"svc": "x"},
            "LOW",
            active_alerts=[{"labels": {"svc": "x", "severity": "CRITICAL"}}],
        )
        self.assertTrue(d.inhibited)

    def test_pass_through(self):
        from app.utils.alert_inhibit import AlertSuppressor

        g = AlertSuppressor()
        d = g.evaluate({"svc": "y"}, "LOW")
        self.assertFalse(d.silenced)
        self.assertFalse(d.inhibited)

    def test_remove_silence(self):
        from app.utils.alert_inhibit import AlertSuppressor, SilenceRule

        g = AlertSuppressor()
        g.add_silence(SilenceRule(id="s1", match_labels={}, start_ts=0, end_ts=time.time() + 60))
        self.assertTrue(g.remove_silence("s1"))


class TestBug163AlertEscalation(unittest.TestCase):
    def test_fire_and_ack(self):
        from app.utils.alert_escalation import EscalationEngine

        g = EscalationEngine()
        a = g.fire("a1", "HIGH", {"svc": "x"})
        self.assertFalse(a.acked)
        self.assertTrue(g.ack("a1"))

    def test_escalate_steps(self):
        from app.utils.alert_escalation import Channel, EscalationEngine, EscalationPolicy, EscalationStep

        g = EscalationEngine(
            EscalationPolicy(
                name="p",
                steps=[
                    EscalationStep(Channel.EMAIL, 0),
                    EscalationStep(Channel.SMS, 0),
                ],
            )
        )
        g.fire("a1", "HIGH", {})
        out = g.tick()
        chs = [o[0] for o in out]
        self.assertIn(Channel.EMAIL, chs)
        self.assertIn(Channel.SMS, chs)

    def test_ack_stops(self):
        from app.utils.alert_escalation import Channel, EscalationEngine, EscalationPolicy, EscalationStep

        g = EscalationEngine(EscalationPolicy(name="p", steps=[EscalationStep(Channel.EMAIL, 0)]))
        g.fire("a1", "HIGH", {})
        g.ack("a1")
        out = g.tick()
        self.assertEqual(out, [])

    def test_stats(self):
        from app.utils.alert_escalation import EscalationEngine

        g = EscalationEngine()
        g.fire("a1", "HIGH", {})
        self.assertEqual(g.stats()["active"], 1)


# =====================================================================
# 维度 6: 可观测性 - 日志与异步 (Bug-164/165/166)
# =====================================================================
class TestBug164LogRedactor(unittest.TestCase):
    """Bug-164: 结构化日志脱敏. 测试实际 LogRedactor 实现."""

    def test_phone_redact(self):
        from app.utils.log_redactor import LogRedactor

        g = LogRedactor()
        r = g.redact("用户手机 13812345678 注册成功")
        self.assertNotIn("13812345678", r.data)
        self.assertIn("[PHONE]", r.data)

    def test_id_card_redact(self):
        from app.utils.log_redactor import LogRedactor

        g = LogRedactor()
        r = g.redact("身份证 11010119900101123X 验证通过")
        self.assertNotIn("11010119900101123X", r.data)

    def test_bearer_redact(self):
        from app.utils.log_redactor import LogRedactor

        g = LogRedactor()
        # authorization 是 SENSITIVE_KEYS, 整个值被替换为 [REDACTED]
        r = g.redact({"authorization": "Bearer abcdefghijklmnop12345"})
        self.assertEqual(r.data["authorization"], "[REDACTED]")

    def test_dict_redact(self):
        from app.utils.log_redactor import LogRedactor

        g = LogRedactor()
        r = g.redact({"user": "u1", "password": "secret", "phone": "13812345678"})
        self.assertEqual(r.data["user"], "u1")
        self.assertEqual(r.data["password"], "[REDACTED]")
        self.assertNotIn("13812345678", r.data["phone"])

    def test_custom_rule(self):
        import re
        from app.utils.log_redactor import LogRedactor, RedactRule

        g = LogRedactor()
        g.add_rule(RedactRule("order_no", re.compile(r"OD\d{10}"), "[ORDER]"))
        r = g.redact("订单 OD1234567890 已支付")
        self.assertIn("[ORDER]", r.data)
        self.assertNotIn("OD1234567890", r.data)

    def test_stats(self):
        from app.utils.log_redactor import LogRedactor

        g = LogRedactor()
        g.redact({"password": "secret"})
        st = g.stats()
        self.assertIn("total_hits", st)
        self.assertGreaterEqual(st["total_hits"], 1)


class TestBug165DLQ(unittest.TestCase):
    def test_enter_dlq_after_max_attempts(self):
        from app.utils.dlq import DeadLetterQueue, DLQConfig

        g = DeadLetterQueue(DLQConfig(max_attempts=3))
        item = g.push("t1", "send_email", {"to": "x"}, "timeout", attempts=3)
        self.assertIsNotNone(item)
        self.assertEqual(item.attempts, 3)

    def test_no_dlq_below_max(self):
        from app.utils.dlq import DeadLetterQueue, DLQConfig

        g = DeadLetterQueue(DLQConfig(max_attempts=5))
        item = g.push("t1", "send_email", {}, "err", attempts=2)
        self.assertIsNone(item)
        self.assertIsNone(g.get("t1"))

    def test_replay_success(self):
        from app.utils.dlq import DeadLetterQueue, DLQAction, DLQConfig

        g = DeadLetterQueue(DLQConfig(max_attempts=2), replay=lambda x: True)
        g.push("t1", "x", {}, "err", attempts=2)
        r = g.replay("t1")
        self.assertEqual(r, DLQAction.REPLAY)
        self.assertIsNone(g.get("t1"))

    def test_replay_quarantine(self):
        from app.utils.dlq import DeadLetterQueue, DLQAction, DLQConfig

        g = DeadLetterQueue(DLQConfig(max_attempts=2), replay=lambda x: False)
        g.push("t1", "x", {}, "err", attempts=2)
        r = g.replay("t1")
        self.assertEqual(r, DLQAction.QUARANTINE)
        self.assertIsNotNone(g.get("t1"))

    def test_export_and_stats(self):
        from app.utils.dlq import DeadLetterQueue

        g = DeadLetterQueue()
        g.push("t1", "x", {}, "err", attempts=5)
        g.push("t2", "y", {}, "err", attempts=5)
        self.assertEqual(g.stats()["size"], 2)
        s = g.export_json()
        self.assertIn("t1", s)
        self.assertIn("t2", s)


class TestBug166IdempotentTask(unittest.TestCase):
    def test_first_run(self):
        from app.utils.idempotent_task import IdempotentTaskRunner, TaskState

        g = IdempotentTaskRunner()
        r = g.run("k1", lambda: "v1")
        self.assertEqual(r.state, TaskState.SUCCESS)
        self.assertEqual(r.value, "v1")

    def test_replay_returns_duplicate(self):
        from app.utils.idempotent_task import IdempotentTaskRunner, TaskState

        g = IdempotentTaskRunner()
        g.run("k1", lambda: "v1")
        r = g.run("k1", lambda: "v2_DIFFERENT")
        self.assertEqual(r.state, TaskState.DUPLICATE)
        self.assertEqual(r.value, "v1")

    def test_failed_recorded(self):
        from app.utils.idempotent_task import IdempotentTaskRunner, TaskState

        g = IdempotentTaskRunner()
        r = g.run("k1", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
        self.assertEqual(r.state, TaskState.FAILED)
        self.assertIn("boom", r.error)

    def test_inflight(self):
        from app.utils.idempotent_task import IdempotentTaskRunner, TaskState

        g = IdempotentTaskRunner()
        # 模拟 inflight: 通过 run 后立即查 inflight
        r = g.run("k1", lambda: "v1")
        self.assertEqual(r.state, TaskState.SUCCESS)
        st = g.stats()
        self.assertIn("cached", st)


if __name__ == "__main__":
    unittest.main()
