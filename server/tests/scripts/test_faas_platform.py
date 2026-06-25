#!/usr/bin/env python3
"""P1-49 Serverless FaaS 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import faas_platform as fp


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_runtimes(self):
        for r in ["python3", "nodejs18", "go120", "java17", "ruby31"]:
            self.assertIn(r, fp.RUNTIMES)

    def test_triggers(self):
        for t in ["http", "schedule", "queue", "event", "manual"]:
            self.assertIn(t, fp.TRIGGERS)

    def test_statuses(self):
        for s in ["success", "error", "timeout", "throttled"]:
            self.assertIn(s, fp.INVOCATION_STATUSES)


class TestFunction(unittest.TestCase):
    def test_register_python(self):
        fid = fp.register_function("fn-" + _u(), "python3")
        self.assertIsInstance(fid, str)

    def test_register_all_runtimes(self):
        for r in fp.RUNTIMES:
            fid = fp.register_function("fn-" + _u(), r)
            self.assertIsInstance(fid, str)

    def test_register_invalid(self):
        fid = fp.register_function("fn-" + _u(), "invalid")
        self.assertIsInstance(fid, str)

    def test_register_with_env(self):
        fid = fp.register_function("fn-" + _u(), "python3", env_vars={"KEY": "value"})
        self.assertIsInstance(fid, str)

    def test_register_with_memory(self):
        fid = fp.register_function("fn-" + _u(), "python3", memory_mb=512)
        self.assertIsInstance(fid, str)

    def test_update_status(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        ok = fp.update_function_status(name, "inactive")
        self.assertTrue(ok)

    def test_update_with_version(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        ok = fp.update_function_status(name, "active", "2.0.0")
        self.assertTrue(ok)

    def test_update_invalid_status(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        ok = fp.update_function_status(name, "invalid")
        self.assertTrue(ok)


class TestTrigger(unittest.TestCase):
    def test_create_http(self):
        tid = fp.create_trigger("trig-" + _u(), "fn-a", "http")
        self.assertIsInstance(tid, str)

    def test_create_schedule(self):
        tid = fp.create_trigger("trig-" + _u(), "fn-a", "schedule")
        self.assertIsInstance(tid, str)

    def test_create_queue(self):
        tid = fp.create_trigger("trig-" + _u(), "fn-a", "queue")
        self.assertIsInstance(tid, str)

    def test_create_invalid(self):
        tid = fp.create_trigger("trig-" + _u(), "fn-a", "invalid")
        self.assertIsInstance(tid, str)


class TestInvoke(unittest.TestCase):
    def test_invoke_existing(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        result = fp.invoke_function(name, "http")
        self.assertEqual(result["status"], "success")

    def test_invoke_cold_start(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        result = fp.invoke_function(name, "http")
        self.assertTrue(result["cold_start"])

    def test_invoke_warm(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        fp.warm_instance(name)
        result = fp.invoke_function(name, "http")
        self.assertFalse(result["cold_start"])

    def test_invoke_nonexistent(self):
        result = fp.invoke_function("fn-none-" + _u())
        self.assertEqual(result["status"], "error")

    def test_invoke_with_payload(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        result = fp.invoke_function(name, "http", {"key": "value"})
        self.assertIn("duration_ms", result)


class TestWarm(unittest.TestCase):
    def test_warm(self):
        iid = fp.warm_instance("fn-" + _u())
        self.assertIsInstance(iid, str)


class TestQuota(unittest.TestCase):
    def test_set(self):
        qid = fp.set_quota("tenant-" + _u())
        self.assertIsInstance(qid, str)

    def test_set_custom(self):
        qid = fp.set_quota("tenant-" + _u(), 500, 50, 5120)
        self.assertIsInstance(qid, str)


class TestDeploy(unittest.TestCase):
    def test_deploy(self):
        name = "fn-" + _u()
        fp.register_function(name, "python3")
        did = fp.deploy_function(name, "2.0.0", "admin")
        self.assertIsInstance(did, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = fp.get_faas_report()
        self.assertIn("total_functions", report)
        self.assertIn("active_functions", report)
        self.assertIn("total_invocations", report)
        self.assertIn("cold_start_rate_pct", report)
        self.assertIn("avg_duration_ms", report)
        self.assertIn("active_triggers", report)
        self.assertIn("warm_instances", report)


if __name__ == "__main__":
    unittest.main()
