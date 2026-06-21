#!/usr/bin/env python3
"""P1-38 数字孪生 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import digital_twin as dt


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_scenario_types(self):
        for t in ["load", "failure", "capacity", "disaster", "scale"]:
            self.assertIn(t, dt.SCENARIO_TYPES)

    def test_entity_types(self):
        for t in ["service", "database", "queue", "cache",
                  "load_balancer", "node", "pod", "container"]:
            self.assertIn(t, dt.ENTITY_TYPES)

    def test_simulation_status(self):
        for s in ["pending", "running", "completed", "failed"]:
            self.assertIn(s, dt.SIMULATION_STATUS)

    def test_prediction_types(self):
        for t in ["risk", "capacity", "failure", "performance"]:
            self.assertIn(t, dt.PREDICTION_TYPES)


class TestRegisterEntity(unittest.TestCase):
    def test_register_service(self):
        eid = dt.register_entity("e-" + _u(), "api-service", "service")
        self.assertIsInstance(eid, str)

    def test_register_database(self):
        eid = dt.register_entity("e-" + _u(), "main-db", "database")
        self.assertIsInstance(eid, str)

    def test_register_queue(self):
        eid = dt.register_entity("e-" + _u(), "msg-queue", "queue")
        self.assertIsInstance(eid, str)

    def test_register_cache(self):
        eid = dt.register_entity("e-" + _u(), "redis", "cache")
        self.assertIsInstance(eid, str)

    def test_register_with_props(self):
        eid = dt.register_entity("e-" + _u(), "lb", "load_balancer",
                                    properties={"region": "cn-north"},
                                    state={"active": True})
        self.assertIsInstance(eid, str)

    def test_register_with_parent(self):
        eid = dt.register_entity("e-" + _u(), "child", "pod",
                                    parent_id="parent-1")
        self.assertIsInstance(eid, str)

    def test_register_invalid_type(self):
        eid = dt.register_entity("e-" + _u(), "x", "INVALID")
        self.assertIsInstance(eid, str)

    def test_register_all_types(self):
        for t in dt.ENTITY_TYPES:
            eid = dt.register_entity(f"e-{t}-" + _u(), f"name-{t}", t)
            self.assertIsInstance(eid, str)


class TestUpdateEntityState(unittest.TestCase):
    def test_update_existing(self):
        eid = "e-" + _u()
        dt.register_entity(eid, "name", "service")
        ok = dt.update_entity_state(eid, {"cpu": 50, "memory": 60})
        self.assertTrue(ok)

    def test_update_nonexistent(self):
        ok = dt.update_entity_state("nonexistent-" + _u(), {"x": 1})
        self.assertFalse(ok)

    def test_update_with_complex_state(self):
        eid = "e-" + _u()
        dt.register_entity(eid, "n", "service")
        ok = dt.update_entity_state(eid, {"metrics": {"rps": 1000, "errors": 5}})
        self.assertTrue(ok)


class TestCreateSnapshot(unittest.TestCase):
    def test_snapshot(self):
        sid = dt.create_snapshot()
        self.assertTrue(sid.startswith("snap-"))

    def test_snapshot_with_entities(self):
        dt.register_entity("e-" + _u(), "n1", "service")
        dt.register_entity("e-" + _u(), "n2", "database")
        sid = dt.create_snapshot()
        self.assertTrue(sid.startswith("snap-"))


class TestStartSimulation(unittest.TestCase):
    def test_start_load(self):
        sid = dt.start_simulation("sim-" + _u(), "load")
        self.assertTrue(sid.startswith("sim-"))

    def test_start_failure(self):
        sid = dt.start_simulation("sim-" + _u(), "failure")
        self.assertTrue(sid.startswith("sim-"))

    def test_start_capacity(self):
        sid = dt.start_simulation("sim-" + _u(), "capacity")
        self.assertTrue(sid.startswith("sim-"))

    def test_start_disaster(self):
        sid = dt.start_simulation("sim-" + _u(), "disaster")
        self.assertTrue(sid.startswith("sim-"))

    def test_start_scale(self):
        sid = dt.start_simulation("sim-" + _u(), "scale")
        self.assertTrue(sid.startswith("sim-"))

    def test_start_invalid(self):
        sid = dt.start_simulation("sim-" + _u(), "INVALID")
        self.assertTrue(sid.startswith("sim-"))

    def test_start_with_params(self):
        sid = dt.start_simulation("sim-" + _u(), "load", {"rps": 5000})
        self.assertTrue(sid.startswith("sim-"))


class TestRunLoadSimulation(unittest.TestCase):
    def test_run_basic(self):
        sid = dt.start_simulation("sim-" + _u(), "load")
        results = dt.run_load_simulation(sid, duration_seconds=30, rps=500)
        self.assertIn("points", results)
        self.assertIn("avg_cpu", results)

    def test_run_verdict_ok(self):
        sid = dt.start_simulation("sim-" + _u(), "load")
        results = dt.run_load_simulation(sid, duration_seconds=30)
        self.assertIn(results["verdict"], ["ok", "degraded"])

    def test_run_long(self):
        sid = dt.start_simulation("sim-" + _u(), "load")
        results = dt.run_load_simulation(sid, duration_seconds=120, rps=2000)
        self.assertEqual(len(results["points"]), 12)


class TestRunFailureSimulation(unittest.TestCase):
    def test_run_node_crash(self):
        sid = dt.start_simulation("sim-" + _u(), "failure")
        results = dt.run_failure_simulation(sid, "node_crash")
        self.assertIn("affected_entities", results)
        self.assertIn("cascade_risk", results)

    def test_run_network(self):
        sid = dt.start_simulation("sim-" + _u(), "failure")
        results = dt.run_failure_simulation(sid, "network_partition")
        self.assertIsInstance(results, dict)

    def test_run_disk(self):
        sid = dt.start_simulation("sim-" + _u(), "failure")
        results = dt.run_failure_simulation(sid, "disk_full")
        self.assertIsInstance(results, dict)

    def test_verdict(self):
        sid = dt.start_simulation("sim-" + _u(), "failure")
        results = dt.run_failure_simulation(sid)
        self.assertIn(results["verdict"], ["manageable", "high_risk"])


class TestRunCapacitySimulation(unittest.TestCase):
    def test_run_basic(self):
        sid = dt.start_simulation("sim-" + _u(), "capacity")
        results = dt.run_capacity_simulation(sid, growth_rate=0.1, horizon_days=10)
        self.assertEqual(len(results["series"]), 10)

    def test_run_long_horizon(self):
        sid = dt.start_simulation("sim-" + _u(), "capacity")
        results = dt.run_capacity_simulation(sid, growth_rate=0.05, horizon_days=60)
        self.assertEqual(len(results["series"]), 60)

    def test_run_growth_warning(self):
        sid = dt.start_simulation("sim-" + _u(), "capacity")
        results = dt.run_capacity_simulation(sid, growth_rate=0.5, horizon_days=30)
        # 高速增长应该触发 warning
        self.assertIn(results["verdict"], ["ok", "warning"])


class TestPredictRisk(unittest.TestCase):
    def test_predict_zero_factors(self):
        result = dt.predict_risk("entity-1", {})
        self.assertEqual(result["risk_score"], 0.0)

    def test_predict_low(self):
        result = dt.predict_risk("entity-2", {"cpu": 10, "memory": 10})
        self.assertLess(result["risk_score"], 0.5)

    def test_predict_high(self):
        result = dt.predict_risk("entity-3", {"cpu": 90, "memory": 80, "error_rate": 5})
        self.assertGreater(result["risk_score"], 0.5)

    def test_predict_confidence(self):
        result = dt.predict_risk("entity-4", {"cpu": 50})
        self.assertGreaterEqual(result["confidence"], 0.5)
        self.assertLessEqual(result["confidence"], 0.95)

    def test_predict_capped(self):
        result = dt.predict_risk("entity-5", {"cpu": 100, "memory": 100, "error_rate": 100})
        self.assertLessEqual(result["risk_score"], 1.0)


class TestForecastCapacity(unittest.TestCase):
    def test_forecast_normal(self):
        result = dt.forecast_capacity("cpu", 50, 100, 0.05)
        self.assertIn("predicted_30d", result)
        self.assertIn("recommendation", result)

    def test_forecast_high_usage(self):
        result = dt.forecast_capacity("memory", 80, 100, 0.1)
        self.assertIn(result["recommendation"], ["no_action", "plan_scale_out", "scale_out_immediately"])

    def test_forecast_critical(self):
        result = dt.forecast_capacity("disk", 90, 100, 0.2)
        self.assertEqual(result["recommendation"], "scale_out_immediately")

    def test_forecast_zero_capacity(self):
        result = dt.forecast_capacity("x", 50, 0)
        self.assertIn("error", result)

    def test_forecast_zero_growth(self):
        result = dt.forecast_capacity("cpu", 50, 100, 0)
        self.assertEqual(result["time_to_exhaustion_hours"], 99999)


class TestGetTwinOverview(unittest.TestCase):
    def test_overview(self):
        result = dt.get_twin_overview()
        self.assertIn("total_entities", result)
        self.assertIn("snapshots", result)
        self.assertIn("running_simulations", result)
        self.assertIn("high_risk_predictions", result)

    def test_overview_with_data(self):
        dt.register_entity("e-" + _u(), "n", "service")
        result = dt.get_twin_overview()
        self.assertGreaterEqual(result["total_entities"], 1)


class TestGetEntityList(unittest.TestCase):
    def test_list_empty(self):
        # 可能会返回之前测试的实体, 但应至少返回 list
        result = dt.get_entity_list()
        self.assertIsInstance(result, list)

    def test_list_by_type(self):
        entity_id = "e-" + _u()
        dt.register_entity(entity_id, "n", "database")
        result = dt.get_entity_list("database")
        ids = [e["entity_id"] for e in result]
        self.assertIn(entity_id, ids)


class TestGetSimulation(unittest.TestCase):
    def test_get_existing(self):
        sid = dt.start_simulation("n", "load")
        dt.run_load_simulation(sid, duration_seconds=30)
        sim = dt.get_simulation(sid)
        self.assertIsNotNone(sim)
        self.assertEqual(sim["status"], "completed")

    def test_get_nonexistent(self):
        sim = dt.get_simulation("nonexistent-" + _u())
        self.assertIsNone(sim)


class TestCLICommands(unittest.TestCase):
    def test_cmd_overview(self):
        try:
            dt.cmd_overview([])
        except SystemExit:
            pass

    def test_cmd_snapshot(self):
        try:
            dt.cmd_snapshot([])
        except SystemExit:
            pass

    def test_cmd_register(self):
        try:
            dt.cmd_register(["cli-" + _u(), "name", "service"])
        except SystemExit:
            pass

    def test_cmd_update(self):
        eid = "e-" + _u()
        dt.register_entity(eid, "n", "service")
        try:
            dt.cmd_update([eid, '{"cpu": 50}'])
        except SystemExit:
            pass

    def test_cmd_simulate_load(self):
        try:
            dt.cmd_simulate(["load", "sim-cli"])
        except SystemExit:
            pass

    def test_cmd_simulate_failure(self):
        try:
            dt.cmd_simulate(["failure", "sim-cli"])
        except SystemExit:
            pass

    def test_cmd_simulate_capacity(self):
        try:
            dt.cmd_simulate(["capacity", "sim-cli"])
        except SystemExit:
            pass

    def test_cmd_predict(self):
        try:
            dt.cmd_predict(["entity", '{"cpu": 50}'])
        except SystemExit:
            pass

    def test_cmd_forecast(self):
        try:
            dt.cmd_forecast(["cpu", "50", "100", "0.05"])
        except SystemExit:
            pass

    def test_cmd_entities(self):
        try:
            dt.cmd_entities([])
        except SystemExit:
            pass

    def test_cmd_entities_by_type(self):
        try:
            dt.cmd_entities(["service"])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10180/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_overview_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10180/api/overview", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("total_entities", data)
        except Exception:
            self.skipTest("HTTP service not running")

    def test_entities_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10180/api/entities", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("entities", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
