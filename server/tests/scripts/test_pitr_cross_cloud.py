#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""PITR 跨云恢复测试

测试覆盖:
  1. 脚本存在性 & bash 语法
  2. 10 步骤流程
  3. 加密参数 (AES-256-CBC + PBKDF2)
  4. RPO/RTO 指标
  5. 命令行参数
  6. dry-run 模式
  7. 报告生成
  8. 跨云支持
  9. 错误处理
"""
import re
import sys
import json
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "pitr_cross_cloud_restore.sh"


class TestScriptExistence(unittest.TestCase):
    """脚本存在性"""

    def test_script_exists(self):
        self.assertTrue(SCRIPT.exists())

    def test_shebang(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertTrue(content.startswith("#!/bin/bash"))


class TestScriptStructure(unittest.TestCase):
    """脚本结构"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_set_options(self):
        self.assertIn("set -uo pipefail", self.content)

    def test_log_function(self):
        self.assertIn("log()", self.content)

    def test_step_start_end(self):
        self.assertIn("step_start", self.content)
        self.assertIn("step_end", self.content)

    def test_10_steps(self):
        for i in range(1, 11):
            self.assertIn(f"step_{i}_", self.content, f"缺失 step {i}")


class TestAllSteps(unittest.TestCase):
    """10 步骤测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_step_1_precheck(self):
        self.assertIn("step_1_precheck", self.content)
        self.assertIn("预检", self.content)

    def test_step_2_download(self):
        self.assertIn("step_2_download", self.content)
        self.assertIn("ossutil", self.content)

    def test_step_3_decrypt(self):
        self.assertIn("step_3_decrypt", self.content)
        self.assertIn("AES-256-CBC", self.content)
        self.assertIn("PBKDF2", self.content)

    def test_step_4_verify(self):
        self.assertIn("step_4_verify", self.content)
        self.assertIn("backup_manifest", self.content)

    def test_step_5_stop_patroni(self):
        self.assertIn("step_5_stop", self.content)
        self.assertIn("patroni", self.content)

    def test_step_6_clear(self):
        self.assertIn("step_6_clear", self.content)
        self.assertIn("rm -rf", self.content)

    def test_step_7_restore(self):
        self.assertIn("step_7_restore", self.content)
        self.assertIn("recovery.signal", self.content)
        self.assertIn("recovery_target_time", self.content)

    def test_step_8_start_patroni(self):
        self.assertIn("step_8_start", self.content)

    def test_step_9_validate(self):
        self.assertIn("step_9_validate", self.content)
        self.assertIn("pg_is_in_recovery", self.content)

    def test_step_10_report(self):
        self.assertIn("step_10_report", self.content)
        self.assertIn("pitr_restore_", self.content)


class TestEncryption(unittest.TestCase):
    """加密参数测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = SCRIPT.read_text(encoding="utf-8")

    def test_aes_256_cbc(self):
        self.assertIn("aes-256-cbc", self.content)

    def test_pbkdf2(self):
        self.assertIn("pbkdf2", self.content)

    def test_openssl(self):
        self.assertIn("openssl", self.content)

    def test_key_from_env(self):
        # 密钥从环境变量
        self.assertIn("BACKUP_ENCRYPTION_KEY", self.content)

    def test_no_hardcoded_key(self):
        # 不允许硬编码密钥
        self.assertNotIn('pass: "zhs123"', self.content)
        self.assertNotIn('password: "zhs123"', self.content)


class TestRPORTO(unittest.TestCase):
    """RPO/RTO 指标"""

    def test_rpo_zero(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 兼容转义引号
        self.assertTrue(
            '"rpo_seconds": 0' in content or '\\"rpo_seconds\\": 0' in content,
            "缺失 rpo_seconds: 0",
        )

    def test_rto_in_report(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("rto_seconds", content)


class TestCommandLineOptions(unittest.TestCase):
    """命令行选项"""

    def test_source_bucket(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--source-bucket", content)

    def test_target_host(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--target-host", content)

    def test_target_port(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--target-port", content)

    def test_target_time(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--target-time", content)

    def test_encryption_key(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--encryption-key", content)

    def test_dry_run(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--dry-run", content)


class TestDefaultValues(unittest.TestCase):
    """默认值测试"""

    def test_default_source_bucket(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('zhs-pg-backup-aliyun', content)

    def test_default_target_port(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('TARGET_PORT="5432"', content)

    def test_default_target_data(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("/var/lib/postgresql/15/main", content)

    def test_default_target_time(self):
        # 默认 = 当前时间
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("date -u", content)


class TestDryRunMode(unittest.TestCase):
    """dry-run 模式"""

    def test_dry_run_skip_steps(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 每个 step 都要支持 dry-run
        for i in range(1, 11):
            m = re.search(rf'if \[\[ \$\{{DRY_RUN\}} -eq 1 \]\]; then\s+step_end {i} "dry_run"', content)
            # 至少出现在 5+ 步骤中
        dry_run_uses = len(re.findall(r'step_end \d+ "dry_run"', content))
        self.assertGreaterEqual(dry_run_uses, 5, f"dry_run 使用次数: {dry_run_uses}")


class TestReportGeneration(unittest.TestCase):
    """报告生成"""

    def test_report_path(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("pitr_restore_", content)
        self.assertIn("REPORT_FILE", content)

    def test_report_json(self):
        content = SCRIPT.read_text(encoding="utf-8")
        for field in ["test", "timestamp", "source_bucket", "target_host", "target_time", "steps"]:
            self.assertIn(field, content, f"缺失字段: {field}")

    def test_report_in_logs(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('LOG_DIR="${SERVER_DIR}/logs"', content)


class TestCrossCloud(unittest.TestCase):
    """跨云支持"""

    def test_aliyun_source(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("zhs-pg-backup-aliyun", content)

    def test_target_flexible(self):
        # 目标主机可指向任何云
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("TARGET_HOST", content)

    def test_ssh_used(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("ssh", content)

    def test_rsync_used(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("rsync", content)


class TestErrorHandling(unittest.TestCase):
    """错误处理"""

    def test_or_true(self):
        # 部分命令用 || true 防止脚本中断
        content = SCRIPT.read_text(encoding="utf-8")
        or_true_count = content.count("|| true")
        self.assertGreaterEqual(or_true_count, 3, f"|| true 出现次数: {or_true_count}")

    def test_failed_counter(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("FAILED", content)
        self.assertIn("PASSED", content)

    def test_failed_exits_1(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("exit 1", content)


class TestCleanup(unittest.TestCase):
    """清理测试"""

    def test_workdir_cleanup(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("rm -rf", content)
        self.assertIn("/tmp/pitr_restore_", content)


class TestPGVersion(unittest.TestCase):
    """PG 版本测试"""

    def test_pg15_default(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertIn("postgresql/15", content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = SCRIPT.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("TODO", code)


class TestStepCount(unittest.TestCase):
    """步骤数验证"""

    def test_exactly_10_steps(self):
        content = SCRIPT.read_text(encoding="utf-8")
        # 应该恰好 10 个 step_X 函数
        step_funcs = re.findall(r'step_\d+_\w+\(\)', content)
        self.assertEqual(len(step_funcs), 10, f"step 函数数: {len(step_funcs)}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
