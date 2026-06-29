#!/usr/bin/env python3
"""P1-48 自适应混沌工程 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import adaptive_chaos as ac


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_types(self):
        for t in ["pod_kill", "cpu_stress", "memory_stress", "network_delay",
                   "network_loss", "disk_fill", "dns_error", "process_kill"]:
            self.assertIn(t, ac.CHAOS_TYPES)

    def test_statuses(self):
        for s in ["pending", "running", "completed", "aborted", "failed"]:
            self.assertIn(s, ac.CHAOS_STATUSES)

    def test_safety_levels(self):
        for l in ["low", "medium", "high", "critical"]:
            self.assertIn(l, ac.SAFETY_LEVELS)


class TestExperiment(unittest.TestCase):
    def test_create_basic(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        self.assertIsInstance(eid, str)

    def test_create_all_types(self):
        for t in ac.CHAOS_TYPES:
            eid = ac.create_experiment("exp-" + _u(), t)
            self.assertIsInstance(eid, str)

    def test_invalid_type(self):
        eid = ac.create_experiment("exp-" + _u(), "invalid")
        self.assertIsInstance(eid, str)

    def test_invalid_safety(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill", safety_level="invalid")
        self.assertIsInstance(eid, str)

    def test_with_params(self):
        eid = ac.create_experiment("exp-" + _u(), "cpu_stress",
                                    blast_radius=25.0, duration=120)
        self.assertIsInstance(eid, str)


class TestLifecycle(unittest.TestCase):
    def test_start(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        ok = ac.start_experiment(eid)
        self.assertTrue(ok)

    def test_complete(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        ac.start_experiment(eid)
        ok = ac.complete_experiment(eid, "all checks passed")
        self.assertTrue(ok)

    def test_abort(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        ac.start_experiment(eid)
        ok = ac.abort_experiment(eid, "manual stop")
        self.assertTrue(ok)


class TestMetric(unittest.TestCase):
    def test_record(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        mid = ac.record_metric(eid, "cpu_usage", 95.0, "%")
        self.assertIsInstance(mid, str)


class TestSteadyState(unittest.TestCase):
    def test_pass(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        sid = ac.add_steady_state_check(eid, "latency", 100, 105)
        self.assertIsInstance(sid, str)

    def test_fail(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        sid = ac.add_steady_state_check(eid, "error_rate", 1.0, 50.0)
        self.assertIsInstance(sid, str)


class TestSafetyRule(unittest.TestCase):
    def test_create(self):
        rid = ac.create_safety_rule("rule-" + _u(), 50.0, ["prod-db"])
        self.assertIsInstance(rid, str)

    def test_create_default(self):
        rid = ac.create_safety_rule("rule-" + _u())
        self.assertIsInstance(rid, str)


class TestSafetyCheck(unittest.TestCase):
    def test_safe(self):
        result = ac.check_safety("svc-a", 10.0)
        self.assertIn("safe", result)
        self.assertIn("violations", result)

    def test_unsafe(self):
        ac.create_safety_rule("rule-strict-" + _u(), 20.0)
        result = ac.check_safety("svc-a", 50.0)
        self.assertIn("violations", result)


class TestRecovery(unittest.TestCase):
    def test_log(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        rid = ac.log_recovery(eid, "auto", True, 5.0, "auto restart")
        self.assertIsInstance(rid, str)

    def test_log_invalid_action(self):
        eid = ac.create_experiment("exp-" + _u(), "pod_kill")
        rid = ac.log_recovery(eid, "invalid", True)
        self.assertIsInstance(rid, str)


class TestRecommend(unittest.TestCase):
    def test_recommend_new(self):
        rid = ac.recommend_chaos("svc-new-" + _u())
        self.assertIsInstance(rid, str)

    def test_recommend_existing(self):
        svc = "svc-" + _u()
        ac.create_experiment("e1", "pod_kill", target_service=svc)
        ac.create_experiment("e2", "pod_kill", target_service=svc)
        rid = ac.recommend_chaos(svc)
        self.assertIsInstance(rid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = ac.get_chaos_report()
        self.assertIn("total_experiments", report)
        self.assertIn("completed", report)
        self.assertIn("aborted", report)
        self.assertIn("successful_recoveries", report)
        self.assertIn("steady_state_passed", report)


if __name__ == "__main__":
    unittest.main()
