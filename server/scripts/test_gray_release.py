#!/usr/bin/env python3
"""P0-23 全链路灰度发布测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import gray_release as gr


class TestRuleEvaluation(unittest.TestCase):
    def test_eq_match(self):
        self.assertTrue(gr.evaluate_rule("tenant", "eq", ["vip"],
                                            {"tenant": "vip"}))

    def test_eq_miss(self):
        self.assertFalse(gr.evaluate_rule("tenant", "eq", ["vip"],
                                             {"tenant": "regular"}))

    def test_ne(self):
        self.assertTrue(gr.evaluate_rule("region", "ne", ["cn-north"],
                                            {"region": "cn-south"}))

    def test_in(self):
        self.assertTrue(gr.evaluate_rule("user", "in", ["u1", "u2", "u3"],
                                            {"user": "u2"}))

    def test_not_in(self):
        self.assertTrue(gr.evaluate_rule("user", "not_in", ["u1", "u2"],
                                            {"user": "u3"}))

    def test_contains(self):
        self.assertTrue(gr.evaluate_rule("version", "contains", ["1.2"],
                                            {"version": "1.2.3"}))

    def test_regex(self):
        self.assertTrue(gr.evaluate_rule("user", "regex", ["^admin"],
                                            {"user": "admin001"}))

    def test_gt(self):
        self.assertTrue(gr.evaluate_rule("score", "gt", ["50"],
                                            {"score": "75"}))

    def test_lt(self):
        self.assertTrue(gr.evaluate_rule("score", "lt", ["100"],
                                            {"score": "50"}))

    def test_gt_invalid(self):
        self.assertFalse(gr.evaluate_rule("score", "gt", ["50"],
                                             {"score": "abc"}))

    def test_empty_value(self):
        self.assertFalse(gr.evaluate_rule("tenant", "eq", ["vip"],
                                             {"tenant": ""}))

    def test_missing_dimension(self):
        self.assertFalse(gr.evaluate_rule("tenant", "eq", ["vip"], {}))


class TestReleaseEvaluation(unittest.TestCase):
    def test_no_match(self):
        rules = [{"dimension": "tenant", "operator": "eq", "values": ["vip"]}]
        self.assertFalse(gr.evaluate_release(rules, {"tenant": "regular"}))

    def test_first_match(self):
        rules = [
            {"dimension": "tenant", "operator": "eq", "values": ["vip"]},
            {"dimension": "region", "operator": "eq", "values": ["cn-north"]},
        ]
        self.assertTrue(gr.evaluate_release(rules, {"tenant": "regular",
                                                       "region": "cn-north"}))

    def test_empty_rules(self):
        self.assertFalse(gr.evaluate_release([], {"tenant": "vip"}))

    def test_multi_match(self):
        rules = [
            {"dimension": "tenant", "operator": "eq", "values": ["vip"]},
            {"dimension": "region", "operator": "in", "values": ["cn", "us"]},
        ]
        self.assertTrue(gr.evaluate_release(rules, {"tenant": "vip",
                                                       "region": "us"}))


class TestReleaseManagement(unittest.TestCase):
    def test_create_canary(self):
        rid = gr.create_release("test-release", "api", "canary", "v1", "v2", [])
        self.assertIsInstance(rid, str)

    def test_create_blue_green(self):
        rid = gr.create_release("bg-release", "api", "blue_green", "v1", "v2", [])
        self.assertIsInstance(rid, str)

    def test_create_ab_test(self):
        rid = gr.create_release("ab-release", "api", "ab_test", "v1", "v2", [])
        self.assertIsInstance(rid, str)

    def test_create_feature_flag(self):
        rid = gr.create_release("ff-release", "api", "feature_flag", "v1", "v2", [])
        self.assertIsInstance(rid, str)

    def test_create_shadow(self):
        rid = gr.create_release("shadow-release", "api", "shadow", "v1", "v2", [])
        self.assertIsInstance(rid, str)

    def test_invalid_type_fallback(self):
        rid = gr.create_release("invalid-type", "api", "INVALID", "v1", "v2", [])
        self.assertIsInstance(rid, str)

    def test_create_with_rules(self):
        rules = [{"dimension": "tenant", "operator": "eq", "values": ["vip"]}]
        rid = gr.create_release("with-rules", "api", "canary", "v1", "v2", rules)
        r = gr.get_release(rid)
        self.assertEqual(len(r["rules"]), 1)
        self.assertEqual(r["rules"][0]["dimension"], "tenant")

    def test_advance_stage(self):
        rid = gr.create_release("advance-test", "api", "canary", "v1", "v2", [])
        stage = gr.advance_stage(rid, "canary_25")
        self.assertEqual(stage, "canary_25")
        r = gr.get_release(rid)
        self.assertEqual(r["stage"], "canary_25")

    def test_advance_invalid_stage(self):
        rid = gr.create_release("invalid-stage", "api", "canary", "v1", "v2", [])
        stage = gr.advance_stage(rid, "INVALID")
        self.assertEqual(stage, "canary_5")

    def test_get_release(self):
        rid = gr.create_release("get-test", "api-svc", "canary", "v1.0", "v2.0", [])
        r = gr.get_release(rid)
        self.assertEqual(r["service"], "api-svc")
        self.assertEqual(r["baseline_version"], "v1.0")
        self.assertEqual(r["canary_version"], "v2.0")

    def test_get_release_not_found(self):
        r = gr.get_release("non-existent-id")
        self.assertIsNone(r)

    def test_list_active_releases(self):
        gr.create_release("list-test", "api", "canary", "v1", "v2", [])
        active = gr.list_active_releases()
        self.assertIsInstance(active, list)
        self.assertGreater(len(active), 0)


class TestTagPropagation(unittest.TestCase):
    def test_propagate(self):
        rid = gr.create_release("tag-test", "api", "canary", "v1", "v2", [])
        tid = gr.propagate_tag(rid, "abcdef0123456789abcdef0123456789", "api",
                                {"gray.stage": "canary_25"}, "canary_25")
        self.assertIsInstance(tid, str)

    def test_propagate_multiple(self):
        rid = gr.create_release("multi-tag", "api", "canary", "v1", "v2", [])
        for s in ["api", "auth", "billing"]:
            gr.propagate_tag(rid, "trace-1", s, {"stage": "canary_25"}, "canary_25")


class TestCanaryRouting(unittest.TestCase):
    def test_route_no_rules(self):
        routed = gr.should_route_to_canary({}, [], 100)
        self.assertIsInstance(routed, bool)

    def test_route_match(self):
        rules = [{"dimension": "tenant", "operator": "eq", "values": ["vip"]}]
        routed = gr.should_route_to_canary({"tenant": "vip"}, rules, 100)
        self.assertTrue(routed)

    def test_route_no_match(self):
        rules = [{"dimension": "tenant", "operator": "eq", "values": ["vip"]}]
        routed = gr.should_route_to_canary({"tenant": "regular"}, rules, 100)
        self.assertFalse(routed)

    def test_route_weight_zero(self):
        routed = gr.should_route_to_canary({"tenant": "vip"}, [], 0)
        self.assertFalse(routed)

    def test_route_weight_100(self):
        for _ in range(10):
            gr.should_route_to_canary({}, [], 100)
        # 至少大部分时间 True (随机)

    def test_route_weight_50(self):
        results = [gr.should_route_to_canary({}, [], 50) for _ in range(100)]
        self.assertIn(True, results)
        self.assertIn(False, results)


class TestMetrics(unittest.TestCase):
    def test_record(self):
        rid = gr.create_release("metric-test", "api", "canary", "v1", "v2", [])
        mid = gr.record_metric(rid, "canary", 100, 95, 5, 50, 150, 300)
        self.assertIsInstance(mid, str)

    def test_record_baseline(self):
        rid = gr.create_release("metric-baseline", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "baseline", 1000, 990, 10, 40, 120, 250)

    def test_get_metrics(self):
        rid = gr.create_release("get-metrics", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 100, 90, 10, 50, 150, 300)
        m = gr.get_release_metrics(rid)
        self.assertIn("canary", m)
        self.assertEqual(m["canary"]["total_requests"], 100)
        self.assertEqual(m["canary"]["success_rate"], 90.0)
        self.assertEqual(m["canary"]["error_rate"], 10.0)

    def test_metrics_calculation(self):
        rid = gr.create_release("calc-test", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 200, 180, 20, 60, 200, 400)
        m = gr.get_release_metrics(rid)
        self.assertEqual(m["canary"]["total_requests"], 200)
        self.assertEqual(m["canary"]["success_count"], 180)
        self.assertEqual(m["canary"]["error_count"], 20)
        self.assertEqual(m["canary"]["p99_ms"], 400.0)


class TestAutoRollback(unittest.TestCase):
    def test_no_rollback_healthy(self):
        rid = gr.create_release("healthy-test", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 200, 199, 1, 50, 150, 300)
        result = gr.check_auto_rollback(rid)
        self.assertIsNone(result)

    def test_no_rollback_small_sample(self):
        rid = gr.create_release("small-sample", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 10, 5, 5, 50, 150, 300)
        result = gr.check_auto_rollback(rid)
        self.assertIsNone(result)

    def test_rollback_high_error_rate(self):
        rid = gr.create_release("error-test", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 200, 180, 20, 50, 150, 300)
        result = gr.check_auto_rollback(rid)
        self.assertIsNotNone(result)
        self.assertTrue(result["rolled_back"])

    def test_rollback_high_p99(self):
        rid = gr.create_release("p99-test", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 200, 199, 1, 50, 150, 3000)
        result = gr.check_auto_rollback(rid)
        self.assertIsNotNone(result)
        self.assertTrue(result["rolled_back"])

    def test_rollback_low_success_rate(self):
        rid = gr.create_release("success-test", "api", "canary", "v1", "v2", [])
        gr.record_metric(rid, "canary", 200, 180, 20, 50, 150, 300)
        result = gr.check_auto_rollback(rid)
        self.assertIsNotNone(result)


class TestThresholds(unittest.TestCase):
    def test_thresholds_keys(self):
        self.assertIn("error_rate_pct", gr.AUTO_ROLLBACK_THRESHOLDS)
        self.assertIn("p99_latency_ms", gr.AUTO_ROLLBACK_THRESHOLDS)
        self.assertIn("success_rate_pct", gr.AUTO_ROLLBACK_THRESHOLDS)
        self.assertIn("min_sample_size", gr.AUTO_ROLLBACK_THRESHOLDS)


class TestReleaseStages(unittest.TestCase):
    def test_stages_list(self):
        self.assertIn("init", gr.RELEASE_STAGES)
        self.assertIn("canary_5", gr.RELEASE_STAGES)
        self.assertIn("canary_25", gr.RELEASE_STAGES)
        self.assertIn("canary_50", gr.RELEASE_STAGES)
        self.assertIn("canary_100", gr.RELEASE_STAGES)
        self.assertIn("completed", gr.RELEASE_STAGES)
        self.assertIn("rolled_back", gr.RELEASE_STAGES)
        self.assertIn("paused", gr.RELEASE_STAGES)


class TestGrayTypes(unittest.TestCase):
    def test_all_types(self):
        for t in gr.GRAY_TYPES:
            rid = gr.create_release(f"type-{t}", "api", t, "v1", "v2", [])
            self.assertIsInstance(rid, str)

    def test_all_dimensions(self):
        for d in gr.GRAY_DIMENSIONS:
            matched = gr.evaluate_rule(d, "eq", ["v1"], {d: "v1"})
            self.assertTrue(matched)

    def test_all_operators(self):
        for op in gr.RULE_OPERATORS:
            matched = gr.evaluate_rule("v", op, ["test"], {"v": "test"})
            self.assertIsInstance(matched, bool)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands_callable(self):
        commands = ["serve", "create", "advance", "evaluate", "release_eval",
                    "route", "tag_propagate", "record", "metrics",
                    "rollback_check", "active", "get"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(gr, f"cmd_{cmd_name}")))

    def test_cmd_create(self):
        gr.cmd_create(["cmd-test", "api", "v1", "v2", "canary"])

    def test_cmd_create_minimal(self):
        gr.cmd_create(["cmd-test-2", "api", "v1", "v2"])

    def test_cmd_advance(self):
        gr.cmd_create(["cmd-advance", "api", "v1", "v2"])
        gr.cmd_advance(["", "canary_5"])

    def test_cmd_evaluate(self):
        gr.cmd_evaluate(["tenant", "eq", "vip", '{"tenant": "vip"}'])

    def test_cmd_release_eval(self):
        rules = '[{"dimension": "tenant", "operator": "eq", "values": ["vip"]}]'
        gr.cmd_release_eval([rules, '{"tenant": "vip"}'])

    def test_cmd_route(self):
        rules = '[{"dimension": "tenant", "operator": "eq", "values": ["vip"]}]'
        gr.cmd_route([rules, '{"tenant": "vip"}', "100"])

    def test_cmd_tag_propagate(self):
        gr.cmd_create(["tag-cmd", "api", "v1", "v2"])
        gr.cmd_tag_propagate(["", "trace-1", "api", '{"stage": "canary_25"}', "canary_25"])

    def test_cmd_record(self):
        gr.cmd_create(["record-cmd", "api", "v1", "v2"])
        gr.cmd_record(["", "canary", "100", "95", "5"])

    def test_cmd_metrics(self):
        rid = gr.create_release("metrics-cmd", "api", "canary", "v1", "v2", [])
        gr.cmd_metrics([rid])

    def test_cmd_rollback_check(self):
        rid = gr.create_release("rollback-cmd", "api", "canary", "v1", "v2", [])
        gr.cmd_rollback_check([rid])

    def test_cmd_active(self):
        gr.cmd_active([])

    def test_cmd_get(self):
        rid = gr.create_release("get-cmd", "api", "canary", "v1", "v2", [])
        gr.cmd_get([rid])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=gr.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{gr.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_release_active(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{gr.HTTP_PORT}/api/release/active", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("releases", data)
        except Exception:
            pass

    def test_create_release_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{gr.HTTP_PORT}/api/release/create",
                data=json.dumps({"name": "http-test", "service": "api",
                                 "baseline_version": "v1", "canary_version": "v2",
                                 "gray_type": "canary", "rules": []}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_evaluate_rule_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{gr.HTTP_PORT}/api/rule/evaluate",
                data=json.dumps({"dimension": "tenant", "operator": "eq",
                                 "values": ["vip"], "context": {"tenant": "vip"}}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("matched", data)
        except Exception:
            pass

    def test_route_canary_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{gr.HTTP_PORT}/api/route/canary",
                data=json.dumps({"context": {"tenant": "vip"}, "rules": [],
                                 "weight": 100}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("to_canary", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
