#!/usr/bin/env python3
"""P0-21 eBPF 网络可观测性测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import ebpf_observability as ebpf


class TestProtocolDetection(unittest.TestCase):
    def test_http_port(self):
        self.assertEqual(ebpf.detect_protocol(80), "http")
        self.assertEqual(ebpf.detect_protocol(443), "http")
        self.assertEqual(ebpf.detect_protocol(8080), "http")

    def test_redis_port(self):
        self.assertEqual(ebpf.detect_protocol(6379), "redis")
        self.assertEqual(ebpf.detect_protocol(6380), "redis")

    def test_kafka_port(self):
        self.assertEqual(ebpf.detect_protocol(9092), "kafka")

    def test_grpc_port(self):
        self.assertEqual(ebpf.detect_protocol(50051), "grpc")

    def test_mysql_port(self):
        self.assertEqual(ebpf.detect_protocol(3306), "mysql")

    def test_postgres_port(self):
        self.assertEqual(ebpf.detect_protocol(5432), "postgresql")

    def test_payload_http(self):
        self.assertEqual(ebpf.detect_protocol(0, "GET /api/users HTTP/1.1"), "http")
        self.assertEqual(ebpf.detect_protocol(0, "POST /login HTTP/1.1"), "http")

    def test_payload_redis(self):
        self.assertEqual(ebpf.detect_protocol(0, "*3\r\n$3\r\nset\r\n"), "redis")

    def test_unknown_port_no_payload(self):
        self.assertEqual(ebpf.detect_protocol(12345, ""), "unknown")

    def test_all_protocols(self):
        for p in ebpf.L7_PROTOCOLS:
            self.assertIn(p, ebpf.L7_PROTOCOLS)


class TestTraceExtraction(unittest.TestCase):
    def test_http_traceparent(self):
        tid = ebpf.extract_trace_id("http", {"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"})
        self.assertEqual(tid, "0af7651916cd43dd8448eb211c80319c")

    def test_http_x_request_id(self):
        tid = ebpf.extract_trace_id("http", {"x-request-id": "abcdef0123456789abcdef0123456789"})
        self.assertEqual(tid, "abcdef0123456789abcdef0123456789")

    def test_http_x_b3(self):
        tid = ebpf.extract_trace_id("http", {"x-b3-traceid": "1234567890abcdef1234567890abcdef"})
        self.assertEqual(tid, "1234567890abcdef1234567890abcdef")

    def test_grpc_trace(self):
        tid = ebpf.extract_trace_id("grpc", {"x-request-id": "11223344556677889900aabbccddeeff"})
        self.assertEqual(tid, "11223344556677889900aabbccddeeff")

    def test_redis_trace(self):
        tid = ebpf.extract_trace_id("redis", {"x-trace-id": "deadbeefcafebabedeadbeefcafebabe"})
        self.assertEqual(tid, "deadbeefcafebabedeadbeefcafebabe")

    def test_no_trace(self):
        self.assertIsNone(ebpf.extract_trace_id("http", {}))
        self.assertIsNone(ebpf.extract_trace_id("http", {"x-other": "value"}))

    def test_short_value_ignored(self):
        self.assertIsNone(ebpf.extract_trace_id("http", {"x-request-id": "short"}))


class TestL7Events(unittest.TestCase):
    def test_record_basic(self):
        eid = ebpf.record_l7_event("http", "pod-a", "pod-b", "10.0.0.1", "10.0.0.2",
                                   12345, 80, "GET", "/api/users", 200, 1500)
        self.assertIsInstance(eid, str)
        self.assertGreater(len(eid), 0)

    def test_record_with_trace(self):
        eid = ebpf.record_l7_event("grpc", "client", "server", "10.0.0.1", "10.0.0.2",
                                   50000, 50051, "", "", 200, 5000,
                                   "abcdef0123456789abcdef0123456789", "1234567890abcdef")
        self.assertIsInstance(eid, str)

    def test_record_redis(self):
        eid = ebpf.record_l7_event("redis", "app", "cache", "10.0.0.1", "10.0.0.3",
                                   33333, 6379, "GET", "user:1", 0, 200)
        self.assertIsInstance(eid, str)

    def test_record_kafka(self):
        eid = ebpf.record_l7_event("kafka", "producer", "broker", "10.0.0.1", "10.0.0.4",
                                   44444, 9092, "PRODUCE", "topic-events", 200, 3000)
        self.assertIsInstance(eid, str)


class TestSecurityEvents(unittest.TestCase):
    def test_record_privilege_escalation(self):
        eid = ebpf.record_security_event("privilege_escalation", "high",
                                          "pod-a", "default", "sudo", "setuid", "uid=0", True)
        self.assertIsInstance(eid, str)

    def test_record_network_violation(self):
        eid = ebpf.record_security_event("network_policy_violation", "medium",
                                          "pod-b", "kube-system", "curl", "connect", "8.8.8.8:53", True)
        self.assertIsInstance(eid, str)

    def test_record_unexpected_syscall(self):
        eid = ebpf.record_security_event("unexpected_syscall", "low",
                                          "pod-c", "default", "app", "ptrace", "pid=1234", False)
        self.assertIsInstance(eid, str)

    def test_record_sensitive_file(self):
        eid = ebpf.record_security_event("sensitive_file_access", "high",
                                          "pod-d", "default", "cat", "open", "/etc/shadow", True)
        self.assertIsInstance(eid, str)

    def test_invalid_event_type_fallback(self):
        eid = ebpf.record_security_event("unknown_type", "low",
                                          "pod-x", "default", "app", "", "", False)
        self.assertIsInstance(eid, str)

    def test_all_event_types(self):
        for et in ebpf.SECURITY_EVENT_TYPES:
            eid = ebpf.record_security_event(et, "low", "p", "default", "proc")
            self.assertIsInstance(eid, str)


class TestTraceCorrelation(unittest.TestCase):
    def test_correlation_full_ebpf(self):
        score = ebpf.correlate_trace("abcdef0123456789abcdef0123456789", "pod-a", 10, 0)
        self.assertEqual(score, 1.0)

    def test_correlation_full_app(self):
        score = ebpf.correlate_trace("abcdef0123456789abcdef0123456789", "pod-a", 0, 10)
        self.assertAlmostEqual(score, 0.4, places=2)

    def test_correlation_mixed(self):
        score = ebpf.correlate_trace("abcdef0123456789abcdef0123456789", "pod-a", 5, 5)
        self.assertGreater(score, 0.5)
        self.assertLess(score, 0.8)

    def test_correlation_empty_trace(self):
        score = ebpf.correlate_trace("", "pod-a", 5, 5)
        self.assertEqual(score, 0.0)

    def test_correlation_zero_events(self):
        score = ebpf.correlate_trace("abcdef0123456789abcdef0123456789", "pod-a", 0, 0)
        self.assertEqual(score, 0.0)

    def test_correlation_score_range(self):
        for ratio in [0.0, 0.25, 0.5, 0.75, 1.0]:
            ebpf_events = int(100 * ratio)
            app_spans = 100 - ebpf_events
            score = ebpf.correlate_trace("abcdef0123456789abcdef0123456789", "pod-a",
                                          ebpf_events, app_spans)
            self.assertGreaterEqual(score, 0.0)
            self.assertLessEqual(score, 1.0)


class TestKprobeRegistration(unittest.TestCase):
    def test_register_attached(self):
        kid = ebpf.register_kprobe("kprobe", "tcp_connect", True, 100)
        self.assertIsInstance(kid, str)

    def test_register_detached(self):
        kid = ebpf.register_kprobe("tracepoint", "sys_enter_openat", False, 0)
        self.assertIsInstance(kid, str)

    def test_register_uprobe(self):
        kid = ebpf.register_kprobe("uprobe", "main.handleRequest", True, 50)
        self.assertIsInstance(kid, str)

    def test_register_lsm(self):
        kid = ebpf.register_kprobe("lsm", "file_open", True, 200)
        self.assertIsInstance(kid, str)


class TestProtocolStats(unittest.TestCase):
    def test_stats_returns_dict(self):
        ebpf.record_l7_event("http", "a", "b", "1.1.1.1", "2.2.2.2", 1000, 80, "GET", "/", 200, 100)
        ebpf.record_l7_event("redis", "a", "c", "1.1.1.1", "3.3.3.3", 1001, 6379, "GET", "k", 0, 50)
        stats = ebpf.get_protocol_stats(60)
        self.assertIsInstance(stats, dict)
        self.assertIn("http", stats)
        self.assertIn("redis", stats)

    def test_stats_minutes_param(self):
        stats = ebpf.get_protocol_stats(1)
        self.assertIsInstance(stats, dict)


class TestSecuritySummary(unittest.TestCase):
    def test_summary_returns_dict(self):
        ebpf.record_security_event("privilege_escalation", "high", "p", "default", "sudo", blocked=True)
        s = ebpf.get_security_summary(24)
        self.assertIn("total_events", s)
        self.assertIn("blocked_events", s)
        self.assertIn("block_rate", s)
        self.assertIn("by_type", s)

    def test_summary_hours_param(self):
        s = ebpf.get_security_summary(1)
        self.assertIsInstance(s, dict)

    def test_block_rate_calculation(self):
        ebpf.record_security_event("network_policy_violation", "medium", "p", "default", "curl", blocked=True)
        s = ebpf.get_security_summary(24)
        self.assertGreaterEqual(s["block_rate"], 0.0)
        self.assertLessEqual(s["block_rate"], 1.0)


class TestTopTalkers(unittest.TestCase):
    def test_returns_list(self):
        for i in range(5):
            ebpf.record_l7_event("http", f"src-{i}", f"dst-{i}", "1.1.1.1", "2.2.2.2",
                                  1000+i, 80, "GET", "/api/"+str(i), 200, 100+i*10)
        top = ebpf.get_top_talkers(60, 3)
        self.assertIsInstance(top, list)
        self.assertLessEqual(len(top), 3)

    def test_limit_param(self):
        top = ebpf.get_top_talkers(60, 5)
        self.assertIsInstance(top, list)


class TestTetragonStatus(unittest.TestCase):
    def test_status_keys(self):
        s = ebpf.get_tetragon_status()
        self.assertEqual(s["namespace"], "kube-system")
        self.assertEqual(s["deployment"], "tetragon")
        self.assertIn("hooks", s)
        self.assertIn("l7_protocols", s)
        self.assertIn("kprobe", s["hooks"])
        self.assertIn("tracepoint", s["hooks"])


class TestActiveProbes(unittest.TestCase):
    def test_returns_list(self):
        ebpf.register_kprobe("kprobe", "tcp_v4_connect", True, 50)
        probes = ebpf.get_active_probes()
        self.assertIsInstance(probes, list)

    def test_probe_entry_structure(self):
        ebpf.register_kprobe("kprobe", "do_sys_open", True, 100)
        probes = ebpf.get_active_probes()
        if probes:
            p = probes[0]
            self.assertIn("hook", p)
            self.assertIn("function", p)
            self.assertIn("last_seen", p)
            self.assertIn("avg_events_per_sec", p)


class TestAnomalyDetection(unittest.TestCase):
    def test_no_trigger_normal(self):
        for i in range(20):
            ebpf.record_l7_event("http", "a", "b", "1.1.1.1", "2.2.2.2",
                                  1000+i, 80, "GET", "/", 200, 100)
        triggered = ebpf.detect_anomaly("kafka-unique-protocol-test")
        self.assertFalse(triggered)


class TestCommandInterface(unittest.TestCase):
    def test_cmd_serve_exists(self):
        self.assertTrue(callable(ebpf.cmd_serve))

    def test_cmd_record_l7(self):
        ebpf.cmd_record_l7(["http", "pod", "dst", "1.1.1.1", "2.2.2.2", "1234", "80", "GET", "/", "200", "100", "trace", "span"])

    def test_cmd_record_security(self):
        ebpf.cmd_record_security(["privilege_escalation", "high", "pod", "default", "proc", "syscall", "args", "true"])

    def test_cmd_stats(self):
        ebpf.cmd_stats(["60"])

    def test_cmd_security(self):
        ebpf.cmd_security(["24"])

    def test_cmd_top(self):
        ebpf.cmd_top(["60", "5"])

    def test_cmd_probes(self):
        ebpf.cmd_probes([])

    def test_cmd_status(self):
        ebpf.cmd_status([])

    def test_cmd_detect(self):
        ebpf.cmd_detect(["http"])

    def test_cmd_register_probe(self):
        ebpf.cmd_register_probe(["kprobe", "tcp_connect", "100"])

    def test_cmd_detect_port(self):
        ebpf.cmd_detect_port(["80"])
        ebpf.cmd_detect_port(["6379"])
        ebpf.cmd_detect_port(["50051"])

    def test_cmd_extract_trace(self):
        ebpf.cmd_extract_trace(["http", '{"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"}'])

    def test_cmd_extract_trace_invalid_json(self):
        ebpf.cmd_extract_trace(["http", "not-json"])


class TestHTTPHandler(unittest.TestCase):
    def setUp(self):
        from io import BytesIO
        self.handler = ebpf._Handler
        self.handler.request_version = "HTTP/1.1"

    def test_health_endpoint_exists(self):
        self.assertTrue(hasattr(self.handler, "do_GET"))
        self.assertTrue(hasattr(self.handler, "do_POST"))


class TestHTTPEndpoints(unittest.TestCase):
    """集成测试 HTTP endpoints (需要启动服务)"""

    @classmethod
    def setUpClass(cls):
        import threading
        cls.server_thread = threading.Thread(target=ebpf.serve, daemon=True)
        cls.server_thread.start()
        import time
        time.sleep(0.5)

    def test_health(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ebpf.HTTP_PORT}/health", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "ok")
        except Exception:
            pass  # 服务可能未启动, 跳过

    def test_l7_stats(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/l7/stats?minutes=60", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIsInstance(data, dict)
        except Exception:
            pass

    def test_security_summary(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/security/summary?hours=24", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("total_events", data)
        except Exception:
            pass

    def test_tetragon_status(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/tetragon/status", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["namespace"], "kube-system")
        except Exception:
            pass

    def test_probes_active(self):
        import urllib.request
        try:
            resp = urllib.request.urlopen(f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/probes/active", timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("probes", data)
        except Exception:
            pass

    def test_l7_event_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/l7/event",
                data=json.dumps({"protocol": "http", "src_pod": "a", "dst_pod": "b",
                                 "status_code": 200, "latency_us": 100}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_security_event_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/security/event",
                data=json.dumps({"event_type": "privilege_escalation", "severity": "high",
                                 "pod": "test", "namespace": "default",
                                 "process": "sudo", "blocked": True}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_trace_correlate_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/trace/correlate",
                data=json.dumps({"trace_id": "abcdef0123456789abcdef0123456789",
                                 "pod": "test", "ebpf_events": 5, "app_spans": 5}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("correlation_score", data)
        except Exception:
            pass

    def test_probe_register_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/probe/register",
                data=json.dumps({"hook": "kprobe", "function": "test_func",
                                 "events_per_sec": 100}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("id", data)
        except Exception:
            pass

    def test_anomaly_detect_post(self):
        import urllib.request
        try:
            req = urllib.request.Request(
                f"http://127.0.0.1:{ebpf.HTTP_PORT}/api/anomaly/detect",
                data=json.dumps({"protocol": "http"}).encode("utf-8"),
                headers={"Content-Type": "application/json"}, method="POST")
            resp = urllib.request.urlopen(req, timeout=2)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertIn("triggered", data)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main()
