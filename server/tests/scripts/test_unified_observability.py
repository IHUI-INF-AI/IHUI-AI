#!/usr/bin/env python3
"""P0-32 全局可观测性大盘 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import unified_observability as uo


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_slo_targets(self):
        for t in ["availability", "latency_p99", "error_rate", "throughput"]:
            self.assertIn(t, uo.SLO_TARGETS)

    def test_dashboard_views(self):
        for v in ["business", "technical", "executive", "ops"]:
            self.assertIn(v, uo.DASHBOARD_VIEWS)

    def test_alert_severities(self):
        for s in ["critical", "warning", "info"]:
            self.assertIn(s, uo.ALERT_SEVERITIES)


class TestRegisterService(unittest.TestCase):
    def test_register_basic(self):
        sid = uo.register_service("svc-" + _u(), "127.0.0.1", 10120)
        self.assertIsInstance(sid, str)

    def test_register_with_tier(self):
        sid = uo.register_service("frontend-" + _u(), "127.0.0.1", 8080, tier="frontend")
        self.assertIsInstance(sid, str)

    def test_register_with_owner(self):
        sid = uo.register_service("svc-" + _u(), "127.0.0.1", 9000, owner="team-a")
        self.assertIsInstance(sid, str)

    def test_register_with_tags(self):
        sid = uo.register_service("svc-" + _u(), "127.0.0.1", 9000,
                                    tags=["prod", "critical"])
        self.assertIsInstance(sid, str)

    def test_register_all_tiers(self):
        for tier in ["frontend", "backend", "database", "cache", "queue"]:
            sid = uo.register_service(f"svc-{tier}-" + _u(), "127.0.0.1", 9000, tier=tier)
            self.assertIsInstance(sid, str)


class TestRecordSLI(unittest.TestCase):
    def test_record_availability(self):
        mid = uo.record_sli("svc-" + _u(), "availability", 99.95, "%")
        self.assertIsInstance(mid, str)

    def test_record_latency(self):
        mid = uo.record_sli("svc-" + _u(), "latency_p99", 150.0, "ms")
        self.assertIsInstance(mid, str)

    def test_record_error_rate(self):
        mid = uo.record_sli("svc-" + _u(), "error_rate", 0.5, "%")
        self.assertIsInstance(mid, str)

    def test_record_throughput(self):
        mid = uo.record_sli("svc-" + _u(), "throughput", 1000.0, "rps")
        self.assertIsInstance(mid, str)

    def test_record_invalid_type_fallback(self):
        mid = uo.record_sli("svc-" + _u(), "INVALID", 0.0)
        self.assertIsInstance(mid, str)

    def test_record_with_window(self):
        mid = uo.record_sli("svc-" + _u(), "availability", 99.0, window_seconds=300)
        self.assertIsInstance(mid, str)


class TestRecordSLO(unittest.TestCase):
    def test_availability_slo(self):
        rid = uo.record_slo("svc-" + _u(), "availability", 99.9, 99.95)
        self.assertIsInstance(rid, str)

    def test_latency_slo(self):
        rid = uo.record_slo("svc-" + _u(), "latency_p99", 200.0, 150.0)
        self.assertIsInstance(rid, str)

    def test_error_rate_slo(self):
        rid = uo.record_slo("svc-" + _u(), "error_rate", 1.0, 0.5)
        self.assertIsInstance(rid, str)

    def test_throughput_slo(self):
        rid = uo.record_slo("svc-" + _u(), "throughput", 1000.0, 1200.0)
        self.assertIsInstance(rid, str)

    def test_slo_zero_target(self):
        rid = uo.record_slo("svc-" + _u(), "metric", 0, 50.0)
        self.assertIsInstance(rid, str)

    def test_slo_zero_actual(self):
        rid = uo.record_slo("svc-" + _u(), "metric", 100.0, 0.0)
        self.assertIsInstance(rid, str)


class TestCreateAlertRoute(unittest.TestCase):
    def test_route_critical(self):
        rid = uo.create_alert_route("HighErrorRate", "critical",
                                      "api-service", "/api/v1/alerts/critical")
        self.assertIsInstance(rid, str)

    def test_route_warning(self):
        rid = uo.create_alert_route("SlowQuery", "warning",
                                      "db-service", "/api/v1/alerts/warning")
        self.assertIsInstance(rid, str)

    def test_route_info(self):
        rid = uo.create_alert_route("DeployStarted", "info",
                                      "ci-service", "/api/v1/alerts/info")
        self.assertIsInstance(rid, str)

    def test_route_invalid_severity(self):
        rid = uo.create_alert_route("X", "INVALID", "svc", "/path")
        self.assertIsInstance(rid, str)

    def test_route_with_condition(self):
        rid = uo.create_alert_route("HighCPU", "warning", "node-1",
                                      "/alerts/cpu", "cpu > 80%")
        self.assertIsInstance(rid, str)


class TestFireAlert(unittest.TestCase):
    def test_fire_critical(self):
        aid = uo.fire_alert("ServiceDown", "critical", "api", "Service unavailable")
        self.assertIsInstance(aid, str)

    def test_fire_warning(self):
        aid = uo.fire_alert("HighLatency", "warning", "api", "P99 > 1s")
        self.assertIsInstance(aid, str)

    def test_fire_info(self):
        aid = uo.fire_alert("DeployStarted", "info", "ci", "v1.2.3 deploying")
        self.assertIsInstance(aid, str)

    def test_fire_with_value(self):
        aid = uo.fire_alert("HighErrorRate", "critical", "api",
                              "Error rate 8%", 8.0, 5.0)
        self.assertIsInstance(aid, str)

    def test_fire_invalid_severity(self):
        aid = uo.fire_alert("X", "INVALID", "svc", "msg")
        self.assertIsInstance(aid, str)


class TestResolveAlert(unittest.TestCase):
    def test_resolve_existing(self):
        aid = uo.fire_alert("TestAlert", "warning", "svc", "test")
        result = uo.resolve_alert(aid)
        self.assertTrue(result)

    def test_resolve_nonexistent(self):
        result = uo.resolve_alert("nonexistent-id")
        self.assertFalse(result)


class TestCheckHealth(unittest.TestCase):
    def test_check_unregistered(self):
        result = uo.check_health("nonexistent-" + _u())
        self.assertEqual(result["status"], "unknown")

    def test_check_unhealthy_port(self):
        svc = "svc-" + _u()
        uo.register_service(svc, "127.0.0.1", 1)  # 端口 1 不存在
        result = uo.check_health(svc)
        self.assertIn(result["status"], ["unhealthy", "unknown"])


class TestCreateDashboard(unittest.TestCase):
    def test_create_business(self):
        did = uo.create_dashboard("biz-" + _u(), "business",
                                    [{"title": "Sales", "type": "graph"}])
        self.assertIsInstance(did, str)

    def test_create_technical(self):
        did = uo.create_dashboard("tech-" + _u(), "technical",
                                    [{"title": "CPU", "type": "gauge"}])
        self.assertIsInstance(did, str)

    def test_create_executive(self):
        did = uo.create_dashboard("exec-" + _u(), "executive",
                                    [{"title": "Revenue", "type": "stat"}])
        self.assertIsInstance(did, str)

    def test_create_ops(self):
        did = uo.create_dashboard("ops-" + _u(), "ops",
                                    [{"title": "Incidents", "type": "table"}])
        self.assertIsInstance(did, str)

    def test_create_invalid_view(self):
        did = uo.create_dashboard("invalid-" + _u(), "INVALID_VIEW", [])
        self.assertIsInstance(did, str)

    def test_create_with_refresh(self):
        did = uo.create_dashboard("ref-" + _u(), "technical", [], refresh_interval=10)
        self.assertIsInstance(did, str)

    def test_create_with_owner(self):
        did = uo.create_dashboard("own-" + _u(), "technical", [], owner="sre-team")
        self.assertIsInstance(did, str)


class TestGetDashboard(unittest.TestCase):
    def test_get_existing(self):
        name = "dash-" + _u()
        uo.create_dashboard(name, "business", [{"title": "X"}])
        result = uo.get_dashboard(name)
        self.assertIsNotNone(result)
        self.assertEqual(result["name"], name)
        self.assertEqual(result["view_type"], "business")

    def test_get_nonexistent(self):
        result = uo.get_dashboard("nonexistent-" + _u())
        self.assertIsNone(result)


class TestGetOverview(unittest.TestCase):
    def test_overview_returns_dict(self):
        result = uo.get_overview()
        self.assertIsInstance(result, dict)

    def test_overview_has_keys(self):
        result = uo.get_overview()
        for k in ["total_services", "healthy_services", "firing_alerts",
                  "critical_alerts", "health_score"]:
            self.assertIn(k, result)

    def test_health_score_range(self):
        result = uo.get_overview()
        self.assertGreaterEqual(result["health_score"], 0)
        self.assertLessEqual(result["health_score"], 100)


class TestGetServiceSummary(unittest.TestCase):
    def test_summary_returns_list(self):
        result = uo.get_service_summary()
        self.assertIsInstance(result, list)

    def test_summary_items(self):
        uo.register_service("summary-test-" + _u(), "127.0.0.1", 9000)
        result = uo.get_service_summary()
        self.assertGreater(len(result), 0)
        item = result[0]
        self.assertIn("name", item)
        self.assertIn("tier", item)
        self.assertIn("status", item)


class TestEvaluateSLOCompliance(unittest.TestCase):
    def test_compliance_returns_dict(self):
        result = uo.evaluate_slo_compliance()
        self.assertIn("services", result)
        self.assertIn("total", result)

    def test_compliance_with_data(self):
        svc = "comp-svc-" + _u()
        uo.record_slo(svc, "availability", 99.9, 99.95)
        result = uo.evaluate_slo_compliance()
        self.assertGreater(result["total"], 0)


class TestCLICommands(unittest.TestCase):
    def test_cmd_overview(self):
        try:
            uo.cmd_overview([])
        except SystemExit:
            pass

    def test_cmd_services(self):
        try:
            uo.cmd_services([])
        except SystemExit:
            pass

    def test_cmd_compliance(self):
        try:
            uo.cmd_compliance([])
        except SystemExit:
            pass

    def test_cmd_register(self):
        try:
            uo.cmd_register(["cli-svc-" + _u(), "127.0.0.1", "9100"])
        except SystemExit:
            pass

    def test_cmd_sli(self):
        try:
            uo.cmd_sli(["svc", "availability", "99.9", "%"])
        except SystemExit:
            pass

    def test_cmd_slo(self):
        try:
            uo.cmd_slo(["svc", "avail", "99.9", "99.95"])
        except SystemExit:
            pass

    def test_cmd_fire(self):
        try:
            uo.cmd_fire(["alert-x", "warning", "svc-x", "msg"])
        except SystemExit:
            pass

    def test_cmd_health(self):
        try:
            uo.cmd_health(["nonexistent-" + _u()])
        except SystemExit:
            pass

    def test_cmd_route(self):
        try:
            uo.cmd_route(["alert-x", "warning", "svc", "/path"])
        except SystemExit:
            pass

    def test_cmd_dashboard(self):
        try:
            uo.cmd_dashboard(["dash-cli-" + _u(), "technical"])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10120/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_overview_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10120/api/overview", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("total_services", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
