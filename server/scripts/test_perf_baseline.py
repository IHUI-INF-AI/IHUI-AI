#!/usr/bin/env python3
"""性能基线管理测试 (Round 11 P2-20)"""
import json
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "perf_baseline.py"


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

    def test_init_db(self):
        self.assertIn("def init_db", self.content)

    def test_set_baseline(self):
        self.assertIn("def set_baseline", self.content)

    def test_check_regression(self):
        self.assertIn("def check_regression", self.content)

    def test_record_measurement(self):
        self.assertIn("def record_measurement", self.content)

    def test_record_slow_query(self):
        self.assertIn("def record_slow_query", self.content)

    def test_get_slow_queries(self):
        self.assertIn("def get_slow_queries", self.content)

    def test_generate_report(self):
        self.assertIn("def generate_report", self.content)


class TestThresholds(unittest.TestCase):
    """阈值"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_regression_20_pct(self):
        """P2-20 回归阈值 20%"""
        self.assertIn("REGRESSION_THRESHOLD_PCT = 20", self.content)

    def test_slow_query_100ms(self):
        """P2-20 慢查询阈值 100ms"""
        self.assertIn("SLOW_QUERY_THRESHOLD_MS = 100", self.content)


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_set_subcommand(self):
        self.assertIn('"set"', self.content)
        self.assertIn("cmd_set", self.content)
        self.assertIn("--p50", self.content)
        self.assertIn("--p95", self.content)
        self.assertIn("--p99", self.content)

    def test_check_subcommand(self):
        self.assertIn('"check"', self.content)
        self.assertIn("cmd_check", self.content)

    def test_record_subcommand(self):
        self.assertIn('"record"', self.content)
        self.assertIn("cmd_record", self.content)
        self.assertIn("--api", self.content)

    def test_report_subcommand(self):
        self.assertIn('"report"', self.content)
        self.assertIn("cmd_report", self.content)

    def test_regression_subcommand(self):
        self.assertIn('"regression"', self.content)
        self.assertIn("cmd_regression", self.content)

    def test_slow_queries_subcommand(self):
        self.assertIn('"slow-queries"', self.content)
        self.assertIn("cmd_slow_queries", self.content)
        self.assertIn("--hours", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestPercentiles(unittest.TestCase):
    """百分位数"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_p50_defined(self):
        self.assertIn("p50_ms", self.content)

    def test_p95_defined(self):
        self.assertIn("p95_ms", self.content)

    def test_p99_defined(self):
        self.assertIn("p99_ms", self.content)

    def test_three_percentiles(self):
        """P2-20 必须有 3 个百分位"""
        for p in ["p50_ms", "p95_ms", "p99_ms"]:
            self.assertIn(p, self.content, f"缺失百分位: {p}")


class TestSuggestion(unittest.TestCase):
    """慢查询优化建议"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_suggestion_function(self):
        self.assertIn("def generate_suggestion", self.content)

    def test_index_suggestion(self):
        """建议添加索引"""
        self.assertIn("考虑添加索引", self.content)

    def test_select_star_suggestion(self):
        """建议避免 SELECT *"""
        self.assertIn("SELECT *", self.content) or self.assertIn("避免 SELECT", self.content)

    def test_like_prefix_suggestion(self):
        """建议避免前缀模糊查询"""
        self.assertIn("前缀模糊", self.content) or self.assertIn("LIKE", self.content)


class TestDatabase(unittest.TestCase):
    """数据库"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_baselines_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS baselines", self.content)

    def test_measurements_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS perf_measurements", self.content)

    def test_slow_queries_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS slow_queries", self.content)

    def test_indexes(self):
        self.assertIn("CREATE INDEX", self.content)


class TestNotifications(unittest.TestCase):
    """钉钉通知"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_dingtalk_webhook(self):
        self.assertIn("DINGTALK_WEBHOOK", self.content)

    def test_send_dingtalk(self):
        self.assertIn("def send_dingtalk_alert", self.content)


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
