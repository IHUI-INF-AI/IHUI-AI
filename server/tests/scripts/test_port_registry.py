#!/usr/bin/env python3
"""P1-69 端口分配检测 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))

import port_registry as pr


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_ranges(self):
        self.assertIn("core", pr.PORT_RANGES)
        self.assertIn("monitoring", pr.PORT_RANGES)
        self.assertIn("integration", pr.PORT_RANGES)


class TestCategorize(unittest.TestCase):
    def test_core(self):
        self.assertEqual(pr._categorize_port(10050), "core")

    def test_monitoring(self):
        self.assertEqual(pr._categorize_port(10150), "monitoring")

    def test_platform(self):
        self.assertEqual(pr._categorize_port(10250), "platform")

    def test_integration(self):
        self.assertEqual(pr._categorize_port(10450), "integration")

    def test_out_of_range(self):
        self.assertEqual(pr._categorize_port(30000), "out_of_range")


class TestRegister(unittest.TestCase):
    def test_register(self):
        rid = pr.register_port(10001, "svc-" + _u())
        self.assertIsInstance(rid, str)

    def test_with_category(self):
        rid = pr.register_port(10002, "svc-" + _u(), category="core")
        self.assertIsInstance(rid, str)

    def test_auto_category(self):
        rid = pr.register_port(10499, "svc-" + _u())
        self.assertIsInstance(rid, str)

    def test_invalid_port(self):
        rid = pr.register_port(-1, "svc-" + _u())
        self.assertIsInstance(rid, str)

    def test_too_large(self):
        rid = pr.register_port(99999, "svc-" + _u())
        self.assertIsInstance(rid, str)


class TestGet(unittest.TestCase):
    def test_existing(self):
        pr.register_port(10003, "svc-" + _u())
        result = pr.get_allocation(10003)
        self.assertIsNotNone(result)

    def test_nonexistent(self):
        result = pr.get_allocation(1000000)
        self.assertIsNone(result)


class TestDetect(unittest.TestCase):
    def test_no_conflict(self):
        result = pr.detect_conflicts()
        self.assertIsInstance(result, list)

    def test_with_conflict(self):
        pr.register_port(10004, "svc-a-" + _u())
        pr.register_port(10004, "svc-b-" + _u())
        result = pr.detect_conflicts()
        self.assertGreater(len(result), 0)


class TestScan(unittest.TestCase):
    def test_scan_source(self):
        result = pr.scan_source_for_ports()
        self.assertGreater(len(result), 0)

    def test_run_full(self):
        result = pr.run_full_scan()
        self.assertIn("total_scanned", result)
        self.assertIn("conflicts", result)
        self.assertIn("violations", result)


class TestViolations(unittest.TestCase):
    def test_check(self):
        result = pr.check_range_violation()
        self.assertIsInstance(result, list)

    def test_with_out_of_range(self):
        pr.register_port(99999, "out-" + _u())
        result = pr.check_range_violation()
        self.assertGreater(len(result), 0)


class TestReserve(unittest.TestCase):
    def test_reserve(self):
        rid = pr.reserve_range(11000, 12000, "extension", "extra")
        self.assertIsInstance(rid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = pr.get_port_report()
        self.assertIn("total_allocated", report)
        self.assertIn("by_category", report)
        self.assertIn("reservations", report)
        self.assertIn("total_scans", report)
        self.assertIn("ranges", report)


if __name__ == "__main__":
    unittest.main()
