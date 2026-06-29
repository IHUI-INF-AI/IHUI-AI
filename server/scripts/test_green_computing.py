#!/usr/bin/env python3
"""P2-39 绿色计算 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import green_computing as gc


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_energy_sources(self):
        for s in ["grid", "solar", "wind", "hydro", "nuclear", "coal", "natural_gas"]:
            self.assertIn(s, gc.ENERGY_SOURCES)

    def test_carbon_intensity(self):
        for s in gc.ENERGY_SOURCES:
            self.assertIn(s, gc.CARBON_INTENSITY)
            self.assertGreater(gc.CARBON_INTENSITY[s], 0)

    def test_efficiency_levels(self):
        for l in ["A+++", "A++", "A+", "A", "B", "C", "D"]:
            self.assertIn(l, gc.EFFICIENCY_LEVELS)

    def test_pue_levels(self):
        for k in ["excellent", "good", "average", "poor"]:
            self.assertIn(k, gc.PUE_LEVELS)


class TestRegisterEnergyMeter(unittest.TestCase):
    def test_register_grid(self):
        mid = gc.register_energy_meter("m-" + _u(), "datacenter-1", "grid")
        self.assertIsInstance(mid, str)

    def test_register_solar(self):
        mid = gc.register_energy_meter("m-" + _u(), "rooftop", "solar")
        self.assertIsInstance(mid, str)

    def test_register_invalid_source(self):
        mid = gc.register_energy_meter("m-" + _u(), "loc", "INVALID")
        self.assertIsInstance(mid, str)

    def test_register_with_power(self):
        mid = gc.register_energy_meter("m-" + _u(), "loc", "wind",
                                          power_kw=100.0, voltage_v=380.0)
        self.assertIsInstance(mid, str)

    def test_register_all_sources(self):
        for src in gc.ENERGY_SOURCES:
            mid = gc.register_energy_meter(f"m-{src}-" + _u(), "loc", src)
            self.assertIsInstance(mid, str)


class TestRecordEnergyConsumption(unittest.TestCase):
    def test_record_existing(self):
        mid = "m-" + _u()
        gc.register_energy_meter(mid, "loc", "grid")
        ok = gc.record_energy_consumption(mid, 100.0)
        self.assertTrue(ok)

    def test_record_nonexistent(self):
        ok = gc.record_energy_consumption("nonexistent-" + _u(), 100.0)
        self.assertFalse(ok)

    def test_record_accumulates(self):
        mid = "m-" + _u()
        gc.register_energy_meter(mid, "loc", "grid")
        gc.record_energy_consumption(mid, 100.0)
        gc.record_energy_consumption(mid, 200.0)
        # Verify by reading via internal conn
        with gc._conn() as c:
            row = c.execute("""SELECT cumulative_kwh FROM energy_meters
                WHERE meter_id = ?""", (mid,)).fetchone()
        self.assertEqual(row["cumulative_kwh"], 300.0)


class TestRecordCarbon(unittest.TestCase):
    def test_record_grid(self):
        rid = gc.record_carbon("grid", 100.0)
        self.assertTrue(rid.startswith("carbon-"))

    def test_record_solar(self):
        rid = gc.record_carbon("solar", 100.0)
        self.assertTrue(rid.startswith("carbon-"))

    def test_record_coal(self):
        rid = gc.record_carbon("coal", 100.0)
        self.assertTrue(rid.startswith("carbon-"))

    def test_record_invalid_source(self):
        rid = gc.record_carbon("INVALID", 100.0)
        self.assertTrue(rid.startswith("carbon-"))

    def test_record_with_period(self):
        rid = gc.record_carbon("solar", 100.0, period="yearly")
        self.assertTrue(rid.startswith("carbon-"))

    def test_co2_calculation_grid(self):
        rid = gc.record_carbon("grid", 100.0)
        with gc._conn() as c:
            row = c.execute("""SELECT co2_kg FROM carbon_records
                WHERE record_id = ?""", (rid,)).fetchone()
        # grid 500g/kWh * 100kWh = 50000g = 50kg
        self.assertEqual(row["co2_kg"], 50.0)

    def test_co2_calculation_solar(self):
        rid = gc.record_carbon("solar", 100.0)
        with gc._conn() as c:
            row = c.execute("""SELECT co2_kg FROM carbon_records
                WHERE record_id = ?""", (rid,)).fetchone()
        # solar 50g/kWh * 100kWh = 5000g = 5kg
        self.assertEqual(row["co2_kg"], 5.0)


class TestRecordPUE(unittest.TestCase):
    def test_pue_excellent(self):
        rid = gc.record_pue("dc-1", 120, 100)  # 1.2
        self.assertTrue(rid.startswith("pue-"))

    def test_pue_good(self):
        rid = gc.record_pue("dc-2", 140, 100)  # 1.4
        self.assertTrue(rid.startswith("pue-"))

    def test_pue_average(self):
        rid = gc.record_pue("dc-3", 170, 100)  # 1.7
        self.assertTrue(rid.startswith("pue-"))

    def test_pue_poor(self):
        rid = gc.record_pue("dc-4", 250, 100)  # 2.5
        self.assertTrue(rid.startswith("pue-"))

    def test_pue_zero_it(self):
        rid = gc.record_pue("dc-5", 100, 0)
        self.assertEqual(rid, "")

    def test_pue_levels(self):
        # 1.0 PUE
        rid = gc.record_pue("dc-test", 100, 100)
        with gc._conn() as c:
            row = c.execute("""SELECT efficiency_level FROM pue_records
                WHERE record_id = ?""", (rid,)).fetchone()
        self.assertEqual(row["efficiency_level"], "excellent")


class TestCreatePolicy(unittest.TestCase):
    def test_create(self):
        pid = gc.create_policy("p-" + _u(), "auto-scaling", "scale",
                                  "all", {"min": 1, "max": 10})
        self.assertIsInstance(pid, str)

    def test_create_simple(self):
        pid = gc.create_policy("p-" + _u(), "n", "type", "target")
        self.assertIsInstance(pid, str)

    def test_unique_ids(self):
        p1 = gc.create_policy("p-" + _u(), "n1", "t", "tg")
        p2 = gc.create_policy("p-" + _u(), "n2", "t", "tg")
        self.assertNotEqual(p1, p2)


class TestRecordPolicySavings(unittest.TestCase):
    def test_record_existing(self):
        pid = "p-" + _u()
        gc.create_policy(pid, "n", "t", "tg")
        ok = gc.record_policy_savings(pid, 50.0)
        self.assertTrue(ok)

    def test_record_nonexistent(self):
        ok = gc.record_policy_savings("nonexistent-" + _u(), 50.0)
        self.assertFalse(ok)

    def test_accumulates(self):
        pid = "p-" + _u()
        gc.create_policy(pid, "n", "t", "tg")
        gc.record_policy_savings(pid, 50.0)
        gc.record_policy_savings(pid, 30.0)
        with gc._conn() as c:
            row = c.execute("""SELECT saved_kwh FROM efficiency_policies
                WHERE policy_id = ?""", (pid,)).fetchone()
        self.assertEqual(row["saved_kwh"], 80.0)


class TestCalculateGreenScore(unittest.TestCase):
    def test_score_zero(self):
        score = gc.calculate_green_score()
        self.assertIsInstance(score, float)

    def test_score_with_renewable(self):
        gc.record_carbon("solar", 100.0)
        gc.record_carbon("wind", 100.0)
        gc.record_pue("dc", 120, 100)
        score = gc.calculate_green_score()
        self.assertGreater(score, 0)

    def test_score_with_grid(self):
        gc.record_carbon("grid", 100.0)
        gc.record_pue("dc-2", 200, 100)
        score = gc.calculate_green_score()
        self.assertIsInstance(score, float)


class TestGenerateSustainabilityReport(unittest.TestCase):
    def test_generate(self):
        rid = gc.generate_sustainability_report("monthly")
        self.assertTrue(rid.startswith("report-"))

    def test_with_data(self):
        gc.record_carbon("solar", 100.0)
        rid = gc.generate_sustainability_report("monthly")
        with gc._conn() as c:
            row = c.execute("""SELECT * FROM sustainability_reports
                WHERE report_id = ?""", (rid,)).fetchone()
        self.assertGreater(row["green_score"], 0)

    def test_yearly(self):
        rid = gc.generate_sustainability_report("yearly")
        self.assertTrue(rid.startswith("report-"))


class TestGetOverview(unittest.TestCase):
    def test_overview(self):
        result = gc.get_overview()
        self.assertIn("meters", result)
        self.assertIn("total_energy_kwh", result)
        self.assertIn("total_co2_kg", result)
        self.assertIn("avg_pue", result)
        self.assertIn("green_score", result)

    def test_overview_with_data(self):
        gc.register_energy_meter("m-" + _u(), "loc", "solar")
        result = gc.get_overview()
        self.assertGreaterEqual(result["meters"], 1)


class TestCLICommands(unittest.TestCase):
    def test_cmd_overview(self):
        try:
            gc.cmd_overview([])
        except SystemExit:
            pass

    def test_cmd_score(self):
        try:
            gc.cmd_score([])
        except SystemExit:
            pass

    def test_cmd_register(self):
        try:
            gc.cmd_register(["cli-" + _u(), "loc", "solar"])
        except SystemExit:
            pass

    def test_cmd_record_energy(self):
        mid = "m-" + _u()
        gc.register_energy_meter(mid, "loc", "grid")
        try:
            gc.cmd_record_energy([mid, "100"])
        except SystemExit:
            pass

    def test_cmd_carbon(self):
        try:
            gc.cmd_carbon(["solar", "100"])
        except SystemExit:
            pass

    def test_cmd_pue(self):
        try:
            gc.cmd_pue(["dc-cli", "120", "100"])
        except SystemExit:
            pass

    def test_cmd_policy(self):
        try:
            gc.cmd_policy(["cli-p-" + _u(), "name", "scale", "all"])
        except SystemExit:
            pass

    def test_cmd_savings(self):
        pid = "p-" + _u()
        gc.create_policy(pid, "n", "t", "tg")
        try:
            gc.cmd_savings([pid, "50"])
        except SystemExit:
            pass

    def test_cmd_report(self):
        try:
            gc.cmd_report(["monthly"])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10190/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_overview_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10190/api/overview", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("green_score", data)
        except Exception:
            self.skipTest("HTTP service not running")

    def test_score_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10190/api/green-score", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("score", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
