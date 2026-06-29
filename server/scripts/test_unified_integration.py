#!/usr/bin/env python3
"""P0-65 统一大盘集成 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import unified_integration as ui


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_statuses(self):
        for s in ["pending", "registered", "healthy", "degraded", "offline"]:
            self.assertIn(s, ui.INTEGRATION_STATUSES)

    def test_round14(self):
        self.assertEqual(len(ui.ROUND14_SERVICES), 11)

    def test_round13(self):
        self.assertEqual(len(ui.ROUND13_SERVICES), 11)


class TestRegister(unittest.TestCase):
    def test_register_basic(self):
        sid = ui.register_integration("svc-" + _u(), "P0-XX", 10999)
        self.assertIsInstance(sid, str)

    def test_register_with_label(self):
        sid = ui.register_integration("svc-" + _u(), "P1-XX", 10999, "P1-XX", "desc")
        self.assertIsInstance(sid, str)

    def test_register_invalid_port(self):
        sid = ui.register_integration("svc-" + _u(), "P0-XX", -1)
        self.assertIsInstance(sid, str)

    def test_register_large_port(self):
        sid = ui.register_integration("svc-" + _u(), "P0-XX", 999999)
        self.assertIsInstance(sid, str)


class TestBatch(unittest.TestCase):
    def test_batch_round14(self):
        result = ui.batch_register_round(14)
        self.assertEqual(result["round"], 14)
        self.assertGreater(result["registered"], 0)

    def test_batch_round13(self):
        result = ui.batch_register_round(13)
        self.assertEqual(result["round"], 13)

    def test_batch_unknown(self):
        result = ui.batch_register_round(99)
        self.assertEqual(result["registered"], 0)


class TestLog(unittest.TestCase):
    def test_log(self):
        lid = ui.log_integration("svc-a", "register", "ok", "details")
        self.assertIsInstance(lid, str)

    def test_log_minimal(self):
        lid = ui.log_integration("svc-a", "check")
        self.assertIsInstance(lid, str)


class TestMetric(unittest.TestCase):
    def test_sync(self):
        mid = ui.sync_metric("svc-a", "cpu", 50.0)
        self.assertIsInstance(mid, str)


class TestStatus(unittest.TestCase):
    def test_update(self):
        name = "svc-" + _u()
        ui.register_integration(name, "P0-XX", 10999)
        ok = ui.update_status(name, "healthy")
        self.assertTrue(ok)

    def test_update_invalid(self):
        name = "svc-" + _u()
        ui.register_integration(name, "P0-XX", 10999)
        ok = ui.update_status(name, "invalid")
        self.assertTrue(ok)


class TestBinding(unittest.TestCase):
    def test_bind(self):
        bid = ui.bind_dashboard("dash-1", "svc-a", "metric", 1)
        self.assertIsInstance(bid, str)

    def test_bind_default(self):
        bid = ui.bind_dashboard("dash-1", "svc-a")
        self.assertIsInstance(bid, str)


class TestHealthCheck(unittest.TestCase):
    def test_all(self):
        result = ui.health_check_all()
        self.assertIsInstance(result, dict)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = ui.get_integration_report()
        self.assertIn("total_services", report)
        self.assertIn("healthy_services", report)
        self.assertIn("registered_services", report)
        self.assertIn("integration_logs", report)
        self.assertIn("synced_metrics", report)
        self.assertIn("dashboard_bindings", report)
        self.assertIn("round14_services", report)


if __name__ == "__main__":
    unittest.main()
