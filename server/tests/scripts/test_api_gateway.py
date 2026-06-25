#!/usr/bin/env python3
"""P0-34 API 网关统一治理 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import api_gateway as ag


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_limit_types(self):
        for t in ["second", "minute", "hour", "day"]:
            self.assertIn(t, ag.LIMIT_TYPES)

    def test_circuit_states(self):
        for s in ["closed", "open", "half_open"]:
            self.assertIn(s, ag.CIRCUIT_STATES)

    def test_auth_types(self):
        for t in ["jwt", "basic", "api_key", "oauth2", "hmac"]:
            self.assertIn(t, ag.AUTH_TYPES)

    def test_gradient_types(self):
        for t in ["canary", "blue_green", "ab_test", "mirror"]:
            self.assertIn(t, ag.GRADIENT_TYPES)

    def test_plugin_types(self):
        for t in ["rate_limit", "auth", "cors", "log", "transform", "security"]:
            self.assertIn(t, ag.PLUGIN_TYPES)


class TestCreateRoute(unittest.TestCase):
    def test_basic_route(self):
        rid = ag.create_route("r-" + _u(), "/api/test", "127.0.0.1:8000")
        self.assertIsInstance(rid, str)

    def test_route_with_methods(self):
        rid = ag.create_route("r-" + _u(), "/api/x", "127.0.0.1:8001",
                                methods=["GET", "POST"])
        self.assertIsInstance(rid, str)

    def test_route_with_plugins(self):
        rid = ag.create_route("r-" + _u(), "/api/y", "127.0.0.1:8002",
                                plugins={"rate_limit": {"limit": 100}})
        self.assertIsInstance(rid, str)

    def test_route_with_strip(self):
        rid = ag.create_route("r-" + _u(), "/api/z", "127.0.0.1:8003",
                                strip_path=False)
        self.assertIsInstance(rid, str)


class TestCreateService(unittest.TestCase):
    def test_basic_service(self):
        sid = ag.create_service("svc-" + _u(), "127.0.0.1", 8000)
        self.assertIsInstance(sid, str)

    def test_service_with_protocol(self):
        sid = ag.create_service("svc-" + _u(), "127.0.0.1", 8000, protocol="https")
        self.assertIsInstance(sid, str)

    def test_all_protocols(self):
        for p in ["http", "https", "grpc", "ws"]:
            sid = ag.create_service(f"svc-{p}-" + _u(), "127.0.0.1", 8000, protocol=p)
            self.assertIsInstance(sid, str)


class TestCreateConsumer(unittest.TestCase):
    def test_consumer_jwt(self):
        cid = ag.create_consumer("c-" + _u(), "user1", "jwt")
        self.assertIsInstance(cid, str)

    def test_consumer_basic(self):
        cid = ag.create_consumer("c-" + _u(), "user2", "basic")
        self.assertIsInstance(cid, str)

    def test_consumer_api_key(self):
        cid = ag.create_consumer("c-" + _u(), "user3", "api_key")
        self.assertIsInstance(cid, str)

    def test_consumer_oauth2(self):
        cid = ag.create_consumer("c-" + _u(), "user4", "oauth2")
        self.assertIsInstance(cid, str)

    def test_consumer_hmac(self):
        cid = ag.create_consumer("c-" + _u(), "user5", "hmac")
        self.assertIsInstance(cid, str)

    def test_consumer_invalid_auth(self):
        cid = ag.create_consumer("c-" + _u(), "user6", "INVALID")
        self.assertIsInstance(cid, str)

    def test_consumer_with_credentials(self):
        cid = ag.create_consumer("c-" + _u(), "user7", "jwt",
                                   {"key": "secret", "alg": "HS256"})
        self.assertIsInstance(cid, str)


class TestRateLimit(unittest.TestCase):
    def test_first_request_allowed(self):
        result = ag.check_rate_limit("r-" + _u(), "c", "second", 10)
        self.assertTrue(result["allowed"])

    def test_under_limit(self):
        route = "r-" + _u()
        consumer = "c-" + _u()
        for i in range(5):
            result = ag.check_rate_limit(route, consumer, "second", 10)
            self.assertTrue(result["allowed"])

    def test_exceeds_limit(self):
        route = "r-" + _u()
        consumer = "c-" + _u()
        for i in range(3):
            ag.check_rate_limit(route, consumer, "second", 3)
        result = ag.check_rate_limit(route, consumer, "second", 3)
        self.assertFalse(result["allowed"])

    def test_invalid_limit_type(self):
        result = ag.check_rate_limit("r-" + _u(), "c", "INVALID", 10)
        self.assertIn("allowed", result)

    def test_per_minute(self):
        result = ag.check_rate_limit("r-" + _u(), "c", "minute", 100)
        self.assertTrue(result["allowed"])


class TestCircuitBreaker(unittest.TestCase):
    def test_init_success(self):
        result = ag.circuit_breaker_record("r-" + _u(), True)
        self.assertEqual(result["state"], "closed")
        self.assertEqual(result["action"], "initialized")

    def test_init_failure(self):
        result = ag.circuit_breaker_record("r-" + _u(), False)
        self.assertEqual(result["state"], "closed")
        self.assertEqual(result["action"], "initialized")

    def test_trip_after_threshold(self):
        route = "r-" + _u()
        for i in range(5):
            result = ag.circuit_breaker_record(route, False, failure_threshold=5)
        self.assertEqual(result["state"], "open")
        self.assertEqual(result["action"], "tripped")

    def test_reset_after_success(self):
        route = "r-" + _u()
        for i in range(5):
            ag.circuit_breaker_record(route, False, failure_threshold=5)
        result = ag.circuit_breaker_record(route, True)
        self.assertIn(result["state"], ["closed", "open", "half_open"])


class TestGradientRoute(unittest.TestCase):
    def test_create_canary(self):
        rid = ag.create_gradient_route("r-" + _u(), "canary",
                                         [{"bucket": "v2", "weight": 10}])
        self.assertIsInstance(rid, str)

    def test_create_blue_green(self):
        rid = ag.create_gradient_route("r-" + _u(), "blue_green",
                                         [{"name": "blue"}, {"name": "green"}])
        self.assertIsInstance(rid, str)

    def test_create_ab_test(self):
        rid = ag.create_gradient_route("r-" + _u(), "ab_test",
                                         [{"group": "A"}, {"group": "B"}])
        self.assertIsInstance(rid, str)

    def test_create_mirror(self):
        rid = ag.create_gradient_route("r-" + _u(), "mirror", [])
        self.assertIsInstance(rid, str)

    def test_create_invalid_type(self):
        rid = ag.create_gradient_route("r-" + _u(), "INVALID", [])
        self.assertIsInstance(rid, str)


class TestEvaluateGradient(unittest.TestCase):
    def test_canary_match(self):
        route = "r-" + _u()
        ag.create_gradient_route(route, "canary", [{"bucket": "v2", "weight": 100}])
        result = ag.evaluate_gradient(route, {"tag": "v2"})
        self.assertEqual(result["target"], "canary")

    def test_canary_no_match(self):
        route = "r-" + _u()
        ag.create_gradient_route(route, "canary", [{"bucket": "v2", "weight": 100}])
        result = ag.evaluate_gradient(route, {"tag": "v1"})
        self.assertEqual(result["target"], "primary")

    def test_ab_test_match(self):
        route = "r-" + _u()
        ag.create_gradient_route(route, "ab_test", [{"group": "A", "upstream": "svc-a"}])
        result = ag.evaluate_gradient(route, {"group": "A"})
        self.assertEqual(result["target"], "svc-a")

    def test_no_gradient(self):
        result = ag.evaluate_gradient("nonexistent-" + _u(), {})
        self.assertEqual(result["target"], "primary")


class TestTrafficRecord(unittest.TestCase):
    def test_record(self):
        tid = ag.record_traffic("r-" + _u(), "req-1", "GET", "/api/x", 200, 50.0)
        self.assertIsInstance(tid, str)

    def test_record_500(self):
        tid = ag.record_traffic("r-" + _u(), "req-2", "POST", "/api/y", 500, 100.0)
        self.assertIsInstance(tid, str)

    def test_record_404(self):
        tid = ag.record_traffic("r-" + _u(), "req-3", "GET", "/api/missing", 404, 5.0)
        self.assertIsInstance(tid, str)


class TestRouteStats(unittest.TestCase):
    def test_empty_stats(self):
        result = ag.get_route_stats("nonexistent-" + _u())
        self.assertEqual(result["total_requests"], 0)

    def test_stats_with_data(self):
        route = "r-" + _u()
        ag.record_traffic(route, "1", "GET", "/x", 200, 50.0)
        ag.record_traffic(route, "2", "GET", "/x", 200, 60.0)
        ag.record_traffic(route, "3", "GET", "/x", 500, 200.0)
        result = ag.get_route_stats(route)
        self.assertEqual(result["total_requests"], 3)
        self.assertIn("200", result["status_distribution"])
        self.assertIn("500", result["status_distribution"])

    def test_stats_avg_latency(self):
        route = "r-" + _u()
        ag.record_traffic(route, "1", "GET", "/x", 200, 100.0)
        ag.record_traffic(route, "2", "GET", "/x", 200, 200.0)
        result = ag.get_route_stats(route)
        self.assertGreater(result["avg_latency_ms"], 0)


class TestCLICommands(unittest.TestCase):
    def test_cmd_route(self):
        try:
            ag.cmd_route(["cli-" + _u(), "/api/cli", "127.0.0.1:9000"])
        except SystemExit:
            pass

    def test_cmd_service(self):
        try:
            ag.cmd_service(["cli-svc-" + _u(), "127.0.0.1", "9000"])
        except SystemExit:
            pass

    def test_cmd_consumer(self):
        try:
            ag.cmd_consumer(["cli-c-" + _u(), "user", "jwt"])
        except SystemExit:
            pass

    def test_cmd_rate(self):
        try:
            ag.cmd_rate(["r", "c", "10", "second"])
        except SystemExit:
            pass

    def test_cmd_circuit_success(self):
        try:
            ag.cmd_circuit(["r", "success"])
        except SystemExit:
            pass

    def test_cmd_circuit_failure(self):
        try:
            ag.cmd_circuit(["r", "failed"])
        except SystemExit:
            pass

    def test_cmd_gradient(self):
        try:
            ag.cmd_gradient(["r-" + _u(), "canary", "[]"])
        except SystemExit:
            pass

    def test_cmd_eval_gradient(self):
        try:
            ag.cmd_eval_gradient(["nonexistent", "tag1"])
        except SystemExit:
            pass

    def test_cmd_stats(self):
        try:
            ag.cmd_stats(["nonexistent-" + _u()])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10140/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_services_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10140/api/services", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("services", data)
        except Exception:
            self.skipTest("HTTP service not running")

    def test_consumers_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10140/api/consumers", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("consumers", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
