#!/usr/bin/env python3
"""AI 辅助运维测试 (Round 11 P2-17)"""
import json
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "aiops.py"


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

    def test_detect_anomaly(self):
        self.assertIn("def detect_anomaly", self.content)

    def test_root_cause_analysis(self):
        self.assertIn("def root_cause_analysis", self.content)

    def test_prioritize_alerts(self):
        self.assertIn("def prioritize_alerts", self.content)

    def test_generate_summary(self):
        self.assertIn("def generate_summary", self.content)


class TestAnomalyDetection(unittest.TestCase):
    """异常检测"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_zscore_threshold(self):
        """P2-17 Z-score 阈值"""
        self.assertIn("ANOMALY_THRESHOLD = 2.5", self.content)

    def test_moving_average(self):
        """移动平均"""
        self.assertIn("mean", self.content)
        self.assertIn("stdev", self.content)

    def test_min_data_points(self):
        """最小数据点"""
        self.assertIn("MIN_DATA_POINTS = 30", self.content)

    def test_score_range(self):
        """异常打分 0-100"""
        self.assertIn("min(100", self.content)
        self.assertIn("max(0,", self.content)

    def test_returns_zscore(self):
        """返回 Z-score"""
        self.assertIn("z_score", self.content)

    def test_returns_reason(self):
        """返回异常原因"""
        self.assertIn("reason", self.content)


class TestRootCause(unittest.TestCase):
    """根因分析"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_root_cause_types(self):
        """P2-17 必须支持多种根因类型"""
        for rct in ["resource_exhaustion", "performance_degradation", "service_error", "storage_exhaustion"]:
            self.assertIn(f'"{rct}"', self.content, f"缺失根因类型: {rct}")

    def test_cascading_detection(self):
        """检测级联告警"""
        self.assertIn("is_cascading", self.content)
        self.assertIn("upstream_candidates", self.content)

    def test_confidence_score(self):
        """置信度评分"""
        self.assertIn("confidence", self.content)

    def test_recommendation(self):
        """修复建议"""
        self.assertIn("recommendation", self.content)


class TestPrioritization(unittest.TestCase):
    """告警优先级"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_severity_levels(self):
        """严重级别"""
        for level in ["critical", "warning", "info"]:
            self.assertIn(f'"{level}"', self.content)

    def test_env_priority(self):
        """环境优先级"""
        for env in ["production", "staging", "dev"]:
            self.assertIn(f'"{env}"', self.content)

    def test_priority_score(self):
        """综合评分"""
        self.assertIn("priority_score", self.content)


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_detect_subcommand(self):
        self.assertIn('"detect"', self.content)
        self.assertIn("cmd_detect", self.content)
        self.assertIn("--inject-anomaly", self.content)

    def test_rca_subcommand(self):
        self.assertIn('"rca"', self.content)
        self.assertIn("cmd_rca", self.content)

    def test_prioritize_subcommand(self):
        self.assertIn('"prioritize"', self.content)
        self.assertIn("cmd_prioritize", self.content)

    def test_summary_subcommand(self):
        self.assertIn('"summary"', self.content)
        self.assertIn("cmd_summary", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestFunctional(unittest.TestCase):
    """功能测试"""

    def setUp(self):
        sys.path.insert(0, str(SCRIPTS_DIR))
        import aiops
        self.aiops = aiops

    def test_detect_no_anomaly(self):
        """稳定数据应判定为正常"""
        values = [50.0] * 50
        result = self.aiops.detect_anomaly(values)
        self.assertFalse(result["is_anomaly"])

    def test_detect_with_anomaly(self):
        """离群点应判定为异常"""
        values = [50.0] * 50 + [150.0]
        result = self.aiops.detect_anomaly(values)
        self.assertTrue(result["is_anomaly"])
        self.assertGreater(result["score"], 0)

    def test_detect_insufficient_data(self):
        """数据不足应返回 no_data"""
        values = [50.0, 51.0, 52.0]
        result = self.aiops.detect_anomaly(values)
        self.assertFalse(result["is_anomaly"])
        self.assertIn("数据点不足", result["reason"])

    def test_rca_basic(self):
        """基本 RCA"""
        alert = {"service": "zhs-api", "alert": "HighLatency"}
        result = self.aiops.root_cause_analysis(alert)
        self.assertEqual(result["service"], "zhs-api")
        self.assertIn("recommendation", result)

    def test_prioritize_ordering(self):
        """优先级排序"""
        alerts = [
            {"level": "info", "anomaly_score": 10, "env": "dev", "duration_minutes": 5},
            {"level": "critical", "anomaly_score": 90, "env": "production", "duration_minutes": 60},
            {"level": "warning", "anomaly_score": 50, "env": "staging", "duration_minutes": 30},
        ]
        sorted_alerts = self.aiops.prioritize_alerts(alerts)
        # critical 应该在最前
        self.assertEqual(sorted_alerts[0]["level"], "critical")
        # info 应该在最后
        self.assertEqual(sorted_alerts[-1]["level"], "info")


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
