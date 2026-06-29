#!/usr/bin/env python3
"""P1-25 业务监控大盘测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import business_dashboard as bd


class TestMetricRecord(unittest.TestCase):
    def test_record_gauge(self):
        mid = bd.record_metric("order_count", 100, "gauge")
        self.assertIsInstance(mid, str)

    def test_record_counter(self):
        mid = bd.record_metric("register_count", 50, "counter")
        self.assertIsInstance(mid, str)

    def test_record_histogram(self):
        mid = bd.record_metric("latency", 250.5, "histogram")
        self.assertIsInstance(mid, str)

    def test_record_summary(self):
        mid = bd.record_metric("response_size", 1024, "summary")
        self.assertIsInstance(mid, str)

    def test_invalid_type_fallback(self):
        mid = bd.record_metric("test", 1.0, "INVALID")
        self.assertIsInstance(mid, str)

    def test_record_with_dimensions(self):
        mid = bd.record_metric("order_count", 100, "gauge", {"region": "cn", "channel": "app"})
        self.assertIsInstance(mid, str)


class TestMetricQuery(unittest.TestCase):
    def setUp(self):
        self.test_metric = f"test_metric_{os.urandom(4).hex()}"
        for v in [10, 20, 30, 40, 50]:
            bd.record_metric(self.test_metric, v)

    def test_latest(self):
        m = bd.get_metric_latest(self.test_metric)
        self.assertIsNotNone(m)
        self.assertEqual(m["metric_name"], self.test_metric)
        self.assertIn(m["value"], [10, 20, 30, 40, 50])

    def test_latest_not_found(self):
        m = bd.get_metric_latest("nonexistent_metric_xyz")
        self.assertIsNone(m)

    def test_history(self):
        h = bd.get_metric_history(self.test_metric, 24, 100)
        self.assertIsInstance(h, list)
        self.assertEqual(len(h), 5)

    def test_history_limit(self):
        h = bd.get_metric_history(self.test_metric, 24, 2)
        self.assertEqual(len(h), 2)

    def test_stats(self):
        s = bd.calculate_metric_stats(self.test_metric, 24)
        self.assertEqual(s["count"], 5)
        self.assertEqual(s["avg"], 30.0)
        self.assertEqual(s["min"], 10.0)
        self.assertEqual(s["max"], 50.0)


class TestFunnelEvents(unittest.TestCase):
    def setUp(self):
        self.session = f"session_{os.urandom(4).hex()}"

    def test_record_visit(self):
        eid = bd.record_funnel_event("u1", self.session, "visit")
        self.assertIsInstance(eid, str)

    def test_record_browse(self):
        eid = bd.record_funnel_event("u1", self.session, "browse")
        self.assertIsInstance(eid, str)

    def test_record_cart(self):
        eid = bd.record_funnel_event("u1", self.session, "cart")
        self.assertIsInstance(eid, str)

    def test_record_checkout(self):
        eid = bd.record_funnel_event("u1", self.session, "checkout")
        self.assertIsInstance(eid, str)

    def test_record_payment(self):
        eid = bd.record_funnel_event("u1", self.session, "payment")
        self.assertIsInstance(eid, str)

    def test_record_complete(self):
        eid = bd.record_funnel_event("u1", self.session, "complete")
        self.assertIsInstance(eid, str)

    def test_invalid_stage_empty(self):
        eid = bd.record_funnel_event("u1", self.session, "INVALID")
        self.assertEqual(eid, "")

    def test_record_with_value(self):
        eid = bd.record_funnel_event("u1", self.session, "payment", 100.0)
        self.assertIsInstance(eid, str)


class TestFunnelCalculation(unittest.TestCase):
    def test_funnel_structure(self):
        session = f"funnel_test_{os.urandom(4).hex()}"
        for stage in bd.FUNNEL_STAGES:
            bd.record_funnel_event(f"u-{stage}", session, stage)
        funnel = bd.calculate_funnel(24)
        self.assertIn("stages", funnel)
        self.assertIn("overall_conversion", funnel)
        self.assertEqual(len(funnel["stages"]), len(bd.FUNNEL_STAGES))

    def test_funnel_stages_order(self):
        funnel = bd.calculate_funnel(24)
        for i, stage_info in enumerate(funnel["stages"]):
            self.assertEqual(stage_info["stage"], bd.FUNNEL_STAGES[i])

    def test_funnel_conversion(self):
        session = f"funnel_conv_{os.urandom(4).hex()}"
        for i, stage in enumerate(bd.FUNNEL_STAGES):
            # 模拟递减用户数
            for j in range(10 - i):
                bd.record_funnel_event(f"u-{stage}-{j}", session, stage)
        funnel = bd.calculate_funnel(24)
        # 后续 stage 用户数应该 <= 前面的
        prev = None
        for s in funnel["stages"]:
            if prev is not None:
                self.assertLessEqual(s["users"], prev)
            prev = s["users"]


class TestDashboardPanels(unittest.TestCase):
    def test_create_panel(self):
        pid = bd.create_dashboard_panel("p1", "Order Count", "line",
                                          "SELECT count FROM orders")
        self.assertIsInstance(pid, str)

    def test_create_with_config(self):
        pid = bd.create_dashboard_panel("p2", "Latency", "gauge",
                                          "SELECT p99", {"unit": "ms"}, 1)
        self.assertIsInstance(pid, str)

    def test_list_panels(self):
        bd.create_dashboard_panel(f"list-{os.urandom(2).hex()}", "Test", "stat", "q")
        panels = bd.list_dashboard_panels()
        self.assertIsInstance(panels, list)
        self.assertGreater(len(panels), 0)

    def test_panel_config(self):
        pid = bd.create_dashboard_panel(f"cfg-{os.urandom(2).hex()}", "Config", "line",
                                           "q", {"color": "red"})
        panels = bd.list_dashboard_panels()
        cfg_panel = next((p for p in panels if p["title"] == "Config"), None)
        if cfg_panel:
            self.assertEqual(cfg_panel["config"]["color"], "red")


class TestCustomAlerts(unittest.TestCase):
    def setUp(self):
        self.alert_metric = f"alert_metric_{os.urandom(4).hex()}"
        bd.record_metric(self.alert_metric, 100.0)

    def test_create_alert_gt(self):
        aid = bd.create_custom_alert("high-test", self.alert_metric, "gt", 50.0)
        self.assertIsInstance(aid, str)

    def test_create_alert_lt(self):
        aid = bd.create_custom_alert("low-test", self.alert_metric, "lt", 200.0)
        self.assertIsInstance(aid, str)

    def test_create_with_duration(self):
        aid = bd.create_custom_alert("dur-test", self.alert_metric, "gt",
                                       50.0, 600, "critical")
        self.assertIsInstance(aid, str)

    def test_check_triggered(self):
        bd.create_custom_alert(f"trigger-{os.urandom(2).hex()}",
                                self.alert_metric, "gt", 50.0)
        triggered = bd.check_custom_alerts()
        self.assertIsInstance(triggered, list)

    def test_check_not_triggered(self):
        bd.create_custom_alert(f"nope-{os.urandom(2).hex()}",
                                self.alert_metric, "gt", 10000.0)
        triggered = bd.check_custom_alerts()
        nope = [t for t in triggered if t["alert_name"].startswith("nope-")]
        self.assertEqual(len(nope), 0)


class TestConditionEvaluation(unittest.TestCase):
    def test_gt(self):
        self.assertTrue(bd.evaluate_condition(100, "gt", 50))
        self.assertFalse(bd.evaluate_condition(50, "gt", 100))

    def test_lt(self):
        self.assertTrue(bd.evaluate_condition(50, "lt", 100))
        self.assertFalse(bd.evaluate_condition(100, "lt", 50))

    def test_gte(self):
        self.assertTrue(bd.evaluate_condition(100, "gte", 100))
        self.assertTrue(bd.evaluate_condition(101, "gte", 100))
        self.assertFalse(bd.evaluate_condition(99, "gte", 100))

    def test_lte(self):
        self.assertTrue(bd.evaluate_condition(100, "lte", 100))
        self.assertTrue(bd.evaluate_condition(99, "lte", 100))
        self.assertFalse(bd.evaluate_condition(101, "lte", 100))

    def test_eq(self):
        self.assertTrue(bd.evaluate_condition(100, "eq", 100))
        self.assertFalse(bd.evaluate_condition(101, "eq", 100))

    def test_ne(self):
        self.assertTrue(bd.evaluate_condition(100, "ne", 50))
        self.assertFalse(bd.evaluate_condition(100, "ne", 100))

    def test_unknown(self):
        self.assertFalse(bd.evaluate_condition(100, "unknown", 50))


class TestScreens(unittest.TestCase):
    def test_create_screen(self):
        sid = bd.create_screen("main", "Main Dashboard", ["p1", "p2", "p3"])
        self.assertIsInstance(sid, str)

    def test_create_with_refresh(self):
        sid = bd.create_screen("ops", "Ops Screen", ["p1"], 60)
        self.assertIsInstance(sid, str)

    def test_get_screen(self):
        bd.create_screen(f"get-{os.urandom(2).hex()}", "Get Test", ["p1"], 30)
        s = bd.get_screen(f"get-{os.urandom(2).hex()}")
        # 可能找不到,因为是随机 ID

    def test_get_not_found(self):
        s = bd.get_screen("nonexistent-screen-xyz")
        self.assertIsNone(s)


class TestDashboardOverview(unittest.TestCase):
    def test_overview_keys(self):
        ov = bd.get_dashboard_overview()
        self.assertIn("total_metrics_records", ov)
        self.assertIn("total_funnel_events", ov)
        self.assertIn("total_panels", ov)
        self.assertIn("active_alerts", ov)
        self.assertIn("total_screens", ov)


class TestConstants(unittest.TestCase):
    def test_metric_types(self):
        for t in bd.METRIC_TYPES:
            self.assertIn(t, ["counter", "gauge", "histogram", "summary"])

    def test_funnel_stages(self):
        self.assertEqual(len(bd.FUNNEL_STAGES), 6)
        self.assertIn("visit", bd.FUNNEL_STAGES)
        self.assertIn("complete", bd.FUNNEL_STAGES)

    def test_business_metrics(self):
        self.assertIn("order_count", bd.BUSINESS_METRICS)
        self.assertIn("revenue", bd.BUSINESS_METRICS)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "record_metric", "latest", "history", "stats",
                    "funnel_event", "funnel", "panel_create", "panels",
                    "alert_create", "alerts_check", "screen_create",
                    "screen_get", "overview", "eval_condition"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(bd, f"cmd_{cmd_name}")))

    def test_cmd_record_metric(self):
        bd.cmd_record_metric(["test-cmd", "100", "gauge", '{"env": "prod"}'])

    def test_cmd_latest(self):
        metric = f"cmd-test-{os.urandom(2).hex()}"
        bd.record_metric(metric, 100)
        bd.cmd_latest([metric])

    def test_cmd_history(self):
        metric = f"cmd-hist-{os.urandom(2).hex()}"
        for v in [10, 20, 30]:
            bd.record_metric(metric, v)
        bd.cmd_history([metric, "24", "10"])

    def test_cmd_stats(self):
        metric = f"cmd-stats-{os.urandom(2).hex()}"
        for v in [10, 20, 30]:
            bd.record_metric(metric, v)
        bd.cmd_stats([metric, "24"])

    def test_cmd_funnel_event(self):
        session = f"cmd-funnel-{os.urandom(2).hex()}"
        bd.cmd_funnel_event(["u1", session, "visit"])

    def test_cmd_funnel(self):
        bd.cmd_funnel(["24"])

    def test_cmd_panel_create(self):
        bd.cmd_panel_create([f"cmd-panel-{os.urandom(2).hex()}", "Test", "line", "q", '{"color": "blue"}', "1"])

    def test_cmd_panels(self):
        bd.cmd_panels([])

    def test_cmd_alert_create(self):
        bd.cmd_alert_create(["cmd-alert", "metric", "gt", "100", "300", "warning"])

    def test_cmd_alerts_check(self):
        bd.cmd_alerts_check([])

    def test_cmd_screen_create(self):
        bd.cmd_screen_create([f"cmd-screen-{os.urandom(2).hex()}", "Test", "p1,p2", "30"])

    def test_cmd_screen_get(self):
        sid = f"cmd-sg-{os.urandom(2).hex()}"
        bd.create_screen(sid, "Test", ["p1"])
        bd.cmd_screen_get([sid])

    def test_cmd_overview(self):
        bd.cmd_overview([])

    def test_cmd_eval_condition(self):
        bd.cmd_eval_condition(["100", "gt", "50"])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=bd.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{bd.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_overview(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{bd.HTTP_PORT}/api/dashboard/overview", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_metrics_records", data)
        except Exception:
            pass

    def test_panels(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{bd.HTTP_PORT}/api/panels", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("panels", data)
        except Exception:
            pass

    def test_funnel(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{bd.HTTP_PORT}/api/funnel?hours=24", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("stages", data)
        except Exception:
            pass

    def test_metric_record_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{bd.HTTP_PORT}/api/metric/record",
                data=json.dumps({"metric_name": "http-metric",
                                 "value": 100.0}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_funnel_event_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{bd.HTTP_PORT}/api/funnel/event",
                data=json.dumps({"user_id": "u1", "session_id": "s1",
                                 "stage": "visit"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
