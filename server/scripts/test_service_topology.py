#!/usr/bin/env python3
"""P1-68 跨服务依赖图 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import service_topology as st


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_edge_types(self):
        for t in ["sync_call", "async_call", "event", "database", "cache", "queue"]:
            self.assertIn(t, st.EDGE_TYPES)

    def test_statuses(self):
        for s in ["active", "inactive", "degraded", "maintenance"]:
            self.assertIn(s, st.NODE_STATUSES)


class TestNode(unittest.TestCase):
    def test_add(self):
        nid = st.add_node("n-" + _u(), "svc-a", 8080)
        self.assertIsInstance(nid, str)

    def test_add_all_statuses(self):
        for s in st.NODE_STATUSES:
            nid = st.add_node("n-" + _u(), "svc-a", 8080, status=s)
            self.assertIsInstance(nid, str)

    def test_invalid_status(self):
        nid = st.add_node("n-" + _u(), "svc-a", 8080, status="invalid")
        self.assertIsInstance(nid, str)

    def test_with_tags(self):
        nid = st.add_node("n-" + _u(), "svc-a", 8080, tags=["t1", "t2"])
        self.assertIsInstance(nid, str)


class TestEdge(unittest.TestCase):
    def test_add(self):
        eid = st.add_edge("n1-" + _u(), "n2-" + _u())
        self.assertIsInstance(eid, str)

    def test_all_types(self):
        for t in st.EDGE_TYPES:
            eid = st.add_edge("n1-" + _u(), "n2-" + _u(), edge_type=t)
            self.assertIsInstance(eid, str)

    def test_invalid_type(self):
        eid = st.add_edge("n1-" + _u(), "n2-" + _u(), edge_type="invalid")
        self.assertIsInstance(eid, str)


class TestCall(unittest.TestCase):
    def test_increment_new(self):
        s, t = "n1-" + _u(), "n2-" + _u()
        st.add_edge(s, t)
        ok = st.increment_call(s, t, 10.0, False)
        self.assertTrue(ok)

    def test_increment_existing(self):
        s, t = "n1-" + _u(), "n2-" + _u()
        st.add_edge(s, t)
        st.increment_call(s, t)
        ok = st.increment_call(s, t, 20.0, True)
        self.assertTrue(ok)


class TestTopology(unittest.TestCase):
    def test_get(self):
        s, t = "n1-" + _u(), "n2-" + _u()
        st.add_node(s, "svc-1")
        st.add_node(t, "svc-2")
        st.add_edge(s, t)
        topo = st.get_topology()
        self.assertIn("nodes", topo)
        self.assertIn("edges", topo)


class TestCycles(unittest.TestCase):
    def test_detect_no_cycle(self):
        s, t = "n1-" + _u(), "n2-" + _u()
        st.add_edge(s, t)
        cycles = st.detect_cycles()
        self.assertIsInstance(cycles, list)

    def test_detect_with_cycle(self):
        a, b, c = "a-" + _u(), "b-" + _u(), "c-" + _u()
        st.add_edge(a, b)
        st.add_edge(b, c)
        st.add_edge(c, a)
        cycles = st.detect_cycles()
        self.assertGreater(len(cycles), 0)


class TestPaths(unittest.TestCase):
    def test_find(self):
        a, b, c = "a-" + _u(), "b-" + _u(), "c-" + _u()
        st.add_edge(a, b)
        st.add_edge(b, c)
        paths = st.find_critical_paths(a, c, 5)
        self.assertGreater(len(paths), 0)

    def test_find_no_path(self):
        paths = st.find_critical_paths("n1-" + _u(), "n2-" + _u())
        self.assertIsInstance(paths, list)


class TestRecord(unittest.TestCase):
    def test_record_path(self):
        pid = st.record_critical_path("path-" + _u(), ["n1", "n2", "n3"], 100.0)
        self.assertIsInstance(pid, str)

    def test_record_cycle(self):
        cid = st.record_cycle(["n1", "n2", "n3"])
        self.assertIsInstance(cid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = st.get_topology_report()
        self.assertIn("node_count", report)
        self.assertIn("edge_count", report)
        self.assertIn("cycle_count", report)
        self.assertIn("cycles", report)


if __name__ == "__main__":
    unittest.main()
