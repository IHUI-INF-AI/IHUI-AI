#!/usr/bin/env python3
"""P2-53 数字孪生城市 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import digital_twin_city as dtc


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_entities(self):
        for e in ["building", "road", "bridge", "park", "sensor", "vehicle", "citizen"]:
            self.assertIn(e, dtc.ENTITY_TYPES)

    def test_statuses(self):
        for s in ["draft", "running", "completed", "failed"]:
            self.assertIn(s, dtc.SCENARIO_STATUSES)

    def test_predictions(self):
        for p in ["traffic", "pollution", "energy", "crowd", "noise"]:
            self.assertIn(p, dtc.PREDICTION_TYPES)


class TestEntity(unittest.TestCase):
    def test_add_building(self):
        eid = dtc.add_city_entity("b-" + _u(), "building", "Tower1", 39.9, 116.4)
        self.assertIsInstance(eid, str)

    def test_add_all_types(self):
        for t in dtc.ENTITY_TYPES:
            eid = dtc.add_city_entity("e-" + _u(), t)
            self.assertIsInstance(eid, str)

    def test_invalid_type(self):
        eid = dtc.add_city_entity("e-" + _u(), "invalid")
        self.assertIsInstance(eid, str)

    def test_with_properties(self):
        eid = dtc.add_city_entity("b-" + _u(), "building", "B1", 0, 0,
                                    properties={"height": 100, "floors": 30})
        self.assertIsInstance(eid, str)


class TestScenario(unittest.TestCase):
    def test_create(self):
        sid = dtc.create_scenario("sc-" + _u())
        self.assertIsInstance(sid, str)

    def test_run(self):
        sid = dtc.create_scenario("sc-" + _u())
        result = dtc.run_scenario(sid)
        self.assertIn("metrics", result)

    def test_run_nonexistent(self):
        result = dtc.run_scenario("nonexistent-" + _u())
        self.assertIn("error", result)

    def test_with_params(self):
        sid = dtc.create_scenario("sc-" + _u(), "earthquake", 120, "admin")
        self.assertIsInstance(sid, str)


class TestSensor(unittest.TestCase):
    def test_register(self):
        sid = dtc.register_city_sensor("s-" + _u())
        self.assertIsInstance(sid, str)

    def test_register_with_entity(self):
        eid = dtc.add_city_entity("b-" + _u(), "road", "Main St", 39.9, 116.4)
        sid = dtc.register_city_sensor("s-" + _u(), "road1", "traffic", 39.9, 116.4)
        self.assertIsInstance(sid, str)

    def test_record_reading(self):
        rid = dtc.record_sensor_reading("s1", 50.5, "ppm")
        self.assertIsInstance(rid, str)


class TestPrediction(unittest.TestCase):
    def test_predict_traffic(self):
        pid = dtc.predict_city("traffic", "downtown", 24)
        self.assertIsInstance(pid, str)

    def test_predict_all(self):
        for p in dtc.PREDICTION_TYPES:
            pid = dtc.predict_city(p, "downtown", 12)
            self.assertIsInstance(pid, str)

    def test_predict_invalid(self):
        pid = dtc.predict_city("invalid")
        self.assertIsInstance(pid, str)


class TestEmergency(unittest.TestCase):
    def test_report(self):
        eid = dtc.report_emergency("fire", 39.9, 116.4, "high", 1000)
        self.assertIsInstance(eid, str)

    def test_resolve(self):
        eid = dtc.report_emergency("flood", 39.9, 116.4, "critical", 5000)
        ok = dtc.resolve_emergency(eid)
        self.assertTrue(ok)

    def test_resolve_nonexistent(self):
        ok = dtc.resolve_emergency("nonexistent-" + _u())
        self.assertFalse(ok)


class TestTraffic(unittest.TestCase):
    def test_record_low(self):
        tid = dtc.record_traffic("road1", 50, 80.0)
        self.assertIsInstance(tid, str)

    def test_record_medium(self):
        tid = dtc.record_traffic("road1", 200, 40.0)
        self.assertIsInstance(tid, str)

    def test_record_high(self):
        tid = dtc.record_traffic("road1", 500, 15.0)
        self.assertIsInstance(tid, str)

    def test_record_severe(self):
        tid = dtc.record_traffic("road1", 1000, 5.0)
        self.assertIsInstance(tid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = dtc.get_digital_twin_report()
        self.assertIn("total_entities", report)
        self.assertIn("total_sensors", report)
        self.assertIn("total_scenarios", report)
        self.assertIn("completed_scenarios", report)
        self.assertIn("total_predictions", report)
        self.assertIn("total_emergencies", report)
        self.assertIn("resolved_emergencies", report)


if __name__ == "__main__":
    unittest.main()
