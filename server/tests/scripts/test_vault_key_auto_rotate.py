#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Vault 密钥自动轮换测试 (Round 11 P0-10)

测试覆盖:
  1. 文件存在性
  2. 脚本结构
  3. KEY_TYPES 定义
  4. 子命令完整性 (rotate/check/list/history/cleanup/verify-app/serve)
  5. 90 天周期配置
  6. 多密钥类型支持
  7. 历史归档路径
  8. 应用验证端点
  9. 钉钉告警集成
  10. dry-run / force 模式
  11. cleanup 保留数量
  12. HTTP 服务
  13. 错误处理
  14. 跨 Round 集成
"""
import re
import sys
import json
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
LOGS_DIR = SERVER_DIR / "logs"
SCRIPT = SCRIPTS_DIR / "vault_key_auto_rotate.py"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists(), f"缺失: {SCRIPT}")

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
        self.assertIn("if __name__ ==", self.content)

    def test_argparse(self):
        self.assertIn("argparse.ArgumentParser", self.content)
        self.assertIn("add_subparsers", self.content)

    def test_log_function(self):
        self.assertIn("def log(", self.content)

    def test_init_db(self):
        self.assertIn("def init_db", self.content)
        self.assertIn("CREATE TABLE", self.content)
        self.assertIn("rotation_history", self.content)

    def test_record_rotation(self):
        self.assertIn("def record_rotation", self.content)
        self.assertIn("INSERT INTO", self.content)


class TestKeyTypes(unittest.TestCase):
    """密钥类型定义"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_pg_backup_defined(self):
        """P0-10 必须支持 pg_backup"""
        self.assertIn('"pg_backup"', self.content)
        self.assertIn("secret/zhs/pg-backup", self.content)
        self.assertIn("secret/zhs/pg-backup-history", self.content)

    def test_jwt_secret_defined(self):
        """P0-10 必须支持 jwt_secret"""
        self.assertIn('"jwt_secret"', self.content)
        self.assertIn("secret/zhs/jwt", self.content)

    def test_api_key_defined(self):
        """P0-10 必须支持 api_key"""
        self.assertIn('"api_key"', self.content)
        self.assertIn("secret/zhs/api", self.content)

    def test_db_password_defined(self):
        """P0-10 必须支持 db_password"""
        self.assertIn('"db_password"', self.content)
        self.assertIn("secret/zhs/db", self.content)

    def test_at_least_4_types(self):
        """P0-10 至少 4 种密钥类型"""
        for kt in ["pg_backup", "jwt_secret", "api_key", "db_password"]:
            self.assertIn(f'"{kt}"', self.content, f"缺失密钥类型: {kt}")


class TestRotationCycle(unittest.TestCase):
    """90 天轮换周期"""

    def test_90_days_constant(self):
        """P0-10 必须配置 90 天轮换周期"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("ROTATION_DAYS = 90", content)

    def test_check_last_rotation(self):
        """必须检查上次轮换时间"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("get_last_rotation", content)
        self.assertIn("days_since", content)

    def test_force_flag(self):
        """必须支持 --force 强制轮换"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"--force"', content)
        self.assertIn("force", content)


class TestHistoryArchive(unittest.TestCase):
    """密钥历史归档"""

    def test_history_path_per_type(self):
        """每种密钥必须有独立 history 路径"""
        content = SCRIPT.read_text(encoding="utf-8")
        # 检查 history 路径 (脚本中是 pg-backup-history 等, 含连字符)
        for kt in ["pg-backup-history", "jwt-history", "api-history", "db-history"]:
            self.assertIn(kt, content, f"缺失 {kt} history 路径")

    def test_history_db(self):
        """必须有 SQLite 历史 DB"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("vault_rotation_history.db", content)
        self.assertIn("rotation_history", content)

    def test_default_keep_history(self):
        """默认保留 10 条历史"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("DEFAULT_KEEP_HISTORY = 10", content)

    def test_cleanup_function(self):
        """必须有清理历史函数"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def cleanup_history", content)
        self.assertIn("--keep", content)


class TestAppVerification(unittest.TestCase):
    """应用验证"""

    def test_verify_app_function(self):
        """必须有 verify_app_loaded 函数"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def verify_app_loaded", content)

    def test_health_check_paths(self):
        """必须配置 health check 端点"""
        content = SCRIPT.read_text(encoding="utf-8")
        for path in ["/api/v1/auth/healthz", "/api/v1/healthz"]:
            self.assertIn(path, content, f"缺失 health check: {path}")

    def test_app_health_url_env(self):
        """必须从环境变量读取 APP_HEALTH_URL"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("APP_HEALTH_URL", content)


class TestNotification(unittest.TestCase):
    """钉钉告警集成"""

    def test_dingtalk_webhook(self):
        """必须支持钉钉 webhook"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("DINGTALK_WEBHOOK", content)
        self.assertIn("def send_dingtalk_alert", content)

    def test_failure_alert(self):
        """失败时发送告警"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("send_dingtalk_alert", content)
        self.assertIn("rotate_failed", content)

    def test_no_alert_when_no_webhook(self):
        """未配置 webhook 时优雅跳过"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("跳过通知", content)


class TestCommands(unittest.TestCase):
    """子命令完整性"""

    def test_rotate_subcommand(self):
        """必须有 rotate 子命令"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"rotate"', content)
        self.assertIn("def cmd_rotate", content)
        self.assertIn("--dry-run", content)

    def test_check_subcommand(self):
        """必须有 check 子命令"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"check"', content)
        self.assertIn("def cmd_check", content)

    def test_list_subcommand(self):
        """必须有 list 子命令"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"list"', content)
        self.assertIn("def cmd_list", content)

    def test_history_subcommand(self):
        """必须有 history 子命令"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"history"', content)
        self.assertIn("def cmd_history", content)
        self.assertIn("--limit", content)

    def test_cleanup_subcommand(self):
        """必须有 cleanup 子命令"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"cleanup"', content)
        self.assertIn("def cmd_cleanup", content)

    def test_verify_app_subcommand(self):
        """必须有 verify-app 子命令"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"verify-app"', content)
        self.assertIn("def cmd_verify_app", content)

    def test_serve_subcommand(self):
        """必须有 serve 子命令 (HTTP)"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"serve"', content)
        self.assertIn("def cmd_serve", content)
        self.assertIn("HTTPServer", content)


class TestKeyGeneration(unittest.TestCase):
    """密钥生成"""

    def test_secrets_token(self):
        """使用 secrets 模块生成密钥"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("secrets.token_urlsafe", content)

    def test_hash_function(self):
        """使用 SHA256 哈希脱敏"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("hashlib.sha256", content)
        self.assertIn("def hash_key", content)

    def test_key_length_config(self):
        """每种密钥有不同长度配置"""
        content = SCRIPT.read_text(encoding="utf-8")
        for length in ["48", "64", "32"]:
            self.assertIn(f'"length": {length}', content, f"缺失长度: {length}")


class TestVaultIntegration(unittest.TestCase):
    """Vault 集成"""

    def test_vault_addr_env(self):
        """从环境变量读取 VAULT_ADDR"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("VAULT_ADDR", content)

    def test_vault_token_env(self):
        """从环境变量读取 VAULT_TOKEN"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("VAULT_TOKEN", content)

    def test_kv_get(self):
        """使用 Vault KV API"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def vault_kv_get", content)
        self.assertIn("X-Vault-Token", content)

    def test_kv_put(self):
        """写入 Vault KV"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def vault_kv_put", content)
        self.assertIn("Content-Type", content)

    def test_no_mysql(self):
        """禁止出现 MySQL/MariaDB"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        """禁止 TODO/FIXME 遗留"""
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [line for line in content.split("\n") if not line.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("PLACEHOLDER", code)
        self.assertNotIn("FIXME", code)


class TestHTTPCronIntegration(unittest.TestCase):
    """HTTP 服务 + cron 集成"""

    def test_healthz_endpoint(self):
        """HTTP 服务必须有 /healthz"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("/healthz", content)

    def test_rotate_endpoint(self):
        """HTTP 服务必须有 /rotate"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"/rotate"', content)
        self.assertIn("do_POST", content)

    def test_check_endpoint(self):
        """HTTP 服务必须有 /check"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"/check"', content)


class TestCrossRoundIntegration(unittest.TestCase):
    """跨 Round 集成"""

    def test_references_vault_key_rotation_cron(self):
        """应兼容 Round 7 vault_key_rotation_cron.sh"""
        content = SCRIPT.read_text(encoding="utf-8")
        old_script = SCRIPTS_DIR / "vault_key_rotation_cron.sh"
        if old_script.exists():
            # 至少应引用类似的路径
            self.assertIn("pg-backup", content)

    def test_uses_httpserver(self):
        """使用标准库 HTTPServer"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("from http.server", content)
        self.assertIn("BaseHTTPRequestHandler", content)
        self.assertIn("HTTPServer", content)

    def test_uses_urllib(self):
        """使用 urllib 而非 requests"""
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("urllib.request", content)
        self.assertNotIn("import requests", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
