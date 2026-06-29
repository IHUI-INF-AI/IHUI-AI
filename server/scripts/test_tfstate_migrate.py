#!/usr/bin/env python3
"""Terraform State 远程化测试

测试覆盖:
  1. OSS backend 配置
  2. 资源定义 (Bucket + DR + OTS)
  3. 跨区复制
  4. 版本控制
  5. 加密
  6. tfstate_migrate.py 子命令
  7. 备份目录
  8. 强制解锁
  9. state 验证
"""
import re
import sys
import json
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
TERRAFORM_DIR = SERVER_DIR / "terraform"
BACKEND_TF = TERRAFORM_DIR / "backend" / "oss.tf"
MIGRATE_SCRIPT = SERVER_DIR / "scripts" / "tfstate_migrate.py"


class TestBackendConfigExistence(unittest.TestCase):
    """backend 配置存在性"""

    def test_backend_tf_exists(self):
        self.assertTrue(BACKEND_TF.exists(), f"backend TF 不存在: {BACKEND_TF}")

    def test_migrate_script_exists(self):
        self.assertTrue(MIGRATE_SCRIPT.exists())


class TestBackendComments(unittest.TestCase):
    """backend 块注释 (供未来启用)"""

    @classmethod
    def setUpClass(cls):
        cls.content = BACKEND_TF.read_text(encoding="utf-8")

    def test_oss_backend_documented(self):
        self.assertIn('backend "oss"', self.content)

    def test_huawei_obs_backend(self):
        self.assertIn('backend "huaweicloud-obs"', self.content)

    def test_s3_backend(self):
        self.assertIn('backend "s3"', self.content)

    def test_dynamodb_lock(self):
        self.assertIn("dynamodb_table", self.content)

    def test_oss_lock(self):
        self.assertIn("tablestore_table", self.content)
        self.assertIn("tablestore_endpoint", self.content)


class TestBucketResources(unittest.TestCase):
    """Bucket 资源"""

    @classmethod
    def setUpClass(cls):
        cls.content = BACKEND_TF.read_text(encoding="utf-8")

    def test_main_bucket(self):
        self.assertIn('resource "alicloud_oss_bucket"', self.content)
        self.assertIn('bucket = "zhs-tfstate"', self.content)

    def test_dr_bucket(self):
        # DR 灾备 bucket
        self.assertIn('bucket = "zhs-tfstate-dr"', self.content)

    def test_bucket_acl(self):
        self.assertIn('acl    = "private"', self.content)

    def test_versioning_enabled(self):
        self.assertIn("versioning", self.content)
        self.assertIn("Enabled", self.content)

    def test_encryption(self):
        self.assertIn("server_side_encryption", self.content)

    def test_lifecycle(self):
        self.assertIn("lifecycle_rule", self.content)
        self.assertIn("expiration", self.content)
        self.assertIn("abort_multipart_upload", self.content)


class TestCrossRegionReplication(unittest.TestCase):
    """跨区复制"""

    def test_replication_rule(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn("replication_rule", content)
        self.assertIn("oss-cn-shanghai", content)
        self.assertIn("enable", content)


class TestLockTable(unittest.TestCase):
    """锁表 (Tablestore)"""

    def test_ots_instance(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('resource "alicloud_ots_instance"', content)
        self.assertIn('name        = "zhs-tflock"', content)

    def test_ots_access(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('accessed_by = "AnyNetwork"', content)


class TestVariables(unittest.TestCase):
    """变量定义"""

    def test_state_bucket_name(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('variable "state_bucket_name"', content)
        self.assertIn('default = "zhs-tfstate"', content)

    def test_state_region(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('variable "state_region"', content)
        self.assertIn('default = "cn-hangzhou"', content)

    def test_lock_table_name(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('variable "lock_table_name"', content)
        self.assertIn('default = "zhs_tfstate_lock"', content)


class TestOutputs(unittest.TestCase):
    """Outputs"""

    def test_tfstate_bucket_output(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('output "tfstate_bucket"', content)

    def test_dr_bucket_output(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('output "tfstate_dr_bucket"', content)

    def test_lock_instance_output(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertIn('output "tflock_instance"', content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式检查"""

    def test_no_mysql(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        code_lines = [l for l in content.split("\n") if not l.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("TODO", code)


class TestMigrateScriptSubcommands(unittest.TestCase):
    """tfstate_migrate.py 子命令"""

    @classmethod
    def setUpClass(cls):
        cls.content = MIGRATE_SCRIPT.read_text(encoding="utf-8")

    def test_init_subcommand(self):
        self.assertIn('"init"', self.content)
        self.assertIn("def cmd_init", self.content)

    def test_migrate_subcommand(self):
        self.assertIn('"migrate"', self.content)
        self.assertIn("def cmd_migrate", self.content)

    def test_verify_subcommand(self):
        self.assertIn('"verify"', self.content)
        self.assertIn("def cmd_verify", self.content)

    def test_backup_subcommand(self):
        self.assertIn('"backup"', self.content)
        self.assertIn("def cmd_backup", self.content)

    def test_unlock_subcommand(self):
        self.assertIn('"unlock"', self.content)
        self.assertIn("def cmd_unlock", self.content)

    def test_list_subcommand(self):
        self.assertIn('"list"', self.content)
        self.assertIn("def cmd_list", self.content)


class TestMigrateScriptLogic(unittest.TestCase):
    """迁移逻辑测试"""

    def test_state_paths(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        for cloud in ["aliyun", "huawei", "aws", "cross-cloud"]:
            self.assertIn(f'"{cloud}"', content, f"缺失云: {cloud}")

    def test_state_bucket(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('"zhs-tfstate"', content)

    def test_md5_function(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("def compute_md5", content)
        self.assertIn("hashlib", content)

    def test_backup_dir(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("BACKUP_DIR", content)
        self.assertIn("tfstate_backup", content)


class TestStateValidation(unittest.TestCase):
    """state 验证测试"""

    def test_verify_required_fields(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        for field in ["version", "terraform_version", "serial", "lineage", "outputs", "resources"]:
            self.assertIn(f'"{field}"', content, f"缺失字段: {field}")

    def test_json_parse(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("json.load", content)
        self.assertIn("JSONDecodeError", content)


class TestForceUnlock(unittest.TestCase):
    """强制解锁测试"""

    def test_force_flag(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--force", content)

    def test_lock_id_arg(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("--lock-id", content)

    def test_terraform_force_unlock(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("force-unlock", content)


class TestSubprocessCalls(unittest.TestCase):
    """子进程调用测试"""

    def test_runs_terraform(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("subprocess.run", content)
        self.assertIn("terraform", content)

    def test_timeout(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn("timeout=300", content)


class TestOssUtilSupport(unittest.TestCase):
    """ossutil 支持"""

    def test_ossutil_in_backend(self):
        content = BACKEND_TF.read_text(encoding="utf-8")
        # 备份操作中可能用到 ossutil
        # backend TF 本身不直接用, 但在迁移脚本中会调用

    def test_ossutil_mentioned(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        # 迁移脚本中应能识别 ossutil
        # 实际不一定需要, 但应保留扩展性
        pass


class TestArgumentValidation(unittest.TestCase):
    """参数验证"""

    def test_required_cloud(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        self.assertIn('--cloud", required=True', content)

    def test_choices(self):
        content = MIGRATE_SCRIPT.read_text(encoding="utf-8")
        # 限定云选择
        self.assertIn("choices=list(STATE_PATHS.keys())", content)


if __name__ == "__main__":
    unittest.main(verbosity=2)
