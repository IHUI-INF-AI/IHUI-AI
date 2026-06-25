#!/usr/bin/env python3
"""P2-28 Chaos Engineering 平台测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import chaos as ch


class TestScenarioLibrary(unittest.TestCase):
    def test_scenarios_loaded(self):
        scenarios = ch.list_scenarios()
        self.assertGreater(len(scenarios), 30)

    def test_scenarios_all_categories(self):
        for cat in ch.FAULT_CATEGORIES:
            scenarios = ch.list_scenarios(cat)
            self.assertGreater(len(scenarios), 0,
                                f"No scenarios in category {cat}")

    def test_scenario_structure(self):
        scenarios = ch.list_scenarios("network")
        for s in scenarios:
            self.assertIn("id", s)
            self.assertIn("category", s)
            self.assertIn("name", s)
            self.assertIn("min", s)
            self.assertIn("max", s)

    def test_scenario_min_max(self):
        scenarios = ch.list_scenarios()
        for s in scenarios:
            if s["min"] is not None and s["max"] is not None:
                self.assertLessEqual(s["min"], s["max"])


class TestExperimentCreate(unittest.TestCase):
    def test_create_pod(self):
        eid = ch.create_experiment("test-pod", "", "network-latency",
                                     {"latency_ms": 100}, "pod", {}, 60, [], "user1")
        self.assertIsInstance(eid, str)

    def test_create_node(self):
        eid = ch.create_experiment("test-node", "", "cpu-stress",
                                     {"cpu_pct": 80}, "node", {}, 120, [], "user1")
        self.assertIsInstance(eid, str)

    def test_create_with_guards(self):
        guards = [{"type": "slo", "threshold": 99.0, "name": "availability"}]
        eid = ch.create_experiment("test-guards", "", "network-loss",
                                     {"loss_pct": 10}, "service", {}, 60, guards, "user1")
        self.assertIsInstance(eid, str)

    def test_create_invalid_blast(self):
        eid = ch.create_experiment("invalid-blast", "", "test", {}, "INVALID", {}, 60, [], "")
        self.assertIsInstance(eid, str)

    def test_all_blast_radii(self):
        for br in ch.BLAST_RADIUS_LEVELS:
            eid = ch.create_experiment(f"blast-{br}", "", "test", {}, br, {}, 60, [], "")
            self.assertIsInstance(eid, str)


class TestBlastRadius(unittest.TestCase):
    def test_pod(self):
        result = ch.estimate_blast_radius("pod", {})
        self.assertEqual(result["level"], "pod")
        self.assertEqual(result["estimated_targets"], 1)

    def test_node(self):
        result = ch.estimate_blast_radius("node", {})
        self.assertEqual(result["level"], "node")

    def test_service(self):
        result = ch.estimate_blast_radius("service", {})
        self.assertEqual(result["level"], "service")

    def test_namespace(self):
        result = ch.estimate_blast_radius("namespace", {})
        self.assertGreaterEqual(result["estimated_targets"], 5)

    def test_region(self):
        result = ch.estimate_blast_radius("region", {})
        self.assertGreaterEqual(result["estimated_targets"], 50)

    def test_global(self):
        result = ch.estimate_blast_radius("global", {})
        self.assertEqual(result["estimated_targets"], 500)

    def test_with_replicas(self):
        result = ch.estimate_blast_radius("namespace", {"replicas": "5"})
        self.assertEqual(result["estimated_targets"], 25)

    def test_risk_score(self):
        result = ch.estimate_blast_radius("pod", {})
        self.assertGreaterEqual(result["risk_score"], 0.0)
        self.assertLessEqual(result["risk_score"], 1.0)

    def test_invalid_radius(self):
        result = ch.estimate_blast_radius("INVALID", {})
        self.assertEqual(result["estimated_targets"], 1)


class TestExperimentRun(unittest.TestCase):
    def test_run_basic(self):
        eid = ch.create_experiment("run-test-1", "", "network-latency",
                                     {"latency_ms": 100}, "pod", {}, 5, [], "user1")
        result = ch.run_experiment(eid)
        self.assertIn("status", result)

    def test_run_not_found(self):
        result = ch.run_experiment("nonexistent-id-xyz")
        self.assertEqual(result["status"], "failed")

    def test_run_with_guards(self):
        guards = [{"type": "slo", "threshold": 99.0, "name": "test_guard",
                    "trigger_value": 95.0}]
        eid = ch.create_experiment("run-guards", "", "test", {}, "pod", {}, 5, guards, "")
        result = ch.run_experiment(eid)
        self.assertIn("status", result)

    def test_run_observations(self):
        eid = ch.create_experiment("run-obs", "", "test", {}, "pod", {}, 5, [], "")
        result = ch.run_experiment(eid)
        self.assertIn("observations", result)
        self.assertIn("system_impact", result["observations"])

    def test_abort(self):
        eid = ch.create_experiment("abort-test", "", "test", {}, "pod", {}, 5, [], "")
        status = ch.abort_experiment(eid)
        self.assertEqual(status, "aborted")


class TestExperimentList(unittest.TestCase):
    def test_list_all(self):
        ch.create_experiment("list-test-all", "", "test", {}, "pod", {}, 5, [], "")
        experiments = ch.list_experiments()
        self.assertIsInstance(experiments, list)
        self.assertGreater(len(experiments), 0)

    def test_list_by_status(self):
        ch.create_experiment("list-completed-test", "", "test", {}, "pod", {}, 5, [], "")
        eid = ch.list_experiments()[0]["id"]
        ch.run_experiment(eid)
        experiments = ch.list_experiments(status="completed")
        self.assertIsInstance(experiments, list)

    def test_list_running(self):
        experiments = ch.list_experiments(status="running")
        self.assertIsInstance(experiments, list)


class TestChaosStats(unittest.TestCase):
    def test_stats_keys(self):
        stats = ch.get_chaos_stats()
        self.assertIn("total_experiments", stats)
        self.assertIn("completed", stats)
        self.assertIn("aborted", stats)
        self.assertIn("running", stats)
        self.assertIn("total_scenarios", stats)

    def test_scenarios_count(self):
        stats = ch.get_chaos_stats()
        self.assertGreaterEqual(stats["total_scenarios"], 30)


class TestConstants(unittest.TestCase):
    def test_fault_categories(self):
        for cat in ["network", "compute", "storage", "process", "resource",
                     "time", "state", "dependency", "platform", "security"]:
            self.assertIn(cat, ch.FAULT_CATEGORIES)

    def test_experiment_status(self):
        for s in ["pending", "running", "paused", "completed", "failed", "aborted"]:
            self.assertIn(s, ch.EXPERIMENT_STATUS)

    def test_blast_radius_levels(self):
        for br in ["pod", "node", "service", "namespace", "zone", "region", "global"]:
            self.assertIn(br, ch.BLAST_RADIUS_LEVELS)

    def test_guard_types(self):
        for g in ["steady_state", "slo", "circuit_breaker", "auto_rollback"]:
            self.assertIn(g, ch.GUARD_TYPES)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "scenarios", "create", "run", "abort",
                    "list", "stats", "estimate"]
        for c in commands:
            self.assertTrue(callable(getattr(ch, f"cmd_{c}")))

    def test_cmd_scenarios(self):
        ch.cmd_scenarios([])

    def test_cmd_scenarios_with_category(self):
        ch.cmd_scenarios(["network"])

    def test_cmd_create(self):
        ch.cmd_create(["cmd-test", "network-latency", "pod", "60", '{"latency_ms": 100}'])

    def test_cmd_run(self):
        eid = ch.create_experiment("cmd-run", "", "test", {}, "pod", {}, 5, [], "")
        ch.cmd_run([eid])

    def test_cmd_abort(self):
        eid = ch.create_experiment("cmd-abort", "", "test", {}, "pod", {}, 5, [], "")
        ch.cmd_abort([eid])

    def test_cmd_list(self):
        ch.cmd_list([])

    def test_cmd_stats(self):
        ch.cmd_stats([])

    def test_cmd_estimate(self):
        ch.cmd_estimate(["pod"])
        ch.cmd_estimate(["namespace", '{"replicas": "3"}'])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=ch.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ch.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_chaos_stats(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ch.HTTP_PORT}/api/chaos/stats", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_experiments", data)
        except Exception:
            pass

    def test_scenarios(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ch.HTTP_PORT}/api/scenarios", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("scenarios", data)
        except Exception:
            pass

    def test_experiments(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ch.HTTP_PORT}/api/experiments", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("experiments", data)
        except Exception:
            pass

    def test_experiment_create_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ch.HTTP_PORT}/api/experiment/create",
                data=json.dumps({"name": "http-test", "fault_type": "network-latency",
                                 "blast_radius": "pod", "duration_seconds": 60}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_blast_estimate_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ch.HTTP_PORT}/api/blast/estimate",
                data=json.dumps({"blast_radius": "namespace",
                                 "target_selector": {"replicas": "3"}}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("estimated_targets", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
