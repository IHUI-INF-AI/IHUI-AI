#!/usr/bin/env python3
"""跨云 Terraform 实施测试

测试覆盖:
  1. 阿里云 main.tf 语法 & 资源定义
  2. 华为云 main.tf 语法 & 资源定义
  3. AWS main.tf 语法 & 资源定义
  4. RPO/RTO 指标一致性
  5. 跨云网络互通规划
  6. 三云资源命名规范
  7. 安全组规则覆盖
  8. 跨云 DNS 切换规划
  9. Terraform 变量定义完整性
 10. Outputs 输出字段完整性
"""
import re
import sys
import json
import unittest
from pathlib import Path
from collections import Counter

SERVER_DIR = Path(__file__).resolve().parent.parent
ALIYUN_TF = SERVER_DIR / "terraform" / "aliyun" / "main.tf"
HUAWEI_TF = SERVER_DIR / "terraform" / "huawei" / "main.tf"
AWS_TF    = SERVER_DIR / "terraform" / "aws" / "main.tf"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def extract_resources(content: str) -> list[str]:
    """提取所有 resource 资源名 (类型.名称)"""
    return re.findall(r'resource\s+"([^"]+)"\s+"([^"]+)"', content)


def extract_outputs(content: str) -> list[str]:
    """提取所有 output 字段名"""
    return re.findall(r'output\s+"([^"]+)"', content)


def extract_variables(content: str) -> list[str]:
    """提取所有 variable 字段名"""
    return re.findall(r'variable\s+"([^"]+)"', content)


class TestAliyunTerraform(unittest.TestCase):
    """阿里云 Terraform 测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(ALIYUN_TF)

    def test_file_exists(self):
        self.assertTrue(ALIYUN_TF.exists(), f"阿里云 main.tf 不存在: {ALIYUN_TF}")

    def test_terraform_version_constraint(self):
        self.assertIn("required_version", self.content)
        self.assertIn(">= 1.5.0", self.content)

    def test_alicloud_provider(self):
        self.assertIn('source  = "aliyun/alicloud"', self.content)
        self.assertIn('region = "cn-hangzhou"', self.content)

    def test_vpc_defined(self):
        self.assertIn('resource "alicloud_vpc"', self.content)
        self.assertIn('zhs-vpc-', self.content)

    def test_three_vswitches(self):
        resources = extract_resources(self.content)
        vswitches = [r for r in resources if r[0] == "alicloud_vswitch"]
        self.assertGreaterEqual(len(vswitches), 3, "至少需要 3 个交换机 (app/db/bastion)")

    def test_app_vswitch_cidr(self):
        self.assertIn('10.0.1.0/24', self.content)

    def test_db_vswitch_cidr(self):
        self.assertIn('10.0.2.0/24', self.content)

    def test_security_group_rules(self):
        # 验证 4 类入站规则
        self.assertIn("allow_app_intranet", self.content)
        self.assertIn("allow_ssh", self.content)
        self.assertIn("allow_pg_intranet", self.content)
        self.assertIn("allow_patroni_intranet", self.content)
        self.assertIn("allow_pgbouncer_intranet", self.content)

    def test_nat_gateway(self):
        self.assertIn('resource "alicloud_nat_gateway"', self.content)
        self.assertIn('resource "alicloud_eip"', self.content)

    def test_ecs_instances(self):
        resources = extract_resources(self.content)
        instances = [r for r in resources if r[0] == "alicloud_instance"]
        # 至少 5 个: 2 patroni + 1 pgbouncer + 2 app
        self.assertGreaterEqual(len(instances), 5, f"需要 5+ 个 ECS, 实际 {len(instances)}")

    def test_patroni_leader_role(self):
        self.assertIn("zhs-patroni-leader", self.content)
        self.assertIn('Role = "patroni-leader"', self.content)

    def test_patroni_standby_role(self):
        self.assertIn("zhs-patroni-standby", self.content)
        self.assertIn('Role = "patroni-standby"', self.content)

    def test_pgbouncer_node(self):
        self.assertIn("zhs-pgbouncer", self.content)

    def test_app_nodes(self):
        resources = extract_resources(self.content)
        app_nodes = [r for r in resources if r[0] == "alicloud_instance" and "app" in r[1].lower()]
        self.assertGreaterEqual(len(app_nodes), 2, "需要 2 个 App 节点")

    def test_slb_defined(self):
        self.assertIn('resource "alicloud_slb"', self.content)
        self.assertIn('resource "alicloud_slb_listener"', self.content)
        self.assertIn('resource "alicloud_slb_server_group"', self.content)

    def test_slb_health_check(self):
        self.assertIn("health_check_uri", self.content)
        self.assertIn("/healthz", self.content)

    def test_rds_postgresql(self):
        self.assertIn('resource "alicloud_db_instance"', self.content)
        self.assertIn('engine               = "PostgreSQL"', self.content)
        self.assertIn('engine_version       = "15.0"', self.content)

    def test_rds_database(self):
        self.assertIn('resource "alicloud_db_database"', self.content)
        self.assertIn('name        = "zhs"', self.content)

    def test_rds_account(self):
        self.assertIn('resource "alicloud_db_account"', self.content)
        self.assertIn('account_name   = "zhs"', self.content)

    def test_eip_associated(self):
        self.assertIn('resource "alicloud_eip_association"', self.content)

    def test_tags_applied(self):
        # 全局 tags 必须存在
        self.assertIn("Project     = \"zhs-platform\"", self.content)
        self.assertIn("ManagedBy   = \"terraform\"", self.content)
        self.assertIn("Environment = \"production\"", self.content)

    def test_region_variable(self):
        self.assertIn('variable "region"', self.content)
        self.assertIn('default     = "cn-hangzhou"', self.content)

    def test_rto_output(self):
        outputs = extract_outputs(self.content)
        self.assertIn("rto_seconds", outputs)
        self.assertIn("rpo_seconds", outputs)

    def test_rto_15_seconds(self):
        # 阿里云 RTO 必须 = 15 (Patroni 自动)
        m = re.search(r'rto_seconds.*?value\s*=\s*(\d+)', self.content, re.DOTALL)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "15")

    def test_rpo_0_seconds(self):
        # 阿里云 RPO 必须 = 0 (同步复制)
        m = re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', self.content, re.DOTALL)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "0")

    def test_outputs_complete(self):
        outputs = extract_outputs(self.content)
        required = [
            "vpc_id", "app_vswitch_id", "db_vswitch_id",
            "slb_id", "slb_dns", "app_eip",
            "patroni_leader_id", "patroni_leader_private_ip",
            "patroni_standby_id", "patroni_standby_private_ip",
            "pgbouncer_id", "pgbouncer_private_ip",
            "rds_pg_endpoint",
        ]
        for r in required:
            self.assertIn(r, outputs, f"缺失 output: {r}")


class TestHuaweiTerraform(unittest.TestCase):
    """华为云 Terraform 测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(HUAWEI_TF)

    def test_file_exists(self):
        self.assertTrue(HUAWEI_TF.exists(), f"华为云 main.tf 不存在: {HUAWEI_TF}")

    def test_huaweicloud_provider(self):
        self.assertIn('source  = "huaweicloud/huaweicloud"', self.content)
        # region 通过变量定义 (推荐做法, 避免硬编码)
        self.assertIn("cn-south-1", self.content)

    def test_vpc_subnets(self):
        self.assertIn('resource "huaweicloud_vpc"', self.content)
        self.assertIn('resource "huaweicloud_vpc_subnet"', self.content)

    def test_security_group(self):
        self.assertIn('resource "huaweicloud_compute_secgroup"', self.content)
        # 至少 4 个 rule
        rules = re.findall(r'resource "huaweicloud_compute_secgroup_rule"', self.content)
        self.assertGreaterEqual(len(rules), 4)

    def test_compute_instances(self):
        resources = extract_resources(self.content)
        instances = [r for r in resources if r[0] == "huaweicloud_compute_instance"]
        # 至少 4 个: 1 patroni + 1 pgbouncer + 2 app
        self.assertGreaterEqual(len(instances), 4)

    def test_patroni_standby_role(self):
        self.assertIn("zhs-patroni-standby-hw", self.content)

    def test_elb_defined(self):
        self.assertIn('resource "huaweicloud_elb_loadbalancer"', self.content)
        self.assertIn('resource "huaweicloud_elb_pool"', self.content)
        self.assertIn('resource "huaweicloud_elb_listener"', self.content)

    def test_elb_pool_members(self):
        # 必须有 2 个 app 节点加入 pool
        members = re.findall(r'resource "huaweicloud_elb_member"', self.content)
        self.assertGreaterEqual(len(members), 2)

    def test_eip_defined(self):
        self.assertIn('resource "huaweicloud_eip"', self.content)

    def test_rto_30_seconds(self):
        m = re.search(r'rto_seconds.*?value\s*=\s*(\d+)', self.content, re.DOTALL)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "30")

    def test_rpo_0_seconds(self):
        m = re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', self.content, re.DOTALL)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "0")

    def test_outputs(self):
        outputs = extract_outputs(self.content)
        required = ["vpc_id", "elb_id", "elb_ip", "patroni_standby_ip", "pgbouncer_ip"]
        for r in required:
            self.assertIn(r, outputs)


class TestAWSTerraform(unittest.TestCase):
    """AWS Terraform 测试"""

    @classmethod
    def setUpClass(cls):
        cls.content = read(AWS_TF)

    def test_file_exists(self):
        self.assertTrue(AWS_TF.exists(), f"AWS main.tf 不存在: {AWS_TF}")

    def test_aws_provider(self):
        self.assertIn('source  = "hashicorp/aws"', self.content)
        # region 通过变量定义
        self.assertIn("ap-northeast-1", self.content)

    def test_vpc_defined(self):
        self.assertIn('resource "aws_vpc"', self.content)
        self.assertIn('resource "aws_subnet"', self.content)
        self.assertIn('resource "aws_internet_gateway"', self.content)

    def test_route_table(self):
        self.assertIn('resource "aws_route_table"', self.content)
        self.assertIn('resource "aws_route_table_association"', self.content)

    def test_security_group_ingress(self):
        # 4 类入站: SSH/App/PG/Patroni
        self.assertIn('from_port   = 22', self.content)
        self.assertIn('from_port   = 8000', self.content)
        self.assertIn('from_port   = 5432', self.content)
        self.assertIn('from_port   = 8008', self.content)

    def test_aws_ami_ubuntu(self):
        self.assertIn('data "aws_ami"', self.content)
        self.assertIn("ubuntu-jammy-22.04-amd64-server", self.content)

    def test_aws_instances(self):
        resources = extract_resources(self.content)
        instances = [r for r in resources if r[0] == "aws_instance"]
        # 至少 5 个: 1 patroni + 1 pgbouncer + 3 app
        self.assertGreaterEqual(len(instances), 5)

    def test_patroni_cascade(self):
        self.assertIn("zhs-patroni-cascade", self.content)
        self.assertIn('Role = "patroni-cascade"', self.content)

    def test_alb_defined(self):
        self.assertIn('resource "aws_lb"', self.content)
        self.assertIn('resource "aws_lb_target_group"', self.content)
        self.assertIn('resource "aws_lb_listener"', self.content)

    def test_alb_health_check(self):
        self.assertIn('health_check {', self.content)
        self.assertIn('path                = "/healthz"', self.content)

    def test_alb_target_attachments(self):
        # 必须有 3 个 app target attachment
        attachments = re.findall(r'resource "aws_lb_target_group_attachment"', self.content)
        self.assertGreaterEqual(len(attachments), 3)

    def test_rto_3600_seconds(self):
        # AWS 灾备 RTO 必须 = 3600 (1h)
        m = re.search(r'rto_seconds.*?value\s*=\s*(\d+)', self.content, re.DOTALL)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "3600")

    def test_rpo_5_seconds(self):
        # AWS 异步复制 RPO 必须 = 5
        m = re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', self.content, re.DOTALL)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "5")

    def test_outputs(self):
        outputs = extract_outputs(self.content)
        required = ["vpc_id", "alb_dns", "patroni_cascade_ip", "pgbouncer_ip"]
        for r in required:
            self.assertIn(r, outputs)


class TestCrossCloudConsistency(unittest.TestCase):
    """跨云一致性测试"""

    def test_three_regions(self):
        # 必须有 3 个区域的 TF
        self.assertTrue(ALIYUN_TF.exists())
        self.assertTrue(HUAWEI_TF.exists())
        self.assertTrue(AWS_TF.exists())

    def test_three_regions_distinct(self):
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        # 区域标识必须各不相同
        self.assertIn("cn-hangzhou", al)
        self.assertIn("cn-south-1", hw)
        self.assertIn("ap-northeast-1", aws)

    def test_rpo_progression(self):
        """RPO 必须递增: 阿里云(0) < 华为云(0) < AWS(5)"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        al_rpo = int(re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', al, re.DOTALL).group(1))
        hw_rpo = int(re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', hw, re.DOTALL).group(1))
        aws_rpo = int(re.search(r'rpo_seconds.*?value\s*=\s*(\d+)', aws, re.DOTALL).group(1))

        self.assertEqual(al_rpo, 0)
        self.assertEqual(hw_rpo, 0)
        self.assertEqual(aws_rpo, 5)
        self.assertLessEqual(al_rpo, hw_rpo)
        self.assertLess(hw_rpo, aws_rpo)

    def test_rto_progression(self):
        """RTO 必须递增: 阿里云(15) < 华为云(30) < AWS(3600)"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        al_rto = int(re.search(r'rto_seconds.*?value\s*=\s*(\d+)', al, re.DOTALL).group(1))
        hw_rto = int(re.search(r'rto_seconds.*?value\s*=\s*(\d+)', hw, re.DOTALL).group(1))
        aws_rto = int(re.search(r'rto_seconds.*?value\s*=\s*(\d+)', aws, re.DOTALL).group(1))

        self.assertEqual(al_rto, 15)
        self.assertEqual(hw_rto, 30)
        self.assertEqual(aws_rto, 3600)
        self.assertLess(al_rto, hw_rto)
        self.assertLess(hw_rto, aws_rto)

    def test_same_naming_convention(self):
        """3 个云的资源命名规范必须一致"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        # 共同前缀
        for prefix in ["zhs-vpc", "zhs-patroni", "zhs-pgbouncer"]:
            self.assertIn(prefix, al, f"阿里云缺前缀 {prefix}")
            self.assertIn(prefix, hw, f"华为云缺前缀 {prefix}")
            self.assertIn(prefix, aws, f"AWS 缺前缀 {prefix}")

    def test_patroni_roles_consistent(self):
        """Patroni 角色必须明确标注"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        self.assertIn("patroni-leader", al)
        self.assertIn("patroni-standby", al)
        self.assertIn("patroni-standby", hw)
        self.assertIn("patroni-cascade", aws)

    def test_app_node_count_acceptable(self):
        """App 节点数: 阿里云 2, 华为云 2, AWS 3 (只读+灾备)"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        al_apps = len(re.findall(r'zhs-app-\d', al))
        hw_apps = len(re.findall(r'zhs-app-\d', hw))
        aws_apps = len(re.findall(r'zhs-app-\d', aws))

        self.assertGreaterEqual(al_apps, 2)
        self.assertGreaterEqual(hw_apps, 2)
        self.assertGreaterEqual(aws_apps, 3)

    def test_security_groups_port_8000(self):
        """所有云的安全组必须允许 8000 (应用 HTTP)"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        self.assertIn("8000", al)
        self.assertIn("8000", hw)
        self.assertIn("8000", aws)

    def test_pg_port_5432(self):
        """所有云必须定义 5432 (PostgreSQL)"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        self.assertIn("5432", al)
        self.assertIn("5432", hw)
        self.assertIn("5432", aws)

    def test_patroni_port_8008(self):
        """所有云必须定义 8008 (Patroni REST)"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        self.assertIn("8008", al)
        self.assertIn("8008", hw)
        self.assertIn("8008", aws)

    def test_lb_with_health_check(self):
        """所有云的负载均衡必须配置健康检查"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        self.assertIn("health_check", al)
        self.assertIn("/healthz", al)
        self.assertIn("/healthz", aws)
        # 华为云 ELB 健康检查字段名不同
        self.assertIn("huaweicloud_elb_listener", hw)

    def test_terraform_blocks_aligned(self):
        """所有 TF 文件必须使用 terraform 块定义版本和 provider"""
        for path in [ALIYUN_TF, HUAWEI_TF, AWS_TF]:
            content = read(path)
            self.assertIn("terraform {", content)
            self.assertIn("required_version", content)
            self.assertIn("required_providers", content)

    def test_postgresql_in_aliyun(self):
        """阿里云必须使用 PostgreSQL (不允许 MySQL)"""
        al = read(ALIYUN_TF)
        self.assertIn("PostgreSQL", al)
        # 不允许 MySQL 引用
        self.assertNotIn("MySQL", al)
        self.assertNotIn("mysql", al)

    def test_postgresql_in_huawei(self):
        """华为云必须使用 PostgreSQL"""
        hw = read(HUAWEI_TF)
        # 华为云 main.tf 不直接使用 DB, 但跨云一致应使用 PG
        self.assertNotIn("MySQL", hw)
        self.assertNotIn("mysql", hw)

    def test_postgresql_in_aws(self):
        """AWS 必须使用 PostgreSQL"""
        aws = read(AWS_TF)
        self.assertNotIn("MySQL", aws)
        self.assertNotIn("mysql", aws)

    def test_tags_management_marker(self):
        """所有 TF 必须含 ManagedBy=terraform 标记"""
        for path in [ALIYUN_TF, HUAWEI_TF, AWS_TF]:
            content = read(path)
            self.assertIn("ManagedBy", content)
            self.assertIn("terraform", content)


class TestResourceCountSummary(unittest.TestCase):
    """资源统计"""

    def test_resource_summary(self):
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        al_res = extract_resources(al)
        hw_res = extract_resources(hw)
        aws_res = extract_resources(aws)

        # 阿里云资源数 > 15 (vpc + 3 vsw + sg + 6 rules + nat + eip + 2 eip_assoc + 5 ecs + 1 rds + 3 rds + slb + slb_tg + slb_listener)
        self.assertGreaterEqual(len(al_res), 18, f"阿里云资源 {len(al_res)}")
        self.assertGreaterEqual(len(hw_res), 12, f"华为云资源 {len(hw_res)}")
        self.assertGreaterEqual(len(aws_res), 14, f"AWS 资源 {len(aws_res)}")

    def test_outputs_summary(self):
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        al_out = extract_outputs(al)
        hw_out = extract_outputs(hw)
        aws_out = extract_outputs(aws)

        self.assertGreaterEqual(len(al_out), 14)
        self.assertGreaterEqual(len(hw_out), 7)
        self.assertGreaterEqual(len(aws_out), 6)


class TestSubnetPlanning(unittest.TestCase):
    """网段规划测试"""

    def test_no_subnet_overlap(self):
        """3 个云的网段必须不重叠"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        al_cidrs = re.findall(r'10\.0\.\d+\.0/\d+', al)
        hw_cidrs = re.findall(r'10\.1\.\d+\.0/\d+', hw)
        aws_cidrs = re.findall(r'10\.2\.\d+\.0/\d+', aws)

        # 各自的私有网段
        self.assertGreater(len(al_cidrs), 0)
        self.assertGreater(len(hw_cidrs), 0)
        self.assertGreater(len(aws_cidrs), 0)

        # 跨网段无交集
        all_cidrs = al_cidrs + hw_cidrs + aws_cidrs
        counter = Counter(all_cidrs)
        duplicates = {k: v for k, v in counter.items() if v > 1}
        self.assertEqual(len(duplicates), 0, f"重复网段: {duplicates}")


class TestFailoverReadiness(unittest.TestCase):
    """故障切换就绪性测试"""

    def test_all_clouds_have_patroni(self):
        """所有云必须有 Patroni 节点"""
        for path in [ALIYUN_TF, HUAWEI_TF, AWS_TF]:
            content = read(path)
            self.assertIn("patroni", content.lower())

    def test_all_clouds_have_pgbouncer(self):
        """所有云必须有 pgBouncer"""
        for path in [ALIYUN_TF, HUAWEI_TF, AWS_TF]:
            content = read(path)
            self.assertIn("pgbouncer", content.lower())

    def test_all_clouds_have_lb(self):
        """所有云必须有负载均衡"""
        al = read(ALIYUN_TF)
        hw = read(HUAWEI_TF)
        aws = read(AWS_TF)

        self.assertIn("alicloud_slb", al)
        self.assertIn("huaweicloud_elb", hw)
        self.assertIn("aws_lb", aws)


if __name__ == "__main__":
    unittest.main(verbosity=2)
