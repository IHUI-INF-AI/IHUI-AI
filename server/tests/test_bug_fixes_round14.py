"""第十四轮Bug修复回归测试 (Bug-123 ~ Bug-130)
涵盖流式窗口、重试编排、脱敏管道、幂等键、风控引擎、校验链、任务去重、数据质量监控
"""

import os
import sys
import time
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..")))

from app.utils.data_masking_pipeline import (
    DataMaskingPipeline,
    FieldMaskRule,
    MaskStrategy,
)
from app.utils.data_quality_monitor import (
    DataQualityMonitor,
    DQDimension,
    DQRule,
)
from app.utils.idempotency_key import (
    ConflictInfo,
    IdempotencyConfig,
    IdempotencyKeyManager,
    KeyState,
    build_idempotency_key,
    compute_request_hash,
)
from app.utils.message_retry_orchestrator import (
    DeadLetter,
    MessageRetryOrchestrator,
    RetryPolicy,
    RetryState,
)
from app.utils.risk_rule_engine import (
    RiskRule,
    RiskRuleEngine,
    RuleAction,
    SafeEvaluator,
)
from app.utils.stream_window_aggregator import (
    StreamEvent,
    StreamWindowAggregator,
    WindowSpec,
    WindowType,
)
from app.utils.task_deduper import (
    DedupTaskState,
    TaskDeduper,
    compute_dedup_key,
)
from app.utils.validation_chain import (
    FieldSchema,
    FieldType,
    Severity,
    ValidationChain,
    ValidationRule,
)


# =====================================================================
# Bug-123 流式窗口聚合
# =====================================================================
class TestStreamWindowAggregator(unittest.TestCase):

    def test_tumbling_window_close_on_watermark(self):
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.TUMBLING.value,
                size_sec=10,
                watermark_delay_sec=0,
                allowed_lateness_sec=0,
            )
        )
        # 事件 t=1,3,5 都进 [0,10) 窗口
        for t in (1, 3, 5):
            agg.add(StreamEvent(key="g", value=1.0, event_time=float(t), group="g"))
        # t=12 推进水位线到 12, 超过 [0,10) 结束
        agg.add(StreamEvent(key="g", value=1.0, event_time=12.0, group="g"))
        closed = agg.list_closed()
        self.assertEqual(len(closed), 1)
        self.assertEqual(closed[0].count, 3)
        self.assertEqual(closed[0].sum, 3.0)

    def test_tumbling_late_dropped(self):
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.TUMBLING.value,
                size_sec=10,
                watermark_delay_sec=0,
                allowed_lateness_sec=0,
            )
        )
        # 推进水位线
        agg.add(StreamEvent(key="g", value=1.0, event_time=20.0, group="g"))
        # 极迟到数据
        agg.add(StreamEvent(key="g", value=1.0, event_time=2.0, group="g"))
        s = agg.stats()
        self.assertEqual(s["late_events"], 1)

    def test_sliding_window_multi(self):
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.SLIDING.value,
                size_sec=10,
                slide_sec=5,
                watermark_delay_sec=0,
                allowed_lateness_sec=0,
            )
        )
        agg.add(StreamEvent(key="g", value=1.0, event_time=12.0, group="g"))
        agg.add(StreamEvent(key="g", value=1.0, event_time=30.0, group="g"))
        closed = agg.list_closed()
        self.assertGreaterEqual(len(closed), 1)

    def test_session_window(self):
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.SESSION.value,
                size_sec=10,
                session_gap_sec=5,
                watermark_delay_sec=0,
                allowed_lateness_sec=0,
            )
        )
        agg.add(StreamEvent(key="g", value=1.0, event_time=1.0, group="u1"))
        agg.add(StreamEvent(key="g", value=1.0, event_time=3.0, group="u1"))
        # 推进水位线关闭第一个 session
        agg.add(StreamEvent(key="g", value=1.0, event_time=50.0, group="u1"))
        closed = agg.list_closed()
        self.assertGreaterEqual(len(closed), 1)
        # session 至少 1 个事件
        self.assertGreaterEqual(closed[0].count, 1)

    def test_force_close(self):
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.TUMBLING.value,
                size_sec=10,
            )
        )
        agg.add(StreamEvent(key="g", value=1.0, event_time=1.0, group="g"))
        agg.add(StreamEvent(key="g", value=2.0, event_time=3.0, group="g"))
        closed = agg.force_close("g")
        self.assertEqual(len(closed), 1)
        self.assertEqual(closed[0].count, 2)

    def test_stats(self):
        agg = StreamWindowAggregator(WindowSpec(type=WindowType.TUMBLING.value, size_sec=10))
        agg.add(StreamEvent(key="g", value=1.0, event_time=1.0, group="g"))
        s = agg.stats()
        self.assertEqual(s["total_events"], 1)
        self.assertIn("active_windows", s)

    def test_watermark(self):
        agg = StreamWindowAggregator(
            WindowSpec(
                type=WindowType.TUMBLING.value,
                size_sec=10,
                watermark_delay_sec=2,
            )
        )
        agg.add(StreamEvent(key="g", value=1.0, event_time=100.0, group="g"))
        self.assertEqual(agg.watermark("g"), 98.0)


# =====================================================================
# Bug-124 消息重试编排器
# =====================================================================
class TestMessageRetryOrchestrator(unittest.TestCase):

    def test_submit_and_attempt_success(self):
        orch = MessageRetryOrchestrator(
            RetryPolicy(
                failure_threshold=3,
                max_attempts=3,
            )
        )
        orch.set_handler(lambda p: True)
        m = orch.submit("m1", payload={"x": 1})
        self.assertEqual(m.state, RetryState.PENDING.value)
        r = orch.attempt("m1")
        self.assertEqual(r.state, RetryState.SUCCEEDED.value)
        self.assertEqual(orch.stats()["total_succeeded"], 1)

    def test_attempt_failure_schedules_retry(self):
        orch = MessageRetryOrchestrator(
            RetryPolicy(
                initial_delay_sec=0.05,
                max_delay_sec=1.0,
                max_attempts=5,
                backoff_multiplier=1.0,
                jitter=0.0,
                failure_threshold=99,
            )
        )
        orch.set_handler(lambda p: False)
        m = orch.submit("m1", payload={})
        r = orch.attempt("m1")
        self.assertEqual(r.state, RetryState.RETRY_SCHEDULED.value)
        self.assertEqual(r.attempts, 1)
        time.sleep(0.1)
        ready = orch.ready_for_retry()
        self.assertTrue(any(x.id == "m1" for x in ready))

    def test_circuit_breaker_opens(self):
        orch = MessageRetryOrchestrator(
            RetryPolicy(
                failure_threshold=2,
                max_attempts=99,
                circuit_reset_sec=60,
                initial_delay_sec=0.0,
            )
        )
        orch.set_handler(lambda p: False)
        orch.submit("m1", payload={})
        orch.attempt("m1")
        orch.submit("m2", payload={})
        r = orch.attempt("m2")
        # m2 触发熔断, 提交 m3 后 attempt 应返回 CIRCUIT_OPEN
        orch.submit("m3", payload={})
        r3 = orch.attempt("m3")
        self.assertEqual(r3.state, RetryState.CIRCUIT_OPEN.value)
        cs = orch.circuit_state()
        self.assertTrue(cs["open"])

    def test_dead_letter(self):
        orch = MessageRetryOrchestrator(
            RetryPolicy(
                initial_delay_sec=0.0,
                max_attempts=2,
                failure_threshold=99,
                jitter=0.0,
            )
        )
        orch.set_handler(lambda p: False)
        m = orch.submit("m1", payload={})
        orch.attempt("m1")  # attempts=1, 还没到 max
        r2 = orch.attempt("m1")  # attempts=2 = max_attempts -> DEAD_LETTER
        self.assertEqual(r2.state, RetryState.DEAD_LETTER.value)
        dls = orch.list_dead_letters()
        self.assertEqual(len(dls), 1)
        self.assertIsInstance(dls[0], DeadLetter)

    def test_reset_circuit(self):
        orch = MessageRetryOrchestrator(RetryPolicy(failure_threshold=1))
        orch._consecutive_failures = 5
        orch._circuit_opened_at = time.time()
        orch.reset_circuit()
        self.assertEqual(orch._circuit_opened_at, 0.0)
        self.assertEqual(orch._consecutive_failures, 0)


# =====================================================================
# Bug-125 数据脱敏管道
# =====================================================================
class TestDataMaskingPipeline(unittest.TestCase):

    def test_full_mask(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="password", strategy=MaskStrategy.FULL.value))
        result = pipe.mask({"password": "123456"})
        self.assertEqual(result["password"], "[REDACTED]")

    def test_partial_mask(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(
            FieldMaskRule(
                field="id",
                strategy=MaskStrategy.PARTIAL.value,
                keep_prefix=2,
                keep_suffix=2,
            )
        )
        result = pipe.mask({"id": "1234567890"})
        self.assertTrue(result["id"].startswith("12"))
        self.assertTrue(result["id"].endswith("90"))
        self.assertIn("*", result["id"])

    def test_email_phone_idcard_strategies(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="email", strategy=MaskStrategy.EMAIL.value))
        pipe.add_rule(FieldMaskRule(field="phone", strategy=MaskStrategy.PHONE.value))
        pipe.add_rule(FieldMaskRule(field="id_card", strategy=MaskStrategy.ID_CARD.value))
        result = pipe.mask(
            {
                "email": "alice@example.com",
                "phone": "13800138000",
                "id_card": "11010119900101001X",
            }
        )
        self.assertNotIn("alice@example.com", result["email"])
        self.assertIn("@", result["email"])
        self.assertTrue(result["phone"].startswith("138"))
        self.assertTrue(result["phone"].endswith("8000"))

    def test_hash_strategies(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="k", strategy=MaskStrategy.HASH.value))
        r1 = pipe.mask({"k": "secret"})
        self.assertEqual(len(r1["k"]), 16)
        pipe2 = DataMaskingPipeline()
        pipe2.add_rule(FieldMaskRule(field="k", strategy=MaskStrategy.HMAC.value))
        r2 = pipe2.mask({"k": "secret"})
        self.assertEqual(len(r2["k"]), 16)

    def test_default_sensitive_fields(self):
        pipe = DataMaskingPipeline()
        result = pipe.mask(
            {
                "password": "x",
                "token": "y",
                "id_card": "11010119900101001X",
            }
        )
        self.assertEqual(result["password"], "[REDACTED]")
        self.assertNotEqual(result["token"], "y")
        self.assertNotIn("11010119900101001X", result["id_card"])

    def test_mask_rows_with_filters(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="password", strategy=MaskStrategy.FULL.value))
        rows = [{"name": "A", "password": "p1"}, {"name": "B", "password": "p2"}]
        pipe.add_row_filter(lambda r: r["name"] == "B")  # 过滤B
        result = pipe.mask_rows(rows)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "A")
        self.assertEqual(result[0]["password"], "[REDACTED]")

    def test_audit_log(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="a", strategy=MaskStrategy.FULL.value))
        pipe.mask({"a": "v"})
        audits = pipe.list_audits()
        self.assertEqual(len(audits), 1)
        self.assertEqual(audits[0].field, "a")

    def test_nested_mask(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="password", strategy=MaskStrategy.FULL.value))
        result = pipe.mask({"user": {"password": "x", "ok": 1}})
        self.assertEqual(result["user"]["password"], "[REDACTED]")
        self.assertEqual(result["user"]["ok"], 1)

    def test_keep_prefix(self):
        pipe = DataMaskingPipeline()
        pipe.add_rule(FieldMaskRule(field="k", strategy=MaskStrategy.KEEP_PREFIX.value, keep_prefix=3))
        r = pipe.mask({"k": "abcdefgh"})
        self.assertTrue(r["k"].startswith("abc"))


# =====================================================================
# Bug-126 业务幂等键
# =====================================================================
class TestIdempotencyKey(unittest.TestCase):

    def test_compute_hash_stable(self):
        h1 = compute_request_hash({"a": 1, "b": 2})
        h2 = compute_request_hash({"b": 2, "a": 1})
        self.assertEqual(h1, h2)

    def test_build_idempotency_key(self):
        k1 = build_idempotency_key("t1", "order", "O001", {"a": 1})
        k2 = build_idempotency_key("t1", "order", "O001", {"a": 1})
        k3 = build_idempotency_key("t2", "order", "O001", {"a": 1})
        self.assertEqual(k1, k2)
        self.assertNotEqual(k1, k3)
        self.assertEqual(len(k1), 32)

    def test_acquire_or_conflict(self):
        mgr = IdempotencyKeyManager()
        r1 = mgr.acquire_or_conflict("t1", "order", "O001", {"a": 1}, owner="w1")
        self.assertNotIsInstance(r1, ConflictInfo)
        # 同payload, 同owner -> 续约
        r2 = mgr.acquire_or_conflict("t1", "order", "O001", {"a": 1}, owner="w1")
        self.assertNotIsInstance(r2, ConflictInfo)
        # 同key, 不同owner -> 冲突
        r3 = mgr.acquire_or_conflict("t1", "order", "O001", {"a": 1}, owner="w2")
        self.assertIsInstance(r3, ConflictInfo)

    def test_complete_and_stats(self):
        mgr = IdempotencyKeyManager()
        r = mgr.acquire_or_conflict("t1", "x", "k1", owner="w1")
        mgr.complete(r.key, result={"ok": True})
        rec = mgr.get(r.key)
        self.assertEqual(rec.state, KeyState.COMPLETED)
        s = mgr.stats()
        self.assertEqual(s["completed"], 1)

    def test_force_expire(self):
        mgr = IdempotencyKeyManager()
        r = mgr.acquire_or_conflict("t1", "x", "k1", owner="w1")
        self.assertTrue(mgr.force_expire(r.key))
        self.assertIsNone(mgr.get(r.key))

    def test_tenant_isolation_required(self):
        mgr = IdempotencyKeyManager(IdempotencyConfig(enable_tenant_isolation=True))
        with self.assertRaises(ValueError):
            mgr.acquire_or_conflict("", "x", "k1", owner="w1")

    def test_release_lock(self):
        mgr = IdempotencyKeyManager()
        r = mgr.acquire_or_conflict("t1", "x", "k1", owner="w1")
        self.assertTrue(mgr.release_lock(r.key))


# =====================================================================
# Bug-127 实时风控规则引擎
# =====================================================================
class TestRiskRuleEngine(unittest.TestCase):

    def test_safe_evaluator_basics(self):
        ev = SafeEvaluator()
        ev.set_vars({"a": 5, "b": 10})
        self.assertTrue(ev.evaluate("a < b"))
        self.assertTrue(ev.evaluate("a + 5 == 10"))
        self.assertTrue(ev.evaluate("'abc' in 'abcdef'"))
        self.assertTrue(ev.evaluate("min(a,b) == 5"))
        self.assertTrue(ev.evaluate("contains('hello world', 'world')"))
        self.assertTrue(ev.evaluate("regex('abc123', '^abc')"))

    def test_safe_evaluator_ternary(self):
        ev = SafeEvaluator()
        ev.set_vars({"x": 1})
        self.assertEqual(ev.evaluate("1 if x > 0 else 0"), 1)
        self.assertEqual(ev.evaluate("1 if x < 0 else 0"), 0)

    def test_engine_evaluate_deny(self):
        eng = RiskRuleEngine()
        eng.add_rule(
            RiskRule(
                rule_id="r1",
                name="金额过大",
                expression="amount > 10000",
                action=RuleAction.DENY,
                priority=10,
            )
        )
        action, hits = eng.evaluate("u1", {"amount": 99999})
        self.assertEqual(action, RuleAction.DENY)
        self.assertEqual(len(hits), 1)

    def test_engine_short_circuit(self):
        eng = RiskRuleEngine()
        eng.add_rule(RiskRule(rule_id="first", name="F", expression="x > 0", action=RuleAction.DENY, priority=1))
        eng.add_rule(RiskRule(rule_id="never", name="N", expression="x > 0", action=RuleAction.ALLOW, priority=2))
        action, hits = eng.evaluate("u1", {"x": 5})
        self.assertEqual(action, RuleAction.DENY)
        self.assertEqual(len(hits), 1)

    def test_engine_disable(self):
        eng = RiskRuleEngine()
        eng.add_rule(RiskRule(rule_id="r", name="r", expression="x>0", action=RuleAction.DENY, priority=1))
        eng.enable_rule("r", False)
        action, hits = eng.evaluate("u1", {"x": 5})
        self.assertEqual(action, RuleAction.ALLOW)
        self.assertEqual(len(hits), 0)

    def test_engine_stats(self):
        eng = RiskRuleEngine()
        eng.add_rule(RiskRule(rule_id="r", name="r", expression="x>0", action=RuleAction.DENY, priority=1))
        eng.evaluate("u1", {"x": 1})
        s = eng.stats()
        self.assertEqual(s["rules_total"], 1)
        self.assertEqual(s["hits_total"], 1)


# =====================================================================
# Bug-128 数据校验链
# =====================================================================
class TestValidationChain(unittest.TestCase):

    def test_required_field(self):
        chain = ValidationChain()
        chain.add_rule(
            ValidationRule(
                rule_id="r1", name="r1", schema=FieldSchema(field="name", type=FieldType.STRING, required=True)
            )
        )
        r = chain.validate({})
        self.assertFalse(r.passed)
        self.assertEqual(len(r.errors), 1)
        self.assertEqual(r.errors[0].code, "REQUIRED")

    def test_type_check(self):
        chain = ValidationChain()
        chain.add_rule(ValidationRule(rule_id="r1", name="r1", schema=FieldSchema(field="age", type=FieldType.INTEGER)))
        r = chain.validate({"age": "abc"})
        self.assertFalse(r.passed)
        self.assertEqual(r.errors[0].code, "TYPE_MISMATCH")

    def test_email_format(self):
        chain = ValidationChain()
        chain.add_rule(ValidationRule(rule_id="r1", name="r1", schema=FieldSchema(field="email", type=FieldType.EMAIL)))
        r = chain.validate({"email": "not-an-email"})
        self.assertFalse(r.passed)
        r2 = chain.validate({"email": "ok@example.com"})
        self.assertTrue(r2.passed)

    def test_length_constraints(self):
        chain = ValidationChain()
        chain.add_rule(
            ValidationRule(
                rule_id="r1",
                name="r1",
                schema=FieldSchema(
                    field="name",
                    type=FieldType.STRING,
                    min_length=3,
                    max_length=10,
                ),
            )
        )
        # 超出 max 应有 ERROR 级别
        r_long = chain.validate({"name": "x" * 20})
        self.assertFalse(r_long.passed)
        # 满足约束
        self.assertTrue(chain.validate({"name": "abcdef"}).passed)

    def test_min_length_warn(self):
        chain = ValidationChain()
        chain.add_rule(
            ValidationRule(
                rule_id="r1",
                name="r1",
                schema=FieldSchema(
                    field="name",
                    type=FieldType.STRING,
                    min_length=3,
                ),
            )
        )
        r = chain.validate({"name": "ab"})
        # MIN_LENGTH 是 WARN, passed 仍为 True
        self.assertTrue(r.passed)
        self.assertEqual(len(r.errors), 1)
        self.assertEqual(r.errors[0].code, "MIN_LENGTH")

    def test_choices(self):
        chain = ValidationChain()
        chain.add_rule(
            ValidationRule(
                rule_id="r1", name="r1", schema=FieldSchema(field="status", type=FieldType.STRING, choices=["A", "B"])
            )
        )
        self.assertFalse(chain.validate({"status": "C"}).passed)
        self.assertTrue(chain.validate({"status": "A"}).passed)

    def test_predicate(self):
        chain = ValidationChain()
        chain.add_rule(
            ValidationRule(
                rule_id="r1",
                name="r1",
                field="x",
                severity=Severity.ERROR,
                predicate=lambda d: "x 必须 > 0" if d.get("x", 0) <= 0 else None,
            )
        )
        self.assertFalse(chain.validate({"x": -1}).passed)
        self.assertTrue(chain.validate({"x": 1}).passed)

    def test_short_circuit_critical(self):
        from app.utils.validation_chain import ChainConfig

        chain = ValidationChain(ChainConfig(short_circuit_on_critical=True))
        chain.add_rule(
            ValidationRule(
                rule_id="c1",
                name="c1",
                field="a",
                severity=Severity.CRITICAL,
                predicate=lambda d: "bad" if d.get("a") == 1 else None,
            )
        )
        chain.add_rule(
            ValidationRule(
                rule_id="c2",
                name="c2",
                field="b",
                severity=Severity.ERROR,
                predicate=lambda d: "bad" if d.get("b") == 1 else None,
            )
        )
        r = chain.validate({"a": 1, "b": 1})
        self.assertTrue(r.has_critical())
        self.assertEqual(len(r.rule_results), 1)

    def test_stop_on_error(self):
        from app.utils.validation_chain import ChainConfig

        chain = ValidationChain(ChainConfig(stop_on_error=True))
        chain.add_rule(
            ValidationRule(
                rule_id="e1",
                name="e1",
                field="a",
                severity=Severity.ERROR,
                predicate=lambda d: "bad" if d.get("a") == 1 else None,
            )
        )
        chain.add_rule(
            ValidationRule(
                rule_id="e2",
                name="e2",
                field="b",
                severity=Severity.ERROR,
                predicate=lambda d: "bad" if d.get("b") == 1 else None,
            )
        )
        r = chain.validate({"a": 1, "b": 1})
        self.assertEqual(len(r.rule_results), 1)


# =====================================================================
# Bug-129 异步任务去重
# =====================================================================
class TestTaskDeduper(unittest.TestCase):

    def test_submit_dedup(self):
        d = TaskDeduper()
        t1 = d.submit("order", {"oid": 1}, payload={"x": 1})
        t2 = d.submit("order", {"oid": 1}, payload={"x": 2})
        self.assertEqual(t1.state, DedupTaskState.PENDING)
        self.assertEqual(t2.state, DedupTaskState.MERGED)
        self.assertEqual(t2.merged_into, t1.task_id)

    def test_dedup_key(self):
        k1 = compute_dedup_key("scope", {"a": 1, "b": 2})
        k2 = compute_dedup_key("scope", {"b": 2, "a": 1})
        self.assertEqual(k1, k2)
        self.assertEqual(len(k1), 32)

    def test_lifecycle(self):
        d = TaskDeduper()
        t = d.submit("scope", "fp1", payload={})
        self.assertTrue(d.start(t.task_id))
        self.assertEqual(d.get_by_id(t.task_id).state, DedupTaskState.RUNNING)
        self.assertTrue(d.complete(t.task_id, result="ok"))
        self.assertEqual(d.get_by_id(t.task_id).result, "ok")
        self.assertFalse(d.start(t.task_id))

    def test_fail(self):
        d = TaskDeduper()
        t = d.submit("s", "k", payload={})
        d.start(t.task_id)
        self.assertTrue(d.fail(t.task_id, error="boom"))
        self.assertEqual(d.get_by_id(t.task_id).state, DedupTaskState.FAILED)
        self.assertEqual(d.get_by_id(t.task_id).error, "boom")

    def test_wait_for_result(self):
        d = TaskDeduper()
        t = d.submit("s", "k", payload={})
        d.start(t.task_id)
        time.sleep(0.05)
        d.complete(t.task_id, result={"v": 1})
        r = d.wait_for_result(t.task_id, timeout=1.0)
        self.assertEqual(r.state, DedupTaskState.SUCCESS)

    def test_callback(self):
        d = TaskDeduper()
        events = []
        d.add_callback(lambda t: events.append(t.state))
        t = d.submit("s", "k", payload={})
        d.start(t.task_id)
        d.complete(t.task_id, result=42)
        self.assertIn(DedupTaskState.RUNNING, events)
        self.assertIn(DedupTaskState.SUCCESS, events)

    def test_terminal_after_completion(self):
        d = TaskDeduper()
        t = d.submit("s", "k", payload={})
        d.start(t.task_id)
        d.complete(t.task_id)
        t2 = d.submit("s", "k", payload={})
        self.assertEqual(t2.state, DedupTaskState.SUCCESS)

    def test_stats(self):
        d = TaskDeduper()
        d.submit("s", "k1", payload={})
        d.submit("s", "k2", payload={})
        s = d.stats()
        self.assertGreaterEqual(s["total"], 2)

    def test_cancel(self):
        d = TaskDeduper()
        t = d.submit("s", "k", payload={})
        self.assertTrue(d.cancel(t.task_id))
        self.assertEqual(d.get_by_id(t.task_id).state, DedupTaskState.CANCELLED)

    def test_list_merged(self):
        d = TaskDeduper()
        t = d.submit("s", "k1", payload={})
        d.submit("s", "k1", payload={})  # merged
        merged = d.list_merged()
        self.assertGreaterEqual(len(merged), 1)
        self.assertEqual(merged[0].merged_into, t.task_id)


# =====================================================================
# Bug-130 数据质量监控
# =====================================================================
class TestDataQualityMonitor(unittest.TestCase):

    def test_completeness(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="c1",
                name="name必填",
                dimension=DQDimension.COMPLETENESS,
                dataset="users",
                target_field="name",
                threshold=0.99,
            )
        )
        m.feed("users", {"name": "Alice"})
        m.feed("users", {"name": ""})
        m.feed("users", {"name": None})
        v = m.get_violations(dataset="users")
        self.assertEqual(len(v), 2)
        metrics = m.get_metrics(dataset="users")
        self.assertEqual(metrics[0].failed, 2)

    def test_accuracy(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="a1",
                name="status准确",
                dimension=DQDimension.ACCURACY,
                dataset="orders",
                target_field="status",
                threshold=1.0,
                params={"allowed_values": ["PAID", "PENDING"]},
            )
        )
        m.feed("orders", {"status": "PAID"})
        m.feed("orders", {"status": "BAD"})
        v = m.get_violations(dataset="orders")
        self.assertEqual(len(v), 1)

    def test_consistency(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="k1",
                name="start==end",
                dimension=DQDimension.CONSISTENCY,
                dataset="log",
                threshold=1.0,
                params={"field_pairs": [{"a": "start", "b": "end"}]},
            )
        )
        m.feed("log", {"start": 1, "end": 1})
        m.feed("log", {"start": 1, "end": 2})
        v = m.get_violations(dataset="log")
        self.assertEqual(len(v), 1)

    def test_timeliness(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="t1",
                name="及时性",
                dimension=DQDimension.TIMELINESS,
                dataset="iot",
                target_field="ts",
                threshold=60.0,
                params={"max_delay_sec": 60.0},
            )
        )
        m.feed("iot", {"ts": time.time() - 3600})
        v = m.get_violations(dataset="iot")
        self.assertEqual(len(v), 1)

    def test_uniqueness(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="u1",
                name="id唯一",
                dimension=DQDimension.UNIQUENESS,
                dataset="users",
                target_field="id",
                threshold=1.0,
            )
        )
        m.feed("users", {"id": "u1"})
        m.feed("users", {"id": "u1"})
        v = m.get_violations(dataset="users")
        self.assertEqual(len(v), 1)

    def test_validity(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="v1",
                name="email",
                dimension=DQDimension.VALIDITY,
                dataset="users",
                target_field="email",
                threshold=1.0,
                params={"validator": "email"},
            )
        )
        m.feed("users", {"email": "bad"})
        m.feed("users", {"email": "ok@x.com"})
        v = m.get_violations(dataset="users")
        self.assertEqual(len(v), 1)

    def test_stats(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="c1", name="c", dimension=DQDimension.COMPLETENESS, dataset="d", target_field="x", threshold=1.0
            )
        )
        m.feed("d", {"x": "v"})
        s = m.stats()
        self.assertGreaterEqual(s["rules_total"], 1)
        self.assertGreaterEqual(s["samples_total"], 1)

    def test_clear(self):
        m = DataQualityMonitor()
        m.add_rule(
            DQRule(
                rule_id="c1", name="c", dimension=DQDimension.COMPLETENESS, dataset="d", target_field="x", threshold=1.0
            )
        )
        m.feed("d", {"x": "v"})
        m.clear()
        s = m.stats()
        self.assertEqual(s["samples_total"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
