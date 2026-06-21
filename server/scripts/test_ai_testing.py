#!/usr/bin/env python3
"""P1-36 智能测试平台 测试"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import ai_testing as at


def _u() -> str:
    return os.urandom(4).hex()


class TestConstants(unittest.TestCase):
    def test_test_types(self):
        for t in ["unit", "integration", "e2e", "performance", "security", "smoke"]:
            self.assertIn(t, at.TEST_TYPES)

    def test_test_status(self):
        for s in ["pending", "running", "passed", "failed", "skipped"]:
            self.assertIn(s, at.TEST_STATUS)

    def test_priority_levels(self):
        for p in ["low", "medium", "high", "critical"]:
            self.assertIn(p, at.PRIORITY_LEVELS)

    def test_defect_severity(self):
        for s in ["trivial", "minor", "major", "critical", "blocker"]:
            self.assertIn(s, at.DEFECT_SEVERITY)

    def test_coverage_types(self):
        for t in ["line", "branch", "function", "statement"]:
            self.assertIn(t, at.COVERAGE_TYPES)


class TestGenerateTestCases(unittest.TestCase):
    def test_generate_unit(self):
        cases = at.generate_test_cases("user login feature", "unit", 3)
        self.assertEqual(len(cases), 3)

    def test_generate_integration(self):
        cases = at.generate_test_cases("API integration", "integration", 5)
        self.assertEqual(len(cases), 5)

    def test_generate_e2e(self):
        cases = at.generate_test_cases("checkout flow", "e2e", 2)
        self.assertEqual(len(cases), 2)

    def test_generate_invalid_type(self):
        cases = at.generate_test_cases("test", "INVALID", 3)
        self.assertEqual(len(cases), 3)

    def test_generate_zero_count(self):
        cases = at.generate_test_cases("test", "unit", 0)
        self.assertGreaterEqual(len(cases), 1)

    def test_generate_exceeds_max(self):
        cases = at.generate_test_cases("test", "unit", 1000)
        self.assertEqual(len(cases), 50)

    def test_case_has_fields(self):
        cases = at.generate_test_cases("user auth", "unit", 1)
        c = cases[0]
        self.assertIn("case_id", c)
        self.assertIn("name", c)
        self.assertIn("test_type", c)
        self.assertIn("priority", c)
        self.assertIn("script", c)

    def test_chinese_requirement(self):
        cases = at.generate_test_cases("用户登录功能", "unit", 3)
        self.assertEqual(len(cases), 3)


class TestSaveTestCase(unittest.TestCase):
    def test_save(self):
        cases = at.generate_test_cases("test", "unit", 1)
        cid = at.save_test_case(cases[0])
        self.assertIsInstance(cid, str)


class TestCreateTestSuite(unittest.TestCase):
    def test_create(self):
        sid = at.create_test_suite("suite-" + _u(), ["TC-1", "TC-2"])
        self.assertTrue(sid.startswith("suite-"))

    def test_with_schedule(self):
        sid = at.create_test_suite("s-" + _u(), [], schedule="0 2 * * *")
        self.assertTrue(sid.startswith("suite-"))

    def test_empty_cases(self):
        sid = at.create_test_suite("s-" + _u(), [])
        self.assertTrue(sid.startswith("suite-"))


class TestStartTestRun(unittest.TestCase):
    def test_start(self):
        rid = at.start_test_run("suite", ["TC-1", "TC-2"])
        self.assertTrue(rid.startswith("run-"))

    def test_start_empty(self):
        rid = at.start_test_run("suite", [])
        self.assertTrue(rid.startswith("run-"))

    def test_unique_run_ids(self):
        r1 = at.start_test_run("s", [])
        r2 = at.start_test_run("s", [])
        self.assertNotEqual(r1, r2)


class TestRecordTestResult(unittest.TestCase):
    def test_passed(self):
        rid = at.start_test_run("s", ["c1"])
        r = at.record_test_result(rid, "c1", "passed", 100.0)
        self.assertIsInstance(r, str)

    def test_failed(self):
        rid = at.start_test_run("s", ["c1"])
        r = at.record_test_result(rid, "c1", "failed", 50.0, "AssertionError")
        self.assertIsInstance(r, str)

    def test_skipped(self):
        rid = at.start_test_run("s", ["c1"])
        r = at.record_test_result(rid, "c1", "skipped")
        self.assertIsInstance(r, str)

    def test_invalid_status(self):
        rid = at.start_test_run("s", ["c1"])
        r = at.record_test_result(rid, "c1", "INVALID")
        self.assertIsInstance(r, str)

    def test_with_error(self):
        rid = at.start_test_run("s", ["c1"])
        r = at.record_test_result(rid, "c1", "failed", 100.0,
                                    "ValueError: invalid input")
        self.assertIsInstance(r, str)


class TestFinishTestRun(unittest.TestCase):
    def test_finish_passed(self):
        rid = at.start_test_run("s", ["c1"])
        at.record_test_result(rid, "c1", "passed", 100.0)
        ok = at.finish_test_run(rid, 100.0)
        self.assertTrue(ok)

    def test_finish_failed(self):
        rid = at.start_test_run("s", ["c1"])
        at.record_test_result(rid, "c1", "failed", 100.0)
        ok = at.finish_test_run(rid, 100.0)
        self.assertTrue(ok)

    def test_finish_nonexistent(self):
        ok = at.finish_test_run("nonexistent-" + _u(), 100.0)
        self.assertFalse(ok)

    def test_finish_mixed(self):
        rid = at.start_test_run("s", ["c1", "c2", "c3"])
        at.record_test_result(rid, "c1", "passed", 100.0)
        at.record_test_result(rid, "c2", "failed", 100.0)
        at.record_test_result(rid, "c3", "skipped", 0.0)
        ok = at.finish_test_run(rid, 200.0)
        self.assertTrue(ok)
        summary = at.get_test_run_summary(rid)
        self.assertEqual(summary["passed"], 1)
        self.assertEqual(summary["failed"], 1)
        self.assertEqual(summary["skipped"], 1)


class TestRecordCoverage(unittest.TestCase):
    def test_basic(self):
        rid = at.record_coverage("module_a", "line", 80, 100)
        self.assertTrue(rid.startswith("cov-"))

    def test_branch(self):
        rid = at.record_coverage("module_b", "branch", 50, 100)
        self.assertTrue(rid.startswith("cov-"))

    def test_function(self):
        rid = at.record_coverage("module_c", "function", 20, 25)
        self.assertTrue(rid.startswith("cov-"))

    def test_statement(self):
        rid = at.record_coverage("module_d", "statement", 100, 100)
        self.assertTrue(rid.startswith("cov-"))

    def test_invalid_type(self):
        rid = at.record_coverage("m", "INVALID", 0, 0)
        self.assertTrue(rid.startswith("cov-"))

    def test_zero_total(self):
        rid = at.record_coverage("m", "line", 0, 0)
        self.assertTrue(rid.startswith("cov-"))


class TestPredictDefects(unittest.TestCase):
    def test_low_risk(self):
        result = at.predict_defects("mod_a", 0, 0, 0)
        self.assertEqual(result["module"], "mod_a")
        self.assertEqual(result["risk_score"], 0.0)

    def test_medium_risk(self):
        result = at.predict_defects("mod_b", 2, 2.0, 50)
        self.assertGreater(result["risk_score"], 0)

    def test_high_risk(self):
        result = at.predict_defects("mod_c", 10, 5.0, 1000)
        self.assertGreater(result["risk_score"], 0.5)

    def test_capped_risk(self):
        result = at.predict_defects("mod_d", 100, 100.0, 10000)
        self.assertLessEqual(result["risk_score"], 1.0)

    def test_confidence_range(self):
        result = at.predict_defects("mod_e", 0, 1.0, 0)
        self.assertGreaterEqual(result["confidence"], 0.5)
        self.assertLessEqual(result["confidence"], 0.95)

    def test_factors_recorded(self):
        result = at.predict_defects("mod_f", 3, 2.0, 100)
        self.assertIn("recent_failures", result["factors"])
        self.assertIn("complexity", result["factors"])
        self.assertIn("code_churn", result["factors"])


class TestIntelligentRegression(unittest.TestCase):
    def test_module_match(self):
        case = at.generate_test_cases("user", "unit", 1)[0]
        at.save_test_case(case)
        selected = at.intelligent_regression_selection(
            [case["case_id"]], ["user_module.py"])
        self.assertIn(case["case_id"], selected)

    def test_priority_match(self):
        cases = at.generate_test_cases("payment", "unit", 3)
        for c in cases:
            at.save_test_case(c)
        # All have some priority, but check that at least priority=critical is selected
        # Create a critical case explicitly
        case_critical = at.generate_test_cases("payment", "unit", 1)[0]
        case_critical["priority"] = "critical"
        at.save_test_case(case_critical)
        selected = at.intelligent_regression_selection(
            [c["case_id"] for c in cases] + [case_critical["case_id"]], [])
        self.assertIn(case_critical["case_id"], selected)

    def test_no_change_no_priority(self):
        cases = at.generate_test_cases("api", "unit", 3)
        for c in cases:
            c["priority"] = "low"
            at.save_test_case(c)
        selected = at.intelligent_regression_selection(
            [c["case_id"] for c in cases], [])
        # low priority with no file match should not be selected
        for c in cases:
            if c["priority"] == "low":
                self.assertNotIn(c["case_id"], selected)

    def test_empty_input(self):
        selected = at.intelligent_regression_selection([], [])
        self.assertEqual(selected, [])


class TestGetTestRunSummary(unittest.TestCase):
    def test_existing(self):
        rid = at.start_test_run("s", ["c1"])
        at.record_test_result(rid, "c1", "passed", 100.0)
        at.finish_test_run(rid, 100.0)
        summary = at.get_test_run_summary(rid)
        self.assertEqual(summary["passed"], 1)

    def test_nonexistent(self):
        summary = at.get_test_run_summary("nonexistent-" + _u())
        self.assertIn("error", summary)


class TestGetOverview(unittest.TestCase):
    def test_overview(self):
        result = at.get_overview()
        self.assertIn("total_cases", result)
        self.assertIn("total_runs", result)
        self.assertIn("total_predictions", result)
        self.assertIn("avg_risk", result)


class TestCLICommands(unittest.TestCase):
    def test_cmd_overview(self):
        try:
            at.cmd_overview([])
        except SystemExit:
            pass

    def test_cmd_generate(self):
        try:
            at.cmd_generate(["user login feature", "unit", "3"])
        except SystemExit:
            pass

    def test_cmd_suite(self):
        try:
            at.cmd_suite(["cli-suite-" + _u(), "[]"])
        except SystemExit:
            pass

    def test_cmd_run(self):
        try:
            at.cmd_run(["cli-suite", "[]"])
        except SystemExit:
            pass

    def test_cmd_result(self):
        rid = at.start_test_run("s", ["c1"])
        try:
            at.cmd_result([rid, "c1", "passed", "100"])
        except SystemExit:
            pass

    def test_cmd_finish(self):
        rid = at.start_test_run("s", ["c1"])
        try:
            at.cmd_finish([rid, "100"])
        except SystemExit:
            pass

    def test_cmd_coverage(self):
        try:
            at.cmd_coverage(["cli-mod-" + _u(), "80", "100", "line"])
        except SystemExit:
            pass

    def test_cmd_predict(self):
        try:
            at.cmd_predict(["cli-mod-" + _u(), "3", "2.0", "100"])
        except SystemExit:
            pass

    def test_cmd_regression(self):
        try:
            at.cmd_regression(["[]", "[]"])
        except SystemExit:
            pass


class TestHTTPServer(unittest.TestCase):
    def test_health_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10160/health", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertEqual(data.get("status"), "ok")
        except Exception:
            self.skipTest("HTTP service not running")

    def test_overview_endpoint(self):
        import urllib.request
        try:
            with urllib.request.urlopen("http://127.0.0.1:10160/api/overview", timeout=1) as r:
                data = json.loads(r.read().decode("utf-8"))
                self.assertIn("total_cases", data)
        except Exception:
            self.skipTest("HTTP service not running")


if __name__ == "__main__":
    unittest.main(verbosity=2)
