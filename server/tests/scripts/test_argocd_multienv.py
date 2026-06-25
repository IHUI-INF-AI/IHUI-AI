#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""ArgoCD ApplicationSet 多环境管理测试 (Round 11 P0-11)

测试覆盖:
  1. manifest 存在性 + 校验
  2. 3 套环境 (dev/staging/production)
  3. 3 个集群 (aliyun/huawei/aws)
  4. 4 个应用 (core/api/web/worker)
  5. AppProject 项目隔离
  6. 同步窗口配置
  7. 通知配置 (钉钉 + Slack)
  8. 自动修复 (selfHeal)
  9. 角色配置 (admin/developer/releaser)
  10. 脚本功能
"""
import re
import sys
import json
import unittest
from pathlib import Path
from datetime import datetime, timezone

SCRIPTS_DIR = Path(__file__).resolve().parent
SERVER_DIR = SCRIPTS_DIR.parent
DEPLOY_DIR = SERVER_DIR / "deploy"
ARGOCD_DIR = DEPLOY_DIR / "argocd"
MANIFEST = ARGOCD_DIR / "applicationset_multienv.yaml"
SCRIPT = SCRIPTS_DIR / "argocd_multienv.py"


class TestManifestExistence(unittest.TestCase):
    """manifest 存在性"""

    def test_manifest_exists(self):
        self.assertTrue(MANIFEST.exists(), f"缺失: {MANIFEST}")

    def test_manifest_not_empty(self):
        self.assertGreater(MANIFEST.stat().st_size, 1000, "manifest 太小")


class TestApplicationSet(unittest.TestCase):
    """ApplicationSet 配置"""

    @classmethod
    def setUpClass(cls):
        cls.content = MANIFEST.read_text(encoding="utf-8")

    def test_applicationset_kind(self):
        self.assertIn("kind: ApplicationSet", self.content)

    def test_apiversion(self):
        self.assertIn("argoproj.io/v1alpha1", self.content)

    def test_matrix_generator(self):
        """P0-11 必须使用 matrix generator"""
        self.assertIn("matrix:", self.content)

    def test_go_template(self):
        """P0-11 必须使用 goTemplate"""
        self.assertIn("goTemplate: true", self.content)

    def test_self_heal(self):
        """P0-11 必须启用 selfHeal"""
        self.assertIn("selfHeal: true", self.content)

    def test_prune(self):
        """P0-11 必须启用 prune"""
        self.assertIn("prune: true", self.content)

    def test_retry(self):
        """P0-11 必须配置 retry"""
        self.assertIn("retry:", self.content)
        self.assertIn("backoff:", self.content)


class TestEnvironments(unittest.TestCase):
    """环境配置"""

    def setUp(self):
        self.content = MANIFEST.read_text(encoding="utf-8")

    def test_dev_env(self):
        """P0-11 必须有 dev 环境"""
        self.assertIn("env: dev", self.content)

    def test_staging_env(self):
        """P0-11 必须有 staging 环境"""
        self.assertIn("env: staging", self.content)

    def test_production_env(self):
        """P0-11 必须有 production 环境"""
        self.assertIn("env: production", self.content)

    def test_three_environments(self):
        """P0-11 必须有 3 套环境"""
        for env in ["dev", "staging", "production"]:
            self.assertIn(f"env: {env}", self.content)

    def test_env_specific_replica(self):
        """不同环境 replicaCount 不同"""
        # dev 1, staging 2, production 4
        self.assertIn('replicaCount: "1"', self.content)
        self.assertIn('replicaCount: "2"', self.content)
        self.assertIn('replicaCount: "4"', self.content)

    def test_env_specific_log_level(self):
        """不同环境日志级别不同"""
        for level in ["debug", "info", "warning"]:
            self.assertIn(f"logLevel: {level}", self.content)


class TestClusters(unittest.TestCase):
    """集群配置"""

    def setUp(self):
        self.content = MANIFEST.read_text(encoding="utf-8")

    def test_aliyun_cluster(self):
        """P0-11 必须有 aliyun 集群"""
        self.assertIn("aliyun-prod", self.content)
        self.assertIn("cn-hangzhou", self.content)

    def test_huawei_cluster(self):
        """P0-11 必须有 huawei 集群"""
        self.assertIn("huawei-prod", self.content)
        self.assertIn("cn-south-1", self.content)

    def test_aws_cluster(self):
        """P0-11 必须有 aws 集群"""
        self.assertIn("aws-dr", self.content)
        self.assertIn("ap-northeast-1", self.content)

    def test_three_clusters(self):
        """P0-11 必须有 3 个集群"""
        for cluster in ["aliyun-prod", "huawei-prod", "aws-dr"]:
            self.assertIn(cluster, self.content)

    def test_cluster_type(self):
        """必须区分 primary 和 dr"""
        self.assertIn('clusterType: primary', self.content)
        self.assertIn('clusterType: dr', self.content)


class TestApps(unittest.TestCase):
    """应用配置"""

    def setUp(self):
        self.content = MANIFEST.read_text(encoding="utf-8")

    def test_zhs_core(self):
        self.assertIn("zhs-core", self.content)

    def test_zhs_api(self):
        self.assertIn("zhs-api", self.content)

    def test_zhs_web(self):
        self.assertIn("zhs-web", self.content)

    def test_zhs_worker(self):
        self.assertIn("zhs-worker", self.content)

    def test_four_apps(self):
        """P0-11 必须有 4 个应用"""
        for app in ["zhs-core", "zhs-api", "zhs-web", "zhs-worker"]:
            self.assertIn(app, self.content)


class TestAppProject(unittest.TestCase):
    """AppProject 项目隔离"""

    def setUp(self):
        self.content = MANIFEST.read_text(encoding="utf-8")

    def test_appproject_exists(self):
        self.assertIn("kind: AppProject", self.content)

    def test_admin_role(self):
        self.assertIn("name: admin", self.content)
        self.assertIn("p, proj:zhs-platform:admin", self.content)

    def test_developer_role(self):
        self.assertIn("name: developer", self.content)
        self.assertIn("p, proj:zhs-platform:developer", self.content)

    def test_releaser_role(self):
        """P0-11 必须有 releaser 角色 (生产发布)"""
        self.assertIn("name: releaser", self.content)
        self.assertIn("p, proj:zhs-platform:releaser", self.content)

    def test_source_repos(self):
        """必须配置 sourceRepos"""
        self.assertIn("sourceRepos:", self.content)
        self.assertIn("git@github.com:zhs/zhs-gitops.git", self.content)

    def test_destinations(self):
        """必须配置 destinations"""
        self.assertIn("destinations:", self.content)
        self.assertIn("zhs-*", self.content)

    def test_namespace_resource_whitelist(self):
        """必须配置 namespaceResourceWhitelist"""
        self.assertIn("namespaceResourceWhitelist:", self.content)
        for kind in ["Deployment", "StatefulSet", "Service", "ConfigMap", "Secret"]:
            self.assertIn(f"kind: {kind}", self.content)


class TestSyncWindows(unittest.TestCase):
    """同步窗口"""

    def setUp(self):
        self.content = MANIFEST.read_text(encoding="utf-8")

    def test_sync_windows_configured(self):
        self.assertIn("syncWindows:", self.content)

    def test_weekend_deny(self):
        """P0-11 必须配置周末禁止生产部署"""
        self.assertIn("kind: deny", self.content)
        self.assertIn("0 0 * * 6", self.content)
        self.assertIn("24h", self.content)

    def test_business_hours_deny(self):
        """工作日业务高峰禁止生产同步"""
        self.assertIn("0 9 * * 1-5", self.content)
        self.assertIn("8h", self.content)

    def test_low_peak_allow(self):
        """业务低峰期允许生产同步"""
        self.assertIn("kind: allow", self.content)
        self.assertIn("0 2 * * 1-5", self.content)

    def test_production_targeted(self):
        """syncWindows 必须针对生产环境"""
        self.assertIn("*-production-*", self.content)


class TestNotifications(unittest.TestCase):
    """通知配置"""

    def setUp(self):
        self.content = MANIFEST.read_text(encoding="utf-8")

    def test_dingtalk_service(self):
        """P0-11 必须配置钉钉通知"""
        self.assertIn("service.dingtalk", self.content)

    def test_slack_service(self):
        """P0-11 必须配置 Slack 通知"""
        self.assertIn("service.slack", self.content)

    def test_deployed_trigger(self):
        self.assertIn("trigger.on-deployed", self.content)

    def test_sync_failed_trigger(self):
        self.assertIn("trigger.on-sync-failed", self.content)

    def test_health_degraded_trigger(self):
        self.assertIn("trigger.on-health-degraded", self.content)

    def test_prod_specific_trigger(self):
        """P0-11 必须有生产专用 trigger"""
        self.assertIn("on-deployed-prod", self.content)

    def test_subscriptions(self):
        self.assertIn("subscriptions:", self.content)


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

    def test_apply_command(self):
        self.assertIn("cmd_apply", self.content)
        self.assertIn('"apply"', self.content)
        self.assertIn("--dry-run", self.content)

    def test_status_command(self):
        self.assertIn("cmd_status", self.content)
        self.assertIn('"status"', self.content)

    def test_validate_command(self):
        self.assertIn("cmd_validate", self.content)
        self.assertIn("validate_manifest", self.content)

    def test_environments_list(self):
        self.assertIn("ENVIRONMENTS", self.content)
        for env in ["dev", "staging", "production"]:
            self.assertIn(f'"{env}"', self.content)

    def test_clusters_list(self):
        self.assertIn("CLUSTERS", self.content)
        for cluster in ["aliyun-prod", "huawei-prod", "aws-dr"]:
            self.assertIn(cluster, self.content)

    def test_apps_list(self):
        self.assertIn("APPS", self.content)
        for app in ["zhs-core", "zhs-api", "zhs-web", "zhs-worker"]:
            self.assertIn(app, self.content)

    def test_kubectl_integration(self):
        self.assertIn("kubectl", self.content)
        self.assertIn("kubectl_apply", self.content)

    def test_argocd_cli_integration(self):
        self.assertIn("argocd", self.content.lower())
        self.assertIn("run_argocd", self.content)


class TestNoBannedPatterns(unittest.TestCase):
    """禁用模式"""

    def test_no_mysql(self):
        content = MANIFEST.read_text(encoding="utf-8")
        self.assertNotIn("mysql", content.lower())
        self.assertNotIn("mariadb", content.lower())

    def test_no_todo_in_manifest(self):
        content = MANIFEST.read_text(encoding="utf-8")
        self.assertNotIn("PLACEHOLDER", content)
        self.assertNotIn("FIXME", content)

    def test_no_todo_in_script(self):
        content = SCRIPT.read_text(encoding="utf-8")
        code_lines = [line for line in content.split("\n") if not line.strip().startswith("#")]
        code = "\n".join(code_lines)
        self.assertNotIn("PLACEHOLDER", code)
        self.assertNotIn("FIXME", code)


if __name__ == "__main__":
    unittest.main(verbosity=2)
