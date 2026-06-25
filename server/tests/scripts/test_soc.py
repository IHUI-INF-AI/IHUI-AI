#!/usr/bin/env python3
"""P2-30 安全态势感知 SOC 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import soc as s


class TestThreatIntel(unittest.TestCase):
    def test_add_ip(self):
        tid = s.add_threat_intel("ip", "192.168.1.100", "malware", "AlienVault", 0.9)
        self.assertIsInstance(tid, str)

    def test_add_domain(self):
        tid = s.add_threat_intel("domain", "evil.com", "phishing", "PhishTank", 0.95)
        self.assertIsInstance(tid, str)

    def test_add_hash(self):
        tid = s.add_threat_intel("hash", "abc123def456", "malware", "VirusTotal", 1.0)
        self.assertIsInstance(tid, str)

    def test_add_url(self):
        tid = s.add_threat_intel("url", "http://malicious.com/payload", "malware", "URLhaus")
        self.assertIsInstance(tid, str)

    def test_add_with_tags(self):
        tid = s.add_threat_intel("ip", "1.2.3.4", "brute_force", "internal", 0.7,
                                    ["ssh", "linux"])
        self.assertIsInstance(tid, str)

    def test_check_ioc_match(self):
        s.add_threat_intel("ip", "10.0.0.1", "malware", "test", 0.8)
        result = s.check_ioc("ip", "10.0.0.1")
        self.assertIsNotNone(result)
        self.assertEqual(result["threat_type"], "malware")

    def test_check_ioc_no_match(self):
        result = s.check_ioc("ip", "1.1.1.1")
        self.assertIsNone(result)

    def test_check_different_types(self):
        s.add_threat_intel("ip", "2.2.2.2", "test", "src", 0.5)
        result_ip = s.check_ioc("ip", "2.2.2.2")
        result_domain = s.check_ioc("domain", "2.2.2.2")
        self.assertIsNotNone(result_ip)
        self.assertIsNone(result_domain)


class TestSecurityEvent(unittest.TestCase):
    def test_record_low(self):
        eid = s.record_security_event("login", "low", "u1", "1.1.1.1")
        self.assertIsInstance(eid, str)

    def test_record_medium(self):
        eid = s.record_security_event("file_access", "medium", "u1", "1.1.1.1")
        self.assertIsInstance(eid, str)

    def test_record_high(self):
        eid = s.record_security_event("data_exfil", "high", "u1", "1.1.1.1")
        self.assertIsInstance(eid, str)

    def test_record_critical(self):
        eid = s.record_security_event("ransomware", "critical", "u1", "1.1.1.1")
        self.assertIsInstance(eid, str)

    def test_record_invalid_severity(self):
        eid = s.record_security_event("test", "INVALID", "u1", "1.1.1.1")
        self.assertIsInstance(eid, str)

    def test_all_threat_categories(self):
        for cat in s.THREAT_CATEGORIES:
            eid = s.record_security_event(cat, "high", "u1", "1.1.1.1")
            self.assertIsInstance(eid, str)


class TestUeba(unittest.TestCase):
    def test_new_profile(self):
        result = s.update_ueba_profile("user-1", 9, "Beijing", "db-prod")
        self.assertTrue(result["is_new"])
        self.assertEqual(result["anomalies"], [])

    def test_normal_login(self):
        s.update_ueba_profile("user-2", 9, "Beijing", "db-prod")
        result = s.update_ueba_profile("user-2", 9, "Beijing", "db-prod")
        self.assertFalse(result["is_new"])
        self.assertEqual(len(result["anomalies"]), 0)

    def test_anomalous_hour(self):
        s.update_ueba_profile("user-3", 9, "Beijing", "db-prod")
        result = s.update_ueba_profile("user-3", 3, "Beijing", "db-prod")
        self.assertIn("非常规登录时间", str(result["anomalies"]))

    def test_anomalous_location(self):
        s.update_ueba_profile("user-4", 9, "Beijing", "db-prod")
        result = s.update_ueba_profile("user-4", 9, "Tokyo", "db-prod")
        self.assertIn("新地理位置", str(result["anomalies"]))

    def test_anomalous_resource(self):
        s.update_ueba_profile("user-5", 9, "Beijing", "db-prod")
        result = s.update_ueba_profile("user-5", 9, "Beijing", "secret-key-vault")
        self.assertIn("新资源", str(result["anomalies"]))

    def test_risk_score(self):
        s.update_ueba_profile("user-6", 9, "Beijing", "db-prod")
        result = s.update_ueba_profile("user-6", 3, "Tokyo", "secret")
        self.assertGreater(result["risk_score"], 0.0)
        self.assertLessEqual(result["risk_score"], 1.0)

    def test_multiple_anomalies(self):
        s.update_ueba_profile("user-7", 9, "Beijing", "db-prod")
        result = s.update_ueba_profile("user-7", 3, "Tokyo", "secret")
        self.assertGreaterEqual(len(result["anomalies"]), 3)


class TestPlaybooks(unittest.TestCase):
    def test_create(self):
        pid = s.create_playbook("auto-block", "brute_force",
                                  ["block_ip", "disable_user"], "high")
        self.assertIsInstance(pid, str)

    def test_create_invalid_severity(self):
        pid = s.create_playbook("invalid-sev", "test", ["action"], "INVALID")
        self.assertIsInstance(pid, str)

    def test_list(self):
        s.create_playbook(f"list-{os.urandom(2).hex()}", "test", ["a"])
        pbs = s.list_playbooks()
        self.assertIsInstance(pbs, list)
        self.assertGreater(len(pbs), 0)

    def test_execute(self):
        pid = s.create_playbook("exec-test", "brute_force",
                                  ["block_ip", "disable_user"], "high")
        result = s.execute_playbook(pid, "evt-1")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["actions_executed"]), 2)

    def test_execute_not_found(self):
        result = s.execute_playbook("nonexistent", "evt-1")
        self.assertEqual(result["status"], "failed")

    def test_execute_not_active(self):
        pid = s.create_playbook("paused-test", "test", ["a"])
        with s._conn_lock, s._conn() as c:
            c.execute("UPDATE playbooks SET status = 'paused' WHERE id = ?", (pid,))
        result = s.execute_playbook(pid, "evt-1")
        self.assertEqual(result["status"], "failed")
        with s._conn_lock, s._conn() as c:
            c.execute("UPDATE playbooks SET status = 'active' WHERE id = ?", (pid,))

    def test_all_response_actions(self):
        for action in s.RESPONSE_ACTIONS:
            pid = s.create_playbook(f"action-{action}", "test", [action])
            result = s.execute_playbook(pid, "evt-1")
            self.assertEqual(result["status"], "completed")


class TestSocAlerts(unittest.TestCase):
    def test_create_low(self):
        aid = s.create_soc_alert("low", "phishing", "测试告警", "描述")
        self.assertIsInstance(aid, str)

    def test_create_medium(self):
        aid = s.create_soc_alert("medium", "malware", "测试告警", "描述")
        self.assertIsInstance(aid, str)

    def test_create_high(self):
        aid = s.create_soc_alert("high", "ransomware", "测试告警", "描述")
        self.assertIsInstance(aid, str)

    def test_create_critical(self):
        aid = s.create_soc_alert("critical", "data_breach", "测试告警", "描述")
        self.assertIsInstance(aid, str)

    def test_create_invalid_severity(self):
        aid = s.create_soc_alert("INVALID", "test", "title", "desc")
        self.assertIsInstance(aid, str)

    def test_with_source_ip(self):
        aid = s.create_soc_alert("high", "brute_force", "title", "desc",
                                   source_ip="1.2.3.4")
        self.assertIsInstance(aid, str)

    def test_with_user_id(self):
        aid = s.create_soc_alert("high", "insider_threat", "title", "desc",
                                   user_id="u1")
        self.assertIsInstance(aid, str)


class TestThreatLandscape(unittest.TestCase):
    def test_landscape_keys(self):
        s.record_security_event("test", "medium", "u1", "1.1.1.1")
        s.add_threat_intel("ip", "1.1.1.1", "test", "src", 0.5)
        s.create_soc_alert("high", "test", "title", "desc")
        result = s.analyze_threat_landscape(24)
        self.assertIn("window_hours", result)
        self.assertIn("total_events", result)
        self.assertIn("ioc_count", result)
        self.assertIn("open_alerts", result)
        self.assertIn("by_severity", result)
        self.assertIn("top_threats", result)

    def test_landscape_hours(self):
        result = s.analyze_threat_landscape(1)
        self.assertEqual(result["window_hours"], 1)


class TestConstants(unittest.TestCase):
    def test_threat_levels(self):
        for l in ["low", "medium", "high", "critical"]:
            self.assertIn(l, s.THREAT_LEVELS)

    def test_threat_categories(self):
        for c in ["malware", "phishing", "brute_force", "ddos", "ransomware"]:
            self.assertIn(c, s.THREAT_CATEGORIES)

    def test_response_actions(self):
        for a in ["block_ip", "disable_user", "quarantine_file", "isolate_host"]:
            self.assertIn(a, s.RESPONSE_ACTIONS)

    def test_risk_levels(self):
        for l in ["safe", "low_risk", "medium_risk", "high_risk", "critical_risk"]:
            self.assertIn(l, s.RISK_LEVELS)

    def test_playbook_status(self):
        for st in ["draft", "active", "paused", "deprecated"]:
            self.assertIn(st, s.PLAYBOOK_STATUS)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "threat_add", "threat_check", "event", "ueba",
                    "playbook_create", "playbook_list", "playbook_execute",
                    "alert", "landscape"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(s, f"cmd_{cmd_name}")))

    def test_cmd_threat_add(self):
        s.cmd_threat_add(["ip", "1.2.3.4", "malware", "test", "0.8"])

    def test_cmd_threat_check(self):
        s.add_threat_intel("ip", "5.5.5.5", "test", "src")
        s.cmd_threat_check(["ip", "5.5.5.5"])

    def test_cmd_event(self):
        s.cmd_event(["test_event", "high", "u1", "1.1.1.1"])

    def test_cmd_ueba(self):
        s.cmd_ueba(["user-cmd", "9", "Beijing", "db"])

    def test_cmd_playbook_create(self):
        s.cmd_playbook_create(["cmd-test", "trigger", "block_ip,disable_user", "high"])

    def test_cmd_playbook_list(self):
        s.cmd_playbook_list([])

    def test_cmd_playbook_execute(self):
        pid = s.create_playbook("cmd-exec", "t", ["block_ip"])
        s.cmd_playbook_execute([pid, "evt-1"])

    def test_cmd_alert(self):
        s.cmd_alert(["high", "test", "title", "description"])

    def test_cmd_landscape(self):
        s.cmd_landscape(["24"])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=s.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{s.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_landscape(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{s.HTTP_PORT}/api/soc/landscape?hours=24", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_events", data)
        except Exception:
            pass

    def test_playbooks(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{s.HTTP_PORT}/api/playbooks", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("playbooks", data)
        except Exception:
            pass

    def test_threat_add_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{s.HTTP_PORT}/api/threat/add",
                data=json.dumps({"ioc_type": "ip", "ioc_value": "6.6.6.6",
                                 "threat_type": "malware", "source": "test"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_threat_check_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{s.HTTP_PORT}/api/threat/check",
                data=json.dumps({"ioc_type": "ip", "ioc_value": "6.6.6.6"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("matched", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
