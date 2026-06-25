#!/usr/bin/env python3
"""P0-44 AI 容量规划 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import ai_capacity as ac


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_metrics(self):
        for m in ["cpu", "memory", "disk", "network", "qps", "latency"]:
            self.assertIn(m, ac.METRIC_TYPES)

    def test_algorithms(self):
        for a in ["linear", "exponential", "arima", "prophet", "lstm"]:
            self.assertIn(a, ac.FORECAST_ALGORITHMS)

    def test_actions(self):
        for a in ["scale_out", "scale_in", "no_action", "alert_only"]:
            self.assertIn(a, ac.SCALING_ACTIONS)


class TestMetric(unittest.TestCase):
    def test_record_cpu(self):
        mid = ac.record_metric("res-" + _u(), "cpu", 50.0)
        self.assertIsInstance(mid, str)

    def test_record_memory(self):
        mid = ac.record_metric("res-" + _u(), "memory", 70.0)
        self.assertIsInstance(mid, str)

    def test_record_invalid(self):
        mid = ac.record_metric("res-" + _u(), "invalid", 0)
        self.assertIsInstance(mid, str)


class TestPolicy(unittest.TestCase):
    def test_create_basic(self):
        pid = ac.create_policy("pol-" + _u(), "pod")
        self.assertIsInstance(pid, str)

    def test_create_with_params(self):
        pid = ac.create_policy("pol-" + _u(), "vm", 2, 50, 75.0, 85.0, 25.0)
        self.assertIsInstance(pid, str)

    def test_invalid_type(self):
        pid = ac.create_policy("pol-" + _u(), "invalid")
        self.assertIsInstance(pid, str)


class TestForecast(unittest.TestCase):
    def test_linear_no_data(self):
        fid = ac.generate_forecast("res-" + _u(), "cpu", "linear", 12)
        self.assertIsInstance(fid, str)

    def test_linear_with_data(self):
        rid = "res-" + _u()
        for i in range(20):
            ac.record_metric(rid, "cpu", float(i * 5))
        fid = ac.generate_forecast(rid, "cpu", "linear", 12)
        self.assertIsInstance(fid, str)

    def test_exponential(self):
        rid = "res-" + _u()
        for i in range(10):
            ac.record_metric(rid, "memory", 50.0 + i)
        fid = ac.generate_forecast(rid, "memory", "exponential", 6)
        self.assertIsInstance(fid, str)

    def test_get_forecast(self):
        rid = "res-" + _u()
        ac.generate_forecast(rid, "cpu", "linear", 12)
        result = ac.get_forecast(rid, "cpu")
        self.assertIsInstance(result, list)


class TestRecommend(unittest.TestCase):
    def test_scale_out(self):
        rid = "res-" + _u()
        ac.record_metric(rid, "cpu", 95.0)
        rec = ac.recommend_scaling(rid, 2)
        self.assertIsInstance(rec, str)

    def test_scale_in(self):
        rid = "res-" + _u()
        ac.record_metric(rid, "cpu", 15.0)
        rec = ac.recommend_scaling(rid, 5)
        self.assertIsInstance(rec, str)

    def test_no_action(self):
        rid = "res-" + _u()
        ac.record_metric(rid, "cpu", 50.0)
        rec = ac.recommend_scaling(rid, 3)
        self.assertIsInstance(rec, str)

    def test_no_data(self):
        rec = ac.recommend_scaling("res-empty-" + _u(), 1)
        self.assertIsInstance(rec, str)


class TestApply(unittest.TestCase):
    def test_apply(self):
        hid = ac.apply_scaling("res-" + _u(), 1, 2, "scale_out")
        self.assertIsInstance(hid, str)

    def test_apply_no_action(self):
        hid = ac.apply_scaling("res-" + _u(), 2, 2, "no_action")
        self.assertIsInstance(hid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = ac.get_capacity_report()
        self.assertIn("total_recommendations", report)
        self.assertIn("scale_out_count", report)
        self.assertIn("scale_in_count", report)
        self.assertIn("total_forecasts", report)
        self.assertIn("monitored_resources", report)


class TestRecommendations(unittest.TestCase):
    def test_get_list(self):
        recs = ac.get_recommendations(20)
        self.assertIsInstance(recs, list)


class TestInternal(unittest.TestCase):
    def test_linear_forecast_empty(self):
        result = ac._linear_forecast([], 5)
        self.assertEqual(len(result), 5)

    def test_linear_forecast_values(self):
        result = ac._linear_forecast([1, 2, 3, 4, 5], 3)
        self.assertEqual(len(result), 3)

    def test_exponential_forecast_empty(self):
        result = ac._exponential_forecast([], 5)
        self.assertEqual(len(result), 5)

    def test_exponential_forecast_values(self):
        result = ac._exponential_forecast([10, 20, 30], 3)
        self.assertEqual(len(result), 3)


if __name__ == "__main__":
    unittest.main()
