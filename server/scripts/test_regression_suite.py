#!/usr/bin/env python3
"""P0-67 跨轮回归测试套件 测试"""
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import regression_suite as rs


def _u() -> str:
    return uuid.uuid4().hex[:8]


class TestConstants(unittest.TestCase):
    def test_suites_defined(self):
        self.assertIn("round9", rs.TEST_SUITES)
        self.assertIn("round10", rs.TEST_SUITES)
        self.assertIn("round11", rs.TEST_SUITES)
        self.assertIn("round12", rs.TEST_SUITES)
        self.assertIn("round13", rs.TEST_SUITES)
        self.assertIn("round14", rs.TEST_SUITES)
        self.assertIn("round15", rs.TEST_SUITES)


class TestDiscover(unittest.TestCase):
    def test_discover(self):
        result = rs._discover_test_files()
        self.assertIn("round14", result)
        self.assertIn("round15", result)

    def test_round14_discovered(self):
        result = rs._discover_test_files()
        self.assertIn("test_fullstack_apm.py", result.get("round14", []))


class TestRunFile(unittest.TestCase):
    def test_run_existing(self):
        result = rs.run_test_file("test_unified_integration.py")
        self.assertIn("file", result)
        self.assertIn("passed", result)

    def test_run_nonexistent(self):
        result = rs.run_test_file("test_nonexistent_" + _u() + ".py")
        self.assertEqual(result.get("error"), "file not found")


class TestRunRound(unittest.TestCase):
    def test_round14(self):
        result = rs.run_round_regression("round14")
        self.assertIn("round", result)
        self.assertEqual(result["round"], "round14")

    def test_round15(self):
        result = rs.run_round_regression("round15")
        self.assertEqual(result["round"], "round15")

    def test_round_empty(self):
        result = rs.run_round_regression("round98")
        self.assertEqual(result["files"], 0)


class TestCompat(unittest.TestCase):
    def test_record(self):
        cid = rs.record_compatibility("round14", "round15", "api_compat", True, "ok")
        self.assertIsInstance(cid, str)

    def test_record_fail(self):
        cid = rs.record_compatibility("round14", "round15", "port_conflict", False, "duplicate")
        self.assertIsInstance(cid, str)


class TestReport(unittest.TestCase):
    def test_report(self):
        report = rs.get_regression_report()
        self.assertIn("total_runs", report)
        self.assertIn("passed_runs", report)
        self.assertIn("failed_runs", report)
        self.assertIn("total_tests_passed", report)
        self.assertIn("total_tests_failed", report)
        self.assertIn("compatibility_checks", report)


if __name__ == "__main__":
    unittest.main()
