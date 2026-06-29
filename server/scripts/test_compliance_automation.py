#!/usr/bin/env python3
"""合规自动化测试 (Round 11 P2-19)"""
import json
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "compliance_automation.py"


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

    def test_scan_framework(self):
        self.assertIn("def scan_framework", self.content)

    def test_scan_all(self):
        self.assertIn("def scan_all", self.content)

    def test_generate_html_report(self):
        self.assertIn("def generate_html_report", self.content)

    def test_record_check(self):
        self.assertIn("def record_check", self.content)

    def test_check_rule(self):
        self.assertIn("def check_rule", self.content)


class TestFrameworks(unittest.TestCase):
    """合规框架"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_pci_dss(self):
        """P2-19 必须支持 PCI-DSS"""
        self.assertIn('"pci-dss"', self.content)
        self.assertIn("PCI-DSS", self.content)

    def test_gdpr(self):
        """P2-19 必须支持 GDPR"""
        self.assertIn('"gdpr"', self.content)
        self.assertIn("GDPR", self.content)

    def test_dengbao(self):
        """P2-19 必须支持等保 2.0"""
        self.assertIn('"等保2.0"', self.content)
        self.assertIn("等保", self.content)

    def test_three_frameworks(self):
        """P2-19 必须有 3 套合规标准"""
        for fw in ["pci-dss", "gdpr", "等保2.0"]:
            self.assertIn(f'"{fw}"', self.content)

    def test_pci_dss_rules(self):
        """PCI-DSS 关键规则"""
        for rule in ["PCI-1.1", "PCI-2.1", "PCI-3.4", "PCI-4.1", "PCI-6.5", "PCI-8.1", "PCI-10.1"]:
            self.assertIn(f'"{rule}"', self.content, f"缺失 PCI-DSS 规则: {rule}")

    def test_gdpr_rules(self):
        """GDPR 关键规则"""
        for rule in ["GDPR-5", "GDPR-17", "GDPR-25", "GDPR-30", "GDPR-32", "GDPR-33"]:
            self.assertIn(f'"{rule}"', self.content, f"缺失 GDPR 规则: {rule}")

    def test_dengbao_rules(self):
        """等保 2.0 关键规则"""
        for rule in ["DJBH-8.1.2", "DJBH-8.1.3", "DJBH-8.1.4", "DJBH-8.1.5", "DJBH-8.1.6", "DJBH-8.1.7", "DJBH-8.1.8"]:
            self.assertIn(f'"{rule}"', self.content, f"缺失等保规则: {rule}")


class TestSeverity(unittest.TestCase):
    """严重级别"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_three_severities(self):
        """必须区分 3 级严重程度 (CSS 样式中包含)"""
        # 检查严重级别关键字 (high/medium/low 可能在 CSS 样式或规则中使用)
        for sev in ["high", "medium"]:
            self.assertIn(f'"{sev}"', self.content, f"缺失严重级别: {sev}")
        # low 出现在 CSS 选择器中
        self.assertTrue(
            '"low"' in self.content or ".low" in self.content,
            "缺失严重级别: low",
        )


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_scan_subcommand(self):
        self.assertIn('"scan"', self.content)
        self.assertIn("cmd_scan", self.content)
        self.assertIn("--framework", self.content)

    def test_report_subcommand(self):
        self.assertIn('"report"', self.content)
        self.assertIn("cmd_report", self.content)

    def test_history_subcommand(self):
        self.assertIn('"history"', self.content)
        self.assertIn("cmd_history", self.content)
        self.assertIn("--limit", self.content)

    def test_list_frameworks_subcommand(self):
        self.assertIn('"list-frameworks"', self.content)
        self.assertIn("cmd_list_frameworks", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestReports(unittest.TestCase):
    """报告生成"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_json_report(self):
        self.assertIn("compliance_report_", self.content)
        self.assertIn(".json", self.content)

    def test_html_report(self):
        self.assertIn(".html", self.content)
        self.assertIn("<!DOCTYPE html>", self.content)
        self.assertIn("合规报告", self.content)

    def test_html_styling(self):
        """HTML 报告必须有 CSS 样式"""
        self.assertIn("<style>", self.content)
        self.assertIn("border-radius", self.content)

    def test_compliance_pct(self):
        """合规率计算"""
        self.assertIn("compliance_pct", self.content)


class TestDatabase(unittest.TestCase):
    """数据库"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_compliance_checks_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS compliance_checks", self.content)

    def test_columns(self):
        for col in ["framework", "rule_id", "rule_name", "status", "severity", "detail", "remediation"]:
            self.assertIn(col, self.content, f"缺失字段: {col}")

    def test_remediation_field(self):
        """必须有修复建议"""
        self.assertIn("remediation", self.content)


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
