#!/usr/bin/env python3
"""多租户资源配额测试 (Round 11 P1-14)"""
import json
import sys
import unittest
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
SCRIPT = SCRIPTS_DIR / "tenant_quota.py"


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

    def test_set_quota(self):
        self.assertIn("def set_quota", self.content)

    def test_check_quota(self):
        self.assertIn("def check_quota", self.content)

    def test_record_usage(self):
        self.assertIn("def record_usage", self.content)

    def test_report_all(self):
        self.assertIn("def report_all", self.content)


class TestResourceTypes(unittest.TestCase):
    """资源类型"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_db_conn_defined(self):
        """P1-14 必须支持 db_conn 限制"""
        self.assertIn('"db_conn"', self.content)

    def test_api_rps_defined(self):
        """P1-14 必须支持 api_rps 速率限制"""
        self.assertIn('"api_rps"', self.content)

    def test_storage_gb_defined(self):
        """P1-14 必须支持 storage_gb 限制"""
        self.assertIn('"storage_gb"', self.content)

    def test_six_resources(self):
        """P1-14 至少 6 种资源类型"""
        for rt in ["db_conn", "api_rps", "storage_gb", "cpu_cores", "memory_mb", "bandwidth_mbps"]:
            self.assertIn(f'"{rt}"', self.content, f"缺失资源类型: {rt}")


class TestTenantTiers(unittest.TestCase):
    """租户等级"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_free_tier(self):
        self.assertIn('"free"', self.content)

    def test_basic_tier(self):
        self.assertIn('"basic"', self.content)

    def test_pro_tier(self):
        self.assertIn('"pro"', self.content)

    def test_enterprise_tier(self):
        self.assertIn('"enterprise"', self.content)

    def test_four_tiers(self):
        """P1-14 必须有 4 套租户等级"""
        for tier in ["free", "basic", "pro", "enterprise"]:
            self.assertIn(f'"{tier}"', self.content)


class TestThresholds(unittest.TestCase):
    """告警阈值"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_warning_threshold_80(self):
        """P1-14 80% 预警"""
        self.assertIn("WARNING_THRESHOLD = 80", self.content)

    def test_critical_threshold_95(self):
        """P1-14 95% 紧急"""
        self.assertIn("CRITICAL_THRESHOLD = 95", self.content)


class TestCommands(unittest.TestCase):
    """子命令"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_list_subcommand(self):
        self.assertIn('"list"', self.content)
        self.assertIn("cmd_list", self.content)

    def test_set_subcommand(self):
        self.assertIn('"set"', self.content)
        self.assertIn("cmd_set", self.content)
        self.assertIn("--tenant", self.content)
        self.assertIn("--tier", self.content)

    def test_check_subcommand(self):
        self.assertIn('"check"', self.content)
        self.assertIn("cmd_check", self.content)

    def test_usage_subcommand(self):
        self.assertIn('"usage"', self.content)
        self.assertIn("cmd_usage", self.content)

    def test_report_subcommand(self):
        self.assertIn('"report"', self.content)
        self.assertIn("cmd_report", self.content)

    def test_serve_subcommand(self):
        self.assertIn('"serve"', self.content)
        self.assertIn("cmd_serve", self.content)
        self.assertIn("HTTPServer", self.content)


class TestNotifications(unittest.TestCase):
    """钉钉通知"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_dingtalk_webhook(self):
        self.assertIn("DINGTALK_WEBHOOK", self.content)

    def test_send_dingtalk(self):
        self.assertIn("def send_dingtalk_alert", self.content)


class TestDatabase(unittest.TestCase):
    """数据库表"""

    def setUp(self):
        self.content = SCRIPT.read_text(encoding="utf-8")

    def test_tenant_quotas_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS tenant_quotas", self.content)

    def test_tenant_usage_table(self):
        self.assertIn("CREATE TABLE IF NOT EXISTS tenant_usage", self.content)

    def test_primary_key(self):
        """tenant_quotas 联合主键"""
        self.assertIn("PRIMARY KEY (tenant_id, resource_type)", self.content)

    def test_indexes(self):
        """必须创建索引"""
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
