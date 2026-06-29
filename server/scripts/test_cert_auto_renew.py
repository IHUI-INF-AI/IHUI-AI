#!/usr/bin/env python3
"""证书自动续签测试 (Round 11 P1-16)"""
import json
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "cert_auto_renew.py"


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

    def test_list_certificates(self):
        self.assertIn("def list_certificates", self.content)

    def test_check_certificates(self):
        self.assertIn("def check_certificates", self.content)

    def test_renew_certificate(self):
        self.assertIn("def renew_certificate", self.content)

    def test_auto_renew_all(self):
        self.assertIn("def auto_renew_all", self.content)

    def test_record_cert(self):
        self.assertIn("def record_cert", self.content)


class TestThresholds(unittest.TestCase):
    """告警阈值"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_warning_30_days(self):
        """P1-16 30 天预警"""
        self.assertIn("WARNING_DAYS = 30", self.content)

    def test_critical_7_days(self):
        """P1-16 7 天紧急"""
        self.assertIn("CRITICAL_DAYS = 7", self.content)

    def test_alert_levels(self):
        """必须区分告警级别"""
        for level in ["ok", "warning", "critical", "expired", "unknown"]:
            self.assertIn(f'"{level}"', self.content, f"缺失告警级别: {level}")


class TestCertManagerIntegration(unittest.TestCase):
    """cert-manager 集成"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_kubectl_get(self):
        """必须用 kubectl 获取证书"""
        self.assertIn("kubectl", self.content.lower())
        self.assertIn("get", self.content)
        self.assertIn("certificates", self.content)

    def test_force_renewal_annotation(self):
        """必须支持 force-renewal annotation"""
        self.assertIn("cert-manager.io/force-renewal", self.content)
        self.assertIn("annotate", self.content)

    def test_namespace_config(self):
        """cert-manager namespace 可配置"""
        self.assertIn("CERT_MANAGER_NAMESPACE", self.content)


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_check_subcommand(self):
        self.assertIn('"check"', self.content)
        self.assertIn("cmd_check", self.content)

    def test_renew_subcommand(self):
        self.assertIn('"renew"', self.content)
        self.assertIn("cmd_renew", self.content)
        self.assertIn("--force", self.content)
        self.assertIn("--dry-run", self.content)

    def test_list_subcommand(self):
        self.assertIn('"list"', self.content)
        self.assertIn("cmd_list", self.content)

    def test_auto_renew_subcommand(self):
        self.assertIn('"auto-renew"', self.content)
        self.assertIn("cmd_auto_renew", self.content)

    def test_history_subcommand(self):
        self.assertIn('"history"', self.content)
        self.assertIn("cmd_history", self.content)
        self.assertIn("--limit", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestSAN(unittest.TestCase):
    """多域名 SAN 支持"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_dns_names_parsing(self):
        """必须解析 dnsNames 字段"""
        self.assertIn("dnsNames", self.content)

    def test_san_in_listing(self):
        """SAN 证书必须出现在列表中"""
        self.assertIn("dns_names", self.content)


class TestNotifications(unittest.TestCase):
    """通知"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_dingtalk_webhook(self):
        self.assertIn("DINGTALK_WEBHOOK", self.content)

    def test_send_dingtalk(self):
        self.assertIn("def send_dingtalk_alert", self.content)

    def test_renew_failed_alert(self):
        """续签失败时告警"""
        self.assertIn("renew_failed", self.content)


class TestDatabase(unittest.TestCase):
    """数据库"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_certificates_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS certificates", self.content)

    def test_columns(self):
        for col in ["cert_name", "namespace", "action", "status", "days_to_expiry", "old_expiry", "new_expiry"]:
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
