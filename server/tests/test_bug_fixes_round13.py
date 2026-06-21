"""第十三轮回归测试 - Bug-115~Bug-122 共 8 个修复."""

import os
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import pytest

# ===================== Bug-115 LogRedactor =====================


class TestBug115LogRedactor:
    def test_redact_mobile(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        res = r.redact({"text": "Call 13800138000 now"})
        assert "13800138000" not in res.data["text"]
        assert "[PHONE]" in res.data["text"]

    def test_redact_id_card(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        text = "11010119900101123X 有效"
        res = r.redact({"text": text})
        assert "11010119900101123X" not in res.data["text"]

    def test_redact_bank_card(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        res = r.redact({"text": "card 6222021234567890"})
        assert "[BANK_CARD]" in res.data["text"]

    def test_redact_email(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        res = r.redact({"text": "contact alice@example.com"})
        assert "[EMAIL]" in res.data["text"]

    def test_redact_jwt(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_here_123"
        res = r.redact({"text": f"bearer={jwt}"})
        assert jwt not in res.data["text"]

    def test_redact_sensitive_key(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        res = r.redact({"password": "supersecret", "name": "alice"})
        assert res.data["password"] == "[REDACTED]"
        assert res.data["name"] == "alice"

    def test_whitelist_key(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        r.add_whitelist_key("safe_field")
        res = r.redact({"safe_field": "13800138000"})
        assert res.data["safe_field"] == "13800138000"

    def test_whitelist_value(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        r.add_whitelist_value("public_token")
        res = r.redact({"text": "public_token"})
        assert res.data["text"] == "public_token"

    def test_blacklist_key(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        r.add_blacklist_key(r"^ssn$")
        res = r.redact({"ssn": "123-45-6789"})
        assert res.data["ssn"] == "[REDACTED]"

    def test_nested_dict(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        res = r.redact({"user": {"profile": {"phone": "13800138000"}}})
        assert res.data["user"]["profile"]["phone"] != "13800138000"

    def test_list_recursive(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        res = r.redact({"items": ["a", "13800138000", {"phone": "13900139000"}]})
        assert "13800138000" not in str(res.data)

    def test_custom_func(self):
        import re

        from app.utils.log_redactor import LogRedactor, RedactRule

        r = LogRedactor()
        r.add_rule(RedactRule("user_id", re.compile(r"user_\d+"), "USER"))
        res = r.redact({"text": "user_42 ok"})
        assert "USER" in res.data["text"]

    def test_stats(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        r.redact({"text": "13800138000", "phone": "13900139000"})
        s = r.stats()
        assert s["total_hits"] >= 1
        assert s["rule_count"] >= 5

    def test_clear_stats(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        r.redact({"phone": "13800138000"})
        r.clear_stats()
        s = r.stats()
        assert s["total_hits"] == 0

    def test_remove_rule(self):
        from app.utils.log_redactor import LogRedactor

        r = LogRedactor()
        ok = r.remove_rule("mobile")
        assert ok is True
        res = r.redact({"text": "13800138000"})
        # 规则删除后, 应不再脱敏
        assert "13800138000" in res.data["text"]


# ===================== Bug-116 TraceSampler =====================


class TestBug116TraceSampler:
    def test_head_mode_sample(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "sample"

    def test_head_mode_zero_rate(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.HEAD.value)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "drop"

    def test_head_mode_tenant_quota(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        ts.set_tenant_quota("tnt1", per_sec=2, per_min=10)
        ts.start("a", "tnt1")
        ts.start("b", "tnt1")
        rec3 = ts.start("c", "tnt1")
        assert rec3.decision == "drop"

    def test_tenant_rate(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.HEAD.value)
        ts.set_tenant_quota("tnt1", rate=1.0)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "sample"

    def test_path_override(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.HEAD.value)
        ts.set_path_rate("/api/slow", 1.0)
        rec = ts.start("t1", "tnt1", path="/api/slow")
        assert rec.decision == "sample"

    def test_tail_mode_defer(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=1.0, mode=SampleMode.TAIL.value)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "defer"
        out = ts.finish("t1", duration_sec=0.5)
        assert out is not None
        assert out.decision in ("sample", "drop")

    def test_tail_error_first(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.ERROR_FIRST.value)
        ts.start("t1", "tnt1")
        out = ts.finish("t1", duration_sec=0.5, has_error=True)
        assert out.decision == "sample"

    def test_tail_slow_path(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.TAIL.value)
        ts.start("t1", "tnt1")
        out = ts.finish("t1", duration_sec=10.0)
        assert out.decision == "sample"

    def test_always_mode(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(mode=SampleMode.ALWAYS.value)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "sample"

    def test_never_mode(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(mode=SampleMode.NEVER.value)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "drop"

    def test_list_sampled(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        for i in range(5):
            ts.start(f"t{i}", "tnt1")
        sampled = ts.list_sampled(tenant="tnt1")
        assert len(sampled) == 5

    def test_clear_pending(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.TAIL.value)
        ts.start("t1", "tnt1")
        ts.start("t2", "tnt1")
        n = ts.clear_pending()
        assert n == 2

    def test_stats(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=1.0, mode=SampleMode.HEAD.value)
        ts.start("t1", "tnt1")
        s = ts.stats()
        assert s["total_received"] == 1
        assert s["sampled"] == 1

    def test_dynamic_rate(self):
        from app.utils.trace_sampler import SampleMode, TraceSampler

        ts = TraceSampler(default_rate=0.0, mode=SampleMode.HEAD.value)
        ts.set_default_rate(1.0)
        rec = ts.start("t1", "tnt1")
        assert rec.decision == "sample"


# ===================== Bug-117 MetricCardinality =====================


class TestBug117MetricCardinality:
    def test_observe_basic(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        ev = m.observe("requests_total", {"path": "/a", "method": "GET"})
        assert ev.dropped is False
        assert ev.action == "allow"

    def test_cardinality_tracking(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        for i in range(20):
            m.observe("req", {"path": f"/p/{i}"})
        c = m.cardinality("req")
        assert c["path"] == 20

    def test_topn_action(self):
        from app.utils.metric_label_cardinality import CardinalityAction, MetricCardinalityController

        m = MetricCardinalityController(default_max=5, default_topn=3)
        m.configure("req", max_cardinality=5, topn=3, action=CardinalityAction.TOPN.value)
        for i in range(10):
            m.observe("req", {"path": f"/p/{i}"}, value=float(i + 1))
        c = m.cardinality("req")
        # Top3 留下, 其它被归为 __other__, 所以 distinct 应该 <= 4
        assert c["path"] <= 4

    def test_drop_action(self):
        from app.utils.metric_label_cardinality import CardinalityAction, MetricCardinalityController

        m = MetricCardinalityController(default_max=3)
        m.configure("req", max_cardinality=3, action=CardinalityAction.DROP.value)
        for i in range(5):
            ev = m.observe("req", {"path": f"/p/{i}"})
        c = m.cardinality("req")
        # drop action: 整体不记录
        assert c["path"] <= 3

    def test_invalid_label_name(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        ev = m.observe("req", {"0bad_label": "x"})
        assert ev.dropped is True

    def test_validate_metric_name(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        assert m.validate_metric_name("requests_total") is True
        assert m.validate_metric_name("0bad") is False
        assert m.validate_metric_name("a.b") is False

    def test_list_overlimit(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        for i in range(100):
            m.observe("hot", {"k": f"v{i}"})
        over = m.list_overlimit(max_card=50)
        assert len(over) >= 1

    def test_list_metrics(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        m.observe("a", {"x": "1"})
        m.observe("b", {"x": "1"})
        assert set(m.list_metrics()) == {"a", "b"}

    def test_reset_metric(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        m.observe("a", {"x": "1"})
        m.observe("a", {"x": "2"})
        n = m.reset_metric("a")
        assert n == 1
        assert m.cardinality("a") == {}

    def test_stats(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        m.observe("a", {"x": "1"})
        s = m.stats()
        assert s["total_samples"] == 1
        assert s["metric_count"] == 1

    def test_get_stat(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        m.observe("a", {"x": "1"})
        st = m.stat("a", "x")
        assert st is not None
        assert st.samples == 1

    def test_top_values(self):
        from app.utils.metric_label_cardinality import MetricCardinalityController

        m = MetricCardinalityController()
        for v in ["a", "a", "a", "b", "b", "c"]:
            m.observe("m", {"k": v})
        st = m.stat("m", "k")
        assert st.top_values[0] == ("a", 3)


# ===================== Bug-118 AlertDedupAggregator =====================


class TestBug118AlertDedup:
    def test_basic_ingest(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        ev = a.ingest("fp1", "warning", "title", "msg")
        assert ev.fingerprint == "fp1"
        assert ev.notified is True

    def test_dedup_within_window(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator(default_window_sec=60.0)
        a.ingest("fp1", "warning", "t", "m1")
        ev = a.ingest("fp1", "warning", "t", "m2")
        assert ev.count_in_window == 2
        assert ev.notified is True

    def test_silence(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.silence("fp1", time.time() + 100)
        ev = a.ingest("fp1", "warning", "t", "m")
        # 静默期间 not notified
        assert ev.notified is False

    def test_escalate(self):
        from app.utils.alert_dedup_aggregator import AggregationStrategy, AlertDedupAggregator

        a = AlertDedupAggregator()
        a.add_rule(
            __import__("app.utils.alert_dedup_aggregator", fromlist=["AggregationRule"]).AggregationRule(
                fingerprint_pattern="fp1", strategy=AggregationStrategy.ESCALATE.value
            )
        )
        a.ingest("fp1", "warning", "t", "m1")
        ev = a.ingest("fp1", "critical", "t", "m2")
        assert ev.severity == "critical"

    def test_first_last_strategy(self):
        from app.utils.alert_dedup_aggregator import AggregationRule, AggregationStrategy, AlertDedupAggregator

        a = AlertDedupAggregator()
        a.add_rule(AggregationRule(fingerprint_pattern="fp1", strategy=AggregationStrategy.FIRST_LAST.value))
        a.ingest("fp1", "warning", "t", "m1")
        ev = a.ingest("fp1", "warning", "t", "m2")
        assert "first=" in ev.message and "last=" in ev.message

    def test_add_remove_rule(self):
        from app.utils.alert_dedup_aggregator import AggregationRule, AlertDedupAggregator

        a = AlertDedupAggregator()
        a.add_rule(AggregationRule(fingerprint_pattern="*"))
        assert a.remove_rule("*") is True
        assert a.remove_rule("nope") is False

    def test_list_active(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.ingest("fp1", "warning", "t", "m")
        a.ingest("fp2", "error", "t", "m")
        assert len(a.list_active()) == 2

    def test_list_deduped(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.ingest("fp1", "warning", "t", "m")
        a.ingest("fp1", "warning", "t", "m")
        a.ingest("fp2", "warning", "t", "m")
        deduped = a.list_deduped()
        assert len(deduped) == 1

    def test_get(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.ingest("fp1", "warning", "t", "m")
        assert a.get("fp1") is not None
        assert a.get("nope") is None

    def test_expire_window(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.ingest("fp1", "warning", "t", "m")
        assert a.expire_window("fp1") is True
        assert a.get("fp1") is None

    def test_add_route_and_set_notifier(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.add_route("ops", "ops@company.com")
        received = []
        a.set_notifier(lambda ev, routes: received.append((ev.id, routes)))
        a.ingest("fp1", "warning", "t", "m")
        assert len(received) == 1

    def test_stats(self):
        from app.utils.alert_dedup_aggregator import AlertDedupAggregator

        a = AlertDedupAggregator()
        a.ingest("fp1", "warning", "t", "m")
        s = a.stats()
        assert s["total_received"] == 1
        assert s["total_notified"] == 1


# ===================== Bug-119 SecretRotation =====================


class TestBug119SecretRotation:
    def test_register(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        spec = c.register("api_key1", "api_key", lambda v: f"value-{v}", ttl_sec=3600)
        assert spec.current_version == 1
        assert spec.phase == "stable"

    def test_rotate(self):
        from app.utils.secret_rotation import RotationPhase, SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        new_v = c.rotate("k1", new_loader=lambda v: f"new-{v}")
        assert new_v.version == 2
        spec = c.get_spec("k1")
        assert spec.phase == RotationPhase.CANARY.value
        assert spec.previous_version == 1

    def test_advance_rollout(self):
        from app.utils.secret_rotation import RotationPhase, SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        r = c.advance_rollout("k1", ratio=0.5)
        assert r == 0.5
        c.advance_rollout("k1", ratio=1.0)
        spec = c.get_spec("k1")
        assert spec.phase == RotationPhase.STABLE.value

    def test_complete(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        c.advance_rollout("k1", ratio=1.0)
        ok = c.complete("k1")
        assert ok is True
        spec = c.get_spec("k1")
        assert spec.phase == "stable"
        assert spec.previous_version == 0

    def test_rollback(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        prev = c.rollback("k1")
        assert prev is not None
        assert prev.version == 1
        spec = c.get_spec("k1")
        assert spec.phase == "rolled_back"
        assert spec.current_version == 1

    def test_pick_version_canary(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        # canary 阶段: 概率 0.1
        new_count = 0
        for i in range(200):
            v = c.pick_version("k1", tenant=f"t{i}")
            if v.version == 2:
                new_count += 1
        # 期望约 20 个 (0.1)
        assert 0 <= new_count <= 60

    def test_pick_version_full_rollout(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        c.advance_rollout("k1", ratio=1.0)
        v = c.pick_version("k1", tenant="t1")
        assert v.version == 2

    def test_check_expiring(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}", ttl_sec=1.0, warning_before_sec=10.0)
        s = c.check_expiring("k1")
        assert s["needs_rotation"] is True

    def test_list_expiring(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        arr = c.list_expiring()
        assert len(arr) == 1

    def test_list_audits(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        a = c.list_audits("k1")
        assert len(a) >= 2

    def test_get_current(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        cur = c.get_current("k1")
        assert cur is not None
        assert cur.version == 1

    def test_get_version(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.rotate("k1")
        v1 = c.get_version("k1", 1)
        v2 = c.get_version("k1", 2)
        assert v1 is not None
        assert v2 is not None

    def test_stats(self):
        from app.utils.secret_rotation import SecretRotationCoordinator

        c = SecretRotationCoordinator()
        c.register("k1", "api_key", lambda v: f"v-{v}")
        c.register("k2", "db_password", lambda v: f"d-{v}")
        s = c.stats()
        assert s["secret_count"] == 2
        assert s["version_count"] == 2


# ===================== Bug-120 SlowQueryKillSwitch =====================


class TestBug120SlowQueryKill:
    def test_basic_execute(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        r = k.execute("q1", "select 1", lambda: "ok")
        assert r["ok"] is True
        assert r["value"] == "ok"

    def test_whitelist(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_whitelist("q_wl")
        r = k.execute("q_wl", "select 1", lambda: "always")
        assert r["value"] == "always"

    def test_add_remove_rule(self):
        from app.utils.slow_query_kill_switch import KillAction, SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_rule("q1", max_duration_sec=0.001, action=KillAction.KILL.value)
        r = k.execute("q1", "select", lambda: time.sleep(0.01))
        assert r["action"] == "kill"
        k.remove_rule("q1")
        r2 = k.execute("q1", "select", lambda: "ok")
        assert r2["ok"] is True

    def test_throttle(self):
        from app.utils.slow_query_kill_switch import KillAction, SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_rule("q1", action=KillAction.THROTTLE.value)
        r = k.execute("q1", "select", lambda: "ok")
        assert r["action"] == "throttle"

    def test_degrade(self):
        from app.utils.slow_query_kill_switch import KillAction, SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_rule("q1", action=KillAction.DEGRADE.value)
        r = k.execute("q1", "select", lambda: "degraded")
        assert r["value"] == "degraded"
        assert r["action"] == "degrade"

    def test_execute_error(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        r = k.execute("q1", "select bad", lambda: 1 / 0)
        assert r["ok"] is False
        assert r["action"] == "error"

    def test_auto_throttle(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch(default_max_duration=0.001)
        k.execute("q1", "slow", lambda: time.sleep(0.02))
        stats = k.get_stats("q1")
        assert stats is not None
        assert stats.max_duration_sec > 0.001

    def test_expire_rules(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_rule("q1", ttl_sec=0.001)
        time.sleep(0.01)
        n = k.expire_rules()
        assert n == 1

    def test_list_slow(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.execute("q1", "select slow", lambda: time.sleep(0.05) or "ok")
        k.execute("q2", "select fast", lambda: "ok")
        slow = k.list_slow(threshold=0.01)
        assert len(slow) >= 1

    def test_list_audits(self):
        from app.utils.slow_query_kill_switch import KillAction, SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_rule("q1", action=KillAction.KILL.value)
        k.execute("q1", "select", lambda: "x")
        a = k.list_audits("q1")
        assert len(a) >= 1

    def test_impact(self):
        from app.utils.slow_query_kill_switch import KillAction, SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.add_rule("q1", action=KillAction.KILL.value)
        k.execute("q1", "select", lambda: "x")
        k.execute("q2", "select", lambda: "y")
        s = k.impact()
        assert s["killed"] >= 1
        assert s["total_queries"] == 2

    def test_stats(self):
        from app.utils.slow_query_kill_switch import SlowQueryKillSwitch

        k = SlowQueryKillSwitch()
        k.execute("q1", "select", lambda: "ok")
        s = k.stats()
        assert s["total_queries"] == 1


# ===================== Bug-121 CacheBreakdownGuard =====================


class TestBug121CacheGuard:
    def test_basic_get_set(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard(default_ttl_sec=10.0)
        g.set("k1", "v1")
        assert g.get("k1", lambda: "fallback") == "v1"

    def test_miss_calls_loader(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        v = g.get("k1", lambda: "loaded")
        assert v == "loaded"

    def test_invalidate(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        g.set("k1", "v1")
        assert g.invalidate("k1") is True
        v = g.get("k1", lambda: "new")
        assert v == "new"

    def test_singleflight(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        call_count = []

        def loader():
            time.sleep(0.1)
            call_count.append(1)
            return "x"

        results = []

        def runner():
            r = g.get("k1", loader)
            results.append(r)

        threads = [threading.Thread(target=runner) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(results) == 5
        # 至少合并了 4 个 (5 个并发只 loader 一次)
        assert len(call_count) <= 2

    def test_hot_key_promotion(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard(default_ttl_sec=10.0, hot_threshold=3, hot_ttl_multiplier=5.0)
        # 多次访问同一 key 触发 hot 提升 (>= 3 次访问)
        for _ in range(10):
            g.get("hot", lambda: "v")
        entry = g.get_entry("hot")
        assert entry is not None
        # 热点 TTL 应该延长: 创建到过期时长
        span = entry.expires_at - entry.created_at
        # 基础 10s, 热点 10 * 5 = 50s
        assert span > 10.0

    def test_stale_serve(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard(default_ttl_sec=0.05, stale_grace_sec=1.0)
        g.set("k1", "v1")
        time.sleep(0.1)
        # 已过期, 但 stale grace 内, 返回 stale
        v = g.get("k1", lambda: "new")
        # 第一次返回 stale
        assert v == "v1"
        # 至少有一次 stale serve
        s = g.stats()
        assert s["stale_served"] >= 1

    def test_loader_error(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        # 没有 set, loader 抛错应该直接 raise
        with pytest.raises(Exception):
            g.get("k1", lambda: 1 / 0)

    def test_hot_keys(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        for _ in range(5):
            g.get("k1", lambda: "v1")
        for _ in range(2):
            g.get("k2", lambda: "v2")
        hot = g.hot_keys()
        assert hot[0][0] == "k1"

    def test_get_entry(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        g.set("k1", "v1")
        e = g.get_entry("k1")
        assert e is not None
        assert e.value == "v1"

    def test_list_entries(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        g.set("k1", "v1")
        g.set("k2", "v2")
        assert len(g.list_entries()) == 2

    def test_stats(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        g.set("k1", "v1")
        g.get("k1", lambda: "v1")
        s = g.stats()
        assert s["hit"] >= 1
        assert s["entries"] == 1

    def test_clear(self):
        from app.utils.cache_breakdown_guard import CacheBreakdownGuard

        g = CacheBreakdownGuard()
        g.set("k1", "v1")
        g.clear()
        assert len(g.list_entries()) == 0


# ===================== Bug-122 ConfigCanaryPush =====================


class TestBug122ConfigCanary:
    def test_publish(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        v = c.publish("ns1", {"key1": "v1"}, description="first")
        assert v.version == 1
        assert v.sha != ""

    def test_publish_multiple(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        v1 = c.publish("ns1", {"a": 1})
        v2 = c.publish("ns1", {"a": 2})
        assert v1.version == 1
        assert v2.version == 2

    def test_start_canary(self):
        from app.utils.config_canary_push import ConfigCanaryPush, PushPhase

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1"], canary_ratio=0.1)
        assert t.phase == PushPhase.CANARY.value

    def test_advance(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1"])
        c.advance(t.id, ratio=1.0)
        cur = c.get("ns1")
        assert cur is not None
        assert cur.version == 2

    def test_push_to_region(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        results = []
        c.register_push(lambda ns, v, r, content: results.append((ns, v, r)) or True)
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1"])
        ok = c.push_to_region(t.id, "r1")
        assert ok is True
        assert len(results) == 1

    def test_verify_region(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.register_verify(lambda ns, v, r: True)
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1"])
        ok = c.verify_region(t.id, "r1")
        assert ok is True

    def test_push_all(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.register_push(lambda ns, v, r, content: True)
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1", "r2", "r3"])
        r = c.push_all(t.id)
        assert r["ok"] == 3
        assert r["fail"] == 0

    def test_rollback(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1"])
        c.advance(t.id, ratio=1.0)
        prev = c.rollback("ns1")
        assert prev is not None
        assert prev.version == 1
        cur = c.get("ns1")
        assert cur.version == 1

    def test_should_apply(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        assert c.should_apply("ns1", tenant="t1", client_version="1.0.0") is True

    def test_should_apply_min_version(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1}, min_client_version="2.0.0")
        assert c.should_apply("ns1", client_version="1.0.0") is False
        assert c.should_apply("ns1", client_version="2.0.0") is True

    def test_get_version(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        v2 = c.get_version("ns1", 2)
        assert v2 is not None
        assert v2.content["a"] == 2

    def test_list_versions(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        v = c.list_versions("ns1")
        assert len(v) == 2

    def test_list_pushes(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        c.start_canary("ns1", version=2, regions=["r1"])
        pushes = c.list_pushes()
        assert len(pushes) >= 1

    def test_get_push(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        c.publish("ns1", {"a": 2})
        t = c.start_canary("ns1", version=2, regions=["r1"])
        assert c.get_push(t.id) is not None
        assert c.get_push("nope") is None

    def test_stats(self):
        from app.utils.config_canary_push import ConfigCanaryPush

        c = ConfigCanaryPush()
        c.publish("ns1", {"a": 1})
        s = c.stats()
        assert s["namespace_count"] == 1
        assert s["version_count"] == 1
