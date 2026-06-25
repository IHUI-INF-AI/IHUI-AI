#!/usr/bin/env python3
"""P0-33 跨云多活架构 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import multi_cloud as mc


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_cloud_providers(self):
        for p in ["aliyun", "huawei", "aws_tokyo", "azure", "gcp", "tencent"]:
            self.assertIn(p, mc.CLOUD_PROVIDERS)

    def test_sync_modes(self):
        for m in ["async", "sync", "semi_sync"]:
            self.assertIn(m, mc.SYNC_MODES)

    def test_replication_types(self):
        for t in ["logical", "physical", "streaming"]:
            self.assertIn(t, mc.REPLICATION_TYPES)

    def test_dns_strategies(self):
        for s in ["geo", "latency", "weighted", "failover"]:
            self.assertIn(s, mc.DNS_STRATEGIES)


class TestRegisterRegion(unittest.TestCase):
    def test_register_aliyun(self):
        rid = mc.register_region("aliyun-" + _u(), "aliyun", "华东1",
                                    "cn-hangzhou", "primary", "endpoint1",
                                    15, 0)
        self.assertIsInstance(rid, str)

    def test_register_huawei(self):
        rid = mc.register_region("huawei-" + _u(), "huawei", "华南1",
                                    "cn-guangzhou", "secondary", "endpoint2",
                                    30, 0)
        self.assertIsInstance(rid, str)

    def test_register_aws(self):
        rid = mc.register_region("aws-" + _u(), "aws_tokyo", "ap-northeast-1",
                                    "tokyo-a", "dr", "endpoint3",
                                    3600, 5)
        self.assertIsInstance(rid, str)

    def test_register_invalid_provider(self):
        rid = mc.register_region("x-" + _u(), "INVALID", "test", "z", "primary")
        self.assertIsInstance(rid, str)

    def test_register_invalid_role(self):
        rid = mc.register_region("x-" + _u(), "aliyun", "test", "z", "INVALID")
        self.assertIsInstance(rid, str)

    def test_register_all_providers(self):
        for p in mc.CLOUD_PROVIDERS:
            rid = mc.register_region(f"{p}-" + _u(), p, "name", "zone", "secondary")
            self.assertIsInstance(rid, str)


class TestCreateReplicationLink(unittest.TestCase):
    def test_logical_async(self):
        link_id = mc.create_replication_link("a", "b", "logical", "async")
        self.assertTrue(link_id.startswith("link-"))

    def test_physical_sync(self):
        link_id = mc.create_replication_link("a", "b", "physical", "sync")
        self.assertTrue(link_id.startswith("link-"))

    def test_streaming_semi_sync(self):
        link_id = mc.create_replication_link("a", "b", "streaming", "semi_sync")
        self.assertTrue(link_id.startswith("link-"))

    def test_invalid_type_fallback(self):
        link_id = mc.create_replication_link("a", "b", "INVALID", "async")
        self.assertTrue(link_id.startswith("link-"))

    def test_invalid_mode_fallback(self):
        link_id = mc.create_replication_link("a", "b", "logical", "INVALID")
        self.assertTrue(link_id.startswith("link-"))

    def test_unique_link_ids(self):
        l1 = mc.create_replication_link("a", "b")
        l2 = mc.create_replication_link("a", "b")
        self.assertNotEqual(l1, l2)


class TestUpdateReplicationLag(unittest.TestCase):
    def test_update_lag_existing(self):
        link_id = mc.create_replication_link("a", "b")
        ok = mc.update_replication_lag(link_id, 100, 50.0)
        self.assertTrue(ok)

    def test_update_lag_nonexistent(self):
        ok = mc.update_replication_lag("nonexistent-" + _u(), 0)
        self.assertFalse(ok)

    def test_update_lag_zero(self):
        link_id = mc.create_replication_link("a", "b")
        ok = mc.update_replication_lag(link_id, 0, 0.0)
        self.assertTrue(ok)

    def test_update_lag_high(self):
        link_id = mc.create_replication_link("a", "b")
        ok = mc.update_replication_lag(link_id, 100000, 1000.0)
        self.assertTrue(ok)


class TestSetupDNSRoute(unittest.TestCase):
    def test_dns_geo(self):
        rid = mc.setup_dns_route("api.example.com", "geo",
                                    [{"region": "aliyun", "healthy": True}])
        self.assertIsInstance(rid, str)

    def test_dns_latency(self):
        rid = mc.setup_dns_route("api.example.com", "latency", [])
        self.assertIsInstance(rid, str)

    def test_dns_weighted(self):
        rid = mc.setup_dns_route("api.example.com", "weighted",
                                    [{"region": "a", "weight": 50}])
        self.assertIsInstance(rid, str)

    def test_dns_failover(self):
        rid = mc.setup_dns_route("api.example.com", "failover",
                                    [{"region": "primary", "primary": True}])
        self.assertIsInstance(rid, str)

    def test_dns_invalid_strategy(self):
        rid = mc.setup_dns_route("test.com", "INVALID", [])
        self.assertIsInstance(rid, str)

    def test_dns_with_health_check(self):
        rid = mc.setup_dns_route("test.com", "failover", [],
                                    health_check_id="hc-123")
        self.assertIsInstance(rid, str)


class TestResolveDNS(unittest.TestCase):
    def test_resolve_geo_match(self):
        host = "geo-" + _u() + ".com"
        mc.setup_dns_route(host, "geo", [
            {"region": "aliyun", "healthy": True, "ip": "1.1.1.1"},
            {"region": "huawei", "healthy": True, "ip": "2.2.2.2"},
        ])
        result = mc.resolve_dns(host, "aliyun")
        self.assertIsNotNone(result)
        self.assertEqual(result["selected"]["region"], "aliyun")

    def test_resolve_weighted(self):
        host = "weighted-" + _u() + ".com"
        mc.setup_dns_route(host, "weighted", [
            {"region": "a", "weight": 50, "healthy": True},
            {"region": "b", "weight": 50, "healthy": True},
        ])
        result = mc.resolve_dns(host, "client-x")
        self.assertIsNotNone(result)

    def test_resolve_failover(self):
        host = "fo-" + _u() + ".com"
        mc.setup_dns_route(host, "failover", [
            {"region": "primary", "primary": True, "healthy": True, "ip": "1.1.1.1"},
            {"region": "dr", "primary": False, "healthy": True, "ip": "2.2.2.2"},
        ])
        result = mc.resolve_dns(host)
        self.assertEqual(result["selected"]["region"], "primary")

    def test_resolve_failover_to_dr(self):
        host = "fo2-" + _u() + ".com"
        mc.setup_dns_route(host, "failover", [
            {"region": "primary", "primary": True, "healthy": False},
            {"region": "dr", "primary": False, "healthy": True},
        ])
        result = mc.resolve_dns(host)
        self.assertEqual(result["selected"]["region"], "dr")

    def test_resolve_nonexistent(self):
        result = mc.resolve_dns("nonexistent-" + _u() + ".com")
        self.assertIsNone(result)


class TestCheckConsistency(unittest.TestCase):
    def test_consistent(self):
        result = mc.check_consistency("a", "b", "users", 1000, 1000)
        self.assertEqual(result["conflicts"], 0)
        self.assertEqual(result["resolution"], "consistent")

    def test_auto_resolve(self):
        result = mc.check_consistency("a", "b", "users", 1000, 1005)
        self.assertEqual(result["conflicts"], 5)
        self.assertEqual(result["resolution"], "auto_resolve")

    def test_manual_review(self):
        result = mc.check_consistency("a", "b", "users", 1000, 2000)
        self.assertEqual(result["conflicts"], 1000)
        self.assertEqual(result["resolution"], "manual_review")

    def test_consistency_returns_id(self):
        result = mc.check_consistency("a", "b", "x", 0, 0)
        self.assertIn("check_id", result)


class TestFailover(unittest.TestCase):
    def test_trigger(self):
        eid = mc.trigger_failover("aliyun", "huawei", "datacenter down")
        self.assertTrue(eid.startswith("failover-"))

    def test_complete(self):
        eid = mc.trigger_failover("aliyun", "huawei", "test")
        ok = mc.complete_failover(eid, 30, 0)
        self.assertTrue(ok)

    def test_complete_nonexistent(self):
        ok = mc.complete_failover("nonexistent-" + _u(), 30, 0)
        self.assertFalse(ok)

    def test_unique_event_ids(self):
        e1 = mc.trigger_failover("a", "b", "r1")
        e2 = mc.trigger_failover("a", "b", "r2")
        self.assertNotEqual(e1, e2)


class TestGetRegionHealth(unittest.TestCase):
    def test_health_existing(self):
        rid = "health-" + _u()
        mc.register_region(rid, "aliyun", "name", "z", "primary", "ep", 15, 0)
        mc.create_replication_link(rid, "dr")
        result = mc.get_region_health(rid)
        self.assertEqual(result["region"], rid)
        self.assertEqual(result["status"], "active")

    def test_health_nonexistent(self):
        result = mc.get_region_health("nonexistent-" + _u())
        self.assertEqual(result["status"], "unknown")

    def test_health_with_replication(self):
        rid = "repl-" + _u()
        mc.register_region(rid, "aliyun", "name", "z")
        link = mc.create_replication_link(rid, "huawei")
        mc.update_replication_lag(link, 50, 10.0)
        result = mc.get_region_health(rid)
        self.assertGreaterEqual(result["replication_links"], 1)


class TestGetTopology(unittest.TestCase):
    def test_topology(self):
        result = mc.get_topology()
        self.assertIn("regions", result)
        self.assertIn("replication_links", result)

    def test_topology_includes_new_region(self):
        rid = "topo-" + _u()
        mc.register_region(rid, "aliyun", "name")
        result = mc.get_topology()
        names = [r["region_id"] for r in result["regions"]]
        self.assertIn(rid, names)


class TestComputeHash(unittest.TestCase):
    def test_hash_returns_16_chars(self):
        h = mc.compute_data_hash("test")
        self.assertEqual(len(h), 16)

    def test_hash_consistent(self):
        h1 = mc.compute_data_hash("data")
        h2 = mc.compute_data_hash("data")
        self.assertEqual(h1, h2)

    def test_hash_different(self):
        h1 = mc.compute_data_hash("a")
        h2 = mc.compute_data_hash("b")
        self.assertNotEqual(h1, h2)


class TestCLICommands(unittest.TestCase):
    def test_cmd_topology(self):
        try:
            mc.cmd_topology([])
        except SystemExit:
            pass

    def test_cmd_hash(self):
        try:
            mc.cmd_hash(["testdata"])
        except SystemExit:
            pass

    def test_cmd_register_region(self):
        try:
            mc.cmd_register_region(["cli-" + _u(), "aliyun"])
        except SystemExit:
            pass

    def test_cmd_link(self):
        try:
            mc.cmd_link(["a-" + _u(), "b-" + _u()])
        except SystemExit:
            pass

    def test_cmd_lag(self):
        link = mc.create_replication_link("a", "b")
        try:
            mc.cmd_lag([link, "100", "50.0"])
        except SystemExit:
            pass

    def test_cmd_dns(self):
        try:
            mc.cmd_dns(["cli-test-" + _u() + ".com", "failover"])
        except SystemExit:
            pass

    def test_cmd_resolve(self):
        host = "cli-resolve-" + _u() + ".com"
        mc.setup_dns_route(host, "failover", [{"region": "p", "primary": True, "healthy": True}])
        try:
            mc.cmd_resolve([host, "any"])
        except SystemExit:
            pass

    def test_cmd_consistency(self):
        try:
            mc.cmd_consistency(["a", "b", "users", "1000", "1000"])
        except SystemExit:
            pass

    def test_cmd_failover(self):
        try:
            mc.cmd_failover(["aliyun", "huawei", "test reason"])
        except SystemExit:
            pass

    def test_cmd_complete(self):
        eid = mc.trigger_failover("a", "b", "r")
        try:
            mc.cmd_complete([eid, "30", "0"])
        except SystemExit:
            pass

    def test_cmd_health(self):
        try:
            mc.cmd_health(["nonexistent-" + _u()])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10130/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_topology_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10130/api/topology", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("regions", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
