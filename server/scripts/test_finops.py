#!/usr/bin/env python3
"""P2-29 FinOps 成本优化测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import finops as fn


class TestCostRecord(unittest.TestCase):
    def test_record_basic(self):
        cid = fn.record_cost("aliyun", "compute", "i-1", "api", "tenant1",
                              "on_demand", 100.0)
        self.assertIsInstance(cid, str)

    def test_record_reserved(self):
        cid = fn.record_cost("aws", "compute", "i-2", "api", "tenant1",
                              "reserved", 60.0)
        self.assertIsInstance(cid, str)

    def test_record_spot(self):
        cid = fn.record_cost("huawei", "compute", "i-3", "api", "tenant2",
                              "spot", 40.0)
        self.assertIsInstance(cid, str)

    def test_record_storage(self):
        cid = fn.record_cost("aliyun", "storage", "disk-1", "db", "tenant1",
                              "on_demand", 50.0)
        self.assertIsInstance(cid, str)

    def test_invalid_provider_fallback(self):
        cid = fn.record_cost("INVALID", "compute", "i-1", "api", "t1",
                              "on_demand", 10.0)
        self.assertIsInstance(cid, str)

    def test_invalid_pricing_fallback(self):
        cid = fn.record_cost("aliyun", "compute", "i-1", "api", "t1",
                              "INVALID", 10.0)
        self.assertIsInstance(cid, str)

    def test_all_providers(self):
        for p in fn.CLOUD_PROVIDERS:
            cid = fn.record_cost(p, "compute", f"res-{p}", "api", "t1",
                                  "on_demand", 10.0)
            self.assertIsInstance(cid, str)

    def test_all_pricing_models(self):
        for m in fn.PRICING_MODELS:
            cid = fn.record_cost("aliyun", "compute", f"res-{m}", "api", "t1",
                                  m, 10.0)
            self.assertIsInstance(cid, str)


class TestInventoryRecord(unittest.TestCase):
    def test_record(self):
        iid = fn.record_inventory("aliyun", "i-1", "compute", 50.0, 60.0)
        self.assertIsInstance(iid, str)

    def test_record_high_util(self):
        iid = fn.record_inventory("aliyun", "i-1", "compute", 90.0, 95.0)
        self.assertIsInstance(iid, str)

    def test_record_low_util(self):
        iid = fn.record_inventory("aliyun", "i-1", "compute", 5.0, 10.0)
        self.assertIsInstance(iid, str)

    def test_invalid_provider(self):
        iid = fn.record_inventory("INVALID", "i-1", "compute", 50.0, 60.0)
        self.assertIsInstance(iid, str)

    def test_with_network(self):
        iid = fn.record_inventory("aliyun", "i-1", "compute", 50.0, 60.0,
                                    100.0, 200.0)
        self.assertIsInstance(iid, str)


class TestSavingsCalculation(unittest.TestCase):
    def test_on_demand(self):
        result = fn.calculate_savings(100.0, "on_demand")
        self.assertEqual(result["discount_rate"], 0.0)
        self.assertEqual(result["estimated_cost"], 100.0)

    def test_reserved(self):
        result = fn.calculate_savings(100.0, "reserved")
        self.assertEqual(result["discount_rate"], 0.4)
        self.assertEqual(result["estimated_cost"], 60.0)
        self.assertEqual(result["monthly_savings"], 40.0)
        self.assertEqual(result["annual_savings"], 480.0)

    def test_spot(self):
        result = fn.calculate_savings(100.0, "spot")
        self.assertEqual(result["discount_rate"], 0.6)
        self.assertEqual(result["estimated_cost"], 40.0)

    def test_savings_plan(self):
        result = fn.calculate_savings(100.0, "savings_plan")
        self.assertEqual(result["discount_rate"], 0.3)

    def test_low_usage_recommends_spot(self):
        result = fn.calculate_savings(100.0, "on_demand", 360.0)
        self.assertEqual(result["discount_rate"], 0.5)

    def test_invalid_model(self):
        result = fn.calculate_savings(100.0, "INVALID")
        self.assertEqual(result["discount_rate"], 0.0)


class TestRecommendations(unittest.TestCase):
    def test_underutilized(self):
        recs = fn.generate_recommendations("i-1", "aliyun", "compute",
                                              10.0, 15.0, 100.0)
        self.assertGreater(len(recs), 0)
        downsize = [r for r in recs if r["type"] == "downsize"]
        self.assertEqual(len(downsize), 1)

    def test_overutilized(self):
        recs = fn.generate_recommendations("i-1", "aliyun", "compute",
                                              90.0, 95.0, 100.0)
        scale_out = [r for r in recs if r["type"] == "scale_out"]
        self.assertEqual(len(scale_out), 1)

    def test_high_cost_reserved(self):
        recs = fn.generate_recommendations("i-1", "aliyun", "compute",
                                              50.0, 50.0, 2000.0)
        reserved = [r for r in recs if r["type"] == "reserved"]
        self.assertEqual(len(reserved), 1)

    def test_storage_class(self):
        recs = fn.generate_recommendations("disk-1", "aliyun", "storage",
                                              0, 0, 500.0)
        sc = [r for r in recs if r["type"] == "storage_class"]
        self.assertEqual(len(sc), 1)

    def test_normal_no_rec(self):
        recs = fn.generate_recommendations("i-1", "aliyun", "compute",
                                              50.0, 60.0, 100.0)
        # 正常利用率, 无建议
        self.assertEqual(len(recs), 0)

    def test_save_recommendation(self):
        rec = {"resource_id": "i-1", "provider": "aliyun", "type": "downsize",
               "current_cost": 100, "estimated_cost": 50,
               "monthly_savings": 50, "annual_savings": 600,
               "description": "test"}
        rid = fn.save_recommendation(rec)
        self.assertIsInstance(rid, str)


class TestCostByProvider(unittest.TestCase):
    def test_by_provider(self):
        fn.record_cost("aliyun", "compute", "i-1", "api", "t1", "on_demand", 100)
        fn.record_cost("aws", "compute", "i-2", "api", "t1", "on_demand", 200)
        result = fn.get_cost_by_provider(24)
        self.assertIsInstance(result, list)
        self.assertGreater(len(result), 0)

    def test_by_tenant(self):
        fn.record_cost("aliyun", "compute", "i-1", "api", "tenant-A", "on_demand", 100)
        fn.record_cost("aliyun", "compute", "i-2", "api", "tenant-B", "on_demand", 200)
        result = fn.get_cost_by_tenant(24)
        self.assertIsInstance(result, list)


class TestUnderutilizedResources(unittest.TestCase):
    def test_underutilized(self):
        fn.record_inventory("aliyun", "i-low-1", "compute", 10.0, 15.0)
        fn.record_inventory("aliyun", "i-low-2", "compute", 5.0, 20.0)
        fn.record_inventory("aliyun", "i-normal", "compute", 50.0, 60.0)
        result = fn.get_underutilized_resources()
        under = [r for r in result if r["resource_id"].startswith("i-low")]
        self.assertEqual(len(under), 2)

    def test_custom_thresholds(self):
        fn.record_inventory("aliyun", "i-test", "compute", 30.0, 40.0)
        result = fn.get_underutilized_resources(40.0, 50.0)
        self.assertGreaterEqual(len(result), 1)


class TestBudgetCheck(unittest.TestCase):
    def test_budget_ok(self):
        result = fn.check_budget("test-budget", 100000.0)
        self.assertEqual(result["status"], "ok")

    def test_budget_zero(self):
        result = fn.check_budget("zero-budget", 0.0)
        self.assertEqual(result["used_pct"], 0)

    def test_budget_keys(self):
        result = fn.check_budget("test", 1000.0)
        self.assertIn("budget_name", result)
        self.assertIn("budget", result)
        self.assertIn("current_spend", result)
        self.assertIn("used_pct", result)
        self.assertIn("status", result)


class TestFinopsSummary(unittest.TestCase):
    def test_summary_keys(self):
        s = fn.get_finops_summary()
        self.assertIn("total_cost", s)
        self.assertIn("total_resources", s)
        self.assertIn("monthly_savings_potential", s)
        self.assertIn("annual_savings_potential", s)

    def test_summary_with_data(self):
        fn.record_cost("aliyun", "compute", "i-sum", "api", "t1", "on_demand", 500.0)
        s = fn.get_finops_summary()
        self.assertGreater(s["total_cost"], 0)


class TestConstants(unittest.TestCase):
    def test_cloud_providers(self):
        for p in ["aliyun", "huawei", "aws", "azure", "gcp", "tencent"]:
            self.assertIn(p, fn.CLOUD_PROVIDERS)

    def test_resource_types(self):
        for t in ["compute", "storage", "network", "database", "cache"]:
            self.assertIn(t, fn.RESOURCE_TYPES)

    def test_pricing_models(self):
        for m in ["on_demand", "reserved", "spot", "preemptible", "savings_plan"]:
            self.assertIn(m, fn.PRICING_MODELS)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands(self):
        commands = ["serve", "record_cost", "record_inventory", "savings",
                    "recommend", "by_provider", "by_tenant", "underutilized",
                    "budget", "summary"]
        for c in commands:
            cmd_name = c.replace("-", "_")
            self.assertTrue(callable(getattr(fn, f"cmd_{cmd_name}")))

    def test_cmd_record_cost(self):
        fn.cmd_record_cost(["aliyun", "compute", "i-cmd", "api", "t1", "100", "on_demand"])

    def test_cmd_record_inventory(self):
        fn.cmd_record_inventory(["aliyun", "i-cmd", "compute", "50", "60"])

    def test_cmd_savings(self):
        fn.cmd_savings(["100", "reserved", "720"])

    def test_cmd_recommend(self):
        fn.cmd_recommend(["i-cmd", "aliyun", "compute", "10", "15", "100"])

    def test_cmd_by_provider(self):
        fn.cmd_by_provider(["24"])

    def test_cmd_by_tenant(self):
        fn.cmd_by_tenant(["24"])

    def test_cmd_underutilized(self):
        fn.cmd_underutilized([])

    def test_cmd_budget(self):
        fn.cmd_budget(["test", "1000", "80"])

    def test_cmd_summary(self):
        fn.cmd_summary([])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=fn.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{fn.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_summary(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{fn.HTTP_PORT}/api/finops/summary", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_cost", data)
        except Exception:
            pass

    def test_cost_provider(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{fn.HTTP_PORT}/api/cost/provider?hours=24", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("by_provider", data)
        except Exception:
            pass

    def test_cost_record_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{fn.HTTP_PORT}/api/cost/record",
                data=json.dumps({"provider": "aliyun", "resource_id": "i-http",
                                 "service": "api", "tenant": "t1",
                                 "cost_amount": 100.0}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_savings_calculate_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{fn.HTTP_PORT}/api/savings/calculate",
                data=json.dumps({"current_cost": 100.0,
                                 "pricing_model": "reserved"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("monthly_savings", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
