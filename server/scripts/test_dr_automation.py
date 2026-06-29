#!/usr/bin/env python3
"""灾备演练自动化测试 (Round 11 P1-15)"""
import json
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "dr_automation.py"


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
        self.assertIn("CREATE TABLE", self.content)

    def test_run_drill(self):
        self.assertIn("def run_drill", self.content)

    def test_get_schedule(self):
        self.assertIn("def get_schedule", self.content)

    def test_get_calendar(self):
        self.assertIn("def get_calendar", self.content)

    def test_generate_sla_report(self):
        self.assertIn("def generate_sla_report", self.content)

    def test_record_drill(self):
        self.assertIn("def record_drill", self.content)


class TestDrillTypes(unittest.TestCase):
    """演练类型"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_pitr_monthly(self):
        """P1-15 月度 PITR"""
        self.assertIn('"pitr_monthly"', self.content)
        self.assertIn("pitr_cross_cloud_restore.sh", self.content)

    def test_failover_monthly(self):
        """P1-15 月度 failover"""
        self.assertIn('"failover_monthly"', self.content)
        self.assertIn("auto_failover_drill.sh", self.content)

    def test_drp_quarterly(self):
        """P1-15 季度 DRP"""
        self.assertIn('"drp_quarterly"', self.content)
        self.assertIn("drp_quarterly_drill.sh", self.content)

    def test_canary_monthly(self):
        """P1-15 月度金丝雀"""
        self.assertIn('"canary_monthly"', self.content)

    def test_four_drill_types(self):
        """P1-15 必须有 4 类演练"""
        for dt in ["pitr_monthly", "failover_monthly", "drp_quarterly", "canary_monthly"]:
            self.assertIn(f'"{dt}"', self.content)


class TestSLA(unittest.TestCase):
    """SLA 目标"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_rto_target(self):
        """P1-15 SLA RTO 1 小时"""
        self.assertIn("SLA_RTO_TARGET = 3600", self.content)

    def test_rpo_target(self):
        """P1-15 SLA RPO 1 分钟"""
        self.assertIn("SLA_RPO_TARGET = 60", self.content)

    def test_sla_meet(self):
        """SLA 达成判断"""
        self.assertIn("sla_meet", self.content)


class TestFrequency(unittest.TestCase):
    """演练频率"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_30_days(self):
        """月度 30 天"""
        self.assertIn('"frequency_days": 30', self.content)

    def test_90_days(self):
        """季度 90 天"""
        self.assertIn('"frequency_days": 90', self.content)

    def test_needs_drill_function(self):
        """needs_drill 函数"""
        self.assertIn("def needs_drill", self.content)


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_run_subcommand(self):
        self.assertIn('"run"', self.content)
        self.assertIn("cmd_run", self.content)
        self.assertIn("--dry-run", self.content)

    def test_schedule_subcommand(self):
        self.assertIn('"schedule"', self.content)
        self.assertIn("cmd_schedule", self.content)

    def test_calendar_subcommand(self):
        self.assertIn('"calendar"', self.content)
        self.assertIn("cmd_calendar", self.content)
        self.assertIn("--months", self.content)

    def test_sla_report_subcommand(self):
        self.assertIn('"sla-report"', self.content)
        self.assertIn("cmd_sla_report", self.content)

    def test_history_subcommand(self):
        self.assertIn('"history"', self.content)
        self.assertIn("cmd_history", self.content)
        self.assertIn("--limit", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestCrossRoundIntegration(unittest.TestCase):
    """跨 Round 集成"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_pitr_script_reference(self):
        """必须引用 Round 10 PITR"""
        self.assertIn("pitr_cross_cloud_restore.sh", self.content)

    def test_drp_script_reference(self):
        """必须引用 Round 10 DRP"""
        self.assertIn("drp_quarterly_drill.sh", self.content)

    def test_canary_script_reference(self):
        """必须引用 Round 10 金丝雀"""
        self.assertIn("canary_auto_rollback", self.content)

    def test_subprocess_execution(self):
        """使用 subprocess 执行"""
        self.assertIn("subprocess.run", self.content)


class TestNotifications(unittest.TestCase):
    """钉钉通知"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_dingtalk_webhook(self):
        self.assertIn("DINGTALK_WEBHOOK", self.content)

    def test_send_dingtalk(self):
        self.assertIn("def send_dingtalk_alert", self.content)

    def test_alert_on_failure(self):
        """失败时告警"""
        self.assertIn("演练失败", self.content)


class TestDatabase(unittest.TestCase):
    """数据库表"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_drill_history_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS drill_history", self.content)

    def test_drill_columns(self):
        for col in ["drill_type", "status", "duration_seconds", "rto_actual_seconds", "rpo_actual_seconds"]:
            self.assertIn(col, self.content, f"缺失字段: {col}")

    def test_indexes(self):
        self.assertIn("CREATE INDEX", self.content)


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
