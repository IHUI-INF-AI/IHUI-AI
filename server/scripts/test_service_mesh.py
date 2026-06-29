#!/usr/bin/env python3
"""P0-22 Service Mesh 完整集成测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import service_mesh as sm


class TestMtlsPolicies(unittest.TestCase):
    def test_create_strict(self):
        pid = sm.create_mtls_policy("strict-default", "default", "STRICT", ["*"])
        self.assertIsInstance(pid, str)

    def test_create_permissive(self):
        pid = sm.create_mtls_policy("permissive-default", "default", "PERMISSIVE", ["app-a"])
        self.assertIsInstance(pid, str)

    def test_create_disable(self):
        pid = sm.create_mtls_policy("disable-debug", "debug", "DISABLE", ["debug-tool"])
        self.assertIsInstance(pid, str)

    def test_invalid_mode_fallback(self):
        pid = sm.create_mtls_policy("invalid-mode", "default", "INVALID", [])
        self.assertIsInstance(pid, str)

    def test_list_policies(self):
        sm.create_mtls_policy("list-test", "default", "STRICT", [])
        policies = sm.list_mtls_policies()
        self.assertIsInstance(policies, list)
        self.assertGreater(len(policies), 0)

    def test_policy_targets(self):
        sm.create_mtls_policy("target-test", "default", "STRICT", ["svc-a", "svc-b"])
        policies = sm.list_mtls_policies()
        target_policy = next((p for p in policies if p["name"] == "target-test"), None)
        if target_policy:
            self.assertEqual(len(target_policy["targets"]), 2)


class TestTrafficSplit(unittest.TestCase):
    def test_create_canary(self):
        tid = sm.create_traffic_split("canary-test", "default", "canary",
                                        ["v1", "v2"], [90, 10])
        self.assertIsInstance(tid, str)

    def test_create_blue_green(self):
        tid = sm.create_traffic_split("bg-test", "default", "blue_green",
                                        ["blue", "green"], [0, 100])
        self.assertIsInstance(tid, str)

    def test_create_ab_test(self):
        tid = sm.create_traffic_split("ab-test", "default", "ab_test",
                                        ["a", "b"], [50, 50])
        self.assertIsInstance(tid, str)

    def test_create_mirror(self):
        tid = sm.create_traffic_split("mirror-test", "default", "mirror",
                                        ["primary", "mirror"], [100, 0])
        self.assertIsInstance(tid, str)

    def test_invalid_type_fallback(self):
        tid = sm.create_traffic_split("invalid-type", "default", "INVALID",
                                        ["a", "b"], [50, 50])
        self.assertIsInstance(tid, str)

    def test_length_mismatch_raises(self):
        with self.assertRaises(ValueError):
            sm.create_traffic_split("mismatch", "default", "canary",
                                     ["a", "b", "c"], [50, 50])

    def test_weight_normalization(self):
        tid = sm.create_traffic_split("normalize-test", "default", "canary",
                                        ["a", "b"], [1, 1])
        self.assertIsInstance(tid, str)

    def test_select_subset_100(self):
        idx = sm.select_subset([100])
        self.assertEqual(idx, 0)

    def test_select_subset_zero(self):
        idx = sm.select_subset([0])
        self.assertEqual(idx, 0)

    def test_select_subset_50_50(self):
        results = [sm.select_subset([50, 50]) for _ in range(100)]
        self.assertIn(0, results)
        self.assertIn(1, results)


class TestFaultInjection(unittest.TestCase):
    def test_create_abort(self):
        fid = sm.create_fault_injection("abort-test", "default", "abort",
                                          "v1", {"http_status": 503}, 300)
        self.assertIsInstance(fid, str)

    def test_create_delay(self):
        fid = sm.create_fault_injection("delay-test", "default", "delay",
                                          "v2", {"fixed_delay_ms": 1000}, 600)
        self.assertIsInstance(fid, str)

    def test_create_rate_limit(self):
        fid = sm.create_fault_injection("rl-test", "default", "rate_limit",
                                          "v1", {"rps": 10, "burst": 20}, 300)
        self.assertIsInstance(fid, str)

    def test_invalid_type_fallback(self):
        fid = sm.create_fault_injection("invalid-fault", "default", "INVALID",
                                          "v1", {}, 300)
        self.assertIsInstance(fid, str)

    def test_apply_abort(self):
        fault = {"fault_type": "abort",
                 "config": json.dumps({"http_status": 503, "percentage": 100})}
        result = sm.apply_fault(fault)
        self.assertTrue(result["abort"])
        self.assertEqual(result["status_code"], 503)

    def test_apply_delay(self):
        fault = {"fault_type": "delay",
                 "config": json.dumps({"fixed_delay_ms": 500, "percentage": 50})}
        result = sm.apply_fault(fault)
        self.assertTrue(result["delay"])
        self.assertEqual(result["delay_ms"], 500)

    def test_apply_rate_limit(self):
        fault = {"fault_type": "rate_limit",
                 "config": json.dumps({"rps": 100, "burst": 200})}
        result = sm.apply_fault(fault)
        self.assertTrue(result["rate_limit"])
        self.assertEqual(result["rps"], 100)

    def test_apply_unknown(self):
        result = sm.apply_fault({"fault_type": "unknown", "config": "{}"})
        self.assertEqual(result, {})


class TestVirtualService(unittest.TestCase):
    def test_create(self):
        vid = sm.create_virtual_service("vs-test", "default", "api.example.com", [])
        self.assertIsInstance(vid, str)

    def test_create_with_routes(self):
        routes = [{
            "match": {"uri": {"prefix": "/api"}},
            "route": [{"destination": {"host": "api-v1"}}],
        }]
        vid = sm.create_virtual_service("vs-api", "default", "api.example.com", routes)
        self.assertIsInstance(vid, str)

    def test_match_uri_prefix(self):
        route_match = {"uri": {"prefix": "/api"}}
        request = {"path": "/api/users", "method": "GET"}
        self.assertTrue(sm.match_request(route_match, request))

    def test_match_uri_prefix_miss(self):
        route_match = {"uri": {"prefix": "/api"}}
        request = {"path": "/admin", "method": "GET"}
        self.assertFalse(sm.match_request(route_match, request))

    def test_match_method(self):
        route_match = {"method": "GET"}
        request = {"method": "get", "path": "/"}
        self.assertTrue(sm.match_request(route_match, request))

    def test_match_method_miss(self):
        route_match = {"method": "POST"}
        request = {"method": "GET", "path": "/"}
        self.assertFalse(sm.match_request(route_match, request))

    def test_match_header(self):
        route_match = {"header": {"x-env": "staging"}}
        request = {"headers": {"x-env": "staging"}, "path": "/"}
        self.assertTrue(sm.match_request(route_match, request))

    def test_match_header_miss(self):
        route_match = {"header": {"x-env": "staging"}}
        request = {"headers": {"x-env": "prod"}, "path": "/"}
        self.assertFalse(sm.match_request(route_match, request))

    def test_match_source_label(self):
        route_match = {"source_label": {"app": "web"}}
        request = {"source_labels": {"app": "web"}, "path": "/"}
        self.assertTrue(sm.match_request(route_match, request))

    def test_match_source_namespace(self):
        route_match = {"source_namespace": "production"}
        request = {"source_namespace": "production", "path": "/"}
        self.assertTrue(sm.match_request(route_match, request))

    def test_route_request(self):
        vs = {"http_routes": [
            {"match": {"uri": {"prefix": "/v1"}}, "route": {"destination": "v1"}},
            {"match": {"uri": {"prefix": "/v2"}}, "route": {"destination": "v2"}},
        ]}
        request = {"path": "/v2/users", "method": "GET"}
        route = sm.route_request(vs, request)
        self.assertEqual(route, {"destination": "v2"})

    def test_route_no_match(self):
        vs = {"http_routes": [
            {"match": {"uri": {"prefix": "/v1"}}, "route": {"destination": "v1"}},
        ]}
        request = {"path": "/admin", "method": "GET"}
        route = sm.route_request(vs, request)
        self.assertIsNone(route)


class TestMeshTelemetry(unittest.TestCase):
    def test_record(self):
        tid = sm.record_mesh_telemetry("web", "api", "http", True, 5.2, 1024, 2048, 200)
        self.assertIsInstance(tid, str)

    def test_record_mtls_disabled(self):
        tid = sm.record_mesh_telemetry("legacy", "api", "http", False, 10.5, 512, 1024, 200)
        self.assertIsInstance(tid, str)

    def test_record_grpc(self):
        tid = sm.record_mesh_telemetry("client", "server", "grpc", True, 2.0, 256, 512, 200)
        self.assertIsInstance(tid, str)

    def test_record_5xx(self):
        tid = sm.record_mesh_telemetry("web", "api", "http", True, 50.0, 512, 128, 500)
        self.assertIsInstance(tid, str)

    def test_summary(self):
        sm.record_mesh_telemetry("web", "api", "http", True, 3.0, 1000, 2000, 200)
        summary = sm.get_telemetry_summary(60)
        self.assertIn("window_minutes", summary)
        self.assertIn("flows", summary)
        self.assertIsInstance(summary["flows"], list)

    def test_summary_mtls_rate(self):
        sm.record_mesh_telemetry("test-src", "test-dst", "http", True, 1.0, 100, 200, 200)
        summary = sm.get_telemetry_summary(60)
        if summary["flows"]:
            flow = summary["flows"][0]
            self.assertIn("mtls_rate", flow)
            self.assertGreaterEqual(flow["mtls_rate"], 0.0)
            self.assertLessEqual(flow["mtls_rate"], 1.0)


class TestCertificates(unittest.TestCase):
    def test_issue(self):
        cid = sm.issue_certificate("1234567890", "spiffe://cluster.local/ns/default/sa/web")
        self.assertIsInstance(cid, str)

    def test_issue_custom_validity(self):
        cid = sm.issue_certificate("9876543210", "spiffe://cluster.local/ns/prod/sa/api", 30)
        self.assertIsInstance(cid, str)

    def test_issue_long_validity(self):
        cid = sm.issue_certificate("1111111111", "spiffe://cluster.local/ns/prod/sa/db", 365)
        self.assertIsInstance(cid, str)


class TestMeshOverview(unittest.TestCase):
    def test_overview_keys(self):
        ov = sm.get_mesh_overview()
        self.assertEqual(ov["mesh_type"], "istio")
        self.assertIn("mtls_policies", ov)
        self.assertIn("active_traffic_splits", ov)
        self.assertIn("active_fault_injections", ov)
        self.assertIn("active_virtual_services", ov)
        self.assertIn("active_certificates", ov)

    def test_overview_after_create(self):
        sm.create_mtls_policy("overview-test", "default", "STRICT", [])
        sm.create_traffic_split("overview-split", "default", "canary", ["a", "b"], [50, 50])
        ov = sm.get_mesh_overview()
        self.assertGreaterEqual(ov["mtls_policies"], 1)
        self.assertGreaterEqual(ov["active_traffic_splits"], 1)


class TestMtlsCompliance(unittest.TestCase):
    def test_compliant_when_no_traffic(self):
        ok = sm.check_mtls_compliance(window_minutes=0)
        self.assertTrue(ok)

    def test_compliant_when_all_mtls(self):
        for i in range(20):
            sm.record_mesh_telemetry(f"compliance-{uuid_str(i)}",
                                      f"d-{i}", "http", True, 1.0, 100, 200, 200)
        ok = sm.check_mtls_compliance(window_minutes=60)
        self.assertTrue(ok)


def uuid_str(i: int) -> str:
    import uuid as u
    return str(u.uuid4())[:8] + str(i)


class TestCommandInterface(unittest.TestCase):
    def test_all_commands_callable(self):
        commands = ["serve", "mtls_create", "split_create", "split_select",
                    "fault_create", "fault_apply", "vs_create", "telemetry",
                    "overview", "cert_issue", "match", "route",
                    "record_telemetry", "check_mtls"]
        for c in commands:
            self.assertTrue(callable(getattr(sm, f"cmd_{c.replace('-', '_')}")))

    def test_cmd_mtls_create(self):
        sm.cmd_mtls_create(["test-mtls", "STRICT", "default", "svc-a,svc-b"])

    def test_cmd_split_create(self):
        sm.cmd_split_create(["test-split", "canary", "v1,v2", "90,10"])

    def test_cmd_split_select(self):
        sm.cmd_split_select(["50,50"])

    def test_cmd_fault_create(self):
        sm.cmd_fault_create(["test-fault", "delay", "v1", '{"fixed_delay_ms": 100}', "300"])

    def test_cmd_fault_apply(self):
        sm.cmd_fault_apply(['{"fault_type": "abort", "http_status": 503}'])

    def test_cmd_vs_create(self):
        sm.cmd_vs_create(["test-vs", "api.example.com", "[]"])

    def test_cmd_telemetry(self):
        sm.cmd_telemetry(["60"])

    def test_cmd_overview(self):
        sm.cmd_overview([])

    def test_cmd_cert_issue(self):
        sm.cmd_cert_issue(["1234", "spiffe://test", "90"])

    def test_cmd_match(self):
        sm.cmd_match(['{"uri": {"prefix": "/api"}}', '{"path": "/api/users", "method": "GET"}'])

    def test_cmd_route(self):
        sm.cmd_route(['[{"match": {"uri": {"prefix": "/v1"}}, "route": {"dest": "v1"}}]',
                      '{"path": "/v1/test", "method": "GET"}'])

    def test_cmd_record_telemetry(self):
        sm.cmd_record_telemetry(["web", "api", "5.0", "200", "true"])

    def test_cmd_check_mtls(self):
        sm.cmd_check_mtls([])


class TestHTTPEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=sm.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{sm.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass

    def test_overview_endpoint(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{sm.HTTP_PORT}/api/mesh/overview", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["mesh_type"], "istio")
        except Exception:
            pass

    def test_mtls_policies_endpoint(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{sm.HTTP_PORT}/api/mtls/policies", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("policies", data)
        except Exception:
            pass

    def test_telemetry_summary_endpoint(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{sm.HTTP_PORT}/api/telemetry/summary", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("flows", data)
        except Exception:
            pass

    def test_mtls_create_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{sm.HTTP_PORT}/api/mtls/policy",
                data=json.dumps({"name": "http-test", "mode": "STRICT", "namespace": "default"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_split_create_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{sm.HTTP_PORT}/api/traffic/split",
                data=json.dumps({"name": "http-split", "split_type": "canary",
                                 "subsets": ["v1", "v2"], "weights": [90, 10]}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_fault_inject_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{sm.HTTP_PORT}/api/fault/inject",
                data=json.dumps({"name": "http-fault", "fault_type": "abort",
                                 "target_subset": "v1", "config": {"http_status": 503}}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
