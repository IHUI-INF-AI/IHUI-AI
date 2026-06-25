#!/usr/bin/env python3
"""P0-66 统一告警接入 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import unified_alerting as ua


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_channels(self):
        for c in ["dingtalk", "feishu", "wechat", "email", "sms", "webhook"]:
            self.assertIn(c, ua.CHANNELS)

    def test_severities(self):
        for s in ["critical", "warning", "info", "debug"]:
            self.assertIn(s, ua.SEVERITIES)

    def test_actions(self):
        for a in ["send", "aggregate", "suppress", "escalate", "drop"]:
            self.assertIn(a, ua.ROUTE_ACTIONS)


class TestRoute(unittest.TestCase):
    def test_create(self):
        rid = ua.create_route("route-" + _u(), "*", "warning", "dingtalk")
        self.assertIsInstance(rid, str)

    def test_create_with_recipients(self):
        rid = ua.create_route("route-" + _u(), "fullstack_apm", "critical", "feishu", ["user1", "user2"])
        self.assertIsInstance(rid, str)

    def test_invalid_channel(self):
        rid = ua.create_route("route-" + _u(), "*", "warning", "invalid")
        self.assertIsInstance(rid, str)

    def test_invalid_severity(self):
        rid = ua.create_route("route-" + _u(), "*", "invalid", "email")
        self.assertIsInstance(rid, str)


class TestChannel(unittest.TestCase):
    def test_configure_email(self):
        cid = ua.configure_channel("email", "smtp://x", "secret")
        self.assertIsInstance(cid, str)

    def test_invalid_channel(self):
        cid = ua.configure_channel("invalid")
        self.assertIsInstance(cid, str)


class TestRule(unittest.TestCase):
    def test_create(self):
        rid = ua.create_rule("rule-" + _u(), "svc-a", "cpu > 80", "warning")
        self.assertIsInstance(rid, str)

    def test_invalid_severity(self):
        rid = ua.create_rule("rule-" + _u(), "svc-a", "x", "invalid")
        self.assertIsInstance(rid, str)

    def test_invalid_action(self):
        rid = ua.create_rule("rule-" + _u(), "svc-a", "x", "warning", "invalid")
        self.assertIsInstance(rid, str)


class TestFire(unittest.TestCase):
    def test_fire(self):
        result = ua.fire_alert("svc-a", "warning", "test", "msg")
        self.assertIn("alert_id", result)

    def test_fire_critical(self):
        result = ua.fire_alert("svc-crit-" + _u(), "critical", "alert-" + _u(), "msg")
        self.assertEqual(result["dedup_state"], "new")

    def test_fire_dedup(self):
        k = "dedup1-" + _u()
        ua.fire_alert("svc-a", "warning", "title1", "msg", k)
        result = ua.fire_alert("svc-a", "warning", "title1", "msg", k)
        self.assertEqual(result["dedup_state"], "deduped")

    def test_fire_invalid_severity(self):
        result = ua.fire_alert("svc-a", "invalid", "t", "m")
        self.assertIn("alert_id", result)

    def test_fire_with_routes(self):
        ua.create_route("rt-" + _u(), "*", "critical", "dingtalk")
        result = ua.fire_alert("svc-test-" + _u(), "critical", "t", "m")
        self.assertIn("dingtalk", result["channels_sent"])


class TestAggregate(unittest.TestCase):
    def test_aggregate(self):
        aid = ua.aggregate_alerts("agg-" + _u(), ["svc-a", "svc-b"])
        self.assertIsInstance(aid, str)

    def test_aggregate_existing(self):
        key = "agg-" + _u()
        ua.aggregate_alerts(key, ["svc-a"])
        aid = ua.aggregate_alerts(key, ["svc-a"])
        self.assertIsInstance(aid, str)

    def test_invalid_severity(self):
        aid = ua.aggregate_alerts("agg-" + _u(), ["svc-a"], "invalid")
        self.assertIsInstance(aid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = ua.get_alerting_report()
        self.assertIn("total_routes", report)
        self.assertIn("total_channels", report)
        self.assertIn("total_rules", report)
        self.assertIn("alerts_sent", report)
        self.assertIn("dedup_keys", report)
        self.assertIn("dedup_rate_pct", report)
        self.assertIn("aggregations", report)


if __name__ == "__main__":
    unittest.main()
