#!/usr/bin/env python3
"""P0-43 全栈 APM 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fullstack_apm as apm


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_span_kinds(self):
        for k in ["server", "client", "producer", "consumer", "internal"]:
            self.assertIn(k, apm.SPAN_KINDS)

    def test_statuses(self):
        for s in ["ok", "error", "unset"]:
            self.assertIn(s, apm.TRACE_STATUSES)

    def test_backends(self):
        for b in ["jaeger", "tempo", "otlp", "zipkin"]:
            self.assertIn(b, apm.BACKEND_TYPES)

    def test_sampling(self):
        for s in ["always_on", "always_off", "probabilistic", "rate_limiting", "parent_based"]:
            self.assertIn(s, apm.SAMPLING_STRATEGIES)


class TestBackend(unittest.TestCase):
    def test_register_jaeger(self):
        bid = apm.register_backend("jaeger-" + _u(), "jaeger", "http://jaeger:14268")
        self.assertIsInstance(bid, str)

    def test_register_tempo(self):
        bid = apm.register_backend("tempo-" + _u(), "tempo", "http://tempo:3100")
        self.assertIsInstance(bid, str)

    def test_register_otlp(self):
        bid = apm.register_backend("otlp-" + _u(), "otlp", "http://otel:4317")
        self.assertIsInstance(bid, str)

    def test_register_invalid_backend(self):
        bid = apm.register_backend("x-" + _u(), "invalid", "")
        self.assertIsInstance(bid, str)


class TestTrace(unittest.TestCase):
    def test_create_trace(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        self.assertIsInstance(tid, str)
        self.assertEqual(len(tid), 32)

    def test_create_with_id(self):
        custom = "abcd" * 8
        tid = apm.create_trace("svc-" + _u(), "op", trace_id=custom)
        self.assertEqual(tid, custom)


class TestSpan(unittest.TestCase):
    def test_record_basic(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "span1", "svc-a", "GET /api")
        self.assertIsInstance(sid, str)

    def test_record_with_duration(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "span1", "svc-a", "GET /api", duration_us=1500)
        self.assertIsInstance(sid, str)

    def test_record_error(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "span1", "svc-a", "GET /api", status="error")
        self.assertIsInstance(sid, str)

    def test_record_with_parent(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "child", "svc-b", "op", parent_span_id="parent123")
        self.assertIsInstance(sid, str)

    def test_record_with_attributes(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "span1", "svc-a", "op", attributes={"http.status": 200})
        self.assertIsInstance(sid, str)

    def test_record_with_events(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "span1", "svc-a", "op", events=[{"name": "exception"}])
        self.assertIsInstance(sid, str)

    def test_record_all_kinds(self):
        for kind in ["server", "client", "producer", "consumer", "internal"]:
            tid = apm.create_trace("svc-" + _u(), "op")
            sid = apm.record_span(tid, "s", "svc-a", "op", span_kind=kind)
            self.assertIsInstance(sid, str)

    def test_record_invalid_kind(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        sid = apm.record_span(tid, "s", "svc-a", "op", span_kind="invalid")
        self.assertIsInstance(sid, str)


class TestGetTrace(unittest.TestCase):
    def test_get_existing(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        apm.record_span(tid, "s1", "svc-a", "op1")
        apm.record_span(tid, "s2", "svc-b", "op2")
        spans = apm.get_trace(tid)
        self.assertGreaterEqual(len(spans), 2)

    def test_get_nonexistent(self):
        spans = apm.get_trace("nonexistent-" + _u())
        self.assertEqual(len(spans), 0)


class TestSampling(unittest.TestCase):
    def test_add_rule_always_on(self):
        rid = apm.add_sampling_rule("svc-" + _u(), "always_on")
        self.assertIsInstance(rid, str)

    def test_add_rule_always_off(self):
        rid = apm.add_sampling_rule("svc-" + _u(), "always_off")
        self.assertIsInstance(rid, str)

    def test_should_sample_default(self):
        result = apm.should_sample("nonexistent-" + _u())
        self.assertTrue(result)

    def test_should_sample_always_off(self):
        svc = "svc-" + _u()
        apm.add_sampling_rule(svc, "always_off")
        self.assertFalse(apm.should_sample(svc))

    def test_should_sample_always_on(self):
        svc = "svc-" + _u()
        apm.add_sampling_rule(svc, "always_on")
        self.assertTrue(apm.should_sample(svc))

    def test_should_sample_probabilistic(self):
        svc = "svc-" + _u()
        apm.add_sampling_rule(svc, "probabilistic", rate=0.0)
        self.assertFalse(apm.should_sample(svc))


class TestDependency(unittest.TestCase):
    def test_record_new(self):
        did = apm.record_dependency("svc-a-" + _u(), "svc-b-" + _u(), 10.5)
        self.assertIsInstance(did, str)

    def test_record_existing(self):
        src = "svc-a-" + _u()
        tgt = "svc-b-" + _u()
        apm.record_dependency(src, tgt, 10.0)
        did = apm.record_dependency(src, tgt, 20.0)
        self.assertIsInstance(did, str)

    def test_record_error(self):
        did = apm.record_dependency("svc-a-" + _u(), "svc-b-" + _u(), 0, True)
        self.assertIsInstance(did, str)


class TestTopology(unittest.TestCase):
    def test_topology(self):
        topo = apm.get_service_topology()
        self.assertIn("nodes", topo)
        self.assertIn("edges", topo)


class TestStats(unittest.TestCase):
    def test_stats(self):
        stats = apm.get_apm_stats()
        self.assertIn("total_spans", stats)
        self.assertIn("error_rate", stats)
        self.assertIn("avg_duration_us", stats)
        self.assertIn("unique_services", stats)


class TestSpanEvent(unittest.TestCase):
    def test_record_event(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        eid = apm.record_span_event(tid, "span1", "exception")
        self.assertIsInstance(eid, str)

    def test_record_event_with_attrs(self):
        tid = apm.create_trace("svc-" + _u(), "op")
        eid = apm.record_span_event(tid, "span1", "log", {"msg": "test"})
        self.assertIsInstance(eid, str)


if __name__ == "__main__":
    unittest.main()
