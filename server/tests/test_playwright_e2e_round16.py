"""第十六轮 性能与可观测性 端到端测试 (Bug-149 ~ Bug-166).

6 维度巡检端到端验证:
  - 性能-查询与缓存: Bug-149 N+1 检测 / Bug-150 慢 SQL 熔断 / Bug-151 缓存预热
  - 性能-资源池:    Bug-152 连接池 / Bug-153 内存泄漏 / Bug-154 GC 压力
  - 可观测性-链路:  Bug-155 Trace 上下文 / Bug-156 采样 / Bug-157 跨服务
  - 可观测性-指标:  Bug-158 基数 / Bug-159 SLA / Bug-160 健康检查
  - 可观测性-告警:  Bug-161 去重 / Bug-162 抑制 / Bug-163 升级
  - 可观测性-日志:  Bug-164 脱敏 / Bug-165 DLQ / Bug-166 幂等
"""

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("ENV", "test")
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


# =====================================================================
# 维度 1: 性能-查询与缓存
# =====================================================================
class TestPerfQueryE2E:
    def test_bug149_n1_alert(self):
        from app.utils.n1_detector import N1Config, N1Detector

        cfg = N1Config(max_parents=1, max_fanout_ratio=3.0, cooldown_sec=0)
        g = N1Detector(cfg)
        g.record_parent("fp1")
        for _ in range(8):
            g.record_child("fp1")
        st = g.stats()
        assert st["alerts"] >= 1
        assert st["tracked_parents"] >= 1
        assert st["tracked_children"] >= 8

    def test_bug150_slow_sql_breaker(self):
        from app.utils.slow_sql_killer import (
            CircuitOpen,
            SlowSQLConfig,
            SlowSQLKiller,
        )

        cfg = SlowSQLConfig(window_size=10, slow_ms=50, breaker_p_ms=80, open_sec=1)
        g = SlowSQLKiller(cfg)
        # 注入慢查询触发熔断
        for _ in range(10):
            g.record("select slow_q", 200, ok=True)
        # 后续调用应被熔断
        raised = False
        try:
            g.before_call("select slow_q")
        except CircuitOpen:
            raised = True
        assert raised, "慢 SQL 熔断未生效"

    def test_bug151_cache_warm(self):
        from app.utils.cache_warmer import CacheWarmer

        store = {}
        g = CacheWarmer(
            cache_get=lambda k: store.get(k),
            cache_set=lambda k, v, t: store.__setitem__(k, v),
        )
        results = g.warm(
            [
                g.register("k1", lambda: "v1"),
                g.register("k2", lambda: "v2"),
            ],
            force=True,
        )
        assert all(r.ok for r in results)
        assert store["k1"] == "v1"
        # 预热后 hit/miss 统计
        g.hit()
        g.hit()
        g.miss()
        assert 0.0 < g.hit_rate() < 1.0


# =====================================================================
# 维度 2: 性能-资源池
# =====================================================================
class TestPerfResourceE2E:
    def test_bug152_pool_borrow_release(self):
        from app.utils.pool_monitor import ConnPool, PoolConfig

        pool = ConnPool("db", PoolConfig(max_size=3, saturation_warn=0.5))
        c1 = pool.borrow()
        c2 = pool.borrow()
        assert pool.stats()["in_use"] == 2
        pool.release(c1)
        pool.release(c2)
        assert pool.stats()["in_use"] == 0

    def test_bug153_memory_leak_snapshot(self):
        from app.utils.memory_leak import MemoryLeakDetector

        g = MemoryLeakDetector()
        # 触发一次分配让 tracemalloc 有数据
        _ = [i * i for i in range(1000)]
        s = g.snapshot()
        assert s.rss_kb >= 0
        assert s.py_alloc_kb >= 0
        st = g.stats()
        assert st["samples"] >= 1

    def test_bug154_gc_pressure(self):
        from app.utils.gc_pressure import GCPressureMonitor

        g = GCPressureMonitor()
        g.snapshot()
        r = g.force_collect()
        assert "before" in r
        st = g.stats()
        assert st["samples"] >= 1


# =====================================================================
# 维度 3: 可观测性-链路
# =====================================================================
class TestObsTraceE2E:
    def test_bug155_trace_roundtrip(self):
        from app.utils.trace_context import (
            SpanContext,
            TraceRecorder,
            current_span,
            span_scope,
        )

        rec = TraceRecorder()
        root = SpanContext.new_root()
        rec.on_start(root)
        with span_scope(root):
            assert current_span().trace_id == root.trace_id
            child = SpanContext.new_child(root)
            assert child.parent_span_id == root.span_id
        time.sleep(0.001)
        rec.on_end(root)
        st = rec.snapshot()
        assert st["ends"] == 1

    def test_bug156_sampler_priority(self):
        from app.utils.sampler import Priority, SamplerConfig, TraceSampler

        cfg = SamplerConfig(
            rate_by_priority={
                "LOW": 0.0,
                "NORMAL": 0.0,
                "HIGH": 1.0,
                "CRITICAL": 1.0,
            }
        )
        g = TraceSampler(cfg)
        # 高级必采
        for i in range(10):
            assert g.should_sample(f"t{i}", Priority.HIGH)
        # 低级必不采
        for i in range(10):
            assert not g.should_sample(f"t{i}", Priority.LOW)

    def test_bug157_propagation(self):
        from app.utils.trace_context import SpanContext, span_scope
        from app.utils.propagator import TracePropagator

        p = TracePropagator()
        ctx = SpanContext.new_root()
        with span_scope(ctx):
            http_h = p.inject_http({})
            kafka_h = p.inject_kafka({})
        c1 = p.extract_http(http_h)
        c2 = p.extract_kafka(kafka_h)
        assert c1.trace_id == ctx.trace_id
        assert c2.trace_id == ctx.trace_id
        st = p.stats()
        assert st["ok"] >= 2


# =====================================================================
# 维度 4: 可观测性-指标
# =====================================================================
class TestObsMetricE2E:
    def test_bug158_cardinality_bucket(self):
        from app.utils.cardinality import CardinalityConfig, MetricRegistry

        g = MetricRegistry(CardinalityConfig(bucket_count=8))
        for i in range(500):
            g.observe("http_req", {"user_id": f"u{i}"}, 1.0)
        # 桶化后基数受控
        assert g.series_count("http_req") <= 8

    def test_bug159_sla_burn(self):
        from app.utils.sla import SLACalculator, SLATarget

        g = SLACalculator(SLATarget(name="t", slo=0.99))
        for _ in range(99):
            g.record(ok=True)
        g.record(ok=False)
        assert g.availability("24h") > 0.95
        assert g.burn_rate("24h") > 0

    def test_bug160_health_3_states(self):
        from app.utils.health import Check, HealthChecker

        g = HealthChecker()
        g.add_liveness(Check(name="proc", fn=lambda: True))
        g.add_readiness(Check(name="db", fn=lambda: True))
        g.add_startup(Check(name="warm", fn=lambda: True))
        g.start()
        g.mark_startup_done()
        assert g.liveness()[0].value == "OK"
        assert g.readiness()[0].value == "OK"
        assert g.startup()[0].value == "OK"


# =====================================================================
# 维度 5: 可观测性-告警
# =====================================================================
class TestObsAlertE2E:
    def test_bug161_alert_dedup(self):
        from app.utils.alert_dedup import AlertDeduplicator

        g = AlertDeduplicator()
        for _ in range(20):
            a = g.push("HIGH", {"svc": "x"}, "cpu 99%")
        assert a.count == 20
        # 不同 label 单独聚合
        g.push("HIGH", {"svc": "y"}, "cpu 99%")
        assert g.stats()["active_buckets"] == 2

    def test_bug162_alert_silence_and_inhibit(self):
        from app.utils.alert_inhibit import (
            AlertSuppressor,
            SilenceRule,
        )

        g = AlertSuppressor()
        g.add_silence(
            SilenceRule(id="s1", match_labels={"svc": "x"}, start_ts=time.time() - 10, end_ts=time.time() + 60)
        )
        d1 = g.evaluate({"svc": "x"}, "LOW")
        assert d1.silenced
        d2 = g.evaluate({"svc": "y"}, "LOW")
        assert not d2.silenced

    def test_bug163_escalation_ladder(self):
        from app.utils.alert_escalation import (
            Channel,
            EscalationEngine,
            EscalationPolicy,
            EscalationStep,
        )

        g = EscalationEngine(
            EscalationPolicy(
                name="p",
                steps=[
                    EscalationStep(Channel.EMAIL, 0),
                    EscalationStep(Channel.SMS, 0),
                    EscalationStep(Channel.PHONE, 0),
                ],
            )
        )
        g.fire("a1", "HIGH", {})
        out = g.tick()
        channels = [o[0] for o in out]
        assert Channel.EMAIL in channels
        assert Channel.SMS in channels
        assert Channel.PHONE in channels
        # ack 后不再升级
        g.ack("a1")
        out2 = g.tick()
        assert out2 == []


# =====================================================================
# 维度 6: 可观测性-日志/异步
# =====================================================================
class TestObsLogAsyncE2E:
    def test_bug164_log_redact(self):
        from app.utils.log_redactor import LogRedactor

        g = LogRedactor()
        # 手机号/身份证/邮箱/Bearer
        text = "用户 13812345678 / 11010119900101123X / a@b.com / Bearer abcdefghijkl1234"
        out = g.redact_text(text)
        assert "13812345678" not in out
        assert "11010119900101123X" not in out
        assert "a@b.com" not in out
        # dict 字段
        d = g.redact_dict({"username": "u1", "password": "secret", "api_key": "k1"})
        assert d["username"] == "u1"
        assert d["password"] == "[REDACTED]"
        assert d["api_key"] == "[REDACTED]"

    def test_bug165_dlq_lifecycle(self):
        from app.utils.dlq import DeadLetterQueue, DLQAction, DLQConfig

        g = DeadLetterQueue(DLQConfig(max_attempts=3), replay=lambda x: True)
        # 不到阈值不入队
        assert g.push("t1", "x", {}, "e", attempts=2) is None
        # 超过阈值入队
        item = g.push("t1", "x", {}, "e", attempts=5)
        assert item is not None
        # 重投成功
        assert g.replay("t1") == DLQAction.REPLAY
        assert g.get("t1") is None
        # 导出
        g.push("t2", "y", {}, "e", attempts=5)
        assert "t2" in g.export_json()

    def test_bug166_idempotent_task(self):
        from app.utils.idempotent_task import (
            IdempotentTaskRunner,
            TaskState,
        )

        g = IdempotentTaskRunner()
        # 首次成功
        r1 = g.run("k1", lambda: "result-A")
        assert r1.state == TaskState.SUCCESS
        assert r1.value == "result-A"
        # 重放返回原结果
        r2 = g.run("k1", lambda: "result-B")
        assert r2.state == TaskState.DUPLICATE
        assert r2.value == "result-A"
        # 失败固化
        r3 = g.run("k2", lambda: (_ for _ in ()).throw(ValueError("boom")))
        assert r3.state == TaskState.FAILED
        r4 = g.run("k2", lambda: "v2")
        assert r4.state == TaskState.DUPLICATE
        assert "boom" in r4.error
