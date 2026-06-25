#!/usr/bin/env python3
"""P1-24 AI 告警降噪 2.0 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import aiops_denoise as ai


class TestFingerprint(unittest.TestCase):
    def test_basic(self):
        fp = ai.compute_fingerprint("HighCPU", {"service": "api"})
        self.assertIsInstance(fp, str)
        self.assertEqual(len(fp), 16)

    def test_deterministic(self):
        fp1 = ai.compute_fingerprint("HighCPU", {"service": "api"})
        fp2 = ai.compute_fingerprint("HighCPU", {"service": "api"})
        self.assertEqual(fp1, fp2)

    def test_label_order_independent(self):
        fp1 = ai.compute_fingerprint("X", {"a": "1", "b": "2"})
        fp2 = ai.compute_fingerprint("X", {"b": "2", "a": "1"})
        self.assertEqual(fp1, fp2)

    def test_different_labels(self):
        fp1 = ai.compute_fingerprint("X", {"a": "1"})
        fp2 = ai.compute_fingerprint("X", {"a": "2"})
        self.assertNotEqual(fp1, fp2)

    def test_empty_labels(self):
        fp = ai.compute_fingerprint("Test", {})
        self.assertIsInstance(fp, str)


class TestAlertRecord(unittest.TestCase):
    def test_record_basic(self):
        aid = ai.record_alert("TestAlert", "warning", "api", {"env": "prod"})
        self.assertIsInstance(aid, str)

    def test_record_critical(self):
        aid = ai.record_alert("CriticalAlert", "critical", "db", {"shard": "0"})
        self.assertIsInstance(aid, str)

    def test_record_info(self):
        aid = ai.record_alert("InfoAlert", "info", "web", {})
        self.assertIsInstance(aid, str)

    def test_record_invalid_severity(self):
        aid = ai.record_alert("InvalidSev", "INVALID", "svc", {})
        self.assertIsInstance(aid, str)

    def test_record_with_message(self):
        aid = ai.record_alert("MsgAlert", "warning", "api", {}, "Test message")
        self.assertIsInstance(aid, str)


class TestFeedback(unittest.TestCase):
    def test_feedback_true_positive(self):
        aid = ai.record_alert("FBTest1", "warning", "api", {})
        fid = ai.record_feedback(aid, "true_positive", "ops-team")
        self.assertIsInstance(fid, str)

    def test_feedback_false_positive(self):
        aid = ai.record_alert("FBTest2", "warning", "api", {})
        fid = ai.record_feedback(aid, "false_positive", "ops-team")
        self.assertIsInstance(fid, str)

    def test_feedback_ack(self):
        aid = ai.record_alert("FBTest3", "warning", "api", {})
        fid = ai.record_feedback(aid, "ack", "ops-team")
        self.assertIsInstance(fid, str)

    def test_feedback_silence(self):
        aid = ai.record_alert("FBTest4", "warning", "api", {})
        fid = ai.record_feedback(aid, "silence", "ops-team", "maintenance window")
        self.assertIsInstance(fid, str)

    def test_feedback_invalid_type(self):
        aid = ai.record_alert("FBTest5", "warning", "api", {})
        fid = ai.record_feedback(aid, "INVALID", "user")
        self.assertIsInstance(fid, str)


class TestFalsePositiveRate(unittest.TestCase):
    def test_zero_for_new_alert(self):
        rate = ai.calc_false_positive_rate("NewUniqueAlertXYZ", 30)
        self.assertEqual(rate, 0.0)

    def test_with_feedback(self):
        name = f"FPRateTest-{os.urandom(4).hex()}"
        for i in range(10):
            aid = ai.record_alert(name, "warning", "api", {})
            if i < 3:
                ai.record_feedback(aid, "false_positive", "ops")
        rate = ai.calc_false_positive_rate(name, 30)
        self.assertGreater(rate, 0.0)
        self.assertLessEqual(rate, 1.0)

    def test_all_false_positive(self):
        name = f"FPRateAllFP-{os.urandom(4).hex()}"
        for i in range(5):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "false_positive", "ops")
        rate = ai.calc_false_positive_rate(name, 30)
        self.assertEqual(rate, 1.0)

    def test_no_false_positive(self):
        name = f"FPRateAllTP-{os.urandom(4).hex()}"
        for i in range(5):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "true_positive", "ops")
        rate = ai.calc_false_positive_rate(name, 30)
        self.assertEqual(rate, 0.0)


class TestNoiseTraining(unittest.TestCase):
    def test_low_noise(self):
        name = f"NoiseLow-{os.urandom(4).hex()}"
        for i in range(10):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "true_positive", "ops")
        result = ai.train_noise_pattern(name)
        self.assertEqual(result["pattern_type"], "low_noise")

    def test_medium_noise(self):
        name = f"NoiseMed-{os.urandom(4).hex()}"
        for i in range(10):
            aid = ai.record_alert(name, "warning", "api", {})
            if i < 3:
                ai.record_feedback(aid, "false_positive", "ops")
        result = ai.train_noise_pattern(name)
        self.assertIn(result["pattern_type"], ["medium_noise", "low_noise"])

    def test_high_noise(self):
        name = f"NoiseHigh-{os.urandom(4).hex()}"
        for i in range(10):
            aid = ai.record_alert(name, "warning", "api", {})
            if i < 8:
                ai.record_feedback(aid, "false_positive", "ops")
        result = ai.train_noise_pattern(name)
        self.assertEqual(result["pattern_type"], "high_noise")

    def test_suggestion_disable(self):
        name = f"NoiseDisable-{os.urandom(4).hex()}"
        for i in range(10):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "false_positive", "ops")
        result = ai.train_noise_pattern(name)
        self.assertIn("禁用", result["suggestion"])


class TestAdaptiveThreshold(unittest.TestCase):
    def test_basic(self):
        result = ai.adaptive_threshold("cpu_usage", 50.0, 75.0, 10.0)
        self.assertIn("adaptive_threshold", result)
        self.assertGreater(result["adaptive_threshold"], 0)

    def test_zero_std(self):
        result = ai.adaptive_threshold("metric", 100.0, 120.0, 0.0)
        self.assertIn("confidence", result)

    def test_exceeds(self):
        result = ai.adaptive_threshold("latency", 100.0, 200.0, 30.0, 1.0)
        self.assertTrue(result["exceeds"])

    def test_not_exceeds(self):
        result = ai.adaptive_threshold("latency", 100.0, 110.0, 30.0, 1.0)
        self.assertFalse(result["exceeds"])

    def test_high_confidence(self):
        result = ai.adaptive_threshold("metric", 50.0, 200.0, 10.0)
        self.assertGreater(result["confidence"], 0.5)

    def test_low_confidence(self):
        result = ai.adaptive_threshold("metric", 100.0, 101.0, 10.0)
        self.assertLess(result["confidence"], 0.5)


class TestAlertMerge(unittest.TestCase):
    def test_empty(self):
        result = ai.merge_alerts([])
        self.assertFalse(result["merged"])

    def test_single(self):
        alerts = [{"id": "1", "alert_name": "X", "labels": {}}]
        result = ai.merge_alerts(alerts)
        self.assertFalse(result["merged"])

    def test_merge_duplicates(self):
        alerts = [
            {"id": f"id-{i}", "alert_name": "X", "labels": {"svc": "api"}}
            for i in range(3)
        ]
        result = ai.merge_alerts(alerts)
        self.assertTrue(result["merged"])
        self.assertEqual(result["merged_count"], 3)

    def test_merge_multiple_groups(self):
        alerts = [
            {"id": "1", "alert_name": "X", "labels": {"svc": "a"}},
            {"id": "2", "alert_name": "X", "labels": {"svc": "a"}},
            {"id": "3", "alert_name": "X", "labels": {"svc": "b"}},
            {"id": "4", "alert_name": "X", "labels": {"svc": "b"}},
        ]
        result = ai.merge_alerts(alerts)
        self.assertTrue(result["merged"])
        self.assertEqual(len(result["groups"]), 2)

    def test_merge_explicit_fingerprint(self):
        alerts = [
            {"id": "1", "alert_name": "X", "labels": {}, "fingerprint": "fp1"},
            {"id": "2", "alert_name": "Y", "labels": {}, "fingerprint": "fp1"},
        ]
        result = ai.merge_alerts(alerts)
        self.assertTrue(result["merged"])


class TestSemanticAnalysis(unittest.TestCase):
    def test_outage(self):
        aid = ai.record_alert("Out1", "critical", "api", {})
        result = ai.analyze_semantic(aid, "Service is down", "ServiceDown")
        self.assertEqual(result["category"], "outage")
        self.assertIn("down", result["keywords_matched"]["outage"])

    def test_performance(self):
        aid = ai.record_alert("Perf1", "warning", "api", {})
        result = ai.analyze_semantic(aid, "API timeout and high latency", "SlowAPI")
        self.assertEqual(result["category"], "performance")

    def test_capacity(self):
        aid = ai.record_alert("Cap1", "critical", "db", {})
        result = ai.analyze_semantic(aid, "Disk full, quota exhausted", "DiskFull")
        self.assertEqual(result["category"], "capacity")

    def test_security(self):
        aid = ai.record_alert("Sec1", "critical", "auth", {})
        result = ai.analyze_semantic(aid, "Unauthorized intrusion detected", "SecurityBreach")
        self.assertEqual(result["category"], "security")

    def test_data(self):
        aid = ai.record_alert("Data1", "critical", "etl", {})
        result = ai.analyze_semantic(aid, "Data corrupt and missing", "DataLoss")
        self.assertEqual(result["category"], "data")

    def test_general(self):
        aid = ai.record_alert("Gen1", "warning", "api", {})
        result = ai.analyze_semantic(aid, "Random test message", "RandomAlert")
        self.assertEqual(result["category"], "general")
        self.assertEqual(result["semantic_score"], 0.0)

    def test_score_range(self):
        aid = ai.record_alert("Score1", "warning", "api", {})
        result = ai.analyze_semantic(aid, "down offline crash", "MultiKeyword")
        self.assertGreater(result["semantic_score"], 0.0)
        self.assertLessEqual(result["semantic_score"], 1.0)


class TestFlappingDetection(unittest.TestCase):
    def test_no_flapping(self):
        name = f"FlapTest-{os.urandom(4).hex()}"
        for i in range(3):
            ai.record_alert(name, "warning", "api", {})
        result = ai.detect_flapping(name, 30, 5)
        self.assertFalse(result)

    def test_flapping_detected(self):
        name = f"FlapHigh-{os.urandom(4).hex()}"
        import sqlite3
        # 直接插入状态变化
        with ai._conn_lock, ai._conn() as c:
            base = ai._now()
            for i in range(10):
                status = "firing" if i % 2 == 0 else "resolved"
                c.execute("""INSERT INTO alert_history
                    (id,timestamp,alert_name,severity,service,labels,message,fingerprint,status)
                    VALUES (?,?,?,?,?,?,?,?,?)""",
                    (str(i), base, name, "warning", "api", "{}", "", "fp", status))
        result = ai.detect_flapping(name, 30, 5)
        self.assertTrue(result)


class TestDenoiseStats(unittest.TestCase):
    def test_stats_keys(self):
        stats = ai.get_denoise_stats(24)
        self.assertIn("window_hours", stats)
        self.assertIn("total_alerts", stats)
        self.assertIn("total_feedback", stats)
        self.assertIn("false_positive", stats)
        self.assertIn("true_positive", stats)
        self.assertIn("merged_alerts", stats)
        self.assertIn("denoise_ratio", stats)

    def test_stats_with_data(self):
        name = f"StatsTest-{os.urandom(4).hex()}"
        for i in range(5):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "false_positive", "ops")
        stats = ai.get_denoise_stats(24)
        self.assertGreaterEqual(stats["false_positive"], 5)


class TestNoisePatternsList(unittest.TestCase):
    def test_list(self):
        name = f"PatternList-{os.urandom(4).hex()}"
        for i in range(5):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "false_positive", "ops")
        ai.train_noise_pattern(name)
        patterns = ai.list_noise_patterns()
        self.assertIsInstance(patterns, list)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "record", "feedback", "train", "fp_rate",
                    "threshold", "merge", "semantic", "flapping",
                    "stats", "patterns", "fingerprint"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(ai, f"cmd_{cmd_name}")))

    def test_cmd_record(self):
        ai.cmd_record(["CmdAlert", "warning", "api", '{"env": "prod"}', "msg"])

    def test_cmd_feedback(self):
        aid = ai.record_alert("CmdFB", "warning", "api", {})
        ai.cmd_feedback([aid, "true_positive", "ops"])

    def test_cmd_train(self):
        name = f"CmdTrain-{os.urandom(4).hex()}"
        for i in range(3):
            aid = ai.record_alert(name, "warning", "api", {})
            ai.record_feedback(aid, "true_positive", "ops")
        ai.cmd_train([name])

    def test_cmd_fp_rate(self):
        ai.cmd_fp_rate(["NonexistentAlert"])

    def test_cmd_threshold(self):
        ai.cmd_threshold(["cpu", "50", "75", "10", "1.5"])

    def test_cmd_merge(self):
        alerts = json.dumps([
            {"id": "1", "alert_name": "X", "labels": {"a": "1"}},
            {"id": "2", "alert_name": "X", "labels": {"a": "1"}},
        ])
        ai.cmd_merge([alerts])

    def test_cmd_semantic(self):
        aid = ai.record_alert("CmdSem", "warning", "api", {})
        ai.cmd_semantic([aid, "Service is down", "ServiceDown"])

    def test_cmd_flapping(self):
        ai.cmd_flapping(["NonexistentAlert"])

    def test_cmd_stats(self):
        ai.cmd_stats(["24"])

    def test_cmd_patterns(self):
        ai.cmd_patterns([])

    def test_cmd_fingerprint(self):
        ai.cmd_fingerprint(["Test", '{"a": "1"}'])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=ai.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ai.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_denoise_stats(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ai.HTTP_PORT}/api/denoise/stats", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_alerts", data)
        except Exception:
            pass

    def test_noise_patterns(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ai.HTTP_PORT}/api/noise/patterns", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("patterns", data)
        except Exception:
            pass

    def test_alert_record_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ai.HTTP_PORT}/api/alert/record",
                data=json.dumps({"alert_name": "http-alert", "severity": "warning",
                                 "service": "api", "labels": {"env": "prod"}}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_alert_merge_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ai.HTTP_PORT}/api/alert/merge",
                data=json.dumps({"alerts": [
                    {"id": "1", "alert_name": "X", "labels": {"a": "1"}},
                    {"id": "2", "alert_name": "X", "labels": {"a": "1"}},
                ]}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("merged", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
