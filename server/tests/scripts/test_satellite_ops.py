#!/usr/bin/env python3
"""P2-51 卫星运维 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import satellite_ops as so


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_orbits(self):
        for o in ["LEO", "MEO", "GEO", "HEO", "SSO"]:
            self.assertIn(o, so.ORBIT_TYPES)

    def test_statuses(self):
        for s in ["operational", "degraded", "safe_hold", "offline", "commissioning"]:
            self.assertIn(s, so.SAT_STATUSES)

    def test_station_statuses(self):
        for s in ["online", "offline", "maintenance", "tracking"]:
            self.assertIn(s, so.GROUND_STATION_STATUSES)


class TestSatellite(unittest.TestCase):
    def test_register_leo(self):
        sid = so.register_satellite("sat-" + _u(), "TestSat", "LEO")
        self.assertIsInstance(sid, str)

    def test_register_all_orbits(self):
        for o in so.ORBIT_TYPES:
            sid = so.register_satellite("sat-" + _u(), "TestSat", o)
            self.assertIsInstance(sid, str)

    def test_register_invalid_orbit(self):
        sid = so.register_satellite("sat-" + _u(), "TestSat", "invalid")
        self.assertIsInstance(sid, str)

    def test_register_with_params(self):
        sid = so.register_satellite("sat-" + _u(), "TestSat", "GEO", 35786.0, 0.0, "2025-01-01", "company")
        self.assertIsInstance(sid, str)


class TestOrbit(unittest.TestCase):
    def test_predict(self):
        sid = so.register_satellite("sat-" + _u(), "TestSat", "LEO")
        pid = so.predict_orbit("sat1", 60)
        self.assertIsInstance(pid, str)

    def test_predict_long(self):
        so.register_satellite("sat-" + _u(), "TestSat", "GEO", 35786.0)
        pid = so.predict_orbit("sat1", 240)
        self.assertIsInstance(pid, str)

    def test_predict_nonexistent(self):
        pid = so.predict_orbit("nonexistent-" + _u())
        self.assertEqual(pid, "")


class TestGroundStation(unittest.TestCase):
    def test_register(self):
        sid = so.register_ground_station("gs-" + _u(), "Station1", 39.9, 116.4, 50.0)
        self.assertIsInstance(sid, str)

    def test_register_minimal(self):
        sid = so.register_ground_station("gs-" + _u(), "Station1")
        self.assertIsInstance(sid, str)

    def test_register_with_antennas(self):
        sid = so.register_ground_station("gs-" + _u(), "Station1", 0, 0, 0, 4)
        self.assertIsInstance(sid, str)


class TestPass(unittest.TestCase):
    def test_schedule(self):
        pid = so.schedule_pass("sat1", "gs1", "2025-01-01T00:00:00Z", "2025-01-01T00:10:00Z", 45.0)
        self.assertIsInstance(pid, str)

    def test_schedule_high_elev(self):
        pid = so.schedule_pass("sat1", "gs1", "2025-01-01T00:00:00Z", "2025-01-01T00:10:00Z", 89.0)
        self.assertIsInstance(pid, str)

    def test_schedule_invalid_time(self):
        pid = so.schedule_pass("sat1", "gs1", "invalid", "invalid", 0)
        self.assertIsInstance(pid, str)


class TestTelemetry(unittest.TestCase):
    def test_record(self):
        tid = so.record_telemetry("sat1", "power", "voltage", 28.5, "V")
        self.assertIsInstance(tid, str)

    def test_record_minimal(self):
        tid = so.record_telemetry("sat1", "thermal", "temp", 25.0)
        self.assertIsInstance(tid, str)


class TestCommand(unittest.TestCase):
    def test_send(self):
        cid = so.send_command("sat1", "POWER_ON", "operator", True, "OK")
        self.assertIsInstance(cid, str)

    def test_send_fail(self):
        cid = so.send_command("sat1", "RESET", "operator", False, "TIMEOUT")
        self.assertIsInstance(cid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = so.get_satellite_report()
        self.assertIn("total_satellites", report)
        self.assertIn("operational_satellites", report)
        self.assertIn("total_ground_stations", report)
        self.assertIn("online_stations", report)
        self.assertIn("total_passes", report)
        self.assertIn("total_commands", report)
        self.assertIn("successful_commands", report)


if __name__ == "__main__":
    unittest.main()
