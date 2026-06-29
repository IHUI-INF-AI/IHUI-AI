#!/usr/bin/env python3
"""P1-47 智能告警降噪 LLM 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import llm_alert_dedup as lad


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_severities(self):
        for s in ["critical", "warning", "info", "debug"]:
            self.assertIn(s, lad.ALERT_SEVERITIES)

    def test_providers(self):
        for p in ["openai", "claude", "tongyi", "wenxin", "local"]:
            self.assertIn(p, lad.LLM_PROVIDERS)

    def test_summary_types(self):
        for t in ["executive", "technical", "ops", "customer"]:
            self.assertIn(t, lad.SUMMARY_TYPES)


class TestAlert(unittest.TestCase):
    def test_receive(self):
        aid = lad.receive_alert("HighCPU", "CPU usage high", "warning", "svc-a")
        self.assertIsInstance(aid, str)

    def test_invalid_severity(self):
        aid = lad.receive_alert("test", "msg", "invalid", "svc")
        self.assertIsInstance(aid, str)


class TestDedupRule(unittest.TestCase):
    def test_create(self):
        rid = lad.create_dedup_rule("rule-" + _u(), 0.85, 300)
        self.assertIsInstance(rid, str)

    def test_create_default(self):
        rid = lad.create_dedup_rule("rule-" + _u())
        self.assertIsInstance(rid, str)


class TestCluster(unittest.TestCase):
    def test_cluster_empty(self):
        result = lad.cluster_alerts(0.7, 300)
        self.assertIn("clusters_created", result)

    def test_cluster_with_alerts(self):
        for i in range(5):
            lad.receive_alert("TestAlert", f"Test message {i}", "warning", "svc-a")
        result = lad.cluster_alerts(0.5, 600)
        self.assertGreater(result["clusters_created"], 0)

    def test_cluster_similar_grouped(self):
        for i in range(3):
            lad.receive_alert("Same", "Connection timeout to database", "warning", "svc")
        result = lad.cluster_alerts(0.5, 600)
        self.assertGreater(result["clusters_created"], 0)


class TestSummary(unittest.TestCase):
    def test_generate_executive(self):
        lad.receive_alert("T1", "msg", "warning", "svc")
        result = lad.cluster_alerts(0.5, 600)
        cl = lad.get_clusters(1)
        if cl:
            sid = lad.generate_summary(cl[0]["id"], "executive")
            self.assertIsInstance(sid, str)

    def test_generate_technical(self):
        lad.receive_alert("T2", "timeout", "critical", "svc")
        result = lad.cluster_alerts(0.5, 600)
        cl = lad.get_clusters(1)
        if cl:
            sid = lad.generate_summary(cl[0]["id"], "technical")
            self.assertIsInstance(sid, str)

    def test_generate_ops(self):
        lad.receive_alert("T3", "memory", "warning", "svc")
        result = lad.cluster_alerts(0.5, 600)
        cl = lad.get_clusters(1)
        if cl:
            sid = lad.generate_summary(cl[0]["id"], "ops")
            self.assertIsInstance(sid, str)

    def test_generate_customer(self):
        lad.receive_alert("T4", "cpu", "info", "svc")
        result = lad.cluster_alerts(0.5, 600)
        cl = lad.get_clusters(1)
        if cl:
            sid = lad.generate_summary(cl[0]["id"], "customer")
            self.assertIsInstance(sid, str)

    def test_invalid_type(self):
        sid = lad.generate_summary("nonexistent", "invalid")
        self.assertIsInstance(sid, str)

    def test_invalid_provider(self):
        sid = lad.generate_summary("nonexistent", "executive", "invalid")
        self.assertIsInstance(sid, str)


class TestFeedback(unittest.TestCase):
    def test_submit(self):
        fid = lad.submit_feedback("cluster-1", 5, "good", True)
        self.assertIsInstance(fid, str)

    def test_submit_negative(self):
        fid = lad.submit_feedback("cluster-1", 1, "bad", False)
        self.assertIsInstance(fid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = lad.get_dedup_report()
        self.assertIn("total_alerts", report)
        self.assertIn("total_clusters", report)
        self.assertIn("noise_reduction_pct", report)


class TestInternal(unittest.TestCase):
    def test_similarity_same(self):
        s = lad._text_similarity("hello world", "hello world")
        self.assertEqual(s, 1.0)

    def test_similarity_diff(self):
        s = lad._text_similarity("hello world", "goodbye universe")
        self.assertEqual(s, 0.0)

    def test_similarity_partial(self):
        s = lad._text_similarity("hello world test", "hello world")
        self.assertGreater(s, 0.5)

    def test_similarity_empty(self):
        s = lad._text_similarity("", "text")
        self.assertEqual(s, 0.0)

    def test_fingerprint(self):
        fp = lad._fingerprint("alert", "svc", "msg")
        self.assertEqual(len(fp), 16)


if __name__ == "__main__":
    unittest.main()
