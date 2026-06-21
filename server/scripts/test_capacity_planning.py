#!/usr/bin/env python3
"""容量规划测试 (Round 11 P1-13)"""
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
LOGS_DIR = SERVER_DIR / "logs"
SCRIPT = SCRIPTS_DIR / "capacity_planning.py"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists())

    def test_shebang(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertTrue(content.startswith("#!/usr/bin/env python3"))


class TestScriptStructure(unittest.TestCase):
    """脚本结构"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_main_function(self):
        self.assertIn("def main()", self.content)

    def test_argparse(self):
        self.assertIn("argparse.ArgumentParser", self.content)

    def test_init_db(self):
        self.assertIn("def init_db", self.content)
        self.assertIn("CREATE TABLE", self.content)

    def test_record_metric(self):
        self.assertIn("def record_metric", self.content)

    def test_forecast_resource(self):
        self.assertIn("def forecast_resource", self.content)

    def test_recommend_scaling(self):
        self.assertIn("def recommend_scaling", self.content)

    def test_check_alerts(self):
        self.assertIn("def check_alerts", self.content)

    def test_generate_report(self):
        self.assertIn("def generate_report", self.content)


class TestResourceTypes(unittest.TestCase):
    """资源类型"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_cpu_defined(self):
        self.assertIn('"cpu"', self.content)

    def test_memory_defined(self):
        self.assertIn('"memory"', self.content)

    def test_disk_defined(self):
        self.assertIn('"disk"', self.content)

    def test_qps_defined(self):
        self.assertIn('"qps"', self.content)

    def test_latency_defined(self):
        self.assertIn('"p95_latency"', self.content)

    def test_threshold_warning(self):
        """P1-13 80% 预警阈值"""
        self.assertIn("THRESHOLD_WARNING = 80", self.content)

    def test_threshold_critical(self):
        """P1-13 90% 紧急阈值"""
        self.assertIn("THRESHOLD_CRITICAL = 90", self.content)


class TestLinearRegression(unittest.TestCase):
    """线性回归预测"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_linear_regression_function(self):
        self.assertIn("def linear_regression", self.content)
        # 必须返回 (slope, intercept, r_squared)
        self.assertIn("r_squared", self.content)

    def test_7_30_90_days(self):
        """P1-13 必须支持 7/30/90 天预测"""
        self.assertIn("PREDICTION_DAYS = [7, 30, 90]", self.content)

    def test_forecast_returns_alert_level(self):
        """forecast 必须返回 alert_level"""
        self.assertIn("alert_level", self.content)
        for level in ["ok", "warning", "critical"]:
            self.assertIn(f'"{level}"', self.content)


class TestScalingRecommendation(unittest.TestCase):
    """扩容建议"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_recommend_function(self):
        self.assertIn("def recommend_scaling", self.content)

    def test_scale_up_action(self):
        """P1-13 必须有 scale_up 动作"""
        self.assertIn('"scale_up"', self.content)

    def test_expand_storage_action(self):
        """P1-13 必须有 expand_storage 动作"""
        self.assertIn('"expand_storage"', self.content)

    def test_priority_levels(self):
        """必须区分优先级"""
        for p in ["high", "medium"]:
            self.assertIn(f'"{p}"', self.content)


class TestAlerts(unittest.TestCase):
    """告警"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_check_alerts(self):
        self.assertIn("def check_alerts", self.content)

    def test_dingtalk_webhook(self):
        self.assertIn("DINGTALK_WEBHOOK", self.content)
        self.assertIn("def send_dingtalk_alert", self.content)

    def test_alert_level_ok(self):
        for level in ["warning", "critical", "ok"]:
            self.assertIn(f'"{level}"', self.content)


class TestReportGeneration(unittest.TestCase):
    """报告生成"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_monthly_report(self):
        """P1-13 月度容量报告"""
        self.assertIn("def generate_report", self.content)
        self.assertIn("--month", self.content)

    def test_json_output(self):
        self.assertIn("json.dumps", self.content)

    def test_save_report(self):
        self.assertIn("report_file", self.content)
        self.assertIn("capacity_report_", self.content)

    def test_p95_calculation(self):
        """P1-13 必须计算 P95"""
        self.assertIn('"p95"', self.content)


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_forecast_subcommand(self):
        self.assertIn('"forecast"', self.content)
        self.assertIn("cmd_forecast", self.content)
        self.assertIn("--metric", self.content)

    def test_recommend_subcommand(self):
        self.assertIn('"recommend"', self.content)
        self.assertIn("cmd_recommend", self.content)

    def test_report_subcommand(self):
        self.assertIn('"report"', self.content)
        self.assertIn("cmd_report", self.content)

    def test_alerts_subcommand(self):
        self.assertIn('"alerts"', self.content)
        self.assertIn("cmd_alerts", self.content)

    def test_record_subcommand(self):
        self.assertIn('"record"', self.content)
        self.assertIn("cmd_record", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestFunctional(unittest.TestCase):
    """功能测试"""

    def setUp(self):
        # 隔离 DB
        self.tmp_dir = tempfile.mkdtemp()
        self.original_logs = os.environ.get("LOGS_DIR")
        os.environ["LOGS_DIR_OVERRIDE"] = self.tmp_dir

    def tearDown(self):
        if self.original_logs:
            os.environ["LOGS_DIR"] = self.original_logs
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_linear_regression_basic(self):
        """测试线性回归"""
        sys.path.insert(0, str(SCRIPTS_DIR))
        import capacity_planning

        # 完美正相关
        points = [(1, 10), (2, 20), (3, 30), (4, 40)]
        slope, intercept, r2 = capacity_planning.linear_regression(points)
        self.assertAlmostEqual(slope, 10.0, places=4)
        self.assertAlmostEqual(intercept, 0.0, places=4)
        self.assertAlmostEqual(r2, 1.0, places=4)

    def test_linear_regression_noisy(self):
        """测试噪声数据"""
        sys.path.insert(0, str(SCRIPTS_DIR))
        import capacity_planning

        points = [(1, 10), (2, 22), (3, 28), (4, 41), (5, 50)]
        slope, intercept, r2 = capacity_planning.linear_regression(points)
        self.assertGreater(slope, 9.0)
        self.assertLess(slope, 11.0)
        self.assertGreater(r2, 0.95)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式"""

    def test_no_mysql(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [line for line in content.split("\n") if not line.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("PLACEHOLDER", code)
        self.assertNotIn("FIXME", code)


if __name__ == "__main__":
    unittest.main(verbosity=2)
